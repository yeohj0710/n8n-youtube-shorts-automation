import fs from 'node:fs';
import path from 'node:path';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const bundleRoot = path.join(root, 'data/source-reel-bundles');
const topicDirs = [path.join(root, '하루건강약사 소재'), path.join(root, '건강장수비결 소재')];
const bundles = new Map();

for (const entry of fs.readdirSync(bundleRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = path.join(bundleRoot, entry.name);
  const source = JSON.parse(fs.readFileSync(path.join(dir, 'source.json'), 'utf8').replace(/^\uFEFF/, ''));
  bundles.set(source.source_id, dir);
}

const mdBySource = new Map();
for (const topicDir of topicDirs) {
  for (const name of fs.readdirSync(topicDir)) {
    if (!name.endsWith('.md')) continue;
    const file = path.join(topicDir, name);
    let text = fs.readFileSync(file, 'utf8');
    const sourceId = text.match(/^SOURCE_ID=(.+)$/m)?.[1]?.trim();
    if (!sourceId || !bundles.has(sourceId)) continue;
    const localBundle = bundles.get(sourceId).replace(/\\/g, '/');
    text = text.replace(/^SOURCE_BUNDLE=.*$/m, `SOURCE_BUNDLE=${localBundle}`);
    fs.writeFileSync(file, text, 'utf8');
    mdBySource.set(sourceId, file);
  }
}

for (const [sourceId, dir] of bundles) {
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
  manifest.bundle_dir = dir.replace(/\\/g, '/');
  if (mdBySource.has(sourceId)) manifest.exported_topic_md = mdBySource.get(sourceId).replace(/\\/g, '/');
  manifest.localized_at = new Date().toISOString();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

console.log(JSON.stringify({ ok: true, bundles: bundles.size, topic_mds: mdBySource.size, bundle_root: bundleRoot.replace(/\\/g, '/') }));
