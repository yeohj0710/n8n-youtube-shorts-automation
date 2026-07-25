// 카드 이미지를 인스타/유튜브 데드존 밖으로 강제 배치한다.
// GPT Image가 안전 영역 지시를 무시하고 가장자리까지 꽉 채웠을 때 쓰는 보정 도구.
//
// 사용:
//   node scripts/enforce-card-safe-zone.mjs "G:\내 드라이브\여형준님\27 영상 데이터\40_카드뉴스_이미지"
//
// 동작: 원본 카드를 안전 영역 크기로 축소해 캔버스 안쪽에 배치하고,
// 남는 가장자리는 원본을 흐리게 확대한 배경으로 채운다.
// 원본은 같은 폴더의 `보정전/`으로 옮기고, 보정본이 원래 이름을 가져간다.

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const targetDir = process.argv[2];
if (!targetDir) throw new Error('보정할 폴더 경로를 인자로 넘겨주세요.');

// 캔버스 가장자리에서 띄울 비율 (프롬프트의 안전 영역과 동일)
const MARGINS = {
  '4:5': { top: 0.08, bottom: 0.12, left: 0.05, right: 0.12 },
  '9:16': { top: 0.12, bottom: 0.22, left: 0.05, right: 0.11 },
};

const supported = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function detectAspect(width, height) {
  const ratio = width / height;
  // 4:5 = 0.800, 9:16 = 0.5625 — 가까운 쪽으로 판정
  return Math.abs(ratio - 0.8) < Math.abs(ratio - 0.5625) ? '4:5' : '9:16';
}

const entries = await fs.readdir(targetDir, { withFileTypes: true });
const files = entries
  .filter((e) => e.isFile() && supported.has(path.extname(e.name).toLowerCase()))
  .map((e) => e.name);

if (!files.length) {
  console.log(JSON.stringify({ ok: true, processed: 0, note: '보정할 이미지가 없습니다.' }));
  process.exit(0);
}

const backupDir = path.join(targetDir, '보정전');
await fs.mkdir(backupDir, { recursive: true });

const results = [];
for (const name of files) {
  const filePath = path.join(targetDir, name);
  const input = await sharp(filePath);
  const meta = await input.metadata();
  const width = meta.width;
  const height = meta.height;
  const aspect = detectAspect(width, height);
  const m = MARGINS[aspect];

  const innerWidth = Math.round(width * (1 - m.left - m.right));
  const innerHeight = Math.round(height * (1 - m.top - m.bottom));

  // 원본 비율을 유지하며 안전 영역에 맞춰 축소한다. 축소 후 남는 여백은
  // 좌상단에 몰지 말고 안전 영역 안에서 가운데로 나눈다 — 9:16은 그냥 두면
  // 카드가 왼쪽에 붙고 오른쪽에 29% 여백이 생긴다.
  const scale = Math.min(innerWidth / width, innerHeight / height);
  const cardWidth = Math.round(width * scale);
  const cardHeight = Math.round(height * scale);
  const offsetLeft = Math.round(width * m.left + (innerWidth - cardWidth) / 2);
  const offsetTop = Math.round(height * m.top + (innerHeight - cardHeight) / 2);

  const original = await fs.readFile(filePath);
  const background = await sharp(original)
    .resize(width, height, { fit: 'cover', position: 'center' })
    .blur(40)
    .modulate({ brightness: 0.92 })
    .toBuffer();
  const card = await sharp(original)
    .resize(cardWidth, cardHeight, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .toBuffer();

  const output = await sharp(background)
    .composite([{ input: card, top: offsetTop, left: offsetLeft }])
    .png()
    .toBuffer();

  await fs.rename(filePath, path.join(backupDir, name));
  await fs.writeFile(path.join(targetDir, path.parse(name).name + '.png'), output);
  results.push({
    file: name,
    aspect,
    canvas: `${width}x${height}`,
    card: `${cardWidth}x${cardHeight}`,
    margins: {
      top: `${((offsetTop / height) * 100).toFixed(1)}%`,
      bottom: `${(((height - offsetTop - cardHeight) / height) * 100).toFixed(1)}%`,
      left: `${((offsetLeft / width) * 100).toFixed(1)}%`,
      right: `${(((width - offsetLeft - cardWidth) / width) * 100).toFixed(1)}%`,
    },
  });
}

console.log(JSON.stringify({ ok: true, processed: results.length, backup_dir: backupDir, results }, null, 2));
