import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const dbPath = path.join(root, '.n8n', 'database.sqlite');
const workflowId = 'baekse100Life01';
const workflowPath = path.join(root, 'workflows', 'n8n_geongangjangsubigyeol_manual.json');

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
}

function backupDatabase() {
  const backupDir = path.join(root, '.n8n', `backup-before-dedup-history-${timestamp()}`);
  fs.mkdirSync(backupDir, { recursive: true });
  for (const name of ['database.sqlite', 'database.sqlite-wal', 'database.sqlite-shm']) {
    const source = path.join(root, '.n8n', name);
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(backupDir, name));
  }
  return backupDir;
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => (error ? reject(error) : resolve(row)));
  });
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  return JSON.parse(value);
}

function nodeByName(nodes, name) {
  const node = nodes.find((entry) => entry.name === name);
  if (!node?.parameters?.jsCode) throw new Error(`Code node not found: ${name}`);
  return node;
}

function replaceOnce(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Patch anchor not found: ${label}`);
  return source.replace(needle, replacement);
}

function patchLoadConfig(code) {
  if (code.includes('function loadRecentTitleHistory(')) return code;

  const helperAnchor = `function appendJsonLine(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(payload) + '\\n', 'utf8');
}
`;

  const helper = `${helperAnchor}
function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = cleanString(value);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function loadRecentTitleHistory(filePath, limit = 24) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return [];
    const rows = fs.readFileSync(filePath, 'utf8')
      .split(/\\r?\\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch (error) { return null; }
      })
      .filter(Boolean)
      .reverse();

    const titles = [];
    for (const row of rows) {
      const title = cleanString(row.title || row.hook_title || row.topic || row.theme);
      if (title) titles.push(title);
      if (titles.length >= limit) break;
    }
    return uniqueStrings(titles);
  } catch (error) {
    return [];
  }
}
`;

  let next = replaceOnce(code, helperAnchor, helper, 'Load Config recent title helpers');
  const beforeReturn = `config.topic_queue = topicQueue;

return [{ json: { config, incoming, topic_queue: topicQueue, trigger: { type: config.trigger_type, received_at: new Date().toISOString() } } }];`;
  const afterReturn = `config.topic_queue = topicQueue;

const incomingRecentTitles = config.recent_titles;
const uploadLogRecentTitles = loadRecentTitleHistory(config.upload_log_path, Number(incoming.recent_title_history_limit || 24));
const topicLogRecentTitles = loadRecentTitleHistory(config.topic_queue_used_log_path, Number(incoming.recent_title_history_limit || 24));
config.recent_titles = uniqueStrings([
  ...incomingRecentTitles,
  ...uploadLogRecentTitles,
  ...topicLogRecentTitles,
]).slice(0, Number(incoming.recent_title_history_limit || 40));
config.recent_title_sources = {
  incoming: incomingRecentTitles.length,
  upload_log: uploadLogRecentTitles.length,
  topic_queue_used_log: topicLogRecentTitles.length,
  total: config.recent_titles.length,
};

return [{ json: { config, incoming, topic_queue: topicQueue, trigger: { type: config.trigger_type, received_at: new Date().toISOString() } } }];`;
  next = replaceOnce(next, beforeReturn, afterReturn, 'Load Config recent title merge');
  return next;
}

function patchBuildRequest(code) {
  if (code.includes('function normalizeDuplicateTitle(')) {
    if (code.includes('function duplicateTitleTokenOverlap(')) return code;
    let upgraded = code.replace(
      `function titleSimilarity(left, right) {
  const leftSet = new Set(ngrams(left));
  const rightSet = new Set(ngrams(right));
  if (!leftSet.size || !rightSet.size) return 0;
  let shared = 0;
  for (const gram of leftSet) {
    if (rightSet.has(gram)) shared += 1;
  }
  return shared / Math.min(leftSet.size, rightSet.size);
}
`,
      `function titleSimilarity(left, right) {
  const leftSet = new Set(ngrams(left));
  const rightSet = new Set(ngrams(right));
  if (!leftSet.size || !rightSet.size) return 0;
  let shared = 0;
  for (const gram of leftSet) {
    if (rightSet.has(gram)) shared += 1;
  }
  return shared / Math.min(leftSet.size, rightSet.size);
}

function duplicateTitleTokens(value) {
  return clean(value)
    .toLowerCase()
    .replace(/top\\s*\\d+/gi, ' ')
    .replace(/[0-9０-９]+\\s*(?:가지|개|위|선|순위|top)?/gi, ' ')
    .replace(/[^a-z0-9가-힣]+/gi, ' ')
    .split(/\\s+/)
    .map((token) => token.replace(/(에서|으로|부터|까지|처럼|만큼|보다|에게|한테|께|은|는|이|가|을|를|만|도|과|와|의|에|로|과)$/g, ''))
    .filter((token) => token.length >= 2);
}

function duplicateTitleTokenOverlap(left, right) {
  const leftTokens = new Set(duplicateTitleTokens(left));
  const rightTokens = new Set(duplicateTitleTokens(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) shared += 1;
  }
  return shared / Math.min(leftTokens.size, rightTokens.size);
}
`,
    );
    upgraded = replaceOnce(
      upgraded,
      `    if (key === recentKey || key.includes(recentKey) || recentKey.includes(key)) return recent;
    if (titleSimilarity(key, recentKey) >= 0.58) return recent;`,
      `    if (key === recentKey || key.includes(recentKey) || recentKey.includes(key)) return recent;
    if (duplicateTitleTokenOverlap(title, recent) >= 0.48) return recent;
    if (titleSimilarity(key, recentKey) >= 0.58) return recent;`,
      'Build token overlap upgrade',
    );
    return upgraded;
  }

  const helperAnchor = `function findById(items, value) {
  const key = clean(value).toLowerCase();
  if (!key) return null;
  return items.find((item) => item.id.toLowerCase() === key || item.title.toLowerCase() === key) || null;
}
`;

  const helper = `${helperAnchor}
function normalizeDuplicateTitle(value) {
  return clean(value)
    .toLowerCase()
    .replace(/top\\s*\\d+/gi, ' ')
    .replace(/[0-9０-９]+\\s*(?:가지|개|위|선|순위|top)?/gi, ' ')
    .replace(/[ㄱ-ㅎㅏ-ㅣ]/g, ' ')
    .replace(/[^a-z0-9가-힣]+/gi, ' ')
    .replace(/\\s+/g, '');
}

function ngrams(value, size = 3) {
  const text = normalizeDuplicateTitle(value);
  if (text.length <= size) return text ? [text] : [];
  const grams = [];
  for (let index = 0; index <= text.length - size; index += 1) {
    grams.push(text.slice(index, index + size));
  }
  return grams;
}

function titleSimilarity(left, right) {
  const leftSet = new Set(ngrams(left));
  const rightSet = new Set(ngrams(right));
  if (!leftSet.size || !rightSet.size) return 0;
  let shared = 0;
  for (const gram of leftSet) {
    if (rightSet.has(gram)) shared += 1;
  }
  return shared / Math.min(leftSet.size, rightSet.size);
}

function duplicateTitleTokens(value) {
  return clean(value)
    .toLowerCase()
    .replace(/top\s*\d+/gi, ' ')
    .replace(/[0-9０-９]+\s*(?:가지|개|위|선|순위|top)?/gi, ' ')
    .replace(/[^a-z0-9가-힣]+/gi, ' ')
    .split(/\s+/)
    .map((token) => token.replace(/(에서|으로|부터|까지|처럼|만큼|보다|에게|한테|께|은|는|이|가|을|를|만|도|과|와|의|에|로|과)$/g, ''))
    .filter((token) => token.length >= 2);
}

function duplicateTitleTokenOverlap(left, right) {
  const leftTokens = new Set(duplicateTitleTokens(left));
  const rightTokens = new Set(duplicateTitleTokens(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) shared += 1;
  }
  return shared / Math.min(leftTokens.size, rightTokens.size);
}

const recentTitles = Array.isArray(cfg.recent_titles) ? cfg.recent_titles.map(clean).filter(Boolean) : [];

function recentTitleMatch(title) {
  const key = normalizeDuplicateTitle(title);
  if (!key) return null;
  for (const recent of recentTitles) {
    const recentKey = normalizeDuplicateTitle(recent);
    if (!recentKey) continue;
    if (key === recentKey || key.includes(recentKey) || recentKey.includes(key)) return recent;
    if (duplicateTitleTokenOverlap(title, recent) >= 0.48) return recent;
    if (titleSimilarity(key, recentKey) >= 0.58) return recent;
  }
  return null;
}
`;

  let next = replaceOnce(code, helperAnchor, helper, 'Build duplicate helpers');

  const candidateBlock = `const seen = new Set();
const topic_candidates = [...manual, ...referenceViral, ...rss, ...laneCandidates].filter((candidate) => {
  const key = candidate.title.toLowerCase();
  if (!candidate.title || seen.has(key)) return false;
  seen.add(key);
  return true;
}).slice(0, 30);
`;

  const candidateReplacement = `const seen = new Set();
const duplicateTopicCandidates = [];
const topic_candidates = [...manual, ...referenceViral, ...rss, ...laneCandidates].filter((candidate) => {
  const title = clean(candidate.title);
  const key = normalizeDuplicateTitle(title);
  if (!title || seen.has(key)) return false;
  seen.add(key);

  const duplicateOf = candidate.source === 'topic_queue' ? null : recentTitleMatch(title);
  if (duplicateOf) {
    duplicateTopicCandidates.push({ title, source: candidate.source, lane: candidate.lane, duplicate_of: duplicateOf });
    return false;
  }
  return true;
}).slice(0, 30);
`;

  next = replaceOnce(next, candidateBlock, candidateReplacement, 'Build candidate dedupe');

  const promptLine = `  cfg.recent_titles?.length ? 'Also avoid these recent titles/topics: ' + cfg.recent_titles.join(' / ') + '.' : '',`;
  const promptReplacement = `  recentTitles.length ? 'Hard duplicate filter: do not reuse, translate, or closely paraphrase these recent 건강장수비결 titles/topics: ' + recentTitles.join(' / ') + '.' : '',
  duplicateTopicCandidates.length ? 'These candidate hooks were removed before generation because they were too close to recent uploads: ' + duplicateTopicCandidates.slice(0, 12).map((item) => item.title + ' ~= ' + item.duplicate_of).join(' / ') + '.' : '',`;
  next = replaceOnce(next, promptLine, promptReplacement, 'Build prompt dedupe instruction');

  const returnLine = `return [{ json: { ...base, selected_content_lane: selectedLane, topic_candidates, kie_claude_request } }];`;
  const returnReplacement = `return [{ json: { ...base, selected_content_lane: selectedLane, topic_candidates, duplicate_topic_candidates: duplicateTopicCandidates, recent_titles_used: recentTitles, kie_claude_request } }];`;
  next = replaceOnce(next, returnLine, returnReplacement, 'Build return dedupe metadata');
  return next;
}

function patchParsePack(code) {
  if (code.includes('function parseRecentTitleMatch(')) {
    if (code.includes('function parseDuplicateTitleTokenOverlap(')) return code;
    let upgraded = code.replace(
      `function duplicateSimilarity(left, right) {
  const leftSet = new Set(duplicateNgrams(left));
  const rightSet = new Set(duplicateNgrams(right));
  if (!leftSet.size || !rightSet.size) return 0;
  let shared = 0;
  for (const gram of leftSet) {
    if (rightSet.has(gram)) shared += 1;
  }
  return shared / Math.min(leftSet.size, rightSet.size);
}
`,
      `function duplicateSimilarity(left, right) {
  const leftSet = new Set(duplicateNgrams(left));
  const rightSet = new Set(duplicateNgrams(right));
  if (!leftSet.size || !rightSet.size) return 0;
  let shared = 0;
  for (const gram of leftSet) {
    if (rightSet.has(gram)) shared += 1;
  }
  return shared / Math.min(leftSet.size, rightSet.size);
}

function parseDuplicateTitleTokens(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/top\\s*\\d+/gi, ' ')
    .replace(/[0-9０-９]+\\s*(?:가지|개|위|선|순위|top)?/gi, ' ')
    .replace(/[^a-z0-9가-힣]+/gi, ' ')
    .split(/\\s+/)
    .map((token) => token.replace(/(에서|으로|부터|까지|처럼|만큼|보다|에게|한테|께|은|는|이|가|을|를|만|도|과|와|의|에|로|과)$/g, ''))
    .filter((token) => token.length >= 2);
}

function parseDuplicateTitleTokenOverlap(left, right) {
  const leftTokens = new Set(parseDuplicateTitleTokens(left));
  const rightTokens = new Set(parseDuplicateTitleTokens(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) shared += 1;
  }
  return shared / Math.min(leftTokens.size, rightTokens.size);
}
`,
    );
    upgraded = replaceOnce(
      upgraded,
      `    if (key === recentKey || key.includes(recentKey) || recentKey.includes(key)) return recent;
    if (duplicateSimilarity(key, recentKey) >= 0.58) return recent;`,
      `    if (key === recentKey || key.includes(recentKey) || recentKey.includes(key)) return recent;
    if (parseDuplicateTitleTokenOverlap(title, recent) >= 0.48) return recent;
    if (duplicateSimilarity(key, recentKey) >= 0.58) return recent;`,
      'Parse token overlap upgrade',
    );
    return upgraded;
  }

  const fallbackAnchor = `
function pickFallbackPack(context, seed, salt) {
  const lane = String(context?.selected_content_lane?.id || context?.pack?.content_lane || '').trim();
  const lanePacks = lane ? viralFallbackPacks.filter((entry) => entry.content_lane === lane) : [];
  const pool = lanePacks.length ? lanePacks : viralFallbackPacks;
  return pick(pool, seed, salt + '|' + lane);
}
const fallbackPack = pickFallbackPack(base, cfg.variation_seed || new Date().toISOString(), 'parse_fallback');
`;

  const fallbackReplacement = `
function normalizeDuplicateTitle(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/top\\s*\\d+/gi, ' ')
    .replace(/[0-9０-９]+\\s*(?:가지|개|위|선|순위|top)?/gi, ' ')
    .replace(/[ㄱ-ㅎㅏ-ㅣ]/g, ' ')
    .replace(/[^a-z0-9가-힣]+/gi, ' ')
    .replace(/\\s+/g, '');
}

function duplicateNgrams(value, size = 3) {
  const text = normalizeDuplicateTitle(value);
  if (text.length <= size) return text ? [text] : [];
  const grams = [];
  for (let index = 0; index <= text.length - size; index += 1) {
    grams.push(text.slice(index, index + size));
  }
  return grams;
}

function duplicateSimilarity(left, right) {
  const leftSet = new Set(duplicateNgrams(left));
  const rightSet = new Set(duplicateNgrams(right));
  if (!leftSet.size || !rightSet.size) return 0;
  let shared = 0;
  for (const gram of leftSet) {
    if (rightSet.has(gram)) shared += 1;
  }
  return shared / Math.min(leftSet.size, rightSet.size);
}

function parseDuplicateTitleTokens(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/top\s*\d+/gi, ' ')
    .replace(/[0-9０-９]+\s*(?:가지|개|위|선|순위|top)?/gi, ' ')
    .replace(/[^a-z0-9가-힣]+/gi, ' ')
    .split(/\s+/)
    .map((token) => token.replace(/(에서|으로|부터|까지|처럼|만큼|보다|에게|한테|께|은|는|이|가|을|를|만|도|과|와|의|에|로|과)$/g, ''))
    .filter((token) => token.length >= 2);
}

function parseDuplicateTitleTokenOverlap(left, right) {
  const leftTokens = new Set(parseDuplicateTitleTokens(left));
  const rightTokens = new Set(parseDuplicateTitleTokens(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) shared += 1;
  }
  return shared / Math.min(leftTokens.size, rightTokens.size);
}

function parseRecentTitleMatch(title) {
  const key = normalizeDuplicateTitle(title);
  if (!key) return null;
  const recentTitles = Array.isArray(cfg.recent_titles) ? cfg.recent_titles : [];
  for (const recent of recentTitles) {
    const recentKey = normalizeDuplicateTitle(recent);
    if (!recentKey) continue;
    if (key === recentKey || key.includes(recentKey) || recentKey.includes(key)) return recent;
    if (parseDuplicateTitleTokenOverlap(title, recent) >= 0.48) return recent;
    if (duplicateSimilarity(key, recentKey) >= 0.58) return recent;
  }
  return null;
}

function pickFallbackPack(context, seed, salt) {
  const lane = String(context?.selected_content_lane?.id || context?.pack?.content_lane || '').trim();
  const lanePacks = lane ? viralFallbackPacks.filter((entry) => entry.content_lane === lane) : [];
  const freshLanePacks = lanePacks.filter((entry) => !parseRecentTitleMatch(entry.hook_title));
  const freshAllPacks = viralFallbackPacks.filter((entry) => !parseRecentTitleMatch(entry.hook_title));
  const pool = freshLanePacks.length ? freshLanePacks : (freshAllPacks.length ? freshAllPacks : (lanePacks.length ? lanePacks : viralFallbackPacks));
  return pick(pool, seed, salt + '|' + lane + '|' + (cfg.recent_titles || []).join('|'));
}
const fallbackPack = pickFallbackPack(base, cfg.variation_seed || new Date().toISOString(), 'parse_fallback');
`;

  let next = replaceOnce(code, fallbackAnchor, fallbackReplacement, 'Parse fresh fallback');

  const validateBlock = `  normalizePack(pack);
  validatePack(pack);
} catch (error) {
  return fallback('KIE Claude pack parse failed; rotating fallback pack used: ' + error.message, response);
}

return [{`;

  const validateReplacement = `  normalizePack(pack);
  validatePack(pack);
} catch (error) {
  return fallback('KIE Claude pack parse failed; rotating fallback pack used: ' + error.message, response);
}

const duplicateOf = parseRecentTitleMatch(pack.hook_title);
if (duplicateOf) {
  return fallback('KIE Claude generated a recent duplicate title; rotating fallback pack used: ' + pack.hook_title + ' ~= ' + duplicateOf, response);
}

return [{`;

  next = replaceOnce(next, validateBlock, validateReplacement, 'Parse duplicate guard');
  return next;
}

const backupDir = backupDatabase();
const db = new sqlite3.Database(dbPath);

try {
  const row = await get(db, 'select nodes from workflow_entity where id=?', [workflowId]);
  if (!row) throw new Error(`workflow not found: ${workflowId}`);
  const nodes = parseJson(row.nodes, []);

  const loadConfig = nodeByName(nodes, 'Load Config');
  const buildRequest = nodeByName(nodes, 'Build Viral Rank Pack Request');
  const parsePack = nodeByName(nodes, 'Parse KIE Claude Pack');

  loadConfig.parameters.jsCode = patchLoadConfig(loadConfig.parameters.jsCode);
  buildRequest.parameters.jsCode = patchBuildRequest(buildRequest.parameters.jsCode);
  parsePack.parameters.jsCode = patchParsePack(parsePack.parameters.jsCode);

  await run(
    db,
    "UPDATE workflow_entity SET nodes=?, updatedAt=strftime('%Y-%m-%d %H:%M:%f','now'), versionCounter=versionCounter+1 WHERE id=?",
    [JSON.stringify(nodes), workflowId],
  );

  const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
  workflow.nodes = nodes;
  workflow.updatedAt = new Date().toISOString();
  fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify({
    ok: true,
    workflowId,
    patched_nodes: ['Load Config', 'Build Viral Rank Pack Request', 'Parse KIE Claude Pack'],
    backupDir,
    workflowPath,
  }, null, 2));
} finally {
  db.close();
}
