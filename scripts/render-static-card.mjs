import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

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
const duration = Number(payload.duration || 38);

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
  return Buffer.from(await response.arrayBuffer());
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapText(value, maxChars) {
  const text = String(value || '').trim();
  if (!text) return [];

  const words = text.split(/\s+/);
  const lines = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if ([...next].length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function textBlock(lines, x, y, fontSize, fill, weight = 800, lineHeight = 1.25, anchor = 'middle') {
  return lines.map((line, index) => {
    const dy = index === 0 ? 0 : fontSize * lineHeight;
    return `<text x="${x}" y="${y + dy}" text-anchor="${anchor}" font-size="${fontSize}" font-weight="${weight}" fill="${fill}" stroke="rgba(0,0,0,0.45)" stroke-width="2" paint-order="stroke">${escapeXml(line)}</text>`;
  }).join('\n');
}

function buildOverlaySvg() {
  const titleLines = wrapText(payload.title || '건강 랭킹 BEST 7', 13).slice(0, 2);
  const subtitleLines = wrapText(payload.subtitle || '일반 건강 정보 · 개인차가 있습니다', 22).slice(0, 1);
  const items = Array.isArray(payload.items) ? payload.items : [];
  const rankLines = items
    .sort((a, b) => Number(b.rank) - Number(a.rank))
    .map((item) => `${item.rank}위  ${item.name}`)
    .slice(0, 7);

  const rankSvg = rankLines.map((line, index) => {
    const y = 720 + index * 112;
    return `
      <rect x="120" y="${y - 58}" width="840" height="82" rx="20" fill="rgba(255,255,255,0.12)" />
      <text x="165" y="${y}" text-anchor="start" font-size="50" font-weight="900" fill="#ffffff" stroke="rgba(0,0,0,0.55)" stroke-width="2" paint-order="stroke">${escapeXml(line)}</text>
    `;
  }).join('\n');

  return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      text { font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans CJK KR", Arial, sans-serif; letter-spacing: 0; }
    </style>
    <rect x="60" y="210" width="960" height="1430" rx="34" fill="rgba(0,0,0,0.48)" />
    <rect x="60" y="210" width="960" height="1430" rx="34" fill="none" stroke="rgba(255,255,255,0.32)" stroke-width="3" />
    ${textBlock(titleLines, width / 2, 370, 72, '#ffffff', 900, 1.18)}
    ${textBlock(subtitleLines, width / 2, 555, 36, '#ffe66d', 800, 1.25)}
    ${rankSvg}
    <text x="${width / 2}" y="1740" text-anchor="middle" font-size="30" font-weight="700" fill="#ffffff" opacity="0.92">일반 건강 정보이며 진료를 대신하지 않습니다</text>
  </svg>`;
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

const background = await sharp(imageBuffer)
  .resize(width, height, { fit: 'cover', position: 'center' })
  .png()
  .toBuffer();

await sharp(background)
  .composite([{ input: Buffer.from(buildOverlaySvg()), top: 0, left: 0 }])
  .png()
  .toFile(cardPath);

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
  '-crf', '22',
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
  duration_seconds: duration
}));
