// 카드 색 변주가 본편 두 회로에 살아 있는지, 실제로 다른 값을 뽑는지 본다.
//
// 이 검사가 있는 이유. 회로는 원래도 색 계열을 매번 다르게 뽑고 있었다. 실행
// 기록 14건에서 visual_profile, palette_family, layout_family, badge_family 가
// 전부 달랐는데 발행 프레임 8장은 같은 아이보리 패널에 같은 주황 배지, 같은 흐린
// 나무 탁자 배경이었다. 그래서 "고른 값이 다른가"만 보면 아무 의미가 없다.
// 여기서는 세 가지를 본다.
//
// 1) 색과 배경 이름이 프롬프트 맨 뒤, 여백 지시 다음에 붙어 있는가
// 2) 패널 색과 강조색을 이름으로 지정하는가 (이름 없는 자리를 모델이 자기
//    기본값으로 채우는 게 원인이었다)
// 3) 직전에 쓴 색을 빼고 뽑는가
//
// 여기서도 확인할 수 없는 것이 있다. 모델이 지정한 색으로 그렸는지는 발행 프레임을
// 눈으로 봐야 안다. lib/safe-zone.mjs 주석의 교훈과 같다.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import {
  CARD_PALETTES,
  CARD_BACKDROPS,
  PALETTE_COOLDOWN,
  BACKDROP_COOLDOWN,
  VARIANT_CLOSING_LINE,
  placementDeferralLine,
} from './lib/card-colour-variation.mjs';

const root = path.resolve(import.meta.dirname, '..');
const dbPath = path.join(root, '.n8n', 'database.sqlite');
const circuits = [
  { id: 'mxrYb3maJS31gEYC', file: 'workflows/n8n_하루건강약사_수동실행.json' },
  { id: 'baekse100Life01', file: 'workflows/n8n_geongangjangsubigyeol_manual.json' },
];

// 1. 색 목록 자체.
assert.ok(CARD_PALETTES.length >= 8, `need at least 8 card palettes, found ${CARD_PALETTES.length}`);
assert.ok(CARD_BACKDROPS.length >= 6, `need at least 6 card backdrops, found ${CARD_BACKDROPS.length}`);
assert.equal(new Set(CARD_PALETTES.map((entry) => entry.id)).size, CARD_PALETTES.length, 'duplicate palette id');
assert.equal(new Set(CARD_BACKDROPS.map((entry) => entry.id)).size, CARD_BACKDROPS.length, 'duplicate backdrop id');
for (const entry of CARD_PALETTES) {
  assert.ok(entry.panel && entry.accent, `${entry.id}: a palette needs both a panel and an accent colour`);
  assert.notEqual(entry.panel, entry.accent, `${entry.id}: panel and accent must differ`);
}
for (const entry of CARD_BACKDROPS) {
  assert.ok(entry.scene, `${entry.id}: a backdrop needs a scene`);
}
// 냉각이 선택지를 전부 먹어 버리면 매번 같은 하나만 남는다.
assert.ok(PALETTE_COOLDOWN < CARD_PALETTES.length - 1, 'palette cooldown leaves too few choices');
assert.ok(BACKDROP_COOLDOWN < CARD_BACKDROPS.length - 1, 'backdrop cooldown leaves too few choices');

// 2. 두 회로의 JSON 과 라이브 DB 양쪽에 들어 있는지. JSON 만 고치면 돌아가는 건
//    DB 쪽이라 아무것도 바뀌지 않는다.
function assertPromptCarriesVariant(label, code) {
  assert.ok(code.includes('// card_colour_variant_v1_begin'), `${label}: colour variant block is missing`);
  assert.ok(code.includes('cardColourVariantInstruction'), `${label}: colour block is declared but never joined onto the prompt`);
  assert.match(
    code,
    /\.join\([^)]*\) \+ (LF|'\\n') \+ shortsMarginInstruction \+ (LF|'\\n') \+ cardColourVariantInstruction;/,
    `${label}: the colour block is not the last thing on the prompt`,
  );
  assert.ok(code.includes(placementDeferralLine()), `${label}: the colour block does not restate the placement rule`);
  assert.ok(code.includes(VARIANT_CLOSING_LINE), `${label}: the colour block lost its closing line`);
  // 패널과 강조색을 이름으로 지정해야 한다. 이름이 없으면 모델 기본값으로 돌아간다.
  assert.ok(code.includes('CARD_PANEL_COLOUR: the rounded panel is filled in '), `${label}: the panel colour is not named`);
  assert.ok(code.includes('cardPalette.accent'), `${label}: the accent colour is not named`);
  assert.ok(code.includes('cardBackdrop.scene'), `${label}: the backdrop is not named`);
  // 냉각 목록을 실제로 읽어야 한다.
  assert.ok(code.includes('cfg.recent_card_palettes'), `${label}: the palette pick ignores the cooldown list`);
  assert.ok(code.includes('cfg.recent_card_backdrops'), `${label}: the backdrop pick ignores the cooldown list`);
  // 사람이 한 편만 특정 색으로 뽑아 볼 수 있어야 한다.
  assert.ok(code.includes('cfg.card_palette_override'), `${label}: no manual palette override`);
  assert.ok(code.includes('cfg.card_backdrop_override'), `${label}: no manual backdrop override`);
  // 뽑은 값이 diversity 로 나가야 업로드 기록에 남는다.
  assert.ok(code.includes('card_palette: cardPalette,'), `${label}: the palette choice never reaches diversity`);
  assert.ok(code.includes('card_backdrop: cardBackdrop,'), `${label}: the backdrop choice never reaches diversity`);
  // 예전 문구가 남아 있으면 색 지시가 두 군데서 갈린다.
  assert.ok(
    !/'Keep one restrained color system, strong contrast/.test(code),
    `${label}: the old restrained-colour line still fights the colour block`,
  );
}

function assertConfigCarriesHistory(label, code) {
  assert.ok(code.includes('function loadRecentCardVariantHistory('), `${label}: no card variant history loader`);
  assert.ok(code.includes('config.recent_card_palettes ='), `${label}: recent palettes never reach the config`);
  assert.ok(code.includes('config.recent_card_backdrops ='), `${label}: recent backdrops never reach the config`);
  assert.ok(code.includes("'card_palette_id'"), `${label}: the loader does not read the logged palette id`);
  assert.ok(code.includes('card_palette_override:'), `${label}: no manual palette override in the config`);
}

function assertFinalResultLogs(label, code) {
  assert.ok(code.includes('card_palette_id: data.diversity?.card_palette?.id'), `${label}: the upload log drops the palette id`);
  assert.ok(code.includes('card_backdrop_id: data.diversity?.card_backdrop?.id'), `${label}: the upload log drops the backdrop id`);
}

function nodeCode(nodes, name, label) {
  const node = nodes.find((entry) => entry.name === name);
  assert.ok(node, `${label}: ${name} is missing`);
  return node.parameters?.jsCode || '';
}

function checkWorkflow(label, nodes) {
  assertPromptCarriesVariant(label, nodeCode(nodes, 'Prepare Image and BGM Payloads', label));
  assertConfigCarriesHistory(label, nodeCode(nodes, 'Load Config', label));
  assertFinalResultLogs(label, nodeCode(nodes, 'Final Result', label));
}

for (const circuit of circuits) {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, circuit.file), 'utf8'));
  checkWorkflow(`${path.basename(circuit.file)} (json)`, workflow.nodes || []);
}

// 3. 뽑기가 실제로 갈리는지. 노드 안 코드를 그대로 떼어 와 여러 씨앗으로 돌려 본다.
//    문구만 보고 통과시킨 전력이 있어서 값이 나오는지까지 확인한다.
function extractVariantBlock(code) {
  const begin = code.indexOf('// card_colour_variant_v1_begin');
  const end = code.indexOf('// card_colour_variant_v1_end');
  assert.ok(begin >= 0 && end > begin, 'could not cut the colour variant block out of the node');
  return code.slice(begin, end);
}

// 뽑기 함수는 다시 구현하지 않고 노드에서 떼어 온다. 베껴 쓰면 노드가 바뀔 때
// 검사만 옛 셈으로 통과한다.
function extractHelpers(code) {
  const begin = code.indexOf('function hashText(value) {');
  const end = code.indexOf('function sanitizeImageInstruction(');
  assert.ok(begin >= 0 && end > begin, 'could not cut hashText/pick/findById out of the node');
  const helpers = code.slice(begin, end);
  for (const name of ['function pick(items, salt)', 'function findById(items, value)']) {
    assert.ok(helpers.includes(name), `the node no longer defines ${name} next to hashText`);
  }
  return helpers;
}

function runVariantBlock(block, { seed, title, recentPalettes = [], recentBackdrops = [] }, helpers) {
  const harness = `
${helpers}
const LF = '\\n';
const visualProfile = { id: 'clinic_checklist' };
${block}
return { palette: cardPalette.id, backdrop: cardBackdrop.id, text: cardColourVariantInstruction };
`;
  // eslint-disable-next-line no-new-func
  const run = new Function('cfg', 'title', harness);
  return run(
    {
      variation_seed: seed,
      recent_card_palettes: recentPalettes,
      recent_card_backdrops: recentBackdrops,
      card_palette_override: '',
      card_backdrop_override: '',
    },
    title,
  );
}

const liveBlocks = await new Promise((resolve, reject) => {
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (error) => {
    if (error) reject(error);
  });
  db.all(
    `SELECT id, nodes FROM workflow_entity WHERE id IN (${circuits.map(() => '?').join(',')})`,
    circuits.map((circuit) => circuit.id),
    (error, rows) => {
      db.close();
      if (error) reject(error);
      else resolve(rows || []);
    },
  );
});
assert.equal(liveBlocks.length, circuits.length, 'the live DB is missing one of the 본편 circuits');
for (const row of liveBlocks) {
  checkWorkflow(`${row.id} (live db)`, JSON.parse(row.nodes));
}

const liveSample = nodeCode(JSON.parse(liveBlocks[0].nodes), 'Prepare Image and BGM Payloads', 'live sample');
const sample = extractVariantBlock(liveSample);
const helpers = extractHelpers(liveSample);

// 스무 편을 돌려 색이 갈리는지. 열두 색 중 절반도 안 나오면 사실상 고정이다.
const drawn = [];
for (let index = 0; index < 20; index += 1) {
  drawn.push(runVariantBlock(sample, { seed: `seed-${index}`, title: `제목 ${index} 4` }, helpers));
}
const palettesSeen = new Set(drawn.map((entry) => entry.palette));
const backdropsSeen = new Set(drawn.map((entry) => entry.backdrop));
assert.ok(palettesSeen.size >= 6, `20 draws only produced ${palettesSeen.size} palette(s)`);
assert.ok(backdropsSeen.size >= 4, `20 draws only produced ${backdropsSeen.size} backdrop(s)`);

// 냉각이 실제로 막는지. 직전 네 색을 넣고 백 번 돌려 하나라도 나오면 실패다.
const cooled = CARD_PALETTES.slice(0, PALETTE_COOLDOWN).map((entry) => entry.id);
const cooledBackdrops = CARD_BACKDROPS.slice(0, BACKDROP_COOLDOWN).map((entry) => entry.id);
for (let index = 0; index < 100; index += 1) {
  const result = runVariantBlock(sample, {
    seed: `cooldown-${index}`,
    title: `냉각 ${index} 4`,
    recentPalettes: cooled,
    recentBackdrops: cooledBackdrops,
  }, helpers);
  assert.ok(!cooled.includes(result.palette), `cooldown ignored: ${result.palette} came back`);
  assert.ok(!cooledBackdrops.includes(result.backdrop), `cooldown ignored: ${result.backdrop} came back`);
}

// 사람이 지정하면 그대로 나와야 한다.
const forced = runVariantBlock(sample, { seed: 'forced', title: '지정 4' }, helpers);
assert.ok(forced.text.includes('CARD_PANEL_COLOUR'), 'the instruction lost its panel line');
assert.ok(forced.text.includes('CARD_BACKDROP'), 'the instruction lost its backdrop line');

console.log(JSON.stringify({
  ok: true,
  palettes: CARD_PALETTES.length,
  backdrops: CARD_BACKDROPS.length,
  cooldown: { palette: PALETTE_COOLDOWN, backdrop: BACKDROP_COOLDOWN },
  circuits: circuits.length,
  draws_20: { palettes: palettesSeen.size, backdrops: backdropsSeen.size },
  note: '색 이름이 프롬프트 맨 뒤에 붙었는지까지만 확인함. 모델이 그 색으로 그렸는지는 발행 프레임을 봐야 함.',
}, null, 2));
