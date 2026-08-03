import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const etc = path.join(root, 'etc');
const channelsPath = path.join(root, 'channels.jsonl');
const itemsPath = path.join(root, 'items.jsonl');
const headers = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'accept-language': 'ko-KR,ko;q=0.9',
};

function readJsonl(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function extractInitialData(html) {
  const marker = 'var ytInitialData = ';
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const bodyStart = start + marker.length;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = bodyStart; index < html.length; index += 1) {
    const char = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return JSON.parse(html.slice(bodyStart, index + 1));
    }
  }
  return null;
}

function walk(node, visitor) {
  if (!node || typeof node !== 'object') return;
  visitor(node);
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visitor);
    return;
  }
  for (const child of Object.values(node)) walk(child, visitor);
}

function textOf(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value.simpleText === 'string') return value.simpleText;
  if (Array.isArray(value.runs)) return value.runs.map((run) => run.text || '').join('');
  if (typeof value.content === 'string') return value.content;
  return '';
}

function parseMetric(text) {
  const normalized = String(text).replace(/,/g, '').trim();
  const match = normalized.match(/([\d.]+)\s*([천만억]?)/);
  if (!match) return null;
  const multiplier = { '': 1, 천: 1e3, 만: 1e4, 억: 1e8 }[match[2]] ?? 1;
  return Math.round(Number(match[1]) * multiplier);
}

function canonicalShortsUrl(url) {
  const parsed = new URL(url);
  parsed.search = '';
  parsed.pathname = `${parsed.pathname.replace(/\/(?:shorts|videos|featured|about)\/?$/, '')}/shorts`;
  return parsed.toString().replace(/\/shorts\/$/, '/shorts');
}

async function getChannelRepair(row) {
  const html = await (
    await fetch(row.url, { headers, signal: AbortSignal.timeout(12000) })
  ).text();
  const data = extractInitialData(html);
  let meta = null;
  const subscriberTexts = [];
  walk(data, (node) => {
    if (!meta && node.channelMetadataRenderer) meta = node.channelMetadataRenderer;
    for (const [key, value] of Object.entries(node)) {
      if (/subscriberCountText/i.test(key)) {
        const text = textOf(value);
        if (text) subscriberTexts.push(text);
      }
    }
  });
  const vanity =
    meta?.vanityChannelUrl ||
    html.match(/"vanityChannelUrl":"([^"]+)"/)?.[1]?.replace(/\\u0026/g, '&') ||
    row.url.replace(/\/shorts\/?$/, '');
  const decodedTail = decodeURIComponent(new URL(vanity).pathname.split('/').filter(Boolean).at(-1) || '');
  const handle = decodedTail.startsWith('@') ? decodedTail : row.handle;
  const subscribers =
    subscriberTexts.map(parseMetric).find((value) => value != null) ?? row.subscribers ?? null;
  return {
    oldHandle: row.handle,
    newHandle: handle,
    url: canonicalShortsUrl(vanity),
    subscribers,
  };
}

async function getPublishedAt(url) {
  try {
    const html = await (await fetch(url, { headers, signal: AbortSignal.timeout(12000) })).text();
    return (
      html.match(/"publishDate":"(\d{4}-\d{2}-\d{2})(?:T|")/)?.[1] ||
      html.match(/"uploadDate":"(\d{4}-\d{2}-\d{2})(?:T|")/)?.[1] ||
      null
    );
  } catch {
    return null;
  }
}

async function parallelMap(rows, concurrency, mapper, label) {
  const output = new Array(rows.length);
  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await mapper(rows[index], index);
      if ((index + 1) % 50 === 0) process.stdout.write(`${label} ${index + 1}/${rows.length}\n`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return output;
}

fs.mkdirSync(etc, { recursive: true });
if (!fs.existsSync(path.join(etc, 'channels-before-youtube-repair.jsonl'))) {
  fs.copyFileSync(channelsPath, path.join(etc, 'channels-before-youtube-repair.jsonl'));
}
if (!fs.existsSync(path.join(etc, 'items-before-youtube-repair.jsonl'))) {
  fs.copyFileSync(itemsPath, path.join(etc, 'items-before-youtube-repair.jsonl'));
}

const channels = readJsonl(channelsPath);
const items = readJsonl(itemsPath);
const youtubeChannels = channels.filter((row) => row.platform === 'youtube');
const repairs = await parallelMap(youtubeChannels, 5, getChannelRepair, 'channels');
const repairByHandle = new Map(repairs.map((repair) => [repair.oldHandle, repair]));

const repairedChannels = channels.map((row) => {
  if (row.platform !== 'youtube') return row;
  const repair = repairByHandle.get(row.handle);
  return {
    ...row,
    handle: repair.newHandle,
    url: repair.url,
    subscribers: repair.subscribers,
  };
});

const youtubeItems = items.filter((row) => row.platform === 'youtube');
const dates = await parallelMap(youtubeItems, 10, (row) => getPublishedAt(row.url), 'items');
let youtubeIndex = 0;
const repairedItems = items.map((row) => {
  if (row.platform !== 'youtube') return row;
  const repair = repairByHandle.get(row.channel_handle);
  const publishedAt = dates[youtubeIndex];
  youtubeIndex += 1;
  return {
    ...row,
    channel_handle: repair?.newHandle || row.channel_handle,
    published_at: publishedAt || row.published_at || null,
  };
});

const channelsTemp = path.join(etc, 'channels-repair.tmp.jsonl');
const itemsTemp = path.join(etc, 'items-repair.tmp.jsonl');
fs.writeFileSync(
  channelsTemp,
  `${repairedChannels.map((row) => JSON.stringify(row)).join('\n')}\n`,
  'utf8',
);
fs.writeFileSync(itemsTemp, `${repairedItems.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
fs.copyFileSync(channelsTemp, channelsPath);
fs.copyFileSync(itemsTemp, itemsPath);
fs.rmSync(channelsTemp);
fs.rmSync(itemsTemp);

process.stdout.write(
  `repaired ${repairs.filter((repair) => repair.newHandle !== repair.oldHandle).length} handles and ${
    dates.filter(Boolean).length
  } dates\n`,
);
