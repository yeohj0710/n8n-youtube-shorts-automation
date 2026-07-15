import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const bundleRoot = path.join(root, 'data/source-reel-bundles');
const required = ['source.mp4','source.json','caption.txt','audio.wav','transcript.json','evidence.json','content-brief.json','contact-sheet.jpg','manifest.json'];
const dirs = fs.readdirSync(bundleRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(bundleRoot, entry.name));
if (dirs.length === 0) throw new Error('no local source bundles found');
const sourceIds = new Set();
for (const dir of dirs) {
  for (const name of required) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) throw new Error(`missing local artifact: ${file}`);
  }
  const frames = fs.readdirSync(path.join(dir, 'keyframes')).filter((name) => name.endsWith('.jpg'));
  if (frames.length !== 8) throw new Error(`expected 8 keyframes: ${dir}`);
  const source = JSON.parse(fs.readFileSync(path.join(dir, 'source.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  if (!source.source_id || manifest.source_id !== source.source_id) throw new Error(`source/manifest ID mismatch: ${dir}`);
  if (sourceIds.has(source.source_id)) throw new Error(`duplicate source ID: ${source.source_id}`);
  sourceIds.add(source.source_id);
  if (!String(manifest.bundle_dir).startsWith(bundleRoot.replace(/\\/g, '/'))) throw new Error(`non-local manifest bundle: ${dir}`);
  if (/^[Gg]:\//.test(String(manifest.bundle_dir))) throw new Error(`G drive manifest path: ${dir}`);
  if (manifest.status === 'md_ready' && (!manifest.youtube_hook_title || manifest.youtube_hook_title.length > 70)) throw new Error(`missing or invalid curated YouTube title: ${dir}`);
  if (manifest.status === 'md_ready' && manifest.content_mode !== 'SOURCE_GROUNDED_DETAIL') throw new Error(`pending bundle is not detailed-source locked: ${dir}`);
  const lockExists = fs.existsSync(path.join(dir, '.render-claim.lock'));
  if (lockExists && manifest.status !== 'render_claimed') throw new Error(`orphan render claim lock: ${dir}`);
  if (!lockExists && manifest.status === 'render_claimed') throw new Error(`render claim missing lock: ${dir}`);
}
const topicDirs = [path.join(root, '하루건강약사 소재'), path.join(root, '건강장수비결 소재')];
const mdIds = new Set();
function mdFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? mdFiles(path.join(dir, entry.name)) : (entry.name.endsWith('.md') ? [path.join(dir, entry.name)] : []));
}
for (const topicDir of topicDirs) for (const file of mdFiles(topicDir)) {
  const name = path.basename(file);
  const text = fs.readFileSync(file, 'utf8');
  const sourceId = text.match(/^SOURCE_ID=(.+)$/m)?.[1]?.trim();
  const bundle = text.match(/^SOURCE_BUNDLE=(.+)$/m)?.[1]?.trim();
  if (!sourceId) continue;
  if (!bundle) throw new Error(`invalid source topic MD: ${name}`);
  if (!bundle.startsWith(bundleRoot.replace(/\\/g, '/')) || /^[Gg]:\//.test(bundle)) throw new Error(`non-local topic MD: ${name}`);
  if (!fs.existsSync(bundle)) throw new Error(`topic bundle missing: ${bundle}`);
  mdIds.add(sourceId);
  if (!file.includes(`${path.sep}사용완료${path.sep}`) && (!text.includes('SOURCE_DETAIL_BEGIN') || !text.includes('## 항목별 원본 근거 상세') || !text.includes('## 원본 캡션 전문') || !text.includes('## 원본 전사 전문'))) throw new Error(`pending source MD lacks detailed evidence: ${name}`);
  if (!file.includes(`${path.sep}사용완료${path.sep}`) && !text.includes('CONTENT_MODE=SOURCE_GROUNDED_DETAIL')) throw new Error(`pending source MD is not detailed-source locked: ${name}`);
  if (!text.includes('EDITORIAL_PRIORITY=') || !text.includes('VISIBLE_COPY_BUDGET=')) throw new Error(`source MD lacks sparse editorial policy: ${name}`);
}
if (dirs.length !== sourceIds.size || sourceIds.size !== mdIds.size) throw new Error(`count mismatch bundles=${dirs.length} sourceIds=${sourceIds.size} mdIds=${mdIds.size}`);
const canonicalWorkflowFiles = [
  path.join(root, 'workflows/n8n_source_reel_longevity_manual.json'),
  path.join(root, 'workflows/n8n_source_reel_haru_manual.json'),
];
const canonicalWorkflows = canonicalWorkflowFiles.map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
const canonicalById = new Map(canonicalWorkflows.map((workflow) => [workflow.id, workflow]));
const db = new sqlite3.Database('.n8n/database.sqlite');
const placeholders = canonicalWorkflows.map(() => '?').join(',');
const rows = await new Promise((resolve, reject) => db.all(
  `SELECT id,name,nodes,connections,settings FROM workflow_entity WHERE id IN (${placeholders})`,
  canonicalWorkflows.map((workflow) => workflow.id),
  (error, value) => error ? reject(error) : resolve(value),
));
db.close();
if (rows.length !== 2) throw new Error(`expected 2 live workflows, got ${rows.length}`);
for (const row of rows) {
  const canonical = canonicalById.get(row.id);
  if (!canonical) throw new Error(`unexpected live source workflow: ${row.id}`);
  for (const field of ['nodes', 'connections', 'settings']) {
    const liveValue = JSON.parse(row[field] || (field === 'nodes' ? '[]' : '{}'));
    const canonicalValue = canonical[field] || (field === 'nodes' ? [] : {});
    if (JSON.stringify(liveValue) !== JSON.stringify(canonicalValue)) {
      throw new Error(`${row.name}: live DB ${field} drifted from canonical workflow JSON`);
    }
  }
  if (!row.nodes.includes('C:/dev/n8n-youtube-shorts-automation/data/source-reel-bundles')) throw new Error(`${row.name}: local bundle root missing`);
  if (/G:\//i.test(row.nodes)) throw new Error(`${row.name}: G drive dependency remains`);
}
console.log(JSON.stringify({ ok: true, bundles: dirs.length, source_ids: sourceIds.size, topic_mds: mdIds.size, live_workflows: rows.length, runtime_root: bundleRoot.replace(/\\/g, '/') }));
