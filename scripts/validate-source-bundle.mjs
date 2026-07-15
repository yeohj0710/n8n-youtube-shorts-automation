import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function atomicJson(file, payload) {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  fs.renameSync(temp, file);
}

export function validateBundle(bundleDir) {
  const required = ['manifest.json', 'source.json', 'caption.txt', 'source.mp4', 'audio.wav', 'transcript.json', 'evidence.json', 'contact-sheet.jpg', 'content-brief.json'];
  const issues = [];
  for (const name of required) if (!fs.existsSync(path.join(bundleDir, name))) issues.push(`missing_file:${name}`);
  if (issues.length) return { pass: false, issues };
  const source = JSON.parse(fs.readFileSync(path.join(bundleDir, 'source.json'), 'utf8'));
  const transcript = JSON.parse(fs.readFileSync(path.join(bundleDir, 'transcript.json'), 'utf8'));
  const evidence = JSON.parse(fs.readFileSync(path.join(bundleDir, 'evidence.json'), 'utf8'));
  const brief = JSON.parse(fs.readFileSync(path.join(bundleDir, 'content-brief.json'), 'utf8'));
  if (brief.schema_version !== '1.0') issues.push('invalid_schema_version');
  if (brief.source_id !== source.source_id) issues.push('source_id_mismatch');
  if (!Array.isArray(brief.rank_items) || brief.rank_items.length < 3 || brief.rank_items.length > 4) issues.push('rank_count_must_be_3_to_4');
  const evidenceMap = new Map([
    ...(evidence.caption_sentences || []).map((entry) => [entry.id, entry.text]),
    ...(transcript.segments || []).map((entry) => [entry.id, entry.text]),
  ]);
  for (const [index, item] of (brief.rank_items || []).entries()) {
    if (Number(item.rank) !== index + 1) issues.push(`rank_${index + 1}:order`);
    const reason = String(item.reason || '').replace(/\s+/g, ' ').trim();
    if (reason.length < 16 || reason.length > 42) issues.push(`rank_${index + 1}:reason_length`);
    if (!Array.isArray(item.evidence_ids) || !item.evidence_ids.length) issues.push(`rank_${index + 1}:missing_evidence`);
    const texts = (item.evidence_ids || []).map((id) => evidenceMap.get(id)).filter(Boolean);
    if (texts.length !== (item.evidence_ids || []).length) issues.push(`rank_${index + 1}:unknown_evidence`);
    const evidenceText = texts.join(' ');
    for (const number of reason.match(/\d+(?:\.\d+)?%?/g) || []) if (!evidenceText.includes(number)) issues.push(`rank_${index + 1}:unsupported_number:${number}`);
  }
  if (String(brief.title || '').length < 8 || String(brief.title || '').length > 32) issues.push('title_length');
  if (!brief.visual_direction?.representative_frame) issues.push('missing_representative_frame');
  else if (!fs.existsSync(path.join(bundleDir, brief.visual_direction.representative_frame))) issues.push('representative_frame_not_found');
  return { pass: issues.length === 0, issues, source, transcript, evidence, brief };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const command = process.argv[2] || 'validate';
  const bundleArg = process.argv.find((arg) => arg.startsWith('--bundle='));
  if (!bundleArg) throw new Error('--bundle=ABSOLUTE_PATH is required');
  const bundleDir = path.resolve(bundleArg.slice('--bundle='.length));
  const result = validateBundle(bundleDir);
  if (command === 'finalize' && result.pass) {
    const manifestPath = path.join(bundleDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    atomicJson(manifestPath, { ...manifest, status: 'brief_ready', content_brief: 'content-brief.json', updated_at: new Date().toISOString() });
  }
  console.log(JSON.stringify({ ok: result.pass, bundle_dir: bundleDir.replace(/\\/g, '/'), issues: result.issues }));
  if (!result.pass) process.exitCode = 1;
}
