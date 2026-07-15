import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const workflowDir = path.join(root, 'workflows');
const workflowIds = new Set(['mxrYb3maJS31gEYC', 'baekse100Life01']);
const checked = [];

function nodeCode(workflow, name) {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  assert.ok(node, `${workflow.id}: missing ${name}`);
  return node.parameters?.jsCode || '';
}

function fallbackRows(code) {
  const rows = [];
  for (const block of code.matchAll(/rows:\s*\[([^\]]+)\]/gs)) {
    for (const quoted of block[1].matchAll(/'((?:\\'|[^'])*)'/g)) {
      const [name, reason] = quoted[1].split('|');
      rows.push({ name, reason, length: [...String(reason || '')].length });
    }
  }
  return rows;
}

for (const name of fs.readdirSync(workflowDir)) {
  if (!name.endsWith('.json')) continue;
  const workflow = JSON.parse(fs.readFileSync(path.join(workflowDir, name), 'utf8'));
  if (!workflowIds.has(workflow.id)) continue;

  const loadConfig = nodeCode(workflow, 'Load Config');
  const build = nodeCode(workflow, 'Build Viral Rank Pack Request');
  const parse = nodeCode(workflow, 'Parse KIE Claude Pack');
  const prepare = nodeCode(workflow, 'Prepare Image and BGM Payloads');

  assert.match(loadConfig, /rank_count_max:\s*Number\(incoming\.rank_count_max\s*\|\|\s*5\)/, `${workflow.id}: max rank count must be 5`);
  assert.doesNotMatch(build, /8-14|8-16/, `${workflow.id}: short-reason contract remains`);
  assert.doesNotMatch(build, /18-32 Korean characters|10-24 Korean characters/, `${workflow.id}: hard reason/caution length contract remains`);
  assert.match(build, /card_name.*at most 22 Korean characters/is, `${workflow.id}: short mobile-card item-name contract missing`);
  assert.match(build, /card_reason.*at most 40 Korean characters/is, `${workflow.id}: mobile-card explanation contract missing`);
  assert.match(build, /cause.*effect/i, `${workflow.id}: cause/effect contract missing`);
  assert.doesNotMatch(parse, /reason\.length\s*<\s*16/, `${workflow.id}: shared quality policy must not be duplicated in producer parser`);
  assert.match(prepare, /item\.card_reason/, `${workflow.id}: visible card does not use card_reason`);
  assert.match(prepare, /item\.card_name\s*\|\|\s*item\.name/, `${workflow.id}: visible card does not prefer short card_name`);
  assert.doesNotMatch(prepare, /reason \? '왜: ' \+ reason/, `${workflow.id}: visible card still forces 왜 label`);
  assert.match(prepare, /Do not invent or add percentages/, `${workflow.id}: fabricated metric guard missing`);
  assert.doesNotMatch(prepare, /small gauges|compact metric chips/, `${workflow.id}: metric UI prompt remains`);
  assert.doesNotMatch(prepare, /경고\|위험\|최악/, `${workflow.id}: destructive safety-word replacement remains`);

  const rows = fallbackRows(parse);
  assert.ok(rows.length >= 35, `${workflow.id}: expected fallback rows`);
  for (const row of rows) {
    assert.ok(row.length >= 16 && row.length <= 42, `${workflow.id}: fallback reason length ${row.length}: ${row.name} | ${row.reason}`);
  }

  checked.push(workflow.id);
}

assert.deepEqual(new Set(checked), workflowIds, 'both workflow files must be checked');
console.log(`PASS: ${checked.length} workflows enforce explanatory, fact-oriented rank reasons`);
