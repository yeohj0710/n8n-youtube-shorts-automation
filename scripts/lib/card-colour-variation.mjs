// 카드 색 변주. 본편 두 회로가 뽑는 카드가 매번 같은 아이보리 패널에 주황 등수
// 배지, 흐린 나무 탁자 배경으로 나오던 것을 고친다.
//
// 왜 따로 만드나. 회로는 이미 visual_profile, layout_family, palette_family,
// badge_family, motif_family 다섯 축을 매번 다르게 뽑고 있었다. 실행 기록 14건을
// 확인하니 다섯 축이 전부 달랐는데도 발행 프레임 8장의 색과 배경이 같았다. 즉
// 변주 값이 모자란 게 아니라 그 값이 프롬프트에서 힘을 못 쓰고 있었다. 이유는 셋이다.
//
// 1) 색 지시가 프롬프트 중간에 있고 "Styling reference ... ignore layout or widget
//    suggestions" 로 시작한다. 무시하라는 말과 붙어 있으면 같이 무시당한다.
// 2) 패널 색과 배지 색을 아무도 지정하지 않는다. 이름이 없는 자리는 모델이 자기
//    기본값으로 채우고, 그 기본값이 아이보리 패널에 주황 배지다.
// 3) 프롬프트 맨 끝 SHORTS_MARGIN_V1 이 위아래 빈 띠를 "plants, wood, cloth, light"
//    라고 못 박는다. 맨 끝 줄이 가장 세게 먹히므로 배경이 매번 나무 탁자로 수렴한다.
//
// 그래서 색과 배경을 이름으로 지정한 블록을 프롬프트 맨 뒤, 여백 지시 다음에 붙인다.
// 맨 뒤를 가져가는 대신 이 블록의 첫 문장이 배치 규칙을 다시 확인해 준다. 여백
// 준수는 이 저장소가 몇 주를 들여 잡은 것이라 색을 얻자고 내주지 않는다.
// verify-card-colour-variants.mjs 가 그 문장과 좌표를 검사한다.
//
// 몇 번을 적용해도 결과가 같다. 이전 주입분을 먼저 걷어낸다.

import { safeBoxFor } from './safe-zone.mjs';

const BEGIN = '// card_colour_variant_v1_begin';
const END = '// card_colour_variant_v1_end';

// 패널은 전부 밝게 둔다. 50대 이후 시청자가 보는 카드라 본문은 어두운 글자에 밝은
// 바탕이어야 하고, 패널만 어두워지면 글자 대비가 무너진다. 강조색은 배지와 제목
// 강조 단어에 같이 쓰이므로 썸네일 크기에서도 보이는 진한 색으로만 넣는다.
export const CARD_PALETTES = [
  { id: 'ivory_coral', title: '아이보리 산호', panel: 'warm ivory', accent: 'coral orange' },
  { id: 'mint_teal', title: '민트 청록', panel: 'pale mint', accent: 'deep teal' },
  { id: 'paper_cobalt', title: '종이 코발트', panel: 'paper white', accent: 'cobalt blue' },
  { id: 'blush_crimson', title: '블러시 진홍', panel: 'soft blush pink', accent: 'crimson red' },
  { id: 'sand_forest', title: '모래 짙은초록', panel: 'sand beige', accent: 'forest green' },
  { id: 'lilac_plum', title: '라일락 자두', panel: 'pale lilac', accent: 'plum purple' },
  { id: 'oat_brick', title: '오트 벽돌', panel: 'oat cream', accent: 'brick red' },
  { id: 'sky_navy', title: '하늘 남색', panel: 'pale sky blue', accent: 'deep navy' },
  { id: 'linen_olive', title: '리넨 올리브', panel: 'light linen grey', accent: 'olive green' },
  { id: 'butter_umber', title: '버터 고동', panel: 'butter cream', accent: 'warm umber brown' },
  { id: 'aqua_sienna', title: '옥색 테라코타', panel: 'pale aqua', accent: 'burnt sienna' },
  { id: 'greige_burgundy', title: '그레이지 버건디', panel: 'soft greige', accent: 'burgundy' },
];

// 배경은 주제를 타지 않는 것만 넣는다. 부엌이나 침실처럼 주제가 읽히는 장면을
// 넣으면 수면 카드에 도마가 깔리는 예전 사고가 그대로 돌아온다. 글자가 들어간
// 소품은 STRICT TEXT WHITELIST 가 이미 막고 있으므로 여기에도 두지 않는다.
export const CARD_BACKDROPS = [
  { id: 'wood_greens', title: '나무 탁자와 화분', scene: 'a wooden tabletop with a few green leaves' },
  { id: 'linen_cloth', title: '리넨 천', scene: 'folded linen cloth in a soft neutral tone' },
  { id: 'window_light', title: '창가 빛', scene: 'morning light falling through a plain curtain' },
  { id: 'paper_layers', title: '종이 결', scene: 'layered sheets of textured paper' },
  { id: 'knit_blanket', title: '니트 담요', scene: 'a softly folded knit blanket' },
  { id: 'stone_counter', title: '석재 상판', scene: 'a pale stone countertop' },
  { id: 'leaf_shadow', title: '잎 그림자 벽', scene: 'a plain wall with soft leaf shadows across it' },
];

// 직전 몇 편에 쓴 조합은 빼고 뽑는다. BGM 이 recent_bgm_profiles 로 하는 것과 같다.
// 색 12개 중 4개를 빼면 연달아 같은 색이 나오지 않으면서도 선택지가 남는다.
export const PALETTE_COOLDOWN = 4;
export const BACKDROP_COOLDOWN = 3;

// 배치는 이 블록이 건드리지 않는다는 것을 첫 문장에서 좌표로 다시 말해 준다.
// 좌표는 손으로 적지 않고 마진 표에서 받아 쓴다. 표가 바뀌면 이 문장도 따라간다.
export function placementDeferralLine(box = safeBoxFor(1080, 1920, '9:16')) {
  return `CARD_COLOUR_VARIANT_V1 sets colour and backdrop material only. Every placement rule above still stands exactly as written: the panel top edge at y ${box.top}, its bottom edge at y ${box.bottom}, all Korean copy between those two lines, and the open strips above and below the panel still free of letters. Nothing in this block moves anything.`;
}

// 색이 바뀌어도 이 문장은 그대로 있어야 한다. 검사가 이 문구를 찾는다.
export const VARIANT_CLOSING_LINE =
  'These three change from card to card on purpose. A card that comes out in the previous card’s colours has failed this instruction even when every other rule is satisfied.';

// 노드에 심을 소스. 회로 안에 이미 있는 pick 과 findById 를 그대로 쓴다.
function variantSource(joinerExpr) {
  const palettes = JSON.stringify(CARD_PALETTES);
  const backdrops = JSON.stringify(CARD_BACKDROPS);
  const lines = [
    JSON.stringify(placementDeferralLine()),
    "'CARD_PANEL_COLOUR: the rounded panel is filled in ' + cardPalette.panel + '. Keep the Korean copy dark on it so the contrast stays strong.'",
    "'CARD_ACCENT_COLOUR: ' + cardPalette.accent + ' is the only accent on this card. The rank badges, the highlighted words in the title, and any divider rule all take that one colour. Do not fall back to orange unless orange is the accent named here.'",
    "'CARD_BACKDROP: the open strip above the panel and the open strip below it show ' + cardBackdrop.scene + ', softly blurred, out of focus, and free of any text.'",
    JSON.stringify(VARIANT_CLOSING_LINE),
  ].map((line) => `  ${line},`).join('\n');

  return `${BEGIN}
const CARD_PALETTES = ${palettes};
const CARD_BACKDROPS = ${backdrops};
function pickCardVariant(items, salt, recent) {
  const blocked = new Set((Array.isArray(recent) ? recent : []).map((value) => String(value || '').trim().toLowerCase()).filter(Boolean));
  const open = items.filter((item) => !blocked.has(item.id));
  return pick(open.length ? open : items, salt);
}
const cardPalette =
  findById(CARD_PALETTES, cfg.card_palette_override) ||
  pickCardVariant(CARD_PALETTES, 'card_palette|' + visualProfile.id, cfg.recent_card_palettes);
const cardBackdrop =
  findById(CARD_BACKDROPS, cfg.card_backdrop_override) ||
  pickCardVariant(CARD_BACKDROPS, 'card_backdrop|' + cardPalette.id, cfg.recent_card_backdrops);
const cardColourVariantInstruction = [
${lines}
].join(${joinerExpr});
${END}
`;
}

function stripPrevious(code) {
  return code
    .replace(new RegExp(`${BEGIN}[\\s\\S]*?${END}\\n`, 'g'), '')
    .replace(/ \+ LF \+ cardColourVariantInstruction/g, '')
    .replace(/ \+ '\\n' \+ cardColourVariantInstruction/g, '')
    .replace(/^[ \t]*card_palette: cardPalette,\n[ \t]*card_backdrop: cardBackdrop,\n/m, '');
}

// `const imagePrompt = [...].join(...)` 의 종결 세미콜론을 찾는다. lib/frame-margin-policy
// 와 같은 방법이다. 배열 안 문자열의 괄호에 속지 않도록 첫 `.join(` 만 본다.
function findPromptTerminator(code) {
  const start = code.indexOf('const imagePrompt');
  if (start < 0) return null;
  const joinAt = code.indexOf('.join(', start);
  if (joinAt < 0) return null;
  const closeAt = code.indexOf(')', joinAt);
  const semicolon = code.indexOf(';', closeAt);
  if (closeAt < 0 || semicolon < 0) return null;
  return { start, semicolon, joiner: code.slice(joinAt + 6, closeAt).trim() };
}

export function applyCardColourVariation(node) {
  let code = stripPrevious(node.parameters.jsCode);
  if (!code.includes('function pick(items, salt)')) {
    throw new Error(`${node.name}: the seeded pick() helper is gone, so the colour variant cannot be drawn`);
  }
  if (!code.includes('function findById(items, value)')) {
    throw new Error(`${node.name}: findById() is gone, so a manual colour override cannot be resolved`);
  }
  if (!code.includes('shortsMarginInstruction')) {
    throw new Error(`${node.name}: the margin instruction is missing, so the colour block would land out of order`);
  }
  const term = findPromptTerminator(code);
  if (!term) throw new Error(`${node.name}: could not locate the imagePrompt terminator`);

  const joinerExpr = term.joiner === 'LF' ? 'LF' : "'\\n'";
  const suffix = joinerExpr === 'LF' ? ' + LF + cardColourVariantInstruction' : " + '\\n' + cardColourVariantInstruction";
  code = code.slice(0, term.semicolon) + suffix + code.slice(term.semicolon);
  code = code.slice(0, term.start) + variantSource(joinerExpr) + code.slice(term.start);

  // 무엇이 뽑혔는지 남긴다. 업로드 기록이 이 값을 읽어 다음 편에서 같은 색을 피한다.
  code = code.replace(
    /^([ \t]*)bgm_profile: bgmProfile,$/m,
    '$1card_palette: cardPalette,\n$1card_backdrop: cardBackdrop,\n$1bgm_profile: bgmProfile,',
  );
  if (!code.includes('card_palette: cardPalette,')) {
    throw new Error(`${node.name}: the diversity block no longer carries bgm_profile, so the colour choice has nowhere to go`);
  }

  node.parameters.jsCode = code;
}
