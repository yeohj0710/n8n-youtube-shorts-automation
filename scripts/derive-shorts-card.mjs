// 인스타용 4:5 카드에서 유튜브 쇼츠용 9:16 카드를 만든다.
//
// GPT Image는 위/아래/좌/우 마진을 따로 주면 하나의 균일한 여백으로 뭉개서
// 그린다(다섯 번 확인). 9:16의 아래 22%처럼 큰 비대칭 마진은 절대 안 지킨다.
// 그래서 9:16은 생성 모델에 맡기지 않고, 잘 나온 4:5 카드를 안전 영역 안에
// 기계적으로 배치해 만든다. 항상 정확히 맞는다.
//
// 사용:
//   node scripts/derive-shorts-card.mjs "G:\내 드라이브\여형준님\27 영상 데이터\40_카드뉴스_이미지"
//   node scripts/derive-shorts-card.mjs "…\01_제목 (인스타 4x5).png"
//
// 입력: 파일명에 `(인스타 4x5)`가 들어간 4:5 이미지
// 출력: 같은 폴더에 `(유튜브 9x16)`으로 이름만 바꾼 1080×1920 PNG
// 원본 4:5는 그대로 둔다(인스타에 그대로 올린다).

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { SUPPORTED_IMAGE_EXTENSIONS as supported, marginsFor } from './lib/safe-zone.mjs';

const target = process.argv[2];
if (!target) throw new Error('4:5 카드가 있는 폴더 또는 이미지 경로를 인자로 넘겨주세요.');

const CANVAS = { width: 1080, height: 1920 };
const MARGIN = marginsFor('9:16');

const INSTAGRAM_TAG = '(인스타 4x5)';
const SHORTS_TAG = '(유튜브 9x16)';

function isFourByFive(width, height) {
  return Math.abs(width / height - 0.8) < Math.abs(width / height - 0.5625);
}

function shortsNameFor(name) {
  const base = path.parse(name).name;
  return (base.includes(INSTAGRAM_TAG) ? base.replace(INSTAGRAM_TAG, SHORTS_TAG) : `${base} ${SHORTS_TAG}`) + '.png';
}

const stat = await fs.stat(target);
let sourceDir;
let files;
if (stat.isDirectory()) {
  sourceDir = target;
  const entries = await fs.readdir(target, { withFileTypes: true });
  files = entries
    .filter((e) => e.isFile() && supported.has(path.extname(e.name).toLowerCase()))
    .filter((e) => !e.name.includes(SHORTS_TAG))
    .map((e) => e.name);
} else {
  sourceDir = path.dirname(target);
  files = [path.basename(target)];
}

const safeWidth = Math.round(CANVAS.width * (1 - MARGIN.left - MARGIN.right));
const safeHeight = Math.round(CANVAS.height * (1 - MARGIN.top - MARGIN.bottom));

const results = [];
const skipped = [];
for (const name of files) {
  const filePath = path.join(sourceDir, name);
  const original = await fs.readFile(filePath);
  const meta = await sharp(original).metadata();
  if (!isFourByFive(meta.width, meta.height)) {
    skipped.push({ file: name, reason: `4:5가 아님 (${meta.width}x${meta.height})` });
    continue;
  }

  // 안전 영역 안에 비율 그대로 넣는다. 4:5(0.800)가 안전 영역(0.716)보다 넓어
  // 폭이 먼저 차고, 남는 세로 여유는 위아래로 나눈다.
  const scale = Math.min(safeWidth / meta.width, safeHeight / meta.height);
  const cardWidth = Math.round(meta.width * scale);
  const cardHeight = Math.round(meta.height * scale);
  const left = Math.round(CANVAS.width * MARGIN.left + (safeWidth - cardWidth) / 2);
  const top = Math.round(CANVAS.height * MARGIN.top + (safeHeight - cardHeight) / 2);

  const background = await sharp(original)
    .resize(CANVAS.width, CANVAS.height, { fit: 'cover', position: 'center' })
    .blur(40)
    .modulate({ brightness: 0.92 })
    .toBuffer();
  const card = await sharp(original)
    .resize(cardWidth, cardHeight, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .toBuffer();
  const output = await sharp(background)
    .composite([{ input: card, top, left }])
    .png()
    .toBuffer();

  const outName = shortsNameFor(name);
  await fs.writeFile(path.join(sourceDir, outName), output);
  results.push({
    source: name,
    output: outName,
    card: `${cardWidth}x${cardHeight}`,
    margins: {
      top: `${((top / CANVAS.height) * 100).toFixed(1)}%`,
      bottom: `${(((CANVAS.height - top - cardHeight) / CANVAS.height) * 100).toFixed(1)}%`,
      left: `${((left / CANVAS.width) * 100).toFixed(1)}%`,
      right: `${(((CANVAS.width - left - cardWidth) / CANVAS.width) * 100).toFixed(1)}%`,
    },
  });
}

console.log(JSON.stringify({ ok: true, created: results.length, results, skipped }, null, 2));
