// 카드 위에 인스타/유튜브 데드존(안전 영역) 경계선을 그려 검수본을 만든다.
// 생성된 카드가 안전선을 넘었는지 눈으로 1초 만에 판정하기 위한 도구다.
//
// 사용:
//   node scripts/preview-card-safe-zone.mjs "G:\내 드라이브\여형준님\27 영상 데이터\40_카드뉴스_이미지"
//   node scripts/preview-card-safe-zone.mjs "…\40_카드뉴스_이미지\01_… (유튜브 9x16).png"
//
// 원본은 건드리지 않고 같은 폴더의 `검수/`에 `<이름>.검수.png`로 저장한다.
// 빨간 반투명 띠 = 앱 UI가 덮는 영역. 그 안에 글자가 있으면 실패다.

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  SAFE_ZONE_MARGINS as MARGINS,
  SUPPORTED_IMAGE_EXTENSIONS as supported,
  detectAspect,
} from './lib/safe-zone.mjs';

const target = process.argv[2];
if (!target) throw new Error('검수할 폴더 또는 이미지 경로를 인자로 넘겨주세요.');

function overlaySvg(width, height, aspect, m) {
  const top = Math.round(height * m.top);
  const bottom = Math.round(height * m.bottom);
  const left = Math.round(width * m.left);
  const right = Math.round(width * m.right);
  const label = Math.round(width * 0.028);
  const band = 'fill="#ff2d2d" fill-opacity="0.28"';
  const line = 'stroke="#ff2d2d" stroke-width="' + Math.max(2, Math.round(width * 0.004)) + '" fill="none"';
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect x="0" y="0" width="${width}" height="${top}" ${band}/>
  <rect x="0" y="${height - bottom}" width="${width}" height="${bottom}" ${band}/>
  <rect x="0" y="${top}" width="${left}" height="${height - top - bottom}" ${band}/>
  <rect x="${width - right}" y="${top}" width="${right}" height="${height - top - bottom}" ${band}/>
  <rect x="${left}" y="${top}" width="${width - left - right}" height="${height - top - bottom}" ${line}/>
  <text x="${Math.round(width * 0.02)}" y="${top - Math.round(label * 0.35)}" font-family="sans-serif" font-size="${label}" font-weight="bold" fill="#ff2d2d">${aspect}  top ${(m.top * 100).toFixed(0)}%</text>
  <text x="${Math.round(width * 0.02)}" y="${height - bottom + label}" font-family="sans-serif" font-size="${label}" font-weight="bold" fill="#ff2d2d">bottom ${(m.bottom * 100).toFixed(0)}%  ·  left ${(m.left * 100).toFixed(0)}%  ·  right ${(m.right * 100).toFixed(0)}%</text>
</svg>`);
}

const stat = await fs.stat(target);
let sourceDir;
let files;
if (stat.isDirectory()) {
  sourceDir = target;
  const entries = await fs.readdir(target, { withFileTypes: true });
  files = entries
    .filter((e) => e.isFile() && supported.has(path.extname(e.name).toLowerCase()))
    .map((e) => e.name);
} else {
  sourceDir = path.dirname(target);
  files = [path.basename(target)];
}

if (!files.length) {
  console.log(JSON.stringify({ ok: true, processed: 0, note: '검수할 이미지가 없습니다.' }));
  process.exit(0);
}

const outDir = path.join(sourceDir, '검수');
await fs.mkdir(outDir, { recursive: true });

const results = [];
for (const name of files) {
  const filePath = path.join(sourceDir, name);
  const original = await fs.readFile(filePath);
  const meta = await sharp(original).metadata();
  const aspect = detectAspect(meta.width, meta.height);
  const m = MARGINS[aspect];

  const output = await sharp(original)
    .composite([{ input: overlaySvg(meta.width, meta.height, aspect, m), top: 0, left: 0 }])
    .png()
    .toBuffer();

  const outPath = path.join(outDir, path.parse(name).name + '.검수.png');
  await fs.writeFile(outPath, output);
  results.push({ file: name, aspect, canvas: `${meta.width}x${meta.height}`, preview: outPath });
}

console.log(JSON.stringify({ ok: true, processed: results.length, preview_dir: outDir, results }, null, 2));
