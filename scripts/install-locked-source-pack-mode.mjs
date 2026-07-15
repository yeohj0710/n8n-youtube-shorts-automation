import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sqlite3 from 'sqlite3';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const dbPath = path.join(root, '.n8n', 'database.sqlite');
const parentIds = ['mxrYb3maJS31gEYC', 'baekse100Life01'];
const sharedId = 'sharedContentQualityGate01';
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
const backupDir = path.join(root, '.n8n', `backup-before-locked-source-pack-${stamp}`);

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function done(error) {
    if (error) reject(error); else resolve(this.changes);
  }));
}
function all(db, sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}

function patchBuild(code) {
  code = code.replace(
    "const usableQueuedSpec = queuedSpec && !queuedTopicDuplicateOf ? queuedSpec : null;",
    "const queuedSourceLocked = Boolean(queuedSpec && /(?:^|\\s)LOCKED_SOURCE_PACK=1(?:\\s|$)/.test(String(queuedSpec.notes || '')));\nconst usableQueuedSpec = queuedSpec && (queuedSourceLocked || !queuedTopicDuplicateOf) ? queuedSpec : null;",
  );
  const oldReturn = 'return [{ json: { ...base, selected_content_lane: selectedLane, topic_candidates, duplicate_topic_candidates: duplicateTopicCandidates, recent_titles_used: recentTitles, queued_topic_duplicate_of: queuedTopicDuplicateOf, kie_claude_request } }];';
  const newReturn = "const lockedSourcePack = queuedSourceLocked ? usableQueuedSpec : null;\nreturn [{ json: { ...base, selected_content_lane: selectedLane, topic_candidates, duplicate_topic_candidates: duplicateTopicCandidates, recent_titles_used: recentTitles, queued_topic_duplicate_of: queuedTopicDuplicateOf, locked_source_pack: lockedSourcePack, kie_claude_request } }];";
  if (!code.includes('locked_source_pack: lockedSourcePack')) {
    if (!code.includes(oldReturn)) throw new Error('Build request return marker missing');
    code = code.replace(oldReturn, newReturn);
  }
  return code;
}

const lockedMockBlock = `const lockedSource = data.locked_source_pack;
if (lockedSource) {
  const rankItems = (lockedSource.rank_items || []).map((item, index) => ({
    rank: index + 1,
    name: String(item.name || '').replace(/\\s+/g, ' ').trim(),
    reason: String(item.reason || '').replace(/\\s+/g, ' ').trim(),
    caution: String(item.caution || '').replace(/\\s+/g, ' ').trim(),
  }));
  if (rankItems.length < 3 || rankItems.length > 4) throw new Error('Locked source pack requires 3-4 rank items.');
  const notes = String(lockedSource.notes || '');
  const field = (name) => notes.match(new RegExp('(?:^|\\\\s)' + name + '=([^\\\\n]+)'))?.[1]?.trim() || '';
  const pack = {
    content_lane: lockedSource.lane || 'source_grounded',
    format_angle: 'owned_source_grounded_card',
    theme: lockedSource.title,
    hook_title: lockedSource.title,
    subtitle: lockedSource.subtitle || '',
    visual_mood_hint: field('VISUAL_DIRECTION'),
    rank_items: rankItems,
    video_script: [lockedSource.title, ...rankItems.map((item) => item.name + '. ' + item.reason)].join(' '),
    description: [lockedSource.title, lockedSource.subtitle, field('SOURCE_URL')].filter(Boolean).join('\\n'),
    tags: Array.isArray(lockedSource.tags) ? lockedSource.tags : [],
    pinned_comment: '오늘 내용 중 가장 도움이 된 항목은 몇 번인가요? 댓글로 알려주세요.',
    bgm_prompt: 'warm trustworthy practical information',
    medical_claims: rankItems.map((item) => item.reason),
    safety_notes: ['원본 영상과 캡션 근거를 사용한 고정 팩'],
    source_id: field('SOURCE_ID'),
    source_url: field('SOURCE_URL'),
    source_bundle: field('SOURCE_BUNDLE'),
    source_evidence: field('EVIDENCE'),
  };
  return [{ json: { ...data, pack, locked_source_pack: lockedSource, ai_source: 'locked_source_md' } }];
}
`;

function patchMock(code) {
  if (code.includes("ai_source: 'locked_source_md'")) return code;
  const marker = 'const dryRun = Boolean(data.config?.test_mode || data.config?.dry_run);';
  if (!code.includes(marker)) throw new Error('Mock pack marker missing');
  return code.replace(marker, lockedMockBlock + marker);
}

function patchParent(workflow) {
  const build = workflow.nodes.find((node) => node.name === 'Build Viral Rank Pack Request');
  const useLive = workflow.nodes.find((node) => node.name === 'Use Live KIE Claude?');
  const mock = workflow.nodes.find((node) => node.name === 'Mock Viral Rank Pack');
  if (!build || !useLive || !mock) throw new Error(`${workflow.id}: required source pack nodes missing`);
  build.parameters.jsCode = patchBuild(build.parameters.jsCode);
  useLive.parameters.conditions.boolean[0].value1 = '={{$json.config.use_live_kie_ai && !$json.locked_source_pack}}';
  mock.parameters.jsCode = patchMock(mock.parameters.jsCode);
  return workflow;
}

function patchShared(workflow) {
  const build = workflow.nodes.find((node) => node.name === 'Build Quality Review Request');
  if (!build) throw new Error('Shared gate build node missing');
  build.parameters.jsCode = build.parameters.jsCode.replace(
    'const useAiReview = !cfg.dry_run && !cfg.test_mode && cfg.content_quality_ai_review !== false;',
    'const useAiReview = !data.locked_source_pack && !cfg.dry_run && !cfg.test_mode && cfg.content_quality_ai_review !== false;',
  );
  return workflow;
}

function findWorkflowFile(id) {
  for (const name of fs.readdirSync(path.join(root, 'workflows'))) {
    if (!name.endsWith('.json')) continue;
    const file = path.join(root, 'workflows', name);
    const workflow = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (workflow.id === id) return file;
  }
  throw new Error(`Workflow file not found: ${id}`);
}

fs.mkdirSync(backupDir, { recursive: true });
const db = new sqlite3.Database(dbPath);
const backupFile = path.join(backupDir, 'database.sqlite').replace(/'/g, "''").replace(/\\/g, '/');
await run(db, `VACUUM INTO '${backupFile}'`);

for (const id of parentIds) {
  const file = findWorkflowFile(id);
  const workflow = patchParent(JSON.parse(fs.readFileSync(file, 'utf8')));
  workflow.versionId = randomUUID();
  fs.writeFileSync(file, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
}
const sharedFile = findWorkflowFile(sharedId);
const sharedSource = patchShared(JSON.parse(fs.readFileSync(sharedFile, 'utf8')));
sharedSource.versionId = randomUUID();
fs.writeFileSync(sharedFile, JSON.stringify(sharedSource, null, 2) + '\n', 'utf8');

await run(db, 'BEGIN IMMEDIATE');
try {
  const parents = await all(db, `SELECT id,nodes,connections FROM workflow_entity WHERE id IN (${parentIds.map(() => '?').join(',')})`, parentIds);
  if (parents.length !== parentIds.length) throw new Error('Live parent workflow count mismatch');
  for (const row of parents) {
    const workflow = patchParent({ id: row.id, nodes: JSON.parse(row.nodes), connections: JSON.parse(row.connections) });
    await run(db, `UPDATE workflow_entity SET nodes=?,versionId=?,versionCounter=versionCounter+1,updatedAt=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=?`, [JSON.stringify(workflow.nodes), randomUUID(), row.id]);
  }

  const sharedRows = await all(db, `SELECT id,name,nodes,connections,nodeGroups,description FROM workflow_entity WHERE id=?`, [sharedId]);
  if (sharedRows.length !== 1) throw new Error('Live shared gate missing');
  const row = sharedRows[0];
  const shared = patchShared({ id: row.id, name: row.name, nodes: JSON.parse(row.nodes), connections: JSON.parse(row.connections), nodeGroups: JSON.parse(row.nodeGroups || '[]') });
  const versionId = randomUUID();
  await run(db, `UPDATE workflow_entity SET nodes=?,versionId=?,versionCounter=versionCounter+1,updatedAt=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=?`, [JSON.stringify(shared.nodes), versionId, sharedId]);
  await run(db, `INSERT INTO workflow_history (versionId,workflowId,authors,nodes,connections,nodeGroups,name,description,autosaved) VALUES (?,?,?,?,?,?,?,?,0)`, [versionId, sharedId, 'Codex locked source pack installer', JSON.stringify(shared.nodes), JSON.stringify(shared.connections), JSON.stringify(shared.nodeGroups), row.name, row.description]);
  await run(db, `UPDATE workflow_entity SET active=1,activeVersionId=?,updatedAt=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=?`, [versionId, sharedId]);
  await run(db, `INSERT INTO workflow_published_version (workflowId,publishedVersionId) VALUES (?,?) ON CONFLICT(workflowId) DO UPDATE SET publishedVersionId=excluded.publishedVersionId,updatedAt=strftime('%Y-%m-%d %H:%M:%f','now')`, [sharedId, versionId]);
  await run(db, 'COMMIT');
} catch (error) {
  try { await run(db, 'ROLLBACK'); } catch {}
  throw error;
} finally {
  db.close();
}

console.log(JSON.stringify({ ok: true, backup_dir: backupDir, parent_ids: parentIds, shared_id: sharedId }, null, 2));
