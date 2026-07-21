// Checks candidate titles against the real duplicate guard BEFORE any content is
// written. The guard functions are lifted out of the live Load Config node, so a
// title that clears this check is the same title the workflow will accept.
//
//   node ./scripts/check-topic-title-availability.mjs "제목 1" "제목 2"
//   node ./scripts/check-topic-title-availability.mjs --file titles.txt
//
// Order matters: pick the topic from everyday life, clear this check, and only
// then write the card copy. Never bend a title to get past the filter — the
// title has to keep describing the item list exactly.
import fs from 'node:fs';
import path from 'node:path';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const parentFile = path.join(root, 'workflows/n8n_하루건강약사_수동실행.json');
const queueDir = path.join(root, 'research', 'queue');

const workflow = JSON.parse(fs.readFileSync(parentFile, 'utf8'));
const loadConfig = workflow.nodes.find((node) => node.name === 'Load Config').parameters.jsCode;

const guardBlock = loadConfig.match(
  /\/\/ TOPIC_DUPLICATE_GUARD_V1_BEGIN[\s\S]*?\/\/ TOPIC_DUPLICATE_GUARD_V1_END/,
);
if (!guardBlock) throw new Error('TOPIC_DUPLICATE_GUARD_V1 block is missing from Load Config');

const guard = new Function(
  'fs',
  'cleanString',
  `${guardBlock[0]}\nreturn { PUBLISHED_LEDGER_PATHS, loadPublishedLedger, findPublishedConflict, dupTokenOverlap, dupSimilarity, dupNormalize };`,
)(fs, (value) => String(value || '').replace(/\s+/g, ' ').trim());

const ledger = guard.loadPublishedLedger(guard.PUBLISHED_LEDGER_PATHS);

// Titles already sitting in the stockpile count too: two queued files with the
// same idea would still ship twice.
const queued = [];
if (fs.existsSync(queueDir)) {
  for (const channelDir of fs.readdirSync(queueDir)) {
    const dir = path.join(queueDir, channelDir);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.json'))) {
      const spec = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      const title = spec.final_pack?.hook_title || spec.title;
      if (title) queued.push(title);
      const key = spec.topic_key || spec.final_pack?.topic_key;
      if (key) ledger.topicKeys.add(String(key).toLowerCase());
    }
  }
}
ledger.titles.push(...queued);

const args = process.argv.slice(2);
let titles = [];
const fileFlag = args.indexOf('--file');
if (fileFlag !== -1) {
  titles = fs.readFileSync(args[fileFlag + 1], 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
} else {
  titles = args.filter(Boolean);
}
if (!titles.length) {
  console.error('usage: node ./scripts/check-topic-title-availability.mjs "제목" ["제목2" ...]');
  process.exit(2);
}

const results = titles.map((title) => {
  const conflict = guard.findPublishedConflict({ title }, ledger);
  // Report the closest near-miss too, so a title that barely squeaks past the
  // threshold can be rewritten before it becomes a real duplicate later.
  let nearest = { title: null, tokens: 0, similarity: 0 };
  for (const published of ledger.titles) {
    const tokens = guard.dupTokenOverlap(title, published);
    const similarity = guard.dupSimilarity(guard.dupNormalize(title), guard.dupNormalize(published));
    const score = Math.max(tokens, similarity);
    if (score > Math.max(nearest.tokens, nearest.similarity)) nearest = { title: published, tokens, similarity };
  }
  return {
    title,
    available: !conflict,
    conflict: conflict || null,
    nearest_published: nearest.title,
    nearest_token_overlap: Number(nearest.tokens.toFixed(3)),
    nearest_similarity: Number(nearest.similarity.toFixed(3)),
  };
});

console.log(JSON.stringify({
  ledger_titles: ledger.titles.length,
  ledger_topic_keys: ledger.topicKeys.size,
  thresholds: { token_overlap: 0.48, similarity: 0.58 },
  results,
}, null, 2));

process.exit(results.every((entry) => entry.available) ? 0 : 1);
