import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const workflowDir = path.join(root, 'workflows');
const exactComment = '좋아요와 구독 한 번씩 부탁드립니다.';
const require = createRequire(import.meta.url);

const cases = [
  {
    file: 'n8n_image_drop_haru_manual.json',
    id: 'haruImageDropShorts01',
    name: '하루건강약사 - 완성 이미지 기반 쇼츠',
    channelName: '하루건강약사',
    dropRoot: 'C:/dev/n8n-youtube-shorts-automation/하루건강약사 이미지',
    youtubeCredentialId: 'l7YqloikIKiIOtOq',
    youtubeCredentialName: 'YouTube account',
  },
  {
    file: 'n8n_image_drop_longevity_manual.json',
    id: 'longevityImageDropShorts01',
    name: '건강장수비결 - 완성 이미지 기반 쇼츠',
    channelName: '건강장수비결',
    dropRoot: 'C:/dev/n8n-youtube-shorts-automation/건강장수비결 이미지',
    youtubeCredentialId: 'kVQv10ElQmt2iazM',
    youtubeCredentialName: 'YouTube account 2',
  },
];

const requiredNodes = [
  'Manual Trigger',
  'Claim Next Image',
  'Read Claimed Image',
  'Upload Image for Vision',
  'Build Vision Copy Request',
  'Analyze Image with GPT-5.2',
  'Parse Vision Copy',
  'Use Live BGM?',
  'KIE Create BGM Task',
  'Normalize BGM Task',
  'Wait BGM 30s',
  'KIE Get BGM Task',
  'Parse BGM Result',
  'BGM Ready?',
  'Wait BGM Retry 90s',
  'KIE Get BGM Task Retry',
  'Parse BGM Result Final',
  'Use Live Render?',
  'Prepare Local FFmpeg Render',
  'Local FFmpeg Render',
  'Parse Local Render Result',
  'Read Rendered MP4',
  'Attach Downloaded MP4',
  'Allow YouTube Upload?',
  'YouTube Upload Public',
  'Normalize YouTube Upload',
  'Post Top-Level Comment',
  'Attach Comment Result',
  'Skip YouTube Upload',
  'Complete Image Drop',
];

function loadWorkflow(fileName) {
  return JSON.parse(fs.readFileSync(path.join(workflowDir, fileName), 'utf8'));
}

function byName(workflow, name) {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  assert.ok(node, `${workflow.id}: missing node ${name}`);
  return node;
}

function outgoing(workflow, name) {
  return (workflow.connections?.[name]?.main || []).flat().map((edge) => edge.node);
}

function reachableNodeNames(workflow) {
  const reached = new Set();
  const queue = ['Manual Trigger'];
  while (queue.length) {
    const name = queue.shift();
    if (reached.has(name)) continue;
    reached.add(name);
    for (const target of outgoing(workflow, name)) queue.push(target);
  }
  return reached;
}

function executeParseNode(workflow, fixture) {
  const code = byName(workflow, 'Parse Vision Copy').parameters.jsCode;
  const base = {
    claimed_path: `C:/fixture/${workflow.id}.png`,
    image_sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    config: { kie_bgm_model: 'V5_5' },
  };
  const input = { first: () => ({ json: fixture }) };
  const dollar = (name) => {
    assert.equal(name, 'Build Vision Copy Request');
    return { first: () => ({ json: base }) };
  };
  const run = new Function('$input', '$', code);
  return run(input, dollar)[0].json;
}

function executeCodeNodeWithDefinition(workflow, nodeName, definition, inputJson) {
  const original = byName(workflow, nodeName).parameters.jsCode;
  const code = original.replace(
    /^const channelDefinition = .*;$/m,
    `const channelDefinition = ${JSON.stringify(definition)};`,
  );
  const run = new Function('require', '$input', '$', code);
  return run(require, { first: () => ({ json: inputJson }) }, () => {
    throw new Error(`${nodeName}: unexpected cross-node lookup in behavior test`);
  });
}

function verifyImageLifecycle(workflow, testCase) {
  const etcRoot = path.join(root, 'etc');
  fs.mkdirSync(etcRoot, { recursive: true });
  const testRoot = fs.mkdtempSync(path.join(etcRoot, 'image-drop-verify-'));
  assert.ok(testRoot.startsWith(etcRoot + path.sep));
  const definition = {
    key: 'fixture',
    channelName: testCase.channelName,
    channelPurpose: 'fixture',
    dropRoot: testRoot,
  };
  try {
    const sourcePath = path.join(testRoot, 'sample-card.png');
    fs.writeFileSync(sourcePath, Buffer.from('89504e470d0a1a0a', 'hex'));
    const claimed = executeCodeNodeWithDefinition(workflow, 'Claim Next Image', definition, {})[0].json;
    assert.equal(claimed.original_image_name, 'sample-card.png');
    assert.ok(fs.existsSync(claimed.claimed_path));
    assert.ok(!fs.existsSync(sourcePath));
    assert.ok(fs.existsSync(claimed.config.workflow_lock_path));
    assert.equal(claimed.config.drop_root, testRoot);

    const completed = executeCodeNodeWithDefinition(workflow, 'Complete Image Drop', definition, {
      ...claimed,
      pack: { hook_title: '검증용 제목' },
      vision_analysis: { image_summary: '검증용 이미지', confidence: 'high' },
      youtube: { skipped: false, video_id: 'fixture-video', url: 'https://www.youtube.com/watch?v=fixture-video' },
    })[0].json;
    assert.equal(completed.image_drop.consumed, true);
    assert.ok(fs.existsSync(completed.image_drop.archived_path));
    assert.equal(path.dirname(completed.image_drop.archived_path), path.join(testRoot, '사용완료'));
    assert.ok(!fs.existsSync(claimed.config.workflow_lock_path));
    assert.match(fs.readFileSync(claimed.config.image_log_path, 'utf8'), /"result":"published"/);
    assert.match(fs.readFileSync(claimed.config.upload_log_path, 'utf8'), /"video_id":"fixture-video"/);
  } finally {
    fs.rmSync(testRoot, { recursive: true, force: true });
  }
}

const seenWorkflowIds = new Set();
const seenNodeIds = new Set();
for (const testCase of cases) {
  const workflow = loadWorkflow(testCase.file);
  assert.equal(workflow.id, testCase.id);
  assert.equal(workflow.name, testCase.name);
  assert.equal(workflow.active, false, `${workflow.id}: workflow must import inactive`);
  assert.ok(!seenWorkflowIds.has(workflow.id), `${workflow.id}: duplicate workflow ID`);
  seenWorkflowIds.add(workflow.id);

  const names = new Set(workflow.nodes.map((node) => node.name));
  assert.equal(names.size, workflow.nodes.length, `${workflow.id}: duplicate node name`);
  for (const node of workflow.nodes) {
    assert.ok(node.id, `${workflow.id}/${node.name}: missing node ID`);
    assert.ok(!seenNodeIds.has(node.id), `${workflow.id}/${node.name}: duplicate node ID across workflows`);
    seenNodeIds.add(node.id);
    const code = node.parameters?.jsCode;
    if (code) {
      assert.doesNotThrow(() => new Function(code), `${workflow.id}/${node.name}: invalid Code node JavaScript`);
      assert.ok(!code.includes('process.'), `${workflow.id}/${node.name}: process is unavailable in n8n Code nodes`);
      assert.ok(!/Bearer\s+[A-Za-z0-9_.-]+/.test(code), `${workflow.id}/${node.name}: embedded bearer token`);
    }
  }

  for (const name of requiredNodes) assert.ok(names.has(name), `${workflow.id}: required node missing: ${name}`);
  assert.ok(!workflow.nodes.some((node) => /Create Image Task|Get Image Task|Generate Image|Use Live Image/.test(node.name)), `${workflow.id}: image-generation node must not exist`);
  assert.ok(!workflow.nodes.some((node) => String(node.type).includes('executeCommand')), `${workflow.id}: unsupported Execute Command node`);

  const reached = reachableNodeNames(workflow);
  for (const node of workflow.nodes.filter((candidate) => candidate.type !== 'n8n-nodes-base.stickyNote')) {
    assert.ok(reached.has(node.name), `${workflow.id}: unreachable node ${node.name}`);
  }
  assert.deepEqual(outgoing(workflow, 'Manual Trigger'), ['Claim Next Image']);
  assert.ok(outgoing(workflow, 'Parse Vision Copy').includes('Use Live BGM?'));
  assert.ok(outgoing(workflow, 'Attach Comment Result').includes('Complete Image Drop'));
  assert.ok(outgoing(workflow, 'Skip YouTube Upload').includes('Complete Image Drop'));

  const claim = byName(workflow, 'Claim Next Image').parameters.jsCode;
  assert.match(claim, new RegExp(testCase.dropRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(claim, /crypto\.randomInt\(candidates\.length\)/);
  assert.match(claim, /fs\.renameSync\(sourcePath, claimedPath\)/);
  assert.match(claim, /\.png/);
  assert.match(claim, /\.jpe?g/);
  assert.match(claim, /\.webp/);
  assert.match(claim, /youtube_privacy_status:\s*'public'/);

  const imageUpload = byName(workflow, 'Upload Image for Vision');
  assert.equal(imageUpload.parameters.url, 'https://kieai.redpandaai.co/api/file-stream-upload');
  assert.equal(imageUpload.parameters.contentType, 'multipart-form-data');
  assert.equal(imageUpload.credentials?.httpHeaderAuth?.id, 'MV5JVbdiJSoVx9O8');
  assert.ok(imageUpload.parameters.bodyParameters.parameters.some((parameter) => parameter.parameterType === 'formBinaryData' && parameter.name === 'file' && parameter.inputDataFieldName === 'data'));

  const analyze = byName(workflow, 'Analyze Image with GPT-5.2');
  assert.equal(analyze.parameters.url, 'https://api.kie.ai/gpt-5-2/v1/chat/completions');
  assert.equal(analyze.credentials?.httpHeaderAuth?.id, 'MV5JVbdiJSoVx9O8');
  assert.equal(analyze.retryOnFail, true);
  assert.equal(analyze.maxTries, 3);

  const bgm = byName(workflow, 'KIE Create BGM Task');
  assert.equal(bgm.credentials?.httpHeaderAuth?.id, 'MV5JVbdiJSoVx9O8');
  const youtube = byName(workflow, 'YouTube Upload Public');
  assert.equal(youtube.credentials?.youTubeOAuth2Api?.id, testCase.youtubeCredentialId);
  assert.equal(youtube.credentials?.youTubeOAuth2Api?.name, testCase.youtubeCredentialName);
  assert.equal(youtube.parameters.options.privacyStatus, '={{$json.config.youtube_privacy_status || "public"}}');
  assert.equal(youtube.parameters.title, '={{$json.pack.hook_title}}');
  assert.equal(youtube.parameters.options.description, '={{$json.pack.description}}');

  const comment = byName(workflow, 'Post Top-Level Comment');
  assert.equal(comment.credentials?.youTubeOAuth2Api?.id, testCase.youtubeCredentialId);
  assert.equal(comment.continueOnFail, true);
  assert.equal(comment.onError, 'continueRegularOutput');
  assert.match(comment.parameters.jsonBody, /\$json\.pack\.pinned_comment/);

  const parsed = executeParseNode(workflow, {
    choices: [{
      message: {
        content: '```json\n' + JSON.stringify({
          image_summary: '식사 순서 안내 카드예요.',
          visible_text: ['채소부터 드세요', '천천히 씹어요'],
          youtube_title: '식사 순서만 바꿔도 편해지는 습관',
          description: '이미지에 적힌 식사 순서를 차근차근 확인해 보세요. 부담 없이 시작할 수 있는 습관이에요.',
          tags: ['식사습관', '#중년건강', '건강정보'],
          confidence: 'high',
        }) + '\n```',
      },
    }],
  });
  assert.equal(parsed.image_url, `C:/fixture/${workflow.id}.png`);
  assert.equal(parsed.pack.hook_title, '식사 순서만 바꿔도 편해지는 습관');
  assert.equal(parsed.pack.caption, parsed.pack.hook_title);
  assert.ok(parsed.pack.description.includes('#건강정보 #쇼츠'));
  assert.ok(parsed.pack.tags.includes(testCase.channelName));
  assert.ok(parsed.pack.tags.every((tag) => !tag.startsWith('#')));
  assert.equal(parsed.pack.pinned_comment, exactComment);
  assert.equal(parsed.vision_analysis.confidence, 'high');
  assert.equal(parsed.bgm_payload.instrumental, true);
  assert.ok(parsed.bgm_payload.prompt.length < 500);
  assert.equal(parsed.bgm_payload.model, 'V5_5');
  assert.equal(parsed.ai_source, 'kie_gpt_5_2_vision');

  assert.throws(() => executeParseNode(workflow, {
    choices: [{ message: { content: JSON.stringify({
      youtube_title: '이 방법이면 무조건 낫습니다',
      description: '약을 끊어도 괜찮아요.',
      tags: [],
    }) } }],
  }), /치료 보장 또는 진료 회피/);

  verifyImageLifecycle(workflow, testCase);
}

console.log(JSON.stringify({
  ok: true,
  workflows: cases.map((testCase) => testCase.id),
  checks: [
    'structure',
    'connections',
    'code_syntax',
    'credential_routing',
    'vision_upload',
    'vision_copy_parsing',
    'image_claim_and_archive',
    'medical_claim_block',
    'bgm_contract',
    'public_upload_contract',
    'exact_comment',
  ],
}, null, 2));
