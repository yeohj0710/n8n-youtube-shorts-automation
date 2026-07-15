import fs from 'node:fs';

const file = 'C:/dev/n8n-youtube-shorts-automation/workflows/shared_content_quality_gate.json';
const workflow = JSON.parse(fs.readFileSync(file, 'utf8'));
const node = workflow.nodes.find((item) => item.name === 'Parse and Enforce Quality Review');
if (!node) throw new Error('Parse and Enforce Quality Review node missing');
const before = "  if (typeof value === 'string') return value;";
const after = `  if (typeof value === 'string') {
    const parsed = tryParseJson(value);
    if (parsed !== value) {
      if (parsed?.corrected_pack || parsed?.pack || parsed?.decision) return value;
      return collectText(parsed, depth + 1);
    }
    return value;
  }`;
const oldRecursive = `  if (typeof value === 'string') {
    const parsed = tryParseJson(value);
    if (parsed !== value) return collectText(parsed, depth + 1);
    return value;
  }`;
if (!node.parameters.jsCode.includes(after)) {
  if (node.parameters.jsCode.includes(oldRecursive)) {
    node.parameters.jsCode = node.parameters.jsCode.replace(oldRecursive, after);
  } else if (node.parameters.jsCode.includes(before)) {
    node.parameters.jsCode = node.parameters.jsCode.replace(before, after);
  } else {
    throw new Error('collectText string branch anchor missing');
  }
}
fs.writeFileSync(file, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
console.log('fixed nested KIE quality-review response parsing');
