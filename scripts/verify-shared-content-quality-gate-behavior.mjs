import assert from 'node:assert/strict';
import fs from 'node:fs';
import sqlite3 from 'sqlite3';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const sourcePath = `${root}/workflows/shared_content_quality_gate.json`;
const dbPath = `${root}/.n8n/database.sqlite`;
const sharedId = 'sharedContentQualityGate01';
const parentIds = new Set(['mxrYb3maJS31gEYC', 'baekse100Life01']);

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}

function codeOf(workflow, name) {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  assert.ok(node, `missing node: ${name}`);
  return node.parameters.jsCode;
}

function runCode(code, json, extras = {}) {
  const execute = new Function('$input', ...Object.keys(extras), code);
  return execute({ first: () => ({ json }) }, ...Object.values(extras));
}

const goodPack = {
  hook_title: '잠이 자주 깨는 원인을 줄이는 습관',
  rank_items: [
    { rank: 1, name: '저녁의 밝은 빛 줄이기', card_name: '저녁 빛 낮추기', reason: '밝은 빛은 몸의 밤 신호를 늦춰 잠들기 어렵게 해요', card_reason: '밝은 빛은 몸의 밤 신호를 늦춰요' },
    { rank: 2, name: '늦은 카페인 확인하기', card_name: '늦은 카페인 피하기', reason: '카페인은 졸림 신호를 막아 잠이 얕아질 수 있어요', card_reason: '카페인은 졸림 신호를 막을 수 있어요' },
    { rank: 3, name: '코골이와 숨 멎음 살피기', card_name: '숨 멎는 코골이 확인', reason: '숨이 반복해 막히면 산소가 떨어져 자주 깰 수 있어요', card_reason: '숨이 막히면 잠이 반복해서 끊겨요' },
  ],
  video_script: '검증용 스크립트',
  description: '잠이 자주 깨는 원인을 몸의 신호와 함께 설명해요.',
  pinned_comment: '밝은 빛과 늦은 카페인은 잠을 얕게 만들 수 있어요. 숨이 멎는 코골이가 반복되면 원인을 확인해요. 구독하시고 몸의 원리를 쉽게 이해하는 건강 정보를 받아보세요.',
};

const workflow = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const deterministicCode = codeOf(workflow, 'Deterministic Quality Review');
const buildCode = codeOf(workflow, 'Build Quality Review Request');
const parserCode = codeOf(workflow, 'Parse and Enforce Quality Review');
assert.match(buildCode, /title promise.*every ranked item/i, 'quality audit must check title-to-item semantic alignment');
assert.match(buildCode, /topic drift|unrelated item/i, 'quality audit must check abrupt topic drift');
assert.match(buildCode, /causal chain.*understandable/i, 'quality audit must check understandable causality');
assert.match(buildCode, /title_item_mismatch.*unrelated_item.*causal_gap/is, 'quality audit must define blocking semantic issue codes');
assert.match(buildCode, /title_item_type_mismatch/, 'quality audit must reject a title whose counted noun mislabels the item type');
assert.match(buildCode, /overstated_causal_attribution/, 'quality audit must reject unsupported escalation from observation to cause or diagnosis');
assert.match(buildCode, /semantic class/i, 'quality audit must compare title and ranked-entry semantic classes');
assert.match(buildCode, /observation.*association.*cause.*diagnosis/is, 'quality audit must distinguish evidence relations');
assert.match(buildCode, /title_role.*claim_strength.*alternative_causes/is, 'quality audit schema must require explicit semantic and claim-strength classifications');
assert.match(buildCode, /recent_title_duplicate/, 'quality gate must ingest deterministic duplicate-title failures');
assert.match(buildCode, /comment_topic_mismatch/, 'quality audit must check comment-topic alignment');
assert.match(buildCode, /fabricated_personal_anecdote/, 'quality audit must reject invented personal anecdotes');
assert.match(buildCode, /comment_tone_mismatch/, 'quality audit must reject an undignified or promotional comment tone');
assert.match(buildCode, /channel_concept_mismatch/, 'quality audit must reject content outside the health-channel concept');
assert.match(buildCode, /low_information_value/, 'quality audit must reject generic low-value filler');
assert.match(buildCode, /fabricated_precision/, 'quality audit must reject unsupported exact-detail theater');
assert.match(buildCode, /insufficient_health_depth/, 'quality audit must reject medically shallow lifestyle filler');
assert.match(buildCode, /unfamiliar_visible_word/, 'quality audit must reject obscure visible wording');
assert.match(buildCode, /channel_tone_mismatch/, 'quality audit must enforce conversational 해요체');
assert.match(buildCode, /health_depth/, 'quality audit schema must record health depth');
assert.match(buildCode, /channel_identity_mismatch/, 'quality audit must reject content that belongs to the other channel');
assert.match(buildCode, /channel_audit/, 'quality audit schema must record channel-profile fit');
assert.match(buildCode, /language_audit/, 'quality audit schema must record native-Korean copy quality');
assert.match(buildCode, /CLEAR_KOREAN_COPY_V2/, 'quality audit must use the consolidated Korean copy contract');
assert.doesNotMatch(buildCode, /FIRST_READ_KOREAN_V1|HUMAN_KOREAN_VOICE_V1/, 'quality audit retains superseded overlapping copy contracts');
assert.match(buildCode, /card_name_clarity/, 'rank audit schema must record standalone card-name clarity');
assert.match(buildCode, /card_reason_completeness/, 'rank audit schema must record missing sentence roles');
assert.match(buildCode, /card_meaning/, 'rank audit schema must record whether the card gives a specific meaning or action');
assert.match(buildCode, /causal_direction/, 'rank audit schema must record ambiguous or reversed causality');
assert.match(buildCode, /comment_audit/, 'quality audit schema must record summary-style comment quality');
assert.match(buildCode, /comment_question_cta/, 'quality audit must reject question and reply CTAs');
assert.match(buildCode, /comment_channel_closing/, 'quality audit must require a channel-aligned subscription closing');
assert.match(buildCode, /most useful actions or principles/i, 'quality audit must check a useful summary of the exact pack');
assert.match(buildCode, /first_read/, 'quality audit schema must record first-read comprehension');
assert.match(buildCode, /first_read_clarity/, 'quality audit must reject visible copy that requires rereading');
assert.match(buildCode, /human_voice/, 'quality audit schema must record whether the copy sounds human');
assert.match(buildCode, /mechanical_ai_tone/, 'quality audit must reject forced nominalization and mechanical AI copy');
assert.match(buildCode, /nominalized|noun chains|report heading|search keyword/is, 'quality audit must inspect mechanical noun-heavy copy');
assert.match(buildCode, /unnatural_korean/, 'quality audit must reject objectively malformed Korean');
assert.match(buildCode, /subject.*predicate|predicate.*subject/is, 'quality audit must check Korean subject-predicate combinations');
assert.match(parserCode, /incomplete_channel_audit/, 'quality parser must require a complete channel-profile audit');
assert.match(parserCode, /incomplete_language_audit/, 'quality parser must require a complete Korean-language audit');
assert.match(parserCode, /incomplete_visible_copy_audit/, 'quality parser must require complete rank-by-rank card-copy audit fields');
assert.match(parserCode, /incomplete_semantic_audit/, 'quality parser must require complete title-role and causal-strength audit fields');
assert.match(parserCode, /incomplete_comment_audit/, 'quality parser must require a complete comment audit');
assert.match(parserCode, /comment_question_cta/, 'quality parser must enforce the no-question CTA rule');
assert.match(parserCode, /comment_channel_closing/, 'quality parser must enforce the channel closing');
assert.match(parserCode, /mechanical_ai_tone/, 'quality parser must enforce a mechanical-AI-tone finding');
assert.match(parserCode, /content_duplicate_check/, 'quality parser must enforce duplicate-title failures');

const goodDryRun = runCode(deterministicCode, { pack: goodPack })[0].json;
assert.equal(goodDryRun.content_quality_review.pass, true, 'clear cause/effect pack should pass deterministic checks');

const haruProfileConfig = { channel_name: '하루건강약사', channel_editorial_profile: 'haru_health_literacy' };
const haruProfilePack = { ...structuredClone(goodPack), channel_editorial_profile: 'haru_health_literacy', channel_content_pillar: 'supplement_ingredients' };
const goodProfileDryRun = runCode(deterministicCode, { pack: haruProfilePack, config: haruProfileConfig })[0].json;
assert.equal(goodProfileDryRun.content_quality_review.pass, true, 'matching channel profile and pillar should pass deterministic checks');
const wrongProfilePack = { ...structuredClone(haruProfilePack), channel_editorial_profile: 'longevity_daily_function' };
const wrongProfileResult = runCode(deterministicCode, { pack: wrongProfilePack, config: haruProfileConfig })[0].json;
assert.equal(wrongProfileResult.content_quality_review.pass, false, 'writer pack from the other channel profile must block');
assert.ok(wrongProfileResult.content_quality_review.issues.some((issue) => issue.code === 'channel_profile_mismatch'));
const wrongPillarPack = { ...structuredClone(haruProfilePack), channel_content_pillar: 'cardiometabolic' };
const wrongPillarResult = runCode(deterministicCode, { pack: wrongPillarPack, config: haruProfileConfig })[0].json;
assert.equal(wrongPillarResult.content_quality_review.pass, false, 'pillar from the other channel must block');
assert.ok(wrongPillarResult.content_quality_review.issues.some((issue) => issue.code === 'channel_pillar_mismatch'));

const vaguePack = structuredClone(goodPack);
vaguePack.rank_items[0].reason = '밀폐 공간 압력 부담';
const vagueResult = runCode(deterministicCode, { pack: vaguePack })[0].json;
assert.equal(vagueResult.content_quality_review.pass, true, 'wording style alone must not block generation');

const percentagePack = structuredClone(goodPack);
percentagePack.rank_items[1].reason = '열 때문에 배터리 수명이 85%까지 빠르게 떨어집니다';
const percentageResult = runCode(deterministicCode, { pack: percentagePack })[0].json;
assert.equal(percentageResult.content_quality_review.pass, false, 'unsupported percentage must be blocked');
assert.ok(percentageResult.content_quality_review.issues.some((issue) => issue.code === 'unsupported_percentage'));

const base = runCode(buildCode, { pack: goodPack, config: {} })[0].json;
assert.equal(base.use_ai_quality_review, true, 'live content should request independent AI review');
assert.doesNotMatch(base.kie_quality_review_request.messages[0].content, /"corrected_pack"\s*:/, 'audit schema must not invite a full rewritten pack');

const languageCheckedFields = ['hook_title', 'subtitle', 'rank_item_names', 'card_copy', 'video_script', 'description', 'pinned_comment'];
const naturalLanguageAudit = { status: 'natural', first_read: 'clear', human_voice: 'natural', checked_fields: languageCheckedFields, problems: [] };
const naturalCommentAudit = { summary_fit: 'direct', question_cta: 'absent', channel_closing: 'aligned', explanation: 'The comment summarizes useful points from the exact pack and ends with a calm channel-aligned subscription invitation.' };
function withRequiredAudits(review) {
  return {
    ...review,
    ...(Object.hasOwn(review, 'language_audit') ? {} : { language_audit: naturalLanguageAudit }),
    ...(Object.hasOwn(review, 'comment_audit') ? {} : { comment_audit: naturalCommentAudit }),
  };
}

function parseReview(review) {
  const response = { content: [{ type: 'text', text: JSON.stringify(withRequiredAudits(review)) }] };
  return runCode(parserCode, response, {
    $: (name) => {
      assert.equal(name, 'Build Quality Review Request');
      return { first: () => ({ json: base }) };
    },
  })[0].json;
}

const highAudit = goodPack.rank_items.map((item) => ({
  rank: item.rank,
  confidence: 'high',
  basis_type: item.rank === 3 ? 'established_safety_guidance' : 'behavioral_mechanism',
  explanation: '널리 확립된 수면 생리와 행동 원리에 기반해요',
  health_depth: 'high',
  medical_relevance: 'direct',
  decision_value: 'actionable',
  card_name_clarity: 'clear',
  card_reason_completeness: 'complete',
  card_meaning: 'direct',
  causal_direction: 'clear',
  title_role: 'fulfills_exact_type',
  claim_strength: 'supported',
  alternative_causes: 'not_needed',
}));
const attemptedRewrite = structuredClone(goodPack);
attemptedRewrite.hook_title = '寃?섍린 AI媛 諛붽퓞 ?쒕ぉ';
const highResult = parseReview({ decision: 'pass', issues: [], corrected_pack: attemptedRewrite, audit: highAudit });
assert.equal(highResult.content_quality_review.pass, true, 'high-confidence independently audited pack should pass');
assert.equal(highResult.pack, base.pack, 'audit must preserve the original writer pack object');

const profileBase = runCode(buildCode, { pack: haruProfilePack, config: haruProfileConfig })[0].json;
function parseProfileReview(review) {
  const response = { content: [{ type: 'text', text: JSON.stringify(withRequiredAudits(review)) }] };
  return runCode(parserCode, response, {
    $: () => ({ first: () => ({ json: profileBase }) }),
  })[0].json;
}
const completeChannelAudit = {
  profile: 'haru_health_literacy',
  pillar: 'supplement_ingredients',
  fit: 'direct',
  explanation: 'The pack explains supplement ingredients and a practical health choice.',
};
const completeChannelResult = parseProfileReview({ decision: 'pass', issues: [], audit: highAudit, channel_audit: completeChannelAudit });
assert.equal(completeChannelResult.content_quality_review.pass, true, 'complete matching channel audit should pass');
const missingChannelAuditResult = parseProfileReview({ decision: 'pass', issues: [], audit: highAudit });
assert.equal(missingChannelAuditResult.content_quality_review.pass, false, 'missing channel audit must block when a profile is configured');
assert.ok(missingChannelAuditResult.content_quality_review.issues.some((issue) => issue.code === 'incomplete_channel_audit'));
const crossChannelResult = parseProfileReview({
  decision: 'reject',
  issues: [{ code: 'channel_identity_mismatch', message: 'The topic mainly belongs to the longevity channel.' }],
  audit: highAudit,
  channel_audit: { ...completeChannelAudit, fit: 'mismatch' },
});
assert.equal(crossChannelResult.content_quality_review.pass, false, 'cross-channel semantic mismatch must block');
assert.ok(crossChannelResult.content_quality_review.issues.some((issue) => issue.code === 'channel_identity_mismatch'));

const malformedKoreanResult = parseReview({
  decision: 'pass',
  issues: [],
  audit: highAudit,
  language_audit: {
    status: 'malformed',
    first_read: 'clear',
    human_voice: 'natural',
    checked_fields: languageCheckedFields,
    problems: [{ field: 'rank_items[1].card_name', text: '한 발로 양말 신기가 흔들릴 때', type: 'collocation', explanation: '양말 신기와 흔들리다의 결합이 부자연스러워요.' }],
  },
});
assert.equal(malformedKoreanResult.content_quality_review.pass, false, 'objectively malformed Korean must block and regenerate');
assert.ok(malformedKoreanResult.content_quality_review.issues.some((issue) => issue.code === 'unnatural_korean'));
const unclearFirstReadResult = parseReview({
  decision: 'pass',
  issues: [],
  audit: highAudit,
  language_audit: {
    status: 'natural',
    first_read: 'unclear',
    human_voice: 'natural',
    checked_fields: languageCheckedFields,
    problems: [{ field: 'rank_items[3].card_name', text: '밥 먹고도 당기는 단것 생각', type: 'compressed_keyword_fragment', explanation: '뜻을 짐작하려면 문장을 다시 읽어야 해요.' }],
  },
});
assert.equal(unclearFirstReadResult.content_quality_review.pass, false, 'visible copy that needs rereading must block and regenerate');
assert.ok(unclearFirstReadResult.content_quality_review.issues.some((issue) => issue.code === 'first_read_clarity'));
const mechanicalVoiceResult = parseReview({
  decision: 'pass',
  issues: [],
  audit: highAudit,
  language_audit: {
    status: 'natural',
    first_read: 'clear',
    human_voice: 'mechanical',
    checked_fields: languageCheckedFields,
    problems: [{ field: 'hook_title', text: '일상 선택 기준 확인 습관 다섯 가지', type: 'forced_nominalization', explanation: '뜻은 보이지만 명사를 이어 붙인 보고서 제목처럼 들려요.' }],
  },
});
assert.equal(mechanicalVoiceResult.content_quality_review.pass, false, 'clearly mechanical noun-heavy AI copy must block and regenerate');
assert.ok(mechanicalVoiceResult.content_quality_review.issues.some((issue) => issue.code === 'mechanical_ai_tone'));
const missingLanguageAuditResponse = { content: [{ type: 'text', text: JSON.stringify({ decision: 'pass', issues: [], audit: highAudit, comment_audit: naturalCommentAudit }) }] };
const missingLanguageAuditResult = runCode(parserCode, missingLanguageAuditResponse, { $: () => ({ first: () => ({ json: base }) }) })[0].json;
assert.equal(missingLanguageAuditResult.content_quality_review.pass, false, 'missing Korean-language audit must block');
assert.ok(missingLanguageAuditResult.content_quality_review.issues.some((issue) => issue.code === 'incomplete_language_audit'));
const missingFirstReadResult = parseReview({
  decision: 'pass',
  issues: [],
  audit: highAudit,
  language_audit: { status: 'natural', human_voice: 'natural', checked_fields: languageCheckedFields, problems: [] },
});
assert.equal(missingFirstReadResult.content_quality_review.pass, false, 'missing first-read audit must block');
assert.ok(missingFirstReadResult.content_quality_review.issues.some((issue) => issue.code === 'incomplete_language_audit'));
const missingHumanVoiceResult = parseReview({
  decision: 'pass',
  issues: [],
  audit: highAudit,
  language_audit: { status: 'natural', first_read: 'clear', checked_fields: languageCheckedFields, problems: [] },
});
assert.equal(missingHumanVoiceResult.content_quality_review.pass, false, 'missing human-voice audit must block');
assert.ok(missingHumanVoiceResult.content_quality_review.issues.some((issue) => issue.code === 'incomplete_language_audit'));

const missingCommentAuditResponse = { content: [{ type: 'text', text: JSON.stringify({ decision: 'pass', issues: [], audit: highAudit, language_audit: naturalLanguageAudit }) }] };
const missingCommentAuditResult = runCode(parserCode, missingCommentAuditResponse, { $: () => ({ first: () => ({ json: base }) }) })[0].json;
assert.equal(missingCommentAuditResult.content_quality_review.pass, false, 'missing comment audit must block');
assert.ok(missingCommentAuditResult.content_quality_review.issues.some((issue) => issue.code === 'incomplete_comment_audit'));

const questionAuditResult = parseReview({ decision: 'pass', issues: [], audit: highAudit, comment_audit: { ...naturalCommentAudit, question_cta: 'present' } });
assert.equal(questionAuditResult.content_quality_review.pass, false, 'question CTA finding must block');
assert.ok(questionAuditResult.content_quality_review.issues.some((issue) => issue.code === 'comment_question_cta'));

const summaryMismatchResult = parseReview({ decision: 'pass', issues: [], audit: highAudit, comment_audit: { ...naturalCommentAudit, summary_fit: 'mismatch' } });
assert.equal(summaryMismatchResult.content_quality_review.pass, false, 'comment summary mismatch must block');
assert.ok(summaryMismatchResult.content_quality_review.issues.some((issue) => issue.code === 'comment_topic_mismatch'));

const closingMismatchResult = parseReview({ decision: 'pass', issues: [], audit: highAudit, comment_audit: { ...naturalCommentAudit, channel_closing: 'mismatch' } });
assert.equal(closingMismatchResult.content_quality_review.pass, false, 'missing or mismatched channel closing must block');
assert.ok(closingMismatchResult.content_quality_review.issues.some((issue) => issue.code === 'comment_channel_closing'));

const questionPack = structuredClone(goodPack);
questionPack.pinned_comment = '밝은 빛과 늦은 카페인은 잠을 얕게 만들 수 있어요. 여러분은 어떤 방법을 해보셨나요?';
const questionBase = runCode(buildCode, { pack: questionPack, config: {} })[0].json;
const questionResponse = { content: [{ type: 'text', text: JSON.stringify(withRequiredAudits({ decision: 'pass', issues: [], audit: highAudit })) }] };
const questionResult = runCode(parserCode, questionResponse, { $: () => ({ first: () => ({ json: questionBase }) }) })[0].json;
assert.equal(questionResult.content_quality_review.pass, false, 'actual question CTA must block even when the reviewer misses it');
assert.ok(questionResult.content_quality_review.issues.some((issue) => issue.code === 'comment_question_cta'));

const incompleteAudit = highAudit.map(({ health_depth, medical_relevance, decision_value, ...entry }) => entry);
const incompleteAuditResult = parseReview({ decision: 'pass', issues: [], audit: incompleteAudit });
assert.equal(incompleteAuditResult.content_quality_review.pass, false, 'missing health-depth audit fields must block');
assert.ok(incompleteAuditResult.content_quality_review.issues.some((issue) => issue.code === 'incomplete_health_audit'));

const incompleteVisibleCopyAudit = highAudit.map(({ card_name_clarity, card_reason_completeness, card_meaning, causal_direction, ...entry }) => entry);
const incompleteVisibleCopyResult = parseReview({ decision: 'pass', issues: [], audit: incompleteVisibleCopyAudit });
assert.equal(incompleteVisibleCopyResult.content_quality_review.pass, false, 'missing per-rank visible-copy audit fields must block');
assert.ok(incompleteVisibleCopyResult.content_quality_review.issues.some((issue) => issue.code === 'incomplete_visible_copy_audit'));

const missingRoleAudit = structuredClone(highAudit);
missingRoleAudit[0].card_reason_completeness = 'missing_role';
const missingRoleResult = parseReview({ decision: 'pass', issues: [], audit: missingRoleAudit });
assert.equal(missingRoleResult.content_quality_review.pass, false, 'card copy that omits a needed actor, object, or condition must block');
assert.ok(missingRoleResult.content_quality_review.issues.some((issue) => issue.code === 'first_read_clarity' && issue.rank === 1));

const vagueCardAudit = structuredClone(highAudit);
vagueCardAudit[1].card_meaning = 'vague';
const vagueCardResult = parseReview({ decision: 'pass', issues: [], audit: vagueCardAudit });
assert.equal(vagueCardResult.content_quality_review.pass, false, 'card copy with an unnamed meaning or action must block');
assert.ok(vagueCardResult.content_quality_review.issues.some((issue) => issue.code === 'first_read_clarity' && issue.rank === 2));

const ambiguousCausalAudit = structuredClone(highAudit);
ambiguousCausalAudit[2].causal_direction = 'ambiguous';
const ambiguousCausalResult = parseReview({ decision: 'pass', issues: [], audit: ambiguousCausalAudit });
assert.equal(ambiguousCausalResult.content_quality_review.pass, false, 'card copy that reverses or obscures the observation and cause must block');
assert.ok(ambiguousCausalResult.content_quality_review.issues.some((issue) => issue.code === 'first_read_clarity' && issue.rank === 3));

const incompleteSemanticAudit = highAudit.map(({ title_role, claim_strength, alternative_causes, ...entry }) => entry);
const incompleteSemanticResult = parseReview({ decision: 'pass', issues: [], audit: incompleteSemanticAudit });
assert.equal(incompleteSemanticResult.content_quality_review.pass, false, 'missing title-role and causal-strength classifications must block');
assert.ok(incompleteSemanticResult.content_quality_review.issues.some((issue) => issue.code === 'incomplete_semantic_audit'));

const wrongItemTypeAudit = structuredClone(highAudit);
wrongItemTypeAudit[0].title_role = 'mismatch';
const wrongItemTypeResult = parseReview({ decision: 'pass', issues: [], audit: wrongItemTypeAudit });
assert.equal(wrongItemTypeResult.content_quality_review.pass, false, 'a ranked entry must not pass when its semantic class differs from the title promise');
assert.ok(wrongItemTypeResult.content_quality_review.issues.some((issue) => issue.code === 'title_item_type_mismatch' && issue.rank === 1));

const overstatedClaimAudit = structuredClone(highAudit);
overstatedClaimAudit[1].claim_strength = 'overstated';
overstatedClaimAudit[1].alternative_causes = 'missing';
const overstatedClaimResult = parseReview({ decision: 'pass', issues: [], audit: overstatedClaimAudit });
assert.equal(overstatedClaimResult.content_quality_review.pass, false, 'an unsupported escalation from observation to cause or diagnosis must block');
assert.ok(overstatedClaimResult.content_quality_review.issues.some((issue) => issue.code === 'overstated_causal_attribution' && issue.rank === 2));

const semanticMismatchResult = parseReview({
  decision: 'reject',
  issues: [{ rank: 2, code: 'title_item_mismatch', message: 'The item does not fulfill the title promise.' }],
  audit: highAudit,
});
assert.equal(semanticMismatchResult.content_quality_review.pass, false, 'clear title-to-item mismatch must block');
assert.ok(semanticMismatchResult.content_quality_review.issues.some((issue) => issue.code === 'title_item_mismatch'));

const lowInformationResult = parseReview({
  decision: 'reject',
  issues: [{ rank: 1, code: 'low_information_value', message: 'The item gives generic advice without a useful condition, mechanism, action, or boundary.' }],
  audit: highAudit,
});
assert.equal(lowInformationResult.content_quality_review.pass, false, 'generic low-information filler must block and regenerate');
assert.ok(lowInformationResult.content_quality_review.issues.some((issue) => issue.code === 'low_information_value'));

const fabricatedPrecisionResult = parseReview({
  decision: 'reject',
  issues: [{ rank: 1, code: 'fabricated_precision', message: 'The exact count is unsupported and only makes the claim sound scientific.' }],
  audit: highAudit,
});
assert.equal(fabricatedPrecisionResult.content_quality_review.pass, false, 'unsupported precision must block and regenerate');
assert.ok(fabricatedPrecisionResult.content_quality_review.issues.some((issue) => issue.code === 'fabricated_precision'));

const shallowHealthResult = parseReview({
  decision: 'reject',
  issues: [{ rank: 1, code: 'insufficient_health_depth', message: 'This is only an organizing tip and teaches no body mechanism, signal, or health decision.' }],
  audit: highAudit,
});
assert.equal(shallowHealthResult.content_quality_review.pass, false, 'housekeeping-only health filler must block and regenerate');
assert.ok(shallowHealthResult.content_quality_review.issues.some((issue) => issue.code === 'insufficient_health_depth'));

const formalTonePack = structuredClone(goodPack);
formalTonePack.rank_items[0].card_reason = '밝은 빛은 몸의 밤 신호를 늦춥니다';
const formalToneResult = runCode(deterministicCode, { pack: formalTonePack })[0].json;
assert.equal(formalToneResult.content_quality_review.pass, false, '합니다체 visible copy must block and regenerate');
assert.ok(formalToneResult.content_quality_review.issues.some((issue) => issue.code === 'channel_tone_mismatch'));

const formalScriptPack = structuredClone(goodPack);
formalScriptPack.video_script = '오늘은 잠이 자주 깨는 원인을 설명합니다';
const formalScriptResult = runCode(deterministicCode, { pack: formalScriptPack, config: { dry_run: true, test_mode: true } })[0].json;
assert.equal(formalScriptResult.content_quality_review.pass, false, '합니다체 video script must block even in deterministic test mode');
assert.ok(formalScriptResult.content_quality_review.issues.some((issue) => issue.code === 'channel_tone_mismatch'));

const missingCardNamePack = structuredClone(goodPack);
delete missingCardNamePack.rank_items[0].card_name;
const missingCardNameResult = runCode(deterministicCode, { pack: missingCardNamePack })[0].json;
assert.equal(missingCardNameResult.content_quality_review.pass, false, 'missing short image card_name must block');
assert.ok(missingCardNameResult.content_quality_review.issues.some((issue) => issue.code === 'missing_card_name'));

const anecdotePack = structuredClone(goodPack);
anecdotePack.pinned_comment = '저는 이 방법을 직접 해보니 정말 편해졌어요. 여러분은 어떠세요?';
const anecdoteBase = runCode(buildCode, { pack: anecdotePack, config: {} })[0].json;
const anecdoteResponse = { content: [{ type: 'text', text: JSON.stringify(withRequiredAudits({ decision: 'pass', issues: [], audit: highAudit })) }] };
const anecdoteResult = runCode(parserCode, anecdoteResponse, {
  $: () => ({ first: () => ({ json: anecdoteBase }) }),
})[0].json;
assert.equal(anecdoteResult.content_quality_review.pass, false, 'invented first-person comment anecdote must block');
assert.ok(anecdoteResult.content_quality_review.issues.some((issue) => issue.code === 'fabricated_personal_anecdote'));

const duplicateBase = runCode(buildCode, {
  pack: goodPack,
  config: {},
  content_duplicate_check: { blocking: true, generated_title: goodPack.hook_title, similar_to: 'recent title' },
})[0].json;
const duplicateResponse = { content: [{ type: 'text', text: JSON.stringify(withRequiredAudits({ decision: 'pass', issues: [], audit: highAudit })) }] };
const duplicateResult = runCode(parserCode, duplicateResponse, {
  $: () => ({ first: () => ({ json: duplicateBase }) }),
})[0].json;
assert.equal(duplicateResult.content_quality_review.pass, false, 'recent duplicate title must trigger regeneration');
assert.ok(duplicateResult.content_quality_review.issues.some((issue) => issue.code === 'recent_title_duplicate'));

const longReasonPack = structuredClone(goodPack);
longReasonPack.rank_items[0].reason = '이 문장은 마흔두 글자를 조금 넘지만 원인과 결과가 분명한 정상적인 한국어 설명이라서 형식만으로 차단하면 안 돼요.';
const longBase = runCode(buildCode, { pack: longReasonPack, config: {} })[0].json;
const longAudit = longReasonPack.rank_items.map((item) => ({
  rank: item.rank,
  confidence: 'high',
  basis_type: 'physical_mechanism',
  explanation: 'well established',
  health_depth: 'high',
  medical_relevance: 'direct',
  decision_value: 'actionable',
  card_name_clarity: 'clear',
  card_reason_completeness: 'complete',
  card_meaning: 'direct',
  causal_direction: 'clear',
  title_role: 'fulfills_exact_type',
  claim_strength: 'supported',
  alternative_causes: 'not_needed',
}));
const longResponse = { content: [{ type: 'text', text: JSON.stringify(withRequiredAudits({ decision: 'reject', issues: [{ rank: 1, code: 'reason_length', message: 'too long' }], audit: longAudit })) }] };
const longResult = runCode(parserCode, longResponse, {
  $: () => ({ first: () => ({ json: longBase }) }),
})[0].json;
assert.equal(longResult.content_quality_review.pass, true, 'character-count-only rejection must continue as advisory');
assert.equal(longResult.content_quality_review.decision, 'pass_with_advisory');

const nestedReview = withRequiredAudits({ decision: 'pass', issues: [], audit: highAudit });
const nestedKieResponse = {
  data: JSON.stringify({
    role: 'assistant',
    content: [{ type: 'text', text: '```json\n' + JSON.stringify(nestedReview) + '\n```' }],
  }),
};
const nestedResult = runCode(parserCode, nestedKieResponse, {
  $: () => ({ first: () => ({ json: base }) }),
})[0].json;
assert.equal(nestedResult.content_quality_review.pass, true, 'nested KIE data envelope must be unwrapped before audit parsing');
assert.equal(nestedResult.content_quality_review.decision, 'pass');

const rewriteResult = parseReview({ decision: 'rewrite', issues: [], corrected_pack: goodPack, audit: highAudit });
assert.equal(rewriteResult.content_quality_review.pass, true, 'non-factual reviewer decision must not block original content');

const lowAudit = structuredClone(highAudit);
lowAudit[0].confidence = 'low';
lowAudit[0].basis_type = 'uncertain';
const lowResult = parseReview({ decision: 'pass', issues: [], corrected_pack: goodPack, audit: lowAudit });
assert.equal(lowResult.content_quality_review.pass, false, 'low-confidence claim must fail closed');
assert.ok(lowResult.content_quality_review.issues.some((issue) => issue.code === 'insufficient_confidence'));
assert.ok(lowResult.content_quality_review.issues.some((issue) => issue.code === 'uncertain_basis'));

const apiFailure = runCode(parserCode, { error: 'internal error' }, {
  $: () => ({ first: () => ({ json: base }) }),
})[0].json;
assert.equal(apiFailure.content_quality_review.pass, true, 'review API failure must fail open to medical safety review');
assert.equal(apiFailure.content_quality_review.issues[0].code, 'review_api_error');

const truncatedResponse = {
  data: JSON.stringify({
    stop_reason: 'max_tokens',
    content: [{ type: 'text', text: '{"decision":"pass","issues":[' }],
  }),
};
const truncatedResult = runCode(parserCode, truncatedResponse, {
  $: () => ({ first: () => ({ json: base }) }),
})[0].json;
assert.equal(truncatedResult.content_quality_review.pass, true, 'truncated quality review must preserve fail-open behavior');
assert.equal(truncatedResult.content_quality_review.issues[0].code, 'review_output_truncated');

const db = new sqlite3.Database(dbPath);
try {
  const liveShared = await get(db, 'SELECT id,active,versionId,activeVersionId,nodes,connections FROM workflow_entity WHERE id=?', [sharedId]);
  assert.ok(liveShared, 'shared workflow missing from live n8n database');
  assert.equal(liveShared.active, 1, 'live shared workflow must be active for database execution');
  assert.equal(liveShared.activeVersionId, liveShared.versionId, 'active shared workflow must point to its published history version');
  const liveWorkflow = { id: liveShared.id, nodes: JSON.parse(liveShared.nodes), connections: JSON.parse(liveShared.connections) };
  assert.deepEqual(liveWorkflow.nodes, workflow.nodes, 'live shared workflow nodes differ from source');
  assert.deepEqual(liveWorkflow.connections, workflow.connections, 'live shared workflow connections differ from source');

  const activeHistory = await get(db, 'SELECT nodes,connections FROM workflow_history WHERE versionId=?', [liveShared.activeVersionId]);
  assert.ok(activeHistory, 'active shared workflow history version missing');
  assert.deepEqual(JSON.parse(activeHistory.nodes), workflow.nodes, 'published shared workflow nodes differ from source');
  assert.deepEqual(JSON.parse(activeHistory.connections), workflow.connections, 'published shared workflow connections differ from source');

  const ownership = await get(db, 'SELECT projectId,role FROM shared_workflow WHERE workflowId=?', [sharedId]);
  assert.ok(ownership, 'shared workflow project ownership missing');
  assert.equal(ownership.role, 'workflow:owner');

  const liveParents = await all(db, `SELECT id,nodes,connections FROM workflow_entity WHERE id IN (${[...parentIds].map(() => '?').join(',')})`, [...parentIds]);
  assert.equal(liveParents.length, parentIds.size, 'live parent workflow count mismatch');
  for (const parent of liveParents) {
    const nodes = new Map(JSON.parse(parent.nodes).map((node) => [node.name, node]));
    const connections = JSON.parse(parent.connections);
    const target = nodes.get('Shared Content Quality Gate')?.parameters?.workflowId;
    assert.equal(target?.value || target, sharedId, `${parent.id}: wrong shared workflow target`);
    assert.equal(connections['Parse KIE Claude Pack'].main[0][0].node, 'Shared Content Quality Gate');
    assert.equal(connections['Mock Viral Rank Pack'].main[0][0].node, 'Shared Content Quality Gate');
    assert.equal(connections['Content Quality Passed?'].main[1][0].node, 'Prepare Medical Retry Request');
    const retryCode = nodes.get('Prepare Medical Retry Request')?.parameters?.jsCode || '';
    assert.match(retryCode, /QUALITY_REVIEW_RETRY/, `${parent.id}: quality retry instruction missing`);
    assert.match(retryCode, /title promise.*every item/i, `${parent.id}: quality retry lacks title alignment guidance`);
    assert.match(retryCode, /Do not merely lengthen/i, `${parent.id}: quality retry may encourage padding instead of correction`);
    assert.match(retryCode, /CLEAR_KOREAN_COPY_V2/, `${parent.id}: quality retry lacks consolidated Korean copy contract`);
    assert.equal((retryCode.match(/CLEAR_KOREAN_COPY_V2/g) || []).length, 1, `${parent.id}: quality retry duplicates the consolidated Korean copy contract`);
    assert.doesNotMatch(retryCode, /FIRST_READ_KOREAN_V1|HUMAN_KOREAN_VOICE_V1/, `${parent.id}: quality retry retains superseded copy contracts`);
    assert.match(retryCode, /COMMENT_SUMMARY_V1/, `${parent.id}: quality retry lacks summary-style comment contract`);
    assert.match(retryCode, /Do not ask a question|no questions/i, `${parent.id}: quality retry allows question CTAs`);
    assert.match(retryCode, /one restrained subscription invitation/i, `${parent.id}: quality retry lacks calm subscription closing`);
    assert.doesNotMatch(retryCode, /18-32 Korean character/i, `${parent.id}: retry reintroduces hard reason length`);
    const retryResult = runCode(retryCode, {
      pack: goodPack,
      config: { use_live_kie_ai: true, dry_run: false, test_mode: false, content_quality_max_retries: 2 },
      content_quality_review: {
        pass: false,
        issues: [{ rank: 2, code: 'title_item_mismatch', message: 'item does not fulfill title' }],
        audit: highAudit,
      },
      kie_claude_request: { messages: [{ role: 'user', content: 'ORIGINAL_REQUEST' }] },
    })[0].json;
    assert.equal(retryResult.medical_review_retry_available, true, `${parent.id}: first quality retry must be available`);
    assert.equal(retryResult.content_quality_retry.attempt, 1, `${parent.id}: wrong quality retry attempt`);
    assert.match(retryResult.kie_claude_request.messages[0].content, /QUALITY_REVIEW_RETRY attempt 1 of 2/);
    assert.match(retryResult.kie_claude_request.messages[0].content, /title_item_mismatch/);
  }
} finally {
  db.close();
}

console.log('PASS: shared quality gate behavior and live n8n database state verified');
