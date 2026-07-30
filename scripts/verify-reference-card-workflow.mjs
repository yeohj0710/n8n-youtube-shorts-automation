// 레퍼런스 카드 회로 검증. 실제 데이터셋과 복제 노드를 그대로 돌려 계약을 확인한다.
// 이 회로는 KIE 비용과 공개 업로드를 쓰므로, 배포 전에 이 검증이 통과해야 한다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

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
const CLOSING = '몸에 도움 되는 정보를 매일 하나씩 전해 드려요. 팔로우해 두시면 놓치지 않고 받아보실 수 있어요.';

assert.equal(workflow.id, 'haruReferenceCardShorts01');
assert.equal(workflow.name, '하루건강약사 - 레퍼런스 카드 쇼츠');
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
  (workflow.connections['Attach Comment Result']?.main?.[0] || []).map((e) => e.node),
  ['Complete Reference Card'],
  'upload must end in the checklist write',
);
for (const stop of ['Skip YouTube Upload', 'Mock Render Result']) {
  assert.deepEqual(
    (workflow.connections[stop]?.main?.[0] || []).map((e) => e.node),
    ['Complete Reference Card'],
    `${stop} must also reach the checklist write`,
  );
}
assert.deepEqual(
  (workflow.connections['Medical Review Passed?']?.main?.[1] || []).map((e) => e.node),
  ['Blocked Reference Card'],
  'a blocked card must not fall through to image generation',
);

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
function runNode(name, json) {
  let code = byName(name).parameters.jsCode;
  code = code.replace(/^const referenceDefinition = (.*);$/m, (match, body) => {
    const parsed = JSON.parse(body);
    parsed.workRoot = tmpWork.replace(/\\/g, '/');
    return `const referenceDefinition = ${JSON.stringify(parsed)};`;
  });
  return new Function('require', '$input', '$', code)(
    require, { first: () => ({ json }) }, () => { throw new Error(`${name}: unexpected cross-node lookup`); },
  );
}
function runCloned(name, json) {
  return new Function('require', '$input', '$', byName(name).parameters.jsCode)(
    require, { first: () => ({ json }) }, () => ({ first: () => ({ json: {} }) }),
  );
}

try {
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
  assert.equal(pack.hook_title, picked.reference.title_reworked_ko, 'title must be the reworked one, verbatim');
  assert.equal(pack.subtitle, picked.reference.card_headline_reworked_ko, 'subtitle must be the reworked headline');
  assert.equal(pack.rank_items.length, picked.reference.card_items_reworked_ko.length, 'items were dropped');
  assert.equal(pack.rank_label_mode, 'bullet', 'these are lists, not rankings — no N위 labels');
  assert.ok(pack.pinned_comment.startsWith('오늘 영상 핵심 정리\n'), 'pinned comment header must match the other circuits');
  assert.ok(pack.pinned_comment.endsWith(CLOSING), 'pinned comment must end with the follow line');
  assert.ok(pack.description.endsWith(CLOSING), 'description must end with the follow line');
  assert.ok(pack.rank_items.every((item) => !/^\s*\d+\s*[.)]/.test(item.name)), 'source numbering must be stripped');

  const reviewed = runCloned('Medical Safety Review', built)[0].json;
  assert.equal(reviewed.blocked, false, 'the default-gate record should clear medical review');

  const prepared = runCloned('Prepare Image and BGM Payloads', reviewed)[0].json;
  assert.ok(prepared.image_payload?.input?.prompt, 'no image prompt was built');
  assert.equal(prepared.image_payload.model, 'gpt-image-2-text-to-image', 'image model drifted from the main circuit');

  const handled = runNode('Add Handle To Card Footer', prepared)[0].json;
  assert.ok(handled.image_payload.input.prompt.includes(HANDLE), 'the card footer lost the channel handle');
  assert.ok(handled.visible_card_text.includes(HANDLE), 'the visible card text lost the channel handle');
  assert.match(handled.image_payload.input.prompt, /130 px top/, 'Shorts safe-zone instruction missing');
  assert.match(
    handled.bgm_payload.prompt,
    /ooh\/aah, vocal chops, or wordless vocals/,
    'BGM prompt lost the humming ban',
  );

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
      'clone_parity_with_main_workflow',
      'public_upload_contract',
      'blocked_path_does_not_publish',
      'gate_respects_dataset_flags',
      'reworked_copy_verbatim',
      'channel_handle_in_card_footer',
      'bgm_humming_ban',
      'checklist_write_and_dedupe',
    ],
  }, null, 2));
} finally {
  fs.rmSync(tmpWork, { recursive: true, force: true });
}
