import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const require = createRequire(import.meta.url);
const files = ['workflows/n8n_하루건강약사_수동실행.json', 'workflows/n8n_geongangjangsubigyeol_manual.json'];
const testDir = path.join(root, 'etc', 'upload-guard-test');
fs.mkdirSync(testDir, { recursive: true });

function code(workflow, name) {
  return workflow.nodes.find((node) => node.name === name)?.parameters?.jsCode || '';
}

for (const file of files) {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const attach = code(workflow, 'Attach Downloaded MP4');
  const normalize = code(workflow, 'Normalize YouTube Upload');
  const skip = code(workflow, 'Skip YouTube Upload');
  const condition = workflow.nodes.find((node) => node.name === 'Allow YouTube Upload?').parameters.conditions.boolean[0].value1;
  assert.match(attach, /upload_guard_v1/);
  assert.match(attach, /openSync\(lockPath, 'wx'\)/);
  assert.match(normalize, /current\.token === guard\.token/);
  assert.match(skip, /skipped_overlapping_upload/);
  assert.match(condition, /upload_guard\?\.acquired === true/);

  const logPath = path.join(testDir, workflow.id);
  const lockPath = `${logPath}.upload.lock`;
  fs.rmSync(lockPath, { force: true });
  const base = { config: { allow_youtube_upload: true, dry_run: false, test_mode: false, upload_log_path: logPath } };
  const executeAttach = new Function('require', '$', '$input', attach);
  const invokeAttach = () => executeAttach(require, () => ({ first: () => ({ json: base }) }), { first: () => ({ binary: { data: {} } }) })[0].json;
  const first = invokeAttach();
  const second = invokeAttach();
  assert.equal(first.upload_guard.acquired, true);
  assert.equal(second.upload_guard.acquired, false);
  assert.equal(second.upload_guard.reason, 'overlapping_upload_in_progress');

  const executeNormalize = new Function('require', '$', '$input', normalize);
  executeNormalize(require, () => ({ first: () => ({ json: first }) }), { first: () => ({ json: { id: 'test-video' } }) });
  assert.equal(fs.existsSync(lockPath), false);
  const third = invokeAttach();
  assert.equal(third.upload_guard.acquired, true);
  fs.rmSync(lockPath, { force: true });
}

console.log('PASS: overlapping manual executions cannot both reach YouTube upload');
