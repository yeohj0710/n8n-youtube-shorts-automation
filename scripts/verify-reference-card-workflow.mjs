// 레퍼런스 카드 회로 검증. 실제 데이터셋과 복제 노드를 그대로 돌려 계약을 확인한다.
// 이 회로는 KIE 비용과 공개 업로드를 쓰므로, 배포 전에 이 검증이 통과해야 한다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { safeBoxFor } from './lib/safe-zone.mjs';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const workflowPath = path.join(root, 'workflows', 'n8n_reference_card_haru_manual.json');
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const byName = (name) => {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  assert.ok(node, `missing node: ${name}`);
  return node;
};
const HANDLE = '@haruyaksa';
// 이 회로는 건강과 관계·인생 주제를 섞어 고른다. 카드 이미지의 푸터는 메인 회로가
// 채널 프로필만 보고 찍기 때문에 주제별로 가를 수 없어서, 카드·설명·고정 댓글이
// 전부 같은 한 줄을 쓴다.
const CLOSING = '약사가 알려주는 건강 정보와 삶의 지혜, 팔로우하면 매일 무료로 챙겨드려요. @haruyaksa.';
const MAIN_CLOSING_LEAD = '몸에 도움 되는 정보를 매일 하나씩 전해 드려요';
const SPREADSHEET_ID = '1K6gT9TY_WHuxB3SHEx5VyJK2JunQWJRdkdV4ecNu_fc';
const SHEET_ID = 159350994;
const SHEET_NAME = '통과 영상';
const SHEETS_CREDENTIAL_ID = 'haruSheetsOAuth1';
const UPLOAD_COMPLETE_COLUMN = '업로드 완료';

assert.equal(workflow.id, 'haruReferenceCardShorts01');
assert.equal(workflow.name, '하루건강약사 · 레퍼런스 카드');
assert.equal(workflow.active, false, 'workflow must import inactive');

// 노드 id 중복은 임포트 때 다른 워크플로우를 덮어쓸 수 있다.
const ids = workflow.nodes.map((node) => node.id);
assert.equal(new Set(ids).size, ids.length, 'duplicate node id');

// 도달 가능성. 고아 노드가 있으면 배선이 잘못된 것이다.
const reached = new Set();
const queue = ['Manual Trigger'];
while (queue.length) {
  const name = queue.shift();
  if (reached.has(name)) continue;
  reached.add(name);
  for (const edge of (workflow.connections[name]?.main || []).flat()) queue.push(edge.node);
}
for (const node of workflow.nodes) {
  if (node.type === 'n8n-nodes-base.stickyNote') continue;
  assert.ok(reached.has(node.name), `${node.name}: unreachable from Manual Trigger`);
}

// 업로드 계약. 이 회로도 공개 업로드이며 고정 댓글은 pack.pinned_comment를 그대로 쓴다.
// 업로드 공개 여부는 표현식으로 config에서 읽는다. 기본값이 public이어야 한다.
const upload = byName('YouTube Upload Public');
const privacy = String(upload.parameters?.options?.privacyStatus ?? upload.parameters?.privacyStatus ?? '');
assert.match(privacy, /youtube_privacy_status|public/, 'upload node lost its privacy setting');
assert.match(byName('Post Top-Level Comment').parameters.jsonBody, /pack\.pinned_comment/);
assert.deepEqual(
  (workflow.connections['Manual Trigger']?.main?.[0] || []).map((e) => e.node),
  ['Read Reference Sheet'],
  'sheet pull must run before local selection',
);
assert.deepEqual(
  (workflow.connections['Read Reference Sheet']?.main?.[0] || []).map((e) => e.node),
  ['Merge Sheet Into Dataset'],
  'sheet rows must be merged into videos.jsonl',
);
assert.deepEqual(
  (workflow.connections['Merge Sheet Into Dataset']?.main?.[0] || []).map((e) => e.node),
  ['Apply Sheet Checklist Sync'],
  'used-log reconciliation must follow the sheet merge',
);
assert.deepEqual(
  (workflow.connections['Apply Sheet Checklist Sync']?.main?.[0] || []).map((e) => e.node),
  ['Load Config'],
  'media generation must wait for sheet synchronization',
);
assert.deepEqual(
  (workflow.connections['Normalize YouTube Upload']?.main?.[0] || []).map((e) => e.node),
  ['Prepare Instagram Package'],
  'a successful YouTube upload must prepare Instagram before posting a comment',
);
assert.deepEqual(
  (workflow.connections['Prepare Instagram Package']?.main?.[0] || []).map((e) => e.node),
  ['Post Comment?'],
  'Instagram staging must decide whether a new comment is needed',
);
assert.deepEqual(
  (workflow.connections['Post Comment?']?.main?.[0] || []).map((e) => e.node),
  ['Post Top-Level Comment'],
  'a new upload must continue to the comment API',
);
assert.deepEqual(
  (workflow.connections['Post Comment?']?.main?.[1] || []).map((e) => e.node),
  ['Complete Reference Card'],
  'an already-uploaded recovery must skip duplicate comments',
);
assert.deepEqual(
  (workflow.connections['Attach Comment Result']?.main?.[0] || []).map((e) => e.node),
  ['Complete Reference Card'],
  'comment handling must continue to the durable checklist write',
);
const instagramStage = byName('Prepare Instagram Package');
assert.match(instagramStage.parameters.jsCode, /stage-instagram-package\.mjs/);
assert.match(instagramStage.parameters.jsCode, /n8n_reference_card_direct_render/);
assert.match(instagramStage.parameters.jsCode, /failed_after_youtube_upload/);
assert.match(instagramStage.parameters.jsCode, /existing_url/);
assert.doesNotMatch(instagramStage.parameters.jsCode, /\bprocess\./, 'Task Runner code must not use the process global');
assert.deepEqual(
  (workflow.connections['Skip YouTube Upload']?.main?.[0] || []).map((e) => e.node),
  ['Prepare Instagram Package'],
  'already-uploaded runs must get an Instagram recovery attempt',
);
assert.deepEqual(
  (workflow.connections['Mock Render Result']?.main?.[0] || []).map((e) => e.node),
  ['Complete Reference Card'],
  'mock renders must reach the checklist without Instagram staging',
);
assert.equal(byName('Post Top-Level Comment').onError, 'continueRegularOutput');
assert.match(byName('Attach Comment Result').parameters.jsCode, /\$\('Prepare Instagram Package'\)/);
assert.match(byName('Complete Reference Card').parameters.jsCode, /instagram_stage/);
assert.match(byName('Complete Reference Card').parameters.jsCode, /already_uploaded/);
assert.deepEqual(
  (workflow.connections['Complete Reference Card']?.main?.[0] || []).map((e) => e.node),
  ['Mark Upload Complete In Sheet'],
  'local checklist completion must immediately update the sheet checkbox',
);
assert.deepEqual(
  (workflow.connections['Medical Review Passed?']?.main?.[1] || []).map((e) => e.node),
  ['Blocked Reference Card'],
  'a blocked card must not fall through to image generation',
);

const readSheet = byName('Read Reference Sheet');
assert.equal(readSheet.type, 'n8n-nodes-base.googleSheets');
assert.equal(readSheet.parameters.documentId?.value, SPREADSHEET_ID);
assert.equal(readSheet.parameters.sheetName?.value, SHEET_NAME);
assert.equal(readSheet.parameters.options?.dataLocationOnSheet?.values?.range, 'A1:AU2001');
assert.equal(readSheet.credentials?.googleSheetsOAuth2Api?.id, SHEETS_CREDENTIAL_ID);

const mergeSheet = byName('Merge Sheet Into Dataset');
assert.doesNotMatch(mergeSheet.parameters.jsCode, /\bprocess\./, 'Task Runner code must not use the process global');

const applyChecklist = byName('Apply Sheet Checklist Sync');
assert.equal(applyChecklist.parameters.nodeCredentialType, 'googleSheetsOAuth2Api');
assert.match(applyChecklist.parameters.url, new RegExp(SPREADSHEET_ID));
assert.equal(applyChecklist.credentials?.googleSheetsOAuth2Api?.id, SHEETS_CREDENTIAL_ID);

const markComplete = byName('Mark Upload Complete In Sheet');
assert.equal(markComplete.type, 'n8n-nodes-base.googleSheets');
assert.deepEqual(markComplete.parameters.columns?.matchingColumns, ['record_id']);
assert.equal(markComplete.parameters.columns?.value?.[UPLOAD_COMPLETE_COLUMN], true, 'checkbox must be Boolean true');
assert.equal(markComplete.parameters.columns?.value?.record_id, '={{ $json.reference_result.record_id }}');
assert.equal(markComplete.parameters.options?.cellFormat, 'RAW');
assert.equal(markComplete.credentials?.googleSheetsOAuth2Api?.id, SHEETS_CREDENTIAL_ID);

// 복제 노드가 메인 워크플로우와 같은지. 갈리면 그림·음악이 기존 쇼츠와 달라진다.
const mainFile = fs.readdirSync(path.join(root, 'workflows'))
  .filter((name) => name.endsWith('.json'))
  .map((name) => JSON.parse(fs.readFileSync(path.join(root, 'workflows', name), 'utf8')))
  .find((candidate) => candidate.id === 'mxrYb3maJS31gEYC');
assert.ok(mainFile, 'main workflow mxrYb3maJS31gEYC not found');
for (const name of ['Prepare Image and BGM Payloads', 'Load Config', 'Medical Safety Review', 'Prepare Local FFmpeg Render']) {
  const mine = byName(name).parameters;
  const theirs = mainFile.nodes.find((n) => n.name === name).parameters;
  assert.deepEqual(mine, theirs, `${name}: drifted from the main workflow — reclone instead of editing`);
}

// 런타임. 임시 작업 폴더로 갈아끼워 실제 기록을 건드리지 않는다.
const etcRoot = path.join(root, 'etc');
fs.mkdirSync(etcRoot, { recursive: true });
const tmpWork = fs.mkdtempSync(path.join(etcRoot, 'reference-card-verify-'));
const tmpDataset = path.join(tmpWork, 'videos.jsonl');
const tmpDatasetBackup = path.join(tmpWork, 'videos.before-sheet-sync.jsonl');
const tmpState = path.join(tmpWork, 'state.json');
const tmpSyncConfig = path.join(tmpWork, 'google_sheet_sync_config.json');
fs.copyFileSync(path.join(root, 'research', 'single-screen-references', 'videos.jsonl'), tmpDataset);
fs.copyFileSync(path.join(root, 'research', 'single-screen-references', 'state.json'), tmpState);
fs.copyFileSync(
  path.join(root, 'research', 'single-screen-references', 'etc', 'google_sheet_sync_config.json'),
  tmpSyncConfig,
);
function runNode(name, json) {
  let code = byName(name).parameters.jsCode;
  code = code.replace(/^const referenceDefinition = (.*);$/m, (match, body) => {
    const parsed = JSON.parse(body);
    parsed.workRoot = tmpWork.replace(/\\/g, '/');
    parsed.datasetPath = tmpDataset.replace(/\\/g, '/');
    parsed.datasetBackupPath = tmpDatasetBackup.replace(/\\/g, '/');
    parsed.datasetStatePath = tmpState.replace(/\\/g, '/');
    parsed.sheetSyncConfigPath = tmpSyncConfig.replace(/\\/g, '/');
    return `const referenceDefinition = ${JSON.stringify(parsed)};`;
  });
  return new Function('require', '$input', '$', code)(
    require,
    { first: () => ({ json }), all: () => [{ json }] },
    () => { throw new Error(`${name}: unexpected cross-node lookup`); },
  );
}
function runNodeMany(name, rows) {
  let code = byName(name).parameters.jsCode;
  code = code.replace(/^const referenceDefinition = (.*);$/m, (match, body) => {
    const parsed = JSON.parse(body);
    parsed.workRoot = tmpWork.replace(/\\/g, '/');
    parsed.datasetPath = tmpDataset.replace(/\\/g, '/');
    parsed.datasetBackupPath = tmpDatasetBackup.replace(/\\/g, '/');
    parsed.datasetStatePath = tmpState.replace(/\\/g, '/');
    parsed.sheetSyncConfigPath = tmpSyncConfig.replace(/\\/g, '/');
    return `const referenceDefinition = ${JSON.stringify(parsed)};`;
  });
  const items = rows.map((json) => ({ json }));
  return new Function('require', '$input', '$', code)(
    require,
    { first: () => items[0], all: () => items },
    () => { throw new Error(`${name}: unexpected cross-node lookup`); },
  );
}
function runCloned(name, json) {
  return new Function('require', '$input', '$', byName(name).parameters.jsCode)(
    require, { first: () => ({ json }) }, () => ({ first: () => ({ json: {} }) }),
  );
}
function runWithLookups(name, json, lookups) {
  const lookup = (nodeName) => {
    if (!Object.hasOwn(lookups, nodeName)) throw new Error(`${name}: unexpected lookup ${nodeName}`);
    const values = Array.isArray(lookups[nodeName]) ? lookups[nodeName] : [lookups[nodeName]];
    const items = values.map((value) => ({ json: value }));
    return {
      first: () => items[0],
      last: () => items.at(-1),
      all: () => items,
    };
  };
  return new Function('require', '$input', '$', byName(name).parameters.jsCode)(
    require,
    { first: () => ({ json }), all: () => [{ json }] },
    lookup,
  );
}

try {
  const sourceRecords = fs.readFileSync(tmpDataset, 'utf8').split(/\r?\n/)
    .filter((line) => line.trim()).map((line) => JSON.parse(line));
  const sourceOrder = sourceRecords.map((record) => record.record_id);
  const sheetRows = sourceRecords.map((record, index) => {
    const row = { row_number: index + 2 };
    for (const [key, value] of Object.entries(record)) {
      if (value === null || value === undefined) continue;
      row[key] = Array.isArray(value) ? JSON.stringify(value) : value;
    }
    return row;
  });
  sheetRows[0].title_reworked_ko = '시트에서 고친 제목이 JSONL에 반영되는지 확인';
  sheetRows[1][UPLOAD_COMPLETE_COLUMN] = true;
  const formulaSafeIndex = sourceRecords.findIndex((record) => String(record.record_id).startsWith('-'));
  assert.notEqual(formulaSafeIndex, -1, 'negative record_id fixture missing');
  sheetRows[formulaSafeIndex].item_id = "'" + sourceRecords[formulaSafeIndex].item_id;
  const handleIndex = sourceRecords.findIndex((record) => String(record.source_handle).startsWith('@'));
  assert.notEqual(handleIndex, -1, 'source_handle fixture missing');
  sheetRows[handleIndex].source_handle = "'" + sourceRecords[handleIndex].source_handle;
  const collectedAtIndex = sourceRecords.findIndex((record) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/.test(record.collected_at));
  assert.notEqual(collectedAtIndex, -1, 'collected_at fixture missing');
  sheetRows[collectedAtIndex].collected_at = sourceRecords[collectedAtIndex].collected_at
    .replace('T', ' ').replace('+09:00', ' (KST)');
  fs.mkdirSync(path.join(tmpWork, '기록'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpWork, '기록', '사용기록.jsonl'),
    `${JSON.stringify({ record_id: sourceRecords[0].record_id })}\n`,
    'utf8',
  );

  const merged = runNodeMany('Merge Sheet Into Dataset', sheetRows)[0].json;
  assert.equal(merged.sheet_sync.rows, 2000);
  assert.equal(merged.sheet_sync.changed_records, 1);
  assert.equal(merged.sheet_sync.used_records, 1);
  assert.equal(merged.sheet_sync.checked_rows, 2, 'used log and existing true checkbox must both survive');
  const mergedRecords = fs.readFileSync(tmpDataset, 'utf8').split(/\r?\n/)
    .filter((line) => line.trim()).map((line) => JSON.parse(line));
  assert.deepEqual(mergedRecords.map((record) => record.record_id), sourceOrder, 'sheet merge reordered or deleted records');
  assert.equal(mergedRecords[0].title_reworked_ko, sheetRows[0].title_reworked_ko);
  assert.equal(mergedRecords[formulaSafeIndex].item_id, sourceRecords[formulaSafeIndex].item_id);
  assert.equal(mergedRecords[handleIndex].source_handle, sourceRecords[handleIndex].source_handle);
  assert.equal(mergedRecords[collectedAtIndex].collected_at, sourceRecords[collectedAtIndex].collected_at);
  assert.ok(fs.existsSync(tmpDatasetBackup), 'sheet merge did not back up videos.jsonl');
  const backupRecords = fs.readFileSync(tmpDatasetBackup, 'utf8').split(/\r?\n/)
    .filter((line) => line.trim()).map((line) => JSON.parse(line));
  assert.equal(backupRecords[0].title_reworked_ko, sourceRecords[0].title_reworked_ko);
  const syncedState = JSON.parse(fs.readFileSync(tmpState, 'utf8'));
  assert.equal(syncedState.google_sheet.last_synced_row, 2000);
  assert.ok(Date.parse(syncedState.google_sheet.last_synced_at));

  const batchRequests = merged.sheet_batch_update.requests;
  assert.equal(batchRequests.length, 2);
  const updateCells = batchRequests.find((request) => request.updateCells)?.updateCells;
  assert.ok(updateCells, 'checklist batch is missing updateCells');
  assert.equal(updateCells.range.sheetId, SHEET_ID);
  assert.equal(updateCells.range.startColumnIndex, 46, 'AU must be a new column after AT');
  assert.equal(updateCells.rows.length, 2000);
  assert.equal(typeof updateCells.rows[0].values[0].userEnteredValue.boolValue, 'boolean');
  assert.equal(updateCells.rows[0].values[0].userEnteredValue.boolValue, true);
  assert.equal(updateCells.rows[1].values[0].userEnteredValue.boolValue, true);
  const validation = batchRequests.find((request) => request.setDataValidation)?.setDataValidation;
  assert.equal(validation.rule.condition.type, 'BOOLEAN');
  assert.equal(validation.rule.strict, true);

  // 이후 기존 선별/체크리스트 테스트는 빈 사용기록에서 시작한다.
  fs.writeFileSync(path.join(tmpWork, '기록', '사용기록.jsonl'), '', 'utf8');

  const config = runCloned('Load Config', {})[0].json;
  const picked = runNode('Pick Reference Card', config)[0].json;
  assert.ok(picked.reference?.record_id, 'no record was picked');
  assert.equal(picked.reference_pool.total, 2000, 'dataset size changed; update this expectation deliberately');
  assert.ok(picked.reference_pool.eligible > 0, 'no eligible record under the default gate');
  // 기본 기준은 데이터셋 자체 플래그를 존중해야 한다.
  assert.equal(picked.reference.publish_ready, true, 'default gate must respect publish_ready');
  assert.equal(picked.reference.claim_risk, 'low', 'default gate must keep claim_risk low');
  assert.equal(picked.reference.fact_check_required, false, 'default gate must exclude fact-check-required rows');
  assert.equal(picked.config.reference_lock_token?.length > 0, true, 'lock token missing');

  const built = runNode('Build Reference Pack', picked)[0].json;
  const pack = built.pack;
  // 행 수 상한(render_max_items)이 걸리면 앞에서부터 그만큼만 쓰고, 제목·부제의 개수도
  // 같이 내린다. 그 두 자리 말고는 재가공 문안을 한 글자도 바꾸지 않는다.
  const sourceItemCount = picked.reference.card_items_reworked_ko.length;
  const renderMax = Number(picked.reference_pool.gate.render_max_items || 0);
  const expectedItems = renderMax > 0 ? Math.min(renderMax, sourceItemCount) : sourceItemCount;
  const expectCount = (text) => (expectedItems === sourceItemCount
    ? text
    : text.replace(new RegExp(sourceItemCount + '\\s*(가지|개|곳|줄)', 'g'), expectedItems + '$1'));
  assert.equal(pack.rank_items.length, expectedItems, 'rendered row count does not match the render cap');
  assert.equal(pack.hook_title, expectCount(picked.reference.title_reworked_ko), 'title must be the reworked one apart from the row count');
  assert.equal(pack.subtitle, expectCount(picked.reference.card_headline_reworked_ko), 'subtitle must be the reworked headline apart from the row count');
  assert.deepEqual(
    pack.rank_items.map((item) => item.rank),
    Array.from({ length: expectedItems }, (unused, index) => index + 1),
    'kept rows must stay in source order, taken from the front',
  );
  if (expectedItems !== sourceItemCount) {
    const stale = new RegExp(sourceItemCount + '\\s*(가지|개|곳|줄)');
    assert.ok(!stale.test(pack.hook_title), 'title still claims the pre-cap row count');
    assert.ok(!stale.test(pack.subtitle), 'subtitle still claims the pre-cap row count');
    assert.equal(built.reference_summary.source_item_count, sourceItemCount, 'source row count was not recorded');
    assert.equal(built.reference_summary.dropped_items, sourceItemCount - expectedItems, 'dropped row count was not recorded');
  }
  assert.equal(pack.rank_label_mode, 'bullet', 'these are lists, not rankings — no N위 labels');
  assert.ok(pack.pinned_comment.startsWith('오늘 영상 핵심 정리\n'), 'pinned comment header must match the other circuits');
  assert.ok(pack.pinned_comment.endsWith(CLOSING), 'pinned comment must end with the reference closing line');
  assert.ok(pack.description.endsWith(CLOSING), 'description must end with the reference closing line');
  assert.ok(pack.rank_items.every((item) => !/^\s*\d+\s*[.)]/.test(item.name)), 'source numbering must be stripped');

  const reviewed = runCloned('Medical Safety Review', built)[0].json;
  assert.equal(reviewed.blocked, false, 'the default-gate record should clear medical review');

  const prepared = runCloned('Prepare Image and BGM Payloads', reviewed)[0].json;
  assert.ok(prepared.image_payload?.input?.prompt, 'no image prompt was built');
  assert.equal(prepared.image_payload.model, 'gpt-image-2-text-to-image', 'image model drifted from the main circuit');

  const handled = runNode('Add Handle To Card Footer', prepared)[0].json;
  assert.ok(handled.image_payload.input.prompt.includes(HANDLE), 'the card footer lost the channel handle');
  assert.ok(handled.visible_card_text.includes(HANDLE), 'the visible card text lost the channel handle');
  // 프롬프트에는 핸들이 두 자리에 나온다: 실제로 그릴 푸터 문구 한 번, 그리고
  // 화이트리스트가 "이 로마자만 예외로 허용한다"고 설명하는 지시문 한 번(2026-08-05).
  // 중복 방지가 잡아야 하는 건 후자가 아니라 "푸터에 핸들이 두 번 박히는 것"이므로
  // 그릴 글자가 들어가는 FOOTER 줄만 세어야 한다.
  const footerLine = handled.image_payload.input.prompt
    .split('\n')
    .find((line) => line.startsWith('FOOTER SUBSCRIBE LINE'));
  assert.ok(footerLine, 'the image prompt lost its FOOTER SUBSCRIBE LINE');
  assert.equal(
    (footerLine.match(/@haruyaksa/g) || []).length,
    1,
    'the footer line must carry the channel handle exactly once',
  );
  assert.equal(
    (handled.visible_card_text.match(/@haruyaksa/g) || []).length,
    1,
    'the visible footer must contain the handle exactly once',
  );
  assert.equal(handled.image_payload.input.aspect_ratio, '9:16', 'reference cards must fill the 9:16 Shorts frame');
  assert.ok(handled.image_payload.input.prompt.includes(CLOSING.split('. ')[0]), 'the card footer lost the reference closing line');
  assert.ok(!handled.image_payload.input.prompt.includes(MAIN_CLOSING_LEAD), 'the main circuit closing line leaked into the card prompt');
  assert.ok(handled.visible_card_text.includes(CLOSING.split('. ')[0]), 'the visible card text lost the reference closing line');
  assert.ok(!handled.visible_card_text.includes(MAIN_CLOSING_LEAD), 'the main circuit closing line leaked into the visible card text');
  // 이 회로는 렌더 단계 축소를 쓰지 않으므로 여백은 프롬프트로만 확보한다. 아래 검사는
  // "지시가 프롬프트 맨 뒤에 살아 있는가"까지만 본다 — 모델이 지켰는지는 증명하지 못한다.
  // 발행된 프레임이 실제로 상자 안에 들어갔는지는 렌더 결과를 눈으로 봐야 안다.
  // 문구 자체와 5개 회로 일괄 적용은 verify-frame-margin-policy.mjs가 본다.
  assert.match(handled.image_payload.input.prompt, /SHORTS_MARGIN_V1/, 'the shared margin instruction is missing');
  assert.ok(
    handled.image_payload.input.prompt.trimEnd().endsWith('so any Korean text placed there is lost.'),
    'the margin instruction must be the last thing the model reads',
  );
  assert.match(handled.image_payload.input.prompt, /Create one finished vertical 9:16/i, 'prompt must request a full-height 9:16 source');
  // 좌표는 lib/safe-zone.mjs 표에서 받는다. 여기 숫자를 박아두면 표를 고칠 때마다
  // 이 검사가 먼저 깨진다(왼쪽 여백을 0으로 내릴 때 실제로 그랬다).
  const sharedBox = safeBoxFor(1080, 1920, '9:16');
  assert.match(
    handled.image_payload.input.prompt,
    new RegExp(`x ${sharedBox.left}-${sharedBox.right} px and y ${sharedBox.top}-${sharedBox.bottom} px`),
    'critical text still needs the shared UI-safe coordinates',
  );
  assert.doesNotMatch(handled.image_payload.input.prompt, /REFERENCE_CARD_4X5_SOURCE_V1|finished vertical 4:5/i, 'obsolete 4:5 source-card contract remains');
  assert.equal(handled.config?.reference_card_frame_mode, 'full_frame_9x16', 'reference full-frame policy marker missing');
  assert.equal(handled.config?.safe_zone_mode, 'off', 'reference cards must bypass post-render shrinking');
  const normalizedImage = runWithLookups('Normalize Image Task', { data: { taskId: 'reference-image-task' } }, {
    'Prepare Image Task Retry': [],
    'Add Handle To Card Footer': handled,
    'Prepare Image and BGM Payloads': prepared,
  })[0].json;
  assert.equal(normalizedImage.config?.safe_zone_mode, 'off', 'image-task normalization discarded the reference full-frame policy');
  assert.equal(normalizedImage.image_payload?.input?.aspect_ratio, '9:16', 'image-task normalization restored stale image metadata');
  const parsedImage = runWithLookups('Parse Image Result', {
    data: { state: 'success', resultJson: JSON.stringify({ resultUrls: ['C:/test/reference-card.png'] }) },
  }, { 'Normalize Image Task': normalizedImage })[0].json;
  const normalizedBgm = runWithLookups('Normalize BGM Task', { data: { taskId: 'reference-bgm-task' } }, {
    'Use Live BGM?': parsedImage,
  })[0].json;
  const parsedBgm = runWithLookups('Parse BGM Result', {
    data: { status: 'SUCCESS', response: { sunoData: [{ audioUrl: 'C:/test/reference-card.mp3', duration: 30 }] } },
  }, { 'Normalize BGM Task': normalizedBgm })[0].json;
  const renderPrepared = runCloned('Prepare Local FFmpeg Render', parsedBgm)[0].json;
  assert.equal(renderPrepared.render_payload.safe_zone_mode, 'off', 'reference full-frame mode was not forwarded to the renderer');
  assert.doesNotMatch(handled.image_payload.input.prompt, /may sit under feed UI|bottom band only/i, 'legacy obscured-footer instruction remains');
  assert.equal(byName('KIE Create BGM Task').parameters.url, 'https://api.kie.ai/api/v1/generate');
  assert.equal(handled.bgm_payload.customMode, true, 'BGM must use custom music mode');
  assert.equal(handled.bgm_payload.instrumental, true, 'BGM must force instrumental-only output');
  assert.match(handled.bgm_payload.style, /ooh\/aah, vocal chops, or wordless vocals/, 'BGM style lost the humming ban');
  assert.match(handled.bgm_payload.style, /bright|cheerful|happy|joyful|sunny|uplifting/i, 'BGM lost the bright and happy direction');
  assert.match(handled.bgm_payload.negativeTags, /humming/i, 'BGM negative tags lost the humming ban');

  const wisdomReference = sourceRecords.find((record) => (
    record.publish_ready === true
      && Array.isArray(record.topics)
      && record.topics.some((topic) => /인간관계|인생교훈|심리/.test(topic))
  ));
  assert.ok(wisdomReference, 'no publish-ready life-wisdom fixture found');
  const wisdomBuilt = runNode('Build Reference Pack', {
    ...picked,
    reference: wisdomReference,
    reference_summary: undefined,
  })[0].json;
  assert.ok(wisdomBuilt.pack.description.endsWith(CLOSING), 'life-wisdom description drifted from the reference closing line');
  assert.ok(wisdomBuilt.pack.pinned_comment.endsWith(CLOSING), 'life-wisdom comment drifted from the reference closing line');

  const completed = runNode('Complete Reference Card', {
    ...handled,
    youtube: { skipped: false, video_id: 'verify-video', url: 'https://youtu.be/verify-video' },
  })[0].json;
  assert.equal(completed.reference_result.published, true);
  assert.equal(completed.reference_result.record_id, picked.reference.record_id);
  const usedLog = fs.readFileSync(path.join(tmpWork, '기록', '사용기록.jsonl'), 'utf8');
  assert.match(usedLog, new RegExp(picked.reference.record_id), 'the record was not checked off');
  assert.ok(!fs.existsSync(picked.config.reference_lock_path), 'the lock was not released');

  // 체크된 레코드는 다시 뽑히지 않아야 한다.
  const again = runNode('Pick Reference Card', config)[0].json;
  assert.notEqual(again.reference.record_id, picked.reference.record_id, 'a checked-off record was picked again');
  assert.equal(again.reference_pool.used, 1, 'used count did not advance');
  assert.equal(again.reference_pool.eligible, picked.reference_pool.eligible - 1, 'eligible count did not shrink');

  // 차단 경로는 사용기록을 남기지 않아야 한다.
  const blocked = runNode('Blocked Reference Card', { ...built, medical_review: { issues: ['테스트'] } })[0].json;
  assert.equal(blocked.reference_result.published, false);
  assert.equal(blocked.reference_result.blocked, true);
  const usedAfterBlock = fs.readFileSync(path.join(tmpWork, '기록', '사용기록.jsonl'), 'utf8')
    .split('\n').filter(Boolean).length;
  assert.equal(usedAfterBlock, 1, 'a blocked card must not be checked off');

  console.log(JSON.stringify({
    ok: true,
    workflow: { id: workflow.id, name: workflow.name, nodes: workflow.nodes.length },
    pool: { total: picked.reference_pool.total, eligibleUnderDefaultGate: picked.reference_pool.eligible },
    checks: [
      'structure',
      'reachability',
      'sheet_pull_before_selection',
      'record_id_merge_preserves_count_and_order',
      'sheet_edits_replace_local_copy',
      'local_backup_and_state_update',
      'used_log_to_boolean_checkbox_batch',
      'immediate_checkbox_update_after_completion',
      'google_sheets_credential_binding',
      'clone_parity_with_main_workflow',
      'public_upload_contract',
      'blocked_path_does_not_publish',
      'gate_respects_dataset_flags',
      'reworked_copy_verbatim',
      'channel_handle_in_card_footer',
      'full_frame_policy_survives_media_route',
      'bgm_humming_ban',
      'checklist_write_and_dedupe',
    ],
  }, null, 2));
} finally {
  fs.rmSync(tmpWork, { recursive: true, force: true });
}
