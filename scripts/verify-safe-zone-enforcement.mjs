// 데드존(안전 영역)이 모든 회로에서 실제로 강제되는지 검사한다.
//
// 이 검사가 필요한 이유: 프롬프트에 안전 영역 문구를 넣어둔 상태로 몇 주를
// 보냈지만 GPT Image가 그걸 지킨 프레임은 한 장도 없었다. 프롬프트 존재 여부만
// 확인하는 검사는 "지켜지고 있다"는 착각을 준다. 그래서 여기서는
// ①렌더 단계의 기계적 강제 ②모든 회로가 그 렌더를 거치는지 ③프롬프트 좌표가
// 표에서 나온 값인지, 세 가지를 전부 본다.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import sqlite3 from 'sqlite3';
import {
  SAFE_ZONE_MARGINS,
  detectAspect,
  fitCanvasWithSafeZone,
  safeBoxFor,
  shortsSafeZonePromptLines,
} from './lib/safe-zone.mjs';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const workflowDir = path.join(root, 'workflows');
const scriptsDir = path.join(root, 'scripts');
const fail = (message) => { throw new Error(message); };

// ---------------------------------------------------------------------------
// 1. 기준 좌표
// ---------------------------------------------------------------------------
const box = safeBoxFor(1080, 1920, '9:16');
if (box.left !== 54 || box.top !== 230 || box.right !== 961 || box.bottom !== 1498) {
  fail(`9:16 safe box drifted: ${JSON.stringify(box)}`);
}
if (detectAspect(1080, 1920) !== '9:16' || detectAspect(1122, 1402) !== '4:5') {
  fail('aspect detection broken');
}
for (const [aspect, margins] of Object.entries(SAFE_ZONE_MARGINS)) {
  const total = margins.top + margins.bottom + margins.left + margins.right;
  if (total <= 0 || margins.top + margins.bottom >= 0.6 || margins.left + margins.right >= 0.6) {
    fail(`${aspect}: implausible margin table ${JSON.stringify(margins)}`);
  }
}

// ---------------------------------------------------------------------------
// 2. 마진 표는 한 곳에만 있어야 한다
// ---------------------------------------------------------------------------
const sharedTableConsumers = ['preview-card-safe-zone.mjs', 'enforce-card-safe-zone.mjs', 'derive-shorts-card.mjs'];
for (const name of sharedTableConsumers) {
  const source = fs.readFileSync(path.join(scriptsDir, name), 'utf8');
  if (!/from '\.\/lib\/safe-zone\.mjs'/.test(source)) fail(`${name}: does not import the shared safe-zone table`);
  if (/bottom:\s*0\.2\d/.test(source)) fail(`${name}: still carries its own copy of the margin table`);
}

// ---------------------------------------------------------------------------
// 3. 렌더 단계에서 기계적으로 강제하는가
// ---------------------------------------------------------------------------
const renderSource = fs.readFileSync(path.join(scriptsDir, 'render-static-card.mjs'), 'utf8');
if (!renderSource.includes('fitCanvasWithSafeZone')) fail('render-static-card.mjs: safe-zone enforcement missing');
if (!renderSource.includes('safeZone.buffer')) fail('render-static-card.mjs: writes a card that skipped the safe-zone fit');
if (!renderSource.includes('safe_zone:')) fail('render-static-card.mjs: render result does not report the safe-zone outcome');

// ---------------------------------------------------------------------------
// 4. 모든 발행 회로가 그 렌더 스크립트를 거치는가
// ---------------------------------------------------------------------------
const workflowFiles = fs.readdirSync(workflowDir).filter((name) => name.endsWith('.json')).sort();
const circuits = [];
for (const file of workflowFiles) {
  const workflow = JSON.parse(fs.readFileSync(path.join(workflowDir, file), 'utf8'));
  const nodes = workflow.nodes || [];
  if (!nodes.some((node) => node.name === 'Local FFmpeg Render')) continue;

  const allCode = nodes.map((node) => node.parameters?.jsCode || '').join('\n');
  if (!/local_render_script[^\n]{0,200}render-static-card\.mjs/.test(allCode)) {
    fail(`${file}: no circuit-level local_render_script pointing at render-static-card.mjs`);
  }
  // 안전 영역 강제는 render-static-card.mjs 안에 있다. 다른 렌더 스크립트를
  // 쓰는 순간 그 회로만 조용히 데드존 밖으로 빠져나간다.
  const renderNode = nodes.find((node) => node.name === 'Local FFmpeg Render');
  const renderCode = renderNode?.parameters?.jsCode || '';
  if (!renderCode.includes('render-static-card.mjs')) fail(`${file}: Local FFmpeg Render has no render-static-card.mjs fallback`);
  for (const match of allCode.matchAll(/scripts\/([\w-]+)\.mjs/g)) {
    if (match[1] !== 'render-static-card') fail(`${file}: routes rendering through scripts/${match[1]}.mjs, which skips the safe-zone fit`);
  }

  const generatesImage = nodes.some((node) => node.name === 'KIE Create Image Task');
  circuits.push({ file, id: workflow.id, name: workflow.name, generatesImage, allCode });
}
// 하루건강약사·건강장수비결 본편 2, 원본 릴스 2, 완성 이미지 2, 레퍼런스 카드 1.
// 회로가 늘면 이 숫자를 올리고, 그때 새 회로도 위 조건을 통과하는지 확인할 것.
if (circuits.length !== 7) fail(`expected 7 publishing circuits, found ${circuits.length}`);

// ---------------------------------------------------------------------------
// 5. 이미지를 생성하는 회로는 프롬프트에도 안전 영역을 들고 있어야 한다
// ---------------------------------------------------------------------------
const promptLines = shortsSafeZonePromptLines();
const boxLine = promptLines.find((line) => line.startsWith('SHARED_SAFE_ZONE_V1'));
const reserveLine = promptLines.find((line) => line.startsWith('Reserve '));
const refitLine = promptLines.find((line) => line.startsWith('POST_RENDER_REFIT_V1'));
const coordinateFragment = `x ${box.left}-${box.right} px and y ${box.top}-${box.bottom} px`;
if (!boxLine.includes(coordinateFragment)) fail('prompt box line lost its generated coordinates');

const generating = circuits.filter((circuit) => circuit.generatesImage);
if (generating.length !== 5) fail(`expected 5 image-generating circuits, found ${generating.length}`);
for (const circuit of generating) {
  for (const [label, fragment] of [
    ['critical-content box', coordinateFragment],
    ['UI reserve bands', reserveLine],
    ['post-render refit notice', refitLine],
    ['band background contract', 'BAND_BACKGROUND_V1'],
    ['vertical fill contract', 'VERTICAL_FILL_V2'],
  ]) {
    if (!circuit.allCode.includes(fragment)) fail(`${circuit.file}: image prompt is missing the ${label}`);
  }
}

// ---------------------------------------------------------------------------
// 6. 실제 픽셀 동작
// ---------------------------------------------------------------------------
const rect = (left, top, width, height) =>
  `<rect x="${left}" y="${top}" width="${width}" height="${height}" fill="#101010"/>`;

async function canvasWith(width, height, shapes) {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<rect width="${width}" height="${height}" fill="#f2efe6"/>${shapes.join('')}</svg>`,
  );
  return sharp(svg).png().toBuffer();
}

// 글자를 흉내 낸 짧은 획 묶음. 긴 직선 하나는 카드 테두리로 걸러지므로 안 쓴다.
function textBand(top, left, width, height) {
  const shapes = [];
  const step = 26;
  for (let y = top; y < top + height; y += step) {
    for (let x = left; x < left + width; x += step) {
      shapes.push(rect(x, y, 14, 16));
    }
  }
  return shapes;
}

function inside(card, safeBox) {
  return card.left >= safeBox.left
    && card.top >= safeBox.top
    && card.left + card.width <= safeBox.right
    && card.top + card.height <= safeBox.bottom;
}

const behaviour = {};

// 6-a. 가장자리까지 꽉 찬 카드 → 안전 상자 안으로 축소돼야 한다.
const bleeding = await canvasWith(1080, 1920, [
  ...textBand(60, 80, 900, 180),
  ...textBand(700, 80, 900, 300),
  ...textBand(1720, 120, 840, 140),
]);
const fitted = await fitCanvasWithSafeZone(bleeding, { width: 1080, height: 1920 });
if (!fitted.applied) fail('a full-bleed card was published without a safe-zone refit');
if (!inside(fitted.card, box)) fail(`refit left the card outside the safe box: ${JSON.stringify(fitted.card)}`);
const fittedMeta = await sharp(fitted.buffer).metadata();
if (fittedMeta.width !== 1080 || fittedMeta.height !== 1920) fail('refit did not produce a 1080x1920 frame');
behaviour.full_bleed = { applied: true, scale: fitted.scale, card: fitted.card };

// 6-b. 이미 안전 영역 안에 있는 카드 → 건드리지 않아야 한다(이중 축소 금지).
const compliant = await canvasWith(1080, 1920, textBand(320, 140, 700, 1000));
const untouched = await fitCanvasWithSafeZone(compliant, { width: 1080, height: 1920 });
if (untouched.applied) fail('a compliant card was shrunk again — repeated refits would stack');
if (untouched.reason !== 'already_inside') fail(`unexpected skip reason: ${untouched.reason}`);
behaviour.already_inside = { applied: false, reason: untouched.reason };

// 6-c. 4:5 원본(완성 이미지 회로) → 역시 안전 상자 안으로 들어가야 한다.
const instagramCard = await canvasWith(1122, 1402, [
  ...textBand(40, 40, 1040, 200),
  ...textBand(600, 60, 1000, 400),
  ...textBand(1290, 80, 960, 80),
]);
const fittedFourFive = await fitCanvasWithSafeZone(instagramCard, { width: 1080, height: 1920 });
if (!fittedFourFive.applied) fail('a 4:5 drop-folder card was published without a safe-zone refit');
if (!inside(fittedFourFive.card, box)) fail(`4:5 refit left the card outside the safe box: ${JSON.stringify(fittedFourFive.card)}`);
behaviour.four_by_five = { applied: true, scale: fittedFourFive.scale, card: fittedFourFive.card };

// 6-d. 명시적으로 끈 경우에만 통과시킨다.
const disabled = await fitCanvasWithSafeZone(bleeding, { width: 1080, height: 1920, mode: 'off' });
if (disabled.applied || disabled.reason !== 'disabled') fail('mode:off did not bypass the refit');
behaviour.disabled = { applied: false };

// 6-e. 강제 모드는 이미 안전한 카드도 줄인다.
const forced = await fitCanvasWithSafeZone(compliant, { width: 1080, height: 1920, mode: 'fit' });
if (!forced.applied || !inside(forced.card, box)) fail('mode:fit did not fit the frame into the safe box');
behaviour.forced = { applied: true, scale: forced.scale };

// ---------------------------------------------------------------------------
// 7. 로컬 n8n DB에 올라간 회로도 같은 계약을 들고 있는가
// ---------------------------------------------------------------------------
const dbPath = path.join(root, '.n8n', 'database.sqlite');
const live = [];
if (fs.existsSync(dbPath)) {
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
  const rows = await new Promise((resolve, reject) => {
    db.all('SELECT id, name, nodes FROM workflow_entity', (error, result) => (error ? reject(error) : resolve(result || [])));
  });
  await new Promise((resolve) => db.close(resolve));
  const generatingIds = new Set(generating.map((circuit) => circuit.id));
  for (const row of rows) {
    if (!generatingIds.has(row.id)) continue;
    const nodes = JSON.parse(row.nodes || '[]');
    const allCode = nodes.map((node) => node.parameters?.jsCode || '').join('\n');
    if (!allCode.includes(coordinateFragment)) fail(`${row.name}: live DB image prompt lost the safe-zone coordinates`);
    if (!allCode.includes(refitLine)) fail(`${row.name}: live DB image prompt lost the post-render refit notice`);
    live.push(row.name);
  }
  if (live.length !== generatingIds.size) {
    fail(`live DB is missing image-generating circuits: expected ${generatingIds.size}, checked ${live.length}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  safe_box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
  margins: SAFE_ZONE_MARGINS,
  circuits: circuits.length,
  image_generating_circuits: generating.length,
  live_db_circuits: live.length,
  behaviour,
}));
