import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sqlite3 from 'sqlite3';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const dbPath = path.join(root, '.n8n', 'database.sqlite');
const backupDir = path.join(root, '.n8n', 'backup-before-universal-pinned-comment-' + timestamp());
const universalCta = '오늘 항목 중 가장 와닿는 것은 몇 번인가요? 댓글로 번호를 남겨주세요.';

const workflows = [
  {
    id: 'mxrYb3maJS31gEYC',
    file: path.join(root, 'workflows', 'n8n_하루건강약사_수동실행.json'),
  },
  {
    id: 'baekse100Life01',
    file: path.join(root, 'workflows', 'n8n_geongangjangsubigyeol_manual.json'),
  },
];

const oldCtas = [
  '오늘 항목 중 가장 실천해보고 싶은 것은 몇 번인가요? 댓글로 번호를 남겨주세요.',
  '오늘 항목 중 가장 먼저 실천해보고 싶은 것은 몇 번인가요? 댓글로 번호를 남겨주세요.',
  '오늘 순위 중 하나만 바꿔도 충분합니다. 평소 헷갈렸던 영양제, 음식, 생활습관 질문은 댓글로 남겨주세요. 하루건강약사가 쉽게 풀어드리겠습니다.',
  '영상에서 특히 해당되는 항목이 있다면 댓글로 남겨주세요. 하루건강약사가 쉽게 풀어드리겠습니다.',
  '오늘 항목 중 식탁이나 장보기에서 먼저 확인해보고 싶은 것은 몇 번인가요? 댓글로 번호를 남겨주세요.',
  '오늘 항목 중 걷기 전에 먼저 챙기고 싶은 것은 몇 번인가요? 댓글로 번호를 남겨주세요.',
  '오늘 항목 중 내 생활 루틴에서 먼저 바꿔보고 싶은 것은 몇 번인가요? 댓글로 번호를 남겨주세요.',
  '오늘 항목 중 우리 집에서 먼저 확인해보고 싶은 것은 몇 번인가요? 댓글로 번호를 남겨주세요.',
  '오늘 항목 중 바로 줄여보고 싶은 생활습관은 몇 번인가요? 댓글로 번호를 남겨주세요.',
];

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

function replaceAllLiteral(value, search, replacement) {
  return value.split(search).join(replacement);
}

function ensureUniversalCtaFunction(code) {
  const fn = `function buildUniversalCommentCta() {
  return '${universalCta}';
}

`;

  if (code.includes('function buildUniversalCommentCta()')) return code;
  if (code.includes('function buildPinnedComment()')) {
    return code.replace('function buildPinnedComment()', fn + 'function buildPinnedComment()');
  }
  return code;
}

function patchPrepareCode(code) {
  let next = code;

  if (next.includes('function getCommentCta(')) {
    next = next.replace(
      /function getCommentCta\([\s\S]*?\n}\n\nfunction safePublicText/,
      `function buildUniversalCommentCta() {
  return '${universalCta}';
}

function safePublicText`,
    );
  }

  next = ensureUniversalCtaFunction(next);
  next = next.replace(/getCommentCta\(title,\s*sortedItems\)/g, 'buildUniversalCommentCta()');

  for (const oldCta of oldCtas) {
    next = replaceAllLiteral(next, oldCta, universalCta);
  }

  next = next.replace(
    new RegExp("'" + escapeRegExp(universalCta) + "',", 'g'),
    'buildUniversalCommentCta(),',
  );

  return next;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patchGenericCode(code) {
  let next = code;
  for (const oldCta of oldCtas) {
    next = replaceAllLiteral(next, oldCta, universalCta);
  }
  return next;
}

function patchWorkflow(workflow) {
  let changed = false;
  for (const node of workflow.nodes || []) {
    if (!node.parameters?.jsCode) continue;
    const before = node.parameters.jsCode;
    const after = node.name === 'Prepare Image and BGM Payloads'
      ? patchPrepareCode(before)
      : patchGenericCode(before);
    if (after !== before) {
      node.parameters.jsCode = after;
      changed = true;
    }
  }
  return changed;
}

function patchWorkflowFile(file) {
  const workflow = JSON.parse(fs.readFileSync(file, 'utf8'));
  const changed = patchWorkflow(workflow);
  if (changed) {
    fs.writeFileSync(file, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
  }
  return { id: workflow.id, name: workflow.name, nodes: workflow.nodes.length, changed };
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
      "update workflow_entity set nodes=?, versionId=?, versionCounter=versionCounter+1, updatedAt=strftime('%Y-%m-%d %H:%M:%f','now') where id=?",
      [JSON.stringify(workflow.nodes), randomUUID(), workflow.id],
      function onUpdate(error) {
        if (error) reject(error);
        else resolve(this.changes);
      },
    );
  });
}

backupDatabase();

const fileResults = workflows.map((workflow) => patchWorkflowFile(workflow.file));

const db = new sqlite3.Database(dbPath);
const dbResults = [];
try {
  for (const { id } of workflows) {
    const workflow = await readDbWorkflow(db, id);
    const changed = patchWorkflow(workflow);
    const changes = changed ? await updateDbWorkflow(db, workflow) : 0;
    dbResults.push({ id, name: workflow.name, nodes: workflow.nodes.length, changed, changes });
  }
} finally {
  await new Promise((resolve) => db.close(resolve));
}

console.log(JSON.stringify({
  ok: true,
  universalCta,
  backupDir,
  fileResults,
  dbResults,
}, null, 2));
