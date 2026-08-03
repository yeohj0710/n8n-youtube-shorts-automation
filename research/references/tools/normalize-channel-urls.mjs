import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const etc = path.join(root, 'etc');
const file = path.join(root, 'channels.jsonl');
const backup = path.join(etc, 'channels-before-url-normalization.jsonl');
fs.mkdirSync(etc, { recursive: true });
if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
const rows = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
let changed = 0;
for (const row of rows) {
  if (typeof row.url === 'string' && row.url.startsWith('http://')) {
    row.url = `https://${row.url.slice('http://'.length)}`;
    changed += 1;
  }
}
fs.writeFileSync(file, `${rows.map(JSON.stringify).join('\n')}\n`, 'utf8');
process.stdout.write(`normalized ${changed} channel URLs\n`);
