import fs from 'node:fs';
import path from 'node:path';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const topicDirs = [path.join(root, '하루건강약사 소재'), path.join(root, '건강장수비결 소재')];
function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function score(value) {
  const text = clean(value);
  let valueScore = Math.min(text.length, 45);
  if (/[?？]/.test(text)) valueScore += 12;
  if (/약사|절대|손해|망|꼭|잠깐|헷갈|SOS|TOP|티어|vs|VS|1억|100%|짜면|안 되는|먹어야/.test(text)) valueScore += 18;
  if (/^[0-9️⃣]+/.test(text) || text.length < 10 || text.length > 70) valueScore -= 30;
  return valueScore;
}
let updated = 0;
for (const topicDir of topicDirs) for (const name of fs.readdirSync(topicDir)) {
  if (!name.endsWith('.md')) continue;
  const file = path.join(topicDir, name);
  let md = fs.readFileSync(file, 'utf8');
  const bundle = md.match(/^SOURCE_BUNDLE=(.+)$/m)?.[1]?.trim();
  if (!bundle || !fs.existsSync(bundle)) continue;
  const manifestPath = path.join(bundle, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
  if (manifest.status !== 'md_ready') continue;
  const brief = JSON.parse(fs.readFileSync(path.join(bundle, 'content-brief.json'), 'utf8'));
  const evidence = JSON.parse(fs.readFileSync(path.join(bundle, 'evidence.json'), 'utf8'));
  const transcript = JSON.parse(fs.readFileSync(path.join(bundle, 'transcript.json'), 'utf8'));
  const caption = fs.readFileSync(path.join(bundle, 'caption.txt'), 'utf8').trim();
  const folderHook = path.basename(bundle).replace(/^\d{6}\s+/, '');
  const captionHook = caption.split(/\r?\n/).map(clean).find(Boolean) || '';
  const captionLines = caption.split(/\r?\n/).map(clean).filter(Boolean);
  const sourceTitle = [folderHook, captionHook].sort((a, b) => score(b) - score(a))[0];
  const evidenceMap = new Map([...(evidence.caption_sentences || []).map((item) => [item.id, item.text]), ...(transcript.segments || []).map((item) => [item.id, item.text])]);
  const rankLines = (brief.rank_items || []).map((item, index) => {
    const exact = (item.evidence_ids || []).map((id) => clean(evidenceMap.get(id))).filter(Boolean);
    if (!exact.length) throw new Error(`${name}: no verbatim evidence for rank ${index + 1}`);
    return `${index + 1}. ${item.name} | ${item.reason} | 원본 디테일: ${exact.join(' / ').replace(/\|/g, '｜')}`;
  });
  md = md.replace(/^title:.*$/m, `title: ${sourceTitle}`);
  md = md.replace(/^subtitle:.*$/m, `subtitle: ${captionLines.find((line) => line !== sourceTitle) || ''}`);
  md = md.replace(/ranks:\r?\n[\s\S]*?\r?\nnotes:/m, `ranks:\n${rankLines.join('\n')}\nnotes:`);
  if (!/^CONTENT_MODE=/m.test(md)) md = md.replace(/^LOCKED_SOURCE_PACK=1$/m, 'LOCKED_SOURCE_PACK=1\nCONTENT_MODE=SOURCE_GROUNDED_DETAIL');
  else md = md.replace(/^CONTENT_MODE=.*$/m, 'CONTENT_MODE=SOURCE_GROUNDED_DETAIL');
  fs.writeFileSync(file, md, 'utf8');
  manifest.youtube_hook_title = sourceTitle;
  manifest.content_mode = 'SOURCE_GROUNDED_DETAIL';
  manifest.updated_at = new Date().toISOString();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  updated += 1;
}
if (updated === 0) throw new Error('no pending source packs found');
console.log(JSON.stringify({ ok: true, updated, mode: 'SOURCE_GROUNDED_DETAIL' }));
