import fs from 'node:fs';
import path from 'node:path';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const topicDir = path.join(root, '건강장수비결 소재');
const usedDir = path.join(topicDir, '사용완료');
const bundleRoot = path.join(root, 'data/source-reel-bundles');
const accepted = new Map([
  ['instagram_DYjtl7SvB71', 'https://www.youtube.com/watch?v=auHrDUDukYs'],
  ['instagram_DYoxRLmAQuN', 'https://www.youtube.com/watch?v=FXZPQVVZXlw'],
]);
fs.mkdirSync(usedDir, { recursive: true });
for (const [sourceId, url] of accepted) {
  const mdName = fs.readdirSync(topicDir).find((name) => name.endsWith('.md') && fs.readFileSync(path.join(topicDir, name), 'utf8').includes(`SOURCE_ID=${sourceId}`));
  if (!mdName) throw new Error(`pending MD not found: ${sourceId}`);
  fs.renameSync(path.join(topicDir, mdName), path.join(usedDir, mdName));
  const bundle = fs.readdirSync(bundleRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(bundleRoot, entry.name)).find((dir) => JSON.parse(fs.readFileSync(path.join(dir, 'source.json'), 'utf8')).source_id === sourceId);
  if (!bundle) throw new Error(`bundle not found: ${sourceId}`);
  const manifestPath = path.join(bundle, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
  manifest.status = 'uploaded';
  manifest.youtube_url = url;
  manifest.accepted_existing_upload = true;
  manifest.comment_status = 'manual_pending';
  manifest.exported_topic_md = path.join(usedDir, mdName).replace(/\\/g, '/');
  manifest.updated_at = new Date().toISOString();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}
console.log(JSON.stringify({ ok: true, accepted: accepted.size }));
