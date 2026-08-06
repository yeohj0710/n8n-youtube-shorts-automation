import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fitCanvasWithSafeZone } from './lib/safe-zone.mjs';
import { chooseBgmWindow, bgmFadeFilter } from './lib/bgm-window.mjs';

const payloadArg = process.argv[2];
if (!payloadArg) {
  throw new Error('Missing base64 render payload argument.');
}

const payload = JSON.parse(Buffer.from(payloadArg, 'base64').toString('utf8'));
const renderId = payload.render_id || String(Date.now());
const outputDir = payload.output_dir || process.env.LOCAL_RENDER_DIR || path.resolve('renders');
const ffmpegPath = payload.ffmpeg_path || process.env.FFMPEG_PATH || 'ffmpeg';
const width = Number(payload.width || 1080);
const height = Number(payload.height || 1920);
const duration = Number(payload.duration || 5);

await fs.mkdir(outputDir, { recursive: true });

const cardPath = path.join(outputDir, `${renderId}.png`);
const audioPath = path.join(outputDir, `${renderId}-bgm.mp3`);
const outputPath = path.join(outputDir, `${renderId}.mp4`);

async function readInputBuffer(input, label) {
  const value = String(input || '');
  if (value.startsWith('file://')) {
    return fs.readFile(fileURLToPath(value));
  }
  if (/^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('\\\\')) {
    return fs.readFile(value);
  }

  const response = await fetch(value, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) {
    throw new Error(`${label} download failed: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error(`${label} download returned an empty file.`);
  }
  return buffer;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg failed with code ${code}: ${stderr || stdout}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

// ffprobe는 ffmpeg 옆에 같이 깔린다. 없으면 길이를 모른 채로 넘어가고, 그러면
// chooseBgmWindow가 offset 0으로 떨어져 예전과 똑같이 동작한다. 렌더를 막지 않는다.
function ffprobePathFrom(ffmpegBinary) {
  const value = String(ffmpegBinary || 'ffmpeg');
  const replaced = value.replace(/ffmpeg(\.exe)?$/i, (match) => (match.toLowerCase() === 'ffmpeg.exe' ? 'ffprobe.exe' : 'ffprobe'));
  return replaced === value ? 'ffprobe' : replaced;
}

async function probeDurationSeconds(filePath) {
  try {
    const { stdout } = await run(ffprobePathFrom(ffmpegPath), [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    const parsed = Number(String(stdout).trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

if (!payload.image_url) throw new Error('payload.image_url is required.');
if (!payload.bgm_audio_url) throw new Error('payload.bgm_audio_url is required.');

const [imageBuffer, audioBuffer] = await Promise.all([
  readInputBuffer(payload.image_url, 'image'),
  readInputBuffer(payload.bgm_audio_url, 'bgm'),
]);

await fs.writeFile(audioPath, audioBuffer);

// 데드존(안전 영역) 처리 지점. 모든 회로가 이 스크립트를 거친다.
//
// 기본값이 'off'인 이유(2026-08-04): 'auto'는 데드존을 넘긴 프레임을 안전 상자 안으로
// 축소하고 남는 가장자리를 흐린 배경으로 메운다. 풀블리드 9:16 카드에서는 예외 없이
// 0.66배로 줄어들어 사방에 띠가 둘리는데(9:16=0.5625가 안전 상자 0.716보다 좁아 세로가
// 먼저 걸린다), 그렇게 잘못 줄어든 영상이 여러 번 발행돼 사용자가 이 처리를 금지했다.
// 여백은 생성 프롬프트(SHORTS_MARGIN_V1)와 회로별 행 수 상한으로 확보한다.
// 축소가 필요한 호출은 payload에 'auto'나 'fit'을 명시해서 켠다.
const safeZone = await fitCanvasWithSafeZone(imageBuffer, {
  width,
  height,
  mode: payload.safe_zone_mode || 'off',
});
await fs.writeFile(cardPath, safeZone.buffer);

// BGM_WINDOW_V1: 곡의 어디를 쓸지 고른다. 2026-08-06 이전에는 무조건 0~5초였고,
// 그래서 서로 다른 곡을 뽑아도 시청자에게는 늘 같은 도입부만 들렸다. 자세한 근거는
// lib/bgm-window.mjs 주석에 있다. 분위기·악기·조성은 여기서 건드리지 않는다.
const audioDuration = Number(payload.bgm_audio_duration) > 0
  ? Number(payload.bgm_audio_duration)
  : await probeDurationSeconds(audioPath);
const bgmWindow = chooseBgmWindow({
  audioDuration,
  clipDuration: duration,
  seed: payload.bgm_window_seed || renderId,
});

await run(ffmpegPath, [
  '-y',
  '-loop', '1',
  '-framerate', '30',
  '-i', cardPath,
  '-stream_loop', '-1',
  ...(bgmWindow.offset > 0 ? ['-ss', String(bgmWindow.offset)] : []),
  '-i', audioPath,
  '-t', String(duration),
  '-vf', 'format=yuv420p',
  '-af', bgmFadeFilter(duration),
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-tune', 'stillimage',
  '-crf', '18',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-shortest',
  '-movflags', '+faststart',
  outputPath,
]);

console.log(JSON.stringify({
  ok: true,
  render_id: renderId,
  card_path: cardPath,
  audio_path: audioPath,
  output_path: outputPath,
  rendered_video_url: outputPath,
  duration_seconds: duration,
  bgm_window: {
    offset_seconds: bgmWindow.offset,
    reason: bgmWindow.reason,
    audio_duration_seconds: bgmWindow.audio_duration,
    usable_span_seconds: Math.round(bgmWindow.usable_span * 10) / 10,
  },
  safe_zone: {
    applied: safeZone.applied,
    reason: safeZone.reason,
    scale: safeZone.scale,
    box: safeZone.safe_box && {
      left: safeZone.safe_box.left,
      top: safeZone.safe_box.top,
      right: safeZone.safe_box.right,
      bottom: safeZone.safe_box.bottom,
    },
    card: safeZone.card,
    violation: safeZone.violation,
  },
}));
