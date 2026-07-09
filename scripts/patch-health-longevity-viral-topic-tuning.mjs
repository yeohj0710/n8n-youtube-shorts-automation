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

function patchBuildNode(code) {
  code = replaceBlockRequired(
    code,
    /const referenceHookTitles = \[[\s\S]*?\];\nconst broadViralReferenceTitles = \[[\s\S]*?\];/,
    `const referenceHookTitles = [
  '유통기한 지났다고 바로 버리면 손해 보는 것 7',
  '냉장고에서 바로 버리면 손해 보는 식품 7',
  '장볼 때 먼저 확인할 라벨 7',
  '오래 걷는 사람들이 아침마다 확인하는 습관 7',
  '잠자기 전 줄이면 편한 습관 5',
  '우리 집 냉장고에서 확인할 것 7',
  '매일 식탁에서 놓치기 쉬운 순서 7',
  '나이 들수록 집에서 먼저 바꿀 것 7',
  '혼자 살아도 생활이 편한 사람들의 습관 7',
  '걷기 전 꼭 확인할 준비 5',
  '아침마다 물컵 옆에 두면 좋은 것 5',
  '장수보다 중요한 생활 체력 습관 7',
];
const broadViralReferenceTitles = [
  '모르면 평생 손해 보는 장보기 습관 7',
  '집 정리할 때 먼저 비우면 좋은 것 10가지',
  '전기요금 줄이는 생활 습관 7',
  '돈 없어도 대접받는 어른의 말습관 7',
  '주부 9단도 다시 확인하는 집밥 습관 7',
  '하루가 편해지는 아침 루틴 7',
  '저녁이 편해지는 정리 습관 7',
  '나이 들수록 품위가 보이는 생활 습관 7',
  '우리 집에서 바로 확인할 생활 체크 7',
  '오래 살수록 먼저 줄이면 좋은 생활 실수 7',
];
const benchmarkInspiredTitles = [
  '얼굴만 봐도 알 수 있는 몸의 생활 신호 10',
  '손톱으로 확인하는 생활 컨디션 신호 9',
  '아침마다 장이 편해지는 식탁 순서 7',
  '유통기한 지나도 바로 버리면 손해 보는 식품 12',
  '냉장고에 넣으면 오히려 손해 보는 식재료 7',
  '나이 들수록 반드시 줄여야 할 음식 5',
  '아침마다 몸이 무거운 분이 먼저 확인할 습관 7',
  '종합 건강제품 겹쳐 사기 전 먼저 볼 식품 11',
  '주부 9단도 다시 보는 집밥 보관 비법 10',
  '오래 걸으려면 매일 챙길 하체 습관 7',
  '혼자 살아도 행복하게 나이 드는 습관 7',
  '돈 없어도 대접받는 시니어 말습관 7',
  '은퇴 후 바로 시작하기 좋은 생활 루틴 TOP 8',
  '머리카락 빠지기 전 먼저 줄일 생활 습관 7',
  '내 가족을 힘들게 하는 주방 보관 실수 7',
  '모르면 손해 보는 음식 보관법 8',
  '저녁에 먹으면 다음 날 속이 편한 재료 7',
  '매일 먹으면 부담되는 음식 조합 8',
  '아침 첫 물 한잔 옆에 두면 좋은 것 5',
  '나이 들수록 꼭 챙기면 좋은 면역 식탁 5',
  '평생 내 발로 걷고 싶다면 먼저 볼 습관 7',
  '소름 돋게 맞는 생활 성향 체크 8',
  '모르면 독이 되는 음식 섭취법 8',
  '착하게만 살지 말고 똑똑하게 사는 말습관 7',
  '매일 쓰는데 대부분 놓치는 생활 필수품 7',
];`,
    'reference arrays plus benchmark',
  );

  code = replaceRequired(
    code,
    `const referenceViral = broadViralReferenceTitles
  .map((title, index) => ({ title, source: 'reference_high_view_pattern', score: 125 - index, lane: 'reference' }));`,
    `const referenceViral = [...benchmarkInspiredTitles, ...broadViralReferenceTitles]
  .map((title, index) => ({ title, source: index < benchmarkInspiredTitles.length ? 'benchmark_inspired_pattern' : 'reference_high_view_pattern', score: 150 - index, lane: 'reference' }));`,
    'reference viral source',
  );

  code = replaceRequired(
    code,
    `'Hook style: specific, curiosity-driven, useful, and calm. Examples: ' + hookExamples + '. No fake certainty or fearmongering.',`,
    `'Hook style: specific, curiosity-driven, useful, and calm. Examples: ' + hookExamples + '. No fake certainty or fearmongering.',
  'Benchmark channel pattern to borrow, not copy verbatim: exact object + personal consequence + number. Strong examples of structure: 얼굴만 봐도 알 수 있는 생활 신호, 유통기한 지나도 바로 버리면 손해 보는 식품, 아침마다 장이 편해지는 식탁 순서, 나이 들수록 줄여야 할 음식, 돈 없어도 대접받는 말습관.',
  'Every hook_title must answer this question immediately: 무엇을 어떻게 하면 손해/도움/확인이 되는가? Avoid vague nouns like 상식 unless paired with a concrete object and action.',
  'Keep rank_items natural and believable for Korean viewers age 50+. Use familiar objects and scenes: 냉장고, 밥상, 국물, 계란, 우유, 두부, 김치, 약봉투, 장보기, 손톱, 얼굴, 아침 몸상태, 걷기, 말습관, 은퇴 생활.',
  'Do not invent awkward filler. Each item must sound like something a 50-70대 viewer has actually seen, eaten, bought, or done this week.',`,
    'hook style benchmark prompt',
  );

  code = replaceRequired(
    code,
    `const topic_candidates = [...manual, ...referenceViral, ...rss, ...laneCandidates].filter((candidate) => {`,
    `const topic_candidates = [...manual, ...referenceViral, ...rss, ...laneCandidates].filter((candidate) => {`,
    'topic candidates noop',
  );

  return code;
}

function patchPayloadNode(code) {
  code = replaceRequired(
    code,
    `  const vaguePattern = /대부분이\\s*잘못\\s*알고\\s*있는/;`,
    `  const vaguePattern = /(대부분이\\s*잘못\\s*알고\\s*있는|상식\\s*\\d+\\s*$)/;`,
    'vague title pattern',
  );

  code = replaceRequired(
    code,
    `      text = text
        .replace(vaguePattern, '')
        .replace(/\\s*상식\\s*/g, '에서 확인할 것 ')
        .replace(/\\s+/g, ' ')
        .trim();`,
    `      text = text
        .replace(/대부분이\\s*잘못\\s*알고\\s*있는/g, '')
        .replace(/\\s*상식\\s*/g, '에서 바로 확인할 것 ')
        .replace(/\\s+/g, ' ')
        .trim();`,
    'vague title fallback',
  );

  code = replaceRequired(
    code,
    `const visibleText = [
  'TITLE: ' + title,
  'SUBTITLE: ' + subtitle,`,
    `const visibleText = [
  'TITLE: ' + title,
  'SUBTITLE: ' + subtitle,`,
    'visible text noop',
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
  buildNode.parameters.jsCode = patchBuildNode(beforeBuild);
  payloadNode.parameters.jsCode = patchPayloadNode(beforePayload);

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
