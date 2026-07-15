import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const scriptsDir = path.join(root, 'scripts');
const failures = [];
let passed = 0;

function run(label, command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', shell: false });
  if (result.status !== 0) failures.push({ label, output: `${result.stdout || ''}${result.stderr || ''}`.trim() });
  else passed += 1;
}

for (const name of fs.readdirSync(scriptsDir).filter((name) => name.endsWith('.mjs')).sort()) {
  run(`syntax:${name}`, process.execPath, ['--check', path.join(scriptsDir, name)]);
}
for (const name of fs.readdirSync(scriptsDir).filter((name) => name.startsWith('verify-') && name.endsWith('.mjs')).sort()) {
  run(name, process.execPath, [path.join(scriptsDir, name)]);
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, passed, failed: failures.length, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, passed, failed: 0 }));
