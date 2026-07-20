import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sqlite3 from 'sqlite3';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const dbPath = path.join(root, '.n8n', 'database.sqlite');
const backupDir = path.join(root, '.n8n', 'backup-before-rank-count-variety-' + timestamp());
const workflowIds = ['mxrYb3maJS31gEYC', 'baekse100Life01'];

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  return JSON.parse(value);
}

function backupDatabase() {
  fs.mkdirSync(backupDir, { recursive: true });
  for (const suffix of ['', '-wal', '-shm']) {
    const source = dbPath + suffix;
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, path.join(backupDir, path.basename(source)));
    }
  }
}

function findWorkflowFile(id) {
  const workflowDir = path.join(root, 'workflows');
  for (const name of fs.readdirSync(workflowDir)) {
    if (!name.endsWith('.json') || name.includes('.backup')) continue;
    const file = path.join(workflowDir, name);
    try {
      const workflow = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (workflow.id === id) return file;
    } catch {
      // Ignore non-workflow JSON.
    }
  }
  throw new Error('Workflow file not found for id: ' + id);
}

function requireNode(nodes, name) {
  const node = nodes.find((item) => item.name === name);
  if (!node) throw new Error('Missing node: ' + name);
  return node;
}

function replaceRequired(code, search, replacement, label) {
  if (!code.includes(search)) throw new Error('Missing patch target: ' + label);
  return code.split(search).join(replacement);
}

function patchLoadConfig(nodes) {
  const node = requireNode(nodes, 'Load Config');
  let code = node.parameters?.jsCode || '';
  code = replaceRequired(
    code,
    'rank_count_max: Number(incoming.rank_count_max || 7),',
    'rank_count_max: Number(incoming.rank_count_max || 6),',
    'Load Config rank_count_max default',
  );
  node.parameters.jsCode = code;
}

function patchBuildRequest(nodes) {
  const node = requireNode(nodes, 'Build Viral Rank Pack Request');
  let code = node.parameters?.jsCode || '';
  code = replaceRequired(
    code,
    'const rankCountMax = Number(cfg.rank_count_max || 7);',
    'const rankCountMax = Number(cfg.rank_count_max || 6);',
    'Build request rankCountMax default',
  );
  code = replaceRequired(
    code,
    ": '- Choose the strongest ranking count between ' + rankCountMin + ' and ' + rankCountMax + '. Use only items that genuinely matter. Do not pad weak items just to reach 7.';",
    ": '- Choose the strongest ranking count between ' + rankCountMin + ' and ' + rankCountMax + '. Prefer 4 to 6 items for most topics. Do not default to 7, do not copy reference title counts, and do not add filler items just to make the list longer. Use 7 only when rank_count is explicitly 7 or a queued topic file already provides 7 strong rank_items.';",
    'Build request rank count instruction',
  );
  node.parameters.jsCode = code;
}

const fallbackHelpers = `function fallbackRankCount(entry, seed) {
  const fixed = Number.isFinite(Number(cfg.rank_count)) && Number(cfg.rank_count) > 0 ? Number(cfg.rank_count) : null;
  if (fixed) return Math.max(1, Math.min(fixed, entry.rank_items.length));
  const min = Math.max(3, Number(cfg.rank_count_min || 3));
  const configuredMax = Number(cfg.rank_count_max || 6);
  const max = Math.max(min, Math.min(configuredMax, entry.rank_items.length));
  return min + (hashText([seed, entry.content_lane, entry.hook_title, 'fallback_rank_count'].join('|')) % (max - min + 1));
}

function retitleFallbackCount(title, count) {
  return String(title || '').replace(/[0-9０-９]+\\s*(?:가지|개|위|선|순위|top)?\\s*$/i, String(count));
}

function limitFallbackPack(entry, seed) {
  const count = fallbackRankCount(entry, seed);
  return {
    ...entry,
    hook_title: retitleFallbackCount(entry.hook_title, count),
    theme: retitleFallbackCount(entry.theme, count),
    rank_items: entry.rank_items.slice(0, count).map((item, index) => ({ ...item, rank: index + 1 })),
    fallback_rank_count: count,
  };
}

`;

function patchFallbackNode(nodes, name) {
  const node = requireNode(nodes, name);
  let code = node.parameters?.jsCode || '';
  code = replaceRequired(
    code,
    '].map((entry) => ({ ...entry, rank_items: entry.rank_items.slice(0, 7) }));',
    `].map((entry) => limitFallbackPack(entry, cfg.variation_seed || new Date().toISOString()));`,
    name + ' fallback slice',
  );
  if (!code.includes('function fallbackRankCount(entry, seed)')) {
    code = replaceRequired(
      code,
      'function normalizeDuplicateTitle(value) {',
      fallbackHelpers + 'function normalizeDuplicateTitle(value) {',
      name + ' insert fallback helpers before duplicate helpers',
    );
  }
  code = code.replace(
    /const max = fixed \|\| Number\(cfg\.rank_count_max \|\| 7\);/g,
    `const queuedCount = Number(base?.config?.topic_queue?.selected?.rank_items?.length || base?.topic_queue?.selected?.rank_items?.length || 0);
  const max = fixed || (queuedCount > 0 ? queuedCount : Number(cfg.rank_count_max || 6));`,
  );
  node.parameters.jsCode = code;
}

function patchMockNode(nodes) {
  const node = requireNode(nodes, 'Mock Viral Rank Pack');
  let code = node.parameters?.jsCode || '';
  code = replaceRequired(
    code,
    '].map((entry) => ({ ...entry, rank_items: entry.rank_items.slice(0, 7) }));',
    `].map((entry) => limitFallbackPack(entry, cfg.variation_seed || new Date().toISOString()));`,
    'Mock fallback slice',
  );
  if (!code.includes('function fallbackRankCount(entry, seed)')) {
    code = replaceRequired(
      code,
      'function pickFallbackPack(context, seed, salt) {',
      fallbackHelpers + 'function pickFallbackPack(context, seed, salt) {',
      'Mock insert fallback helpers before pickFallbackPack',
    );
  }
  node.parameters.jsCode = code;
}

function patchWorkflowShape(workflow) {
  const nodes = workflow.nodes;
  patchLoadConfig(nodes);
  patchBuildRequest(nodes);
  patchFallbackNode(nodes, 'Parse KIE Claude Pack');
  patchMockNode(nodes);
  return workflow;
}

function patchWorkflowFile(id) {
  const file = findWorkflowFile(id);
  const workflow = JSON.parse(fs.readFileSync(file, 'utf8'));
  patchWorkflowShape(workflow);
  fs.writeFileSync(file, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
  return { id: workflow.id, name: workflow.name, nodes: workflow.nodes.length, file };
}

function readDbWorkflow(db, id) {
  return new Promise((resolve, reject) => {
    db.get('select id, name, nodes, connections from workflow_entity where id=?', [id], (error, row) => {
      if (error) reject(error);
      else if (!row) reject(new Error('Workflow not found in DB: ' + id));
      else resolve({
        id: row.id,
        name: row.name,
        nodes: parseJson(row.nodes, []),
        connections: parseJson(row.connections, {}),
      });
    });
  });
}

function updateDbWorkflow(db, workflow) {
  return new Promise((resolve, reject) => {
    db.run(
      "update workflow_entity set nodes=?, connections=?, versionId=?, versionCounter=versionCounter+1, updatedAt=strftime('%Y-%m-%d %H:%M:%f','now') where id=?",
      [JSON.stringify(workflow.nodes), JSON.stringify(workflow.connections), randomUUID(), workflow.id],
      function onUpdate(error) {
        if (error) reject(error);
        else resolve(this.changes);
      },
    );
  });
}

backupDatabase();
const fileResults = workflowIds.map((id) => patchWorkflowFile(id));

const db = new sqlite3.Database(dbPath);
const dbResults = [];
try {
  for (const id of workflowIds) {
    const workflow = await readDbWorkflow(db, id);
    patchWorkflowShape(workflow);
    const changes = await updateDbWorkflow(db, workflow);
    dbResults.push({ id, name: workflow.name, nodes: workflow.nodes.length, changes });
  }
} finally {
  await new Promise((resolve) => db.close(resolve));
}

console.log(JSON.stringify({
  ok: true,
  backupDir,
  fileResults,
  dbResults,
}, null, 2));
