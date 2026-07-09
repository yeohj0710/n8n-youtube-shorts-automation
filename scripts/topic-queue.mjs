import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const topicDir = path.join(root, 'topics');
const queuePath = path.join(topicDir, 'queue.txt');
const pendingDir = path.join(topicDir, 'pending');
const usedDir = path.join(topicDir, 'used');

function ensureQueue() {
  fs.mkdirSync(topicDir, { recursive: true });
  fs.mkdirSync(pendingDir, { recursive: true });
  fs.mkdirSync(usedDir, { recursive: true });
  if (!fs.existsSync(queuePath)) fs.writeFileSync(queuePath, '', 'utf8');
}

function normalizeTopic(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function readTopics(filePath = queuePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(normalizeTopic)
    .filter((line) => line && !line.startsWith('#'));
}

function appendTopics(topics) {
  ensureQueue();
  const clean = topics.map(normalizeTopic).filter(Boolean);
  if (!clean.length) return 0;
  const prefix = fs.existsSync(queuePath) && fs.readFileSync(queuePath, 'utf8').trim() ? '\n' : '';
  fs.appendFileSync(queuePath, prefix + clean.join('\n') + '\n', 'utf8');
  return clean.length;
}

function slugify(value) {
  const ascii = String(value || '')
    .normalize('NFKD')
    .replace(/[^\w\s.가-힣-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return ascii || Date.now().toString(36);
}

function roughSlug(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9가-힣_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .toLowerCase() || Date.now().toString(36);
}

function titleFromRoughText(value) {
  const firstLine = String(value || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(normalizeTopic)
    .find(Boolean);
  return firstLine
    ? firstLine.replace(/^#\s+/, '').replace(/^(주제|아이디어|title|topic)\s*[:：]\s*/i, '').slice(0, 80)
    : 'rough-topic';
}

function parseFlags(values) {
  const flags = { ranks: [], tags: [] };
  const positional = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--rank') {
      flags.ranks.push(values[++index] || '');
    } else if (value === '--subtitle') {
      flags.subtitle = values[++index] || '';
    } else if (value === '--lane') {
      flags.lane = values[++index] || '';
    } else if (value === '--tag') {
      flags.tags.push(values[++index] || '');
    } else if (value === '--notes') {
      flags.notes = values[++index] || '';
    } else {
      positional.push(value);
    }
  }
  flags.title = normalizeTopic(positional.join(' '));
  return flags;
}

function createMarkdownSpec(flags) {
  const lines = [`# ${flags.title}`, ''];
  if (flags.subtitle) lines.push(`Subtitle: ${normalizeTopic(flags.subtitle)}`);
  if (flags.lane) lines.push(`Lane: ${normalizeTopic(flags.lane)}`);
  if (flags.tags.length) lines.push(`Tags: ${flags.tags.map(normalizeTopic).filter(Boolean).join(', ')}`);
  if (flags.subtitle || flags.lane || flags.tags.length) lines.push('');
  if (flags.ranks.length) {
    lines.push('Ranks:');
    flags.ranks.map(normalizeTopic).filter(Boolean).forEach((rank, index) => {
      lines.push(`${index + 1}. ${rank}`);
    });
    lines.push('');
  }
  if (flags.notes) {
    lines.push('Notes:');
    lines.push(String(flags.notes).trim());
  }
  return lines.join('\n').replace(/\n*$/, '\n');
}

function writeFreeformTopic(text) {
  ensureQueue();
  const clean = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!clean) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(pendingDir, `${stamp}-${roughSlug(titleFromRoughText(clean))}.txt`);
  fs.writeFileSync(filePath, clean + '\n', 'utf8');
  return filePath;
}

function pendingFiles() {
  ensureQueue();
  return fs.readdirSync(pendingDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.') && /\.(md|txt|json)$/i.test(entry.name))
    .map((entry) => {
      const filePath = path.join(pendingDir, entry.name);
      const stat = fs.statSync(filePath);
      return { name: entry.name, path: filePath, mtimeMs: stat.mtimeMs };
    })
    .sort((a, b) => a.mtimeMs - b.mtimeMs || a.name.localeCompare(b.name));
}

function printUsage() {
  console.log([
    'Usage:',
    '  node scripts/topic-queue.mjs add "topic title"',
    '  node scripts/topic-queue.mjs add-rough "rough freeform topic brief"',
    '  node scripts/topic-queue.mjs add-file "topic title" --rank "item - reason" --rank "item - reason"',
    '  node scripts/topic-queue.mjs import path/to/topics.txt',
    '  node scripts/topic-queue.mjs list',
    '  node scripts/topic-queue.mjs path',
  ].join('\n'));
}

const [command, ...args] = process.argv.slice(2);
ensureQueue();

if (!command || command === 'help' || command === '--help' || command === '-h') {
  printUsage();
  process.exit(0);
}

if (command === 'add') {
  const topic = normalizeTopic(args.join(' '));
  const count = appendTopics([topic]);
  console.log(JSON.stringify({ ok: true, added: count, queuePath }, null, 2));
  process.exit(count ? 0 : 1);
}

if (command === 'add-rough' || command === 'add-freeform' || command === 'rough') {
  const filePath = writeFreeformTopic(args.join(' '));
  console.log(JSON.stringify({ ok: Boolean(filePath), filePath, pendingDir }, null, 2));
  process.exit(filePath ? 0 : 1);
}

if (command === 'add-file') {
  const flags = parseFlags(args);
  if (!flags.title) {
    console.error('Missing title');
    process.exit(1);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(pendingDir, `${stamp}-${slugify(flags.title)}.md`);
  fs.writeFileSync(filePath, createMarkdownSpec(flags), 'utf8');
  console.log(JSON.stringify({ ok: true, filePath }, null, 2));
  process.exit(0);
}

if (command === 'import') {
  const inputPath = args[0] ? path.resolve(process.cwd(), args[0]) : '';
  if (!inputPath || !fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath || '(empty)'}`);
    process.exit(1);
  }
  const count = appendTopics(readTopics(inputPath));
  console.log(JSON.stringify({ ok: true, added: count, queuePath }, null, 2));
  process.exit(0);
}

if (command === 'list') {
  const topics = readTopics();
  const files = pendingFiles();
  if (files.length) {
    console.log('Pending files:');
    files.forEach((file, index) => console.log(`${index + 1}. ${file.name}`));
  }
  if (topics.length) {
    console.log('queue.txt:');
    topics.forEach((topic, index) => console.log(`${index + 1}. ${topic}`));
  }
  console.log(JSON.stringify({
    pendingCount: files.length,
    lineCount: topics.length,
    queuePath,
    pendingDir,
    usedDir,
  }, null, 2));
  process.exit(0);
}

if (command === 'path') {
  console.log(queuePath);
  process.exit(0);
}

console.error(`Unknown command: ${command}`);
printUsage();
process.exit(1);
