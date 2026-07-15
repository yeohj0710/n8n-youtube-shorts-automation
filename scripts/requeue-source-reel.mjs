import fs from 'node:fs';
import path from 'node:path';

const sourceId = process.argv[2];
const reason = process.argv.slice(3).join(' ') || 'manual_requeue';
if (!sourceId) throw new Error('usage: node scripts/requeue-source-reel.mjs SOURCE_ID');
const root = 'C:/dev/n8n-youtube-shorts-automation';
const bundleRoot = path.join(root, 'data/source-reel-bundles');
const bundle = fs.readdirSync(bundleRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(bundleRoot, entry.name)).find((dir) => JSON.parse(fs.readFileSync(path.join(dir, 'source.json'), 'utf8')).source_id === sourceId);
if (!bundle) throw new Error(`bundle not found: ${sourceId}`);
const manifestPath = path.join(bundle, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
const topicRoot = manifest.exported_channel === 'health_longevity' ? path.join(root, '건강장수비결 소재') : path.join(root, '하루건강약사 소재');
function findMd(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { const found = findMd(file); if (found) return found; }
    else if (entry.name.endsWith('.md') && fs.readFileSync(file, 'utf8').includes(`SOURCE_ID=${sourceId}`)) return file;
  }
  return null;
}
const md = findMd(topicRoot);
if (!md) throw new Error(`topic MD not found: ${sourceId}`);
const pending = path.join(topicRoot, path.basename(md));
if (path.resolve(md) !== path.resolve(pending)) fs.renameSync(md, pending);
manifest.rejected_upload = { url: manifest.youtube_url || null, rejected_at: new Date().toISOString(), reason };
manifest.status = 'md_ready';
manifest.youtube_url = null;
manifest.youtube_video_id = null;
manifest.upload_stage = null;
manifest.render_claimed_at = null;
manifest.exported_topic_md = pending.replace(/\\/g, '/');
manifest.updated_at = new Date().toISOString();
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
const lock = path.join(bundle, '.render-claim.lock');
try { fs.unlinkSync(lock); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
console.log(JSON.stringify({ ok: true, source_id: sourceId, status: manifest.status, topic_md: manifest.exported_topic_md }));
