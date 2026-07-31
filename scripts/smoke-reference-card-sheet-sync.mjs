import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sqlite3 from 'sqlite3';

const root = path.resolve(import.meta.dirname, '..');
const workflowPath = path.join(root, 'workflows', 'n8n_reference_card_haru_manual.json');
const datasetPath = path.join(root, 'research', 'single-screen-references', 'videos.jsonl');
const selectedNames = [
  'Manual Trigger',
  'Read Reference Sheet',
  'Merge Sheet Into Dataset',
  'Apply Sheet Checklist Sync',
];
const smokeWorkflowId = 'haruReferenceCardSheetSyncSmoke01';

function isPortOpen(port, host = 'localhost') {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    socket.setTimeout(800);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
  });
}

function readRecords() {
  return fs.readFileSync(datasetPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function recordIdDigest(records) {
  return crypto.createHash('sha256')
    .update(records.map((record) => record.record_id).join('\n'))
    .digest('hex');
}

function readTail(filePath, maxBytes = 1024 * 1024) {
  const size = fs.statSync(filePath).size;
  const length = Math.min(size, maxBytes);
  const buffer = Buffer.alloc(length);
  const file = fs.openSync(filePath, 'r');
  try {
    fs.readSync(file, buffer, 0, length, size - length);
  } finally {
    fs.closeSync(file);
  }
  return buffer.toString('utf8');
}

function openDb(mode = sqlite3.OPEN_READWRITE) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(path.join(root, '.n8n', 'database.sqlite'), mode, (error) => (
      error ? reject(error) : resolve(db)
    ));
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => db.get(sql, params, (error, row) => (
    error ? reject(error) : resolve(row)
  )));
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function callback(error) {
    if (error) reject(error);
    else resolve({ changes: this.changes, lastID: this.lastID });
  }));
}

function closeDb(db) {
  return new Promise((resolve, reject) => db.close((error) => (error ? reject(error) : resolve())));
}

async function cleanupSmokeWorkflow() {
  const db = await openDb();
  try {
    await run(db, 'PRAGMA foreign_keys=ON');
    await run(db, 'BEGIN IMMEDIATE');
    try {
      for (const table of ['workflow_statistics', 'webhook_entity', 'workflow_publication_outbox', 'workflow_published_version']) {
        await run(db, `DELETE FROM ${table} WHERE workflowId=?`, [smokeWorkflowId]);
      }
      await run(db, 'DELETE FROM workflow_entity WHERE id=?', [smokeWorkflowId]);
      await run(db, 'COMMIT');
    } catch (error) {
      await run(db, 'ROLLBACK');
      throw error;
    }
    const remaining = await get(db, 'SELECT COUNT(*) AS count FROM workflow_entity WHERE id=?', [smokeWorkflowId]);
    assert.equal(remaining.count, 0, '임시 동기화 워크플로우를 정리하지 못했습니다.');
  } finally {
    await closeDb(db);
  }
}

if (await isPortOpen(5678)) {
  throw new Error('동기화 부분 실행 전에 로컬 n8n을 중지하세요.');
}

const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const selectedNodes = workflow.nodes.filter((node) => selectedNames.includes(node.name));
assert.equal(selectedNodes.length, selectedNames.length, '동기화 노드 네 개를 모두 찾지 못했습니다.');
assert.deepEqual(
  new Set(selectedNodes.map((node) => node.name)),
  new Set(selectedNames),
  '동기화 노드 이름이 예상과 다릅니다.',
);

const smokeWorkflow = {
  ...workflow,
  id: smokeWorkflowId,
  name: '하루건강약사 - 레퍼런스 카드 Sheets 동기화 점검',
  active: false,
  activeVersionId: null,
  versionId: crypto.randomUUID(),
  versionCounter: 1,
  nodes: selectedNodes,
  connections: {
    'Manual Trigger': workflow.connections['Manual Trigger'],
    'Read Reference Sheet': workflow.connections['Read Reference Sheet'],
    'Merge Sheet Into Dataset': workflow.connections['Merge Sheet Into Dataset'],
    'Apply Sheet Checklist Sync': { main: [[]] },
  },
};

const before = readRecords();
assert.equal(before.length, 2000, '실행 전 videos.jsonl 레코드 수가 2,000건이 아닙니다.');
const beforeIdDigest = recordIdDigest(before);
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reference-card-sheet-sync-'));
const tempWorkflowPath = path.join(tempDir, 'workflow.json');

try {
  fs.writeFileSync(tempWorkflowPath, JSON.stringify(smokeWorkflow), 'utf8');
  const importScript = path.join(root, 'scripts', 'import-workflow.ps1');
  const n8nEntry = path.join(root, 'node_modules', 'n8n', 'bin', 'n8n');
  const imported = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', importScript, '-Workflow', tempWorkflowPath],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      timeout: 120000,
    },
  );
  if (imported.error) throw imported.error;
  if (imported.status !== 0 || !/Successfully imported/.test(imported.stdout)) {
    throw new Error([
      '동기화 점검용 임시 워크플로우를 가져오지 못했습니다.',
      imported.stdout,
      imported.stderr,
    ].filter(Boolean).join('\n'));
  }

  const importedDb = await openDb(sqlite3.OPEN_READONLY);
  try {
    const importedRow = await get(importedDb, 'SELECT id,active FROM workflow_entity WHERE id=?', [smokeWorkflowId]);
    assert.equal(importedRow?.id, smokeWorkflowId, '임시 워크플로우가 로컬 n8n DB에 없습니다.');
    assert.equal(Boolean(importedRow.active), false, '임시 워크플로우가 비활성 상태가 아닙니다.');
  } finally {
    await closeDb(importedDb);
  }

  const executionStdoutPath = path.join(tempDir, 'execution.stdout.log');
  const executionStderrPath = path.join(tempDir, 'execution.stderr.log');
  const executionStdout = fs.openSync(executionStdoutPath, 'w');
  const executionStderr = fs.openSync(executionStderrPath, 'w');
  let execution;
  try {
    execution = spawnSync(
      process.execPath,
      [n8nEntry, 'execute', '--id', smokeWorkflowId],
      {
        cwd: root,
        env: {
          ...process.env,
          N8N_USER_FOLDER: root,
          NODE_FUNCTION_ALLOW_BUILTIN: 'crypto,child_process,fs,path',
          NODE_FUNCTION_ALLOW_EXTERNAL: '',
        },
        stdio: ['ignore', executionStdout, executionStderr],
        timeout: 120000,
      },
    );
  } finally {
    fs.closeSync(executionStdout);
    fs.closeSync(executionStderr);
  }
  const executionStdoutTail = readTail(executionStdoutPath);
  const executionStderrTail = readTail(executionStderrPath);
  if (execution.error) throw execution.error;
  const executionSucceeded = execution.status === 0
    && /"lastNodeExecuted"\s*:\s*"Apply Sheet Checklist Sync"/.test(executionStdoutTail)
    && /"status"\s*:\s*"success"\s*,\s*"finished"\s*:\s*true/.test(executionStdoutTail);
  if (!executionSucceeded) {
    throw new Error([
      'n8n Sheets 동기화 부분 실행이 실패했습니다.',
      executionStdoutTail.slice(-8000),
      executionStderrTail.slice(-8000),
    ].filter(Boolean).join('\n'));
  }

  const after = readRecords();
  assert.equal(after.length, 2000, '실행 후 videos.jsonl 레코드 수가 2,000건이 아닙니다.');
  assert.equal(recordIdDigest(after), beforeIdDigest, '실행 후 record_id 순서가 바뀌었습니다.');
  console.log(JSON.stringify({
    ok: true,
    executed_nodes: selectedNames,
    dataset_records: after.length,
    record_id_order_preserved: true,
    temporary_workflow_removed: true,
    n8n_output_tail: executionStdoutTail.trim().slice(-4000),
  }, null, 2));
} finally {
  await cleanupSmokeWorkflow();
  fs.rmSync(tempDir, { recursive: true, force: true });
}
