import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sqlite3 from 'sqlite3';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const dbPath = path.join(root, '.n8n', 'database.sqlite');
const backupDir = path.join(root, '.n8n', 'backup-before-image-poll-loop-' + timestamp());

const workflows = [
  { id: 'mxrYb3maJS31gEYC' },
  { id: 'baekse100Life01' },
];

const prepareRetryPollCode = `const items = $input.all();
const data = items[items.length - 1]?.json || $input.first().json;
const currentAttempt = Number(data.image_poll_attempt || 1);
const attempt = currentAttempt + 1;
const maxAttempts = Number(data.image_poll_max_attempts || data.config?.image_poll_max_attempts || 30);
const waitSeconds = Number(data.config?.image_retry_wait_seconds || data.config?.image_poll_interval_seconds || 30);
const timeoutSeconds = Number(data.image_poll_timeout_seconds || data.config?.image_poll_timeout_seconds || Math.max(maxAttempts * waitSeconds + 60, 900));
const startedAt = data.image_poll_started_at || new Date().toISOString();
const startedMs = Date.parse(startedAt);
const elapsedSeconds = Number.isFinite(startedMs) ? Math.floor((Date.now() - startedMs) / 1000) : 0;
if (currentAttempt >= maxAttempts || elapsedSeconds >= timeoutSeconds) {
  throw new Error('KIE image retry limit reached before next poll. attempts=' + currentAttempt + '/' + maxAttempts + ', elapsed=' + elapsedSeconds + 's/' + timeoutSeconds + 's, taskId=' + (data.image_task_id || '-'));
}
return [{
  json: {
    ...data,
    image_poll_attempt: attempt,
    image_poll_max_attempts: maxAttempts,
    image_poll_started_at: startedAt,
    image_poll_elapsed_seconds: elapsedSeconds,
    image_poll_timeout_seconds: timeoutSeconds,
  },
}];`;

const parseImageFinalCode = `let base;
try {
  const prepareItems = $('Prepare Image Retry Poll').all();
  base = prepareItems[prepareItems.length - 1]?.json || $('Prepare Image Retry Poll').last().json;
} catch (error) {
  base = $('Parse Image Result').first().json;
}
const response = $input.first().json || {};
const data = response.data || response;
const state = String(data.state || data.status || '').toLowerCase();
let resultJson = data.resultJson || data.result_json || null;
if (typeof resultJson === 'string' && resultJson.trim()) {
  try { resultJson = JSON.parse(resultJson); } catch (error) { resultJson = { raw: data.resultJson, parse_error: error.message }; }
}
const urls =
  resultJson?.resultUrls ||
  resultJson?.result_urls ||
  resultJson?.imageUrls ||
  resultJson?.images ||
  resultJson?.urls ||
  data.response?.resultUrls ||
  data.resultUrls ||
  data.imageUrls ||
  [];
const first = Array.isArray(urls) ? urls[0] : urls;
const imageUrl = typeof first === 'string' ? first : first?.url || first?.imageUrl || first?.src || null;
const apiCode = Number(response.code ?? data.code ?? 200);
const failed =
  ['fail', 'failed', 'error'].includes(state) ||
  Boolean(data.failCode || data.failMsg || response.error) ||
  (apiCode !== 200 && apiCode !== 0);

if (failed) {
  throw new Error('KIE image failed. state=' + state + ', taskId=' + (base.image_task_id || '-') + ', message=' + (data.failMsg || response.msg || response.error || ''));
}

const attempt = Number(base.image_poll_attempt || 2);
const maxAttempts = Number(base.image_poll_max_attempts || base.config?.image_poll_max_attempts || 30);
const waitSeconds = Number(base.config?.image_retry_wait_seconds || base.config?.image_poll_interval_seconds || 30);
const timeoutSeconds = Number(base.image_poll_timeout_seconds || base.config?.image_poll_timeout_seconds || Math.max(maxAttempts * waitSeconds + 60, 900));
const startedMs = Date.parse(base.image_poll_started_at || '');
const elapsedSeconds = Number.isFinite(startedMs) ? Math.floor((Date.now() - startedMs) / 1000) : 0;

if (!imageUrl && (attempt >= maxAttempts || elapsedSeconds >= timeoutSeconds)) {
  throw new Error('KIE image still not ready after ' + attempt + '/' + maxAttempts + ' polls and ' + elapsedSeconds + 's/' + timeoutSeconds + 's. state=' + (state || 'unknown') + ', taskId=' + (base.image_task_id || '-') + '. Wait a few more minutes and poll the same taskId again, or rerun the workflow.');
}

return [{
  json: {
    ...base,
    image_poll_response: response,
    image_state: state || (imageUrl ? 'succeeded' : 'pending'),
    image_failed: false,
    image_ready: Boolean(imageUrl),
    image_url: imageUrl,
    image_retry_attempted: true,
    image_poll_attempt: attempt,
    image_poll_max_attempts: maxAttempts,
    image_poll_elapsed_seconds: elapsedSeconds,
    image_poll_timeout_seconds: timeoutSeconds,
  },
}];`;

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  return JSON.parse(value);
}

function nodeByName(nodes, name) {
  return nodes.find((node) => node.name === name);
}

function requireNode(nodes, name) {
  const node = nodeByName(nodes, name);
  if (!node) throw new Error('Missing node: ' + name);
  return node;
}

function patchLoadConfig(node) {
  let code = node.parameters?.jsCode || '';
  if (!code) throw new Error('Load Config has no jsCode');

  code = code.replace(
    /image_poll_interval_seconds:\s*Number\(incoming\.image_poll_interval_seconds\s*\|\|\s*\d+\),/,
    'image_poll_interval_seconds: Number(incoming.image_poll_interval_seconds || 30),',
  );

  if (/image_retry_wait_seconds:\s*Number\(incoming\.image_retry_wait_seconds/.test(code)) {
    code = code.replace(
      /image_retry_wait_seconds:\s*Number\(incoming\.image_retry_wait_seconds\s*\|\|\s*\d+\),/,
      'image_retry_wait_seconds: Number(incoming.image_retry_wait_seconds || 30),',
    );
  } else {
    code = code.replace(
      /image_poll_interval_seconds:\s*Number\(incoming\.image_poll_interval_seconds\s*\|\|\s*30\),\n/,
      'image_poll_interval_seconds: Number(incoming.image_poll_interval_seconds || 30),\n  image_retry_wait_seconds: Number(incoming.image_retry_wait_seconds || 30),\n',
    );
  }

  if (/image_poll_max_attempts:\s*Number\(incoming\.image_poll_max_attempts/.test(code)) {
    code = code.replace(
      /image_poll_max_attempts:\s*Number\(incoming\.image_poll_max_attempts\s*\|\|\s*\d+\),/,
      'image_poll_max_attempts: Number(incoming.image_poll_max_attempts || 30),',
    );
  } else {
    code = code.replace(
      /image_retry_wait_seconds:\s*Number\(incoming\.image_retry_wait_seconds\s*\|\|\s*30\),\n/,
      'image_retry_wait_seconds: Number(incoming.image_retry_wait_seconds || 30),\n  image_poll_max_attempts: Number(incoming.image_poll_max_attempts || 30),\n',
    );
  }

  node.parameters.jsCode = code;
}

function setConnection(connections, from, targets) {
  connections[from] = { main: [targets.map((node) => ({ node, type: 'main', index: 0 }))] };
}

function patchWorkflowShape(workflow) {
  const nodes = workflow.nodes;
  const connections = workflow.connections || {};

  patchLoadConfig(requireNode(nodes, 'Load Config'));

  const waitInitial = requireNode(nodes, 'Wait Image 30s');
  waitInitial.parameters = waitInitial.parameters || {};
  waitInitial.parameters.amount = '={{$json.config.image_poll_interval_seconds || 30}}';

  const oldWaitName = nodeByName(nodes, 'Wait Image Retry 180s') ? 'Wait Image Retry 180s' : 'Wait Image Retry 30s';
  const waitRetry = requireNode(nodes, oldWaitName);
  waitRetry.name = 'Wait Image Retry 30s';
  waitRetry.parameters = waitRetry.parameters || {};
  waitRetry.parameters.amount = '={{$json.config.image_retry_wait_seconds || 30}}';
  if (oldWaitName !== waitRetry.name && connections[oldWaitName]) {
    connections[waitRetry.name] = connections[oldWaitName];
    delete connections[oldWaitName];
  }

  let prepareRetry = nodeByName(nodes, 'Prepare Image Retry Poll');
  if (!prepareRetry) {
    prepareRetry = {
      parameters: { jsCode: prepareRetryPollCode },
      id: randomUUID(),
      name: 'Prepare Image Retry Poll',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [6944, 1328],
    };
    nodes.push(prepareRetry);
  } else {
    prepareRetry.parameters = prepareRetry.parameters || {};
    prepareRetry.parameters.jsCode = prepareRetryPollCode;
  }

  const retryGet = requireNode(nodes, 'KIE Get Image Task Retry');
  retryGet.position = [7200, 1328];

  const parseFinal = requireNode(nodes, 'Parse Image Result Final');
  parseFinal.position = [7440, 1328];
  parseFinal.parameters = parseFinal.parameters || {};
  parseFinal.parameters.jsCode = parseImageFinalCode;

  const imageReady = requireNode(nodes, 'Image Ready?');
  const trueTarget = connections[imageReady.name]?.main?.[0]?.[0]?.node || 'Use Live BGM?';
  connections[imageReady.name] = {
    main: [
      [{ node: trueTarget, type: 'main', index: 0 }],
      [{ node: 'Wait Image Retry 30s', type: 'main', index: 0 }],
    ],
  };

  setConnection(connections, 'Wait Image Retry 30s', ['Prepare Image Retry Poll']);
  setConnection(connections, 'Prepare Image Retry Poll', ['KIE Get Image Task Retry']);
  setConnection(connections, 'KIE Get Image Task Retry', ['Parse Image Result Final']);
  setConnection(connections, 'Parse Image Result Final', ['Image Ready?']);

  workflow.connections = connections;
  return workflow;
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

function patchWorkflowFile(id) {
  const file = findWorkflowFile(id);
  const workflow = JSON.parse(fs.readFileSync(file, 'utf8'));
  patchWorkflowShape(workflow);
  fs.writeFileSync(file, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
  return { id: workflow.id, name: workflow.name, nodes: workflow.nodes.length, file };
}

backupDatabase();

const fileResults = workflows.map((workflow) => patchWorkflowFile(workflow.id));

const db = new sqlite3.Database(dbPath);
const dbResults = [];
try {
  for (const { id } of workflows) {
    const workflow = await readDbWorkflow(db, id);
    patchWorkflowShape(workflow);
    const changes = await updateDbWorkflow(db, workflow);
    dbResults.push({ id, name: workflow.name, nodes: workflow.nodes.length, changes });
  }

  await new Promise((resolve, reject) => {
    db.run(
      "update execution_entity set status='canceled', stoppedAt=strftime('%Y-%m-%d %H:%M:%f','now'), finished=0 where workflowId in (?, ?) and status='running'",
      ['mxrYb3maJS31gEYC', 'baekse100Life01'],
      function onCancel(error) {
        if (error) reject(error);
        else resolve(this.changes);
      },
    );
  });
} finally {
  await new Promise((resolve) => db.close(resolve));
}

console.log(JSON.stringify({
  ok: true,
  backupDir,
  fileResults,
  dbResults,
}, null, 2));
