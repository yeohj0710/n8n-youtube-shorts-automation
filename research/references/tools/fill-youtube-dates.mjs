import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const etc = path.join(root, 'etc');
const file = path.join(root, 'items.jsonl');
const backup = path.join(etc, 'items-before-date-fill.jsonl');
const headers = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'accept-language': 'ko-KR,ko;q=0.9',
};

const rows = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
const missing = rows.filter((row) => row.platform === 'youtube' && row.published_at == null);
let cursor = 0;
let filled = 0;

async function worker() {
  while (cursor < missing.length) {
    const index = cursor++;
    const row = missing[index];
    try {
      const join = row.url.includes('?') ? '&' : '?';
      const response = await fetch(`${row.url}${join}hl=ko`, { headers, signal: AbortSignal.timeout(15000) });
      const html = await response.text();
      const date = html.match(/<meta itemprop="uploadDate" content="(\d{4}-\d{2}-\d{2})T/)?.[1]
        || html.match(/"publishDate":"(\d{4}-\d{2}-\d{2})T/)?.[1]
        || null;
      if (date) { row.published_at = date; filled += 1; }
    } catch {}
    if ((index + 1) % 50 === 0) process.stdout.write(`dates ${index + 1}/${missing.length}\n`);
  }
}

await Promise.all(Array.from({ length: 8 }, worker));
fs.mkdirSync(etc, { recursive: true });
if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
fs.writeFileSync(file, `${rows.map(JSON.stringify).join('\n')}\n`, 'utf8');
process.stdout.write(`filled ${filled}/${missing.length} missing YouTube dates\n`);
