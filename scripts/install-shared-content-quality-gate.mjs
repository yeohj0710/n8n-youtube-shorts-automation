import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sqlite3 from 'sqlite3';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const dbPath = path.join(root, '.n8n', 'database.sqlite');
const sharedId = 'sharedContentQualityGate01';
const sharedName = 'Shared Content Quality Gate - 사실성·설명 품질 검수';
const parentIds = ['mxrYb3maJS31gEYC', 'baekse100Life01'];
const projectId = 'aEvRqZD8wENZ1iRJ';
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
const backupDir = path.join(root, 'etc', `backup-before-shared-quality-gate-${stamp}`);

const channelPolicyHelpers = `function channelProfilePolicy(config) {
  const profileId = clean(config?.channel_editorial_profile);
  const policies = {
    haru_health_literacy: {
      id: 'haru_health_literacy',
      channel: '하루건강약사',
      summary: '몸과 성분을 이해해 영양, 음식, 영양제, 피부, 활력에 관한 선택을 판단하도록 돕는 이해 중심 건강교육',
      pillars: new Set(['nutrition_food_choices', 'supplement_ingredients', 'body_signals', 'skin_vitality', 'sleep_recovery_science', 'medicine_literacy', 'daily_health_choices']),
    },
    longevity_daily_function: {
      id: 'longevity_daily_function',
      channel: '건강장수비결',
      summary: '식사, 운동, 수면, 혈압, 혈당, 관절을 관리해 건강한 장수와 일상 기능, 자립을 지키는 실천형 건강교육',
      pillars: new Set(['cardiometabolic', 'joints_balance_falls', 'strength_walking', 'longevity_meals', 'sleep_recovery', 'daily_function', 'chronic_risk_signals']),
    },
  };
  return policies[profileId] || null;
}

function inspectChannelIdentity(value, config) {
  const policy = channelProfilePolicy(config);
  if (!policy) return [];
  const issues = [];
  const packProfile = clean(value?.channel_editorial_profile);
  const pillar = clean(value?.channel_content_pillar);
  if (packProfile !== policy.id) issues.push({ code: 'channel_profile_mismatch', expected: policy.id, actual: packProfile || null });
  if (!pillar || !policy.pillars.has(pillar)) issues.push({ code: 'channel_pillar_mismatch', profile: policy.id, pillar: pillar || null });
  return issues;
}`;

const sourceGroundingHelpers = `function researchSourcePackOf(data) {
  const value = data?.research_source_pack || data?.config?.research_source_pack || null;
  if (!value || typeof value !== 'object') return null;
  const sources = Array.isArray(value.sources) ? value.sources : [];
  const facts = Array.isArray(value.candidate_facts) ? value.candidate_facts : [];
  if (!sources.length || !facts.length) return null;
  return { sources, candidate_facts: facts };
}

function inspectEverydayLanguage(pack) {
  const issues = [];
  const clinicalUnit = /\\d+(?:[.,]\\d+)?\\s*(?:cm|mm|kg|g\\b|mg|mcg|ug|㎍|ml|mmhg|kcal|%|초당|점 중)/i;
  const clinicalTerm = /(선별\\s*기준|분획|흡수율|유의하게|양성률|민감도|특이도|산화마그네슘|아스파르트산|구연산마그네슘|sarc-?f|awgs|hba1c|iauc|질병코드|진단 기준|컷오프)/i;
  const fields = [
    ['hook_title', pack?.hook_title],
    ['subtitle', pack?.subtitle],
  ];
  for (const [index, item] of (Array.isArray(pack?.rank_items) ? pack.rank_items : []).entries()) {
    const rank = Number(item?.rank || index + 1);
    for (const [field, value] of [['card_name', item?.card_name], ['card_reason', item?.card_reason]]) {
      const text = clean(value);
      if (clinicalUnit.test(text)) issues.push({ rank, code: 'clinical_unit_in_visible_copy', field, value: text });
      else if (clinicalTerm.test(text)) issues.push({ rank, code: 'too_technical_for_audience', field, value: text });
    }
  }
  for (const [field, value] of fields) {
    const text = clean(value);
    if (clinicalUnit.test(text)) issues.push({ code: 'clinical_unit_in_visible_copy', field, value: text });
    else if (clinicalTerm.test(text)) issues.push({ code: 'too_technical_for_audience', field, value: text });
  }
  return issues;
}

function sourceBackedNumbers(item, researchPack) {
  if (!researchPack) return null;
  const fact = researchPack.candidate_facts.find((entry) => clean(entry?.fact_id) === clean(item?.fact_id));
  if (!fact) return new Set();
  return new Set(String([fact.claim, fact.evidence_summary, fact.necessary_condition, fact.limitation_or_boundary].filter(Boolean).join(' ')).match(/\\d+(?:[.,]\\d+)?/g) || []);
}

function inspectSourceGrounding(pack, researchPack) {
  if (!researchPack) return [];
  const issues = [];
  const factIds = new Map(researchPack.candidate_facts.map((fact) => [clean(fact?.fact_id), fact]));
  const sourceIds = new Set(researchPack.sources.map((source) => clean(source?.source_id)));
  const items = Array.isArray(pack?.rank_items) ? pack.rank_items : [];
  for (const [index, item] of items.entries()) {
    const rank = Number(item?.rank || index + 1);
    const factId = clean(item?.fact_id);
    const itemSourceIds = (Array.isArray(item?.source_ids) ? item.source_ids : []).map(clean).filter(Boolean);
    // A research pack is supporting evidence, not a required source for every
    // item, so an uncited item is allowed. A citation that points at something
    // absent from the pack is still a hard error.
    if (factId && !factIds.has(factId)) {
      issues.push({ rank, code: 'unknown_fact_id', message: 'Ranked item cites a fact_id that is not in the research source pack.', fact_id: factId });
    }
    for (const sourceId of itemSourceIds) {
      if (!sourceIds.has(sourceId)) {
        issues.push({ rank, code: 'unknown_source_id', message: 'Ranked item cites a source_id that is not in the research source pack.', source_id: sourceId });
      }
    }
    const packFactNumbers = sourceBackedNumbers(item, researchPack) || new Set();
    const cardNumbers = String([item?.card_reason, item?.card_name, item?.reason].filter(Boolean).join(' ')).match(/\\d+(?:[.,]\\d+)?/g) || [];
    for (const number of cardNumbers) {
      if (!packFactNumbers.has(number)) {
        issues.push({ rank, code: 'fabricated_beyond_source', message: 'Visible copy uses a number that the cited research fact does not contain.', value: number });
        break;
      }
    }
  }
  return issues;
}`;

const buildReviewCode = `const data = $input.first().json;
const pack = data.pack || {};
const cfg = data.config || {};

function clean(value) {
  return String(value || '').replace(/\\s+/g, ' ').trim();
}

${channelPolicyHelpers}

${sourceGroundingHelpers}

function inspectPack(value, researchPack) {
  const issues = [];
  const items = Array.isArray(value?.rank_items) ? value.rank_items : [];
  if (items.length < 4 || items.length > 7) {
    issues.push({ code: 'rank_count', message: 'Rank item count must be 4-7, and 5 is the default target.', count: items.length });
  }
  const vagueEnding = /(점검|확인|도움|부담|충분|기본|균형|관리|변화|문제|위험)$/;
  for (const [index, item] of items.entries()) {
    const rank = Number(item?.rank || index + 1);
    const name = clean(item?.name);
    const cardName = clean(item?.card_name);
    const reason = clean(item?.reason);
    const cardReason = clean(item?.card_reason);
    if (!name) issues.push({ rank, code: 'missing_name', message: 'Item name is missing.' });
    if (!cardName) issues.push({ rank, code: 'missing_card_name', message: 'Short image item name is missing.' });
    if ([...cardName].length > 30) issues.push({ rank, code: 'card_name_too_long', message: 'Short image item name exceeds 30 characters.', length: [...cardName].length });
    if (!reason) issues.push({ rank, code: 'missing_reason', message: 'Item reason is missing.', value: reason });
    if (!cardReason) issues.push({ rank, code: 'missing_card_reason', message: 'Mobile card sentence is missing.' });
    if ([...cardReason].length > 60) issues.push({ rank, code: 'card_copy_too_long', message: 'Mobile card sentence exceeds 60 characters.', length: [...cardReason].length });
    if (/^(?:왜|이유|핵심|tip)\\s*[:：]/i.test(cardReason)) issues.push({ rank, code: 'card_label_prefix', message: 'Mobile card sentence must not start with a repeated label.' });
    const backedNumbers = sourceBackedNumbers(item, researchPack);
    const percentages = reason.match(/(\\d{1,3})%/g) || [];
    const unbackedPercentage = percentages.some((match) => !backedNumbers || !backedNumbers.has(match.replace('%', '')));
    if (unbackedPercentage) issues.push({ rank, code: 'unsupported_percentage', message: 'Reason contains a percentage that no cited research fact supports.', value: reason });
  }
  const viewerCopy = [
    value?.hook_title,
    value?.subtitle,
    value?.video_script,
    value?.description,
    value?.pinned_comment,
    ...items.flatMap((item) => [item?.name, item?.card_name, item?.reason, item?.card_reason, item?.caution]),
  ].map(clean).filter(Boolean).join(' ');
  if (/[가-힣]니다(?:[.!?]|\\s|$)/.test(viewerCopy)) {
    issues.push({ code: 'channel_tone_mismatch', message: 'Viewer-facing copy must use Korean 해요체 instead of 합니다체.' });
  }
  // A card whose every line is bent into the same sentence shape reads like
  // machine translation even when each line is fine on its own. The usual
  // offender is the if-then clause: five consecutive 조건절 is English grammar
  // wearing Korean words. Spoken Korean varies its shape line to line.
  const sentenceShape = (text) => {
    if (!text) return '';
    // Order matters: a line carrying an if-clause is built on that clause even
    // when it also contains a 는데 contrast, so 조건절 is checked first.
    if (text.includes('면 ') || text.endsWith('면')) return 'conditional';
    if (text.includes('는데') || text.includes('지만')) return 'contrast';
    if (text.includes('어서') || text.includes('아서') || text.includes('라서') || text.includes('때문')) return 'cause';
    return 'plain';
  };
  // A bare demonstrative on the card means the line cannot be read on its own:
  // 이때가 발톱을 보는 순간이에요 never says what changed about the 발톱.
  for (const [index, item] of items.entries()) {
    const cardReason = clean(item?.card_reason);
    // Must start a word: 물건이거든요 and 사람이거나 contain 이거 as a substring
    // and are perfectly clear, so only a standalone demonstrative counts.
    const demonstrative = cardReason.match(/(?:^|[^가-힣])(그것|그거|이것|이거|이때|그때|이렇게|그렇게)/);
    if (demonstrative) {
      issues.push({
        rank: Number(item?.rank || index + 1),
        code: 'vague_demonstrative',
        message: 'Card copy leans on a demonstrative instead of naming the thing, so the line cannot be read on its own.',
        value: demonstrative[1],
      });
    }
  }
  const shapes = items.map((item) => sentenceShape(clean(item?.card_reason))).filter(Boolean);
  if (shapes.length >= 4) {
    const shapeCounts = {};
    // Plain statements are the neutral default and repeat harmlessly; it is a
    // marked construction repeated down the list that reads as translated.
    for (const shape of shapes) if (shape !== 'plain') shapeCounts[shape] = (shapeCounts[shape] || 0) + 1;
    const [dominant, dominantCount] = Object.entries(shapeCounts).sort((left, right) => right[1] - left[1])[0] || ['', 0];
    if (dominantCount / shapes.length >= 0.8) {
      issues.push({
        code: 'monotonous_sentence_shape',
        message: 'Almost every card_reason uses the same sentence shape, which reads as translated rather than spoken Korean. Vary the shape across ranks.',
        shape: dominant,
        count: dominantCount,
        of: shapes.length,
      });
    }
  }
  return issues;
}

const qualityPreflight = {
  contract_version: '1.0',
  issues: [
    ...inspectPack(pack, researchSourcePackOf(data)),
    ...inspectChannelIdentity(pack, cfg),
    ...inspectSourceGrounding(pack, researchSourcePackOf(data)),
    ...inspectEverydayLanguage(pack),
    ...(/(?:^|[.!?]\\s*)(?:저는|제가|저희 집|저희 어머니|우리 어머니|직접 해보니|써보니|먹어보니)/.test(clean(pack.pinned_comment)) ? [{
      code: 'fabricated_personal_anecdote',
      message: 'Pinned comment presents an unverifiable first-person or family anecdote as the channel owner experience.',
    }] : []),
    ...(/[?？]/.test(clean(pack.pinned_comment)) || /(?:댓글|답글)(?:로|에)?\\s*(?:남겨|알려|적어|써|달아)/.test(clean(pack.pinned_comment)) || /좋아요(?:를)?\\s*(?:눌러|부탁|해\\s*주세요)/.test(clean(pack.pinned_comment)) || /(?:어떠세요|있으셨나요|해보셨나요|궁금하신가요)(?:[.!]?|$)/.test(clean(pack.pinned_comment)) ? [{
      code: 'comment_question_cta',
      message: 'Pinned comment asks a question or requests a reply, comment, or like instead of giving a plain summary.',
    }] : []),
    ...(data.content_duplicate_check?.blocking ? [{
      code: 'recent_title_duplicate',
      message: 'Generated title is too similar to a recent title and must be regenerated.',
      generated_title: data.content_duplicate_check.generated_title,
      similar_to: data.content_duplicate_check.similar_to,
    }] : []),
  ],
  checked_at: new Date().toISOString(),
};

const schema = {
  decision: 'pass | reject',
  issues: [{ rank: 1, code: 'specific_code', message: 'Korean explanation' }],
  channel_audit: {
    profile: cfg.channel_editorial_profile || '',
    pillar: pack.channel_content_pillar || '',
    fit: 'direct | mismatch',
    explanation: 'How the topic directly serves this channel purpose and differs from the other channel',
  },
  language_audit: {
    status: 'natural | malformed',
    first_read: 'clear | unclear',
    human_voice: 'natural | mechanical',
    checked_fields: ['hook_title', 'subtitle', 'rank_item_names', 'card_copy', 'video_script', 'description', 'pinned_comment'],
    problems: [{ field: 'rank_items[1].card_name', text: 'problematic original phrase', type: 'grammar | collocation | missing_particle_or_counter | literal_translation | unclear_reference | compressed_keyword_fragment | abstract_or_vague_visible_copy | forced_nominalization | bureaucratic_noun_stack | repeated_ai_template', explanation: 'Why the phrase is malformed, unclear, or mechanically written' }],
  },
  comment_audit: {
    summary_fit: 'direct | mismatch',
    question_cta: 'absent | present',
    channel_closing: 'aligned | missing | mismatch',
    explanation: 'Why the comment accurately summarizes the exact pack and ends with the configured channel closing',
  },
  audit: [{
    rank: 1,
    confidence: 'high | medium | low',
    basis_type: 'physical_mechanism | storage_guidance | nutrition_basics | behavioral_mechanism | established_safety_guidance | uncertain',
    explanation: '왜 이 근거를 신뢰할 수 있는지 짧게 설명',
    useful_detail: '이 항목을 실제 선택에 유용하게 만드는 조건·기전·행동·경계 중 하나',
    detail_type: 'condition | mechanism | comparison | label_field | timing_or_situation | interaction | observable_pattern | practical_action | boundary | established_number | none',
    decision_change: 'specific | generic | none',
    claim_delivery: 'direct | calibrated | generic_padding',
    everyday_language: 'plain | technical',
    everyday_object: 'the ordinary food, drink, object, place, time, action, or body feeling this item is built around',
    source_fact_id: 'the research_source_pack candidate_fact id this ranked item cites, or empty when no research pack was supplied',
    source_support: 'supported | partially_supported | unsupported | no_research_pack',
    precision_check: 'supported | no_exact_number | unsupported',
    health_depth: 'high | adequate | low',
    medical_relevance: 'direct | incidental | none',
    decision_value: 'actionable | limited | none',
    card_name_clarity: 'clear | unclear',
    card_reason_completeness: 'complete | missing_role',
    card_meaning: 'direct | vague',
    causal_direction: 'clear | ambiguous',
    title_role: 'fulfills_exact_type | mismatch',
    claim_strength: 'supported | appropriately_qualified | overstated',
    alternative_causes: 'not_needed | acknowledged | missing',
  }],
};

const channelPolicy = channelProfilePolicy(cfg);
const configuredChannelIdentity = channelPolicy
  ? channelPolicy.channel + ': ' + channelPolicy.summary
  : 'No channel-specific profile was supplied.';

const prompt = [
  'You are an independent, skeptical audit only. You are not the original writer.',
  'Review the Korean ranked content pack below before any image, video, or upload is created.',
  'Do not rewrite, polish, expand, reorder, or replace any title, item, reason, caution, description, comment, visual direction, or BGM direction.',
  'Your only job is to pass the original pack or reject it when a clear factual or structural failure exists. Return strict JSON only.',
  'Rules:',
  'A. Check whether the title promise is semantically fulfilled by every ranked item. Mere membership in the same broad subject is not enough.',
  'A2. Determine the semantic class named by the title count-bearing phrase and the semantic class of every ranked entry. Every entry must be an instance of the title class. Reject a mismatch or a title that counts an abstraction instead of its entries with issue code title_item_type_mismatch. Record title_role for every rank.',
  'B. Reject abrupt topic drift or an unrelated item. Use issue code title_item_mismatch when an item does not fulfill the title, and unrelated_item when it belongs to a different logical list.',
  'C. For each explanation, verify that the stated cause can reasonably produce the stated result and that the causal chain is understandable without guessing missing steps. Use issue code causal_gap for a broken, reversed, or unexplained causal link.',
  'C2. Distinguish observation, association, cause, and diagnosis. Reject any claim that upgrades an observation or association into a cause or diagnosis without adequate support and stated conditions, using issue code overstated_causal_attribution. When several explanations remain plausible, calibrated wording must include a decision-relevant boundary or next check. Record claim_strength and alternative_causes for every rank.',
  'D. Reject internal contradictions between title, item name, reason, and caution. Use issue code logical_contradiction.',
  'E. The pinned_comment must summarize the exact title and item set in 2-4 short natural Korean sentences. It should select 2-3 of the most useful actions or principles and preserve their practical meaning without copying the full description or listing every item. Reject a generic, inaccurate, or context-mismatched summary with issue code comment_topic_mismatch.',
  'G. The pinned_comment must use calm, respectful, polished Korean appropriate for a mature health-information channel. Do not ask a question, ask viewers to reply or comment, or ask for likes. Reject any such engagement prompt with issue code comment_question_cta. Also reject slang, cute or overly casual chatter, decorative emoji, sales language, or other engagement bait with issue code comment_tone_mismatch. One restrained subscription invitation is allowed only in the final sentence.',
  'F. Never allow an invented channel-owner or family anecdote such as 저는, 제가, 저희 집, 저희 어머니, 우리 어머니, 직접 해보니, 써보니, or 먹어보니. Use issue code fabricated_personal_anecdote.',
  'H. The channel is 50대 이후 건강 이야기 in the broad sense: the life of an adult over 50, not a narrow medical beat. Health, nutrition, supplement and medicine literacy, body signals, sleep, movement, and skin all belong, and so do household appliances, home and season, groceries and cooking, money and errands, hospital and pharmacy visits, cars, clothing, phones, family and relationships, and how to carry oneself while ageing. Judge only whether an adult over 50 would find the topic genuinely useful or interesting. Do not narrow the channel to what a clinic would hand out, and do not reject a topic for being about an object, an errand, or a relationship rather than the body. Use issue code channel_concept_mismatch only for a promise that no ordinary viewer over 50 would care about, or that belongs to an unrelated audience entirely such as day trading, gaming, or professional practice.',
  'I. DECISION_DETAIL_V1: Each item must contain at least one decision-useful detail not inferable from its title or name: who or when it matters, an observable condition, a credible mechanism, a comparison, a label field, an interaction, a practical action, or a meaningful boundary. Record useful_detail, detail_type, and decision_change for every rank. decision_change is specific only when the item tells the viewer what to notice or do differently and why. Reject a restatement, slogan, obvious advice, or generic phrases such as 건강에 좋아요, 도움이 될 수 있어요, 주의가 필요해요, 확인해요, 관리가 중요해요, or 사람마다 달라요 with issue code low_information_value. Do not reject merely because the writing is brief.',
  'I2. Distinguish justified uncertainty from generic safety padding. Established facts should be stated directly. A qualifier is calibrated only when it names the exact condition, uncertain relation, exception, or plausible alternative. Repeated may, could, might, 수 있어요, or blanket caution that removes the mechanism, condition, or decision is generic_padding and must be rejected with issue code generic_safe_summary. Record claim_delivery for every rank.',
  'I4. EVERYDAY_LANGUAGE_V1: This is a senior lifestyle channel, not a clinical education channel. Judge every visible field as a 60-year-old with no health background reading a phone for two seconds. Each ranked item must be built around an ordinary food, drink, object, place, time of day, action, or body feeling the viewer can picture and act on tonight without measuring, testing, or buying anything. Record everyday_language and everyday_object for every rank. Reject with issue code too_technical_for_audience any visible clinical measurement, screening threshold, lab value, percentage, chemical or salt name, medical scale name, diagnosis code, or study term, and any card that reads like a handout rather than kitchen-table Korean. Clinical evidence in the research pack is fine as a source; it must reach the card as the everyday behaviour and everyday result it implies. Do not reject ordinary daily numbers such as 두 시간, 세 알, or 10분 when they are not being used as a cutoff to measure against.',
  'I3. RESEARCH_GROUNDING_V2: A research_source_pack, when supplied, is supporting evidence rather than the only permitted evidence base, and items may be written without citing it. For a ranked item that does cite a fact_id, find that candidate_fact and judge whether the visible card_name, card_reason, and reason stay inside its claim, evidence_summary, necessary_condition, and limitation_or_boundary; record source_fact_id and source_support for that rank. Reject a cited item whose claim is absent from the fact it cites with issue code claim_not_in_source_pack, and reject a condition, number, threshold, mechanism, comparison, interaction, or causal relation the cited fact does not contain with issue code fabricated_beyond_source. Never reject an item merely for having no citation, and never require the pack to cover every rank. For an uncited item, or when no pack is supplied, set source_support to no_research_pack and judge the claim on ordinary factual plausibility instead.',
  'J. Check every exact minute, repetition count, percentage, threshold, measurement, or other precise number. If it is unnecessary, unsupported, or appears added only to sound scientific, reject with issue code fabricated_precision. Ordinary non-quantified advice does not need a number.',
  'K. Apply a usefulness floor rather than a medical floor. Every item must give the viewer something they did not already know and can act on or notice today — a body mechanism, a signal, a household or money consequence, a step that saves a wasted trip, or a boundary worth setting. Household, appliance, shopping, errand, and relationship items clear this floor whenever they carry a real consequence; they are not shallow merely for being non-medical. Reject with issue code insufficient_health_depth only an item that teaches nothing the viewer can use: a slogan, a restatement of common knowledge, or vague encouragement. Record health_depth, medical_relevance, and decision_value for every item, and set medical_relevance to none for a legitimately non-medical everyday item instead of rejecting it.',
  'L. The visible card_name and card_reason must use common everyday Korean that an ordinary viewer immediately understands. Reject obscure furniture words, unexplained jargon, awkward literal translation, or needlessly technical visible wording with issue code unfamiliar_visible_word.',
  'L2. PLAIN_MEANING_V1: Clarity outranks brevity, and the character limits are ceilings rather than targets. Read each card_reason alone, without its card_name and without the title, and ask what it is actually about. Reject with issue code low_information_value any line that has been trimmed until the subject, the object, or the actual consequence is gone: a bare comparative with nothing to compare to, a demonstrative such as 그것, 이때, 이렇게, or 그렇게 standing in for the thing itself, or a sentence that only makes sense once the reader has already read the name. Spending more characters to keep the meaning intact is always the correct trade. Never reward a line merely for being short.',
  'L4. KOREAN_VOICE_V1: The copy must read as Korean somebody spoke, not as English carried across into Korean words. Four habits give it away, and all four are grounds to reject with issue code translationese_copy. (a) Subjects English requires but Korean drops: a Korean speaker omits the subject the situation already makes obvious, so 두 식구가 큰 통을 다 쓰기 전에 냄새가 변해요 should be 큰 통은 다 쓰기도 전에 냄새부터 변해요. (b) Inanimate things driving transitive verbs: 소음이 말소리를 덮어요 is English word order; Korean says 소음 때문에 말이 안 들려요. (c) One sentence shape repeated down the whole list, especially the if-then 조건절 — vary it with 대조 (~는데, ~지만), plain statement, cause (~어서), and 거든요 or 잖아요 so the ranks do not scan identically. (d) Passive and causative piled up where Korean prefers an active verb. Read every line aloud in your head and ask whether a Korean speaker would say it that way to a neighbour.',
  'L3. NO_FIGURATIVE_COPY_V1: Visible copy must say the thing directly. Reject with issue code unfamiliar_visible_word any metaphor, simile, analogy, poetic image, or roundabout phrasing that makes the viewer infer what is meant instead of reading it. Name the actual object, the actual action, and the actual consequence in plain words.',
  'M. All viewer-facing explanatory copy must use natural Korean 해요체. Reject 합니다체 or endings such as 입니다, 합니다, 됩니다, or 습니다 with issue code channel_tone_mismatch.',
  'N. Audit the configured channel identity separately from general health relevance. 하루건강약사 must teach health literacy and informed choices about nutrition, ingredients, supplements, food, body signals, skin, vitality, or recovery. 건강장수비결 must help adults over 50 protect healthy aging, chronic-risk control, mobility, joints, sleep, meals, daily function, or independence. Reject a pack that mainly belongs to the other channel or only mentions the configured purpose incidentally with issue code channel_identity_mismatch.',
  'O. The configured channel pillar is a broad rotation category, not permission to repeat the same narrow promise. Confirm that the exact topic directly fits the supplied pillar and that its medical question, mechanism, decision, and practical situation are coherent. Use issue code channel_pillar_mismatch when the topic does not fit.',
  'P. CLEAR_KOREAN_COPY_V2: Audit every viewer-facing field as a native Korean copy editor, and audit every card pair rank by rank. Check natural subject-predicate combinations, particles, counters, modifiers, collocations, and referents. Read only the title, card_name, and card_reason without the long reason. The pair must immediately state what happens, under which condition, and the specific health meaning or action; do not mentally supply a missing actor, object, particle, or situation. A card_reason ending in 확인해요 or 살펴봐요 is vague unless it names exactly what to check. Reject reversed or ambiguous wording that turns an observed loss of capacity into its cause. Record card_name_clarity, card_reason_completeness, card_meaning, causal_direction, title_role, claim_strength, and alternative_causes for every rank. Use first_read_clarity for a failed card pair, unnatural_korean for objectively malformed grammar, and mechanical_ai_tone only for a clear pattern of report headings, keyword strings, forced noun chains, or repeated AI templates. Do not block one necessary medical term, one naturally short noun phrase, harmless brevity, or a mere preference about elegance or rhythm. Fill language_audit even when the copy passes.',
  'S. The final pinned_comment sentence must be a calm subscription invitation aligned to the configured channel, with naturally varied wording instead of a fixed slogan. For 하루건강약사, promise easy explanations that help viewers understand their body, ingredients, nutrition, supplements, food, skin, vitality, recovery, or healthier choices. For 건강장수비결, invite viewers to keep building habits for healthy aging, chronic-risk control, mobility, joints, sleep, meals, daily function, or independence together. Use issue code comment_channel_closing when the closing is missing or belongs to the other channel. Fill comment_audit even when the comment passes.',
  '1. Every reason must state a concrete cause and effect in one complete Korean sentence. Do not reject merely because of character count or writing length.',
  '2. Reject vague noun fragments such as 밀폐 공간 압력 부담, 단백질 기본 점검, 소량으로 충분.',
  '3. Distinguish the actual mechanism and location. Example: a hot car does not create cabin-pressure danger; heat can raise pressure inside a lighter or aerosol container.',
  '4. Keep only claims you rate HIGH confidence from well-established physical mechanisms, product storage guidance, nutrition basics, behavioral mechanisms, or established safety guidance.',
  '5. If any item is medium or low confidence, decision must be reject. Never remove or rewrite an item.',
  '6. Never invent citations, institutions, studies, percentages, scores, dosage, or exact numbers.',
  '7. Preserve the channel tone and topic, but factual clarity outranks virality or visual density.',
  '8. Never return corrected_pack. The writer pack is immutable.',
  'Preflight issues found by deterministic checks: ' + JSON.stringify(qualityPreflight.issues),
  researchSourcePackOf(data) ? 'research_source_pack (the only permitted evidence base): ' + JSON.stringify(researchSourcePackOf(data)) : 'No research_source_pack was supplied; set source_support to no_research_pack for every rank.',
  'Configured channel identity: ' + configuredChannelIdentity,
  'Configured channel profile and selected pillar: ' + JSON.stringify({ profile: cfg.channel_editorial_profile || '', pillar: pack.channel_content_pillar || '' }),
  'Required schema: ' + JSON.stringify(schema),
  'Input pack: ' + JSON.stringify(pack),
].join('\\n\\n');

const useAiReview = !data.locked_source_pack && !data.prepared_card_pack && !cfg.dry_run && !cfg.test_mode && cfg.content_quality_ai_review !== false;
const kieQualityReviewRequest = {
  model: cfg.kie_ai_model || 'claude-opus-4-7',
  stream: false,
  max_tokens: 3200,
  messages: [{ role: 'user', content: prompt }],
};

return [{
  json: {
    ...data,
    quality_preflight: qualityPreflight,
    use_ai_quality_review: useAiReview,
    kie_quality_review_request: kieQualityReviewRequest,
  },
}];`;

const deterministicReviewCode = `const data = $input.first().json;
const pack = data.pack || {};
const cfg = data.config || {};

function clean(value) {
  return String(value || '').replace(/\\s+/g, ' ').trim();
}

${channelPolicyHelpers}

${sourceGroundingHelpers}

function inspectPack(value, researchPack) {
  const issues = [];
  const items = Array.isArray(value?.rank_items) ? value.rank_items : [];
  if (items.length < 4 || items.length > 7) issues.push({ code: 'rank_count', count: items.length });
  const vagueEnding = /(점검|확인|도움|부담|충분|기본|균형|관리|변화|문제|위험)$/;
  for (const [index, item] of items.entries()) {
    const rank = Number(item?.rank || index + 1);
    const cardName = clean(item?.card_name);
    const reason = clean(item?.reason);
    const cardReason = clean(item?.card_reason);
    if (!clean(item?.name)) issues.push({ rank, code: 'missing_name' });
    if (!cardName) issues.push({ rank, code: 'missing_card_name' });
    if ([...cardName].length > 30) issues.push({ rank, code: 'card_name_too_long', length: [...cardName].length });
    if (!reason) issues.push({ rank, code: 'missing_reason', value: reason });
    if (!cardReason) issues.push({ rank, code: 'missing_card_reason' });
    if ([...cardReason].length > 60) issues.push({ rank, code: 'card_copy_too_long', length: [...cardReason].length });
    if (/^(?:왜|이유|핵심|tip)\\s*[:：]/i.test(cardReason)) issues.push({ rank, code: 'card_label_prefix' });
    const backedNumbers = sourceBackedNumbers(item, researchPack);
    const percentages = reason.match(/(\\d{1,3})%/g) || [];
    if (percentages.some((match) => !backedNumbers || !backedNumbers.has(match.replace('%', '')))) issues.push({ rank, code: 'unsupported_percentage', value: reason });
  }
  const viewerCopy = [
    value?.hook_title,
    value?.subtitle,
    value?.video_script,
    value?.description,
    value?.pinned_comment,
    ...items.flatMap((item) => [item?.name, item?.card_name, item?.reason, item?.card_reason, item?.caution]),
  ].map(clean).filter(Boolean).join(' ');
  if (/[가-힣]니다(?:[.!?]|\\s|$)/.test(viewerCopy)) issues.push({ code: 'channel_tone_mismatch' });
  // A card whose every line is bent into the same sentence shape reads like
  // machine translation even when each line is fine on its own. The usual
  // offender is the if-then clause: five consecutive 조건절 is English grammar
  // wearing Korean words. Spoken Korean varies its shape line to line.
  const sentenceShape = (text) => {
    if (!text) return '';
    // Order matters: a line carrying an if-clause is built on that clause even
    // when it also contains a 는데 contrast, so 조건절 is checked first.
    if (text.includes('면 ') || text.endsWith('면')) return 'conditional';
    if (text.includes('는데') || text.includes('지만')) return 'contrast';
    if (text.includes('어서') || text.includes('아서') || text.includes('라서') || text.includes('때문')) return 'cause';
    return 'plain';
  };
  // A bare demonstrative on the card means the line cannot be read on its own:
  // 이때가 발톱을 보는 순간이에요 never says what changed about the 발톱.
  for (const [index, item] of items.entries()) {
    const cardReason = clean(item?.card_reason);
    // Must start a word: 물건이거든요 and 사람이거나 contain 이거 as a substring
    // and are perfectly clear, so only a standalone demonstrative counts.
    const demonstrative = cardReason.match(/(?:^|[^가-힣])(그것|그거|이것|이거|이때|그때|이렇게|그렇게)/);
    if (demonstrative) {
      issues.push({
        rank: Number(item?.rank || index + 1),
        code: 'vague_demonstrative',
        message: 'Card copy leans on a demonstrative instead of naming the thing, so the line cannot be read on its own.',
        value: demonstrative[1],
      });
    }
  }
  const shapes = items.map((item) => sentenceShape(clean(item?.card_reason))).filter(Boolean);
  if (shapes.length >= 4) {
    const shapeCounts = {};
    // Plain statements are the neutral default and repeat harmlessly; it is a
    // marked construction repeated down the list that reads as translated.
    for (const shape of shapes) if (shape !== 'plain') shapeCounts[shape] = (shapeCounts[shape] || 0) + 1;
    const [dominant, dominantCount] = Object.entries(shapeCounts).sort((left, right) => right[1] - left[1])[0] || ['', 0];
    if (dominantCount / shapes.length >= 0.8) {
      issues.push({ code: 'monotonous_sentence_shape', shape: dominant, count: dominantCount, of: shapes.length });
    }
  }
  return issues;
}

const issues = [...inspectPack(pack, researchSourcePackOf(data)), ...inspectChannelIdentity(pack, cfg), ...inspectSourceGrounding(pack, researchSourcePackOf(data)), ...inspectEverydayLanguage(pack)];
const pass = issues.length === 0;
return [{
  json: {
    ...data,
    blocked: !pass,
    content_quality_review: {
      pass,
      decision: pass ? 'pass' : 'reject',
      mode: 'deterministic_dry_run',
      contract_version: '1.0',
      issues,
      audit: (pack.rank_items || []).map((item, index) => ({
        rank: Number(item.rank || index + 1),
        confidence: 'not_evaluated_in_dry_run',
        basis_type: 'deterministic_structure_only',
      })),
      checked_at: new Date().toISOString(),
    },
  },
}];`;

const parseReviewCode = `const base = $('Build Quality Review Request').first().json;
const response = $input.first().json || {};

function clean(value) {
  return String(value || '').replace(/\\s+/g, ' ').trim();
}

${channelPolicyHelpers}

${sourceGroundingHelpers}

function responseText(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch (error) { return String(value); }
}

function tryParseJson(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return value;
  try { return JSON.parse(trimmed); } catch (error) { return value; }
}

function collectText(value, depth = 0) {
  if (!value || depth > 6) return '';
  if (typeof value === 'string') {
    const parsed = tryParseJson(value);
    if (parsed !== value) {
      if (parsed?.corrected_pack || parsed?.pack || parsed?.decision) return value;
      return collectText(parsed, depth + 1);
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => collectText(entry, depth + 1)).filter(Boolean).join('\\n');
  if (Array.isArray(value.content)) {
    const text = value.content.map((entry) => collectText(entry, depth + 1)).filter(Boolean).join('\\n');
    if (text) return text;
  }
  if (value.message && Array.isArray(value.message.content)) {
    const text = value.message.content.map((entry) => collectText(entry, depth + 1)).filter(Boolean).join('\\n');
    if (text) return text;
  }
  for (const key of ['output_text', 'text', 'data', 'result', 'response']) {
    const text = collectText(value[key], depth + 1);
    if (text) return text;
  }
  return '';
}

function reviewStopReason(value, depth = 0) {
  if (!value || depth > 6) return '';
  if (typeof value === 'string') {
    const parsed = tryParseJson(value);
    return parsed !== value ? reviewStopReason(parsed, depth + 1) : '';
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const reason = reviewStopReason(entry, depth + 1);
      if (reason) return reason;
    }
    return '';
  }
  const ownReason = clean(value.stop_reason || value.stopReason).toLowerCase();
  if (ownReason) return ownReason;
  for (const key of ['data', 'result', 'response', 'message']) {
    const reason = reviewStopReason(value[key], depth + 1);
    if (reason) return reason;
  }
  return '';
}

function parseJsonText(text) {
  const fence = String.fromCharCode(96, 96, 96);
  const trimmed = String(text || '')
    .trim()
    .replace(new RegExp('^' + fence + 'json\\\\s*', 'i'), '')
    .replace(new RegExp('^' + fence + '\\\\s*', 'i'), '')
    .replace(new RegExp(fence + '$', 'i'), '')
    .trim();
  try { return JSON.parse(trimmed); } catch (error) {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw error;
  }
}

function inspectPack(value, researchPack) {
  const issues = [];
  const items = Array.isArray(value?.rank_items) ? value.rank_items : [];
  if (items.length < 4 || items.length > 7) issues.push({ code: 'rank_count', count: items.length });
  const vagueEnding = /(점검|확인|도움|부담|충분|기본|균형|관리|변화|문제|위험)$/;
  for (const [index, item] of items.entries()) {
    const rank = Number(item?.rank || index + 1);
    const cardName = clean(item?.card_name);
    const reason = clean(item?.reason);
    const cardReason = clean(item?.card_reason);
    if (!clean(item?.name)) issues.push({ rank, code: 'missing_name' });
    if (!cardName) issues.push({ rank, code: 'missing_card_name' });
    if ([...cardName].length > 30) issues.push({ rank, code: 'card_name_too_long', length: [...cardName].length });
    if (!reason) issues.push({ rank, code: 'missing_reason', value: reason });
    if (!cardReason) issues.push({ rank, code: 'missing_card_reason' });
    if ([...cardReason].length > 60) issues.push({ rank, code: 'card_copy_too_long', length: [...cardReason].length });
    if (/^(?:왜|이유|핵심|tip)\\s*[:：]/i.test(cardReason)) issues.push({ rank, code: 'card_label_prefix' });
    const backedNumbers = sourceBackedNumbers(item, researchPack);
    const percentages = reason.match(/(\\d{1,3})%/g) || [];
    if (percentages.some((match) => !backedNumbers || !backedNumbers.has(match.replace('%', '')))) issues.push({ rank, code: 'unsupported_percentage', value: reason });
  }
  const viewerCopy = [
    value?.hook_title,
    value?.subtitle,
    value?.video_script,
    value?.description,
    value?.pinned_comment,
    ...items.flatMap((item) => [item?.name, item?.card_name, item?.reason, item?.card_reason, item?.caution]),
  ].map(clean).filter(Boolean).join(' ');
  if (/[가-힣]니다(?:[.!?]|\\s|$)/.test(viewerCopy)) issues.push({ code: 'channel_tone_mismatch' });
  // A card whose every line is bent into the same sentence shape reads like
  // machine translation even when each line is fine on its own. The usual
  // offender is the if-then clause: five consecutive 조건절 is English grammar
  // wearing Korean words. Spoken Korean varies its shape line to line.
  const sentenceShape = (text) => {
    if (!text) return '';
    // Order matters: a line carrying an if-clause is built on that clause even
    // when it also contains a 는데 contrast, so 조건절 is checked first.
    if (text.includes('면 ') || text.endsWith('면')) return 'conditional';
    if (text.includes('는데') || text.includes('지만')) return 'contrast';
    if (text.includes('어서') || text.includes('아서') || text.includes('라서') || text.includes('때문')) return 'cause';
    return 'plain';
  };
  // A bare demonstrative on the card means the line cannot be read on its own:
  // 이때가 발톱을 보는 순간이에요 never says what changed about the 발톱.
  for (const [index, item] of items.entries()) {
    const cardReason = clean(item?.card_reason);
    // Must start a word: 물건이거든요 and 사람이거나 contain 이거 as a substring
    // and are perfectly clear, so only a standalone demonstrative counts.
    const demonstrative = cardReason.match(/(?:^|[^가-힣])(그것|그거|이것|이거|이때|그때|이렇게|그렇게)/);
    if (demonstrative) {
      issues.push({
        rank: Number(item?.rank || index + 1),
        code: 'vague_demonstrative',
        message: 'Card copy leans on a demonstrative instead of naming the thing, so the line cannot be read on its own.',
        value: demonstrative[1],
      });
    }
  }
  const shapes = items.map((item) => sentenceShape(clean(item?.card_reason))).filter(Boolean);
  if (shapes.length >= 4) {
    const shapeCounts = {};
    // Plain statements are the neutral default and repeat harmlessly; it is a
    // marked construction repeated down the list that reads as translated.
    for (const shape of shapes) if (shape !== 'plain') shapeCounts[shape] = (shapeCounts[shape] || 0) + 1;
    const [dominant, dominantCount] = Object.entries(shapeCounts).sort((left, right) => right[1] - left[1])[0] || ['', 0];
    if (dominantCount / shapes.length >= 0.8) {
      issues.push({ code: 'monotonous_sentence_shape', shape: dominant, count: dominantCount, of: shapes.length });
    }
  }
  return issues;
}

function advisoryResult(code, message, extra = {}) {
  const deterministicIssues = Array.isArray(base.quality_preflight?.issues) ? base.quality_preflight.issues : [];
  const pass = deterministicIssues.length === 0;
  return [{
    json: {
      ...base,
      blocked: !pass,
      content_quality_review: {
        pass,
        decision: pass ? 'pass_with_advisory' : 'reject',
        mode: 'independent_ai_audit_fail_open',
        contract_version: '1.0',
        issues: [{ code, message }, ...deterministicIssues],
        audit: [],
        checked_at: new Date().toISOString(),
        ...extra,
      },
    },
  }];
}

const rawResponse = responseText(response).toLowerCase();
if (response.error || rawResponse.includes('unauthorized') || rawResponse.includes('try again later') || rawResponse.includes('internal error')) {
  return advisoryResult('review_api_error', 'Independent quality review API failed. Original pack continues to medical safety review.');
}
if (reviewStopReason(response) === 'max_tokens') {
  return advisoryResult('review_output_truncated', 'Independent quality review reached its output limit. Original pack continues to medical safety review.');
}

const rawText = collectText(response);
if (!rawText) return advisoryResult('review_empty', 'Independent quality review returned no parseable text. Original pack continues.');

let review;
try { review = parseJsonText(rawText); } catch (error) {
  return advisoryResult('review_parse_error', error.message);
}

const localIssues = [...inspectPack(base.pack), ...inspectChannelIdentity(base.pack, base.config || {})];
const channelPolicy = channelProfilePolicy(base.config || {});
const channelAudit = review.channel_audit && typeof review.channel_audit === 'object' ? review.channel_audit : {};
const languageAudit = review.language_audit && typeof review.language_audit === 'object' ? review.language_audit : {};
const commentAudit = review.comment_audit && typeof review.comment_audit === 'object' ? review.comment_audit : {};
const reviewerIssues = Array.isArray(review.issues) ? review.issues : [];
const reviewerHasIssue = (code) => reviewerIssues.some((issue) => clean(issue?.code).toLowerCase() === code);
const reviewerHasIssueForRank = (code, rank) => reviewerIssues.some((issue) => {
  if (clean(issue?.code).toLowerCase() !== code) return false;
  const issueRank = clean(issue?.rank);
  return !issueRank || Number(issueRank) === rank;
});
if (channelPolicy) {
  const auditedProfile = clean(channelAudit.profile);
  const auditedPillar = clean(channelAudit.pillar);
  const channelFit = clean(channelAudit.fit).toLowerCase();
  if (auditedProfile !== channelPolicy.id || auditedPillar !== clean(base.pack?.channel_content_pillar) || channelFit !== 'direct') {
    localIssues.push({
      code: 'incomplete_channel_audit',
      expected_profile: channelPolicy.id,
      expected_pillar: clean(base.pack?.channel_content_pillar) || null,
      audited_profile: auditedProfile || null,
      audited_pillar: auditedPillar || null,
      fit: channelFit || null,
    });
  }
}
const requiredLanguageFields = ['hook_title', 'subtitle', 'rank_item_names', 'card_copy', 'video_script', 'description', 'pinned_comment'];
const languageStatus = clean(languageAudit.status).toLowerCase();
const firstReadStatus = clean(languageAudit.first_read).toLowerCase();
const humanVoiceStatus = clean(languageAudit.human_voice).toLowerCase();
const checkedLanguageFields = new Set(Array.isArray(languageAudit.checked_fields) ? languageAudit.checked_fields.map((field) => clean(field)) : []);
const languageProblems = Array.isArray(languageAudit.problems) ? languageAudit.problems : [];
if (!['natural', 'malformed'].includes(languageStatus) || !['clear', 'unclear'].includes(firstReadStatus) || !['natural', 'mechanical'].includes(humanVoiceStatus) || !requiredLanguageFields.every((field) => checkedLanguageFields.has(field))) {
  localIssues.push({
    code: 'incomplete_language_audit',
    status: languageStatus || null,
    first_read: firstReadStatus || null,
    human_voice: humanVoiceStatus || null,
    missing_fields: requiredLanguageFields.filter((field) => !checkedLanguageFields.has(field)),
  });
}
if (languageStatus === 'malformed' && !(Array.isArray(review.issues) && review.issues.some((issue) => clean(issue?.code).toLowerCase() === 'unnatural_korean'))) {
  localIssues.push({
    code: 'unnatural_korean',
    message: 'Viewer-facing Korean contains an objectively malformed grammar or word combination.',
    problems: languageProblems,
  });
}
if (firstReadStatus === 'unclear' && !(Array.isArray(review.issues) && review.issues.some((issue) => clean(issue?.code).toLowerCase() === 'first_read_clarity'))) {
  localIssues.push({
    code: 'first_read_clarity',
    message: 'Visible Korean copy cannot be understood comfortably on the first reading.',
    problems: languageProblems,
  });
}
if (humanVoiceStatus === 'mechanical' && !(Array.isArray(review.issues) && review.issues.some((issue) => clean(issue?.code).toLowerCase() === 'mechanical_ai_tone'))) {
  localIssues.push({
    code: 'mechanical_ai_tone',
    message: 'Viewer-facing Korean uses a clear pattern of forced nominalization or mechanical AI-template wording.',
    problems: languageProblems,
  });
}
const commentSummaryFit = clean(commentAudit.summary_fit).toLowerCase();
const commentQuestionCta = clean(commentAudit.question_cta).toLowerCase();
const commentChannelClosing = clean(commentAudit.channel_closing).toLowerCase();
if (!['direct', 'mismatch'].includes(commentSummaryFit) || !['absent', 'present'].includes(commentQuestionCta) || !['aligned', 'missing', 'mismatch'].includes(commentChannelClosing)) {
  localIssues.push({
    code: 'incomplete_comment_audit',
    summary_fit: commentSummaryFit || null,
    question_cta: commentQuestionCta || null,
    channel_closing: commentChannelClosing || null,
  });
}
if (commentSummaryFit === 'mismatch' && !reviewerHasIssue('comment_topic_mismatch')) {
  localIssues.push({ code: 'comment_topic_mismatch', message: 'Pinned comment does not accurately summarize the exact title and item set.' });
}
const pinnedCommentText = clean(base.pack?.pinned_comment);
const commentHasEngagementCta = /[?？]/.test(pinnedCommentText)
  || /(?:댓글|답글)(?:로|에)?\\s*(?:남겨|알려|적어|써|달아)/.test(pinnedCommentText)
  || /좋아요(?:를)?\\s*(?:눌러|부탁|해\\s*주세요)/.test(pinnedCommentText)
  || /(?:어떠세요|있으셨나요|해보셨나요|궁금하신가요)(?:[.!]?|$)/.test(pinnedCommentText);
if ((commentQuestionCta === 'present' || commentHasEngagementCta) && !reviewerHasIssue('comment_question_cta')) {
  localIssues.push({ code: 'comment_question_cta', message: 'Pinned comment asks a question or requests a reply, comment, or like instead of giving a plain summary.' });
}
if ((commentChannelClosing === 'missing' || commentChannelClosing === 'mismatch') && !reviewerHasIssue('comment_channel_closing')) {
  localIssues.push({ code: 'comment_channel_closing', message: 'Pinned comment lacks a calm subscription closing aligned to the configured channel.' });
}
if (/(?:^|[.!?]\\s*)(?:저는|제가|저희 집|저희 어머니|우리 어머니|직접 해보니|써보니|먹어보니)/.test(clean(base.pack?.pinned_comment))) {
  localIssues.push({ code: 'fabricated_personal_anecdote', message: 'Pinned comment contains an unverifiable first-person or family anecdote.' });
}
if (base.content_duplicate_check?.blocking) {
  localIssues.push({
    code: 'recent_title_duplicate',
    message: 'Generated title is too similar to a recent title and must be regenerated.',
    generated_title: base.content_duplicate_check.generated_title,
    similar_to: base.content_duplicate_check.similar_to,
  });
}
const audit = Array.isArray(review.audit) ? review.audit : [];
for (const [index, item] of (base.pack?.rank_items || []).entries()) {
  const rank = Number(item.rank || index + 1);
  const auditItem = audit.find((entry) => Number(entry.rank) === rank);
  const confidence = clean(auditItem?.confidence).toLowerCase();
  const basisType = clean(auditItem?.basis_type).toLowerCase();
  const healthDepth = clean(auditItem?.health_depth).toLowerCase();
  const medicalRelevance = clean(auditItem?.medical_relevance).toLowerCase();
  const decisionValue = clean(auditItem?.decision_value).toLowerCase();
  const usefulDetail = clean(auditItem?.useful_detail);
  const detailType = clean(auditItem?.detail_type).toLowerCase();
  const decisionChange = clean(auditItem?.decision_change).toLowerCase();
  const claimDelivery = clean(auditItem?.claim_delivery).toLowerCase();
  const cardNameClarity = clean(auditItem?.card_name_clarity).toLowerCase();
  const cardReasonCompleteness = clean(auditItem?.card_reason_completeness).toLowerCase();
  const cardMeaning = clean(auditItem?.card_meaning).toLowerCase();
  const causalDirection = clean(auditItem?.causal_direction).toLowerCase();
  const titleRole = clean(auditItem?.title_role).toLowerCase();
  const claimStrength = clean(auditItem?.claim_strength).toLowerCase();
  const alternativeCauses = clean(auditItem?.alternative_causes).toLowerCase();
  const validHealthDepth = new Set(['high', 'adequate']);
  const validMedicalRelevance = new Set(['direct']);
  const validDecisionValue = new Set(['actionable', 'limited']);
  if (!auditItem || !validHealthDepth.has(healthDepth) || !validMedicalRelevance.has(medicalRelevance) || !validDecisionValue.has(decisionValue)) {
    localIssues.push({
      rank,
      code: 'incomplete_health_audit',
      health_depth: healthDepth || null,
      medical_relevance: medicalRelevance || null,
      decision_value: decisionValue || null,
    });
  }
  if (confidence === 'low' || confidence === 'medium') localIssues.push({ rank, code: 'insufficient_confidence', confidence });
  if (basisType === 'uncertain') localIssues.push({ rank, code: 'uncertain_basis', basis_type: basisType });
  if (healthDepth === 'low' || medicalRelevance === 'incidental' || medicalRelevance === 'none') {
    localIssues.push({ rank, code: 'insufficient_health_depth', health_depth: healthDepth || null, medical_relevance: medicalRelevance || null });
  }
  if (decisionValue === 'none') localIssues.push({ rank, code: 'low_information_value', decision_value: decisionValue });
  const validDetailTypes = new Set(['condition', 'mechanism', 'comparison', 'label_field', 'timing_or_situation', 'interaction', 'observable_pattern', 'practical_action', 'boundary', 'established_number', 'none']);
  const detailAuditComplete = Boolean(usefulDetail)
    && validDetailTypes.has(detailType)
    && ['specific', 'generic', 'none'].includes(decisionChange)
    && ['direct', 'calibrated', 'generic_padding'].includes(claimDelivery);
  if (!detailAuditComplete) {
    localIssues.push({
      rank,
      code: 'incomplete_detail_audit',
      useful_detail: usefulDetail || null,
      detail_type: detailType || null,
      decision_change: decisionChange || null,
      claim_delivery: claimDelivery || null,
    });
  } else {
    if ((detailType === 'none' || decisionChange === 'generic' || decisionChange === 'none') && !reviewerHasIssueForRank('low_information_value', rank)) {
      localIssues.push({ rank, code: 'low_information_value', useful_detail: usefulDetail, detail_type: detailType, decision_change: decisionChange });
    }
    if (claimDelivery === 'generic_padding' && !reviewerHasIssueForRank('generic_safe_summary', rank)) {
      localIssues.push({ rank, code: 'generic_safe_summary', message: 'The item uses blanket uncertainty instead of stating the supported mechanism, condition, or decision.' });
    }
  }
  const everydayLanguage = clean(auditItem?.everyday_language).toLowerCase();
  const everydayObject = clean(auditItem?.everyday_object);
  if (!['plain', 'technical'].includes(everydayLanguage) || !everydayObject) {
    localIssues.push({ rank, code: 'incomplete_everyday_audit', everyday_language: everydayLanguage || null, everyday_object: everydayObject || null });
  } else if (everydayLanguage === 'technical' && !reviewerHasIssueForRank('too_technical_for_audience', rank)) {
    localIssues.push({ rank, code: 'too_technical_for_audience', message: 'The visible copy reads as clinical rather than everyday Korean.', everyday_object: everydayObject });
  }
  const researchPack = researchSourcePackOf(base);
  const sourceSupport = clean(auditItem?.source_support).toLowerCase();
  const sourceFactId = clean(auditItem?.source_fact_id);
  const itemCitesPack = Boolean(clean(item?.fact_id));
  if (researchPack && itemCitesPack) {
    const sourceAuditComplete = ['supported', 'partially_supported', 'unsupported'].includes(sourceSupport) && Boolean(sourceFactId);
    if (!sourceAuditComplete) {
      localIssues.push({ rank, code: 'incomplete_source_audit', source_support: sourceSupport || null, source_fact_id: sourceFactId || null });
    } else if (sourceSupport !== 'supported' && !reviewerHasIssueForRank('claim_not_in_source_pack', rank)) {
      localIssues.push({ rank, code: 'claim_not_in_source_pack', message: 'The ranked item is not fully supported by the research fact it cites.', source_support: sourceSupport, source_fact_id: sourceFactId });
    }
  }
  const visibleCopyAuditComplete = ['clear', 'unclear'].includes(cardNameClarity)
    && ['complete', 'missing_role'].includes(cardReasonCompleteness)
    && ['direct', 'vague'].includes(cardMeaning)
    && ['clear', 'ambiguous'].includes(causalDirection);
  if (!visibleCopyAuditComplete) {
    localIssues.push({
      rank,
      code: 'incomplete_visible_copy_audit',
      card_name_clarity: cardNameClarity || null,
      card_reason_completeness: cardReasonCompleteness || null,
      card_meaning: cardMeaning || null,
      causal_direction: causalDirection || null,
    });
  } else if (cardNameClarity !== 'clear' || cardReasonCompleteness !== 'complete' || cardMeaning !== 'direct' || causalDirection !== 'clear') {
    if (!reviewerHasIssueForRank('first_read_clarity', rank)) {
      localIssues.push({
        rank,
        code: 'first_read_clarity',
        message: 'The card pair omits a needed sentence role, gives only a vague instruction, or obscures the observation and its meaning.',
        card_name_clarity: cardNameClarity,
        card_reason_completeness: cardReasonCompleteness,
        card_meaning: cardMeaning,
        causal_direction: causalDirection,
      });
    }
  }
  const semanticAuditComplete = ['fulfills_exact_type', 'mismatch'].includes(titleRole)
    && ['supported', 'appropriately_qualified', 'overstated'].includes(claimStrength)
    && ['not_needed', 'acknowledged', 'missing'].includes(alternativeCauses);
  if (!semanticAuditComplete) {
    localIssues.push({
      rank,
      code: 'incomplete_semantic_audit',
      title_role: titleRole || null,
      claim_strength: claimStrength || null,
      alternative_causes: alternativeCauses || null,
    });
  } else {
    if (titleRole === 'mismatch' && !reviewerHasIssueForRank('title_item_type_mismatch', rank)) {
      localIssues.push({ rank, code: 'title_item_type_mismatch', message: 'The ranked item type does not match the type counted by the title.' });
    }
    if ((claimStrength === 'overstated' || alternativeCauses === 'missing') && !reviewerHasIssueForRank('overstated_causal_attribution', rank)) {
      localIssues.push({ rank, code: 'overstated_causal_attribution', message: 'The claim exceeds the supported relation or certainty without adequate conditions or a useful boundary.' });
    }
  }
}

const advisoryCodes = new Set(['reason_length', 'vague_fragment', 'style', 'wording', 'density', 'too_long', 'too_short']);
const hardReviewerIssues = reviewerIssues.filter((issue) => !advisoryCodes.has(clean(issue?.code).toLowerCase()));
localIssues.push(...hardReviewerIssues);
const decision = clean(review.decision || (review.pass ? 'pass' : 'reject')).toLowerCase();
const pass = localIssues.length === 0;

return [{
  json: {
    ...base,
    pack: base.pack,
    blocked: !pass,
    content_quality_review: {
      pass,
      decision: pass ? (decision === 'reject' ? 'pass_with_advisory' : 'pass') : 'reject',
      mode: 'independent_ai_audit_only',
      contract_version: '1.0',
      issues: [...reviewerIssues, ...localIssues],
      audit,
      channel_audit: channelAudit,
      language_audit: languageAudit,
      comment_audit: commentAudit,
      preflight_issues: base.quality_preflight?.issues || [],
      checked_at: new Date().toISOString(),
    },
  },
}];`;

function sharedWorkflow(versionId = randomUUID()) {
  return {
    id: sharedId,
    name: sharedName,
    active: true,
    nodes: [
      {
        parameters: { inputSource: 'passthrough' },
        id: 'f0b6c4e7-a320-4c50-a1f1-0d856b67a201',
        name: 'When Executed by Another Workflow',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        typeVersion: 1.2,
        position: [0, 0],
      },
      {
        parameters: { jsCode: buildReviewCode },
        id: '405af623-59a1-4587-b31b-82305bb3519e',
        name: 'Build Quality Review Request',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [240, 0],
      },
      {
        parameters: {
          conditions: { boolean: [{ value1: '={{$json.use_ai_quality_review}}', value2: true }] },
        },
        id: '45882e44-f9af-4b37-81d6-ef8042100938',
        name: 'Use AI Quality Review?',
        type: 'n8n-nodes-base.if',
        typeVersion: 1,
        position: [480, 0],
      },
      {
        parameters: {
          method: 'POST',
          url: 'https://api.kie.ai/claude/v1/messages',
          authentication: 'genericCredentialType',
          genericAuthType: 'httpHeaderAuth',
          sendHeaders: true,
          headerParameters: { parameters: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'anthropic-version', value: '2023-06-01' },
          ] },
          sendBody: true,
          specifyBody: 'json',
          jsonBody: '={{ JSON.stringify($json.kie_quality_review_request) }}',
          options: {},
        },
        id: 'f176841d-bcc8-4f7f-9547-bec1d6ebac2e',
        name: 'KIE Claude Independent Quality Review',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [720, -120],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 10000,
        credentials: { httpHeaderAuth: { id: 'MV5JVbdiJSoVx9O8', name: 'Header Auth account' } },
        continueOnFail: true,
      },
      {
        parameters: { jsCode: parseReviewCode },
        id: '39d7617d-70d7-40cb-b6ab-8f5fa98f7869',
        name: 'Parse and Enforce Quality Review',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [960, -120],
      },
      {
        parameters: { jsCode: deterministicReviewCode },
        id: '219d696a-a018-43b7-9428-fee7b260c888',
        name: 'Deterministic Quality Review',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [720, 120],
      },
    ],
    connections: {
      'When Executed by Another Workflow': { main: [[{ node: 'Build Quality Review Request', type: 'main', index: 0 }]] },
      'Build Quality Review Request': { main: [[{ node: 'Use AI Quality Review?', type: 'main', index: 0 }]] },
      'Use AI Quality Review?': { main: [
        [{ node: 'KIE Claude Independent Quality Review', type: 'main', index: 0 }],
        [{ node: 'Deterministic Quality Review', type: 'main', index: 0 }],
      ] },
      'KIE Claude Independent Quality Review': { main: [[{ node: 'Parse and Enforce Quality Review', type: 'main', index: 0 }]] },
    },
    settings: { executionOrder: 'v1' },
    staticData: null,
    pinData: {},
    versionId,
    triggerCount: 0,
    meta: null,
    nodeGroups: [],
  };
}

const basicPackValidation = `function validatePack(pack) {
  const issues = [];
  if (!pack || typeof pack !== 'object') issues.push('pack is not an object');
  if (!pack.hook_title) issues.push('missing hook_title');
  if (!Array.isArray(pack.rank_items) || pack.rank_items.length < 1) issues.push('missing rank_items');
  if (!pack.video_script) issues.push('missing video_script');
  if (!pack.description) issues.push('missing description');
  if (issues.length) throw new Error('invalid pack: ' + issues.join(', '));
}`;

const reviewRetryCode = `const data = $input.first().json;

function clean(value) {
  return String(value || '').replace(/\\s+/g, ' ').trim();
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function appendRetryInstruction(request, instruction) {
  const next = {
    ...(request || {}),
    messages: Array.isArray(request?.messages) ? request.messages.map((message) => ({ ...message })) : [],
  };
  let targetIndex = -1;
  for (let index = next.messages.length - 1; index >= 0; index -= 1) {
    if (next.messages[index]?.role === 'user') {
      targetIndex = index;
      break;
    }
  }
  if (targetIndex >= 0) next.messages[targetIndex].content = String(next.messages[targetIndex].content || '') + '\\n\\n' + instruction;
  else next.messages.push({ role: 'user', content: instruction });
  return next;
}

const cfg = data.config || {};
const qualityFailed = Boolean(data.content_quality_review && data.content_quality_review.pass !== true);
const reviewKind = qualityFailed ? 'content_quality' : 'medical_safety';
const review = qualityFailed ? data.content_quality_review : (data.medical_review || {});
const previousRetry = qualityFailed ? (data.content_quality_retry || {}) : (data.medical_review_retry || {});
const previousAttempt = positiveInteger(previousRetry.attempt, 0);
const attempt = previousAttempt + 1;
const maxRetries = positiveInteger(
  qualityFailed ? cfg.content_quality_max_retries : cfg.medical_review_max_retries,
  2,
);
const available = Boolean(cfg.use_live_kie_ai && !cfg.dry_run && !cfg.test_mode && attempt <= maxRetries);
const pack = data.pack || {};
const issues = Array.isArray(review.issues) ? review.issues : [];
const audit = Array.isArray(review.audit) ? review.audit : [];
const issueMatches = Array.isArray(review.issue_matches) ? review.issue_matches : [];
const matchedTerms = [...new Set(issueMatches.map((entry) => clean(entry.match)).filter(Boolean))].slice(0, 12);
const previousTitle = clean(pack.hook_title || pack.theme);
const previousItems = Array.isArray(pack.rank_items)
  ? pack.rank_items.map((item) => [item.rank, item.name, item.reason, item.caution].filter(Boolean).join('. ')).join(' / ')
  : '';
const requestedChannelProfile = clean(cfg.channel_editorial_profile);
const channelPillarsByProfile = {
  haru_health_literacy: ['nutrition_food_choices', 'supplement_ingredients', 'body_signals', 'skin_vitality', 'sleep_recovery_science', 'medicine_literacy', 'daily_health_choices'],
  longevity_daily_function: ['cardiometabolic', 'joints_balance_falls', 'strength_walking', 'longevity_meals', 'sleep_recovery', 'daily_function', 'chronic_risk_signals'],
};
const allowedChannelPillars = channelPillarsByProfile[requestedChannelProfile] || [];
const selectedChannelPillar = clean(data.selected_channel_pillar?.id);
const failedPackChannelPillar = clean(pack.channel_content_pillar);
const requestedChannelPillar = allowedChannelPillars.includes(selectedChannelPillar)
  ? selectedChannelPillar
  : (allowedChannelPillars.includes(failedPackChannelPillar) ? failedPackChannelPillar : '');
const channelRetryInstruction = requestedChannelProfile
  ? 'Preserve channel_editorial_profile=' + requestedChannelProfile + ' and channel_content_pillar=' + requestedChannelPillar + '. The pillar is a broad rotation category, not a narrow title template. Create a materially different medical question, mechanism, decision, and practical situation from the failed title while staying inside this channel purpose.'
  : '';
const commentClosingByProfile = {
  haru_health_literacy: 'For 하루건강약사, the final sentence should invite viewers to subscribe for easy explanations that help them understand their body, ingredients, and health choices.',
  longevity_daily_function: 'For 건강장수비결, the final sentence should invite viewers to subscribe and keep building habits for healthy aging, daily function, and independence together.',
};
const commentRetryInstruction = [
  'COMMENT_SUMMARY_V1: Write pinned_comment as 2-4 short natural Korean 해요체 sentences under 260 Korean characters. Summarize the exact title and item set by selecting 2-3 of the most useful actions or principles, then end with one restrained subscription invitation aligned to the configured channel. Do not copy the full description or list every item. Do not ask a question. Do not ask viewers to reply or comment. Do not ask for likes. Do not invent a channel-owner or family anecdote.',
  commentClosingByProfile[requestedChannelProfile] || 'Keep the final subscription sentence calm and aligned to the configured health channel.',
].join(' ');
const clearKoreanCopyRetryInstruction = 'CLEAR_KOREAN_COPY_V2: Draft the complete reason first, then derive card_name and card_reason from it. Read only the title + card_name + card_reason without the long reason. The card pair must state what happens, under which condition, and the specific health meaning or action. Do not omit a needed actor, object, particle, or situation. Do not end with 확인해요 or 살펴봐요 unless the sentence names exactly what to check. Do not reverse an observed loss of capacity into its cause. Use natural 해요체 and ordinary verb-led Korean; one necessary medical term or naturally short noun phrase is fine. Perform one final native-Korean read-aloud pass.';
const titleScopeRetryInstruction = 'TITLE_SCOPE_V3: Define one semantic class for a single ranked entry. The title count-bearing phrase must name that class and every entry must be an instance of it. Rewrite a title that counts an abstraction or mixes classes.';
const claimStrengthRetryInstruction = 'CLAIM_STRENGTH_V2: Distinguish observation, association, cause, and diagnosis. Do not upgrade the relation or certainty beyond the evidence. State necessary conditions and add a decision-relevant boundary or next check when uncertainty remains.';
const researchGroundingRetryInstruction = data.research_source_pack ? 'RESEARCH_GROUNDING_V1: A research_source_pack is supplied below. Write every factual claim only from its candidate_facts and sources. Do not add a condition, number, threshold, mechanism, comparison, interaction, exception, or causal relation that is absent from the cited fact evidence_summary. Every ranked item must set fact_id to exactly one candidate_fact id from the pack and source_ids to the source ids that fact cites. If the pack has no fact for an item you want, drop that item or change the angle instead of supplying the claim from memory. Keep exactly as many items as the supplied facts genuinely support, prefer three strong items over five padded ones, and never invent an item to reach a target count. Carry each fact necessary_condition and limitation_or_boundary into the visible copy whenever they change what the viewer should do. Restate every fact as your own short Korean card copy; never copy source sentences verbatim and never cite institution names, study names, or numbers that the pack does not contain. Regenerate strictly inside this same research_source_pack: ' + JSON.stringify(data.research_source_pack) : '';

const qualityInstruction = [
  'QUALITY_REVIEW_RETRY attempt ' + attempt + ' of ' + maxRetries + '.',
  'The previous complete pack failed an independent factual and semantic audit. Generate a new complete pack from scratch using the same JSON schema; do not patch individual strings downstream.',
  previousTitle ? 'Do not reuse or closely paraphrase this failed title: ' + previousTitle + '.' : '',
  previousItems ? 'Do not reuse this failed item set: ' + previousItems + '.' : '',
  issues.length ? 'Audit issues to correct: ' + JSON.stringify(issues.slice(0, 16)) : '',
  audit.length ? 'Per-item evidence audit: ' + JSON.stringify(audit.slice(0, 8)) : '',
  channelRetryInstruction,
  commentRetryInstruction,
  'Choose a title promise that every item directly fulfills. Remove topic drift, unrelated items, reversed causality, missing causal steps, and claims with uncertain support.',
  'Every replacement item must provide direct medical relevance through an established physiological, clinical, nutritional, medication-literacy, symptom-interpretation, or injury-prevention principle. Housekeeping, organizing, convenience, motivation, comfort, and generic self-care alone are insufficient.',
  'Each replacement item must contain a credible body mechanism or clinically relevant signal plus a decision-useful condition, practical action, or meaningful boundary. Each reason must make the relevant cause and practical result understandable on first read. Do not merely lengthen sentences or add filler; replace an item when its mechanism does not fit.',
  'Write all viewer-facing explanatory copy in natural Korean 해요체, never 합니다체. Provide card_name as a common everyday Korean image label of at most 30 characters, and card_reason as a useful 해요체 sentence of at most 60 characters. Avoid obscure object words and unexplained jargon.',
  'PLAIN_MEANING_V1: Clarity outranks brevity. Never compress a line to the point where a first-time reader cannot tell what it refers to. If the shorter wording loses the subject, the object, or what actually happens, use the longer wording and spend the characters. A card_reason must be understandable on its own without reading card_name first: name the thing it is about instead of relying on "그것", "이때", "이렇게", or a bare comparative with nothing to compare to. Reject copy that is short but vague; short is only a virtue when the meaning survives intact.',
  'NO_FIGURATIVE_COPY_V1: State things directly. No metaphor, no simile, no analogy, no poetic or roundabout phrasing, no rhetorical framing that makes the reader infer the point. Say the actual object, the actual action, and the actual consequence in plain words. Reject copy that gestures at the idea rather than saying it.',
  clearKoreanCopyRetryInstruction,
  titleScopeRetryInstruction,
  claimStrengthRetryInstruction,
  researchGroundingRetryInstruction,
  'Do not invent exact minutes, repetitions, percentages, thresholds, or measurements to make advice sound scientific. Keep exact detail only when established and necessary.',
  'Keep natural phone-readable Korean without hard character limits. Preserve necessary conditions, numbers, and technical terms.',
  'Keep the upload description easy to scan: 1-2 short opening sentences, a blank line, one concise numbered line per ranked item, a blank line, one calm closing sentence, and 3-5 relevant hashtags. Never return one dense paragraph. In the upload description only, do not add generic subscribe/like requests or a visible medical disclaimer; the pinned comment follows COMMENT_SUMMARY_V1.',
];

const medicalInstruction = [
  'MEDICAL_REVIEW_RETRY attempt ' + attempt + ' of ' + maxRetries + '.',
  'The previous complete pack failed local medical safety review. Generate a new complete pack from scratch using the same JSON schema.',
  previousTitle ? 'Do not reuse or closely paraphrase this failed title: ' + previousTitle + '.' : '',
  previousItems ? 'Do not reuse this failed item set: ' + previousItems + '.' : '',
  issues.length ? 'Failed medical issues: ' + JSON.stringify(issues.slice(0, 16)) : '',
  matchedTerms.length ? 'Avoid these exact risky terms and close variants: ' + matchedTerms.join(', ') + '.' : '',
  channelRetryInstruction,
  commentRetryInstruction,
  'Use neutral lifestyle-safe wording. Do not mention cure, treatment, guaranteed prevention, detox, miracle, doctor authority, hospital avoidance, prescription changes, or dosage.',
  'Each replacement item must still contain a decision-useful condition, observable sign, credible mechanism, practical action, or meaningful boundary. Do not invent exact minutes, repetitions, percentages, thresholds, or measurements.',
  'Keep direct medical relevance: explain an established body mechanism, clinically relevant signal, nutrition or medication-literacy principle, or injury-prevention principle rather than generic organizing or comfort advice.',
  'Write all viewer-facing explanatory copy in natural Korean 해요체, never 합니다체. Provide card_name as a common everyday Korean image label of at most 30 characters, and card_reason as a useful 해요체 sentence of at most 60 characters.',
  'PLAIN_MEANING_V1: Clarity outranks brevity. Never compress a line until a first-time reader cannot tell what it refers to. A card_reason must stand on its own without card_name: name the thing instead of leaning on "그것", "이때", "이렇게", or a comparative with nothing to compare to. Short but vague is a defect, not a virtue.',
  'NO_FIGURATIVE_COPY_V1: State things directly. No metaphor, simile, analogy, or roundabout phrasing that makes the reader infer the point. Say the actual object, the actual action, and the actual consequence in plain words.',
  clearKoreanCopyRetryInstruction,
  titleScopeRetryInstruction,
  claimStrengthRetryInstruction,
  researchGroundingRetryInstruction,
  'Keep natural phone-readable Korean without hard character limits. Preserve valid practical meaning.',
  'Keep the upload description easy to scan: 1-2 short opening sentences, a blank line, one concise numbered line per ranked item, a blank line, one calm closing sentence, and 3-5 relevant hashtags. Never return one dense paragraph. In the upload description only, do not add generic subscribe/like requests or a visible medical disclaimer; the pinned comment follows COMMENT_SUMMARY_V1.',
];

const retryInstruction = [
  ...(qualityFailed ? qualityInstruction : medicalInstruction),
  'Return strict JSON only. No markdown.',
].filter(Boolean).join('\\n');
const retryRequest = available ? appendRetryInstruction(data.kie_claude_request, retryInstruction) : data.kie_claude_request;
const retryRecord = {
  attempt,
  max_retries: maxRetries,
  available,
  review_kind: reviewKind,
  previous_title: previousTitle || null,
  issues,
  instruction: retryInstruction,
  prepared_at: new Date().toISOString(),
};

return [{ json: {
  ...data,
  medical_review_retry_available: available,
  review_retry_kind: reviewKind,
  ...(qualityFailed
    ? { content_quality_retry_attempt: attempt, content_quality_retry: retryRecord }
    : { medical_review_retry_attempt: attempt, medical_review_retry: retryRecord }),
  kie_claude_request: retryRequest,
} }];`;

function stripDuplicatedPolicies(workflow) {
  const parseNode = workflow.nodes.find((node) => node.name === 'Parse KIE Claude Pack');
  parseNode.parameters.jsCode = parseNode.parameters.jsCode.replace(
    /function validatePack\(pack\) \{[\s\S]*?\n\}\n\nif \(isAuthError/,
    basicPackValidation + '\n\nif (isAuthError',
  );

  const medicalNode = workflow.nodes.find((node) => node.name === 'Medical Safety Review');
  medicalNode.parameters.jsCode = medicalNode.parameters.jsCode
    .replace(/\n\nconst vagueReasonEnding[\s\S]*?\n\}\n\nif \(!Array\.isArray/, '\n\nif (!Array.isArray')
    .replace(
      "const qualityBlockingIssues = ['근거 문장 품질 부족', '근거 사실성 불명확', '근거 없는 수치 표현'];\nconst highRisk = issues.some((issue) => highRiskIssues.includes(issue) || qualityBlockingIssues.includes(issue));",
      'const highRisk = issues.some((issue) => highRiskIssues.includes(issue));',
    );
}

function patchBlockedResult(workflow) {
  const node = workflow.nodes.find((candidate) => candidate.name === 'Prepare Blocked Result');
  node.parameters.jsCode = `const data = $input.first().json;
const qualityFailed = data.content_quality_review && data.content_quality_review.pass !== true;
const reason = qualityFailed ? 'content_quality_failed' : 'medical_review_failed';
return [{ json: { ...data, result_stage: qualityFailed ? 'blocked_by_content_quality' : 'blocked_by_medical_review', youtube: { skipped: true, reason }, comment: { skipped: true, reason } } }];`;
}

function patchParent(workflow) {
  stripDuplicatedPolicies(workflow);
  patchBlockedResult(workflow);
  const retryNode = workflow.nodes.find((node) => node.name === 'Prepare Medical Retry Request');
  if (!retryNode) throw new Error(`${workflow.id}: Prepare Medical Retry Request missing`);
  retryNode.parameters.jsCode = reviewRetryCode;
  let callNode = workflow.nodes.find((node) => node.name === 'Shared Content Quality Gate');
  if (!callNode) {
    callNode = {
      parameters: {
        source: 'database',
        workflowId: { __rl: true, value: sharedId, mode: 'list', cachedResultName: sharedName },
        workflowInputs: {
          mappingMode: 'defineBelow',
          value: {},
          matchingColumns: [],
          schema: [],
          attemptToConvertTypes: false,
          convertFieldsToString: true,
        },
        mode: 'once',
        options: { waitForSubWorkflow: true },
      },
      id: randomUUID(),
      name: 'Shared Content Quality Gate',
      type: 'n8n-nodes-base.executeWorkflow',
      typeVersion: 1.3,
      position: [1190, -260],
    };
    workflow.nodes.push(callNode);
  }

  let ifNode = workflow.nodes.find((node) => node.name === 'Content Quality Passed?');
  if (!ifNode) {
    ifNode = {
      parameters: { conditions: { boolean: [{ value1: '={{$json.content_quality_review.pass}}', value2: true }] } },
      id: randomUUID(),
      name: 'Content Quality Passed?',
      type: 'n8n-nodes-base.if',
      typeVersion: 1,
      position: [1360, -260],
    };
    workflow.nodes.push(ifNode);
  }

  workflow.connections['Parse KIE Claude Pack'] = { main: [[{ node: 'Shared Content Quality Gate', type: 'main', index: 0 }]] };
  workflow.connections['Mock Viral Rank Pack'] = { main: [[{ node: 'Shared Content Quality Gate', type: 'main', index: 0 }]] };
  workflow.connections['Shared Content Quality Gate'] = { main: [[{ node: 'Content Quality Passed?', type: 'main', index: 0 }]] };
  workflow.connections['Content Quality Passed?'] = { main: [
    [{ node: 'Medical Safety Review', type: 'main', index: 0 }],
    [{ node: 'Prepare Medical Retry Request', type: 'main', index: 0 }],
  ] };
  return workflow;
}

function findParentFile(id) {
  const dir = path.join(root, 'workflows');
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json') || name === 'shared_content_quality_gate.json') continue;
    const file = path.join(dir, name);
    const workflow = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (workflow.id === id) return file;
  }
  throw new Error(`Parent workflow file missing: ${id}`);
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function done(error) {
      if (error) reject(error);
      else resolve(this.changes);
    });
  });
}

const nodePatchArg = process.argv.find((value) => value.startsWith('--emit-node-patch='));
if (nodePatchArg) {
  const [workflowId, nodeName] = nodePatchArg.slice('--emit-node-patch='.length).split('::');
  let filePath;
  let original;
  let updated;
  if (workflowId === sharedId) {
    filePath = path.join(root, 'workflows', 'shared_content_quality_gate.json');
    original = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    updated = sharedWorkflow(original.versionId);
  } else if (parentIds.includes(workflowId)) {
    filePath = findParentFile(workflowId);
    original = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    updated = patchParent(structuredClone(original));
  } else {
    throw new Error('Invalid workflow id for --emit-node-patch');
  }
  const oldCode = original.nodes.find((node) => node.name === nodeName)?.parameters?.jsCode;
  const newCode = updated.nodes.find((node) => node.name === nodeName)?.parameters?.jsCode;
  if (typeof oldCode !== 'string' || typeof newCode !== 'string') throw new Error(`Node code missing: ${workflowId} ${nodeName}`);
  if (oldCode === newCode) process.exit(0);
  process.stdout.write([
    '*** Begin Patch',
    `*** Update File: ${filePath}`,
    '@@',
    '-        "jsCode": ' + JSON.stringify(oldCode),
    '+        "jsCode": ' + JSON.stringify(newCode),
    '*** End Patch',
  ].join('\n'));
  process.exit(0);
}

if (process.argv.includes('--emit-workflow-json')) {
  const emitted = [];
  const shared = sharedWorkflow();
  emitted.push({ filePath: path.join(root, 'workflows', 'shared_content_quality_gate.json'), content: JSON.stringify(shared, null, 2) + '\n' });
  for (const id of parentIds) {
    const filePath = findParentFile(id);
    const workflow = patchParent(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    workflow.versionId = randomUUID();
    emitted.push({ filePath, content: JSON.stringify(workflow, null, 2) + '\n' });
  }
  process.stdout.write(JSON.stringify(emitted));
  process.exit(0);
}

fs.mkdirSync(backupDir, { recursive: true });
const db = new sqlite3.Database(dbPath);
const backupFile = path.join(backupDir, 'database.sqlite').replace(/'/g, "''").replace(/\\/g, '/');
await run(db, `VACUUM INTO '${backupFile}'`);

const shared = sharedWorkflow();
fs.writeFileSync(path.join(root, 'workflows', 'shared_content_quality_gate.json'), JSON.stringify(shared, null, 2) + '\n', 'utf8');

const fileResults = [];
for (const id of parentIds) {
  const file = findParentFile(id);
  const workflow = patchParent(JSON.parse(fs.readFileSync(file, 'utf8')));
  workflow.versionId = randomUUID();
  fs.writeFileSync(file, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
  fileResults.push({ id, file });
}

await run(db, 'BEGIN IMMEDIATE');
const dbResults = [];
try {
  await run(
    db,
    `INSERT INTO workflow_entity (id,name,active,nodes,connections,settings,staticData,pinData,versionId,triggerCount,meta,isArchived,versionCounter,description,nodeGroups)
     VALUES (?,?,?,?,?,?,?,?,?,0,NULL,0,1,?,?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, active=1, nodes=excluded.nodes, connections=excluded.connections,
       settings=excluded.settings, staticData=excluded.staticData, pinData=excluded.pinData, versionId=excluded.versionId,
       updatedAt=strftime('%Y-%m-%d %H:%M:%f','now'), versionCounter=workflow_entity.versionCounter+1,
       description=excluded.description, nodeGroups=excluded.nodeGroups`,
    [
      shared.id,
      shared.name,
      1,
      JSON.stringify(shared.nodes),
      JSON.stringify(shared.connections),
      JSON.stringify(shared.settings),
      null,
      JSON.stringify(shared.pinData),
      shared.versionId,
      'Reusable fact audit: formatting and reviewer outages are advisory; factual uncertainty remains blocking.',
      JSON.stringify(shared.nodeGroups),
    ],
  );
  await run(
    db,
    `INSERT INTO shared_workflow (workflowId,projectId,role) VALUES (?,?,?)
     ON CONFLICT(workflowId,projectId) DO UPDATE SET role=excluded.role, updatedAt=strftime('%Y-%m-%d %H:%M:%f','now')`,
    [shared.id, projectId, 'workflow:owner'],
  );
  await run(
    db,
    `INSERT INTO workflow_history (versionId,workflowId,authors,nodes,connections,nodeGroups,name,description,autosaved)
     VALUES (?,?,?,?,?,?,?,?,0)`,
    [
      shared.versionId,
      shared.id,
      'Codex shared quality gate installer',
      JSON.stringify(shared.nodes),
      JSON.stringify(shared.connections),
      JSON.stringify(shared.nodeGroups),
      shared.name,
      'Reusable fact audit: formatting and reviewer outages are advisory; factual uncertainty remains blocking.',
    ],
  );
  await run(
    db,
    `UPDATE workflow_entity SET active=1,activeVersionId=?,versionId=?,updatedAt=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=?`,
    [shared.versionId, shared.versionId, shared.id],
  );
  await run(
    db,
    `INSERT INTO workflow_published_version (workflowId,publishedVersionId) VALUES (?,?)
     ON CONFLICT(workflowId) DO UPDATE SET publishedVersionId=excluded.publishedVersionId, updatedAt=strftime('%Y-%m-%d %H:%M:%f','now')`,
    [shared.id, shared.versionId],
  );

  const rows = await all(
    db,
    `SELECT id,name,nodes,connections FROM workflow_entity WHERE id IN (${parentIds.map(() => '?').join(',')})`,
    parentIds,
  );
  if (rows.length !== parentIds.length) throw new Error(`Expected ${parentIds.length} parent workflows, got ${rows.length}`);
  for (const row of rows) {
    const workflow = patchParent({ id: row.id, name: row.name, nodes: JSON.parse(row.nodes), connections: JSON.parse(row.connections) });
    const changes = await run(
      db,
      `UPDATE workflow_entity SET nodes=?,connections=?,versionId=?,versionCounter=versionCounter+1,
       updatedAt=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=?`,
      [JSON.stringify(workflow.nodes), JSON.stringify(workflow.connections), randomUUID(), row.id],
    );
    dbResults.push({ id: row.id, changes });
  }
  await run(db, 'COMMIT');
} catch (error) {
  try { await run(db, 'ROLLBACK'); } catch {}
  throw error;
} finally {
  await new Promise((resolve) => db.close(resolve));
}

console.log(JSON.stringify({ ok: true, backupDir, sharedWorkflow: shared.id, fileResults, dbResults }, null, 2));
