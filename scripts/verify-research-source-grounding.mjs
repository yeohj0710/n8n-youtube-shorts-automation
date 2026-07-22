import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sqlite3 from 'sqlite3';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const parents = [
  { id: 'mxrYb3maJS31gEYC', file: 'workflows/n8n_하루건강약사_수동실행.json', profile: 'haru_health_literacy', fixture: 'research/haru-supplement-timing.json' },
  { id: 'baekse100Life01', file: 'workflows/n8n_geongangjangsubigyeol_manual.json', profile: 'longevity_daily_function', fixture: 'research/longevity-meal-order.json' },
];
const sharedFile = 'workflows/shared_content_quality_gate.json';

function readWorkflow(relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
}

function codeOf(workflow, name) {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  assert.ok(node, `missing node: ${name}`);
  return node.parameters.jsCode;
}

function runGate(code, json, extras = {}) {
  const execute = new Function('$input', ...Object.keys(extras), code);
  return execute({ first: () => ({ json }) }, ...Object.values(extras));
}

function buildConfig(overrides = {}) {
  return {
    rank_count: null,
    rank_count_min: 3,
    rank_count_max: 5,
    topic_queue: { selected: null },
    recent_titles: [],
    recent_titles_for_pillar_rotation: [],
    category_cooldown_window: 5,
    category_cooldown_threshold: 2,
    blocked_topic_categories: [],
    variation_seed: 'research-grounding-verification',
    topic_candidates: [],
    kie_ai_model: 'verification-model',
    ...overrides,
  };
}

function runBuild(code, config) {
  return new Function('$', '$input', code)(
    () => ({ first: () => ({ json: { config } }) }),
    { all: () => [] },
  );
}

const shared = readWorkflow(sharedFile);
const deterministicCode = codeOf(shared, 'Deterministic Quality Review');
const buildReviewCode = codeOf(shared, 'Build Quality Review Request');
const parserCode = codeOf(shared, 'Parse and Enforce Quality Review');

// ---------------------------------------------------------------------------
// 1. No research source pack means no generation request is created.
// ---------------------------------------------------------------------------
for (const parent of parents) {
  const workflow = readWorkflow(parent.file);
  const build = codeOf(workflow, 'Build Viral Rank Pack Request');
  assert.match(build, /RESEARCH_SOURCE_PACK_V1/, `${parent.id}: research source contract marker missing`);
  assert.match(build, /RESEARCH_GROUNDING_V\d+/, `${parent.id}: research grounding contract missing`);
  assert.match(build, /SOURCE_SELECTION_V\d+/, `${parent.id}: interest and decision-value selection contract missing`);
  assert.match(build, /surprise value/i, `${parent.id}: selection contract does not score how surprising the fact is`);
  assert.match(build, /물을 충분히 마셔요/, `${parent.id}: banned-generality list missing from the selection contract`);
  assert.match(build, /rather than shipping a thin list or inventing an item/i, `${parent.id}: item padding is not forbidden`);

  // Research is supporting evidence, not the topic source: a run without a pack
  // must proceed normally, or the writer gets pushed into clinical territory.
  const noPackRun = runBuild(build, buildConfig({ dry_run: false, test_mode: false }))[0].json;
  assert.equal(noPackRun.research_grounded, false, `${parent.id}: a run without a pack must report itself as ungrounded`);
  assert.ok(noPackRun.kie_claude_request, `${parent.id}: a run without a research pack must still build a generation request`);
  assert.match(build, /EVERYDAY_TOPIC_ANGLE_V\d+/, `${parent.id}: everyday topic-angle contract missing`);
  assert.match(build, /whose natural home is a clinic handout/i, `${parent.id}: clinic-sourced topics are not rejected`);

  // Opting in explicitly still enforces the requirement.
  assert.throws(
    () => runBuild(build, buildConfig({ dry_run: false, test_mode: false, require_research_source_pack: true })),
    /RESEARCH_SOURCE_REQUIRED/,
    `${parent.id}: an explicit opt-in must still require a research pack`,
  );

  const ungrounded = runBuild(build, buildConfig({ dry_run: false, test_mode: false, require_research_source_pack: false }))[0].json;
  assert.equal(ungrounded.research_grounded, false, `${parent.id}: opt-out run must report itself as ungrounded`);
  assert.doesNotMatch(
    ungrounded.kie_claude_request.messages[0].content,
    /RESEARCH_GROUNDING_V\d+/,
    `${parent.id}: ungrounded run must not claim a research pack it does not have`,
  );

  const fixture = JSON.parse(fs.readFileSync(path.join(root, parent.fixture), 'utf8'));
  const pack = fixture.research_source_pack;
  assert.equal(pack.channel_profile, parent.profile, `${parent.fixture}: fixture belongs to the other channel`);
  const grounded = runBuild(build, buildConfig({ dry_run: false, test_mode: false, research_source_pack: pack }))[0].json;
  assert.equal(grounded.research_grounded, true, `${parent.id}: supplied research pack was not recognized`);
  assert.equal(grounded.research_source_pack.candidate_facts.length, pack.candidate_facts.length, `${parent.id}: candidate facts were dropped`);
  const prompt = grounded.kie_claude_request.messages[0].content;
  assert.match(prompt, /RESEARCH_GROUNDING_V\d+/, `${parent.id}: grounded prompt lost the grounding contract`);
  assert.match(prompt, /SOURCE_SELECTION_V\d+/, `${parent.id}: grounded prompt lost the selection contract`);
  for (const fact of pack.candidate_facts) {
    assert.ok(prompt.includes(fact.evidence_summary), `${parent.id}: fact ${fact.fact_id} evidence was not supplied to the writer`);
  }
  for (const source of pack.sources) {
    assert.ok(prompt.includes(source.url), `${parent.id}: source ${source.source_id} url was not supplied to the writer`);
  }
  assert.match(prompt, /fact_id/, `${parent.id}: writer schema does not require a fact_id per ranked item`);
  assert.match(prompt, /source_ids/, `${parent.id}: writer schema does not require source_ids per ranked item`);
  // These must reach the delivered prompt, not merely exist in the node source.
  assert.match(prompt, /Write 5 ranked items by default/, `${parent.id}: delivered prompt never tells the writer to produce five items`);
  assert.match(prompt, /Aim for 5 ranked items/, `${parent.id}: delivered prompt never targets five researched items`);
  assert.match(prompt, /EVERYDAY_LANGUAGE_V1/, `${parent.id}: delivered prompt lost the everyday-language contract`);
  assert.match(prompt, /EVERYDAY_TOPIC_ANGLE_V\d+/, `${parent.id}: delivered prompt lost the everyday topic-angle contract`);
  assert.match(prompt, /kitchen-table Korean/i, `${parent.id}: delivered prompt lost the plain-language target`);

  // A pack with sources but no usable facts must not count as researched.
  const emptyFacts = runBuild(build, buildConfig({ dry_run: false, test_mode: false, research_source_pack: { sources: pack.sources, candidate_facts: [] } }))[0].json;
  assert.equal(emptyFacts.research_grounded, false, `${parent.id}: an empty fact list must not count as a research pack`);

  // Dry runs stay usable without research material.
  const dry = runBuild(build, buildConfig({ dry_run: true, test_mode: true }))[0].json;
  assert.equal(dry.research_grounded, false, `${parent.id}: dry run should not claim grounding`);
}

// ---------------------------------------------------------------------------
// Shared fixtures for the audit tests below.
// ---------------------------------------------------------------------------
const researchPack = JSON.parse(fs.readFileSync(path.join(root, parents[1].fixture), 'utf8')).research_source_pack;
const groundedPack = {
  channel_editorial_profile: 'longevity_daily_function',
  channel_content_pillar: 'longevity_meals',
  hook_title: '같은 밥상인데 식후가 갈리는 식탁 선택 5',
  subtitle: '무엇을 줄이느냐보다 무엇부터 뜨느냐가 달라요',
  rank_items: [
    {
      rank: 1,
      fact_id: 'F1',
      source_ids: ['S1'],
      name: '밥부터 먼저 뜨기',
      card_name: '밥부터 먼저 뜨기',
      reason: '같은 밥상이어도 밥을 먼저 먹으면 식후 혈당이 가장 가파르게 올라요',
      card_reason: '밥부터 먹으면 식후에 확 올라요',
    },
    {
      rank: 2,
      fact_id: 'F2',
      source_ids: ['S1'],
      name: '채소 반찬 먼저 먹기',
      card_name: '채소 반찬 먼저',
      reason: '나물이나 김치부터 먼저 먹고 밥을 나중에 먹으면 식후 혈당이 훨씬 완만하게 올라요',
      card_reason: '반찬부터 먹으면 훨씬 천천히 올라요',
    },
    {
      rank: 3,
      fact_id: 'F3',
      source_ids: ['S1'],
      name: '고기와 생선을 밥보다 먼저',
      card_name: '고기·생선 먼저',
      reason: '생선구이나 두부 같은 반찬을 채소와 함께 먼저 먹고 밥을 마지막에 두면 식후가 훨씬 편해요',
      card_reason: '밥을 마지막에 두면 덜 올라요',
    },
    {
      rank: 4,
      fact_id: 'F4',
      source_ids: ['S1'],
      name: '반찬 먹고 잠깐 뒤에 밥',
      card_name: '잠깐 뒤에 밥',
      reason: '반찬을 먼저 먹고 조금 있다가 밥을 뜨는 방식으로 시험했고 그 조건에서 차이가 나왔어요',
      card_reason: '반찬 먹고 조금 있다 밥을 떠요',
    },
    {
      rank: 5,
      fact_id: 'F5',
      source_ids: ['S2'],
      name: '순서 바꾸기를 어렵게 여기기',
      card_name: '어렵다는 생각',
      reason: '넉 달 동안 실제로 해 본 사람들 대부분이 어렵지 않았다고 답했고 채소와 단백질을 오히려 더 먹게 됐어요',
      card_reason: '해 본 사람 대부분 어렵지 않대요',
    },
  ],
  video_script: '같은 밥상도 순서만 바꾸면 식후가 달라져요.',
  description: '밥상에서 순서만 바꾸는 선택을 정리했어요.',
  pinned_comment: '밥부터 뜨는 대신 반찬을 먼저 먹고 밥을 나중에 두면 식후가 한결 편해져요. 새로 살 것도 끊을 것도 없이 순서만 바꾸면 돼요. 구독하시고 건강한 노년을 지키는 습관을 함께 이어가요.',
};
const groundedConfig = { channel_name: '건강장수비결', channel_editorial_profile: 'longevity_daily_function' };

// ---------------------------------------------------------------------------
// 2. Every ranked item must be linked to a fact and its sources.
// ---------------------------------------------------------------------------
const linkedResult = runGate(deterministicCode, { pack: groundedPack, config: groundedConfig, research_source_pack: researchPack })[0].json;
assert.equal(linkedResult.content_quality_review.pass, true, `fully linked grounded pack should pass structural review: ${JSON.stringify(linkedResult.content_quality_review.issues)}`);

// An uncited item is allowed: the pack supports the topic, it does not own it.
const missingFactId = structuredClone(groundedPack);
delete missingFactId.rank_items[1].fact_id;
missingFactId.rank_items[1].source_ids = [];
const missingFactResult = runGate(deterministicCode, { pack: missingFactId, config: groundedConfig, research_source_pack: researchPack })[0].json;
assert.equal(
  missingFactResult.content_quality_review.pass,
  true,
  `an item written outside the pack must not be blocked: ${JSON.stringify(missingFactResult.content_quality_review.issues)}`,
);

// A pack with no citations at all is fine too.
const noCitations = structuredClone(groundedPack);
for (const item of noCitations.rank_items) { delete item.fact_id; item.source_ids = []; }
const noCitationsResult = runGate(deterministicCode, { pack: noCitations, config: groundedConfig, research_source_pack: researchPack })[0].json;
assert.equal(noCitationsResult.content_quality_review.pass, true, 'a fully uncited pack must still be allowed');

const unknownFact = structuredClone(groundedPack);
unknownFact.rank_items[2].fact_id = 'F99';
const unknownFactResult = runGate(deterministicCode, { pack: unknownFact, config: groundedConfig, research_source_pack: researchPack })[0].json;
assert.equal(unknownFactResult.content_quality_review.pass, false, 'a fact_id outside the research pack must block');
assert.ok(unknownFactResult.content_quality_review.issues.some((issue) => issue.code === 'unknown_fact_id'));

const unknownSource = structuredClone(groundedPack);
unknownSource.rank_items[0].source_ids = ['S1', 'S404'];
const unknownSourceResult = runGate(deterministicCode, { pack: unknownSource, config: groundedConfig, research_source_pack: researchPack })[0].json;
assert.equal(unknownSourceResult.content_quality_review.pass, false, 'a source_id outside the research pack must block');
assert.ok(unknownSourceResult.content_quality_review.issues.some((issue) => issue.code === 'unknown_source_id'));

// Packs generated without research material keep working unchanged.
const ungroundedPack = structuredClone(groundedPack);
for (const item of ungroundedPack.rank_items) {
  delete item.fact_id;
  delete item.source_ids;
}
const ungroundedResult = runGate(deterministicCode, { pack: ungroundedPack, config: groundedConfig })[0].json;
assert.equal(ungroundedResult.content_quality_review.pass, true, 'source linkage must only be enforced when a research pack exists');

// ---------------------------------------------------------------------------
// 3. Numbers the cited fact does not contain must be blocked.
// ---------------------------------------------------------------------------
const inventedNumber = structuredClone(groundedPack);
inventedNumber.rank_items[2].card_reason = '밥을 20분 미루면 훨씬 덜 올라요';
const inventedNumberResult = runGate(deterministicCode, { pack: inventedNumber, config: groundedConfig, research_source_pack: researchPack })[0].json;
assert.equal(inventedNumberResult.content_quality_review.pass, false, 'a number absent from the cited fact must block');
assert.ok(inventedNumberResult.content_quality_review.issues.some((issue) => issue.code === 'fabricated_beyond_source' && issue.rank === 3));

const inventedPercentage = structuredClone(groundedPack);
inventedPercentage.rank_items[0].reason = '밥부터 먹으면 식후 혈당이 40% 더 올라요';
const inventedPercentageResult = runGate(deterministicCode, { pack: inventedPercentage, config: groundedConfig, research_source_pack: researchPack })[0].json;
assert.equal(inventedPercentageResult.content_quality_review.pass, false, 'a percentage no cited fact supports must block');
assert.ok(inventedPercentageResult.content_quality_review.issues.some((issue) => issue.code === 'unsupported_percentage'));

// ---------------------------------------------------------------------------
// 3b. Clinical wording must never reach the card, even when the source supports it.
// ---------------------------------------------------------------------------
const clinicalCopyPack = structuredClone(groundedPack);
clinicalCopyPack.rank_items[0].card_reason = '종아리 둘레가 34cm 미만이면 선별 기준이에요';
const clinicalCopyResult = runGate(deterministicCode, { pack: clinicalCopyPack, config: groundedConfig, research_source_pack: researchPack })[0].json;
assert.equal(clinicalCopyResult.content_quality_review.pass, false, 'a clinical measurement in visible copy must block');
assert.ok(clinicalCopyResult.content_quality_review.issues.some((issue) => issue.code === 'clinical_unit_in_visible_copy'));

const jargonCopyPack = structuredClone(groundedPack);
jargonCopyPack.rank_items[1].card_name = '산화마그네슘';
const jargonCopyResult = runGate(deterministicCode, { pack: jargonCopyPack, config: groundedConfig, research_source_pack: researchPack })[0].json;
assert.equal(jargonCopyResult.content_quality_review.pass, false, 'a chemical name in visible copy must block');
assert.ok(jargonCopyResult.content_quality_review.issues.some((issue) => issue.code === 'too_technical_for_audience'));

const clinicalTitlePack = structuredClone(groundedPack);
clinicalTitlePack.hook_title = '근감소증 선별 기준으로 보는 몸의 신호 5';
const clinicalTitleResult = runGate(deterministicCode, { pack: clinicalTitlePack, config: groundedConfig, research_source_pack: researchPack })[0].json;
assert.equal(clinicalTitleResult.content_quality_review.pass, false, 'a clinical title must block');
assert.ok(clinicalTitleResult.content_quality_review.issues.some((issue) => issue.code === 'too_technical_for_audience' && issue.field === 'hook_title'));

// Everyday numbers stay allowed.
const everydayNumberPack = structuredClone(groundedPack);
everydayNumberPack.rank_items[3].card_reason = '반찬 먹고 10분 뒤에 밥을 떠요';
const everydayNumberResult = runGate(deterministicCode, { pack: everydayNumberPack, config: groundedConfig, research_source_pack: researchPack })[0].json;
assert.equal(
  everydayNumberResult.content_quality_review.pass,
  true,
  `an ordinary daily number must stay allowed: ${JSON.stringify(everydayNumberResult.content_quality_review.issues)}`,
);

// ---------------------------------------------------------------------------
// 4-8. Reviewer-side information-value enforcement.
// ---------------------------------------------------------------------------
assert.match(buildReviewCode, /RESEARCH_GROUNDING_V\d+/, 'quality audit lost the research grounding rule');
assert.match(buildReviewCode, /claim_not_in_source_pack/, 'quality audit cannot reject a claim missing from the source pack');
assert.match(buildReviewCode, /fabricated_beyond_source/, 'quality audit cannot reject detail added beyond the source pack');
assert.match(buildReviewCode, /source_support/, 'quality audit schema does not record per-rank source support');
assert.match(parserCode, /incomplete_source_audit/, 'quality parser does not require the source audit to be filled');
assert.match(buildReviewCode, /EVERYDAY_LANGUAGE_V1/, 'quality audit lost the everyday-language rule');
assert.match(buildReviewCode, /too_technical_for_audience/, 'quality audit cannot reject clinical wording');
assert.match(buildReviewCode, /everyday_object/, 'quality audit schema does not record the ordinary thing each item is built on');
assert.match(parserCode, /incomplete_everyday_audit/, 'quality parser does not require the everyday-language audit');
assert.match(parserCode, /too_technical_for_audience/, 'quality parser cannot block clinical wording');

const auditBase = runGate(buildReviewCode, { pack: groundedPack, config: groundedConfig, research_source_pack: researchPack })[0].json;
assert.match(auditBase.kie_quality_review_request.messages[0].content, /research_source_pack/, 'reviewer prompt was not given the source pack');
assert.ok(
  auditBase.kie_quality_review_request.messages[0].content.includes(researchPack.candidate_facts[0].evidence_summary),
  'reviewer prompt was not given the evidence it must check against',
);

const fullAudit = groundedPack.rank_items.map((item) => ({
  rank: item.rank,
  confidence: 'high',
  basis_type: 'established_safety_guidance',
  explanation: '임상 지침의 선별 기준이에요',
  health_depth: 'high',
  medical_relevance: 'direct',
  decision_value: 'actionable',
  useful_detail: '집에서 확인할 수 있는 구체적인 기준값이에요',
  detail_type: 'established_number',
  decision_change: 'specific',
  claim_delivery: 'direct',
  everyday_language: 'plain',
  everyday_object: '밥상 위의 반찬과 밥',
  source_fact_id: item.fact_id,
  source_support: 'supported',
  card_name_clarity: 'clear',
  card_reason_completeness: 'complete',
  card_meaning: 'direct',
  causal_direction: 'clear',
  title_role: 'fulfills_exact_type',
  claim_strength: 'supported',
  alternative_causes: 'not_needed',
}));
const languageAudit = {
  status: 'natural',
  first_read: 'clear',
  human_voice: 'natural',
  checked_fields: ['hook_title', 'subtitle', 'rank_item_names', 'card_copy', 'video_script', 'description', 'pinned_comment'],
  problems: [],
};
const commentAudit = { summary_fit: 'direct', question_cta: 'absent', channel_closing: 'aligned', explanation: '정확히 이 팩을 요약해요' };
const channelAudit = { profile: 'longevity_daily_function', pillar: 'longevity_meals', fit: 'direct', explanation: '건강한 노년의 식사 습관을 다뤄요' };

function parseReview(review, base = auditBase) {
  const response = { content: [{ type: 'text', text: JSON.stringify({ language_audit: languageAudit, comment_audit: commentAudit, channel_audit: channelAudit, ...review }) }] };
  return runGate(parserCode, response, { $: () => ({ first: () => ({ json: base }) }) })[0].json;
}

// 6. Short, concrete, source-backed copy passes.
const passing = parseReview({ decision: 'pass', issues: [], audit: fullAudit });
assert.equal(passing.content_quality_review.pass, true, `grounded concrete pack should pass: ${JSON.stringify(passing.content_quality_review.issues)}`);
assert.equal(passing.pack, auditBase.pack, 'the audit must hand back the original writer pack unchanged');

// 2. Reviewer must fill the source audit when a research pack exists.
const noSourceAudit = parseReview({ decision: 'pass', issues: [], audit: fullAudit.map(({ source_fact_id, source_support, ...rest }) => rest) });
assert.equal(noSourceAudit.content_quality_review.pass, false, 'a missing source audit must block when a research pack was supplied');
assert.ok(noSourceAudit.content_quality_review.issues.some((issue) => issue.code === 'incomplete_source_audit'));

// 3. Reviewer-detected unsupported claims block.
const unsupportedAudit = structuredClone(fullAudit);
unsupportedAudit[1].source_support = 'unsupported';
const unsupportedResult = parseReview({ decision: 'pass', issues: [], audit: unsupportedAudit });
assert.equal(unsupportedResult.content_quality_review.pass, false, 'a claim the cited fact does not support must block');
assert.ok(unsupportedResult.content_quality_review.issues.some((issue) => issue.code === 'claim_not_in_source_pack' && issue.rank === 2));

const partialAudit = structuredClone(fullAudit);
partialAudit[0].source_support = 'partially_supported';
const partialResult = parseReview({ decision: 'pass', issues: [], audit: partialAudit });
assert.equal(partialResult.content_quality_review.pass, false, 'a partially supported claim must block rather than ship');

// 4. Copy that only restates the title or the item name blocks.
const restatementResult = parseReview({
  decision: 'reject',
  issues: [{ rank: 1, code: 'low_information_value', message: 'card_reason restates card_name without adding a condition or action.' }],
  audit: fullAudit,
});
assert.equal(restatementResult.content_quality_review.pass, false, 'card copy that only restates the name must block');
assert.ok(restatementResult.content_quality_review.issues.some((issue) => issue.code === 'low_information_value'));

const restatementAudit = structuredClone(fullAudit);
restatementAudit[2].detail_type = 'none';
restatementAudit[2].decision_change = 'generic';
const restatementAuditResult = parseReview({ decision: 'pass', issues: [], audit: restatementAudit });
assert.equal(restatementAuditResult.content_quality_review.pass, false, 'a restated item must block even when the reviewer says pass');
assert.ok(restatementAuditResult.content_quality_review.issues.some((issue) => issue.code === 'low_information_value' && issue.rank === 3));

// 5 and 7. Generic safety padding blocks; precise uncertainty passes.
const paddingAudit = structuredClone(fullAudit);
paddingAudit[0].useful_detail = '건강에 도움이 될 수 있어요';
paddingAudit[0].claim_delivery = 'generic_padding';
const paddingResult = parseReview({ decision: 'pass', issues: [], audit: paddingAudit });
assert.equal(paddingResult.content_quality_review.pass, false, 'blanket safety padding must block');
assert.ok(paddingResult.content_quality_review.issues.some((issue) => issue.code === 'generic_safe_summary'));

const calibratedAudit = structuredClone(fullAudit);
calibratedAudit[0].claim_delivery = 'calibrated';
calibratedAudit[0].useful_detail = '부종이 있으면 둘레가 실제 근육량보다 크게 나올 수 있어요';
calibratedAudit[0].claim_strength = 'appropriately_qualified';
calibratedAudit[0].alternative_causes = 'acknowledged';
const calibratedResult = parseReview({ decision: 'pass', issues: [], audit: calibratedAudit });
assert.equal(
  calibratedResult.content_quality_review.pass,
  true,
  `a qualifier that names the exact exception must pass: ${JSON.stringify(calibratedResult.content_quality_review.issues)}`,
);

// 8. Five items is the default; four is the floor and seven the ceiling, and padding is still refused.
assert.equal(groundedPack.rank_items.length, 5, 'the grounded verification pack should demonstrate the five-item default');
const fourItemPack = { ...structuredClone(groundedPack), rank_items: structuredClone(groundedPack).rank_items.slice(0, 4) };
const fourItemResult = runGate(deterministicCode, { pack: fourItemPack, config: groundedConfig, research_source_pack: researchPack })[0].json;
assert.equal(fourItemResult.content_quality_review.pass, true, 'four well-supported items must remain acceptable');

const threeItemPack = { ...structuredClone(groundedPack), rank_items: structuredClone(groundedPack).rank_items.slice(0, 3) };
const threeItemResult = runGate(deterministicCode, { pack: threeItemPack, config: groundedConfig, research_source_pack: researchPack })[0].json;
assert.equal(threeItemResult.content_quality_review.pass, false, 'a three-item card is below the new floor and must block');
assert.ok(threeItemResult.content_quality_review.issues.some((issue) => issue.code === 'rank_count'));

const sevenItemPack = structuredClone(groundedPack);
sevenItemPack.rank_items = [...sevenItemPack.rank_items, { ...structuredClone(groundedPack).rank_items[0], rank: 6 }, { ...structuredClone(groundedPack).rank_items[1], rank: 7 }];
const sevenItemResult = runGate(deterministicCode, { pack: sevenItemPack, config: groundedConfig, research_source_pack: researchPack })[0].json;
assert.equal(sevenItemResult.content_quality_review.pass, true, 'seven items must be allowed when the facts support them');

const eightItemPack = structuredClone(sevenItemPack);
eightItemPack.rank_items.push({ ...structuredClone(groundedPack).rank_items[2], rank: 8 });
const eightItemResult = runGate(deterministicCode, { pack: eightItemPack, config: groundedConfig, research_source_pack: researchPack })[0].json;
assert.equal(eightItemResult.content_quality_review.pass, false, 'more than seven items must block');

for (const parent of parents) {
  const build = codeOf(readWorkflow(parent.file), 'Build Viral Rank Pack Request');
  assert.match(build, /Default to 5 items/, `${parent.id}: writer is not told to default to five items`);
  assert.match(build, /Aim for 5 ranked items/, `${parent.id}: research contract does not target five items`);
  assert.match(build, /ATTENTION_PROMISE_V\d+/, `${parent.id}: proven-hook contract missing`);
  assert.match(build, /HOOK_PATTERNS/, `${parent.id}: channel-proven title shapes are not supplied`);
  assert.match(build, /대부분이 잘못 알고 있는/, `${parent.id}: belief-reversal hook shape missing`);
  assert.match(build, /모르면 손해 보는/, `${parent.id}: loss-frame hook shape missing`);
  assert.match(build, /filing label/i, `${parent.id}: report-style title is not rejected in favour of a spoken hook`);
  assert.match(build, /required to be earned/i, `${parent.id}: hook shapes are not tied to a real payoff`);
  assert.match(build, /EVERYDAY_LANGUAGE_V1/, `${parent.id}: everyday-language contract missing`);
  assert.match(build, /EVERYDAY_TOPIC_ANGLE_V\d+/, `${parent.id}: everyday topic-angle contract missing`);
  assert.match(build, /senior lifestyle channel, not a clinical education channel/i, `${parent.id}: channel is still framed as clinical education`);
  assert.match(build, /kitchen-table Korean/i, `${parent.id}: plain-language target missing`);
  assert.match(build, /without measuring, testing, or buying anything/i, `${parent.id}: items are not constrained to act-tonight behaviour`);
}

// Reviewer must block clinical copy even when the deterministic scan misses it.
const technicalAudit = structuredClone(fullAudit);
technicalAudit[0].everyday_language = 'technical';
const technicalAuditResult = parseReview({ decision: 'pass', issues: [], audit: technicalAudit });
assert.equal(technicalAuditResult.content_quality_review.pass, false, 'reviewer-flagged clinical wording must block');
assert.ok(technicalAuditResult.content_quality_review.issues.some((issue) => issue.code === 'too_technical_for_audience' && issue.rank === 1));

const missingEverydayAudit = parseReview({ decision: 'pass', issues: [], audit: fullAudit.map(({ everyday_language, everyday_object, ...rest }) => rest) });
assert.equal(missingEverydayAudit.content_quality_review.pass, false, 'a missing everyday-language audit must block');
assert.ok(missingEverydayAudit.content_quality_review.issues.some((issue) => issue.code === 'incomplete_everyday_audit'));

// ---------------------------------------------------------------------------
// 13. A prepared final_pack must render verbatim with no content generation.
// ---------------------------------------------------------------------------
const preparedFinalPack = {
  hook_title: groundedPack.hook_title,
  subtitle: groundedPack.subtitle,
  visual_profile: 'kitchen_table',
  visual_mood_hint: '따뜻한 나무 식탁과 반찬 그릇이 놓인 저녁 밥상, 세이지 그린과 크림색 팔레트',
  rank_items: structuredClone(groundedPack.rank_items),
  video_script: groundedPack.video_script,
  description: groundedPack.description,
  pinned_comment: groundedPack.pinned_comment,
  bgm_prompt: 'warm calm nylon guitar, unhurried mealtime mood',
  tags: ['건강정보', '시니어건강'],
};

for (const parent of parents) {
  const workflow = readWorkflow(parent.file);
  const build = codeOf(workflow, 'Build Viral Rank Pack Request');
  const mock = codeOf(workflow, 'Mock Viral Rank Pack');
  const load = codeOf(workflow, 'Load Config');

  assert.match(
    load,
    /require_research_source_pack: bool\(incoming\.require_research_source_pack, false\)/,
    `${parent.id}: research pack must stay opt-in — a true default makes every packless live run throw RESEARCH_SOURCE_REQUIRED`,
  );
  assert.match(load, /final_pack: value\.final_pack/, `${parent.id}: topic files cannot carry a prepared pack`);
  assert.match(load, /config\.prepared_card_pack = config\.prepared_card_pack/, `${parent.id}: prepared pack never reaches the config`);
  assert.match(mock, /PREPARED_CARD_PACK_V1_BEGIN/, `${parent.id}: verbatim render branch missing`);
  assert.match(build, /PREPARED_CARD_PACK_INVALID/, `${parent.id}: prepared pack is not validated before use`);
  // The Instagram source-reel path must stay switched off in the legacy circuit.
  assert.match(build, /const lockedSourcePack = null;/, `${parent.id}: source-reel locked pack leaked into the legacy circuit`);

  const preparedBuild = runBuild(build, buildConfig({ dry_run: false, test_mode: false, prepared_card_pack: preparedFinalPack }))[0].json;
  assert.ok(preparedBuild.prepared_card_pack, `${parent.id}: prepared pack was not detected`);
  assert.equal(preparedBuild.config.use_live_kie_ai, false, `${parent.id}: prepared pack must switch off live text generation`);

  const rendered = new Function('$input', mock)({ first: () => ({ json: preparedBuild }) })[0].json;
  assert.equal(rendered.ai_source, 'prepared_card_pack', `${parent.id}: prepared pack was not rendered verbatim`);
  assert.equal(rendered.pack.hook_title, preparedFinalPack.hook_title, `${parent.id}: title was rewritten`);
  assert.equal(rendered.pack.pinned_comment, preparedFinalPack.pinned_comment, `${parent.id}: pinned comment was rewritten`);
  assert.equal(rendered.pack.bgm_prompt, preparedFinalPack.bgm_prompt, `${parent.id}: BGM direction was rewritten`);
  assert.deepEqual(
    rendered.pack.rank_items.map((item) => [item.card_name, item.card_reason]),
    preparedFinalPack.rank_items.map((item) => [item.card_name, item.card_reason]),
    `${parent.id}: visible card copy was not preserved verbatim`,
  );

  // A prepared pack satisfies the research requirement on its own.
  assert.doesNotThrow(
    () => runBuild(build, buildConfig({ dry_run: false, test_mode: false, prepared_card_pack: preparedFinalPack })),
    `${parent.id}: a prepared pack should not be blocked by the research requirement`,
  );

  // A prepared pack with no scene direction produced a visibly worse card, so it must be rejected.
  assert.throws(
    () => runBuild(build, buildConfig({ dry_run: false, test_mode: false, prepared_card_pack: { ...preparedFinalPack, visual_mood_hint: '' } })),
    /PREPARED_CARD_PACK_INVALID/,
    `${parent.id}: a prepared pack without a scene direction must be rejected`,
  );

  // Malformed prepared packs must fail loudly instead of silently regenerating.
  assert.throws(
    () => runBuild(build, buildConfig({ dry_run: false, test_mode: false, prepared_card_pack: { ...preparedFinalPack, rank_items: preparedFinalPack.rank_items.slice(0, 3) } })),
    /PREPARED_CARD_PACK_INVALID/,
    `${parent.id}: a three-item prepared pack must be rejected`,
  );
  assert.throws(
    () => runBuild(build, buildConfig({
      dry_run: false,
      test_mode: false,
      prepared_card_pack: {
        ...preparedFinalPack,
        rank_items: preparedFinalPack.rank_items.map((item, index) => index === 0 ? { ...item, card_reason: '' } : item),
      },
    })),
    /PREPARED_CARD_PACK_INVALID/,
    `${parent.id}: a prepared pack missing visible copy must be rejected`,
  );
}

// Prepared packs face the AI reviewer like generated ones: a curated card of
// pure common sense shipped verbatim when they were exempt. On rejection the
// retry node must stop the run instead of regenerating the curated copy.
const preparedGateInput = { pack: groundedPack, config: { ...groundedConfig, dry_run: false, test_mode: false }, prepared_card_pack: preparedFinalPack, research_source_pack: researchPack };
assert.equal(runGate(buildReviewCode, preparedGateInput)[0].json.use_ai_quality_review, true, 'prepared packs must be judged by the AI reviewer for usefulness');
const generatedGateInput = { pack: groundedPack, config: { ...groundedConfig, dry_run: false, test_mode: false }, research_source_pack: researchPack };
assert.equal(runGate(buildReviewCode, generatedGateInput)[0].json.use_ai_quality_review, true, 'generated packs must still get the AI reviewer');
assert.match(buildReviewCode, /COMMON_KNOWLEDGE_V1/, 'the reviewer lost the 나도 알지 usefulness test');
for (const parent of parents) {
  const retry = codeOf(readWorkflow(parent.file), 'Prepare Medical Retry Request');
  assert.match(retry, /PREPARED_PACK_REJECTED/, `${parent.id}: a rejected prepared pack would be silently regenerated instead of stopping the run`);
}

// ---------------------------------------------------------------------------
// 10, 11. Node identity preservation and live-database agreement.
// ---------------------------------------------------------------------------
function get(db, sql, params = []) {
  return new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
}

const db = new sqlite3.Database(path.join(root, '.n8n', 'database.sqlite'), sqlite3.OPEN_READONLY);
try {
  for (const target of [...parents, { id: 'sharedContentQualityGate01', file: sharedFile }]) {
    const fileWorkflow = readWorkflow(target.file);
    const row = await get(db, 'SELECT nodes, connections FROM workflow_entity WHERE id=?', [target.id]);
    assert.ok(row, `${target.id}: workflow missing from the live database`);
    const liveNodes = JSON.parse(row.nodes);
    assert.deepEqual(
      liveNodes.map((node) => [node.id, node.name, node.type, node.position]).sort(),
      fileWorkflow.nodes.map((node) => [node.id, node.name, node.type, node.position]).sort(),
      `${target.id}: node ids, names, types, or positions drifted between the repository and the live database`,
    );
    assert.deepEqual(JSON.parse(row.connections), fileWorkflow.connections, `${target.id}: connections drifted between the repository and the live database`);
  }
} finally {
  await new Promise((resolve) => db.close(resolve));
}

// ---------------------------------------------------------------------------
// 12. Re-running the canonical scripts must not produce another diff.
// ---------------------------------------------------------------------------
// `install-shared-content-quality-gate.mjs` owns the shared gate and re-seeds the parent retry node,
// so it must run before `simplify-legacy-editorial-flow.mjs`, which owns the parent editorial nodes.
// Each script is therefore checked for stability only over the files it is the last writer for.
const canonicalOwnership = [
  { script: 'scripts/install-shared-content-quality-gate.mjs', owns: (filePath) => path.basename(filePath) === 'shared_content_quality_gate.json' },
  { script: 'scripts/simplify-legacy-editorial-flow.mjs', owns: (filePath) => path.basename(filePath) !== 'shared_content_quality_gate.json' },
];
for (const { script, owns } of canonicalOwnership) {
  const emitted = JSON.parse(
    execFileSync(process.execPath, [path.join(root, script), '--emit-workflow-json'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .replace(/^﻿/, ''),
  );
  for (const entry of emitted.filter((candidate) => owns(candidate.filePath))) {
    const current = JSON.parse(fs.readFileSync(entry.filePath, 'utf8'));
    const next = JSON.parse(entry.content);
    assert.deepEqual(next.nodes, current.nodes, `${script}: re-running the canonical script would change ${path.basename(entry.filePath)} nodes`);
    assert.deepEqual(next.connections, current.connections, `${script}: re-running the canonical script would change ${path.basename(entry.filePath)} connections`);
  }
}

console.log('PASS: research-grounded generation, source-linked auditing, and canonical script stability verified');
