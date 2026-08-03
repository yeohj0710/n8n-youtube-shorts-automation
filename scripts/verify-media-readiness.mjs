import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const workflowDir = path.join(root, 'workflows');
const workflowIds = new Set([
  'mxrYb3maJS31gEYC',
  'baekse100Life01',
  'haruImageDropShorts01',
  'longevityImageDropShorts01',
  'haruReferenceCardShorts01',
  '66bce6ab603c5bef',
  'a8031b4a365c4603',
]);

const workflows = fs.readdirSync(workflowDir)
  .filter((name) => name.endsWith('.json') && !name.includes('.backup'))
  .map((name) => JSON.parse(fs.readFileSync(path.join(workflowDir, name), 'utf8')))
  .filter((workflow) => workflowIds.has(workflow.id));

assert.equal(workflows.length, workflowIds.size, 'publishing workflow count changed');

function byName(workflow, name) {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  assert.ok(node, `${workflow.name}: missing node ${name}`);
  return node;
}

function runCode(code, input, lookups = {}) {
  return new Function('require', '$input', '$', code)(
    require,
    { first: () => ({ json: input }) },
    (name) => ({ first: () => ({ json: lookups[name] || {} }) }),
  );
}

const streamOnlyResponse = {
  data: {
    status: 'TEXT_SUCCESS',
    response: {
      sunoData: [{
        id: 'partial-track',
        audioUrl: '',
        sourceAudioUrl: null,
        streamAudioUrl: 'https://music.invalid/partial',
        sourceStreamAudioUrl: 'https://stream.invalid/partial',
        duration: null,
      }],
    },
  },
};

for (const workflow of workflows) {
  const initialCode = byName(workflow, 'Parse BGM Result').parameters.jsCode;
  const finalCode = byName(workflow, 'Parse BGM Result Final').parameters.jsCode;
  const renderCode = byName(workflow, 'Local FFmpeg Render').parameters.jsCode;

  assert.match(initialCode, /BGM_FINAL_AUDIO_V1/, `${workflow.name}: initial BGM readiness guard missing`);
  assert.match(finalCode, /BGM_FINAL_AUDIO_V1/, `${workflow.name}: final BGM readiness guard missing`);
  assert.doesNotMatch(initialCode, /streamAudioUrl|sourceStreamAudioUrl/, `${workflow.name}: initial parser still accepts partial stream URLs`);
  assert.doesNotMatch(finalCode, /streamAudioUrl|sourceStreamAudioUrl/, `${workflow.name}: final parser still accepts partial stream URLs`);
  assert.match(renderCode, /RENDER_ASYNC_SPAWN_V1/, `${workflow.name}: async render marker missing`);
  assert.doesNotMatch(renderCode, /spawnSync/, `${workflow.name}: render still blocks the task-runner heartbeat`);
  new Function('require', '$input', '$', initialCode);
  new Function('require', '$input', '$', finalCode);
  new Function('require', '$input', renderCode);
}

const sample = workflows[0];
const initialCode = byName(sample, 'Parse BGM Result').parameters.jsCode;
const finalCode = byName(sample, 'Parse BGM Result Final').parameters.jsCode;
const base = { config: { fallback_bgm_audio_url: 'C:/fallback.mp3' }, bgm_task_id: 'test-task' };

const partial = runCode(initialCode, streamOnlyResponse, { 'Normalize BGM Task': base })[0].json;
assert.equal(partial.bgm_state, 'TEXT_SUCCESS');
assert.equal(partial.bgm_audio_url, null, 'TEXT_SUCCESS stream URL must not pass BGM Ready?');
assert.equal(partial.bgm_failed, false, 'partial generation is waiting, not failed');

const finalPartial = runCode(finalCode, streamOnlyResponse, { 'Parse BGM Result': partial })[0].json;
assert.equal(finalPartial.bgm_audio_url, 'C:/fallback.mp3', 'final partial response must use local fallback audio');
assert.equal(finalPartial.bgm_fallback_used, true);
assert.equal(finalPartial.bgm_failed, true);

const completeResponse = {
  data: {
    status: 'SUCCESS',
    response: {
      sunoData: [{ id: 'ready-track', audioUrl: 'https://music.invalid/final.mp3', duration: 95.5 }],
    },
  },
};
const complete = runCode(finalCode, completeResponse, { 'Parse BGM Result': partial })[0].json;
assert.equal(complete.bgm_audio_url, 'https://music.invalid/final.mp3');
assert.equal(complete.bgm_audio_duration, 95.5);
assert.equal(complete.bgm_failed, false);

const renderCode = byName(sample, 'Local FFmpeg Render').parameters.jsCode;
let heartbeatTicked = false;
setTimeout(() => { heartbeatTicked = true; }, 10);
const renderPromise = runCode(renderCode, {
  config: { node_path: process.execPath, local_render_script: '-e' },
  render_payload_base64: 'setTimeout(() => process.stdout.write("render-ok"), 75)',
});
assert.ok(renderPromise instanceof Promise, 'local render node must yield a Promise');
const rendered = await renderPromise;
assert.equal(heartbeatTicked, true, 'local render blocked the event loop instead of yielding heartbeat time');
assert.equal(rendered[0].json.exitCode, 0);
assert.equal(rendered[0].json.stdout, 'render-ok');

const renderSource = fs.readFileSync(path.join(root, 'scripts', 'render-static-card.mjs'), 'utf8');
assert.match(renderSource, /download returned an empty file/, 'renderer does not reject an empty media response');

console.log(JSON.stringify({
  ok: true,
  workflows: workflows.length,
  checks: [
    'partial_stream_url_waits',
    'final_partial_uses_fallback',
    'success_uses_final_audio_url',
    'render_does_not_block_heartbeat',
    'empty_media_rejected',
  ],
}, null, 2));
