import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowsDir = path.join(root, 'workflows');

const MAIN_WORKFLOWS = ['n8n_하루건강약사_수동실행.json', 'n8n_geongangjangsubigyeol_manual.json'];
const SOURCE_WORKFLOWS = ['n8n_source_reel_haru_manual.json', 'n8n_source_reel_longevity_manual.json'];

const changes = [];

function note(file, message) {
  changes.push({ file, message });
}

function loadWorkflow(file) {
  return JSON.parse(fs.readFileSync(path.join(workflowsDir, file), 'utf8'));
}

function saveWorkflow(file, wf) {
  fs.writeFileSync(path.join(workflowsDir, file), JSON.stringify(wf, null, 2) + '\n', 'utf8');
}

function nodeByName(wf, name) {
  const node = wf.nodes.find((n) => n.name === name);
  if (!node) throw new Error('Node not found: ' + name);
  return node;
}

function maybeNode(wf, name) {
  return wf.nodes.find((n) => n.name === name) || null;
}

function setRetry(node, maxTries, waitMs, onError) {
  node.retryOnFail = true;
  node.maxTries = maxTries;
  node.waitBetweenTries = waitMs;
  if (onError) node.onError = onError;
}

const PREPARE_IMAGE_RETRY_POLL_CODE = `const items = $input.all();
const data = items[items.length - 1]?.json || $input.first().json;
function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
const currentAttempt = positiveNumber(data.image_poll_attempt, 1);
const attempt = currentAttempt + 1;
const waitSeconds = positiveNumber(data.config?.image_retry_wait_seconds || data.config?.image_poll_interval_seconds, 30);
const requestedMaxAttempts = positiveNumber(data.image_poll_max_attempts || data.config?.image_poll_max_attempts, 30);
const timeoutSeconds = positiveNumber(data.image_poll_timeout_seconds || data.config?.image_poll_timeout_seconds, 900);
const timeoutBasedMaxAttempts = Math.ceil(timeoutSeconds / waitSeconds) + 2;
const maxAttempts = Math.max(requestedMaxAttempts, timeoutBasedMaxAttempts);
const startedAt = data.image_poll_started_at || new Date().toISOString();
const startedMs = Date.parse(startedAt);
const elapsedSeconds = Number.isFinite(startedMs) ? Math.floor((Date.now() - startedMs) / 1000) : 0;
if (currentAttempt > maxAttempts + 5) {
  throw new Error('KIE image poll hard attempt cap reached. attempts=' + currentAttempt + '/' + maxAttempts + ', elapsed=' + elapsedSeconds + 's/' + timeoutSeconds + 's, taskId=' + (data.image_task_id || '-'));
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

const PARSE_IMAGE_RESULT_FINAL_TIMEOUT_OLD = /if \(!imageUrl && elapsedSeconds >= timeoutSeconds\) \{\n  throw new Error\('KIE image timed out after '[\s\S]+?\);\n\}/;

const PARSE_IMAGE_RESULT_FINAL_TIMEOUT_NEW = `const pollExhausted = !imageUrl && (elapsedSeconds >= timeoutSeconds || attempt >= maxAttempts);
if (pollExhausted) {
  if (usedTaskRetries < maxTaskRetries) {
    return [{
      json: {
        ...base,
        image_poll_response: response,
        image_state: 'poll_timeout',
        image_failed: true,
        image_task_failed: true,
        image_task_recoverable: true,
        image_task_retry_available: true,
        image_task_retry_attempt: usedTaskRetries,
        image_task_max_retries: maxTaskRetries,
        image_task_failure: {
          reason: 'image_poll_timeout',
          task_id: base.image_task_id || null,
          state: state || 'pending',
          message: 'Image task produced no URL after ' + attempt + '/' + maxAttempts + ' polls and ' + elapsedSeconds + 's/' + timeoutSeconds + 's; recreating the task.',
          failed_at: new Date().toISOString(),
        },
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
  throw new Error('KIE image polling exhausted after ' + attempt + '/' + maxAttempts + ' polls and ' + elapsedSeconds + 's/' + timeoutSeconds + 's with task retries exhausted (' + usedTaskRetries + '/' + maxTaskRetries + '). state=' + (state || 'unknown') + ', taskId=' + (base.image_task_id || '-'));
}`;

const PREPARE_IMAGE_TASK_RETRY_INSTRUCTION_OLD = /const retryInstruction = \[\n  'IMAGE_TASK_RETRY attempt ' \+ attempt \+ ' of ' \+ maxRetries \+ '\.',\n  'The previous KIE image job failed due to a provider\/upstream issue before any image URL was returned\.',/;

const PREPARE_IMAGE_TASK_RETRY_INSTRUCTION_NEW = `const failureReason = String(failure.reason || 'provider_error');
const retryCause = failureReason === 'image_qc_reject'
  ? 'The previously generated image failed visual quality inspection: the rendered Korean text or layout did not match the required copy.'
  : (failureReason === 'image_poll_timeout'
    ? 'The previous KIE image job stalled and produced no image URL before the polling limit.'
    : 'The previous KIE image job failed due to a provider/upstream issue before any image URL was returned.');
const retryInstruction = [
  'IMAGE_TASK_RETRY attempt ' + attempt + ' of ' + maxRetries + '.',
  retryCause,
  'Render every provided Korean string verbatim with complete, correctly spelled Hangul. Do not invent, alter, or truncate any Korean word.',`;

const NORMALIZE_YT_UPLOAD_MAIN_CODE = `const fs = require('fs');
const base = $('Attach Downloaded MP4').first().json;
const upload = $input.first().json || {};
const videoId = upload.uploadId || upload.id || upload.videoId || upload.items?.[0]?.id || null;
const privacyStatus = base.config?.youtube_privacy_status || 'public';
const guard = base.upload_guard || {};
let releaseError = null;
if (guard.acquired && guard.lock_path && guard.token) {
  try {
    const current = JSON.parse(fs.readFileSync(guard.lock_path, 'utf8'));
    if (current.token === guard.token) fs.unlinkSync(guard.lock_path);
  } catch (error) {
    if (error?.code !== 'ENOENT') releaseError = error.message;
  }
}
if (!videoId) {
  const detail = upload.error
    ? (typeof upload.error === 'string' ? upload.error : JSON.stringify(upload.error))
    : JSON.stringify(upload).slice(0, 900);
  throw new Error('YouTube upload failed or returned no video ID. The upload lock was released, so the next run can upload normally. Detail: ' + detail);
}
return [{ json: { ...base, upload_guard: { ...guard, released: true, release_error: releaseError }, youtube: { skipped: false, privacy_status: privacyStatus, video_id: videoId, url: 'https://www.youtube.com/watch?v=' + videoId, raw: upload } } }];`;

const NORMALIZE_YT_UPLOAD_SOURCE_CODE = `const fs = require('fs');
const base = $('Attach Downloaded MP4').first().json;
const upload = $input.first().json || {};
const videoId = upload.uploadId || upload.id || upload.videoId || upload.items?.[0]?.id || null;
if (!videoId) {
  const detail = upload.error
    ? (typeof upload.error === 'string' ? upload.error : JSON.stringify(upload.error))
    : JSON.stringify(upload).slice(0, 900);
  throw new Error('YouTube upload failed or returned no video ID; reconcile in Studio before retrying. Detail: ' + detail);
}
const privacyStatus = base.config?.youtube_privacy_status || 'public';
const youtube = { skipped: false, privacy_status: privacyStatus, video_id: videoId, url: 'https://www.youtube.com/watch?v=' + videoId, raw: upload };
const mf = base.source_bundle?.manifest_path;
if (mf && fs.existsSync(mf)) {
  const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
  m.status = 'uploaded';
  m.youtube_video_id = videoId;
  m.youtube_url = youtube.url;
  m.upload_committed_at = new Date().toISOString();
  fs.writeFileSync(mf, JSON.stringify(m, null, 2) + '\\n', 'utf8');
}
return [{ json: { ...base, youtube } }];`;

const BUILD_IMAGE_QC_REQUEST_CODE = `const data = $input.first().json;
const cfg = data.config || {};
const pack = data.pack || {};
const imageUrl = String(data.image_url || '');
const enabled = Boolean(
  cfg.use_live_kie_ai && !cfg.dry_run && !cfg.test_mode && cfg.enable_image_qc !== false && /^https?:\\/\\//i.test(imageUrl)
);
const items = Array.isArray(pack.rank_items) ? pack.rank_items : [];
const expectedLines = [
  'TITLE: ' + String(pack.hook_title || '').trim(),
  pack.subtitle ? 'SUBTITLE: ' + String(pack.subtitle).trim() : '',
  ...items.map((item, index) => {
    const rank = Number(item.rank || index + 1);
    return 'RANK ' + rank + ': ' + String(item.card_name || item.name || '').trim() + ' | ' + String(item.card_reason || '').trim();
  }),
].filter(Boolean).join('\\n');
const instruction = [
  'You are a strict visual proofreader for a Korean YouTube Shorts ranked-card image.',
  'Inspect the attached image and compare its visible text with the EXPECTED COPY below.',
  'EXPECTED COPY:',
  expectedLines,
  'Blocking defects (decision=reject, severity=blocking):',
  '- garbled_korean: malformed, misspelled, invented, or broken Hangul glyphs anywhere on the card.',
  '- missing_required_text: the title or any ranked card_name is absent from the image.',
  '- wrong_rank_order: rank numbers are not in ascending order with rank 1 at the top.',
  '- truncated_critical_text: the title or ranked copy is cut off by the frame edge mid-word.',
  '- invented_numeric: percentages, scores, gauges, or numeric badges that do not appear in the expected copy.',
  '- duplicated_block: the same title or ranked row is rendered twice.',
  'Advisory-only issues (severity=advisory): spacing, styling, decoration, palette, minor line-wrap differences, or card_reason wrapped to two short lines.',
  'Ignore background art and decoration unless it hides required text. Small typographic differences that keep every Korean word intact are not blocking.',
  'Return strict JSON only: {"decision":"pass"|"reject","severity":"blocking"|"advisory","problems":[{"code":"...","detail":"..."}]}. Use severity=blocking only for the blocking defect list.',
].join('\\n');
const request = {
  model: cfg.kie_image_qc_model || cfg.kie_ai_model,
  stream: false,
  max_tokens: 1200,
  messages: [{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'url', url: imageUrl } },
      { type: 'text', text: instruction },
    ],
  }],
};
return [{ json: { ...data, use_ai_image_qc: enabled, kie_image_qc_request: request, image_qc: null } }];`;

const PARSE_IMAGE_QC_RESULT_CODE = `const base = $('Build Image QC Request').first().json;
const response = $input.first().json || {};

function clean(value) { return String(value || '').replace(/\\s+/g, ' ').trim(); }
function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}
function collectText(value, depth = 0) {
  if (!value || depth > 6) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((entry) => collectText(entry, depth + 1)).filter(Boolean).join('\\n');
  if (Array.isArray(value.content)) {
    const text = value.content.map((entry) => collectText(entry, depth + 1)).filter(Boolean).join('\\n');
    if (text) return text;
  }
  for (const key of ['output_text', 'text', 'data', 'result', 'response', 'message']) {
    const text = collectText(value[key], depth + 1);
    if (text) return text;
  }
  return '';
}
function advisoryPass(code, message) {
  return [{ json: { ...base, image_qc: { pass: true, decision: 'pass_with_advisory', mode: 'fail_open', code, message, checked_at: new Date().toISOString() }, image_task_retry_available: false } }];
}

const rawResponse = (() => { try { return JSON.stringify(response).toLowerCase(); } catch (error) { return ''; } })();
if (response.error || rawResponse.includes('unauthorized') || rawResponse.includes('try again later') || rawResponse.includes('internal error')) {
  return advisoryPass('image_qc_api_error', 'Image QC API failed; continuing with the generated image.');
}
const rawText = collectText(response);
if (!rawText) return advisoryPass('image_qc_empty', 'Image QC returned no parseable text; continuing.');

let review;
try {
  const fence = String.fromCharCode(96, 96, 96);
  const trimmed = rawText.trim()
    .replace(new RegExp('^' + fence + 'json\\\\s*', 'i'), '')
    .replace(new RegExp('^' + fence + '\\\\s*', 'i'), '')
    .replace(new RegExp(fence + '$', 'i'), '')
    .trim();
  try {
    review = JSON.parse(trimmed);
  } catch (error) {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) review = JSON.parse(trimmed.slice(start, end + 1));
    else throw error;
  }
} catch (error) {
  return advisoryPass('image_qc_parse_error', error.message);
}

const decision = clean(review.decision).toLowerCase();
const severity = clean(review.severity).toLowerCase();
const problems = Array.isArray(review.problems) ? review.problems.slice(0, 12) : [];
const blocking = decision === 'reject' && severity === 'blocking';
const usedTaskRetries = positiveInteger(base.image_task_retry_attempt ?? base.image_task_retry?.attempt, 0);
const maxTaskRetries = positiveInteger(base.config?.image_task_max_retries, 2);
const qcRecord = {
  pass: !blocking,
  decision: decision || 'pass',
  severity: severity || null,
  problems,
  mode: 'kie_claude_vision',
  task_retries_used: usedTaskRetries,
  checked_at: new Date().toISOString(),
};

if (blocking && usedTaskRetries < maxTaskRetries) {
  const message = 'Image QC rejected the card: ' + (problems.map((problem) => clean(problem.code) + (problem.detail ? ' (' + clean(problem.detail) + ')' : '')).join('; ') || 'blocking visual defect');
  return [{
    json: {
      ...base,
      image_qc: qcRecord,
      image_state: 'qc_rejected',
      image_failed: true,
      image_task_failed: true,
      image_task_recoverable: true,
      image_task_retry_available: true,
      image_task_retry_attempt: usedTaskRetries,
      image_task_max_retries: maxTaskRetries,
      image_task_failure: {
        reason: 'image_qc_reject',
        task_id: base.image_task_id || null,
        state: 'qc_rejected',
        message,
        failed_at: new Date().toISOString(),
      },
      image_ready: false,
      image_url: null,
    },
  }];
}
if (blocking) {
  throw new Error('Image QC blocked upload after task retries were exhausted (' + usedTaskRetries + '/' + maxTaskRetries + '). Problems: ' + JSON.stringify(problems));
}
return [{ json: { ...base, image_qc: qcRecord, image_task_retry_available: false } }];`;

function hardenSharedNodes(wf, file) {
  for (const name of ['KIE Create BGM Task', 'KIE Get BGM Task', 'KIE Get BGM Task Retry', 'KIE Create Image Task', 'KIE Get Image Task', 'KIE Get Image Task Retry']) {
    const node = maybeNode(wf, name);
    if (!node) continue;
    if (!node.retryOnFail) {
      setRetry(node, 3, 5000);
      note(file, 'retryOnFail added: ' + name);
    }
  }
  for (const name of ['Read Rendered MP4', 'Local FFmpeg Render']) {
    const node = maybeNode(wf, name);
    if (!node) continue;
    if (!node.retryOnFail) {
      setRetry(node, 3, 5000);
      note(file, 'retryOnFail added: ' + name);
    }
  }

  const upload = nodeByName(wf, 'YouTube Upload Public');
  setRetry(upload, 2, 15000, 'continueRegularOutput');
  note(file, 'YouTube Upload Public: retryOnFail 2x/15s + onError continueRegularOutput');

  const poll = nodeByName(wf, 'Prepare Image Retry Poll');
  poll.parameters.jsCode = PREPARE_IMAGE_RETRY_POLL_CODE;
  note(file, 'Prepare Image Retry Poll: hard attempt cap, timeout routing moved to Parse Image Result Final');

  const parseFinal = nodeByName(wf, 'Parse Image Result Final');
  if (!PARSE_IMAGE_RESULT_FINAL_TIMEOUT_OLD.test(parseFinal.parameters.jsCode)) {
    throw new Error(file + ': Parse Image Result Final timeout block not found');
  }
  parseFinal.parameters.jsCode = parseFinal.parameters.jsCode.replace(
    PARSE_IMAGE_RESULT_FINAL_TIMEOUT_OLD,
    PARSE_IMAGE_RESULT_FINAL_TIMEOUT_NEW,
  );
  note(file, 'Parse Image Result Final: poll timeout now recreates the image task before failing');

  const taskRetry = nodeByName(wf, 'Prepare Image Task Retry');
  if (!PREPARE_IMAGE_TASK_RETRY_INSTRUCTION_OLD.test(taskRetry.parameters.jsCode)) {
    throw new Error(file + ': Prepare Image Task Retry instruction block not found');
  }
  taskRetry.parameters.jsCode = taskRetry.parameters.jsCode.replace(
    PREPARE_IMAGE_TASK_RETRY_INSTRUCTION_OLD,
    PREPARE_IMAGE_TASK_RETRY_INSTRUCTION_NEW,
  );
  note(file, 'Prepare Image Task Retry: failure-reason aware retry instruction with verbatim-Hangul rule');
}

function patchPollDefaultsInCode(node, file, patterns) {
  let code = node.parameters.jsCode;
  for (const [oldText, newText] of patterns) {
    if (!code.includes(oldText)) throw new Error(file + ': expected snippet missing in ' + node.name + ': ' + oldText);
    code = code.split(oldText).join(newText);
  }
  node.parameters.jsCode = code;
}

function patchMainWorkflow(file) {
  const wf = loadWorkflow(file);

  hardenSharedNodes(wf, file);

  const loadConfig = nodeByName(wf, 'Load Config');
  patchPollDefaultsInCode(loadConfig, file, [
    ['image_poll_max_attempts: Number(incoming.image_poll_max_attempts || 60),', 'image_poll_max_attempts: Number(incoming.image_poll_max_attempts || 30),'],
    ['image_poll_timeout_seconds: Number(incoming.image_poll_timeout_seconds || 1800),', 'image_poll_timeout_seconds: Number(incoming.image_poll_timeout_seconds || 900),'],
    [
      'kie_ai_model: incoming.kie_ai_model || model_config.prompt_model,',
      'kie_ai_model: incoming.kie_ai_model || model_config.prompt_model,\n  enable_image_qc: bool(incoming.enable_image_qc, true),\n  kie_image_qc_model: incoming.kie_image_qc_model || model_config.prompt_model,',
    ],
  ]);
  note(file, 'Load Config: image poll defaults 900s/30 attempts, enable_image_qc + kie_image_qc_model added');

  const normalizeUpload = nodeByName(wf, 'Normalize YouTube Upload');
  normalizeUpload.parameters.jsCode = NORMALIZE_YT_UPLOAD_MAIN_CODE;
  note(file, 'Normalize YouTube Upload: releases upload lock on failure too, throws with upload error detail');

  if (!maybeNode(wf, 'Build Image QC Request')) {
    const imageReady = nodeByName(wf, 'Image Ready?');
    const claudeNode = nodeByName(wf, 'KIE Claude Generate Pack');
    const [ix, iy] = imageReady.position;

    const codeTemplate = nodeByName(wf, 'Prepare Image Retry Poll');

    const buildQc = {
      ...JSON.parse(JSON.stringify(codeTemplate)),
      id: randomUUID(),
      name: 'Build Image QC Request',
      position: [ix + 48, iy + 320],
      parameters: { jsCode: BUILD_IMAGE_QC_REQUEST_CODE },
    };
    delete buildQc.retryOnFail;
    delete buildQc.maxTries;
    delete buildQc.waitBetweenTries;
    delete buildQc.onError;

    const useQc = {
      ...JSON.parse(JSON.stringify(imageReady)),
      id: randomUUID(),
      name: 'Use AI Image QC?',
      position: [ix + 256, iy + 320],
      parameters: { conditions: { boolean: [{ value1: '={{$json.use_ai_image_qc}}', value2: true }] } },
    };

    const qcHttp = {
      ...JSON.parse(JSON.stringify(claudeNode)),
      id: randomUUID(),
      name: 'KIE Claude Image QC',
      position: [ix + 464, iy + 320],
    };
    qcHttp.parameters = {
      ...qcHttp.parameters,
      jsonBody: '={{ JSON.stringify($json.kie_image_qc_request) }}',
    };
    setRetry(qcHttp, 2, 10000, 'continueRegularOutput');
    qcHttp.continueOnFail = true;

    const parseQc = {
      ...JSON.parse(JSON.stringify(codeTemplate)),
      id: randomUUID(),
      name: 'Parse Image QC Result',
      position: [ix + 672, iy + 320],
      parameters: { jsCode: PARSE_IMAGE_QC_RESULT_CODE },
    };
    delete parseQc.retryOnFail;
    delete parseQc.maxTries;
    delete parseQc.waitBetweenTries;
    delete parseQc.onError;

    const qcPassed = {
      ...JSON.parse(JSON.stringify(imageReady)),
      id: randomUUID(),
      name: 'Image QC Passed?',
      position: [ix + 880, iy + 320],
      parameters: { conditions: { boolean: [{ value1: '={{!$json.image_task_retry_available}}', value2: true }] } },
    };

    wf.nodes.push(buildQc, useQc, qcHttp, parseQc, qcPassed);

    const conn = wf.connections;
    conn['Image Ready?'].main[0] = [{ node: 'Build Image QC Request', type: 'main', index: 0 }];
    conn['Build Image QC Request'] = { main: [[{ node: 'Use AI Image QC?', type: 'main', index: 0 }]] };
    conn['Use AI Image QC?'] = {
      main: [
        [{ node: 'KIE Claude Image QC', type: 'main', index: 0 }],
        [{ node: 'Use Live BGM?', type: 'main', index: 0 }],
      ],
    };
    conn['KIE Claude Image QC'] = { main: [[{ node: 'Parse Image QC Result', type: 'main', index: 0 }]] };
    conn['Parse Image QC Result'] = { main: [[{ node: 'Image QC Passed?', type: 'main', index: 0 }]] };
    conn['Image QC Passed?'] = {
      main: [
        [{ node: 'Use Live BGM?', type: 'main', index: 0 }],
        [{ node: 'Image Task Retryable?', type: 'main', index: 0 }],
      ],
    };
    note(file, 'Image QC gate added: Image Ready? -> Build Image QC Request -> Use AI Image QC? -> KIE Claude Image QC -> Parse Image QC Result -> Image QC Passed?');
  }

  saveWorkflow(file, wf);
}

function patchSourceWorkflow(file) {
  const wf = loadWorkflow(file);

  hardenSharedNodes(wf, file);

  const bundle = nodeByName(wf, 'Load Source Reel Bundle');
  patchPollDefaultsInCode(bundle, file, [
    ['image_poll_timeout_seconds:1800', 'image_poll_timeout_seconds:900'],
    ['image_poll_max_attempts:60', 'image_poll_max_attempts:30'],
  ]);
  note(file, 'Load Source Reel Bundle: image poll defaults 900s/30 attempts');

  const normalizeUpload = nodeByName(wf, 'Normalize YouTube Upload');
  normalizeUpload.parameters.jsCode = NORMALIZE_YT_UPLOAD_SOURCE_CODE;
  note(file, 'Normalize YouTube Upload: throws with upload error detail when no video ID');

  saveWorkflow(file, wf);
}

for (const file of MAIN_WORKFLOWS) patchMainWorkflow(file);
for (const file of SOURCE_WORKFLOWS) patchSourceWorkflow(file);

console.log(JSON.stringify({ ok: true, changes }, null, 2));
