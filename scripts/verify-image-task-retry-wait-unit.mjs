import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const workflowDir = path.join(root, 'workflows');
const workflowIds = new Set(['mxrYb3maJS31gEYC', 'baekse100Life01']);
const checked = [];

for (const name of fs.readdirSync(workflowDir)) {
  if (!name.endsWith('.json')) continue;
  const file = path.join(workflowDir, name);
  const workflow = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!workflowIds.has(workflow.id)) continue;

  const node = workflow.nodes.find((candidate) => candidate.name === 'Wait Image Task Retry 30s');
  assert.ok(node, `${workflow.id}: retry wait node missing`);
  assert.equal(node.parameters.resume, 'timeInterval', `${workflow.id}: retry wait resume mode must be timeInterval`);
  assert.equal(node.parameters.unit, 'seconds', `${workflow.id}: retry wait unit must be seconds`);
  checked.push(workflow.id);
}

assert.deepEqual(new Set(checked), workflowIds, 'both workflow files must be checked');
console.log(`PASS: ${checked.length} workflow retry wait nodes use seconds`);
