// A queued topic that the duplicate guard will skip is dead weight: the run
// walks past it and the stockpile silently shrinks. This checks every queued
// file against the guard that actually runs, using the guard source lifted from
// the live Load Config node rather than a copy that can drift.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const queueDir = path.join(root, 'research', 'queue');
const parents = [
  { dir: '하루건강약사', file: 'workflows/n8n_하루건강약사_수동실행.json' },
  { dir: '건강장수비결', file: 'workflows/n8n_geongangjangsubigyeol_manual.json' },
];

function guardFrom(workflowFile) {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, workflowFile), 'utf8'));
  const loadConfig = workflow.nodes.find((node) => node.name === 'Load Config');
  assert.ok(loadConfig, `${workflowFile}: Load Config node is missing`);
  const block = loadConfig.parameters.jsCode.match(
    /\/\/ TOPIC_DUPLICATE_GUARD_V1_BEGIN[\s\S]*?\/\/ TOPIC_DUPLICATE_GUARD_V1_END/,
  );
  assert.ok(block, `${workflowFile}: TOPIC_DUPLICATE_GUARD_V1 block is missing`);
  return new Function(
    'fs',
    'cleanString',
    `${block[0]}\nreturn { PUBLISHED_LEDGER_PATHS, loadPublishedLedger, findPublishedConflict };`,
  )(fs, (value) => String(value || '').replace(/\s+/g, ' ').trim());
}

let checked = 0;
for (const parent of parents) {
  const guard = guardFrom(parent.file);
  const ledger = guard.loadPublishedLedger(guard.PUBLISHED_LEDGER_PATHS);
  const dir = path.join(queueDir, parent.dir);
  assert.ok(fs.existsSync(dir), `${parent.dir}: stockpile folder missing`);

  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort();
  assert.ok(files.length >= 1, `${parent.dir}: stockpile is empty`);

  for (const file of files) {
    const spec = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const conflict = guard.findPublishedConflict(spec, ledger);
    assert.equal(
      conflict,
      null,
      `${parent.dir}/${file}: the duplicate guard would skip this topic (${JSON.stringify(conflict)}) — it can never publish`,
    );

    // Queued files must not collide with each other either, so add each one to
    // the ledger as it is cleared.
    const title = spec.final_pack?.hook_title || spec.title;
    if (title) ledger.titles.push(title);
    const key = spec.topic_key || spec.final_pack?.topic_key;
    if (key) ledger.topicKeys.add(String(key).toLowerCase());
    checked += 1;
  }
}

console.log(`PASS: ${checked} queued topics clear the published-title duplicate guard`);
