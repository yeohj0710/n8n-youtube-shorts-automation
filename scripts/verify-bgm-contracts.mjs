import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  BGM_PROFILE_POOL,
  BGM_CONSTRAINT_LINES,
  BGM_NEGATIVE_TAGS,
  BGM_NEGATIVE_TAGS_MAX_CHARS,
  BGM_ARRANGEMENT_AXES,
  BGM_STYLE_MAX_CHARS,
  BGM_STYLE_WEIGHT,
  BGM_WEIRDNESS,
  BGM_WEIRDNESS_CEILING,
  BGM_RETRY_WAIT_SECONDS,
  bgmArrangementCombinationCount,
  bgmArrangementSource,
} from './lib/bgm-variation.mjs';

const root = path.resolve(import.meta.dirname, '..');
const workflowDir = path.join(root, 'workflows');
const musicCreateUrl = 'https://api.kie.ai/api/v1/generate';
const musicPollUrl = 'https://api.kie.ai/api/v1/generate/record-info';
const callbackSinkUrl = 'https://httpbin.org/status/200';

const workflows = fs.readdirSync(workflowDir)
  .filter((name) => name.endsWith('.json'))
  .map((name) => ({
    name,
    workflow: JSON.parse(fs.readFileSync(path.join(workflowDir, name), 'utf8')),
  }))
  .filter(({ workflow }) => workflow.nodes?.some((node) => node.name === 'KIE Create BGM Task'));

assert.equal(workflows.length, 7, 'all seven Shorts workflows with generated BGM must be covered');

for (const { name, workflow } of workflows) {
  const create = workflow.nodes.find((node) => node.name === 'KIE Create BGM Task');
  const polls = workflow.nodes.filter((node) => ['KIE Get BGM Task', 'KIE Get BGM Task Retry'].includes(node.name));
  const payloadBuilders = workflow.nodes
    .map((node) => ({ name: node.name, code: String(node.parameters?.jsCode || '') }))
    .filter(({ code }) => /bgm_payload\s*[:=]/.test(code) && /instrumental\s*:/.test(code));

  assert.equal(create.parameters?.url, musicCreateUrl, `${name}: BGM uses the sound-effects endpoint instead of music generation`);
  assert.match(String(create.parameters?.jsonBody || ''), /callBackUrl/, `${name}: required KIE music callback URL is missing from the create request`);
  assert.match(String(create.parameters?.jsonBody || ''), new RegExp(callbackSinkUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${name}: polling workflow has no reachable 200 callback sink`);
  assert.equal(polls.length, 2, `${name}: expected both initial and retry music polls`);
  for (const poll of polls) {
    assert.equal(poll.parameters?.url, musicPollUrl, `${name} ${poll.name}: wrong music status endpoint`);
  }
  assert.ok(payloadBuilders.length > 0, `${name}: no BGM payload builder found`);

  for (const builder of payloadBuilders) {
    const label = `${name} ${builder.name}`;
    assert.match(builder.code, /customMode\s*:\s*true/, `${label}: custom music mode is required for a reliable instrumental flag`);
    assert.match(builder.code, /instrumental\s*:\s*true/, `${label}: instrumental-only flag missing`);
    assert.match(builder.code, /style\s*:/, `${label}: custom instrumental style missing`);
    assert.match(builder.code, /title\s*:/, `${label}: custom instrumental title missing`);
    assert.match(builder.code, /negativeTags\s*:/, `${label}: negative music tags missing`);
    assert.match(builder.code, /bright|cheerful|happy|joyful|sunny|uplifting/i, `${label}: bright and happy music direction missing`);
    assert.match(builder.code, /voice|vocals/i, `${label}: voice ban missing`);
    assert.match(builder.code, /humming/i, `${label}: humming ban missing`);
    assert.match(builder.code, /wordless vocals/i, `${label}: wordless-vocal ban missing`);
    assert.doesNotMatch(builder.code, /customMode\s*:\s*false/, `${label}: simple mode can ignore the instrumental control`);

    // 2026-08-06: 회로마다 곡이 너무 비슷하다는 지적. 프로필 6종만으로는 지시문의
    // 대부분이 매번 같아서 같은 곡이 반복해 나왔다. 편곡 축이 살아 있는지 본다.
    assert.match(builder.code, /bgmArrangementFor\(/, `${label}: arrangement variation is gone; every video would get the same instruction again`);
    for (const line of BGM_CONSTRAINT_LINES) {
      assert.ok(builder.code.includes(line), `${label}: shared BGM safety line missing -> ${line.slice(0, 44)}...`);
    }
    for (const profile of BGM_PROFILE_POOL) {
      assert.ok(builder.code.includes(profile.id), `${label}: BGM profile pool is missing ${profile.id}`);
    }
    assert.ok(
      builder.code.includes(`weirdnessConstraint: ${BGM_WEIRDNESS}`) || builder.code.includes(`weirdnessConstraint:${BGM_WEIRDNESS}`) || builder.code.includes('weirdnessConstraint: definition.bgmWeirdness'),
      `${label}: weirdness knob drifted from the shared table`,
    );
    // 2026-08-06: 다양성을 늘리겠다고 0.32로 올렸더니 사람 목소리와 허밍이 섞여 나왔다.
    // instrumental:true 와 금지 태그가 다 붙어 있어도 weirdness를 풀면 Suno가 넘어선다.
    // 사용자가 반복해서 금지한 사고다. 다양성은 재생 구간과 편곡 축에서만 가져온다.
    const weirdnessUsed = builder.code.match(/weirdnessConstraint\s*:\s*([0-9.]+)/);
    if (weirdnessUsed) {
      assert.ok(
        Number(weirdnessUsed[1]) <= BGM_WEIRDNESS_CEILING,
        `${label}: weirdness ${weirdnessUsed[1]} is above ${BGM_WEIRDNESS_CEILING} — that is how humming got into published BGM on 2026-08-06`,
      );
    }
  }

  // 폴링 예산. 30초+90초로는 곡이 다 안 만들어져 폴백 음원(모든 영상 동일 파일)으로
  // 떨어진다. 2026-08-06 실측 31건 중 6건이 그랬고, 사유는 전부 아직 생성 중이었다.
  const retryWait = workflow.nodes.find((node) => node.name === 'Wait BGM Retry 90s');
  assert.ok(retryWait, `${name}: BGM retry wait node missing`);
  const waitAmount = String(retryWait.parameters?.amount || '');
  assert.doesNotMatch(waitAmount, /\|\|\s*90\s*\}\}/, `${name}: BGM retry wait fell back to the old 90s budget`);
  assert.ok(
    waitAmount.includes(String(BGM_RETRY_WAIT_SECONDS)) || /bgm_retry_wait_seconds/.test(waitAmount),
    `${name}: BGM retry wait is not driven by the shared budget`,
  );

  // 클립 선택. Suno가 주는 두 클립 중 늘 긴 쪽만 쓰면 다양성이 절반으로 줄어든다.
  for (const nodeName of ['Parse BGM Result', 'Parse BGM Result Final']) {
    const node = workflow.nodes.find((entry) => entry.name === nodeName);
    assert.ok(node, `${name}: ${nodeName} missing`);
    assert.match(node.parameters.jsCode, /BGM_CLIP_CHOICE_V1/, `${name} ${nodeName}: clip choice still prefers the longest take`);
  }
}

// 가장 긴 프로필 + 가장 긴 편곡 조합이 상한 안에 들어와야 한다. 넘치면 그 조합들만
// 조용히 편곡 줄을 잃고, 다양성이 도로 줄어든다(안전 문장은 어느 경우에도 남는다).
const longestProfile = [...BGM_PROFILE_POOL].sort((left, right) => right.prompt.length - left.prompt.length)[0];
const longestArrangement = Object.values(BGM_ARRANGEMENT_AXES)
  .map((options) => [...options].sort((left, right) => right.length - left.length)[0])
  .join('; ');
const worstCaseLength = `Profile ${longestProfile.id}: ${longestProfile.prompt} Arrangement for this piece: ${longestArrangement}. ${BGM_CONSTRAINT_LINES.join(' ')}`
  .replace(/\s+/g, ' ').trim().length;
assert.ok(
  worstCaseLength <= BGM_STYLE_MAX_CHARS,
  `the longest profile+arrangement combination is ${worstCaseLength} chars, over the ${BGM_STYLE_MAX_CHARS} cap — those combinations would silently lose their arrangement`,
);
assert.ok(BGM_STYLE_MAX_CHARS <= 1000, 'KIE rejects a style field longer than 1000 characters');

// 사람 목소리 금지는 안전 문장 '맨 앞'이어야 한다. 길이 제한에 걸리면 뒤에서부터
// 잘리므로, 맨 앞에 있는 한 어떤 조합에서도 사라지지 않는다.
assert.match(BGM_CONSTRAINT_LINES[0], /purely instrumental/i, 'the instrumental-only statement must be the first safety line so truncation can never drop it');
assert.match(BGM_CONSTRAINT_LINES[0], /no human voice/i, 'the first safety line no longer says there is no human voice');
// 구체적 금지어는 negativeTags가 진다. style에 길게 나열하면 오히려 소재로 읽힌다.
for (const word of ['humming', 'wordless vocals', 'a cappella', 'vocalise']) {
  assert.ok(BGM_NEGATIVE_TAGS.includes(word.split(' ')[0]), `negative tags lost "${word}"`);
}

// ★ 2026-08-06, 사람 목소리가 다시 섞인 진짜 원인.
// 편곡 축에 'two voices trade short call-and-response phrases'가 있었다. 음악에서
// voice는 성부지만 텍스트→음악 모델은 사람 목소리로 읽는다. 금지문과 정면으로
// 모순되는 지시라, 4장에 1장 꼴로 보컬이 섞여 나왔다.
// 긍정 지시문(프로필·편곡 축)에는 노래로 읽힐 단어가 하나도 없어야 한다.
// 이 정규식은 반드시 편집 도구로 직접 쓴다. bash heredoc이나 node -e 로 쓰면 단어 경계
// 이스케이프가 백스페이스 문자(0x08)로 바뀌어 들어가고, 그러면 아무것도 매치하지 않는
// 채로 검사가 계속 초록이 된다. 2026-08-06에 실제로 그렇게 무력화된 가드를 통과시켰다.
const VOCAL_WORDS = /\b(voice|voices|vocal|vocals|sing|singing|sung|choir|chant|hum|humming|cappella|vocalise|scat|lyric|lyrics)\b/i;
for (const profile of BGM_PROFILE_POOL) {
  assert.doesNotMatch(profile.prompt, VOCAL_WORDS, `profile ${profile.id} names something the model will sing: "${profile.prompt}"`);
}
for (const [axis, options] of Object.entries(BGM_ARRANGEMENT_AXES)) {
  for (const option of options) {
    assert.doesNotMatch(option, VOCAL_WORDS, `arrangement axis "${axis}" names something the model will sing: "${option}" — say instrument, line or phrase instead of voice`);
  }
}
assert.equal(BGM_WEIRDNESS, 0.1, 'weirdness must stay at the value that shipped voice-free BGM for weeks');

// KIE는 긴 negativeTags를 자르지 않고 422로 거절한다. 2026-08-06에 금지어를 늘리다
// 293자가 되어 회로가 통째로 멈췄다("The length of music negativeStyle cannot exceed
// 200 characters"). 길이는 style(1000자)과 별개 예산이다.
assert.ok(
  BGM_NEGATIVE_TAGS.length <= BGM_NEGATIVE_TAGS_MAX_CHARS,
  `negativeTags is ${BGM_NEGATIVE_TAGS.length} chars; KIE rejects the whole request above ${BGM_NEGATIVE_TAGS_MAX_CHARS}`,
);
// 회로에 실제로 박힌 문자열도 잰다. 공유 표만 통과하고 회로가 옛 값을 들고 있으면
// 검사가 초록인 채로 실행이 죽는다.
for (const { name, workflow } of workflows) {
  for (const node of workflow.nodes) {
    for (const match of String(node.parameters?.jsCode || '').matchAll(/negativeTags\s*:\s*'([^']*)'/g)) {
      assert.ok(
        match[1].length <= BGM_NEGATIVE_TAGS_MAX_CHARS,
        `${name} ${node.name}: inlined negativeTags is ${match[1].length} chars, over KIE's ${BGM_NEGATIVE_TAGS_MAX_CHARS} limit`,
      );
    }
  }
}

// 조합이 9216개라도 고르는 쪽이 뭉치면 소용없다. 실제로 회로에 박히는 코드를 그대로
// 돌려서 흩어지는지 센다. FNV 하위 비트를 그냥 쓰던 초안은 100개 중 53개만 달랐다.
const arrangementModule = new Function(`${bgmArrangementSource()}\nreturn bgmArrangementFor;`)();
const spread = new Set();
const axisCoverage = Object.fromEntries(Object.keys(BGM_ARRANGEMENT_AXES).map((axis) => [axis, new Set()]));
for (let index = 0; index < 300; index += 1) {
  const result = arrangementModule(`bgm_arrangement|profile_${index % 6}|제목 ${index}가지|warm calm acoustic ${index}`);
  spread.add(result.line);
  for (const axis of Object.keys(axisCoverage)) axisCoverage[axis].add(result.chosen[axis]);
}
// 고정 숫자로 비교하면 축을 하나 빼는 순간 검사가 헛발질한다(생일 문제). 조합 수에서
// 나오는 이론 기댓값과 견준다. 완벽히 고른 추첨기도 300번 뽑으면 중복이 생긴다.
const combinations = bgmArrangementCombinationCount();
const draws = 300;
const expectedDistinct = combinations * (1 - Math.pow(1 - 1 / combinations, draws));
assert.ok(
  spread.size >= expectedDistinct * 0.92,
  `${draws} topics produced ${spread.size} distinct arrangements; a uniform picker would give about ${Math.round(expectedDistinct)}. The picker is clumping.`,
);
for (const [axis, seen] of Object.entries(axisCoverage)) {
  assert.equal(seen.size, BGM_ARRANGEMENT_AXES[axis].length, `axis ${axis} never used all of its options across 300 topics`);
}

console.log(JSON.stringify({
  ok: true,
  workflows: workflows.map(({ name, workflow }) => ({ file: name, id: workflow.id })),
  contract: {
    endpoint: musicCreateUrl,
    custom_mode: true,
    instrumental: true,
    mood: 'bright_happy',
    vocals: 'forbidden',
    callback_sink: callbackSinkUrl,
  },
  variation: {
    profiles: BGM_PROFILE_POOL.length,
    arrangement_combinations: bgmArrangementCombinationCount(),
    distinct_instructions: BGM_PROFILE_POOL.length * bgmArrangementCombinationCount(),
    style_weight: BGM_STYLE_WEIGHT,
    weirdness: BGM_WEIRDNESS,
    worst_case_style_chars: worstCaseLength,
    style_cap: BGM_STYLE_MAX_CHARS,
    retry_wait_seconds: BGM_RETRY_WAIT_SECONDS,
  },
  note: '분위기·악기·장조는 고정. 편곡(템포·짜임새·음역·선율 진행·화성 색채)만 곡마다 바뀐다.',
}, null, 2));
