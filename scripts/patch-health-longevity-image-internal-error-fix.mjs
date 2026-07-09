import sqlite3 from 'sqlite3';

const dbPath = 'C:/dev/n8n-youtube-shorts-automation/.n8n/database.sqlite';
const workflowId = 'baekse100Life01';

function replaceRequired(code, search, replacement, label) {
  if (!code.includes(search)) throw new Error(`missing anchor: ${label}`);
  return code.replace(search, replacement);
}

function replaceBlockRequired(code, pattern, replacement, label) {
  if (!pattern.test(code)) throw new Error(`missing block: ${label}`);
  pattern.lastIndex = 0;
  return code.replace(pattern, replacement);
}

function patchBuild(code) {
  code = replaceBlockRequired(
    code,
    /const benchmarkInspiredTitles = \[[\s\S]*?\];/,
    `const benchmarkInspiredTitles = [
  '유통기한 지나도 바로 버리면 손해 보는 식품 12',
  '냉장고에 넣으면 오히려 손해 보는 식재료 7',
  '아침마다 속이 편해지는 식탁 순서 7',
  '나이 들수록 반드시 줄여야 할 음식 5',
  '주부 9단도 다시 보는 집밥 보관 비법 10',
  '오래 걸으려면 매일 챙길 하체 습관 7',
  '혼자 살아도 행복하게 나이 드는 습관 7',
  '돈 없어도 대접받는 시니어 말습관 7',
  '은퇴 후 바로 시작하기 좋은 생활 루틴 TOP 8',
  '내 가족을 힘들게 하는 주방 보관 실수 7',
  '모르면 손해 보는 음식 보관법 8',
  '저녁에 먹으면 다음 날 속이 편한 재료 7',
  '매일 먹으면 부담되는 음식 조합 8',
  '아침 첫 물 한잔 옆에 두면 좋은 것 5',
  '평생 내 발로 걷고 싶다면 먼저 볼 습관 7',
  '매일 쓰는데 대부분 놓치는 생활 필수품 7',
  '장보기 전에 먼저 빼면 좋은 냉장고 식품 7',
  '나이 들수록 집에서 먼저 바꾸면 편한 것 7',
  '아침 식탁에서 순서만 바꿔도 편한 습관 7',
  '잠자기 전 줄이면 아침이 편한 습관 7',
];`,
    'benchmarkInspiredTitles',
  );

  code = code.replace(
    `  { id: 'brain_memory_knowledge', title: '뇌·기억·상식 퀴즈', angle: '외래어, 뇌세포, 기억력, 대화가 통하는 상식처럼 댓글과 공유를 부르는 소재' },\n`,
    '',
  );

  const removeEvergreen = [
    `  { lane: 'brain_memory_knowledge', title: '뇌과학자가 추천하는 아침 뇌 깨우는 습관 7' },\n`,
    `  { lane: 'brain_memory_knowledge', title: '모르면 대화가 안 통하는 건강 외래어 7' },\n`,
    `  { lane: 'brain_memory_knowledge', title: '기억력이 흐려지는 사람이 놓치는 아침 신호 7' },\n`,
  ];
  for (const entry of removeEvergreen) code = code.replace(entry, '');

  code = replaceRequired(
    code,
    `  'Benchmark channel pattern to borrow, not copy verbatim: exact object + personal consequence + number. Strong examples of structure: 얼굴만 봐도 알 수 있는 생활 신호, 유통기한 지나도 바로 버리면 손해 보는 식품, 아침마다 장이 편해지는 식탁 순서, 나이 들수록 줄여야 할 음식, 돈 없어도 대접받는 말습관.',`,
    `  'Benchmark channel pattern to borrow, not copy verbatim: exact object + personal consequence + number. Strong examples of structure: 유통기한 지나도 바로 버리면 손해 보는 식품, 냉장고에 넣으면 손해 보는 재료, 아침마다 속이 편해지는 식탁 순서, 나이 들수록 줄여야 할 음식, 돈 없어도 대접받는 말습관.',`,
    'benchmark examples',
  );

  code = replaceRequired(
    code,
    `  'Keep rank_items natural and believable for Korean viewers age 50+. Use familiar objects and scenes: 냉장고, 밥상, 국물, 계란, 우유, 두부, 김치, 약봉투, 장보기, 손톱, 얼굴, 아침 몸상태, 걷기, 말습관, 은퇴 생활.',`,
    `  'Keep rank_items natural and believable for Korean viewers age 50+. Use familiar objects and scenes: 냉장고, 밥상, 국물, 계란, 우유, 두부, 김치, 장보기, 아침 식탁, 걷기, 말습관, 은퇴 생활, 집안 정리.',`,
    'familiar objects',
  );

  code = replaceRequired(
    code,
    `  'Do not invent awkward filler. Each item must sound like something a 50-70대 viewer has actually seen, eaten, bought, or done this week.',`,
    `  'Do not invent awkward filler. Each item must sound like something a 50-70대 viewer has actually seen, eaten, bought, or done this week.',
  'Avoid off-channel knowledge-quiz topics such as 외래어 뜻, 뇌과학자 추천, memory trivia, and child/parent framing. This channel should feel like direct practical 생활건강 and 장수 생활 information for the viewer.',`,
    'avoid off-channel topics',
  );

  return code;
}

function patchPayload(code) {
  code = replaceRequired(
    code,
    `    [/죽음/g, '큰 부담'],`,
    `    [/죽음/g, '큰 부담'],
    [/부모님/g, '시니어 여러분'],
    [/자녀와/g, '가족과'],
    [/자녀/g, '가족'],
    [/뇌과학자/g, '생활 전문가'],
    [/외래어/g, '생활 표현'],`,
    'safe public replacements',
  );

  code = replaceRequired(
    code,
    `  const vaguePattern = /(대부분이\\s*잘못\\s*알고\\s*있는|상식\\s*\\d+\\s*$)/;`,
    `  const vaguePattern = /^\\s*대부분이\\s*잘못\\s*알고\\s*있는/;`,
    'title vague pattern narrow',
  );

  code = replaceRequired(
    code,
    `    prompt: 'Myth-vs-fact inspired ranking card, split color tabs, soft red and blue contrast, warning dots, clear rank order, energetic but not sensational.',`,
    `    prompt: 'Fact-check inspired ranking card, split color tabs, soft red and blue contrast, simple check dots, clear rank order, energetic but calm.',`,
    'myth profile warning dots',
  );

  code = replaceRequired(
    code,
    `  'Create one premium finished 9:16 Korean YouTube Shorts lifestyle infographic poster. This is the final video frame, not a background for later text overlay.',
  'Render the whole card end-to-end: title, subtitle, rank numbers, item names, short reasons, footer/brand, icons, background, and layout directly inside the image.',
  'Use the exact visible Korean text below. Do not translate, summarize, replace, or omit it. Keep crisp, large, readable Korean typography.',
  visibleText,
  'Required order: ' + ('1' + rankSuffix) + ' at the top, then ' + ('2' + rankSuffix) + ', ' + ('3' + rankSuffix) + ', down to the last rank. Do not reverse the order.',
  'This run visual profile: ' + sanitizeImageInstruction(visualProfile.title) + '. ' + sanitizeImageInstruction(visualProfile.prompt),
  'Randomized art direction for this run: layout family = ' + sanitizeImageInstruction(layoutFamily) + '; palette = ' + sanitizeImageInstruction(paletteFamily) + '; rank badge style = ' + sanitizeImageInstruction(badgeFamily) + '; motif = ' + sanitizeImageInstruction(motifFamily) + '. Follow these choices strongly.',
  pack.visual_mood_hint ? 'Pack visual hint: ' + sanitizeImageInstruction(pack.visual_mood_hint) : '',
  'Make this output visibly different from prior default cards. Do not reuse the same beige/green watercolor look, dark navy/yellow template, same white stacked rounded rows, identical left rank badges, or generic repeated object icons.',
  'Design quality: high-end Korean lifestyle and practical information advertisement quality; crisp Korean typography; sharp vector-like edges; clean grid; premium editorial information card; polished not amateur.',
  'Layout: full canvas filled; strong top headline area; subtitle near title; ' + sortedItems.length + ' compact ranked rows; each row has a rank marker, varied small illustration or icon, item name, short reason; clear hierarchy; strong phone readability.',
  'Palette and composition must follow the randomized art direction. Use a different row shape, badge style, background motif, and accent color from previous outputs.',
  'Image quality: sharp 1080x1920 feel, no blur, no haze, no low-resolution text, no cropped text, no tiny text. Prioritize the Korean title and list readability.',
  'Keep it neutral and calm: no empty stock-photo background, no transparent dark overlay panel, no real brand logos, no real product labels, no impersonation, no shocking imagery, no dramatic transformation comparison.',
  'If space is tight, prioritize title and row readability over decoration.',`,
    `  'Create one finished vertical 9:16 Korean YouTube Shorts infographic card.',
  'Render the whole card directly in the image: Korean title, subtitle, ranked rows, small icons, footer brand, and background.',
  'Use this exact Korean text. Keep typography large, simple, crisp, and readable.',
  visibleText,
  'Rank order must be top to bottom: ' + ('1' + rankSuffix) + ', ' + ('2' + rankSuffix) + ', ' + ('3' + rankSuffix) + ', then the remaining ranks.',
  'Style: ' + sanitizeImageInstruction(visualProfile.prompt),
  'Layout: ' + sanitizeImageInstruction(layoutFamily) + '; palette: ' + sanitizeImageInstruction(paletteFamily) + '; rank badges: ' + sanitizeImageInstruction(badgeFamily) + '; motif: ' + sanitizeImageInstruction(motifFamily) + '.',
  pack.visual_mood_hint ? 'Visual hint: ' + sanitizeImageInstruction(pack.visual_mood_hint) : '',
  'Make it look like a polished Korean lifestyle information card for viewers age 50+. Use clean grid, strong hierarchy, sharp edges, and practical everyday objects.',
  'Avoid real brand logos, realistic product labels, impersonation, before-after comparisons, frightening medical imagery, dark overlays, tiny text, blur, or cropped text.',
  'If space is tight, keep fewer decorative details and prioritize title plus ranked row readability.',`,
    'simplify image prompt',
  );

  return code;
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve(this.changes);
    });
  });
}

const db = new sqlite3.Database(dbPath);
try {
  const row = await get(db, 'select nodes from workflow_entity where id=?', [workflowId]);
  if (!row) throw new Error(`workflow not found: ${workflowId}`);
  const nodes = JSON.parse(row.nodes);
  const buildNode = nodes.find((node) => node.name === 'Build Viral Rank Pack Request');
  const payloadNode = nodes.find((node) => node.name === 'Prepare Image and BGM Payloads');
  if (!buildNode || !payloadNode) throw new Error('target nodes not found');

  const beforeBuild = buildNode.parameters.jsCode;
  const beforePayload = payloadNode.parameters.jsCode;
  buildNode.parameters.jsCode = patchBuild(beforeBuild);
  payloadNode.parameters.jsCode = patchPayload(beforePayload);

  const changes = await run(
    db,
    "UPDATE workflow_entity SET nodes=?, updatedAt=strftime('%Y-%m-%d %H:%M:%f','now'), versionCounter=versionCounter+1 WHERE id=?",
    [JSON.stringify(nodes), workflowId],
  );

  console.log(JSON.stringify({
    ok: true,
    changes,
    nodes: nodes.length,
    changed: {
      build: beforeBuild !== buildNode.parameters.jsCode,
      payload: beforePayload !== payloadNode.parameters.jsCode,
    },
  }, null, 2));
} finally {
  db.close();
}
