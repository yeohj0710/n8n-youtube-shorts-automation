import sqlite3 from 'sqlite3';
import { parse as flattedParse } from 'flatted';

const dbPath = 'C:/dev/n8n-youtube-shorts-automation/.n8n/database.sqlite';
const workflowId = 'baekse100Life01';

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

function asList(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  return [];
}

function audioUrlFor(item) {
  return item?.audioUrl ||
    item?.streamAudioUrl ||
    item?.sourceAudioUrl ||
    item?.sourceStreamAudioUrl ||
    item?.audio_url ||
    item?.stream_audio_url ||
    item?.url ||
    null;
}

function durationFor(item) {
  const duration = Number(item?.duration || item?.audioDuration || item?.durationSeconds || item?.metadata?.duration || 0);
  return Number.isFinite(duration) ? duration : 0;
}

function safePublicText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeHookTitleFixture(value, pack, itemCount, cfg = {}) {
  let text = safePublicText(value);
  const count = itemCount || Number(cfg.rank_count) || 5;
  const vaguePattern = /대부분이\s*잘못\s*알고\s*있는/;
  if (vaguePattern.test(text)) {
    const fallback = [pack.subtitle, pack.theme]
      .map((entry) => safePublicText(entry))
      .find((entry) => entry && !vaguePattern.test(entry));
    if (fallback) {
      text = fallback;
      if (!/\d+\s*$/.test(text)) text += ' ' + count;
    } else {
      text = text
        .replace(vaguePattern, '')
        .replace(/\s*상식\s*/g, '에서 확인할 것 ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!text) text = '오늘 바로 확인할 생활 체크 ' + count;
    }
  }
  return text;
}

function flattenExecutionData(raw) {
  if (!raw) return null;
  let parsed;
  try {
    parsed = flattedParse(raw);
  } catch {
    parsed = JSON.parse(raw);
  }
  if (parsed && parsed.data && parsed.data.resultData) return parsed.data.resultData.runData;
  if (parsed && parsed.resultData) return parsed.resultData.runData;
  return parsed?.data?.resultData?.runData || parsed?.resultData?.runData || null;
}

const db = new sqlite3.Database(dbPath);
try {
  const wf = await get(db, 'select name, nodes, connections from workflow_entity where id=?', [workflowId]);
  const nodes = JSON.parse(wf.nodes);
  const connections = JSON.parse(wf.connections);
  const names = new Set(nodes.map((node) => node.name));
  const missingConnections = [];

  for (const [source, groups] of Object.entries(connections)) {
    if (!names.has(source)) missingConnections.push(`source:${source}`);
    for (const outputs of Object.values(groups || {})) {
      for (const branch of Object.values(outputs || {})) {
        for (const edges of Object.values(branch || {})) {
          for (const edge of Array.isArray(edges) ? edges : []) {
            if (edge?.node && !names.has(edge.node)) missingConnections.push(`${source}->${edge.node}`);
          }
        }
      }
    }
  }

  const syntax = {};
  for (const nodeName of ['Build Viral Rank Pack Request', 'Prepare Image and BGM Payloads', 'Parse BGM Result', 'Parse BGM Result Final']) {
    const code = nodes.find((node) => node.name === nodeName)?.parameters?.jsCode || '';
    try {
      new Function(code);
      syntax[nodeName] = 'ok';
    } catch (error) {
      syntax[nodeName] = error.message;
    }
  }

  const buildCode = nodes.find((node) => node.name === 'Build Viral Rank Pack Request')?.parameters?.jsCode || '';
  const payloadCode = nodes.find((node) => node.name === 'Prepare Image and BGM Payloads')?.parameters?.jsCode || '';
  const latest = await all(
    db,
    'select ee.id, ee.status, ee.startedAt, ee.stoppedAt, ed.data from execution_entity ee left join execution_data ed on ed.executionId=ee.id where ee.workflowId=? order by cast(ee.id as integer) desc limit 8',
    [workflowId],
  );

  const success = latest.find((row) => row.status === 'success') || latest[0];
  let bgmChoice = null;
  if (success?.data) {
    const runData = flattenExecutionData(success.data);
    const bgmRun = runData?.['KIE Get BGM Task']?.[0]?.data?.main?.[0]?.[0]?.json ||
      runData?.['KIE Get BGM Task Retry']?.[0]?.data?.main?.[0]?.[0]?.json ||
      null;
    const data = bgmRun?.data || bgmRun || {};
    const sunoData = data.response?.sunoData || data.sunoData || data.response?.data || data.data || [];
    const candidates = asList(sunoData)
      .filter((item) => audioUrlFor(item))
      .map((item) => ({ duration: durationFor(item), url: audioUrlFor(item) }));
    const best = [...candidates].sort((left, right) => right.duration - left.duration)[0] || null;
    bgmChoice = { executionId: success.id, candidates, chosen: best };
  }

  console.log(JSON.stringify({
    workflow: wf.name,
    nodeCount: nodes.length,
    missingConnections,
    syntax,
    textChecks: {
      buildContainsParent: buildCode.includes('부모님'),
      payloadContainsParent: payloadCode.includes('부모님'),
      directViewerComment: payloadCode.includes('여러분께 해당되는 습관'),
      vagueFridgePoolRemoved: !buildCode.includes('대부분이 잘못 알고 있는 냉장고 상식'),
      bgmStructureInstruction: payloadCode.includes('complete 12-18 second background music bed'),
    },
    titleFixture: normalizeHookTitleFixture(
      '대부분이 잘못 알고 있는 냉장고 상식 7',
      { subtitle: '유통기한 지났다고 바로 버리면 손해 보는 것', theme: '냉장고 상식' },
      7,
    ),
    latestExecutions: latest.map(({ id, status, startedAt, stoppedAt }) => ({ id, status, startedAt, stoppedAt })),
    bgmChoice,
  }, null, 2));
} finally {
  db.close();
}
