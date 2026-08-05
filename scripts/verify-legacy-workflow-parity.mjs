import assert from 'node:assert/strict';
import fs from 'node:fs';
import sqlite3 from 'sqlite3';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const files = {
  haru: `${root}/workflows/n8n_하루건강약사_수동실행.json`,
  longevity: `${root}/workflows/n8n_geongangjangsubigyeol_manual.json`,
};
const channelOwnedNodes = new Set(['Load Config', 'Build Viral Rank Pack Request', 'Credentials']);

function normalized(value) {
  let text = JSON.stringify(value)
    .replaceAll('건강장수비결 소재', 'CHANNEL_MATERIAL')
    .replaceAll('하루건강약사 소재', 'CHANNEL_MATERIAL')
    .replaceAll('건강장수비결', 'CHANNEL_NAME')
    .replaceAll('하루건강약사', 'CHANNEL_NAME')
    .replaceAll('건강하게 오래 살고 싶다면 피할 습관 7', 'CHANNEL_FALLBACK_TOPIC')
    .replaceAll('죽을 때까지 내 발로 걷고 싶다면 피할 습관 7', 'CHANNEL_FALLBACK_TOPIC')
    .replaceAll('장수 생활건강 랭킹 쇼츠', 'CHANNEL_FORMAT')
    .replaceAll('건강 랭킹 카드형 쇼츠', 'CHANNEL_FORMAT');
  return JSON.parse(text);
}

// 카드 하단 CTA는 채널 소유다(2026-08-05): 하루건강약사만 팔로우 푸터를 찍고
// 건강장수비결은 카드에 CTA를 넣지 않는다. 푸터 관련 조각만 걷어내고 나머지는
// 그대로 비교해서, 이 차이 뒤에 다른 드리프트가 숨지 못하게 한다.
function stripChannelFooter(code) {
  return String(code)
    .replace(/\/\/ subscribe_footer_copy_v1\n[\s\S]*?\n\/\/ subscribe_footer_copy_end\n/g, '')
    .replace(/^.*'FOOTER SUBSCRIBE LINE[^\n]*\n/gm, '')
    .replace(/^.*SUBSCRIBE_FOOTER_V2[^\n]*$/gm, 'CHANNEL_FOOTER_CONTRACT')
    .replace(/^.*NO_FOOTER_V1[^\n]*$/gm, 'CHANNEL_FOOTER_CONTRACT');
}

function comparableNode(node) {
  const copy = structuredClone(node);
  for (const key of ['id', 'position', 'credentials', 'webhookId']) delete copy[key];
  if (copy.name === 'Prepare Image and BGM Payloads' && copy.parameters?.jsCode) {
    copy.parameters.jsCode = stripChannelFooter(copy.parameters.jsCode);
  }
  return normalized(copy);
}

function verifyPair(haru, longevity, label) {
  assert.equal(haru.nodes.length, longevity.nodes.length, `${label}: node counts differ`);
  const longevityByName = new Map(longevity.nodes.map((node) => [node.name, node]));
  for (const haruNode of haru.nodes) {
    const other = longevityByName.get(haruNode.name);
    assert.ok(other, `${label}: missing node ${haruNode.name}`);
    if (channelOwnedNodes.has(haruNode.name)) {
      assert.equal(haruNode.type, other.type, `${label}: ${haruNode.name} node type differs`);
      assert.equal(haruNode.typeVersion, other.typeVersion, `${label}: ${haruNode.name} node version differs`);
      continue;
    }
    assert.deepEqual(comparableNode(haruNode), comparableNode(other), `${label}: non-allowed runtime difference in ${haruNode.name}`);
  }
  assert.deepEqual(normalized(haru.connections), normalized(longevity.connections), `${label}: connection topology differs`);
  assert.deepEqual(haru.settings, longevity.settings, `${label}: workflow settings differ`);
}

const fileWorkflows = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, JSON.parse(fs.readFileSync(file, 'utf8'))]));
verifyPair(fileWorkflows.haru, fileWorkflows.longevity, 'workflow JSON');

const db = new sqlite3.Database(`${root}/.n8n/database.sqlite`, sqlite3.OPEN_READONLY);
const rows = await new Promise((resolve, reject) => db.all(
  'SELECT id, nodes, connections, settings FROM workflow_entity WHERE id IN (?, ?)',
  ['mxrYb3maJS31gEYC', 'baekse100Life01'],
  (error, result) => error ? reject(error) : resolve(result),
));
db.close();
const byId = new Map(rows.map((row) => [row.id, { nodes: JSON.parse(row.nodes), connections: JSON.parse(row.connections), settings: JSON.parse(row.settings) }]));
verifyPair(byId.get('mxrYb3maJS31gEYC'), byId.get('baekse100Life01'), 'live DB');

console.log('PASS: legacy workflows share one runtime outside credentials, channel identity, and topic selection');
