import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowsDir = path.join(root, 'workflows');

const MAIN_WORKFLOWS = ['n8n_하루건강약사_수동실행.json', 'n8n_geongangjangsubigyeol_manual.json'];
const SOURCE_WORKFLOWS = ['n8n_source_reel_haru_manual.json', 'n8n_source_reel_longevity_manual.json'];

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function loadWorkflow(file) {
  return JSON.parse(fs.readFileSync(path.join(workflowsDir, file), 'utf8'));
}

function nodeByName(wf, name) {
  return wf.nodes.find((n) => n.name === name) || null;
}

function firstTargets(wf, name, outputIndex) {
  return (wf.connections?.[name]?.main?.[outputIndex] || []).map((t) => t.node);
}

for (const file of [...MAIN_WORKFLOWS, ...SOURCE_WORKFLOWS]) {
  const wf = loadWorkflow(file);

  for (const node of wf.nodes) {
    const code = node.parameters?.jsCode;
    if (!code) continue;
    try {
      new Function(code);
    } catch (error) {
      failures.push(file + ': node "' + node.name + '" has invalid JS: ' + error.message);
    }
    if (code.includes('process.')) failures.push(file + ': node "' + node.name + '" uses process.*');
  }

  for (const name of ['KIE Create BGM Task', 'KIE Get BGM Task', 'KIE Get BGM Task Retry', 'KIE Create Image Task', 'KIE Get Image Task', 'KIE Get Image Task Retry', 'Read Rendered MP4', 'Local FFmpeg Render']) {
    const node = nodeByName(wf, name);
    if (!node) continue;
    check(node.retryOnFail === true, file + ': ' + name + ' missing retryOnFail');
  }

  const upload = nodeByName(wf, 'YouTube Upload Public');
  check(upload?.retryOnFail === true, file + ': YouTube Upload Public missing retryOnFail');
  check(upload?.onError === 'continueRegularOutput', file + ': YouTube Upload Public missing onError=continueRegularOutput');

  const poll = nodeByName(wf, 'Prepare Image Retry Poll');
  check(poll?.parameters.jsCode.includes('maxAttempts + 5'), file + ': Prepare Image Retry Poll missing hard attempt cap');
  check(!poll?.parameters.jsCode.includes('timeout reached before next poll'), file + ': Prepare Image Retry Poll still throws on elapsed timeout');

  const parseFinal = nodeByName(wf, 'Parse Image Result Final');
  check(parseFinal?.parameters.jsCode.includes("reason: 'image_poll_timeout'"), file + ': Parse Image Result Final missing poll-timeout task-retry routing');
  check(parseFinal?.parameters.jsCode.includes('attempt >= maxAttempts'), file + ': Parse Image Result Final missing attempt bound');

  const taskRetry = nodeByName(wf, 'Prepare Image Task Retry');
  check(taskRetry?.parameters.jsCode.includes('image_qc_reject'), file + ': Prepare Image Task Retry not QC-aware');
  check(taskRetry?.parameters.jsCode.includes('verbatim with complete, correctly spelled Hangul'), file + ': Prepare Image Task Retry missing verbatim-Hangul rule');

  const normalizeUpload = nodeByName(wf, 'Normalize YouTube Upload');
  check(/throw new Error\('YouTube upload failed or returned no video ID/.test(normalizeUpload?.parameters.jsCode || ''), file + ': Normalize YouTube Upload does not throw on missing video ID');
}

for (const file of MAIN_WORKFLOWS) {
  const wf = loadWorkflow(file);

  const loadConfig = nodeByName(wf, 'Load Config');
  check(loadConfig?.parameters.jsCode.includes('image_poll_timeout_seconds || 900'), file + ': Load Config image_poll_timeout_seconds default not 900');
  check(loadConfig?.parameters.jsCode.includes('image_poll_max_attempts || 30'), file + ': Load Config image_poll_max_attempts default not 30');
  check(loadConfig?.parameters.jsCode.includes('enable_image_qc'), file + ': Load Config missing enable_image_qc');
  check(loadConfig?.parameters.jsCode.includes('kie_image_qc_model'), file + ': Load Config missing kie_image_qc_model');

  for (const name of ['Build Image QC Request', 'Use AI Image QC?', 'KIE Claude Image QC', 'Parse Image QC Result', 'Image QC Passed?']) {
    check(Boolean(nodeByName(wf, name)), file + ': missing node ' + name);
  }

  const qcHttp = nodeByName(wf, 'KIE Claude Image QC');
  check(Boolean(qcHttp?.credentials?.httpHeaderAuth), file + ': KIE Claude Image QC missing httpHeaderAuth credential');
  check(qcHttp?.parameters?.jsonBody === '={{ JSON.stringify($json.kie_image_qc_request) }}', file + ': KIE Claude Image QC wrong jsonBody');

  check(firstTargets(wf, 'Image Ready?', 0).includes('Build Image QC Request'), file + ': Image Ready? true branch must go to Build Image QC Request');
  check(firstTargets(wf, 'Build Image QC Request', 0).includes('Use AI Image QC?'), file + ': Build Image QC Request must go to Use AI Image QC?');
  check(firstTargets(wf, 'Use AI Image QC?', 0).includes('KIE Claude Image QC'), file + ': Use AI Image QC? true branch must call KIE Claude Image QC');
  check(firstTargets(wf, 'Use AI Image QC?', 1).includes('Use Live BGM?'), file + ': Use AI Image QC? false branch must skip to Use Live BGM?');
  check(firstTargets(wf, 'KIE Claude Image QC', 0).includes('Parse Image QC Result'), file + ': KIE Claude Image QC must go to Parse Image QC Result');
  check(firstTargets(wf, 'Parse Image QC Result', 0).includes('Image QC Passed?'), file + ': Parse Image QC Result must go to Image QC Passed?');
  check(firstTargets(wf, 'Image QC Passed?', 0).includes('Use Live BGM?'), file + ': Image QC Passed? true branch must continue to Use Live BGM?');
  check(firstTargets(wf, 'Image QC Passed?', 1).includes('Image Task Retryable?'), file + ': Image QC Passed? false branch must route to Image Task Retryable?');

  const parseQc = nodeByName(wf, 'Parse Image QC Result');
  check(parseQc?.parameters.jsCode.includes('fail_open'), file + ': Parse Image QC Result must fail open on API errors');
  check(parseQc?.parameters.jsCode.includes("reason: 'image_qc_reject'"), file + ': Parse Image QC Result missing QC-reject retry envelope');

  const normalizeUpload = nodeByName(wf, 'Normalize YouTube Upload');
  check(normalizeUpload?.parameters.jsCode.includes('releaseError'), file + ': Normalize YouTube Upload must always release the upload lock');
}

for (const file of SOURCE_WORKFLOWS) {
  const wf = loadWorkflow(file);
  const bundle = nodeByName(wf, 'Load Source Reel Bundle');
  check(bundle?.parameters.jsCode.includes('image_poll_timeout_seconds:900'), file + ': bundle image_poll_timeout_seconds not 900');
  check(bundle?.parameters.jsCode.includes('image_poll_max_attempts:30'), file + ': bundle image_poll_max_attempts not 30');
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, checked: [...MAIN_WORKFLOWS, ...SOURCE_WORKFLOWS].length }));
