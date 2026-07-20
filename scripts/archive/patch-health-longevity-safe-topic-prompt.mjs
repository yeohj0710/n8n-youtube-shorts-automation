import sqlite3 from 'sqlite3';

const dbPath = 'C:/dev/n8n-youtube-shorts-automation/.n8n/database.sqlite';
const workflowId = 'baekse100Life01';

function patchBuildPrompt(code) {
  if (!code.includes('Image-safety wording')) {
    code = code.replace(
      /const hookExamples = \[[\s\S]*?\]\.join\(', '\);\nconst cautiousPhrases = \[[\s\S]*?\]\.join\(', '\);/,
      `const hookExamples = [
  '아침마다 확인할 생활 신호 5',
  '오래 걷는 사람들이 지키는 작은 습관 7',
  '장볼 때 먼저 빼면 좋은 항목 7',
  '잠자기 전 줄이면 편한 습관 5',
  '나이 들수록 집에서 먼저 바꿀 것 7',
  '부모님 집 냉장고에서 확인할 것 7',
  '걷기 전 꼭 확인할 준비 5',
  '매일 식탁에서 놓치기 쉬운 순서 7',
  '돈 새는 생활습관 먼저 줄이기 7',
  '혼자 살아도 생활이 편한 사람들의 습관 7',
].join(', ');
const cautiousPhrases = ['도움 될 수 있습니다', '부담될 수 있습니다', '편해질 수 있습니다', '먼저 확인해보세요'].join(', ');`,
    );

    code = code.replace(
      /const referenceHookTitles = \[[\s\S]*?\];\nconst broadViralReferenceTitles = \[[\s\S]*?\];/,
      `const referenceHookTitles = [
  '오래 걷는 사람들이 아침마다 확인하는 습관 7',
  '장볼 때 먼저 빼면 좋은 항목 7',
  '잠자기 전 줄이면 편한 습관 5',
  '부모님 집 냉장고에서 확인할 것 7',
  '매일 식탁에서 놓치기 쉬운 순서 7',
  '나이 들수록 집에서 먼저 바꿀 것 7',
  '혼자 살아도 생활이 편한 사람들의 습관 7',
  '걷기 전 꼭 확인할 준비 5',
  '아침마다 물컵 옆에 두면 좋은 것 5',
  '장수보다 중요한 생활 체력 습관 7',
];
const broadViralReferenceTitles = [
  '대부분이 잘못 알고 있는 생활 상식 10가지',
  '모르면 평생 손해 보는 장보기 습관 7',
  '집 정리할 때 먼저 비우면 좋은 것 10가지',
  '전기요금 줄이는 생활 습관 7',
  '돈 없어도 대접받는 어른의 말습관 7',
  '주부 9단도 다시 확인하는 집밥 습관 7',
  '하루가 편해지는 아침 루틴 7',
  '저녁이 편해지는 정리 습관 7',
  '나이 들수록 품위가 보이는 생활 습관 7',
  '부모님께 공유하기 좋은 생활 체크 7',
];`,
    );

    const start = code.indexOf('const prompt = [');
    const endMarker = "].filter(Boolean).join('\\n\\n');";
    const end = code.indexOf(endMarker, start);
    if (start < 0 || end < 0) throw new Error('prompt block not found');

    const safePromptBlock = `const prompt = [
  'Create one Korean YouTube Shorts pack for 건강장수비결. Keep it as practical senior lifestyle information, not diagnosis, treatment, or expert advice.',
  'Target viewer: Korean adults age 60-75 and adult children who share videos with parents. The video should feel useful, calm, familiar, and easy to act on.',
  'Image-safety wording: card-visible text must use neutral everyday-life language. Prefer 생활습관, 장보기, 수면, 걷기, 식탁, 물, 신발, 냉장고, 집안 정리, 라벨, 아침 루틴, 저녁 루틴, 생활비, 부모님 집.',
  'Avoid card-visible wording about disease names, organ disease, medication, supplement dosage, prescription changes, doctors, professors, pharmacists, clinics, hospital costs, cure, treatment, guaranteed prevention, warning, worst, danger, miracle, blood, pain, death, dependency, or shocking fear hooks.',
  'If the topic is health-adjacent, translate it into a neutral daily habit check. Example: use 식후 부담 instead of disease wording, 건강제품 instead of supplement wording, 생활비 instead of hospital-cost wording, 생활 신호 instead of warning wording.',
  'This run must feel different from prior uploads. Use a fresh topic lane, fresh objects, fresh verbs, and fresh thumbnail mood.',
  'Selected content lane: ' + selectedLane.id + ' / ' + selectedLane.title + '. Angle: ' + selectedLane.angle + '.',
  cfg.topic_queue?.selected ? 'Priority queued topic/spec: ' + JSON.stringify(cfg.topic_queue.selected) + '. Use this unless it is unsafe or unusable. Do not substitute an unrelated topic.' : '',
  queuedSpecInstruction,
  'The visual format is one finished vertical infographic card. The list must show ' + rankLabel(1) + ' at the TOP, then ' + rankLabel(2) + ', ' + rankLabel(3) + ', down to the final selected rank.',
  'Prefer practical longevity-adjacent tension without fear: walking longer, cooking easier, sleeping better, shopping smarter, keeping the home easier to live in, saving 생활비, and reducing daily mistakes older adults overlook.',
  'Reference hook patterns from the benchmark channel, but keep the wording image-safe and lifestyle-neutral: ' + referenceHookTitles.concat(broadViralReferenceTitles).join(' / ') + '.',
  'Avoid starting hook_title with the fixed phrase 50대 이후 unless the age angle is truly essential. Use openers like 대부분이 잘못 알고 있는, 모르면 평생 손해, 아침마다, 장볼 때, 잠자기 전, 부모님 집, 나이 들수록, 혼자 살아도, 오래 걷는 사람들은, or another specific calm curiosity opener.',
  'Avoid repeating these recently overused examples unless absolutely necessary: ' + tiredExamples.join(', ') + '.',
  cfg.recent_titles?.length ? 'Also avoid these recent titles/topics: ' + cfg.recent_titles.join(' / ') + '.' : '',
  'Hook style: specific, curiosity-driven, useful, and calm. Examples: ' + hookExamples + '. No fake certainty or fearmongering.',
  'Reasons must be short enough for a dense infographic row: ideally 8-14 Korean characters. Keep all visible card text simple and image-safe.',
  'BGM direction should vary by run while staying calm and premium: acoustic, light jazz, Korean fusion, ambient piano, warm woodwind, or soft bossa are all allowed. No vocals, no EDM, no heavy drums.',
  'Return strict JSON only. No markdown.',
  'Rules:',
  '- No cure, guaranteed treatment, guaranteed disease prevention.',
  '- No medication/supplement dosage or prescription change.',
  '- No fake doctor, professor, pharmacist, clinic authority, miracle language, or fake professional identity. Keep this as practical senior-lifestyle information, not diagnosis or treatment.',
  '- Use soft phrasing when needed: ' + cautiousPhrases + '.',
  '- Do not add boilerplate safety/disclaimer copy in title, card text, description, script, or comment. No consult-professional or not-medical-advice wording.',
  '- pinned_comment must use this exact friendly channel tone: ' + ctaComment,
  rankCountInstruction,
  '- Use rank values ascending for display: ' + rankLabel(1) + ' first/top ... ' + lastRankInstruction,
  'Schema:',
  JSON.stringify(schema),
  'Candidates:',
  JSON.stringify(topic_candidates, null, 2),
]`;

    code = `${code.slice(0, start)}${safePromptBlock}${code.slice(end)}`;
  }

  return code;
}

function patchPayloadPrompt(code) {
  const extra = `    [/\uACE0\uD608\uC555/g, '\uD608\uAD00 \uC2B5\uAD00'],
    [/\uB2F9\uB1E8/g, '\uC2DD\uD6C4 \uAD00\uB9AC'],
    [/\uD608\uB2F9/g, '\uC2DD\uD6C4 \uBD80\uB2F4'],
    [/\uAC04\\s*\uC774\uC0C1/g, '\uCEE8\uB514\uC158 \uBCC0\uD654'],
    [/\uC9C8\uBCD1/g, '\uC0DD\uD65C \uBB38\uC81C'],
    [/\uACBD\uACE0/g, '\uC2E0\uD638'],
    [/\uCD5C\uC545/g, '\uB193\uCE58\uAE30 \uC26C\uC6B4'],
    [/\uC704\uD611/g, '\uBD80\uB2F4'],
    [/\uBB34\uC11C\uC6B4/g, '\uC2E0\uACBD \uC4F0\uC774\uB294'],
    [/\uC8FD\uC74C/g, '\uD070 \uBD80\uB2F4'],`;

  if (!code.includes("[/\uACE0\uD608\uC555/g, '\uD608\uAD00 \uC2B5\uAD00']")) {
    code = code.replace(
      "    [/\uBCD1\uC6D0\uBE44/g, '\uC0DD\uD65C\uBE44'],\n",
      `    [/\uBCD1\uC6D0\uBE44/g, '\uC0DD\uD65C\uBE44'],\n${extra}\n`,
    );
  }

  code = code
    .replace(
      "'Create one premium finished 9:16 Korean YouTube Shorts infographic poster. This is the final video frame, not a background for later text overlay.',",
      "'Create one premium finished 9:16 Korean YouTube Shorts lifestyle infographic poster. This is the final video frame, not a background for later text overlay.',",
    )
    .replace(
      "'GPT Image 2 must render the whole card end-to-end: title, subtitle, rank numbers, item names, short reasons, footer/brand, icons, background, and layout directly inside the image.',",
      "'Render the whole card end-to-end: title, subtitle, rank numbers, item names, short reasons, footer/brand, icons, background, and layout directly inside the image.',",
    )
    .replace(
      "'Use the exact visible Korean text below. Do not translate, summarize, replace, or omit it. Korean spelling may be imperfect if the model struggles, but still attempt crisp, large, readable Korean typography.',",
      "'Use the exact visible Korean text below. Do not translate, summarize, replace, or omit it. Keep crisp, large, readable Korean typography.',",
    )
    .replace(
      "'Keep it neutral: no empty stock-photo background, no transparent dark overlay panel, no real brand logos, no real product labels, no impersonation, no shocking imagery, no dramatic transformation comparison.',",
      "'Keep it neutral and calm: no empty stock-photo background, no transparent dark overlay panel, no real brand logos, no real product labels, no impersonation, no shocking imagery, no dramatic transformation comparison.',",
    );

  return code;
}

const db = new sqlite3.Database(dbPath);

db.get('SELECT nodes FROM workflow_entity WHERE id=?', [workflowId], (error, row) => {
  if (error) throw error;
  if (!row) throw new Error(`workflow not found: ${workflowId}`);

  const nodes = JSON.parse(row.nodes);
  const buildNode = nodes.find((entry) => entry.name === 'Build Viral Rank Pack Request');
  const payloadNode = nodes.find((entry) => entry.name === 'Prepare Image and BGM Payloads');
  if (!buildNode || !payloadNode) throw new Error('target nodes not found');

  const beforeBuild = buildNode.parameters.jsCode || '';
  const beforePayload = payloadNode.parameters.jsCode || '';
  buildNode.parameters.jsCode = patchBuildPrompt(beforeBuild);
  payloadNode.parameters.jsCode = patchPayloadPrompt(beforePayload);

  db.run(
    "UPDATE workflow_entity SET nodes=?, updatedAt=strftime('%Y-%m-%d %H:%M:%f','now'), versionCounter=versionCounter+1 WHERE id=?",
    [JSON.stringify(nodes), workflowId],
    function onUpdated(updateError) {
      if (updateError) throw updateError;
      console.log(JSON.stringify({
        updatedRows: this.changes,
        buildChanged: beforeBuild !== buildNode.parameters.jsCode,
        payloadChanged: beforePayload !== payloadNode.parameters.jsCode,
        nodes: nodes.length,
      }, null, 2));
      db.close();
    },
  );
});
