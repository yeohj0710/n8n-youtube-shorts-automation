import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sqlite3 from 'sqlite3';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const dbPath = path.join(root, '.n8n', 'database.sqlite');
const backupDir = path.join(root, '.n8n', 'backup-before-image-task-failure-retry-' + timestamp());
const workflowIds = ['mxrYb3maJS31gEYC', 'baekse100Life01'];

const normalizeImageTaskCode = `let base;
try {
  const retryItems = $('Prepare Image Task Retry').all();
  base = retryItems[retryItems.length - 1]?.json || null;
} catch (error) {
  base = null;
}
if (!base) {
  base = $('Prepare Image and BGM Payloads').first().json;
}

const response = $input.first().json || {};
if (response.error || (response.code && Number(response.code) !== 200)) {
  throw new Error('KIE image create failed: ' + JSON.stringify(response));
}

const taskId = response.data?.taskId || response.taskId || response.id || null;
if (!taskId) {
  throw new Error('KIE image create returned no taskId: ' + JSON.stringify(response));
}

const taskHistory = Array.isArray(base.image_task_history) ? base.image_task_history : [];

return [{
  json: {
    ...base,
    image_create_response: response,
    image_task_id: taskId,
    image_task_history: [
      ...taskHistory,
      {
        task_id: taskId,
        retry_attempt: Number(base.image_task_retry_attempt || 0),
        created_at: new Date().toISOString(),
      },
    ],
    image_task_failed: false,
    image_task_recoverable: false,
    image_task_retry_available: false,
    image_poll_attempt: 1,
    image_poll_started_at: new Date().toISOString(),
    image_poll_elapsed_seconds: 0,
    image_url: null,
    image_ready: false,
  },
}];`;

const parseImageResultCode = `let base;
try {
  const normalizedItems = $('Normalize Image Task').all();
  base = normalizedItems[normalizedItems.length - 1]?.json || $('Normalize Image Task').first().json;
} catch (error) {
  base = {};
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
const failCode = Number(data.failCode ?? data.fail_code ?? data.errorCode ?? data.error_code ?? apiCode);
const failMsg = String(data.failMsg || data.fail_msg || data.message || response.msg || response.error || '').trim();
const failed =
  ['fail', 'failed', 'error'].includes(state) ||
  Boolean(data.failCode || data.failMsg || response.error) ||
  (apiCode !== 200 && apiCode !== 0);

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function isRecoverableImageFailure() {
  const text = [state, failMsg, response.msg, response.error].filter(Boolean).join(' ').toLowerCase();
  return Boolean(
    failed && (
      apiCode === 408 ||
      apiCode === 409 ||
      apiCode === 425 ||
      apiCode === 429 ||
      apiCode >= 500 ||
      failCode === 408 ||
      failCode === 409 ||
      failCode === 425 ||
      failCode === 429 ||
      failCode >= 500 ||
      text.includes('timeout') ||
      text.includes('timed out') ||
      text.includes('try again') ||
      text.includes('no results') ||
      text.includes('temporar') ||
      text.includes('upstream') ||
      text.includes('internal') ||
      text.includes('overload') ||
      text.includes('rate limit') ||
      text.includes('server')
    )
  );
}

const usedTaskRetries = positiveInteger(base.image_task_retry_attempt ?? base.image_task_retry?.attempt, 0);
const maxTaskRetries = positiveInteger(base.config?.image_task_max_retries, 2);
const recoverable = isRecoverableImageFailure();
const retryAvailable = Boolean(failed && recoverable && usedTaskRetries < maxTaskRetries);

if (failed) {
  const failure = {
    task_id: base.image_task_id || null,
    state: state || 'failed',
    api_code: apiCode,
    fail_code: Number.isFinite(failCode) ? failCode : null,
    message: failMsg || null,
    response,
    failed_at: new Date().toISOString(),
  };

  if (retryAvailable) {
    return [{
      json: {
        ...base,
        image_poll_response: response,
        image_state: state || 'failed',
        image_failed: true,
        image_task_failed: true,
        image_task_recoverable: true,
        image_task_retry_available: true,
        image_task_retry_attempt: usedTaskRetries,
        image_task_max_retries: maxTaskRetries,
        image_task_failure: failure,
        image_ready: false,
        image_url: null,
      },
    }];
  }

  throw new Error(
    'KIE image failed' +
    (recoverable ? ' after task retries exhausted' : '') +
    '. state=' + (state || 'unknown') +
    ', taskId=' + (base.image_task_id || '-') +
    ', retries=' + usedTaskRetries + '/' + maxTaskRetries +
    ', message=' + (failMsg || '-')
  );
}

return [{
  json: {
    ...base,
    image_poll_response: response,
    image_state: state || (imageUrl ? 'succeeded' : 'pending'),
    image_failed: false,
    image_task_failed: false,
    image_task_recoverable: false,
    image_task_retry_available: false,
    image_ready: Boolean(imageUrl),
    image_url: imageUrl,
  },
}];`;

const parseImageResultFinalCode = `let base;
try {
  const prepareItems = $('Prepare Image Retry Poll').all();
  base = prepareItems[prepareItems.length - 1]?.json || $('Prepare Image Retry Poll').last().json;
} catch (error) {
  const parsedItems = $('Parse Image Result').all();
  base = parsedItems[parsedItems.length - 1]?.json || $('Parse Image Result').first().json;
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
const failCode = Number(data.failCode ?? data.fail_code ?? data.errorCode ?? data.error_code ?? apiCode);
const failMsg = String(data.failMsg || data.fail_msg || data.message || response.msg || response.error || '').trim();
const failed =
  ['fail', 'failed', 'error'].includes(state) ||
  Boolean(data.failCode || data.failMsg || response.error) ||
  (apiCode !== 200 && apiCode !== 0);

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function isRecoverableImageFailure() {
  const text = [state, failMsg, response.msg, response.error].filter(Boolean).join(' ').toLowerCase();
  return Boolean(
    failed && (
      apiCode === 408 ||
      apiCode === 409 ||
      apiCode === 425 ||
      apiCode === 429 ||
      apiCode >= 500 ||
      failCode === 408 ||
      failCode === 409 ||
      failCode === 425 ||
      failCode === 429 ||
      failCode >= 500 ||
      text.includes('timeout') ||
      text.includes('timed out') ||
      text.includes('try again') ||
      text.includes('no results') ||
      text.includes('temporar') ||
      text.includes('upstream') ||
      text.includes('internal') ||
      text.includes('overload') ||
      text.includes('rate limit') ||
      text.includes('server')
    )
  );
}

const attempt = positiveNumber(base.image_poll_attempt, 2);
const waitSeconds = positiveNumber(base.config?.image_retry_wait_seconds || base.config?.image_poll_interval_seconds, 30);
const requestedMaxAttempts = positiveNumber(base.image_poll_max_attempts || base.config?.image_poll_max_attempts, 60);
const timeoutSeconds = positiveNumber(base.image_poll_timeout_seconds || base.config?.image_poll_timeout_seconds, 1800);
const timeoutBasedMaxAttempts = Math.ceil(timeoutSeconds / waitSeconds) + 2;
const maxAttempts = Math.max(requestedMaxAttempts, timeoutBasedMaxAttempts);
const startedMs = Date.parse(base.image_poll_started_at || '');
const elapsedSeconds = Number.isFinite(startedMs) ? Math.floor((Date.now() - startedMs) / 1000) : 0;
const usedTaskRetries = positiveInteger(base.image_task_retry_attempt ?? base.image_task_retry?.attempt, 0);
const maxTaskRetries = positiveInteger(base.config?.image_task_max_retries, 2);
const recoverable = isRecoverableImageFailure();
const retryAvailable = Boolean(failed && recoverable && usedTaskRetries < maxTaskRetries);

if (failed) {
  const failure = {
    task_id: base.image_task_id || null,
    state: state || 'failed',
    api_code: apiCode,
    fail_code: Number.isFinite(failCode) ? failCode : null,
    message: failMsg || null,
    response,
    failed_at: new Date().toISOString(),
  };

  if (retryAvailable) {
    return [{
      json: {
        ...base,
        image_poll_response: response,
        image_state: state || 'failed',
        image_failed: true,
        image_task_failed: true,
        image_task_recoverable: true,
        image_task_retry_available: true,
        image_task_retry_attempt: usedTaskRetries,
        image_task_max_retries: maxTaskRetries,
        image_task_failure: failure,
        image_ready: false,
        image_url: null,
        image_retry_attempted: true,
        image_poll_attempt: attempt,
        image_poll_max_attempts: maxAttempts,
        image_poll_elapsed_seconds: elapsedSeconds,
        image_poll_timeout_seconds: timeoutSeconds,
      },
    }];
  }

  throw new Error(
    'KIE image failed' +
    (recoverable ? ' after task retries exhausted' : '') +
    '. state=' + (state || 'unknown') +
    ', taskId=' + (base.image_task_id || '-') +
    ', retries=' + usedTaskRetries + '/' + maxTaskRetries +
    ', message=' + (failMsg || '-')
  );
}

if (!imageUrl && elapsedSeconds >= timeoutSeconds) {
  throw new Error('KIE image timed out after ' + attempt + '/' + maxAttempts + ' polls and ' + elapsedSeconds + 's/' + timeoutSeconds + 's. state=' + (state || 'unknown') + ', taskId=' + (base.image_task_id || '-') + '. The workflow waited until the configured timeout; increase image_poll_timeout_seconds or rerun later.');
}

return [{
  json: {
    ...base,
    image_poll_response: response,
    image_state: state || (imageUrl ? 'succeeded' : 'pending'),
    image_failed: false,
    image_task_failed: false,
    image_task_recoverable: false,
    image_task_retry_available: false,
    image_ready: Boolean(imageUrl),
    image_url: imageUrl,
    image_retry_attempted: true,
    image_poll_attempt: attempt,
    image_poll_max_attempts: maxAttempts,
    image_poll_elapsed_seconds: elapsedSeconds,
    image_poll_timeout_seconds: timeoutSeconds,
  },
}];`;

const prepareImageTaskRetryCode = `const data = $input.first().json;

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function clean(value) {
  return String(value || '').replace(/\\s+/g, ' ').trim();
}

const previousAttempt = positiveInteger(data.image_task_retry_attempt ?? data.image_task_retry?.attempt, 0);
const attempt = previousAttempt + 1;
const maxRetries = positiveInteger(data.config?.image_task_max_retries, 2);
if (attempt > maxRetries) {
  throw new Error('KIE image task retry limit exceeded before creating a new task. attempts=' + previousAttempt + '/' + maxRetries + ', taskId=' + (data.image_task_id || '-'));
}

const failure = data.image_task_failure || {};
const retryHistory = Array.isArray(data.image_task_retry_history) ? data.image_task_retry_history : [];
const imagePayload = { ...(data.image_payload || {}) };
const payloadInput = { ...(imagePayload.input || {}) };
const existingPrompt = clean(payloadInput.prompt || imagePayload.prompt);
const retryInstruction = [
  'IMAGE_TASK_RETRY attempt ' + attempt + ' of ' + maxRetries + '.',
  'The previous KIE image job failed due to a provider/upstream issue before any image URL was returned.',
  'Generate the same final 9:16 Korean Shorts frame again, but keep the layout simpler, faster, and less crowded.',
  'Use flat editorial infographic composition, clear Korean title, numbered rows, no real faces, no logos, no medical treatment imagery.',
  failure.message ? 'Previous provider message: ' + clean(failure.message) + '.' : '',
].filter(Boolean).join('\\n');

if (payloadInput.prompt !== undefined || imagePayload.input) {
  payloadInput.prompt = [existingPrompt, retryInstruction].filter(Boolean).join('\\n\\n');
  imagePayload.input = payloadInput;
} else {
  imagePayload.prompt = [existingPrompt, retryInstruction].filter(Boolean).join('\\n\\n');
}

return [{
  json: {
    ...data,
    image_payload: imagePayload,
    image_task_retry_attempt: attempt,
    image_task_retry_available: false,
    image_task_retry: {
      attempt,
      max_retries: maxRetries,
      previous_task_id: data.image_task_id || null,
      previous_failure: failure,
      instruction: retryInstruction,
      prepared_at: new Date().toISOString(),
    },
    image_task_retry_history: [
      ...retryHistory,
      {
        attempt,
        previous_task_id: data.image_task_id || null,
        previous_failure: failure,
        prepared_at: new Date().toISOString(),
      },
    ],
    image_task_id: null,
    image_create_response: null,
    image_poll_response: null,
    image_state: 'retrying_task',
    image_failed: false,
    image_task_failed: false,
    image_task_recoverable: false,
    image_ready: false,
    image_url: null,
    image_poll_attempt: 0,
    image_poll_started_at: null,
    image_poll_elapsed_seconds: 0,
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

function nodeByName(nodes, name) {
  return nodes.find((node) => node.name === name);
}

function requireNode(nodes, name) {
  const node = nodeByName(nodes, name);
  if (!node) throw new Error('Missing node: ' + name);
  return node;
}

function setConnection(connections, from, targets) {
  connections[from] = { main: [targets.map((node) => ({ node, type: 'main', index: 0 }))] };
}

function patchLoadConfig(nodes) {
  const node = requireNode(nodes, 'Load Config');
  let code = node.parameters?.jsCode || '';
  if (!code) throw new Error('Load Config has no jsCode');

  if (/image_task_max_retries:\s*Number\(incoming\.image_task_max_retries/.test(code)) {
    code = code.replace(
      /image_task_max_retries:\s*Number\(incoming\.image_task_max_retries\s*\|\|\s*\d+\),/,
      'image_task_max_retries: Number(incoming.image_task_max_retries || 2),',
    );
  } else {
    code = code.replace(
      /image_poll_timeout_seconds:\s*Number\(incoming\.image_poll_timeout_seconds\s*\|\|\s*1800\),\n/,
      'image_poll_timeout_seconds: Number(incoming.image_poll_timeout_seconds || 1800),\n  image_task_max_retries: Number(incoming.image_task_max_retries || 2),\n  image_task_retry_wait_seconds: Number(incoming.image_task_retry_wait_seconds || incoming.image_retry_wait_seconds || 30),\n',
    );
  }

  if (!/image_task_retry_wait_seconds:\s*Number\(incoming\.image_task_retry_wait_seconds/.test(code)) {
    code = code.replace(
      /image_task_max_retries:\s*Number\(incoming\.image_task_max_retries\s*\|\|\s*2\),\n/,
      'image_task_max_retries: Number(incoming.image_task_max_retries || 2),\n  image_task_retry_wait_seconds: Number(incoming.image_task_retry_wait_seconds || incoming.image_retry_wait_seconds || 30),\n',
    );
  }

  node.parameters.jsCode = code;
}

function ensureCodeNode(nodes, name, position, jsCode) {
  let node = nodeByName(nodes, name);
  if (!node) {
    node = {
      parameters: { jsCode },
      id: randomUUID(),
      name,
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position,
    };
    nodes.push(node);
  } else {
    node.parameters = node.parameters || {};
    node.parameters.jsCode = jsCode;
    node.position = node.position || position;
  }
  return node;
}

function ensureWaitNode(nodes, name, position) {
  let node = nodeByName(nodes, name);
  const parameters = {
    resume: 'timeInterval',
    amount: '={{$json.config.image_task_retry_wait_seconds || $json.config.image_retry_wait_seconds || 30}}',
    unit: 'seconds',
  };
  if (!node) {
    node = {
      parameters,
      id: randomUUID(),
      name,
      type: 'n8n-nodes-base.wait',
      typeVersion: 1,
      position,
      webhookId: randomUUID(),
    };
    nodes.push(node);
  } else {
    node.parameters = parameters;
    node.position = node.position || position;
  }
  return node;
}

function ensureIfNode(nodes, name, position) {
  let node = nodeByName(nodes, name);
  const parameters = {
    conditions: {
      boolean: [
        {
          value1: '={{$json.image_task_retry_available}}',
          value2: true,
        },
      ],
    },
  };

  if (!node) {
    node = {
      parameters,
      id: randomUUID(),
      name,
      type: 'n8n-nodes-base.if',
      typeVersion: 1,
      position,
    };
    nodes.push(node);
  } else {
    node.parameters = parameters;
    node.position = node.position || position;
  }
  return node;
}

function patchWorkflowShape(workflow) {
  const nodes = workflow.nodes;
  const connections = workflow.connections || {};

  patchLoadConfig(nodes);
  requireNode(nodes, 'Normalize Image Task').parameters.jsCode = normalizeImageTaskCode;
  requireNode(nodes, 'Parse Image Result').parameters.jsCode = parseImageResultCode;
  requireNode(nodes, 'Parse Image Result Final').parameters.jsCode = parseImageResultFinalCode;
  ensureIfNode(nodes, 'Image Task Retryable?', [6720, 1552]);
  ensureWaitNode(nodes, 'Wait Image Task Retry 30s', [6944, 1552]);
  ensureCodeNode(nodes, 'Prepare Image Task Retry', [7200, 1552], prepareImageTaskRetryCode);

  const imageReadyTrueTarget = connections['Image Ready?']?.main?.[0]?.[0]?.node || 'Use Live BGM?';
  connections['Image Ready?'] = {
    main: [
      [{ node: imageReadyTrueTarget, type: 'main', index: 0 }],
      [{ node: 'Image Task Retryable?', type: 'main', index: 0 }],
    ],
  };
  connections['Image Task Retryable?'] = {
    main: [
      [{ node: 'Wait Image Task Retry 30s', type: 'main', index: 0 }],
      [{ node: 'Wait Image Retry 30s', type: 'main', index: 0 }],
    ],
  };
  setConnection(connections, 'Wait Image Task Retry 30s', ['Prepare Image Task Retry']);
  setConnection(connections, 'Prepare Image Task Retry', ['KIE Create Image Task']);

  workflow.connections = connections;
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
