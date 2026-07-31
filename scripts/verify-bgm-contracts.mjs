import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const workflowDir = path.join(root, 'workflows');
const musicCreateUrl = 'https://api.kie.ai/api/v1/generate';
const musicPollUrl = 'https://api.kie.ai/api/v1/generate/record-info';
const callbackSinkUrl = 'https://httpbin.org/status/200';

const workflows = fs.readdirSync(workflowDir)
  .filter((name) => name.endsWith('.json'))
  .map((name) => ({
    name,
    workflow: JSON.parse(fs.readFileSync(path.join(workflowDir, name), 'utf8')),
  }))
  .filter(({ workflow }) => workflow.nodes?.some((node) => node.name === 'KIE Create BGM Task'));

assert.equal(workflows.length, 7, 'all seven Shorts workflows with generated BGM must be covered');

for (const { name, workflow } of workflows) {
  const create = workflow.nodes.find((node) => node.name === 'KIE Create BGM Task');
  const polls = workflow.nodes.filter((node) => ['KIE Get BGM Task', 'KIE Get BGM Task Retry'].includes(node.name));
  const payloadBuilders = workflow.nodes
    .map((node) => ({ name: node.name, code: String(node.parameters?.jsCode || '') }))
    .filter(({ code }) => /bgm_payload\s*[:=]/.test(code) && /instrumental\s*:/.test(code));

  assert.equal(create.parameters?.url, musicCreateUrl, `${name}: BGM uses the sound-effects endpoint instead of music generation`);
  assert.match(String(create.parameters?.jsonBody || ''), /callBackUrl/, `${name}: required KIE music callback URL is missing from the create request`);
  assert.match(String(create.parameters?.jsonBody || ''), new RegExp(callbackSinkUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${name}: polling workflow has no reachable 200 callback sink`);
  assert.equal(polls.length, 2, `${name}: expected both initial and retry music polls`);
  for (const poll of polls) {
    assert.equal(poll.parameters?.url, musicPollUrl, `${name} ${poll.name}: wrong music status endpoint`);
  }
  assert.ok(payloadBuilders.length > 0, `${name}: no BGM payload builder found`);

  for (const builder of payloadBuilders) {
    const label = `${name} ${builder.name}`;
    assert.match(builder.code, /customMode\s*:\s*true/, `${label}: custom music mode is required for a reliable instrumental flag`);
    assert.match(builder.code, /instrumental\s*:\s*true/, `${label}: instrumental-only flag missing`);
    assert.match(builder.code, /style\s*:/, `${label}: custom instrumental style missing`);
    assert.match(builder.code, /title\s*:/, `${label}: custom instrumental title missing`);
    assert.match(builder.code, /negativeTags\s*:/, `${label}: negative music tags missing`);
    assert.match(builder.code, /bright|cheerful|happy|joyful|sunny|uplifting/i, `${label}: bright and happy music direction missing`);
    assert.match(builder.code, /voice|vocals/i, `${label}: voice ban missing`);
    assert.match(builder.code, /humming/i, `${label}: humming ban missing`);
    assert.match(builder.code, /wordless vocals/i, `${label}: wordless-vocal ban missing`);
    assert.doesNotMatch(builder.code, /customMode\s*:\s*false/, `${label}: simple mode can ignore the instrumental control`);
  }
}

console.log(JSON.stringify({
  ok: true,
  workflows: workflows.map(({ name, workflow }) => ({ file: name, id: workflow.id })),
  contract: {
    endpoint: musicCreateUrl,
    custom_mode: true,
    instrumental: true,
    mood: 'bright_happy',
    vocals: 'forbidden',
    callback_sink: callbackSinkUrl,
  },
}, null, 2));
