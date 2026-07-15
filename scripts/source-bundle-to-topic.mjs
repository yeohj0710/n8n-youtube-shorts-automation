import fs from 'node:fs';
import path from 'node:path';
import { validateBundle } from './validate-source-bundle.mjs';

const projectRoot = 'C:/dev/n8n-youtube-shorts-automation';
const channels = JSON.parse(fs.readFileSync(path.join(projectRoot, 'config/source-channels.json'), 'utf8'));
const bundleArg = process.argv.find((arg) => arg.startsWith('--bundle='));
const channelArg = process.argv.find((arg) => arg.startsWith('--channel='));
if (!bundleArg || !channelArg) throw new Error('--bundle=ABSOLUTE_PATH and --channel=CHANNEL_ID are required');
const bundleDir = path.resolve(bundleArg.slice('--bundle='.length));
const channelId = channelArg.slice('--channel='.length);
const channel = channels[channelId];
if (!channel) throw new Error(`Unknown channel: ${channelId}`);
const validation = validateBundle(bundleDir);
if (!validation.pass) throw new Error(`Source bundle validation failed: ${validation.issues.join(', ')}`);
const { brief, source } = validation;

function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function slug(value) { return clean(value).replace(/[^a-zA-Z0-9가-힣_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 70); }
function escapeLine(value) { return clean(value).replace(/\|/g, '／'); }
function uniquePath(file) {
  if (!fs.existsSync(file)) return file;
  const parsed = path.parse(file);
  for (let index = 2; ; index += 1) {
    const candidate = path.join(parsed.dir, `${parsed.name} (${index})${parsed.ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
}
function atomicText(file, text) {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, text, 'utf8');
  fs.renameSync(temp, file);
}

const tags = [...new Set([...(brief.tags || []), ...(channel.default_tags || [])])].slice(0, 10);
const lines = [
  `title: ${clean(brief.title)}`,
  `subtitle: ${clean(brief.subtitle)}`,
  `lane: ${clean(brief.lane)}`,
  `tags: ${tags.join(', ')}`,
  `rank_count: ${brief.rank_items.length}`,
  'ranks:',
  ...brief.rank_items.map((item, index) => `${index + 1}. ${escapeLine(item.name)} | ${escapeLine(item.reason)} | ${escapeLine(item.caution)}`),
  'notes:',
  'LOCKED_SOURCE_PACK=1',
  `SOURCE_ID=${source.source_id}`,
  `SOURCE_URL=${source.canonical_url || source.source_url}`,
  `SOURCE_BUNDLE=${bundleDir.replace(/\\/g, '/')}`,
  `CORE_MESSAGE=${clean(brief.core_message)}`,
  `VISUAL_DIRECTION=${clean(brief.visual_direction?.composition)} / ${clean(brief.visual_direction?.mood)}`,
  `EVIDENCE=${brief.rank_items.map((item) => `${item.rank}:${item.evidence_ids.join('+')}`).join(',')}`,
  '',
];
const outputArg = process.argv.find((arg) => arg.startsWith('--output-dir='));
const outputDir = outputArg ? path.resolve(outputArg.slice('--output-dir='.length)) : channel.topic_dir;
fs.mkdirSync(outputDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const target = uniquePath(path.join(outputDir, `${stamp}-${slug(brief.title)}-${source.source_id}.md`));
atomicText(target, lines.join('\n'));
const manifestPath = path.join(bundleDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
atomicText(manifestPath, JSON.stringify({
  ...manifest,
  status: 'md_ready',
  exported_channel: channelId,
  exported_topic_md: target.replace(/\\/g, '/'),
  updated_at: new Date().toISOString(),
}, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, channel_id: channelId, topic_md: target.replace(/\\/g, '/'), source_id: source.source_id }));
