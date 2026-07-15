import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const sharedPath = path.join(root, 'workflows', 'shared_content_quality_gate.json');
const parentIds = new Set(['mxrYb3maJS31gEYC', 'baekse100Life01']);

assert.ok(fs.existsSync(sharedPath), 'shared quality gate workflow file missing');
const shared = JSON.parse(fs.readFileSync(sharedPath, 'utf8'));
assert.equal(shared.id, 'sharedContentQualityGate01');
assert.equal(shared.active, true, 'n8n requires the database sub-workflow to be active');
assert.ok(shared.nodes.some((node) => node.type === 'n8n-nodes-base.executeWorkflowTrigger'));
assert.ok(shared.nodes.some((node) => node.name === 'Build Quality Review Request'));
assert.ok(shared.nodes.some((node) => node.name === 'KIE Claude Independent Quality Review'));
assert.ok(shared.nodes.some((node) => node.name === 'Parse and Enforce Quality Review'));
assert.ok(shared.nodes.some((node) => node.name === 'Deterministic Quality Review'));

const buildCode = shared.nodes.find((node) => node.name === 'Build Quality Review Request').parameters.jsCode;
const parserCode = shared.nodes.find((node) => node.name === 'Parse and Enforce Quality Review').parameters.jsCode;
const deterministicCode = shared.nodes.find((node) => node.name === 'Deterministic Quality Review').parameters.jsCode;
assert.match(parserCode, /confidence\s*===\s*'low'/);
assert.match(parserCode, /content_quality_review/);
assert.doesNotMatch(parserCode, /reason\.length\s*<\s*16/, 'character count must not block valid content');
assert.match(parserCode, /pass_with_advisory/);
assert.match(parserCode, /independent_ai_audit_fail_open/);
assert.match(buildCode, /title_item_type_mismatch/);
assert.match(buildCode, /overstated_causal_attribution/);
assert.match(buildCode, /title_role/);
assert.match(buildCode, /claim_strength/);
assert.match(buildCode, /alternative_causes/);
assert.match(buildCode, /semantic class/i);
assert.match(buildCode, /observation.*association.*cause.*diagnosis/is);
assert.match(parserCode, /incomplete_semantic_audit/);
assert.match(parserCode, /title_item_type_mismatch/);
assert.match(parserCode, /overstated_causal_attribution/);
assert.match(deterministicCode, /unsupported_percentage/);
assert.doesNotMatch(deterministicCode, /vague_fragment/, 'wording style must not be a hard block');

const checked = [];
for (const name of fs.readdirSync(path.join(root, 'workflows'))) {
  if (!name.endsWith('.json') || name === 'shared_content_quality_gate.json') continue;
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'workflows', name), 'utf8'));
  if (!parentIds.has(workflow.id)) continue;
  const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
  assert.equal(nodes.get('Shared Content Quality Gate')?.type, 'n8n-nodes-base.executeWorkflow');
  const configuredWorkflowId = nodes.get('Shared Content Quality Gate')?.parameters.workflowId;
  assert.equal(configuredWorkflowId?.value || configuredWorkflowId, shared.id);
  assert.equal(nodes.get('Content Quality Passed?')?.type, 'n8n-nodes-base.if');
  assert.equal(workflow.connections['Parse KIE Claude Pack'].main[0][0].node, 'Shared Content Quality Gate');
  assert.equal(workflow.connections['Mock Viral Rank Pack'].main[0][0].node, 'Shared Content Quality Gate');
  assert.equal(workflow.connections['Shared Content Quality Gate'].main[0][0].node, 'Content Quality Passed?');
  assert.equal(workflow.connections['Content Quality Passed?'].main[0][0].node, 'Medical Safety Review');
  assert.equal(workflow.connections['Content Quality Passed?'].main[1][0].node, 'Prepare Medical Retry Request');

  const parseCode = nodes.get('Parse KIE Claude Pack').parameters.jsCode;
  const medicalCode = nodes.get('Medical Safety Review').parameters.jsCode;
  assert.doesNotMatch(parseCode, /reason\.length\s*<\s*16/, `${workflow.id}: reason policy duplicated in producer parser`);
  assert.doesNotMatch(medicalCode, /근거 문장 품질 부족/, `${workflow.id}: content policy duplicated in medical gate`);
  checked.push(workflow.id);
}

assert.deepEqual(new Set(checked), parentIds);
console.log('PASS: shared quality gate installed and wired into 2 parent workflows');
