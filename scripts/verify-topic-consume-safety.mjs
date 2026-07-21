// A prepared topic must be consumed exactly once, and only after a real upload.
// Any failure before or during upload must leave the file in the queue so the
// next run retries it instead of silently burning the topic.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = 'C:/dev/n8n-youtube-shorts-automation';
const workflows = [
  { id: 'mxrYb3maJS31gEYC', file: 'workflows/n8n_하루건강약사_수동실행.json' },
  { id: 'baekse100Life01', file: 'workflows/n8n_geongangjangsubigyeol_manual.json' },
];

function scenario(workflow, { youtube, resultStage }) {
  const code = (name) => workflow.nodes.find((n) => n.name === name).parameters.jsCode;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'consume-'));
  const pending = path.join(tmp, 'pending');
  const used = path.join(tmp, 'used');
  fs.mkdirSync(pending, { recursive: true });
  const topicFile = path.join(pending, 'topic-a.json');
  fs.writeFileSync(topicFile, JSON.stringify({ title: '준비된 주제 A', lane: 'food_nutrition_table' }), 'utf8');
  fs.writeFileSync(path.join(pending, 'topic-b.json'), JSON.stringify({ title: '준비된 주제 B', lane: 'food_nutrition_table' }), 'utf8');

  const loaded = new Function('require', '$input', code('Load Config'))(require, {
    first: () => ({ json: {
      dry_run: false,
      topic_pending_dir: pending,
      topic_used_dir: used,
      topic_queue_path: path.join(tmp, 'queue.txt'),
      topic_queue_used_log_path: path.join(tmp, 'used.jsonl'),
      upload_log_path: path.join(tmp, 'upload.jsonl'),
    } }),
  })[0].json;

  // Picking must never consume on its own: a crash after this point must be retriable.
  assert.equal(fs.existsSync(topicFile), true, 'Load Config consumed the topic before upload');
  assert.equal(loaded.topic_queue.consumed, false, 'Load Config reported a consume it did not perform');

  new Function('require', '$input', code('Final Result'))(require, {
    first: () => ({ json: {
      config: loaded.config,
      topic_queue: loaded.topic_queue,
      pack: { hook_title: '준비된 주제 A', rank_items: [] },
      medical_review: { pass: true },
      rendered_video_url: 'https://example.invalid/render.mp4',
      diversity: { bgm_profile: { id: 'intimate_felt_piano' } },
      youtube,
      comment: { skipped: true },
      ...(resultStage ? { result_stage: resultStage } : {}),
    } }),
  });

  const stillQueued = fs.existsSync(topicFile);
  const movedFiles = fs.existsSync(used) ? fs.readdirSync(used) : [];
  const uploadLog = fs.existsSync(path.join(tmp, 'upload.jsonl'))
    ? fs.readFileSync(path.join(tmp, 'upload.jsonl'), 'utf8').trim().split('\n').filter(Boolean).length
    : 0;
  fs.rmSync(tmp, { recursive: true, force: true });
  return { stillQueued, moved: movedFiles.length, uploadLog, pickedTitle: loaded.topic_queue.selected?.title };
}

for (const target of workflows) {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, target.file), 'utf8'));

  // Oldest file first, one per run.
  const success = scenario(workflow, { youtube: { url: 'https://youtu.be/abc123', video_id: 'abc123', privacy_status: 'public' } });
  assert.equal(success.pickedTitle, '준비된 주제 A', `${target.id}: queue must serve the oldest topic first`);
  assert.equal(success.stillQueued, false, `${target.id}: a successfully uploaded topic must leave the queue`);
  assert.equal(success.moved, 1, `${target.id}: the uploaded topic must be archived exactly once`);
  assert.equal(success.uploadLog, 1, `${target.id}: a successful upload must be logged`);

  // Upload skipped: nothing was published, so the topic must survive.
  const skipped = scenario(workflow, { youtube: { skipped: true, reason: 'upload_disabled' } });
  assert.equal(skipped.stillQueued, true, `${target.id}: a skipped upload must not consume the topic`);
  assert.equal(skipped.moved, 0, `${target.id}: a skipped upload must not archive the topic`);
  assert.equal(skipped.uploadLog, 0, `${target.id}: a skipped upload must not be logged as an upload`);

  // Upload node failed and produced no url: the topic must survive for a retry.
  const failed = scenario(workflow, { youtube: {} });
  assert.equal(failed.stillQueued, true, `${target.id}: a failed upload must not consume the topic`);
  assert.equal(failed.moved, 0, `${target.id}: a failed upload must not archive the topic`);

  // Blocked by review before any upload: the topic must survive.
  const blocked = scenario(workflow, { youtube: { skipped: true, reason: 'content_quality_failed' }, resultStage: 'blocked_by_content_quality' });
  assert.equal(blocked.stillQueued, true, `${target.id}: a blocked run must not consume the topic`);
  assert.equal(blocked.moved, 0, `${target.id}: a blocked run must not archive the topic`);

  // Crash-after-upload recovery: the video is already public but the topic was
  // never consumed. The next run must detect it, skip re-uploading, and release
  // the topic instead of publishing a duplicate.
  const attachCode = workflow.nodes.find((n) => n.name === 'Attach Downloaded MP4').parameters.jsCode;
  const skipCode = workflow.nodes.find((n) => n.name === 'Skip YouTube Upload').parameters.jsCode;
  const finalCodeForRecovery = workflow.nodes.find((n) => n.name === 'Final Result').parameters.jsCode;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'recover-'));
  const pending = path.join(tmp, 'pending');
  const used = path.join(tmp, 'used');
  fs.mkdirSync(pending, { recursive: true });
  const topicFile = path.join(pending, 'topic-a.json');
  fs.writeFileSync(topicFile, JSON.stringify({ title: '이미 올라간 주제', lane: 'food_nutrition_table' }), 'utf8');
  const uploadLog = path.join(tmp, 'upload.jsonl');
  fs.writeFileSync(uploadLog, JSON.stringify({
    date_kst: '2026-07-21', status: 'uploaded_public', title: '이미 올라간 주제',
    url: 'https://youtu.be/already1', video_id: 'already1', uploaded_at: '2026-07-21T00:00:00.000Z',
  }) + '\n', 'utf8');

  const cfg = {
    allow_youtube_upload: true, dry_run: false, test_mode: false,
    upload_log_path: uploadLog, topic_used_dir: used,
    topic_queue_used_log_path: path.join(tmp, 'used.jsonl'),
  };
  const topicQueue = {
    selected: { id: 't1', title: '이미 올라간 주제', source: 'topic_file', source_file: topicFile, picked_at: '2026-07-21T01:00:00.000Z' },
    used_dir: used, used_log_path: path.join(tmp, 'used.jsonl'), remaining_before: 1, consumed: false,
  };
  const renderBase = { config: cfg, topic_queue: topicQueue, pack: { hook_title: '이미 올라간 주제', rank_items: [] } };

  const attached = new Function('require', '$', '$input', attachCode)(
    require,
    () => ({ first: () => ({ json: renderBase }) }),
    { first: () => ({ binary: { data: {} } }) },
  )[0].json;
  assert.equal(attached.upload_guard.acquired, false, `${target.id}: an already-published topic must not reach the upload node again`);
  assert.equal(attached.upload_guard.reason, 'already_uploaded', `${target.id}: the duplicate must be identified as already uploaded`);
  assert.equal(attached.upload_guard.already_uploaded.url, 'https://youtu.be/already1', `${target.id}: the earlier upload url must be recovered`);
  assert.equal(fs.existsSync(`${uploadLog}.upload.lock`), false, `${target.id}: the duplicate path must not take the upload lock`);

  const skipped2 = new Function('$input', skipCode)({ first: () => ({ json: attached }) })[0].json;
  assert.equal(skipped2.result_stage, 'skipped_already_uploaded', `${target.id}: the duplicate run must report why it skipped`);
  assert.equal(skipped2.youtube.skipped, true, `${target.id}: the duplicate run must not claim a new upload`);

  new Function('require', '$input', finalCodeForRecovery)(require, { first: () => ({ json: { ...skipped2, medical_review: { pass: true } } }) });
  assert.equal(fs.existsSync(topicFile), false, `${target.id}: an already-published topic must be released from the queue`);
  assert.equal(fs.readdirSync(used).length, 1, `${target.id}: the recovered topic must be archived exactly once`);
  fs.rmSync(tmp, { recursive: true, force: true });

  // The consume step must be guarded by a real upload url in the node source.
  const finalCode = workflow.nodes.find((n) => n.name === 'Final Result').parameters.jsCode;
  assert.match(finalCode, /if \(!publishedUrl\) return;/, `${target.id}: consume is not gated on a real published url`);
  assert.match(finalCode, /catch \(error\) \{\s*topicQueue\.consume_error/, `${target.id}: a consume failure must not crash the run`);

  // Picking must stay non-destructive.
  const loadCode = workflow.nodes.find((n) => n.name === 'Load Config').parameters.jsCode;
  assert.match(loadCode, /consume: false/, `${target.id}: Load Config must not consume the topic at pick time`);
}

console.log('PASS: prepared topics are consumed once, only after a real upload, and survive every failure path');
