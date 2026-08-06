// research/queue의 대기 팩 전부를 라이브 게이트의 결정적 검사(inspectPack)에 미리 통과시킨다.
//
// 이 검사가 있는 이유(2026-08-06): 문안 규격(자수 상한·문장꼴·명사화 오류)을 어긴 팩이
// 큐에 들어가면 실행 시점에 PREPARED_PACK_REJECTED로 멈추는데, 그때는 이미지·BGM 유료
// 호출이 이미 나간 뒤다. 하루에 문안을 네 번 고쳐 쓴 날, 매번 임시 스크립트로 게이트를
// 손으로 돌려 잡았다 — 그 임시 스크립트를 여기로 옮겨 npm test가 항상 잡게 한다.
//
// 게이트 코드는 저장소 JSON이 아니라 라이브 DB에서 읽는다. 실제로 실행될 코드가 그쪽이고,
// 둘이 갈렸다면 갈렸다는 사실까지 이 검사가 드러내 준다.
//
// 한계: 결정적 검사만 본다. 제목-행 방향 일치(TITLE_ROW_MATCH_V1)와 말투는 AI 리뷰어와
// 사람 통독의 몫이다 — AGENTS.md 'New-Pack Staging Checklist' 참고.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';

const root = path.resolve(import.meta.dirname, '..');
const dbPath = path.join(root, '.n8n', 'database.sqlite');
const channels = ['하루건강약사', '건강장수비결'];

function getRow(db, sql, params) {
  return new Promise((resolve, reject) => db.get(sql, params, (error, row) => (error ? reject(error) : resolve(row))));
}

assert.ok(fs.existsSync(dbPath), 'live n8n DB not found — the gate code this verifier runs lives there');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
const row = await getRow(db, 'select nodes from workflow_entity where id = ?', ['sharedContentQualityGate01']);
db.close();
assert.ok(row, 'shared content quality gate workflow missing from the live DB');

const nodes = JSON.parse(row.nodes);
const gateNode = nodes.find((node) => String(node.parameters?.jsCode || '').includes('function inspectPack'));
assert.ok(gateNode, 'no gate node carries inspectPack');

// 노드 코드를 통째로 실행하고, 마지막 return 직전에 inspectPack만 밖으로 빼낸다.
// 함수 선언부만 잘라 쓰는 방식은 노드 코드가 조금만 바뀌어도 문법이 깨져서 버렸다.
const anchor = 'return [{\n  json: {\n    ...data,\n    quality_preflight: qualityPreflight,';
const hooked = gateNode.parameters.jsCode.replace(anchor, `globalThis.__inspectPack = inspectPack;\n${anchor}`);
assert.ok(hooked.includes('globalThis.__inspectPack'), 'gate code shape changed — update the hook anchor in this verifier');
new Function('$input', hooked)({
  first: () => ({ json: { pack: { hook_title: 'x', rank_items: [], tags: [] }, config: { dry_run: true, test_mode: true } } }),
});
const inspectPack = globalThis.__inspectPack;
delete globalThis.__inspectPack;
assert.equal(typeof inspectPack, 'function', 'inspectPack hook ran but captured nothing');

let checked = 0;
const failures = [];
for (const channel of channels) {
  const dir = path.join(root, 'research', 'queue', channel);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort()) {
    const doc = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (!doc.final_pack) {
      failures.push({ file: `${channel}/${file}`, issues: [{ code: 'no_final_pack' }] });
      continue;
    }
    checked += 1;
    let issues;
    try {
      issues = inspectPack(doc.final_pack);
    } catch (error) {
      issues = [{ code: 'inspect_threw', message: error.message }];
    }
    if (Array.isArray(issues) && issues.length) failures.push({ file: `${channel}/${file}`, issues });
  }
}

for (const failure of failures) console.error(failure.file, JSON.stringify(failure.issues));
assert.equal(failures.length, 0, `${failures.length} queued pack(s) would be rejected by the deterministic gate at run time`);

console.log(JSON.stringify({
  ok: true,
  queued_packs_checked: checked,
  note: '결정적 검사만 확인함. 제목-행 방향과 말투는 AI 리뷰어와 사람 통독이 본다.',
}, null, 2));
