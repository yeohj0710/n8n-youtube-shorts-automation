import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sqlite3 from 'sqlite3';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const dbPath = path.join(root, '.n8n', 'database.sqlite');
const targets = [
  { id: 'mxrYb3maJS31gEYC', file: path.join(root, 'workflows', 'n8n_하루건강약사_수동실행.json') },
  { id: 'baekse100Life01', file: path.join(root, 'workflows', 'n8n_geongangjangsubigyeol_manual.json') },
];

const attachCode = `const fs = require('fs');
const path = require('path');
const base = $('Parse Local Render Result').first().json;
const input = $input.first();
const cfg = base.config || {};
const guardEnabled = Boolean(cfg.allow_youtube_upload && !cfg.dry_run && !cfg.test_mode);
const lockPath = String(cfg.upload_log_path || '').trim() + '.upload.lock';
const token = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
const ttlMs = 10 * 60 * 1000;
let uploadGuard = { version: 'upload_guard_v1', acquired: !guardEnabled, enabled: guardEnabled, lock_path: lockPath || null, token: null, reason: guardEnabled ? 'not_acquired' : 'not_required' };

function tryAcquire() {
  if (!guardEnabled) return;
  if (!lockPath) throw new Error('Upload guard requires config.upload_log_path.');
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  try {
    const fd = fs.openSync(lockPath, 'wx');
    fs.writeFileSync(fd, JSON.stringify({ token, acquired_at: new Date().toISOString() }), 'utf8');
    fs.closeSync(fd);
    uploadGuard = { ...uploadGuard, acquired: true, token, reason: 'acquired' };
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    let stale = false;
    try {
      const existing = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      stale = Date.now() - Date.parse(existing.acquired_at || 0) > ttlMs;
    } catch (readError) {
      stale = Date.now() - fs.statSync(lockPath).mtimeMs > ttlMs;
    }
    if (stale) {
      fs.unlinkSync(lockPath);
      return tryAcquire();
    }
    uploadGuard = { ...uploadGuard, acquired: false, reason: 'overlapping_upload_in_progress' };
  }
}

tryAcquire();
return [{ json: { ...base, mp4_binary_ready: !!input.binary?.data, upload_guard: uploadGuard }, binary: input.binary }];`;

const normalizeCode = `const fs = require('fs');
const base = $('Attach Downloaded MP4').first().json;
const upload = $input.first().json || {};
const videoId = upload.uploadId || upload.id || upload.videoId || upload.items?.[0]?.id || null;
const privacyStatus = base.config?.youtube_privacy_status || 'public';
const guard = base.upload_guard || {};
if (guard.acquired && guard.lock_path && guard.token) {
  try {
    const current = JSON.parse(fs.readFileSync(guard.lock_path, 'utf8'));
    if (current.token === guard.token) fs.unlinkSync(guard.lock_path);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}
return [{ json: { ...base, upload_guard: { ...guard, released: true }, youtube: { skipped: false, privacy_status: privacyStatus, video_id: videoId, url: videoId ? 'https://www.youtube.com/watch?v=' + videoId : null, raw: upload } } }];`;

const skipCode = `const data = $input.first().json;
const dryRun = Boolean(data.config?.test_mode || data.config?.dry_run);
if (data.upload_guard?.reason === 'overlapping_upload_in_progress') {
  return [{ json: { ...data, result_stage: 'skipped_overlapping_upload', youtube: { skipped: true, reason: 'overlapping_upload_in_progress' }, comment: { skipped: true, reason: 'No YouTube upload' } } }];
}
if (!dryRun) {
  throw new Error('Live run reached Skip YouTube Upload. Check Load Config: allow_youtube_upload must be true, upload guard must be acquired, and rendered_video_url must exist.');
}
return [{
  json: {
    ...data,
    result_stage: 'dry_run_no_upload',
    youtube: { skipped: true, reason: 'dry_run: youtube upload skipped', privacy_status_if_enabled: data.config.youtube_privacy_status },
    comment: { skipped: true, reason: 'No YouTube upload' }
  }
}];`;

function patch(workflow) {
  const byName = new Map(workflow.nodes.map((node) => [node.name, node]));
  byName.get('Attach Downloaded MP4').parameters.jsCode = attachCode;
  byName.get('Allow YouTube Upload?').parameters.conditions.boolean[0].value1 = '={{$json.config.allow_youtube_upload && $json.upload_guard?.acquired === true}}';
  byName.get('Normalize YouTube Upload').parameters.jsCode = normalizeCode;
  byName.get('Skip YouTube Upload').parameters.jsCode = skipCode;
  workflow.versionId = randomUUID();
  workflow.updatedAt = new Date().toISOString();
  return workflow;
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
}
function run(db, sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function done(error) { error ? reject(error) : resolve(this.changes); }));
}

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
const backupDir = path.join(root, 'etc', `backup-before-overlapping-upload-guard-${stamp}`);
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(dbPath, path.join(backupDir, 'database.sqlite'));
for (const target of targets) fs.copyFileSync(target.file, path.join(backupDir, path.basename(target.file)));

const db = new sqlite3.Database(dbPath);
try {
  for (const target of targets) {
    const workflow = patch(JSON.parse(fs.readFileSync(target.file, 'utf8')));
    fs.writeFileSync(target.file, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
    const row = await get(db, 'SELECT nodes FROM workflow_entity WHERE id = ?', [target.id]);
    if (!row) throw new Error(`Live workflow not found: ${target.id}`);
    const live = patch({ nodes: JSON.parse(row.nodes) });
    const changes = await run(db, 'UPDATE workflow_entity SET nodes = ?, versionId = ?, updatedAt = ? WHERE id = ?', [JSON.stringify(live.nodes), randomUUID(), new Date().toISOString(), target.id]);
    if (changes !== 1) throw new Error(`Unexpected update count for ${target.id}: ${changes}`);
  }
} finally {
  db.close();
}

console.log(JSON.stringify({ ok: true, workflowIds: targets.map((target) => target.id), backupDir }, null, 2));
