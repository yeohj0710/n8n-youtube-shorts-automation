// 채널 /shorts 페이지의 ytInitialData에서 제목 + 조회수를 뽑는다. 읽기 전용.
const channels = process.argv.slice(2);

function extractInitialData(html) {
  const marker = 'var ytInitialData = ';
  const start = html.indexOf(marker);
  if (start === -1) return null;
  let i = start + marker.length;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let j = i; j < html.length; j += 1) {
    const c = html[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return JSON.parse(html.slice(i, j + 1));
    }
  }
  return null;
}

function walk(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, out);
    return;
  }
  const lockup = node.shortsLockupViewModel;
  if (lockup) {
    const title =
      lockup.overlayMetadata?.primaryText?.content ||
      lockup.accessibilityText ||
      '';
    const views = lockup.overlayMetadata?.secondaryText?.content || '';
    if (title) out.push({ title: String(title).trim(), views: String(views).trim() });
  }
  for (const key of Object.keys(node)) walk(node[key], out);
}

function toNumber(views) {
  const m = String(views).match(/조회수\s*([\d.]+)\s*([만천억]?)/);
  if (!m) return 0;
  const n = Number(m[1]);
  const unit = { '': 1, 천: 1e3, 만: 1e4, 억: 1e8 }[m[2]] ?? 1;
  return Math.round(n * unit);
}

for (const url of channels) {
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        'accept-language': 'ko-KR,ko;q=0.9',
      },
    });
    const html = await res.text();
    const data = extractInitialData(html);
    if (!data) {
      console.log(`## ${url}\n  (ytInitialData 없음, status ${res.status}, ${html.length} bytes)\n`);
      continue;
    }
    const out = [];
    walk(data, out);
    const seen = new Set();
    const rows = out
      .filter((r) => (seen.has(r.title) ? false : seen.add(r.title)))
      .map((r) => ({ ...r, n: toNumber(r.views) }))
      .sort((a, b) => b.n - a.n);
    console.log(`## ${url}  (${rows.length}개)`);
    for (const r of rows) console.log(`${String(r.n).padStart(9)} | ${r.title}`);
    console.log('');
  } catch (error) {
    console.log(`## ${url}\n  ERROR ${error.message}\n`);
  }
}
