import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sqlite3 from 'sqlite3';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const dbPath = path.join(root, '.n8n', 'database.sqlite');
const sourcePath = path.join(root, 'workflows', 'n8n_하루건강약사_수동실행.json');
const targetPath = path.join(root, 'workflows', 'n8n_geongangjangsubigyeol_manual.json');
const sourceId = 'mxrYb3maJS31gEYC';
const targetId = 'baekse100Life01';
const channelOwnedNodes = new Set(['Load Config', 'Build Viral Rank Pack Request', 'Credentials']);
const replacements = [
  ['하루건강약사 소재', '건강장수비결 소재'],
  ['하루건강약사', '건강장수비결'],
  ['죽을 때까지 내 발로 걷고 싶다면 피할 습관 7', '건강하게 오래 살고 싶다면 피할 습관 7'],
  ['건강 랭킹 카드형 쇼츠', '장수 생활건강 랭킹 쇼츠'],
];

function mapped(value) {
  let text = JSON.stringify(value);
  for (const [from, to] of replacements) text = text.replaceAll(from, to);
  return JSON.parse(text);
}

function syncNodes(sourceNodes, targetNodes) {
  const sourceByName = new Map(sourceNodes.map((node) => [node.name, node]));
  return targetNodes.map((targetNode) => {
    if (channelOwnedNodes.has(targetNode.name)) return targetNode;
    const sourceNode = sourceByName.get(targetNode.name);
    if (!sourceNode) throw new Error(`Canonical workflow is missing node: ${targetNode.name}`);
    const next = mapped(sourceNode);
    for (const key of ['id', 'name', 'position', 'credentials', 'webhookId']) {
      if (targetNode[key] !== undefined) next[key] = targetNode[key];
      else delete next[key];
    }
    return next;
  });
}

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function done(error) {
    if (error) reject(error);
    else resolve(this.changes);
  }));
}

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const target = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
if (source.id !== sourceId || target.id !== targetId) throw new Error('Legacy workflow IDs do not match the synchronization contract.');

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
const backupDir = path.join(root, 'etc', `backup-before-legacy-runtime-sync-${stamp}`);
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(sourcePath, path.join(backupDir, path.basename(sourcePath)));
fs.copyFileSync(targetPath, path.join(backupDir, path.basename(targetPath)));
fs.copyFileSync(dbPath, path.join(backupDir, 'database.sqlite'));

target.nodes = syncNodes(source.nodes, target.nodes);
target.connections = mapped(source.connections);
target.settings = structuredClone(source.settings);
target.versionId = randomUUID();
target.updatedAt = new Date().toISOString();
fs.writeFileSync(targetPath, `${JSON.stringify(target, null, 2)}\n`, 'utf8');

const db = new sqlite3.Database(dbPath);
try {
  const row = await dbGet(db, 'SELECT nodes, connections, settings FROM workflow_entity WHERE id = ?', [targetId]);
  if (!row) throw new Error(`Live workflow not found: ${targetId}`);
  const liveNodes = JSON.parse(row.nodes);
  const syncedLiveNodes = syncNodes(source.nodes, liveNodes);
  const changes = await dbRun(
    db,
    'UPDATE workflow_entity SET nodes = ?, connections = ?, settings = ?, versionId = ?, updatedAt = ? WHERE id = ?',
    [JSON.stringify(syncedLiveNodes), JSON.stringify(mapped(source.connections)), JSON.stringify(source.settings), randomUUID(), new Date().toISOString(), targetId],
  );
  if (changes !== 1) throw new Error(`Unexpected live workflow update count: ${changes}`);
} finally {
  db.close();
}

console.log(JSON.stringify({ ok: true, sourceId, targetId, backupDir }, null, 2));
