import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sqlite3 from 'sqlite3';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const dbPath = path.join(root, '.n8n', 'database.sqlite');
const backupDir = path.join(root, '.n8n', 'backup-before-medical-review-auto-retry-' + timestamp());
const workflowIds = ['mxrYb3maJS31gEYC', 'baekse100Life01'];

const prepareMedicalRetryCode = `const data = $input.first().json;

function clean(value) {
  return String(value || '').replace(/\\s+/g, ' ').trim();
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function appendRetryInstruction(request, instruction) {
  const next = {
    ...(request || {}),
    messages: Array.isArray(request?.messages) ? request.messages.map((message) => ({ ...message })) : [],
  };

  let targetIndex = -1;
  for (let index = next.messages.length - 1; index >= 0; index -= 1) {
    if (next.messages[index]?.role === 'user') {
      targetIndex = index;
      break;
    }
  }

  if (targetIndex >= 0) {
    next.messages[targetIndex].content = String(next.messages[targetIndex].content || '') + '\\n\\n' + instruction;
  } else {
    next.messages.push({ role: 'user', content: instruction });
  }

  return next;
}

const cfg = data.config || {};
const review = data.medical_review || {};
const previousRetry = data.medical_review_retry || {};
const previousAttempt = positiveInteger(previousRetry.attempt ?? data.medical_review_retry_attempt, 0);
const attempt = previousAttempt + 1;
const maxRetries = positiveInteger(cfg.medical_review_max_retries, 2);
const available = Boolean(cfg.use_live_kie_ai && !cfg.dry_run && !cfg.test_mode && attempt <= maxRetries);
const pack = data.pack || {};
const issues = Array.isArray(review.issues) ? review.issues : [];
const issueMatches = Array.isArray(review.issue_matches) ? review.issue_matches : [];
const matchedTerms = [...new Set(issueMatches.map((entry) => clean(entry.match)).filter(Boolean))].slice(0, 12);
const previousTitle = clean(pack.hook_title || pack.theme);
const previousItems = Array.isArray(pack.rank_items)
  ? pack.rank_items.map((item) => [item.rank, item.name, item.reason, item.caution].filter(Boolean).join('. ')).join(' / ')
  : '';

const retryInstruction = [
  'MEDICAL_REVIEW_RETRY attempt ' + attempt + ' of ' + maxRetries + '.',
  'The previous generated pack failed the local medical safety review before image/BGM/upload. Generate a new pack from scratch using the same JSON schema.',
  previousTitle ? 'Do not reuse or closely paraphrase this failed title: ' + previousTitle + '.' : '',
  previousItems ? 'Do not reuse the same ranked item wording: ' + previousItems + '.' : '',
  issues.length ? 'Failed review issues: ' + issues.join(', ') + '.' : '',
  matchedTerms.length ? 'Avoid these exact risky terms and close variants in hook_title, subtitle, rank item names, reasons, caution, script, description, tags, pinned_comment, bgm_prompt, and medical_claims: ' + matchedTerms.join(', ') + '.' : '',
  'Use neutral lifestyle-safe wording only. Prefer 생활습관, 몸 상태, 컨디션, 식탁, 수면, 걷기, 집안, 장보기, 생활비, 확인, 점검, 줄이면 좋은 습관.',
  'Do not mention cure, treatment, guaranteed prevention, detox, miracle, doctor authority, hospital avoidance, prescription changes, dosage, organ disease, severe disease names, or fear-based medical claims.',
  'Return strict JSON only. No markdown.',
].filter(Boolean).join('\\n');

const retryRequest = available ? appendRetryInstruction(data.kie_claude_request, retryInstruction) : data.kie_claude_request;
const retryHistory = Array.isArray(data.medical_review_retry_history) ? data.medical_review_retry_history : [];

return [{
  json: {
    ...data,
    medical_review_retry_available: available,
    medical_review_retry_attempt: attempt,
    medical_review_retry: {
      attempt,
      max_retries: maxRetries,
      available,
      previous_title: previousTitle || null,
      issues,
      matched_terms: matchedTerms,
      instruction: retryInstruction,
      prepared_at: new Date().toISOString(),
    },
    medical_review_retry_history: [
      ...retryHistory,
      {
        attempt,
        available,
        previous_title: previousTitle || null,
        issues,
        matched_terms: matchedTerms,
        checked_at: review.checked_at || null,
      },
    ],
    kie_claude_request: retryRequest,
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

  if (/medical_review_max_retries:\s*Number\(incoming\.medical_review_max_retries/.test(code)) {
    code = code.replace(
      /medical_review_max_retries:\s*Number\(incoming\.medical_review_max_retries\s*\|\|\s*\d+\),/,
      'medical_review_max_retries: Number(incoming.medical_review_max_retries || 2),',
    );
  } else {
    code = code.replace(
      /image_poll_timeout_seconds:\s*Number\(incoming\.image_poll_timeout_seconds\s*\|\|\s*1800\),\n/,
      'image_poll_timeout_seconds: Number(incoming.image_poll_timeout_seconds || 1800),\n  medical_review_max_retries: Number(incoming.medical_review_max_retries || 2),\n',
    );
  }

  node.parameters.jsCode = code;
}

function patchParseKie(nodes) {
  const node = requireNode(nodes, 'Parse KIE Claude Pack');
  let code = node.parameters?.jsCode || '';
  if (!code) throw new Error('Parse KIE Claude Pack has no jsCode');

  const oldBaseLine = "const base = $('Build Viral Rank Pack Request').first().json;";
  const newBaseBlock = `let base;
try {
  const retryItems = $('Prepare Medical Retry Request').all();
  base = retryItems[retryItems.length - 1]?.json || null;
} catch (error) {
  base = null;
}
if (!base) {
  base = $('Build Viral Rank Pack Request').first().json;
}`;

  if (code.includes(oldBaseLine)) {
    code = code.replace(oldBaseLine, newBaseBlock);
  } else if (!code.includes('Prepare Medical Retry Request')) {
    throw new Error('Parse KIE Claude Pack base selection not recognized');
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

function ensureIfNode(nodes, name, position) {
  let node = nodeByName(nodes, name);
  const parameters = {
    conditions: {
      boolean: [
        {
          value1: '={{$json.medical_review_retry_available}}',
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
  patchParseKie(nodes);
  ensureCodeNode(nodes, 'Prepare Medical Retry Request', [4480, 2256], prepareMedicalRetryCode);
  ensureIfNode(nodes, 'Medical Retry Available?', [4752, 2256]);

  const medicalReview = requireNode(nodes, 'Medical Review Passed?');
  const trueTarget = connections[medicalReview.name]?.main?.[0]?.[0]?.node || 'Prepare Image and BGM Payloads';
  connections[medicalReview.name] = {
    main: [
      [{ node: trueTarget, type: 'main', index: 0 }],
      [{ node: 'Prepare Medical Retry Request', type: 'main', index: 0 }],
    ],
  };

  setConnection(connections, 'Prepare Medical Retry Request', ['Medical Retry Available?']);
  connections['Medical Retry Available?'] = {
    main: [
      [{ node: 'KIE Claude Generate Pack', type: 'main', index: 0 }],
      [{ node: 'Prepare Blocked Result', type: 'main', index: 0 }],
    ],
  };

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
