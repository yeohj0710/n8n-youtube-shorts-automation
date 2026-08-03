import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fitCanvasWithSafeZone } from './lib/safe-zone.mjs';

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

if (!payload.image_url) throw new Error('payload.image_url is required.');
if (!payload.bgm_audio_url) throw new Error('payload.bgm_audio_url is required.');

const [imageBuffer, audioBuffer] = await Promise.all([
  readInputBuffer(payload.image_url, 'image'),
  readInputBuffer(payload.bgm_audio_url, 'bgm'),
]);

await fs.writeFile(audioPath, audioBuffer);

// 데드존(안전 영역) 강제 지점. 모든 회로가 이 스크립트를 거치므로, 여기서
// 한 번 막으면 이미지 출처(생성 모델이든 완성 카드 폴더든)와 무관하게 지켜진다.
// 이미지 프롬프트로는 안 된다는 게 이 저장소의 결론이다 — lib/safe-zone.mjs 주석 참고.
const safeZone = await fitCanvasWithSafeZone(imageBuffer, {
  width,
  height,
  mode: payload.safe_zone_mode || 'auto',
});
await fs.writeFile(cardPath, safeZone.buffer);

await run(ffmpegPath, [
  '-y',
  '-loop', '1',
  '-framerate', '30',
  '-i', cardPath,
  '-stream_loop', '-1',
  '-i', audioPath,
  '-t', String(duration),
  '-vf', 'format=yuv420p',
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
