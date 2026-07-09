import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sqlite3 from 'sqlite3';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const dbPath = path.join(root, '.n8n', 'database.sqlite');
const backupDir = path.join(root, '.n8n', 'backup-before-layout-' + timestamp());
const workflowIds = ['mxrYb3maJS31gEYC', 'baekse100Life01'];

const X = 280;
const Y = {
  note: -520,
  schedule: -160,
  retryTop: 120,
  live: 420,
  main: 720,
  mock: 1020,
  blocked: 1320,
};

function p(col, row) {
  return [col * X, row];
}

const positions = new Map(Object.entries({
  'Format Note': p(0, Y.note),
  Credentials: p(2, Y.note),

  'Daily 21:00 Schedule (Disabled)': p(0, Y.schedule),
  'Prepare Daily Upload Check': p(1, Y.schedule),
  'YouTube Get My Channel': p(2, Y.schedule),
  'Extract Uploads Playlist': p(3, Y.schedule),
  'YouTube Get Recent Uploads': p(4, Y.schedule),
  'Check Daily Upload Due': p(5, Y.schedule),
  'Daily Upload Due?': p(6, Y.schedule),
  'Skip Daily Upload Already Done': p(7, Y.blocked),

  'Manual Trigger': p(5, Y.main),
  'Load Config': p(7, Y.main),
  'Fetch Health RSS': p(8, Y.main),
  'Build Viral Rank Pack Request': p(9, Y.main),
  'Use Live KIE Claude?': p(10, Y.main),
  'KIE Claude Generate Pack': p(11, Y.live),
  'Parse KIE Claude Pack': p(12, Y.live),
  'Mock Viral Rank Pack': p(11, Y.mock),
  'Medical Safety Review': p(13, Y.main),
  'Medical Review Passed?': p(14, Y.main),
  'Prepare Medical Retry Request': p(15, Y.mock),
  'Medical Retry Available?': p(16, Y.mock),
  'Prepare Blocked Result': p(17, Y.blocked),

  'Prepare Image and BGM Payloads': p(15, Y.main),
  'Use Live Image?': p(16, Y.main),
  'KIE Create Image Task': p(17, Y.live),
  'Normalize Image Task': p(18, Y.live),
  'Wait Image 30s': p(19, Y.live),
  'KIE Get Image Task': p(20, Y.live),
  'Parse Image Result': p(21, Y.live),
  'Image Ready?': p(22, Y.live),
  'Image Task Retryable?': p(23, Y.live),
  'Wait Image Task Retry 30s': p(24, Y.main),
  'Prepare Image Task Retry': p(25, Y.main),
  'Wait Image Retry 30s': p(24, Y.retryTop),
  'Prepare Image Retry Poll': p(25, Y.retryTop),
  'KIE Get Image Task Retry': p(26, Y.retryTop),
  'Parse Image Result Final': p(27, Y.retryTop),
  'Mock Image Result': p(17, Y.mock),

  'Use Live BGM?': p(28, Y.main),
  'KIE Create BGM Task': p(29, Y.live),
  'Normalize BGM Task': p(30, Y.live),
  'Wait BGM 30s': p(31, Y.live),
  'KIE Get BGM Task': p(32, Y.live),
  'Parse BGM Result': p(33, Y.live),
  'BGM Ready?': p(34, Y.live),
  'Wait BGM Retry 90s': p(35, Y.retryTop),
  'KIE Get BGM Task Retry': p(36, Y.retryTop),
  'Parse BGM Result Final': p(37, Y.retryTop),
  'Mock BGM Result': p(29, Y.mock),

  'Use Live Render?': p(38, Y.main),
  'Prepare Local FFmpeg Render': p(39, Y.live),
  'Local FFmpeg Render': p(40, Y.live),
  'Parse Local Render Result': p(41, Y.live),
  'Read Rendered MP4': p(42, Y.live),
  'Attach Downloaded MP4': p(43, Y.live),
  'Mock Render Result': p(39, Y.mock),

  'Allow YouTube Upload?': p(44, Y.main),
  'YouTube Upload Public': p(45, Y.live),
  'Normalize YouTube Upload': p(46, Y.live),
  'Post Top-Level Comment': p(47, Y.live),
  'Attach Comment Result': p(48, Y.live),
  'Skip YouTube Upload': p(45, Y.mock),

  'Final Result': p(49, Y.main),
  'Notify Slack?': p(50, Y.main),
  'Send Slack Webhook': p(51, Y.live),
  'Attach Slack Result': p(52, Y.live),
  'Is Webhook Run?': p(53, Y.main),
  'Respond to Webhook': p(54, Y.live),
  'Done - Manual or Schedule': p(54, Y.mock),
}));

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

function layoutWorkflow(workflow) {
  const missing = [];
  for (const node of workflow.nodes) {
    const position = positions.get(node.name);
    if (!position) {
      missing.push(node.name);
      continue;
    }
    node.position = [...position];
  }

  if (missing.length) {
    throw new Error('Missing layout positions: ' + missing.join(', '));
  }

  return workflow;
}

function patchWorkflowFile(id) {
  const file = findWorkflowFile(id);
  const workflow = JSON.parse(fs.readFileSync(file, 'utf8'));
  layoutWorkflow(workflow);
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
    layoutWorkflow(workflow);
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
