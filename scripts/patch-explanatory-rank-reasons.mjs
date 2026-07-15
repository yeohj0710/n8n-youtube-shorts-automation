import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sqlite3 from 'sqlite3';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const dbPath = path.join(root, '.n8n', 'database.sqlite');
const workflowIds = ['mxrYb3maJS31gEYC', 'baekse100Life01'];
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
const backupDir = path.join(root, '.n8n', `backup-before-explanatory-reasons-${stamp}`);

const reasonReplacements = new Map([
  ['입이 자주 마름|수분 습관 점검', '입이 자주 마름|물을 적게 마시거나 실내가 건조할 때 흔해요'],
  ['발이 무겁게 느낌|짠맛을 돌아봄', '발이 무겁게 느낌|오래 앉아 있거나 짠 음식을 먹은 뒤 더 느낄 수 있어요'],
  ['눈이 뻑뻑함|화면 시간을 확인', '눈이 뻑뻑함|화면을 오래 보면 눈 깜박임이 줄어 건조해지기 쉬워요'],
  ['어깨가 굳어 있음|잠자리 자세 점검', '어깨가 굳어 있음|같은 자세가 길면 목과 어깨 근육이 긴장하기 쉬워요'],
  ['속이 더부룩함|늦은 식사 확인', '속이 더부룩함|늦게 많이 먹으면 잠들 때까지 소화 부담이 남기 쉬워요'],
  ['머리가 무거움|수면 리듬 점검', '머리가 무거움|수면 시간과 기상 시간이 흔들리면 피로가 남기 쉬워요'],
  ['피로가 오래 감|휴식 질을 확인', '피로가 오래 감|잠든 시간뿐 아니라 깊게 쉬었는지도 함께 봐야 해요'],
  ['달걀|단백질 기본 점검', '달걀|한 알로 단백질과 여러 영양소를 함께 챙기기 쉬워요'],
  ['두부|속 편한 단백질', '두부|부드럽고 조리하기 쉬워 단백질 반찬으로 쓰기 편해요'],
  ['등푸른 생선|기름 선택 확인', '등푸른 생선|단백질과 불포화지방을 한 끼에 함께 챙길 수 있어요'],
  ['견과류|소량으로 충분', '견과류|적은 양에도 지방과 열량이 높아 한 줌이면 충분해요'],
  ['제철 채소|식탁 균형 잡기', '제철 채소|색이 다른 채소를 곁들이면 식단 구성이 다양해져요'],
  ['요거트|당 함량 먼저 확인', '요거트|제품마다 첨가당 차이가 커서 영양표시 확인이 필요해요'],
  ['물|기본 수분부터', '물|갈증을 배고픔으로 착각하기 전 수분부터 확인해요'],
  ['밥 먼저 먹기|탄수화물 먼저 몰림', '밥 먼저 먹기|빈속에 밥만 먼저 먹으면 탄수화물 섭취가 빨라져요'],
  ['채소 먼저 먹기|속도 조절 도움', '채소 먼저 먹기|채소를 먼저 먹으면 식사 속도를 늦추기 쉬워요'],
  ['단 음료 곁들이기|숨은 당이 더해짐', '단 음료 곁들이기|식사에 음료 당류까지 더해져 총 당 섭취가 늘어요'],
  ['국물 끝까지 마시기|짠맛이 늘어남', '국물 끝까지 마시기|국물까지 다 마시면 나트륨 섭취가 늘기 쉬워요'],
  ['단백질 빼먹기|금방 허기짐', '단백질 빼먹기|밥과 반찬 균형이 깨져 식후 허기가 빨리 올 수 있어요'],
  ['과일 후식 추가|당 부담 겹침', '과일 후식 추가|식사 직후 과일까지 더하면 탄수화물이 한 번에 겹쳐요'],
  ['천천히 씹기|포만감 신호 확인', '천천히 씹기|천천히 씹으면 포만감을 알아차릴 시간을 벌 수 있어요'],
  ['뜨거운 국 바로 넣기|주변 온도 올라감', '뜨거운 국 바로 넣기|뜨거운 음식은 냉장고 안 온도를 올려 다른 식품에도 영향 줘요'],
  ['젖은 채소 밀폐|쉽게 무를 수 있음', '젖은 채소 밀폐|물기가 남은 채 밀폐하면 채소가 무르고 상하기 쉬워요'],
  ['문쪽에 우유 두기|온도 변화가 잦음', '문쪽에 우유 두기|문 쪽은 여닫을 때 온도 변화가 커서 우유 보관에 불리해요'],
  ['도마 물기 방치|냄새가 남기 쉬움', '도마 물기 방치|젖은 도마를 겹쳐 두면 마르지 않아 냄새가 남기 쉬워요'],
  ['남은 밥 오래 두기|맛과 상태 저하', '남은 밥 오래 두기|밥을 실온에 오래 두면 맛이 떨어지고 미생물이 늘 수 있어요'],
  ['라벨 날짜 안 쓰기|보관일을 놓침', '라벨 날짜 안 쓰기|날짜를 안 적으면 넣은 때를 몰라 오래 방치하기 쉬워요'],
  ['반찬 뚜껑 느슨함|냄새가 섞임', '반찬 뚜껑 느슨함|뚜껑이 덜 닫히면 냄새가 섞이고 수분이 마르기 쉬워요'],
  ['낡은 신발 그대로|발목이 흔들림', '낡은 신발 그대로|닳은 밑창은 좌우 균형을 흐트러뜨려 발목이 불안정해요'],
  ['처음부터 빠르게|몸이 덜 풀림', '처음부터 빠르게|몸이 풀리기 전 속도를 내면 숨과 다리에 부담이 커져요'],
  ['보폭 크게 걷기|허리가 흔들림', '보폭 크게 걷기|보폭을 억지로 넓히면 착지 충격과 허리 흔들림이 커져요'],
  ['물 없이 오래 걷기|쉽게 지침', '물 없이 오래 걷기|수분 없이 오래 걸으면 갈증과 피로가 빨리 올 수 있어요'],
  ['계단만 고집하기|무릎 부담 증가', '계단만 고집하기|계단은 평지보다 무릎에 큰 힘이 반복해서 걸리기 쉬워요'],
  ['아픈 날 참고 걷기|불편감이 커짐', '아픈 날 참고 걷기|통증을 참고 계속 걸으면 불편이 더 커질 수 있어요'],
  ['걷고 바로 앉기|다리가 뻣뻣함', '걷고 바로 앉기|걷고 바로 멈추면 긴장한 다리 근육이 뻣뻣해질 수 있어요'],
]);

function requireNode(workflow, name) {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  if (!node) throw new Error(`${workflow.id}: missing node ${name}`);
  return node;
}

function replaceRequired(code, from, to, label) {
  if (code.includes(to)) return code;
  if (!code.includes(from)) throw new Error(`${label}: source text not found`);
  return code.replace(from, to);
}

function patchBuildCode(code, label) {
  code = code.replace(
    "{ rank: 1, name: '항목명', reason: '8-16자 안팎의 짧은 이유', caution: '주의 문구 또는 빈 문자열' },",
    "{ rank: 1, name: '항목명', reason: '18-32 Korean characters: one concrete cause-and-effect sentence', caution: '10-24 Korean characters: one practical action, or empty only when unnecessary' },",
  );

  const oldWithSafety = "  'Reasons must be short enough for a dense infographic row: ideally 8-14 Korean characters. Keep all visible card text simple and image-safe.',";
  const oldPlain = "  'Reasons must be short enough for a dense infographic row: ideally 8-14 Korean characters.',";
  const contract = [
    "  'Every reason must be 18-32 Korean characters and state a concrete cause and effect in one complete sentence.',",
    "  'Before returning JSON, fact-check every item against well-established everyday knowledge. If the mechanism is uncertain, remove that item instead of inventing an explanation.',",
    "  'Bad reasons: 밀폐 공간 압력 부담 / 단백질 기본 점검 / 소량으로 충분. Good reason: 고온에서 용기 내부 압력이 올라 파열될 수 있어요.',",
    "  'Use caution for one practical next action in 10-24 Korean characters when useful.',",
    "  'Do not invent percentages, scores, rankings, dosage, or precise numbers unless the exact input contains a reliable number.',",
  ].join('\n');
  if (!code.includes('Every reason must be 18-32 Korean characters')) {
    if (code.includes(oldWithSafety)) code = code.replace(oldWithSafety, contract);
    else if (code.includes(oldPlain)) code = code.replace(oldPlain, contract);
    else throw new Error(`${label}: old reason prompt not found`);
  }
  return code;
}

function patchFallbackCode(code) {
  for (const [from, to] of reasonReplacements) code = code.split(from).join(to);
  return code;
}

function patchParserCode(code, label) {
  return patchFallbackCode(code);
}

function patchReviewCode(code, label) {
  return code;
}

function patchMedicalRetryCode(code) {
  const marker = "  'Use neutral lifestyle-safe wording only. Prefer 생활습관, 몸 상태, 컨디션, 식탁, 수면, 걷기, 집안, 장보기, 생활비, 확인, 점검, 줄이면 좋은 습관.',";
  const addition = `${marker}
  'Rewrite every rank reason as one 18-32 Korean character cause-and-effect sentence. Replace vague fragments with a concrete mechanism and outcome. Remove any item whose mechanism is uncertain.',`;
  return code.includes('Rewrite every rank reason as one 18-32') ? code : replaceRequired(code, marker, addition, 'medical retry quality prompt');
}

function patchPrepareCode(code, label) {
  const oldCardRows = `const cardRows = sortedItems
  .map((item) => {
    const reason = String(item.reason || item.caution || '').replace(/\\s+/g, ' ').trim();
    return item.rank + rankSuffix + ' ' + item.name + (reason ? ' - ' + reason : '');
  })
  .join(LF);`;
  const newCardRows = `const cardRows = sortedItems
  .map((item) => {
    const reason = String(item.reason || item.caution || '').replace(/\\s+/g, ' ').trim();
    return [
      item.rank + rankSuffix + ' ' + item.name,
      reason ? '왜: ' + reason : '',
    ].filter(Boolean).join(LF);
  })
  .join(LF + LF);`;
  code = replaceRequired(code, oldCardRows, newCardRows, `${label}: visible card rows`);
  code = code.replace(/short reasons/g, 'clear cause-and-effect explanations');
  code = code.replace(/short reason/g, 'clear explanation');
  code = code.replace(/short Korean reason/g, 'clear Korean explanation');
  code = code.replace(
    ".replace(/경고|위험|최악/g, '체크')",
    ".replace(/경고/g, '신호')\n    .replace(/최악/g, '놓치기 쉬운')",
  );
  code = code.replace(
    'Modern wellness dashboard, compact metric chips, small gauges, teal, white, navy and coral palette, crisp app-like hierarchy, high information density.',
    'Modern wellbeing guide, calm teal, white, navy and coral palette, crisp hierarchy, clear item names and readable two-line explanations, no metrics or gauges.',
  );
  code = code.replace(
    'app-like wellness dashboard with compact metric chips and card rows',
    'app-like wellbeing guide with clear item names and two-line explanations',
  );
  const promptMarker = "  'Use this exact Korean text as copy blocks. Keep all Korean text large, crisp, and readable.',";
  const promptAddition = `${promptMarker}
  'For every rank, render the item name as the strong first line and the 왜: explanation below it in one or two readable lines. Preserve the full explanation without shortening or paraphrasing it.',
  'Do not invent or add percentages, progress bars, scores, gauges, ratings, or numeric badges unless that exact number appears in the provided Korean copy.',
  'Use calm text hierarchy and enough breathing room. Explanation clarity is more important than decorative UI density.',`;
  if (!code.includes('Do not invent or add percentages')) {
    code = replaceRequired(code, promptMarker, promptAddition, `${label}: image explanation prompt`);
  }
  code = code.replace(
    "  'NUMBERED TEXT ITEMS, keep ' + ('1' + rankSuffix) + ' first:',",
    "  'RANKED EXPLANATION BLOCKS, keep ' + ('1' + rankSuffix) + ' first:',",
  );
  code = code.replace(
    'pack: { ...pack, hook_title: title, subtitle, description: youtubeDescription, pinned_comment: buildPinnedComment() },',
    'pack: { ...pack, hook_title: title, subtitle, rank_items: sortedItems, description: youtubeDescription, pinned_comment: buildPinnedComment() },',
  );
  code = code.replace(
    'pack: { ...pack, description: youtubeDescription, pinned_comment: buildPinnedComment() },',
    'pack: { ...pack, rank_items: sortedItems, description: youtubeDescription, pinned_comment: buildPinnedComment() },',
  );
  return code;
}

function patchWorkflow(workflow) {
  const load = requireNode(workflow, 'Load Config');
  load.parameters.jsCode = load.parameters.jsCode.replace(
    /rank_count_max:\s*Number\(incoming\.rank_count_max\s*\|\|\s*\d+\)/,
    'rank_count_max: Number(incoming.rank_count_max || 5)',
  );

  const build = requireNode(workflow, 'Build Viral Rank Pack Request');
  build.parameters.jsCode = patchBuildCode(build.parameters.jsCode, workflow.id);

  const parse = requireNode(workflow, 'Parse KIE Claude Pack');
  parse.parameters.jsCode = patchParserCode(parse.parameters.jsCode, workflow.id);

  const mock = requireNode(workflow, 'Mock Viral Rank Pack');
  mock.parameters.jsCode = patchFallbackCode(mock.parameters.jsCode);

  const review = requireNode(workflow, 'Medical Safety Review');
  review.parameters.jsCode = patchReviewCode(review.parameters.jsCode, workflow.id);

  const retry = requireNode(workflow, 'Prepare Medical Retry Request');
  retry.parameters.jsCode = patchMedicalRetryCode(retry.parameters.jsCode);

  const prepare = requireNode(workflow, 'Prepare Image and BGM Payloads');
  prepare.parameters.jsCode = patchPrepareCode(prepare.parameters.jsCode, workflow.id);
  return workflow;
}

function findWorkflowFile(id) {
  const dir = path.join(root, 'workflows');
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const file = path.join(dir, name);
    const workflow = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (workflow.id === id) return file;
  }
  throw new Error(`Workflow file not found: ${id}`);
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function done(error) {
      if (error) reject(error);
      else resolve(this.changes);
    });
  });
}

fs.mkdirSync(backupDir, { recursive: true });
const db = new sqlite3.Database(dbPath);
const backupFile = path.join(backupDir, 'database.sqlite').replace(/'/g, "''").replace(/\\/g, '/');
await run(db, `VACUUM INTO '${backupFile}'`);

const fileResults = [];
for (const id of workflowIds) {
  const file = findWorkflowFile(id);
  const workflow = patchWorkflow(JSON.parse(fs.readFileSync(file, 'utf8')));
  workflow.versionId = randomUUID();
  fs.writeFileSync(file, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
  fileResults.push({ id, file });
}

await run(db, 'BEGIN IMMEDIATE');
const dbResults = [];
try {
  const rows = await all(
    db,
    `SELECT id, name, nodes FROM workflow_entity WHERE id IN (${workflowIds.map(() => '?').join(',')})`,
    workflowIds,
  );
  if (rows.length !== workflowIds.length) throw new Error(`Expected ${workflowIds.length} DB workflows, got ${rows.length}`);
  for (const row of rows) {
    const workflow = patchWorkflow({ id: row.id, name: row.name, nodes: JSON.parse(row.nodes) });
    const changes = await run(
      db,
      `UPDATE workflow_entity
       SET nodes=?, versionId=?, versionCounter=versionCounter+1,
           updatedAt=strftime('%Y-%m-%d %H:%M:%f','now')
       WHERE id=?`,
      [JSON.stringify(workflow.nodes), randomUUID(), row.id],
    );
    dbResults.push({ id: row.id, changes });
  }
  await run(db, 'COMMIT');
} catch (error) {
  try { await run(db, 'ROLLBACK'); } catch {}
  throw error;
} finally {
  await new Promise((resolve) => db.close(resolve));
}

console.log(JSON.stringify({ ok: true, backupDir, fileResults, dbResults }, null, 2));
