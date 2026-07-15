import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

function run(file, args, timeout = 120000) {
  const result = spawnSync(file, args.map(String), { encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 20 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || `${file} exited ${result.status}`);
  return result.stdout;
}

const payload = JSON.parse(Buffer.from(process.argv[2] || '', 'base64').toString('utf8'));
const mediaPath = path.resolve(payload.media_path);
const outputDir = path.resolve(payload.keyframe_dir);
const contactSheetPath = path.resolve(payload.contact_sheet_path);
const ffmpegPath = path.resolve(payload.ffmpeg_path);
const ffprobePath = path.join(path.dirname(ffmpegPath), 'ffprobe.exe');
const maxFrames = Math.max(3, Math.min(8, Number(payload.max_frames || 8)));
fs.mkdirSync(outputDir, { recursive: true });
for (const name of fs.readdirSync(outputDir)) if (/^frame_\d+\.jpg$/i.test(name)) fs.unlinkSync(path.join(outputDir, name));

const duration = Number(run(ffprobePath, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', mediaPath]).trim());
if (!Number.isFinite(duration) || duration <= 0) throw new Error('Could not read source duration.');
const fractions = maxFrames === 1 ? [0.5] : Array.from({ length: maxFrames }, (_, index) => 0.03 + (0.94 * index / (maxFrames - 1)));
const frames = [];
for (const [index, fraction] of fractions.entries()) {
  const seconds = Math.max(0, Math.min(duration - 0.05, duration * fraction));
  const file = path.join(outputDir, `frame_${String(index + 1).padStart(3, '0')}.jpg`);
  run(ffmpegPath, ['-y', '-ss', seconds.toFixed(3), '-i', mediaPath, '-frames:v', '1', '-vf', 'scale=720:-2', '-q:v', '2', file]);
  frames.push({ index: index + 1, seconds: Number(seconds.toFixed(3)), file: file.replace(/\\/g, '/') });
}

const tileWidth = 360;
const tileHeight = 640;
const columns = 4;
const rows = Math.ceil(frames.length / columns);
const composites = [];
for (const [index, frame] of frames.entries()) {
  const buffer = await sharp(frame.file).resize(tileWidth, tileHeight, { fit: 'cover' }).jpeg({ quality: 84 }).toBuffer();
  composites.push({ input: buffer, left: (index % columns) * tileWidth, top: Math.floor(index / columns) * tileHeight });
}
await sharp({ create: { width: columns * tileWidth, height: rows * tileHeight, channels: 3, background: '#111827' } })
  .composite(composites)
  .jpeg({ quality: 88 })
  .toFile(contactSheetPath);

const result = { ok: true, duration_seconds: duration, frames, contact_sheet: contactSheetPath.replace(/\\/g, '/') };
console.log(JSON.stringify(result));
