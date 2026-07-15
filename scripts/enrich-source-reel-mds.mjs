import fs from 'node:fs';
import path from 'node:path';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const topicDirs = [path.join(root, '하루건강약사 소재'), path.join(root, '건강장수비결 소재')];
const begin = 'SOURCE_DETAIL_BEGIN';
const end = 'SOURCE_DETAIL_END';
let updated = 0;

for (const topicDir of topicDirs) for (const name of fs.readdirSync(topicDir)) {
  if (!name.endsWith('.md')) continue;
  const file = path.join(topicDir, name);
  let md = fs.readFileSync(file, 'utf8');
  const bundle = md.match(/^SOURCE_BUNDLE=(.+)$/m)?.[1]?.trim();
  if (!bundle || !fs.existsSync(bundle)) continue;
  const manifest = JSON.parse(fs.readFileSync(path.join(bundle, 'manifest.json'), 'utf8').replace(/^\uFEFF/, ''));
  if (manifest.status !== 'md_ready') continue;
  const brief = JSON.parse(fs.readFileSync(path.join(bundle, 'content-brief.json'), 'utf8'));
  const evidence = JSON.parse(fs.readFileSync(path.join(bundle, 'evidence.json'), 'utf8'));
  const transcript = JSON.parse(fs.readFileSync(path.join(bundle, 'transcript.json'), 'utf8'));
  const caption = fs.readFileSync(path.join(bundle, 'caption.txt'), 'utf8').trim();
  const evidenceMap = new Map([
    ...(evidence.caption_sentences || []).map((item) => [item.id, item.text]),
    ...(transcript.segments || []).map((item) => [item.id, item.text]),
  ]);
  const detailLines = ['## 항목별 원본 근거 상세'];
  for (const item of brief.rank_items || []) {
    detailLines.push(`### ${item.rank}번 ${item.name}`);
    detailLines.push(`- 요약: ${item.reason}`);
    if (item.caution) detailLines.push(`- 주의: ${item.caution}`);
    for (const id of item.evidence_ids || []) {
      const text = evidenceMap.get(id);
      if (!text) throw new Error(`${name}: evidence not found ${id}`);
      detailLines.push(`- [${id}] ${text}`);
    }
  }
  const block = [begin, ...detailLines, '', '## 원본 캡션 전문', caption, '', '## 원본 전사 전문', transcript.full_text || '', end].join('\n');
  const pattern = new RegExp(`${begin}[\\s\\S]*?${end}`, 'm');
  md = pattern.test(md) ? md.replace(pattern, block) : `${md.trim()}\n\n${block}\n`;
  fs.writeFileSync(file, md, 'utf8');
  updated += 1;
}
if (updated === 0) throw new Error('no pending source MDs found');
console.log(JSON.stringify({ ok: true, updated }));
