import sqlite3 from 'sqlite3';

const dbPath = 'C:/dev/n8n-youtube-shorts-automation/.n8n/database.sqlite';
const workflowId = 'baekse100Life01';

function replaceRequired(code, search, replacement, label) {
  if (!code.includes(search)) {
    throw new Error(`missing patch anchor: ${label}`);
  }
  return code.replace(search, replacement);
}

function replaceBlockRequired(code, pattern, replacement, label) {
  if (!pattern.test(code)) {
    throw new Error(`missing patch block: ${label}`);
  }
  pattern.lastIndex = 0;
  return code.replace(pattern, replacement);
}

function patchBuild(code) {
  code = replaceBlockRequired(
    code,
    /const hookExamples = \[[\s\S]*?\]\.join\(', '\);/,
    `const hookExamples = [
  '유통기한 지났다고 바로 버리면 손해 보는 것 7',
  '냉장고에서 바로 버리면 손해 보는 식품 7',
  '장볼 때 먼저 확인할 라벨 7',
  '아침마다 몸이 보내는 생활 신호 5',
  '오래 걷는 사람들이 지키는 작은 습관 7',
  '잠자기 전 줄이면 편한 습관 5',
  '나이 들수록 우리 집에서 먼저 바꿀 것 7',
  '매일 식탁에서 놓치기 쉬운 순서 7',
  '돈 새는 생활습관 먼저 줄이기 7',
  '혼자 살아도 생활이 편한 사람들의 습관 7',
].join(', ');`,
    'hookExamples',
  );

  code = replaceRequired(
    code,
    `const ctaComment = '부모님께 해당되는 습관이 있다면 댓글로 남겨주세요. 건강장수비결이 쉽게 정리해드리겠습니다.';`,
    `const ctaComment = '오늘 항목 중 여러분께 해당되는 습관이 있다면 댓글로 남겨주세요. 건강장수비결이 쉽게 정리해드리겠습니다.';`,
    'ctaComment',
  );

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
];`,
    'reference hook arrays',
  );

  code = replaceRequired(
    code,
    `'Target viewer: Korean adults age 60-75 and adult children who share videos with parents. The video should feel useful, calm, familiar, and easy to act on.',`,
    `'Target viewer: Korean adults age 50-75 and older. Speak directly to them in respectful Korean as 여러분. Do not write as if the viewer is a child checking on parents.',`,
    'target viewer',
  );

  code = replaceRequired(
    code,
    `'Image-safety wording: card-visible text must use neutral everyday-life language. Prefer 생활습관, 장보기, 수면, 걷기, 식탁, 물, 신발, 냉장고, 집안 정리, 라벨, 아침 루틴, 저녁 루틴, 생활비, 부모님 집.',`,
    `'Image-safety wording: card-visible text must use neutral everyday-life language. Prefer 생활습관, 장보기, 수면, 걷기, 식탁, 물, 신발, 냉장고, 집안 정리, 라벨, 아침 루틴, 저녁 루틴, 생활비, 우리 집.',`,
    'image safety parent phrasing',
  );

  code = replaceRequired(
    code,
    `'Avoid starting hook_title with the fixed phrase 50대 이후 unless the age angle is truly essential. Use openers like 대부분이 잘못 알고 있는, 모르면 평생 손해, 아침마다, 장볼 때, 잠자기 전, 부모님 집, 나이 들수록, 혼자 살아도, 오래 걷는 사람들은, or another specific calm curiosity opener.',`,
    `'Do not start hook_title with vague phrases like 대부분이 잘못 알고 있는. The hook_title must name the exact mistaken action or payoff. Prefer concrete openers like 유통기한 지났다고 바로 버리면 손해 보는 것, 냉장고에서 바로 버리면 손해 보는 식품, 장볼 때 먼저 확인할 라벨, 아침마다 몸이 보내는 신호, 나이 들수록 집에서 먼저 바꿀 것, 오래 걷는 사람들이 지키는 습관.',`,
    'vague title rule',
  );

  code = code.replace(
    `{ lane: 'household_common_sense', title: '대부분이 잘못 알고 있는 냉장고 상식 7' },`,
    `{ lane: 'household_common_sense', title: '냉장고에서 바로 버리면 손해 보는 식품 7' },`,
  );

  code = replaceRequired(
    code,
    `'- pinned_comment must use this exact friendly channel tone: ' + ctaComment,`,
    `'- pinned_comment must use this exact friendly channel tone and speak directly to the viewer, never to their children: ' + ctaComment,`,
    'pinned comment prompt',
  );

  return code;
}

function patchPayload(code) {
  code = replaceRequired(
    code,
    `const ctaComment = '건강장수비결';`,
    `const ctaComment = '건강장수비결';
const directViewerComment = '오늘 항목 중 여러분께 해당되는 습관이 있다면 댓글로 남겨주세요. 건강장수비결이 쉽게 정리해드리겠습니다.';`,
    'directViewerComment',
  );

  code = replaceRequired(
    code,
    `const title = safePublicText(pack.hook_title || pack.theme || ('생활 랭킹 TOP ' + (sortedItems.length || cfg.rank_count || 5)));`,
    `function normalizeHookTitle(value) {
  let text = safePublicText(value);
  const count = sortedItems.length || Number(cfg.rank_count) || 5;
  const vaguePattern = /대부분이\\s*잘못\\s*알고\\s*있는/;
  if (vaguePattern.test(text)) {
    const fallback = [pack.subtitle, pack.theme]
      .map((entry) => safePublicText(entry))
      .find((entry) => entry && !vaguePattern.test(entry));
    if (fallback) {
      text = fallback;
      if (!/\\d+\\s*$/.test(text)) text += ' ' + count;
    } else {
      text = text
        .replace(vaguePattern, '')
        .replace(/\\s*상식\\s*/g, '에서 확인할 것 ')
        .replace(/\\s+/g, ' ')
        .trim();
      if (!text) text = '오늘 바로 확인할 생활 체크 ' + count;
    }
  }
  return text;
}

const title = normalizeHookTitle(pack.hook_title || pack.theme || ('생활 랭킹 TOP ' + (sortedItems.length || cfg.rank_count || 5)));`,
    'normalize title',
  );

  code = replaceRequired(
    code,
    `'부모님께 해당되는 습관이 있다면 댓글로 남겨주세요. 건강장수비결이 쉽게 정리해드리겠습니다.',`,
    `directViewerComment,`,
    'pinned direct comment',
  );

  code = replaceRequired(
    code,
    `'이 채널은 진단이나 처방이 아니라 부모님 세대가 바로 이해할 수 있는 생활건강 정보를 쉽게 정리합니다.',`,
    `'건강장수비결은 중장년과 시니어 여러분이 바로 이해하고 실천할 수 있는 생활건강 정보를 쉽게 정리합니다.',`,
    'description target',
  );

  code = replaceRequired(
    code,
    `'무릎, 허리, 혈당, 수면, 식사, 근력, 낙상 예방처럼 매일의 습관과 연결된 주제를 다룹니다.',`,
    `'걷기, 수면, 식사, 장보기, 집안 습관, 생활비처럼 매일의 생활과 연결된 주제를 다룹니다.',`,
    'description topics',
  );

  code = replaceRequired(
    code,
    `const packBgmHint = limitPrompt(pack.bgm_prompt, 150);
const bgmPrompt = limitPrompt([
  bgmProfile.prompt,
  packBgmHint ? 'Topic hint: ' + packBgmHint : '',
  pack.content_lane ? 'Content lane: ' + pack.content_lane + '.' : '',
].filter(Boolean).join(' '), 480);`,
    `const bgmStructureInstruction = 'Create a complete 12-18 second background music bed, not a two-note sound effect or notification stinger. Use a clear 4-bar chord progression, gentle repeating melody, soft rhythm, smooth intro and outro, enough motion to feel like real BGM under a Shorts video.';
const packBgmHint = limitPrompt(pack.bgm_prompt, 150);
const bgmPrompt = limitPrompt([
  bgmProfile.prompt,
  bgmStructureInstruction,
  packBgmHint ? 'Topic hint: ' + packBgmHint : '',
  pack.content_lane ? 'Content lane: ' + pack.content_lane + '.' : '',
].filter(Boolean).join(' '), 700);`,
    'bgm structure instruction',
  );

  return code;
}

const parseBgmResultCode = `const base = $('Normalize BGM Task').first().json;
const response = $input.first().json || {};
const data = response.data || response;
const status = String(data.status || data.state || '').toUpperCase();
const sunoData =
  data.response?.sunoData ||
  data.sunoData ||
  data.response?.data ||
  data.data ||
  [];

function asList(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  return [];
}

function audioUrlFor(item) {
  return item?.audioUrl ||
    item?.streamAudioUrl ||
    item?.sourceAudioUrl ||
    item?.sourceStreamAudioUrl ||
    item?.audio_url ||
    item?.stream_audio_url ||
    item?.url ||
    null;
}

function durationFor(item) {
  const duration = Number(item?.duration || item?.audioDuration || item?.durationSeconds || item?.metadata?.duration || 0);
  return Number.isFinite(duration) ? duration : 0;
}

const candidates = asList(sunoData).filter((item) => audioUrlFor(item));
const best = [...candidates].sort((left, right) => durationFor(right) - durationFor(left))[0] || null;
const fallbackUrl =
  data.response?.audioUrl ||
  data.response?.streamAudioUrl ||
  data.audioUrl ||
  data.streamAudioUrl ||
  null;
const bgmUrl = best ? audioUrlFor(best) : fallbackUrl;
const failed = ['CREATE_TASK_FAILED', 'GENERATE_AUDIO_FAILED', 'CALLBACK_EXCEPTION', 'SENSITIVE_WORD_ERROR', 'FAIL', 'FAILED', 'ERROR'].includes(status);
if (failed) {
  throw new Error('KIE BGM failed. state=' + status + ', taskId=' + (base.bgm_task_id || '-') + ', message=' + (data.failMsg || data.message || response.msg || response.error || ''));
}
return [{ json: { ...base, bgm_poll_response: response, bgm_state: status, bgm_failed: false, bgm_audio_url: bgmUrl, bgm_audio_duration: best ? durationFor(best) : null, bgm_audio_choice: best } }];`;

const parseBgmFinalCode = `const previous = $('Parse BGM Result').first().json;
const response = $input.first().json || {};
const data = response.data || response;
const status = String(data.status || data.state || '').toUpperCase();
const sunoData =
  data.response?.sunoData ||
  data.sunoData ||
  data.response?.data ||
  data.data ||
  [];

function asList(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  return [];
}

function audioUrlFor(item) {
  return item?.audioUrl ||
    item?.streamAudioUrl ||
    item?.sourceAudioUrl ||
    item?.sourceStreamAudioUrl ||
    item?.audio_url ||
    item?.stream_audio_url ||
    item?.url ||
    null;
}

function durationFor(item) {
  const duration = Number(item?.duration || item?.audioDuration || item?.durationSeconds || item?.metadata?.duration || 0);
  return Number.isFinite(duration) ? duration : 0;
}

const candidates = asList(sunoData).filter((item) => audioUrlFor(item));
const best = [...candidates].sort((left, right) => durationFor(right) - durationFor(left))[0] || null;
const fallbackUrl =
  data.response?.audioUrl ||
  data.response?.streamAudioUrl ||
  data.audioUrl ||
  data.streamAudioUrl ||
  null;
const bgmUrl = best ? audioUrlFor(best) : fallbackUrl;
const failed = ['CREATE_TASK_FAILED', 'GENERATE_AUDIO_FAILED', 'CALLBACK_EXCEPTION', 'SENSITIVE_WORD_ERROR', 'FAIL', 'FAILED', 'ERROR'].includes(status);
if (failed) {
  throw new Error('KIE BGM failed after retry. state=' + status + ', taskId=' + (previous.bgm_task_id || '-') + ', message=' + (data.failMsg || data.message || response.msg || response.error || ''));
}
if (!bgmUrl) {
  throw new Error('KIE BGM still not ready after retry. state=' + (status || '-') + ', taskId=' + (previous.bgm_task_id || '-') + '. Run workflow again or increase bgm_retry_wait_seconds.');
}
return [{ json: { ...previous, bgm_poll_response: response, bgm_state: status, bgm_failed: false, bgm_audio_url: bgmUrl, bgm_audio_duration: best ? durationFor(best) : null, bgm_audio_choice: best, bgm_retry_attempted: true } }];`;

function openDb() {
  return new sqlite3.Database(dbPath);
}

function getWorkflow(db) {
  return new Promise((resolve, reject) => {
    db.get('SELECT nodes FROM workflow_entity WHERE id=?', [workflowId], (error, row) => {
      if (error) reject(error);
      else if (!row) reject(new Error(`workflow not found: ${workflowId}`));
      else resolve(row);
    });
  });
}

function updateWorkflow(db, nodes) {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE workflow_entity SET nodes=?, updatedAt=strftime('%Y-%m-%d %H:%M:%f','now'), versionCounter=versionCounter+1 WHERE id=?",
      [JSON.stringify(nodes), workflowId],
      function onRun(error) {
        if (error) reject(error);
        else resolve(this.changes);
      },
    );
  });
}

const db = openDb();
try {
  const row = await getWorkflow(db);
  const nodes = JSON.parse(row.nodes);
  const byName = (name) => nodes.find((node) => node.name === name);

  const buildNode = byName('Build Viral Rank Pack Request');
  const payloadNode = byName('Prepare Image and BGM Payloads');
  const parseBgmNode = byName('Parse BGM Result');
  const parseBgmFinalNode = byName('Parse BGM Result Final');
  if (!buildNode || !payloadNode || !parseBgmNode || !parseBgmFinalNode) {
    throw new Error('target nodes not found');
  }

  const before = {
    build: buildNode.parameters.jsCode,
    payload: payloadNode.parameters.jsCode,
    parseBgm: parseBgmNode.parameters.jsCode,
    parseBgmFinal: parseBgmFinalNode.parameters.jsCode,
  };

  buildNode.parameters.jsCode = patchBuild(before.build);
  payloadNode.parameters.jsCode = patchPayload(before.payload);
  parseBgmNode.parameters.jsCode = parseBgmResultCode;
  parseBgmFinalNode.parameters.jsCode = parseBgmFinalCode;

  const changes = await updateWorkflow(db, nodes);
  console.log(JSON.stringify({
    ok: true,
    changes,
    nodes: nodes.length,
    changed: {
      build: before.build !== buildNode.parameters.jsCode,
      payload: before.payload !== payloadNode.parameters.jsCode,
      parseBgm: before.parseBgm !== parseBgmNode.parameters.jsCode,
      parseBgmFinal: before.parseBgmFinal !== parseBgmFinalNode.parameters.jsCode,
    },
  }, null, 2));
} finally {
  db.close();
}
