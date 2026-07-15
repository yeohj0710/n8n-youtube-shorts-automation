import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sqlite3 from 'sqlite3';

const projectRoot = 'C:/dev/n8n-youtube-shorts-automation';
const config = JSON.parse(fs.readFileSync(path.join(projectRoot, 'config/source-pipeline.json'), 'utf8'));
const pythonRoot = path.dirname(config.python_path);
const cudaDllDir = path.join(pythonRoot, 'Lib', 'site-packages', 'nvidia', 'cublas', 'bin');
const transcriptionPath = fs.existsSync(cudaDllDir)
  ? `${cudaDllDir}${path.delimiter}${process.env.PATH || ''}`
  : process.env.PATH;

function dbOpen() {
  fs.mkdirSync(path.dirname(config.state_db), { recursive: true });
  return new sqlite3.Database(config.state_db);
}

function runDb(db, sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function done(error) {
    if (error) reject(error); else resolve({ changes: this.changes, lastID: this.lastID });
  }));
}

function allDb(db, sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}

function getDb(db, sql, params = []) {
  return new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
}

function atomicJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  fs.renameSync(temp, file);
}

function setupFolders() {
  for (const dir of [config.root_dir, path.dirname(config.queue_file), config.items_dir, config.failed_dir]) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(config.queue_file)) fs.writeFileSync(config.queue_file, '# 링크를 한 줄에 하나씩 붙여넣으세요.\n', 'utf8');
}

function cleanUrl(raw) {
  return String(raw || '').trim().replace(/[),.;!?]+$/, '');
}

export function canonicalizeUrl(raw) {
  const value = cleanUrl(raw);
  const parsed = new URL(value);
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (host === 'youtu.be' && parts[0]) return `https://www.youtube.com/watch?v=${parts[0]}`;
  if (host.endsWith('youtube.com')) {
    const id = parsed.searchParams.get('v') || (['shorts', 'embed', 'live'].includes(parts[0]) ? parts[1] : '');
    if (id) return `https://www.youtube.com/watch?v=${id}`;
  }
  if (host.endsWith('instagram.com') && parts.length >= 2 && ['reel', 'reels', 'p', 'tv'].includes(parts[0])) {
    const kind = parts[0] === 'reels' ? 'reel' : parts[0];
    return `https://www.instagram.com/${kind}/${parts[1]}/`;
  }
  throw new Error(`Unsupported YouTube/Instagram URL: ${value}`);
}

export function sourceIdFromUrl(url) {
  const parsed = new URL(canonicalizeUrl(url));
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parsed.hostname.includes('youtube.com')) return `youtube_${parsed.searchParams.get('v')}`;
  if (parsed.hostname.includes('instagram.com')) return `instagram_${parts[1]}`;
  return `source_${crypto.createHash('sha256').update(url).digest('hex').slice(0, 16)}`;
}

function parseQueueLine(line) {
  const text = line.trim();
  if (!text || text.startsWith('#')) return null;
  const match = text.match(/^\[([a-z0-9_-]+)\]\s+(https?:\/\/\S+)/i);
  const urlMatch = text.match(/https?:\/\/\S+/i);
  if (!urlMatch) return null;
  const canonical = canonicalizeUrl(urlMatch[0]);
  return { channel_hint: match?.[1] || '', url: urlMatch[0], canonical_url: canonical, source_id: sourceIdFromUrl(canonical) };
}

async function initDb(db) {
  await runDb(db, `CREATE TABLE IF NOT EXISTS source_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    canonical_url TEXT NOT NULL,
    channel_hint TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'queued',
    bundle_dir TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    error_json TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`);
}

async function importQueue(db) {
  setupFolders();
  const lines = fs.readFileSync(config.queue_file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  let inserted = 0;
  const errors = [];
  for (const [index, line] of lines.entries()) {
    let job;
    try { job = parseQueueLine(line); } catch (error) { errors.push({ line: index + 1, message: error.message }); continue; }
    if (!job) continue;
    const bundleDir = path.join(config.items_dir, job.source_id);
    const result = await runDb(db, `INSERT OR IGNORE INTO source_jobs (source_id,url,canonical_url,channel_hint,bundle_dir) VALUES (?,?,?,?,?)`, [job.source_id, job.url, job.canonical_url, job.channel_hint, bundleDir]);
    inserted += result.changes;
  }
  return { inserted, errors };
}

function spawnJson(file, args, options = {}) {
  const result = spawnSync(file, args.map(String), {
    cwd: options.cwd || projectRoot,
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    timeout: options.timeout || 60 * 60 * 1000,
    windowsHide: true,
    maxBuffer: 30 * 1024 * 1024,
  });
  const output = String(result.stdout || '').trim();
  let payload = null;
  for (const candidate of output.split(/[\r\n]+/).filter(Boolean).reverse()) {
    const start = candidate.indexOf('{');
    if (start < 0) continue;
    try { payload = JSON.parse(candidate.slice(start)); break; } catch {}
  }
  if (result.error || result.status !== 0 || payload?.ok === false) {
    throw new Error(payload?.message || result.error?.message || String(result.stderr || output || `${file} exited ${result.status}`));
  }
  if (!payload) throw new Error(`Process returned no JSON payload: ${String(result.stderr || output).slice(-1200)}`);
  return payload;
}

function baseManifest(job, status, extra = {}) {
  return {
    schema_version: '1.0',
    job_id: job.id,
    source_id: job.source_id,
    source_url: job.canonical_url,
    channel_hint: job.channel_hint || null,
    status,
    bundle_dir: job.bundle_dir.replace(/\\/g, '/'),
    updated_at: new Date().toISOString(),
    ...extra,
  };
}

async function processJob(db, job) {
  const bundleDir = job.bundle_dir;
  fs.mkdirSync(bundleDir, { recursive: true });
  const manifestPath = path.join(bundleDir, 'manifest.json');
  await runDb(db, `UPDATE source_jobs SET status='downloading',attempts=attempts+1,error_json=NULL,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`, [job.id]);
  atomicJson(manifestPath, baseManifest(job, 'downloading'));
  try {
    const extract = spawnJson(config.python_path, [
      '-m', 'youtube_instagram_media_extractor.batch_cli', 'download',
      '--url', job.canonical_url,
      '--output-dir', bundleDir,
      '--video-quality', config.video_quality,
      '--cookie-browser', config.cookie_browser,
      '--json',
    ], { cwd: config.extractor_project, env: { PYTHONPATH: path.join(config.extractor_project, 'src'), FFMPEG_BINARY: config.ffmpeg_path, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
    atomicJson(manifestPath, baseManifest(job, 'downloaded', { artifacts: { source_json: extract.source_json, caption_file: extract.caption_file, media_file: extract.media_file } }));
    await runDb(db, `UPDATE source_jobs SET status='transcribing',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`, [job.id]);

    const transcript = spawnJson(config.python_path, [
      path.join(projectRoot, 'scripts/transcribe-source-media.py'),
      '--input', path.join(bundleDir, 'source.mp4'),
      '--audio-output', path.join(bundleDir, 'audio.wav'),
      '--output', path.join(bundleDir, 'transcript.json'),
      '--ffmpeg', config.ffmpeg_path,
      '--model', config.whisper_model,
      '--language', config.whisper_language,
      '--device', 'cuda',
      '--compute-type', 'float16',
    ], { timeout: 2 * 60 * 60 * 1000, env: { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', PATH: transcriptionPath } });

    await runDb(db, `UPDATE source_jobs SET status='keyframes',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`, [job.id]);
    const keyframePayload = Buffer.from(JSON.stringify({
      media_path: path.join(bundleDir, 'source.mp4'),
      keyframe_dir: path.join(bundleDir, 'keyframes'),
      contact_sheet_path: path.join(bundleDir, 'contact-sheet.jpg'),
      ffmpeg_path: config.ffmpeg_path,
      max_frames: config.max_keyframes,
    }), 'utf8').toString('base64');
    const keyframes = spawnJson(process.execPath, [path.join(projectRoot, 'scripts/extract-source-keyframes.mjs'), keyframePayload]);
    const source = JSON.parse(fs.readFileSync(path.join(bundleDir, 'source.json'), 'utf8'));
    const captionSentences = String(source.caption || '').split(/(?<=[.!?。！？])\s+|\n+/).map((text) => text.trim()).filter(Boolean).map((text, index) => ({ id: `c${String(index + 1).padStart(4, '0')}`, text }));
    atomicJson(path.join(bundleDir, 'evidence.json'), { schema_version: '1.0', caption_sentences: captionSentences, transcript_file: 'transcript.json' });
    const finalManifest = baseManifest(job, 'prepared', {
      source_title: source.title,
      creator_name: source.creator_name,
      artifacts: {
        source_json: 'source.json', caption_file: 'caption.txt', media_file: 'source.mp4', audio_file: 'audio.wav',
        transcript_file: 'transcript.json', evidence_file: 'evidence.json', contact_sheet: 'contact-sheet.jpg', keyframe_dir: 'keyframes',
      },
      transcript_segments: transcript.segments,
      keyframes: keyframes.frames.length,
    });
    atomicJson(manifestPath, finalManifest);
    await runDb(db, `UPDATE source_jobs SET status='prepared',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`, [job.id]);
    return finalManifest;
  } catch (error) {
    const failure = baseManifest(job, 'failed', { stage: 'prepare', error: error.message });
    atomicJson(manifestPath, failure);
    atomicJson(path.join(config.failed_dir, `${job.source_id}.json`), failure);
    await runDb(db, `UPDATE source_jobs SET status='failed',error_json=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`, [JSON.stringify(failure), job.id]);
    return failure;
  }
}

async function main() {
  const command = process.argv[2] || 'status';
  const db = dbOpen();
  try {
    await initDb(db);
    if (command === 'setup') {
      setupFolders();
      console.log(JSON.stringify({ ok: true, root_dir: config.root_dir, queue_file: config.queue_file }));
      return;
    }
    if (command === 'import') {
      console.log(JSON.stringify({ ok: true, ...(await importQueue(db)) }));
      return;
    }
    if (command === 'retry') {
      const id = Number(process.argv[3]);
      const result = await runDb(db, `UPDATE source_jobs SET status='queued',error_json=NULL,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='failed'`, [id]);
      console.log(JSON.stringify({ ok: true, retried: result.changes }));
      return;
    }
    if (command === 'recover') {
      const id = Number(process.argv[3]);
      const result = await runDb(db, `UPDATE source_jobs SET status='queued',error_json=NULL,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status IN ('downloading','transcribing','keyframes')`, [id]);
      console.log(JSON.stringify({ ok: true, recovered: result.changes }));
      return;
    }
    if (command === 'run') {
      const imported = await importQueue(db);
      const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
      const limit = Math.max(1, Number(limitArg?.split('=')[1] || 100));
      const jobs = await allDb(db, `SELECT * FROM source_jobs WHERE status='queued' ORDER BY id LIMIT ?`, [limit]);
      const results = [];
      for (const job of jobs) results.push(await processJob(db, job));
      console.log(JSON.stringify({ ok: results.every((item) => item.status !== 'failed'), imported, processed: results.length, results }));
      return;
    }
    const rows = await allDb(db, `SELECT status,COUNT(*) AS count FROM source_jobs GROUP BY status ORDER BY status`);
    const next = await getDb(db, `SELECT id,source_id,status,bundle_dir FROM source_jobs WHERE status IN ('queued','failed','prepared') ORDER BY id LIMIT 1`);
    const active = await allDb(db, `SELECT id,source_id,status,bundle_dir,updated_at FROM source_jobs WHERE status IN ('downloading','transcribing','keyframes') ORDER BY id`);
    console.log(JSON.stringify({ ok: true, queue_file: config.queue_file, counts: rows, active, next: next || null }));
  } finally {
    db.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) await main();
