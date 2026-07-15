import fs from 'node:fs';
import sqlite3 from 'sqlite3';

const files = ['workflows/n8n_source_reel_haru_manual.json', 'workflows/n8n_source_reel_longevity_manual.json'];
const forbidden = ['Fetch Health RSS', 'Build Viral Rank Pack Request', 'KIE Claude Generate Pack', 'Shared Content Quality Gate'];
const expected = { kie: 'MV5JVbdiJSoVx9O8', youtube: { haru: 'l7YqloikIKiIOtOq', longevity: 'kVQv10ElQmt2iazM' } };
const ids = [];
for (const file of files) {
  const workflow = JSON.parse(fs.readFileSync(file, 'utf8'));
  ids.push(workflow.id);
  const names = new Set(workflow.nodes.map((node) => node.name));
  if (names.size !== workflow.nodes.length) throw new Error(`${file}: duplicate node names`);
  if (workflow.nodes.length !== 42) throw new Error(`${file}: expected 42 nodes`);
  for (const name of forbidden) if (names.has(name)) throw new Error(`${file}: forbidden legacy node ${name}`);
  for (const node of workflow.nodes) {
    const code = node.parameters?.jsCode || '';
    if (code) try { new Function(code); } catch (error) { throw new Error(`${file}: invalid code in ${node.name}: ${error.message}`); }
    for (const match of code.matchAll(/\$\(['"]([^'"]+)['"]\)/g)) {
      if (!names.has(match[1])) throw new Error(`${file}: ${node.name} references missing node ${match[1]}`);
    }
  }
  for (const [from, outputs] of Object.entries(workflow.connections || {})) {
    if (!names.has(from)) throw new Error(`${file}: connection source missing ${from}`);
    for (const branch of outputs.main || []) for (const edge of branch) if (!names.has(edge.node)) throw new Error(`${file}: connection target missing ${edge.node}`);
  }
  const reachable = new Set(['Manual Trigger']);
  const queue = ['Manual Trigger'];
  while (queue.length) {
    const from = queue.shift();
    for (const branch of workflow.connections?.[from]?.main || []) for (const edge of branch) if (!reachable.has(edge.node)) { reachable.add(edge.node); queue.push(edge.node); }
  }
  for (const requiredReachable of ['Load Source Reel Bundle','KIE Create Image Task','KIE Create BGM Task','Local FFmpeg Render','YouTube Upload Public','Post Top-Level Comment','Complete Source Reel Bundle']) if (!reachable.has(requiredReachable)) throw new Error(`${file}: unreachable critical node ${requiredReachable}`);
  for (const name of ['Load Source Reel Bundle', 'KIE Create Image Task', 'KIE Create BGM Task', 'Local FFmpeg Render', 'YouTube Upload Public', 'Complete Source Reel Bundle']) {
    if (!names.has(name)) throw new Error(`${file}: missing ${name}`);
  }
  for (const name of ['Post Top-Level Comment','Attach Comment Result']) if (!names.has(name)) throw new Error(`${file}: missing ${name}`);
  const image = workflow.nodes.find((node) => node.name === 'KIE Create Image Task');
  const youtube = workflow.nodes.find((node) => node.name === 'YouTube Upload Public');
  const comment = workflow.nodes.find((node) => node.name === 'Post Top-Level Comment');
  const loadCode = workflow.nodes.find((node) => node.name === 'Load Source Reel Bundle').parameters.jsCode;
  if (image.credentials?.httpHeaderAuth?.id !== expected.kie) throw new Error(`${file}: KIE credential changed`);
  const expectedYoutube = file.includes('longevity') ? expected.youtube.longevity : expected.youtube.haru;
  if (youtube.credentials?.youTubeOAuth2Api?.id !== expectedYoutube) throw new Error(`${file}: wrong channel YouTube credential`);
  if (comment.credentials?.youTubeOAuth2Api?.id !== expectedYoutube) throw new Error(`${file}: wrong channel comment credential`);
  if (!loadCode.includes('가장 먼저 확인해보고 싶은 항목은 몇 번인가요?')) throw new Error(`${file}: contextual universal comment missing`);
  if (!loadCode.includes('function hookTitle') || !loadCode.includes('피부 망치기 전에 꼭 보세요') || !loadCode.includes('돈 쓰기 전에 꼭 보세요')) throw new Error(`${file}: safe hook title rules missing`);
  if (!loadCode.includes('selected.manifest.youtube_hook_title')) throw new Error(`${file}: curated source hook title is not preferred`);
  if (!loadCode.includes('source_details') || !loadCode.includes('Detailed evidence pool')) throw new Error(`${file}: detailed source evidence is not passed to image generation`);
  if (!loadCode.includes('EDITORIAL PRIORITY') || !loadCode.includes('Use exact concrete numbers and conditions from the source')) throw new Error(`${file}: source-grounded editorial mode missing`);
  if (!loadCode.includes('function sanitizeSourceText') || !loadCode.includes('Never show source creator names') || !loadCode.includes('@usernames')) throw new Error(`${file}: source identity sanitization missing`);
  if (!loadCode.includes('AUTONOMOUS CREATIVE DIRECTION') || !loadCode.includes('Do not force a ranking, checklist, steps, comparison') || !loadCode.includes('SPARSE MOBILE COPY') || !loadCode.includes('35-60 Korean characters') || !loadCode.includes('FULL TRANSCRIPT')) throw new Error(`${file}: sparse autonomous source-driven composition missing`);
  if (loadCode.includes('function detectFormat') || loadCode.includes("contentFormat==='ranking'")) throw new Error(`${file}: format is still being forced`);
  const configRefs = new Set([...JSON.stringify(workflow.nodes).matchAll(/config(?:\?\.)?\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1]));
  for (const key of configRefs) if (!loadCode.includes(`${key}:`)) throw new Error(`${file}: downstream config reference not supplied: ${key}`);
  if (!loadCode.includes('allow_youtube_upload:incoming.allow_youtube_upload===undefined?true')) throw new Error(`${file}: upload does not default on`);
  if (!loadCode.includes("youtube_privacy_status:incoming.youtube_privacy_status||'public'")) throw new Error(`${file}: privacy does not default public`);
  for (const key of ['poll_interval_seconds:30','bgm_retry_wait_seconds:90','image_task_retry_wait_seconds:30','image_poll_timeout_seconds:1800','image_poll_max_attempts:60']) {
    if (!loadCode.includes(key)) throw new Error(`${file}: required downstream config missing: ${key}`);
  }
  const parseFinal = workflow.nodes.find((node) => node.name === 'Parse Image Result Final');
  if (parseFinal.parameters.jsCode.includes("image_state: 'stalled'")) throw new Error(`${file}: provider delay incorrectly creates a new paid image task`);
  if (!parseFinal.parameters.jsCode.includes('Math.max(requestedMaxAttempts, timeoutBasedMaxAttempts)')) throw new Error(`${file}: proven long-poll behavior from legacy workflow is missing`);
  if (!parseFinal.parameters.jsCode.includes('image_task_retry_available: true') || !parseFinal.parameters.jsCode.includes('failed && recoverable')) throw new Error(`${file}: explicit provider failures cannot retry`);
  const preparePoll = workflow.nodes.find((node) => node.name === 'Prepare Image Retry Poll');
  if (!preparePoll.parameters.jsCode.includes('KIE image timeout reached before next poll')) throw new Error(`${file}: bounded 30-minute polling timeout missing`);
  const waitBgm = workflow.nodes.find((node) => node.name === 'Wait BGM 30s');
  if (!String(waitBgm?.parameters?.amount).includes('poll_interval_seconds || 30')) throw new Error(`${file}: BGM wait has no numeric fallback`);
  if (!loadCode.includes("m.status==='render_claimed'")) throw new Error(`${file}: interrupted claim recovery missing`);
  if (!loadCode.includes('staleClaimMs=12*60*60*1000') || !loadCode.includes("fs.openSync(claimLock,'wx')") || !loadCode.includes('claim_lock:claimLock')) throw new Error(`${file}: concurrency-safe stale claim handling missing`);
  if (!loadCode.includes('duration_seconds:Number(incoming.duration_seconds||5)')) throw new Error(`${file}: default duration is not 5 seconds`);
  for (const name of ['KIE Create Image Task','KIE Get Image Task','KIE Get Image Task Retry','KIE Create BGM Task','KIE Get BGM Task','KIE Get BGM Task Retry','Local FFmpeg Render','Read Rendered MP4']) {
    const node = workflow.nodes.find((item) => item.name === name);
    if (!node?.retryOnFail || node.maxTries !== 3) throw new Error(`${file}: retry policy missing on ${name}`);
  }
  if (youtube.retryOnFail || youtube.maxTries) throw new Error(`${file}: non-idempotent YouTube upload must not auto-retry`);
  const attachMp4 = workflow.nodes.find((node) => node.name === 'Attach Downloaded MP4');
  if (!attachMp4.parameters.jsCode.includes("m.upload_stage='ready_to_upload'")) throw new Error(`${file}: pre-upload uncertainty marker missing`);
  const normalizeUpload = workflow.nodes.find((node) => node.name === 'Normalize YouTube Upload');
  if (!normalizeUpload.parameters.jsCode.includes("m.status='uploaded'") || !normalizeUpload.parameters.jsCode.includes('upload_committed_at')) throw new Error(`${file}: upload receipt is not committed before comment`);
  if (comment.onError !== 'continueRegularOutput') throw new Error(`${file}: comment failure can block upload finalization`);
}
if (new Set(ids).size !== 2) throw new Error('workflow IDs are not unique');

const db = new sqlite3.Database('.n8n/database.sqlite');
const rows = await new Promise((resolve, reject) => db.all(
  `SELECT id,name,nodes,connections FROM workflow_entity WHERE name LIKE '%원본 릴스 기반 쇼츠' ORDER BY name`,
  (error, value) => error ? reject(error) : resolve(value),
));
db.close();
if (rows.length !== 2) throw new Error(`expected 2 imported source workflows, got ${rows.length}`);
for (const row of rows) {
  const liveNodes = JSON.parse(row.nodes);
  const liveNames = new Set(liveNodes.map((node) => node.name));
  for (const node of liveNodes) for (const match of (node.parameters?.jsCode || '').matchAll(/\$\(['"]([^'"]+)['"]\)/g)) {
    if (!liveNames.has(match[1])) throw new Error(`${row.name}: live ${node.name} references missing node ${match[1]}`);
  }
  const upload = liveNodes.find((node) => node.name === 'YouTube Upload Public');
  const liveComment = liveNodes.find((node) => node.name === 'Post Top-Level Comment');
  if (upload?.retryOnFail || upload?.maxTries) throw new Error(`${row.name}: live DB upload auto-retry must be disabled`);
  const liveExpectedYoutube = row.name.startsWith('건강장수비결') ? expected.youtube.longevity : expected.youtube.haru;
  if (upload.credentials?.youTubeOAuth2Api?.id !== liveExpectedYoutube) throw new Error(`${row.name}: live DB wrong YouTube credential`);
  if (liveComment?.credentials?.youTubeOAuth2Api?.id !== liveExpectedYoutube) throw new Error(`${row.name}: live DB wrong comment credential`);
  const liveLoad = liveNodes.find((node) => node.name === 'Load Source Reel Bundle')?.parameters?.jsCode || '';
  if (!liveLoad.includes('poll_interval_seconds:30')) throw new Error(`${row.name}: live DB BGM poll config missing`);
  if (!liveLoad.includes('staleClaimMs=12*60*60*1000') || !liveLoad.includes("fs.openSync(claimLock,'wx')")) throw new Error(`${row.name}: live DB concurrency-safe claim missing`);
  if (!liveLoad.includes('duration_seconds:Number(incoming.duration_seconds||5)')) throw new Error(`${row.name}: live DB default duration is not 5 seconds`);
  const liveWait = liveNodes.find((node) => node.name === 'Wait BGM 30s');
  if (!String(liveWait?.parameters?.amount).includes('poll_interval_seconds || 30')) throw new Error(`${row.name}: live DB BGM wait fallback missing`);
  const sourceFile = files.find((file) => JSON.parse(fs.readFileSync(file, 'utf8')).id === row.id);
  const sourceWorkflow = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  const canonical = (value) => JSON.stringify(value, (key, item) => ['position','id','versionId'].includes(key) ? undefined : item);
  const liveWorkflow = { nodes: liveNodes, connections: JSON.parse(row.connections || '{}') };
  const fileWorkflow = { nodes: sourceWorkflow.nodes, connections: sourceWorkflow.connections };
  if (canonical(liveWorkflow) !== canonical(fileWorkflow)) throw new Error(`${row.name}: live DB workflow drift from source JSON`);
  delete row.nodes;
}
console.log(JSON.stringify({ ok: true, files: files.length, imported: rows, nodes_each: 42, retries: 3, contextual_comment: true, interrupted_claim_recovery: true, kie_credential: expected.kie, youtube_credentials: expected.youtube, upload_default: true, privacy_default: 'public' }));
