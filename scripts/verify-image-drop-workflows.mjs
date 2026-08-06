import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import {
  BGM_CONSTRAINT_LINES,
  BGM_PROFILE_POOL,
  BGM_ARRANGEMENT_AXES,
  BGM_STYLE_MAX_CHARS,
  composeBgmStyle,
} from './lib/bgm-variation.mjs';

const root = path.resolve(import.meta.dirname, '..');
const workflowDir = path.join(root, 'workflows');
const exactComment = '좋아요와 구독 한 번씩 부탁드립니다.';
const require = createRequire(import.meta.url);

const cases = [
  {
    file: 'n8n_image_drop_haru_manual.json',
    id: 'haruImageDropShorts01',
    name: '하루건강약사 · 완성 이미지',
    channelName: '하루건강약사',
    dropRoot: 'G:/내 드라이브/영상 편집/AI 크리에이터/영상 데이터/카드뉴스_이미지/하루건강약사',
    youtubeCredentialId: 'l7YqloikIKiIOtOq',
    youtubeCredentialName: 'YouTube account',
    captionRoot: 'G:/내 드라이브/영상 편집/AI 크리에이터/영상 데이터/캡션',
  },
  {
    file: 'n8n_image_drop_longevity_manual.json',
    id: 'longevityImageDropShorts01',
    name: '건강장수비결 · 완성 이미지',
    channelName: '건강장수비결',
    dropRoot: 'G:/내 드라이브/영상 편집/AI 크리에이터/영상 데이터/카드뉴스_이미지/건강장수비결',
    youtubeCredentialId: 'kVQv10ElQmt2iazM',
    youtubeCredentialName: 'YouTube account 2',
    captionRoot: 'G:/내 드라이브/영상 편집/AI 크리에이터/영상 데이터/캡션',
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

function executeCodeNodeWithDefinition(workflow, nodeName, definition, inputJson, lookups = null) {
  const original = byName(workflow, nodeName).parameters.jsCode;
  // 픽스처는 dropRoot·captionRoot만 바꾸고 나머지(BGM 풀 등)는 실제 빌드된 값을
  // 그대로 써야 한다. 통째로 교체하면 테스트가 진짜 설정을 검사하지 않는다.
  const builtDefinition = original.match(/^const channelDefinition = (.*);$/m);
  assert.ok(builtDefinition, `${nodeName}: channelDefinition line not found`);
  const merged = { ...JSON.parse(builtDefinition[1]), ...definition };
  const code = original.replace(
    /^const channelDefinition = .*;$/m,
    `const channelDefinition = ${JSON.stringify(merged)};`,
  );
  const run = new Function('require', '$input', '$', code);
  return run(require, { first: () => ({ json: inputJson }) }, (name) => {
    // 노드가 앞 노드를 참조하면 그 값을 픽스처로 넘겨야 한다. 안 넘겼는데 참조하면
    // 조용히 undefined를 주지 말고 멈춘다 — 그래야 테스트가 진짜 계약을 검사한다.
    if (lookups && Object.prototype.hasOwnProperty.call(lookups, name)) {
      return { first: () => ({ json: lookups[name] }) };
    }
    throw new Error(`${nodeName}: unexpected cross-node lookup in behavior test: ${name}`);
  });
}

// 캡션 문안 경로. 이미지에서 글자를 역산하지 않고 카드뉴스 캡션 원문을 쓴다.
// 여기서 지키는 계약: 원문 항목이 하나도 안 빠지고, 고정 댓글이 260자 이내로
// 채널 마무리 줄로 끝나고, 캡션이 없으면 vision 경로로 폴백한다.
// 유튜브 제목 후킹 재작성. 여기서 지키는 계약: 카드 원문(pack.hook_title)은 그대로 두고
// youtube_title만 바뀐다, 없는 숫자를 넣으면 거부한다, 호출이 실패하면 원문으로 발행한다.
function verifyHookTitleRewrite(workflow, testCase) {
  const channelKey = testCase.id === 'haruImageDropShorts01' ? 'haru' : 'longevity';
  const definition = { key: channelKey, channelName: testCase.channelName, channelPurpose: 'fixture' };

  const pack = {
    hook_title: '다이어트 라면 등급표',
    subtitle: '살찌는 기준은 정제 탄수화물 + 지방 조합',
    rank_items: [
      { rank: 1, card_name: '신라면 건면', card_reason: '기름에 안 튀겨요' },
      { rank: 2, card_name: '짜파게티', card_reason: '지방이 많아요' },
    ],
    description: '다이어트 라면 등급표\n\n신라면 건면 - 기름에 안 튀겨요',
    pinned_comment: '오늘 영상 핵심 정리\n다이어트 라면 등급표\n\n신라면 건면',
  };
  const base = { pack, config: { use_live_hook_rewrite: true } };

  // 요청 프롬프트가 본편의 후킹 규칙과 카드 행을 실제로 싣는가.
  const request = executeCodeNodeWithDefinition(workflow, 'Build Hook Title Request', definition, base)[0].json;
  const prompt = request.hook_title_request.messages[0].content;
  assert.match(prompt, /HOOK_PATTERNS:/, `${testCase.file}: writer hook rules were not carried into the retitle prompt`);
  assert.match(prompt, /ATTENTION_PROMISE_V2:/, `${testCase.file}: retitle prompt lost the attention contract`);
  assert.match(prompt, /신라면 건면 - 기름에 안 튀겨요/, `${testCase.file}: the card rows were not supplied to the retitler`);
  assert.match(prompt, /WORKING TITLE: 다이어트 라면 등급표/, `${testCase.file}: the working title was not supplied`);

  const respond = (content) => executeCodeNodeWithDefinition(
    workflow,
    'Parse Hook Title',
    definition,
    { choices: [{ message: { content } }] },
    { 'Build Hook Title Request': request },
  )[0].json;

  const good = respond('{"youtube_title":"라면 끊기 전에 이것부터 바꿔 보세요"}');
  assert.equal(good.pack.youtube_title, '라면 끊기 전에 이것부터 바꿔 보세요');
  assert.equal(good.pack.hook_title, '다이어트 라면 등급표', `${testCase.file}: hook_title must stay put — the duplicate guard matches on it`);
  assert.ok(good.pack.description.startsWith('라면 끊기 전에'), `${testCase.file}: the description kept the old title`);
  assert.equal(good.pack.pinned_comment.split('\n')[1], '라면 끊기 전에 이것부터 바꿔 보세요', `${testCase.file}: the pinned comment kept the old title`);
  assert.equal(good.hook_title_rewrite.applied, true);

  // 원문에 없는 숫자는 지어낸 통계다. 거부하고 원문으로 간다.
  const invented = respond('{"youtube_title":"라면 먹고 87퍼센트가 후회하는 이유 정리"}');
  assert.equal(invented.pack.youtube_title, '다이어트 라면 등급표', `${testCase.file}: an invented number was published`);
  assert.match(invented.hook_title_rewrite.reason, /invented_number_87/);

  // 원문에 있는 숫자는 써도 된다.
  const kept = respond('{"youtube_title":"라면 고르기 전에 확인할 기준 1가지만"}');
  assert.equal(kept.pack.youtube_title, '라면 고르기 전에 확인할 기준 1가지만', `${testCase.file}: a number present in the source was rejected`);

  for (const [label, content] of [
    ['too short', '{"youtube_title":"라면 등급"}'],
    ['hashtag', '{"youtube_title":"#다이어트 라면 이렇게 고르세요 정리"}'],
    ['not json', 'sorry, I cannot do that'],
  ]) {
    const rejected = respond(content);
    assert.equal(rejected.pack.youtube_title, '다이어트 라면 등급표', `${testCase.file}: ${label} response was published`);
    assert.equal(rejected.hook_title_rewrite.applied, false);
  }

  // 호출 자체가 죽어도 발행은 계속된다. 제목 하나 때문에 런을 버리지 않는다.
  const httpNode = byName(workflow, 'Rewrite Hook Title');
  assert.equal(httpNode.onError, 'continueRegularOutput', `${testCase.file}: a failed retitle call would kill the run`);
  const dead = respond('');
  assert.equal(dead.pack.youtube_title, '다이어트 라면 등급표');

  // 업로드 노드가 다시 쓴 제목을 실제로 쓰는가.
  assert.equal(
    byName(workflow, 'YouTube Upload Public').parameters.title,
    '={{$json.pack.youtube_title || $json.pack.hook_title}}',
    `${testCase.file}: the upload node still sends the un-hooked title`,
  );
  // 드라이런은 LLM을 부르지 않는다.
  assert.deepEqual(
    outgoing(workflow, 'Use Hook Rewrite?'),
    ['Build Hook Title Request', 'Use Live BGM?'],
    `${testCase.file}: the retitle bypass is not wired`,
  );
}

function verifyCardCopyPath(workflow, testCase) {
  // 하루건강약사는 인스타에도 올려 '팔로우', 건강장수비결은 유튜브 전용이라 '구독'.
  const channelKey = testCase.id === 'haruImageDropShorts01' ? 'haru' : 'longevity';
  const closing = channelKey === 'haru'
    ? '몸에 도움 되는 정보를 매일 하나씩 전해 드려요. 팔로우해 두시면 놓치지 않고 받아보실 수 있어요.'
    : '건강하게 나이 드는 습관을 매일 하나씩 전해 드려요. 구독해 두시면 놓치지 않고 받아보실 수 있어요.';
  const etcRoot = path.join(root, 'etc');
  fs.mkdirSync(etcRoot, { recursive: true });
  const captionRoot = fs.mkdtempSync(path.join(etcRoot, 'card-copy-verify-'));
  assert.ok(captionRoot.startsWith(etcRoot + path.sep));

  const connections = workflow.connections;
  assert.deepEqual(
    connections['Claim Next Image'].main[0].map((c) => c.node),
    ['Load Card Copy'],
    `${testCase.file}: Claim Next Image must hand off to the caption lookup`,
  );
  assert.deepEqual(
    connections['Card Copy Found?'].main[0].map((c) => c.node),
    ['Build Pack From Card Copy'],
    `${testCase.file}: caption-found branch must skip vision`,
  );
  assert.deepEqual(
    connections['Card Copy Found?'].main[1].map((c) => c.node),
    ['Read Claimed Image'],
    `${testCase.file}: caption-missing branch must fall back to the vision chain`,
  );
  assert.deepEqual(
    connections['Build Pack From Card Copy'].main[0].map((c) => c.node),
    ['Use Hook Rewrite?'],
    `${testCase.file}: caption pack must reach the retitle stage before BGM`,
  );

  const definition = {
    key: channelKey,
    channelName: testCase.channelName,
    channelPurpose: 'fixture',
    dropRoot: testCase.dropRoot,
    selectShortsByAspect: true,
    captionRoot,
  };
  const claimed = {
    original_image_name: '07_검증용 카드_.png',
    claimed_path: path.join(testCase.dropRoot, '처리중', 'fixture.png'),
    image_sha256: 'abcdef0123456789',
    config: { channel_name: testCase.channelName, kie_bgm_model: 'V5_5' },
  };

  try {
    // 라벨 종류를 섞어 둔다: 순위, 문자 등급, 우리말 등급, 설명 없는 항목.
    fs.writeFileSync(path.join(captionRoot, '07_검증용 카드.caption.txt'), [
      '검증용 카드 제목',
      '',
      '기준: 검증용 분류 기준',
      '',
      '1. 첫째 항목 (1위)',
      '→ 첫째 항목의 이유예요',
      '⚠ 첫째 항목 주의사항이에요',
      '',
      '2. [S] 둘째 항목',
      '→ 둘째 항목의 이유예요',
      '',
      '3. 셋째 항목 (추천)',
      '',
      '4. 넷째 항목',
      '→ 넷째 항목의 이유예요',
      '',
      '──────────',
      '🔖 저장해두면 좋아요',
      '※ 일반적인 건강 정보예요.',
    ].join('\n'), 'utf8');

    const loaded = executeCodeNodeWithDefinition(workflow, 'Load Card Copy', definition, claimed)[0].json;
    assert.equal(loaded.card_copy_found, true, `${testCase.file}: caption lookup missed the NN_ prefix match`);
    assert.equal(loaded.card_copy.items.length, 4, `${testCase.file}: caption items were dropped`);
    assert.equal(loaded.card_copy.title, '검증용 카드 제목');
    assert.equal(loaded.card_copy.basis, '검증용 분류 기준');
    assert.ok(
      loaded.card_copy.items.every((item) => !/저장해두면|일반적인 건강 정보/.test(item.name)),
      `${testCase.file}: CTA/disclaimer block leaked into the items`,
    );

    const built = executeCodeNodeWithDefinition(workflow, 'Build Pack From Card Copy', definition, loaded)[0].json;
    assert.equal(built.ai_source, 'card_news_caption');
    assert.equal(built.image_ready, true);
    assert.equal(built.image_url, claimed.claimed_path);
    assert.equal(built.pack.hook_title, '검증용 카드 제목');
    const description = built.pack.description;
    // 라벨 종류별 렌더 규칙: 순위는 앞에, 문자 등급은 대괄호, 나머지는 괄호 뒤.
    // 구분자는 메인 워크플로우와 같은 ' - '다.
    assert.match(description, /1위 첫째 항목 - 첫째 항목의 이유예요 \(주의: 첫째 항목 주의사항이에요\)/);
    assert.match(description, /\[S\] 둘째 항목 - 둘째 항목의 이유예요/);
    assert.match(description, /셋째 항목 \(추천\)/);
    assert.match(description, /넷째 항목 - 넷째 항목의 이유예요/);
    assert.ok(description.includes(closing), `${testCase.file}: description lost the channel closing line`);
    assert.ok(description.split('\n').length >= 5, `${testCase.file}: description collapsed onto one line`);
    // 메인과 같은 구조: 항목 사이 빈 줄, 섹션 사이 빈 줄.
    assert.match(description, /^검증용 카드 제목\n\n검증용 분류 기준\n\n1위 첫째 항목/);
    assert.ok(description.endsWith(closing), `${testCase.file}: description must end with the closing line`);

    // 고정 댓글도 메인 워크플로우 조립을 그대로 따른다: 머리말 / 제목 / 빈 줄 /
    // 항목 한 줄씩 / 빈 줄 / 마무리. 길이를 잘라 붙이지 않는다.
    const comment = built.pack.pinned_comment;
    assert.ok(comment.startsWith('오늘 영상 핵심 정리\n검증용 카드 제목\n\n'), `${testCase.file}: pinned comment header does not match the main workflow`);
    assert.ok(comment.endsWith('\n\n' + closing), `${testCase.file}: pinned comment must end with a blank line then the closing line`);
    assert.match(comment, /\n1위 첫째 항목 - 첫째 항목의 이유예요/);
    assert.ok(
      !/\n\n1위[\s\S]*\n\n\[S\]/.test(comment),
      `${testCase.file}: pinned comment rows must be single-spaced, unlike the description`,
    );
    assert.ok(built.pack.tags.includes('건강정보') && built.pack.tags.length <= 12);

    assert.throws(() => executeCodeNodeWithDefinition(workflow, 'Build Pack From Card Copy', definition, {
      ...loaded,
      card_copy: { ...loaded.card_copy, items: [{ rank: 1, label: '', name: '약을 끊어도 괜찮아요', description: '무조건 낫습니다', note: '' }] },
    }), /치료 보장 또는 진료 회피/, `${testCase.file}: caption path lost the medical-claim block`);

    // 접두어가 없거나 캡션이 없으면 vision 경로로 흘러야 한다.
    const noPrefix = executeCodeNodeWithDefinition(workflow, 'Load Card Copy', definition, {
      ...claimed,
      original_image_name: '접두어없는카드.png',
    })[0].json;
    assert.equal(noPrefix.card_copy_found, false);
    assert.ok(noPrefix.card_copy_skip_reason.length > 0);

    const unknownPrefix = executeCodeNodeWithDefinition(workflow, 'Load Card Copy', definition, {
      ...claimed,
      original_image_name: '99_없는 번호_.png',
    })[0].json;
    assert.equal(unknownPrefix.card_copy_found, false);
  } finally {
    fs.rmSync(captionRoot, { recursive: true, force: true });
  }
}

// 완성 카드는 렌더 단계에서 줄이면 안 된다.
//
// 이 회로가 집는 건 카드뉴스 파이프라인이 이미 완성한 9:16 풀블리드 카드다. 그림이
// 네 변까지 차 있어 안전영역 검사는 언제나 violation을 내고, 9:16은 안전 상자보다
// 세로로 길어 높이가 먼저 걸린다. auto로 두면 예외 없이 0.66배로 줄어들어 블러 테두리가
// 둘린 채 올라간다 — 발행된 941x1672 카드로 scale 0.6604를 실측했다(2026-08-03).
//
// 값이 config에 박혀 있는 것만으로는 부족하다. 레퍼런스 카드 회로에서 Normalize Image
// Task가 중간에 base를 갈아끼우며 정책을 통째로 흘린 전례가 있다. 그래서 BGM 분기를
// 지나 렌더 페이로드에 실제로 도착하는지까지 본다.
function verifyFullFrameRenderPolicy(workflow, testCase) {
  const runCloned = (nodeName, inputJson, lookups = {}) => {
    const code = byName(workflow, nodeName).parameters.jsCode;
    const run = new Function('require', '$input', '$', code);
    return run(require, { first: () => ({ json: inputJson }) }, (name) => {
      assert.ok(name in lookups, `${testCase.file} ${nodeName}: unexpected cross-node lookup ${name}`);
      return { first: () => ({ json: lookups[name] }) };
    });
  };

  const claim = byName(workflow, 'Claim Next Image').parameters.jsCode;
  assert.match(claim, /safe_zone_mode:\s*'off'/, `${testCase.file}: finished cards must bypass post-render shrinking`);
  assert.match(claim, /image_drop_frame_mode:\s*'full_frame_9x16'/, `${testCase.file}: full-frame policy marker missing`);

  const config = {
    safe_zone_mode: 'off',
    image_drop_frame_mode: 'full_frame_9x16',
    kie_bgm_model: 'V5_5',
    duration_seconds: 5,
    local_render_dir: 'C:/fixture/renders',
    local_render_script: 'C:/dev/n8n-youtube-shorts-automation/scripts/render-static-card.mjs',
    ffmpeg_path: 'C:/fixture/ffmpeg.exe',
    node_path: 'C:/fixture/node.exe',
  };
  const claimed = { config, image_url: 'C:/fixture/card.png' };

  const normalizedBgm = runCloned('Normalize BGM Task', { data: { taskId: 'fixture-bgm-task' } }, {
    'Use Live BGM?': claimed,
  })[0].json;
  assert.equal(normalizedBgm.config?.safe_zone_mode, 'off', `${testCase.file}: BGM task normalization discarded the full-frame policy`);

  const parsedBgm = runCloned('Parse BGM Result', {
    data: { status: 'SUCCESS', response: { sunoData: [{ audioUrl: 'C:/fixture/card.mp3', duration: 30 }] } },
  }, { 'Normalize BGM Task': normalizedBgm })[0].json;
  assert.equal(parsedBgm.config?.safe_zone_mode, 'off', `${testCase.file}: BGM parsing discarded the full-frame policy`);

  const renderPrepared = runCloned('Prepare Local FFmpeg Render', parsedBgm)[0].json;
  assert.equal(
    renderPrepared.render_payload.safe_zone_mode,
    'off',
    `${testCase.file}: full-frame mode never reached the renderer; finished cards will ship at 0.66 scale`,
  );
}

// image_drop의 BGM 프롬프트는 메인 워크플로우와 같아야 한다. 예전에 image_drop 쪽
// 금지 목록이 더 짧아(chant·ooh/aah·vocal chops·wordless vocals 누락, 악기
// 화이트리스트 없음) 허밍 섞인 BGM이 나왔다. 두 회로가 갈리면 여기서 잡는다.
function verifyBgmParityWithMainWorkflow(workflow, testCase) {
  const mainFile = fs.readdirSync(workflowDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => ({ name, workflow: JSON.parse(fs.readFileSync(path.join(workflowDir, name), 'utf8')) }))
    .find((entry) => entry.workflow.id === 'mxrYb3maJS31gEYC');
  assert.ok(mainFile, 'main workflow mxrYb3maJS31gEYC not found; BGM parity cannot be checked');

  const mainCode = mainFile.workflow.nodes.find((n) => n.name === 'Prepare Image and BGM Payloads').parameters.jsCode;
  const requiredLines = BGM_CONSTRAINT_LINES;
  for (const line of requiredLines) {
    assert.ok(mainCode.includes(line), `main workflow no longer carries the BGM line "${line}" — fix scripts/lib/bgm-variation.mjs first`);
  }

  // 문장이 코드에 있는지만 보면 안 된다. 이 회로는 완성된 프롬프트를 480자에서 잘랐고,
  // 그 바람에 타악기 금지와 단조 금지 문장이 Suno에 아예 전달되지 않은 채 몇 주를
  // 통과했다(2026-08-06 실측 636자). 그래서 실제로 나가는 문자열 길이를 여기서 잰다.
  const worstProfile = [...BGM_PROFILE_POOL].sort((left, right) => right.prompt.length - left.prompt.length)[0];
  const longestArrangement = Object.values(BGM_ARRANGEMENT_AXES)
    .map((options) => [...options].sort((left, right) => right.length - left.length)[0])
    .join('; ');
  const worstCaseStyle = composeBgmStyle({
    profileId: worstProfile.id,
    profilePrompt: worstProfile.prompt,
    arrangementLine: `Arrangement for this piece: ${longestArrangement}.`,
  });
  for (const line of requiredLines) {
    assert.ok(
      worstCaseStyle.includes(line),
      `the longest possible BGM style drops the safety line "${line.slice(0, 40)}..." before it reaches Suno`,
    );
  }
  assert.ok(worstCaseStyle.length <= BGM_STYLE_MAX_CHARS, `worst-case BGM style is ${worstCaseStyle.length} chars, over the ${BGM_STYLE_MAX_CHARS} cap`);

  const copyNodes = ['Parse Vision Copy', ...(testCase.captionRoot ? ['Build Pack From Card Copy'] : [])];
  for (const nodeName of copyNodes) {
    const code = workflow.nodes.find((n) => n.name === nodeName).parameters.jsCode;
    for (const line of requiredLines) {
      assert.ok(code.includes(line), `${testCase.file} ${nodeName}: BGM prompt is missing "${line}"`);
    }
    // 예전의 짧은 금지 문장이 되살아나면 실패시킨다.
    assert.ok(
      !/humming, choir, percussion/.test(code),
      `${testCase.file} ${nodeName}: the old short vocal-ban line is back; humming will leak into the BGM`,
    );
    for (const profileId of ['intimate_felt_piano', 'grounded_nylon_guitar', 'daylight_guitar_piano', 'restorative_strings_piano']) {
      assert.ok(code.includes(profileId), `${testCase.file} ${nodeName}: BGM profile pool is missing ${profileId}`);
    }
  }
}

// Claim Next Image가 픽셀 크기로 비율을 판정하므로, 픽스처도 IHDR에 실제 크기를
// 담은 PNG여야 한다. 서명 8바이트만 있는 파일은 판정 불가로 후보에서 빠진다.
function pngWithSize(width, height) {
  const buffer = Buffer.alloc(33, 0);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function verifyImageLifecycle(workflow, testCase) {
  const etcRoot = path.join(root, 'etc');
  fs.mkdirSync(etcRoot, { recursive: true });
  const testRoot = fs.mkdtempSync(path.join(etcRoot, 'image-drop-verify-'));
  assert.ok(testRoot.startsWith(etcRoot + path.sep));
  // 채널 폴더 우선 규칙을 검사하려면 공용 루트도 픽스처로 만들어야 한다.
  const sharedRoot = fs.mkdtempSync(path.join(etcRoot, 'image-drop-shared-'));
  const definition = {
    key: 'fixture',
    channelName: testCase.channelName,
    channelPurpose: 'fixture',
    dropRoot: testRoot,
    fallbackDropRoot: sharedRoot,
  };
  try {
    const sourcePath = path.join(testRoot, 'sample-card.png');
    fs.writeFileSync(sourcePath, pngWithSize(1080, 1920));
    // 세로 쇼츠만 집는 채널에서는 같은 폴더의 4:5 인스타 카드를 절대 집지 않아야 한다.
    const instagramPath = path.join(testRoot, 'sample-instagram-card.png');
    if (testCase.captionRoot) fs.writeFileSync(instagramPath, pngWithSize(1080, 1350));
    const claimed = executeCodeNodeWithDefinition(workflow, 'Claim Next Image', definition, {})[0].json;
    assert.equal(claimed.original_image_name, 'sample-card.png');
    assert.equal(claimed.claimed_from_shared_root, false, `${testCase.file}: the channel folder must win over the shared root`);
    assert.ok(fs.existsSync(claimed.claimed_path));
    assert.ok(!fs.existsSync(sourcePath));
    if (testCase.captionRoot) {
      assert.ok(fs.existsSync(instagramPath), `${testCase.file}: the 4:5 card was claimed; only 9:16 may be published`);
    }
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

    // 채널 폴더가 비면 공용 루트에 그냥 둔 카드도 집고, 처리중은 채널 폴더에 남는다.
    // 채널 폴더로 옮기는 걸 잊었을 때 실행이 막히지 않게 하는 장치다.
    const strayPath = path.join(sharedRoot, 'stray-card.png');
    fs.writeFileSync(strayPath, pngWithSize(1080, 1920));
    const adopted = executeCodeNodeWithDefinition(workflow, 'Claim Next Image', definition, {})[0].json;
    assert.equal(adopted.original_image_name, 'stray-card.png', `${testCase.file}: a card left in the shared root was not picked up`);
    assert.equal(adopted.claimed_from_shared_root, true, `${testCase.file}: shared-root adoption must be flagged`);
    assert.ok(
      adopted.claimed_path.startsWith(testRoot + path.sep),
      `${testCase.file}: an adopted card must be processed inside the channel folder`,
    );
    assert.ok(!fs.existsSync(strayPath), `${testCase.file}: the adopted card should leave the shared root`);

    // 위 claim이 잡은 회로 잠금을 풀어야 다음 claim이 돈다. 실제 실행에서도 완료 노드가
    // 잠금을 푸는 유일한 지점이다. 소비까지 시켜서 대기열을 비운다 — 반납하면 이 카드가
    // 큐에 남아 다음 claim이 무엇을 집을지 흔들린다.
    executeCodeNodeWithDefinition(workflow, 'Complete Image Drop', definition, {
      ...adopted,
      pack: { hook_title: '반납 검증' },
      youtube: { skipped: false, video_id: 'stray-video', url: 'https://www.youtube.com/watch?v=stray-video' },
    });

    // 발행이 끝나면 4:5 인스타 쌍둥이도 같이 치운다. 카드뉴스 프롬프트 하나가 두 장을
    // 만드는데 쇼츠 회로는 9:16만 집으므로, 안 치우면 4:5가 드롭 폴더에 영원히 남는다.
    // 실제로 발행이 끝난 카드가 남아 있어 "왜 또 스킵되지"로 이어졌다(2026-08-04).
    const twinShorts = path.join(testRoot, '07_쌍둥이 카드_.png');
    const twinInstagram = path.join(sharedRoot, '07_쌍둥이 카드.png');
    // 번호만 같고 이름이 다른 카드는 건드리면 안 된다.
    const unrelated = path.join(sharedRoot, '07_다른 카드.png');
    fs.writeFileSync(twinShorts, pngWithSize(1080, 1920));
    fs.writeFileSync(twinInstagram, pngWithSize(1122, 1402));
    fs.writeFileSync(unrelated, pngWithSize(1122, 1402));

    const twinClaimed = executeCodeNodeWithDefinition(workflow, 'Claim Next Image', definition, {})[0].json;
    assert.equal(twinClaimed.original_image_name, '07_쌍둥이 카드_.png', `${testCase.file}: the 9:16 twin should be the one claimed`);
    const twinCompleted = executeCodeNodeWithDefinition(workflow, 'Complete Image Drop', definition, {
      ...twinClaimed,
      pack: { hook_title: '쌍둥이 검증' },
      youtube: { skipped: false, video_id: 'twin-video', url: 'https://www.youtube.com/watch?v=twin-video' },
    })[0].json;
    assert.ok(
      !fs.existsSync(twinInstagram),
      `${testCase.file}: the 4:5 twin stayed in the drop folder after its 9:16 published`,
    );
    assert.ok(
      fs.existsSync(path.join(testRoot, '사용완료', '07_쌍둥이 카드.png')),
      `${testCase.file}: the 4:5 twin was removed but never landed in 사용완료`,
    );
    assert.deepEqual(
      twinCompleted.image_drop.archived_twins?.map((p) => path.basename(p)),
      ['07_쌍둥이 카드.png'],
      `${testCase.file}: the archived twin was not recorded`,
    );
    assert.ok(
      fs.existsSync(unrelated),
      `${testCase.file}: a different card sharing the NN_ number was swept up`,
    );

    // 업로드가 안 된 실행은 아무것도 소비하지 않는다. 쌍둥이도 그대로 둬야 한다.
    const keptShorts = path.join(testRoot, '08_보류 카드_.png');
    const keptInstagram = path.join(testRoot, '08_보류 카드.png');
    fs.writeFileSync(keptShorts, pngWithSize(1080, 1920));
    fs.writeFileSync(keptInstagram, pngWithSize(1122, 1402));
    const keptClaimed = executeCodeNodeWithDefinition(workflow, 'Claim Next Image', definition, {})[0].json;
    executeCodeNodeWithDefinition(workflow, 'Complete Image Drop', definition, {
      ...keptClaimed,
      pack: { hook_title: '보류 검증' },
      youtube: { skipped: true, reason: 'dry_run' },
    });
    assert.ok(
      fs.existsSync(keptInstagram),
      `${testCase.file}: a run that published nothing still consumed the 4:5 twin`,
    );
  } finally {
    fs.rmSync(testRoot, { recursive: true, force: true });
    fs.rmSync(sharedRoot, { recursive: true, force: true });
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
  // 두 경로 모두 제목 재작성 단계를 거쳐 BGM으로 간다.
  assert.ok(outgoing(workflow, 'Parse Vision Copy').includes('Use Hook Rewrite?'));
  assert.ok(outgoing(workflow, 'Parse Hook Title').includes('Use Live BGM?'));
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
  // 후킹으로 다시 쓴 제목을 우선 쓰되, 재작성이 꺼졌거나 실패하면 캡션 원문으로 떨어진다.
  assert.equal(youtube.parameters.title, '={{$json.pack.youtube_title || $json.pack.hook_title}}');
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
  assert.equal(workflow.nodes.find((node) => node.name === 'KIE Create BGM Task')?.parameters?.url, 'https://api.kie.ai/api/v1/generate');
  assert.equal(parsed.bgm_payload.customMode, true);
  assert.equal(parsed.bgm_payload.instrumental, true);
  assert.ok(parsed.bgm_payload.style.length <= 1000);
  assert.match(parsed.bgm_payload.style, /Bright, cheerful, warm, optimistic major-key/i);
  assert.match(parsed.bgm_payload.style, /No voice, vocals.*humming.*wordless vocals/i);
  assert.ok(parsed.bgm_payload.title.length <= 80);
  assert.match(parsed.bgm_payload.negativeTags, /voice.*humming.*wordless vocals/i);
  assert.equal(parsed.bgm_payload.prompt, undefined);
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
  verifyFullFrameRenderPolicy(workflow, testCase);
  verifyBgmParityWithMainWorkflow(workflow, testCase);
  if (testCase.captionRoot) verifyCardCopyPath(workflow, testCase);
  verifyHookTitleRewrite(workflow, testCase);
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
    'card_copy_from_caption',
    'hook_title_rewrite',
    'full_frame_render_policy',
    'bgm_parity_with_main_workflow',
    'medical_claim_block',
    'bgm_contract',
    'public_upload_contract',
    'exact_comment',
  ],
}, null, 2));
