import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';

const root = path.resolve(import.meta.dirname, '..');
const workflowDir = path.join(root, 'workflows');
const dbPath = path.join(root, '.n8n', 'database.sqlite');
const updateLiveDb = process.argv.includes('--db');
const workflowIds = new Set([
  'mxrYb3maJS31gEYC',
  'baekse100Life01',
  'haruImageDropShorts01',
  'longevityImageDropShorts01',
  'haruReferenceCardShorts01',
  '66bce6ab603c5bef',
  'a8031b4a365c4603',
]);

function bgmParserCode({ finalRetry }) {
  const baseExpression = finalRetry
    ? "$('Parse BGM Result').first().json"
    : "$('Normalize BGM Task').first().json";
  const retryAttempted = finalRetry ? 'true' : 'false';
  const finalGuard = finalRetry
    ? `if (!bgmUrl) {
  return fallbackBgm('KIE BGM still has no final audio after retry. state=' + (status || '-') + ', taskId=' + (base.bgm_task_id || '-'));
}`
    : '';

  return `// BGM_FINAL_AUDIO_V1: partial stream URLs can return HTTP 200 with an empty body.
const base = ${baseExpression};
const response = $input.first().json || {};
const data = response.data || response;
const status = String(data.status || data.state || '').toUpperCase();
const ready = ['SUCCESS', 'COMPLETE', 'COMPLETED'].includes(status);
const sunoData =
  data.response?.sunoData ||
  data.sunoData ||
  data.response?.data ||
  data.data ||
  [];

function asList(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  return [];
}

function finalAudioUrlFor(item) {
  return item?.audioUrl ||
    item?.sourceAudioUrl ||
    item?.audio_url ||
    item?.source_audio_url ||
    null;
}

function durationFor(item) {
  const duration = Number(item?.duration || item?.audioDuration || item?.durationSeconds || item?.metadata?.duration || 0);
  return Number.isFinite(duration) ? duration : 0;
}

function fallbackBgm(message) {
  const fallbackUrl =
    base.config?.fallback_bgm_audio_url ||
    base.fallback_bgm_audio_url ||
    'C:/dev/n8n-youtube-shorts-automation/assets/fallback-bgm.mp3';
  return [{
    json: {
      ...base,
      bgm_poll_response: response,
      bgm_state: status || 'FALLBACK',
      bgm_failed: true,
      bgm_fallback_used: true,
      bgm_failure_message: message,
      bgm_audio_url: fallbackUrl,
      bgm_audio_duration: null,
      bgm_audio_choice: null,
      bgm_retry_attempted: ${retryAttempted},
    },
  }];
}

const candidates = ready
  ? asList(sunoData).filter((item) => finalAudioUrlFor(item) && durationFor(item) > 0)
  : [];
const best = [...candidates].sort((left, right) => durationFor(right) - durationFor(left))[0] || null;
const topLevelUrl = ready
  ? (data.response?.audioUrl || data.response?.sourceAudioUrl || data.audioUrl || data.sourceAudioUrl || null)
  : null;
const bgmUrl = best ? finalAudioUrlFor(best) : topLevelUrl;
const failed = ['CREATE_TASK_FAILED', 'GENERATE_AUDIO_FAILED', 'CALLBACK_EXCEPTION', 'SENSITIVE_WORD_ERROR', 'FAIL', 'FAILED', 'ERROR'].includes(status);
if (failed) {
  return fallbackBgm('KIE BGM failed. state=' + status + ', taskId=' + (base.bgm_task_id || '-') + ', message=' + (data.failMsg || data.message || response.msg || response.error || ''));
}
${finalGuard}
return [{
  json: {
    ...base,
    bgm_poll_response: response,
    bgm_state: status,
    bgm_failed: false,
    bgm_audio_url: bgmUrl,
    bgm_audio_duration: best ? durationFor(best) : null,
    bgm_audio_choice: best,
    bgm_retry_attempted: ${retryAttempted},
  },
}];`;
}

const localRenderCode = `// RENDER_ASYNC_SPAWN_V1: keep the task-runner event loop free for heartbeat messages.
const data = $input.first().json;
const { spawn } = require('child_process');

const nodePath = data.config?.node_path || 'C:/Program Files/nodejs/node.exe';
const scriptPath = data.config?.local_render_script || 'C:/dev/n8n-youtube-shorts-automation/scripts/render-static-card.mjs';
const payload = data.render_payload_base64;
if (!payload) {
  throw new Error('Missing render_payload_base64 for local render.');
}

return (async () => {
  const result = await new Promise((resolve) => {
    const child = spawn(nodePath, [scriptPath, payload], { windowsHide: true });
    const maxBuffer = 20 * 1024 * 1024;
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    let bufferExceeded = false;
    let timer = null;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const append = (target, chunk) => {
      const next = target + chunk.toString('utf8');
      if (Buffer.byteLength(next, 'utf8') <= maxBuffer) return next;
      bufferExceeded = true;
      child.kill();
      return next.slice(-maxBuffer);
    };

    child.stdout.on('data', (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on('data', (chunk) => { stderr = append(stderr, chunk); });
    child.on('error', (error) => finish({ exitCode: 1, stdout, stderr: stderr + error.message, signal: null }));
    child.on('close', (code, signal) => {
      if (timedOut) stderr += '\\nLocal render timed out after 600 seconds.';
      if (bufferExceeded) stderr += '\\nLocal render output exceeded 20 MiB.';
      finish({ exitCode: code ?? 1, stdout, stderr, signal });
    });

    timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 10 * 60 * 1000);
  });

  return [{
    json: {
      ...data,
      exitCode: result.exitCode,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      signal: result.signal || null,
    },
  }];
})();`;

function patchWorkflow(workflow) {
  if (!workflowIds.has(workflow.id)) return false;
  const replacements = new Map([
    ['Parse BGM Result', bgmParserCode({ finalRetry: false })],
    ['Parse BGM Result Final', bgmParserCode({ finalRetry: true })],
    ['Local FFmpeg Render', localRenderCode],
  ]);
  for (const [name, code] of replacements) {
    const node = workflow.nodes.find((candidate) => candidate.name === name);
    if (!node) throw new Error(`${workflow.name}: missing node ${name}`);
    node.parameters.jsCode = code;
  }

  const prepareRender = workflow.nodes.find((candidate) => candidate.name === 'Prepare Local FFmpeg Render');
  if (!prepareRender) throw new Error(`${workflow.name}: missing node Prepare Local FFmpeg Render`);
  if (!prepareRender.parameters.jsCode.includes('RENDER_SAFE_ZONE_MODE_V1')) {
    const original = '  card_is_final: true\n};';
    const replacement = `  card_is_final: true,\n  // RENDER_SAFE_ZONE_MODE_V1: forward each circuit's explicit post-render fit policy.\n  safe_zone_mode: cfg.safe_zone_mode || 'auto'\n};`;
    if (!prepareRender.parameters.jsCode.includes(original)) {
      throw new Error(`${workflow.name}: Prepare Local FFmpeg Render payload shape changed`);
    }
    prepareRender.parameters.jsCode = prepareRender.parameters.jsCode.replace(original, replacement);
  }
  return true;
}

const patchedFiles = [];
for (const fileName of fs.readdirSync(workflowDir).filter((name) => name.endsWith('.json') && !name.includes('.backup'))) {
  const filePath = path.join(workflowDir, fileName);
  const workflow = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!patchWorkflow(workflow)) continue;
  fs.writeFileSync(filePath, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
  patchedFiles.push(fileName);
}

if (patchedFiles.length !== workflowIds.size) {
  throw new Error(`Expected ${workflowIds.size} workflow files, patched ${patchedFiles.length}`);
}

async function patchDatabase() {
  if (!updateLiveDb) return 0;
  const db = new sqlite3.Database(dbPath);
  const all = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
  const run = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function done(error) {
    if (error) reject(error);
    else resolve(this.changes);
  }));
  try {
    const rows = await all(`SELECT id, name, nodes FROM workflow_entity WHERE id IN (${[...workflowIds].map(() => '?').join(',')})`, [...workflowIds]);
    if (rows.length !== workflowIds.size) throw new Error(`Expected ${workflowIds.size} live workflows, found ${rows.length}`);
    await run('BEGIN IMMEDIATE');
    let changed = 0;
    try {
      for (const row of rows) {
        const workflow = { id: row.id, name: row.name, nodes: JSON.parse(row.nodes) };
        patchWorkflow(workflow);
        changed += await run('UPDATE workflow_entity SET nodes=? WHERE id=?', [JSON.stringify(workflow.nodes), row.id]);
      }
      await run('COMMIT');
    } catch (error) {
      await run('ROLLBACK');
      throw error;
    }
    return changed;
  } finally {
    db.close();
  }
}

const patchedDatabaseRows = await patchDatabase();
console.log(JSON.stringify({
  ok: true,
  patched_files: patchedFiles,
  patched_database_rows: patchedDatabaseRows,
}, null, 2));
