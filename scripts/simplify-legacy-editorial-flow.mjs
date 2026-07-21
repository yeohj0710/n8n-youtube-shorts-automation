import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sqlite3 from 'sqlite3';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const dbPath = path.join(root, '.n8n', 'database.sqlite');
const targets = [
  {
    id: 'baekse100Life01',
    file: 'workflows/n8n_geongangjangsubigyeol_manual.json',
    channel: '건강장수비결',
    audience: '50대 이후 시청자가 식사·운동·수면·혈압·혈당·관절을 관리해 오래 건강하고 일상 기능과 자립을 지키도록 돕는 실천형 건강교육',
    profile: {
      id: 'longevity_daily_function',
      purpose: '건강한 장수와 일상 기능 유지를 위해 만성질환 위험, 근력, 보행, 관절, 수면, 식사를 생활 속에서 관리하도록 돕습니다.',
      boundary: '성분 자체를 해설하는 데 머물지 말고, 50대 이후의 장기적인 기능 유지와 실제 생활 습관으로 연결합니다.',
      pillars: [
        { id: 'cardiometabolic', title: '혈압·혈당 관리', lane: 'daily_health_lifestyle', keywords: ['혈압', '혈당', '당뇨', '나트륨', '혈관', '식후', '중성지방'] },
        { id: 'joints_balance_falls', title: '관절·균형·낙상 예방', lane: 'movement_mobility_longevity', keywords: ['관절', '무릎', '균형', '낙상', '계단', '발목', '허리'] },
        { id: 'strength_walking', title: '근력·보행 유지', lane: 'movement_mobility_longevity', keywords: ['근력', '근육', '보행', '걷기', '보폭', '하체', '악력'] },
        { id: 'longevity_meals', title: '장수 식사 습관', lane: 'food_nutrition_table', keywords: ['식사', '식탁', '단백질', '채소', '통곡', '식이섬유', '아침밥'] },
        { id: 'sleep_recovery', title: '수면·회복 관리', lane: 'sleep_energy_recovery', keywords: ['수면', '잠', '새벽', '낮잠', '피로', '회복', '코골이'] },
        { id: 'daily_function', title: '일상 기능과 자립', lane: 'daily_health_lifestyle', keywords: ['자립', '일상 기능', '외출', '집안일', '생활 체력', '기력', '활동량'] },
        { id: 'chronic_risk_signals', title: '만성질환 위험 신호', lane: 'body_signal_selfcheck', keywords: ['붓기', '숨참', '어지럼', '갈증', '소변', '피로', '가슴'] },
      ],
      topic_pool: [
        { pillar: 'cardiometabolic', lane: 'daily_health_lifestyle', title: '집에서 혈압 잴 때 숫자가 다르게 나오는 이유 5' },
        { pillar: 'cardiometabolic', lane: 'food_nutrition_table', title: '혈당이 걱정될 때 같은 밥상에서 바꿀 순서 5' },
        { pillar: 'cardiometabolic', lane: 'food_nutrition_table', title: '나트륨을 줄여도 혈압 관리가 어려운 식사 습관 5' },
        { pillar: 'joints_balance_falls', lane: 'movement_mobility_longevity', title: '넘어질 위험이 커질 때 먼저 보이는 균형 신호 5' },
        { pillar: 'joints_balance_falls', lane: 'movement_mobility_longevity', title: '계단에서 무릎 부담을 줄이는 움직임 원칙 5' },
        { pillar: 'joints_balance_falls', lane: 'movement_mobility_longevity', title: '발목이 약해지면 걸음이 휘청거리는 이유 5' },
        { pillar: 'strength_walking', lane: 'movement_mobility_longevity', title: '걷기 외에 하체 힘을 지키는 생활 습관 5' },
        { pillar: 'strength_walking', lane: 'movement_mobility_longevity', title: '보폭이 줄 때 확인할 근력과 관절 신호 5' },
        { pillar: 'strength_walking', lane: 'movement_mobility_longevity', title: '오래 걷는 힘을 지키는 생활 속 근력 습관 5' },
        { pillar: 'longevity_meals', lane: 'food_nutrition_table', title: '50대 이후 한 끼에서 단백질을 놓치는 경우 5' },
        { pillar: 'longevity_meals', lane: 'food_nutrition_table', title: '오래 건강하게 먹기 위해 식탁에서 바꿀 조합 5' },
        { pillar: 'longevity_meals', lane: 'food_nutrition_table', title: '식이섬유를 늘릴 때 함께 확인할 몸의 반응 5' },
        { pillar: 'sleep_recovery', lane: 'sleep_energy_recovery', title: '새벽에 자주 깰 때 낮부터 확인할 습관 5' },
        { pillar: 'sleep_recovery', lane: 'sleep_energy_recovery', title: '아침 피로가 계속될 때 수면에서 볼 신호 5' },
        { pillar: 'sleep_recovery', lane: 'sleep_energy_recovery', title: '낮잠이 밤잠을 방해하는 경우와 조절 원칙 5' },
        { pillar: 'daily_function', lane: 'daily_health_lifestyle', title: '생활 체력이 떨어지면 먼저 힘들어지는 동작 5가지' },
        { pillar: 'daily_function', lane: 'daily_health_lifestyle', title: '나이 들어도 혼자 생활하는 힘을 지키는 습관 5' },
        { pillar: 'daily_function', lane: 'daily_health_lifestyle', title: '활동량이 줄 때 몸 기능이 함께 떨어지는 이유 5' },
        { pillar: 'chronic_risk_signals', lane: 'body_signal_selfcheck', title: '붓기가 반복될 때 생활 습관만 탓하면 안 되는 신호 5' },
        { pillar: 'chronic_risk_signals', lane: 'body_signal_selfcheck', title: '갈증과 소변 변화에서 함께 확인할 신호 5' },
        { pillar: 'chronic_risk_signals', lane: 'body_signal_selfcheck', title: '평소와 다른 숨참이 생길 때 살펴볼 상황 5' },
      ],
    },
  },
  {
    id: 'mxrYb3maJS31gEYC',
    file: 'workflows/n8n_하루건강약사_수동실행.json',
    channel: '하루건강약사',
    audience: '50대 이후 시청자가 몸과 성분을 이해하고 영양·음식·영양제·피부·활력에 관한 건강한 선택을 스스로 판단하도록 돕는 이해 중심 건강교육',
    profile: {
      id: 'haru_health_literacy',
      purpose: '건강 정보와 성분을 쉽게 풀어 설명하고, 시청자가 자기 몸에 필요한 영양·음식·영양제·피부·활력 선택을 판단하도록 돕습니다.',
      boundary: '장수 습관을 넓게 나열하기보다 성분, 몸의 원리, 관찰 신호, 선택 기준에서 놓치기 쉬운 부분을 차근차근 설명합니다.',
      pillars: [
        { id: 'nutrition_food_choices', title: '영양·음식 선택', lane: 'food_nutrition_table', keywords: ['영양', '음식', '식품', '단백질', '지방', '탄수화물', '원재료'] },
        { id: 'supplement_ingredients', title: '영양제·성분 이해', lane: 'food_nutrition_table', keywords: ['영양제', '비타민', '미네랄', '마그네슘', '오메가', '성분', '함량'] },
        { id: 'body_signals', title: '몸 신호 이해', lane: 'body_signal_selfcheck', keywords: ['몸의 신호', '피로', '갈증', '소변', '붓기', '어지럼', '손톱'] },
        { id: 'skin_vitality', title: '피부·활력 관리', lane: 'body_signal_selfcheck', keywords: ['피부', '건조', '탄력', '멍', '활력', '기력', '회복력'] },
        { id: 'sleep_recovery_science', title: '수면·회복 원리', lane: 'sleep_energy_recovery', keywords: ['수면', '잠', '카페인', '새벽', '멜라토닌', '피로', '회복'] },
        { id: 'medicine_literacy', title: '약 성분·복용 이해', lane: 'daily_health_lifestyle', keywords: ['약', '복용', '성분표', '중복', '감기약', '진통제', '상호작용'] },
        { id: 'daily_health_choices', title: '생활습관과 건강 선택', lane: 'daily_health_lifestyle', keywords: ['생활습관', '수분', '햇빛', '활동', '식사 시간', '회복', '건강 선택'] },
      ],
      topic_pool: [
        { pillar: 'nutrition_food_choices', lane: 'food_nutrition_table', title: '단백질 식품을 고를 때 양보다 함께 볼 것 5' },
        { pillar: 'nutrition_food_choices', lane: 'food_nutrition_table', title: '건강식품처럼 보여도 원재료표를 다시 볼 경우 5' },
        { pillar: 'nutrition_food_choices', lane: 'food_nutrition_table', title: '같은 지방이라도 몸에서 다르게 쓰이는 이유 5' },
        { pillar: 'supplement_ingredients', lane: 'food_nutrition_table', title: '영양제 성분표에서 함량과 함께 확인할 것 5' },
        { pillar: 'supplement_ingredients', lane: 'food_nutrition_table', title: '여러 영양제를 먹을 때 성분이 겹치는 경우 5' },
        { pillar: 'supplement_ingredients', lane: 'food_nutrition_table', title: '비타민 이름이 비슷해도 역할이 다른 이유 5' },
        { pillar: 'body_signals', lane: 'body_signal_selfcheck', title: '피로가 계속될 때 수면 부족만 탓하면 안 되는 신호 5' },
        { pillar: 'body_signals', lane: 'body_signal_selfcheck', title: '소변 색 변화에서 수분 상태를 볼 때의 한계 5' },
        { pillar: 'body_signals', lane: 'body_signal_selfcheck', title: '자주 어지러울 때 상황별로 구분해 볼 신호 5' },
        { pillar: 'skin_vitality', lane: 'body_signal_selfcheck', title: '피부가 갑자기 건조해질 때 함께 확인할 변화 5' },
        { pillar: 'skin_vitality', lane: 'body_signal_selfcheck', title: '멍이 자주 생길 때 생활 습관 외에 볼 신호 5' },
        { pillar: 'skin_vitality', lane: 'body_signal_selfcheck', title: '활력이 떨어질 때 영양과 회복에서 확인할 것 5' },
        { pillar: 'sleep_recovery_science', lane: 'sleep_energy_recovery', title: '카페인이 밤잠에 남는 방식과 줄이는 선택 5' },
        { pillar: 'sleep_recovery_science', lane: 'sleep_energy_recovery', title: '새벽 각성이 반복될 때 몸의 신호를 구분하는 법 5' },
        { pillar: 'sleep_recovery_science', lane: 'sleep_energy_recovery', title: '잠을 오래 자도 피곤할 때 수면의 질에서 볼 것 5' },
        { pillar: 'medicine_literacy', lane: 'daily_health_lifestyle', title: '감기약을 함께 먹기 전 중복 성분을 찾는 법 5' },
        { pillar: 'medicine_literacy', lane: 'daily_health_lifestyle', title: '진통제 성분이 다를 때 주의점이 달라지는 이유 5' },
        { pillar: 'medicine_literacy', lane: 'daily_health_lifestyle', title: '약과 영양제를 같이 먹을 때 확인할 질문 5' },
        { pillar: 'daily_health_choices', lane: 'daily_health_lifestyle', title: '물을 많이 마시는 것보다 몸 상태가 중요한 경우 5' },
        { pillar: 'daily_health_choices', lane: 'daily_health_lifestyle', title: '햇빛과 활동량이 회복 리듬에 영향을 주는 이유 5' },
        { pillar: 'daily_health_choices', lane: 'daily_health_lifestyle', title: '식사 시간이 들쭉날쭉할 때 몸에서 생기는 변화 5' },
      ],
    },
  },
];

function commentSummaryContract(target) {
  const channelClosing = target.profile.id === 'haru_health_literacy'
    ? 'For 하루건강약사, the final sentence should invite viewers to subscribe for easy explanations that help them understand their body, ingredients, and health choices.'
    : 'For 건강장수비결, the final sentence should invite viewers to subscribe and keep building habits for healthy aging, daily function, and independence together.';
  return 'COMMENT_SUMMARY_V1: Write pinned_comment as 2-4 short natural Korean 해요체 sentences under 260 Korean characters. In the first 1-3 sentences, summarize the exact title and item set by selecting 2-3 of the most useful actions or principles and preserving their practical meaning; do not copy the full description or list every item. End with one restrained subscription invitation aligned to the configured channel, with naturally varied wording rather than a fixed slogan. ' + channelClosing + ' Do not ask a question. Do not ask viewers to reply or comment. Do not ask for likes. Do not invent a first-person channel-owner or family anecdote, credentials, or personal experience. Avoid slang, cute phrasing, casual chatter, emoji decoration, sales language, and other engagement bait.';
}

function attentionPromiseContract(target) {
  const channelAngle = target.profile.id === 'haru_health_literacy'
    ? 'For 하루건강약사, create tension through a body signal, ingredient, interaction, comparison, or health-choice blind spot that the viewer can understand and act on.'
    : 'For 건강장수비결, create tension through a familiar habit, functional change, chronic-risk signal, mobility problem, meal choice, or recovery pattern that matters to healthy aging and independence.';
  return 'ATTENTION_PROMISE_V2: Before finalizing the topic, hook_title, and subtitle, create immediate truthful self-relevance for a Korean viewer over 50. The first screen must name a concrete condition, situation, action, choice, or observable signal and promise one specific decision-useful payoff. The viewer should immediately think "this may apply to me" and understand what the ranked list will resolve. subtitle must add the missing condition, contrast, or payoff instead of paraphrasing hook_title. ' + channelAngle + ' HOOK_PATTERNS: this channel already performs with a small set of proven Korean title shapes, and you should choose whichever one the researched facts actually earn: a belief reversal such as 대부분이 잘못 알고 있는 or 의외로; a loss frame such as 모르면 손해 보는, 버리면 손해 보는, or 괜히 사기 전 먼저; an insider reveal such as 의사들이 자주 말하는 or 주부 9단도 몰랐던; a head-to-head comparison such as A vs B; a targeted audience opener such as 50대 이후 or 나이 들수록; or a moment trigger such as 자기 전에, 아침에 눈뜨자마자, or 걷기 전후. Write the title the way a person actually speaks, not the way a report is labelled. A title such as 마그네슘 흡수율 비교 3가지 is a filing label and fails; 영양제 코너에서 대부분이 잘못 고르는 마그네슘 5 is the same fact written as a hook. These shapes are required to be earned, never decorative: use a loss frame only when the items really prevent a loss, an insider reveal only when the facts really are commonly missed, and a reversal only when the common belief really is wrong. Reject the shape and rewrite the title whenever the ranked items do not deliver that exact promise. Never use empty bait with no payoff behind it, and never use threats, shame, fake urgency, inflated stakes, invented authority, or guaranteed outcomes.';
}

const editorialRules = 'Editorial rules: use common everyday Korean and familiar actions and objects. Avoid uncommon furniture terms, unexplained jargon, filler, duplicate points, fake authority, fearmongering, invented statistics, dosage instructions, diagnosis, cure, or guaranteed prevention.';
const clearKoreanCopyContract = 'CLEAR_KOREAN_COPY_V2: Write every viewer-facing field as idiomatic Korean that a Korean health educator would naturally say to one adult. Draft the complete reason first, then derive card_name and card_reason from that reason instead of compressing keywords independently. For every rank, read the title, card_name, and card_reason without the long reason. They must state what happens, under which condition, and the specific meaning or action without rereading or without mentally supplying a missing subject, object, particle, or situation. card_name must be a concrete standalone symptom, action, or condition in common words. card_reason must be one complete 해요체 sentence that names the observation and its specific health meaning or next action. Never use vague endings such as 확인해요 or 살펴봐요 without naming the object being checked. Do not reverse an observed loss of capacity into a cause; describe the comparable situation and the symptom that now appears. Natural short noun phrases and necessary medical terms are fine when immediately clear, but avoid report heading or search keyword list wording, forced noun chains, incompatible subject-predicate combinations, literal translation, unclear references, and repeated AI templates. Before returning JSON, perform one final native-Korean copy-edit pass over hook_title, subtitle, every name, card_name, reason, card_reason, caution, video_script, description, and pinned_comment, and rewrite any field that fails this standalone reading test.';
const titleScopeContract = 'TITLE_SCOPE_V3: Before drafting, define one semantic class for a single ranked entry. The count-bearing phrase in hook_title must name that semantic class, and every name and card_name must be an instance of it. If a candidate title counts a topic, property, outcome, audience, or other abstraction rather than the entries, rewrite the title before writing the pack. Broad topical relation is not enough; mixed semantic classes are invalid.';
const claimStrengthContract = 'CLAIM_STRENGTH_V2: Distinguish observation, association, cause, and diagnosis. Do not upgrade an observation or association into a cause or diagnosis unless the evidence supports that relation and the necessary conditions are stated. When the evidence supports several explanations, use calibrated language and give the decision-relevant boundary or next check. State certainty only at the level justified by the evidence.';
const decisionDetailContract = 'DECISION_DETAIL_V1: Every ranked item must add at least one concrete fact not inferable from the title or item name: a relevant condition, body mechanism, comparison, label field, timing or situation, interaction, observable pattern, practical action, meaningful boundary, or an established number only when necessary. The reason must answer what the viewer should notice or do differently and why. Do not merely restate the title or name with generic phrases such as 건강에 좋아요, 도움이 될 수 있어요, 주의가 필요해요, 확인해요, 관리가 중요해요, or 사람마다 달라요. If an item has no concrete difference, replace the item or topic instead of padding the list. State established facts directly. Qualify only the exact uncertain relation or condition, and do not stack may, could, might, or 수 있어요 across the pack as generic safety padding. A specific condition, exception, or alternative explanation is useful; blanket caution is not.';
const researchGroundingContract = 'RESEARCH_GROUNDING_V2: A research_source_pack is supplied below as supporting evidence for this topic. Prefer it wherever it covers what you are saying, and never contradict it. It does not have to supply every item: choose the topic and the ranked items for everyday usefulness first, then lean on the pack for the parts it covers. Write every factual claim it does cover only from its candidate_facts and sources. Do not add a condition, number, threshold, mechanism, comparison, interaction, exception, or causal relation that is absent from the cited fact evidence_summary. When an item is written from the pack, set its fact_id to exactly one candidate_fact id and source_ids to the source ids that fact cites; leave both empty for an item the pack does not cover. Aim for 5 ranked items, and use 6 or 7 when the pack holds that many genuinely distinct facts. Research enough material to reach 5 before writing: if the pack cannot support at least 4 real items, widen the angle or gather more facts rather than shipping a thin list or inventing an item. Carry each fact necessary_condition and limitation_or_boundary into the visible copy whenever they change what the viewer should do. Restate every fact as your own short Korean card copy; never copy source sentences verbatim and never cite institution names, study names, or numbers that the pack does not contain.';
const sourceSelectionContract = (target) => {
  const channelAngle = target.profile.id === 'haru_health_literacy'
    ? 'For 하루건강약사, the strongest angles compare two similar-looking ingredients, products, or choices, expose an interaction or a label field the viewer never checks, or explain what an ordinary body signal actually means.'
    : 'For 건강장수비결, the strongest angles reveal an early functional change the viewer can measure at home, a habit whose long-term cost is invisible day to day, or a concrete threshold that separates normal aging from a problem worth acting on.';
  return 'SOURCE_SELECTION_V2: Pick the angle and the ranked facts that most change what the viewer already believes or already does. Before choosing, ask what an ordinary viewer would already assume about this topic, and prefer the facts that contradict, qualify, or sharpen that assumption. A fact nobody would argue with is not worth a card. Score every candidate fact on evidence strength, surprise value, self relevance for a Korean viewer over 50, decision value, card fit, channel fit, and novelty against recent titles, then keep only facts that win on surprise and decision value while staying fully supported by the pack. Dull, obvious, or universally known advice fails this channel and must be rejected when the sentence itself is the point rather than part of a concrete explanation: 물을 충분히 마셔요, 균형 잡힌 식사를 해요, 규칙적으로 운동해요, 영양제는 주의해서 먹어요, 몸의 신호를 확인해요, 전문가와 상담하세요. Prefer an important exception to common belief, an overlooked consequence of an ordinary habit, a real difference between two similar-looking choices, a specific interaction, an observable signal and what it means, a checkable label or measurement, or a well-established number that reframes the decision. Earn attention with the true finding itself. Never manufacture interest with vague bait, exaggerated stakes, fear, or a promise the supplied facts do not support. ' + channelAngle;
};
const everydayLanguageContract = 'EVERYDAY_LANGUAGE_V1: This is a senior lifestyle channel, not a clinical education channel. Every visible field must land instantly for a 60-year-old with no health background who is half-watching on a phone. Build each ranked item out of an ordinary thing they can picture: a food, a dish, a drink, an object in the house, a place, a time of day, an everyday action, or a feeling in the body. Say 밥, 국물, 김치, 커피, 우유, 소파, 냉장고, 자기 전, 아침 공복, 계단, 장바구니 rather than a category name. Never put a clinical measurement, screening threshold, lab value, percentage, chemical or salt name, medical scale name, diagnosis code, or study term into hook_title, subtitle, card_name, or card_reason. Wording such as 34cm 미만, 악력 28kg, 500mg, 분획 흡수율, 산화마그네슘, 유의하게, 선별 기준, or a questionnaire score is a hard failure even when the research pack contains it. The research pack may be clinical; the card must be kitchen-table Korean. Translate every fact into the everyday behaviour it implies and the everyday result the viewer would notice: 식후에 확 올라요, 천천히 올라요, 속이 편해요, 금방 배고파져요, 흡수가 떨어져요, 아침이 개운해요. A number is allowed only when it is a number the viewer already uses in daily life, such as 두 시간, 세 알, 하루 한 번, or 10분, and never as a cutoff to be measured against. If a fact cannot survive this translation without losing its meaning, drop it and pick a fact that can.';
const everydayTopicAngleContract = 'EVERYDAY_TOPIC_ANGLE_V2: Choose the topic the way a well-informed Korean friend would raise it over coffee, not the way a clinician would file it. The strongest topics for this channel are ordinary life seen closely: things around the house, what is in the fridge or the car or the shopping basket, how people move and sit and sleep, what changes with the seasons, how to age with dignity, and the small choices at the dinner table. Health is the lens, not the vocabulary: a topic qualifies if it affects how a person over 50 lives, not because it appears in a medical guideline. Never build a card around a screening test, a lab value, a measurement procedure, an ingredient comparison, or anything whose natural home is a clinic handout. If a fact is true but only a professional would raise it, drop it. Pick the angle from ordinary daily life, not from the clinic. Good angles live at the dinner table, in the fridge, in the medicine drawer, in the bedroom at night, on the stairs, in the shopping basket, and in what the body feels after a meal or on waking. Even when the strongest evidence is a screening test, a lab threshold, an ingredient comparison, or a diagnosis, do not build the card around it; convert it into the everyday choice or habit it actually implies and rank those. A viewer should be able to act on every item tonight without measuring, testing, or buying anything new.';
const researchGroundingRetryContract = researchGroundingContract;
const attentionPromiseRetryContract = 'ATTENTION_PROMISE_V2: Rebuild the topic, hook_title, and subtitle with immediate truthful self-relevance for a Korean viewer over 50. Name a concrete condition, situation, action, choice, or observable signal and promise one specific decision-useful payoff. Use the configured channel profile: haru_health_literacy should create tension through body signals, ingredients, interactions, comparisons, or health-choice blind spots; longevity_daily_function should use familiar habits, functional changes, chronic-risk signals, mobility, meals, or recovery patterns that matter to healthy aging and independence. Choose whichever proven Korean title shape the researched facts actually earn: a belief reversal such as 대부분이 잘못 알고 있는, a loss frame such as 모르면 손해 보는 or 괜히 사기 전 먼저, an insider reveal such as 의사들이 자주 말하는, a head-to-head comparison, a targeted opener such as 50대 이후, or a moment trigger such as 자기 전에. Write the title the way a person speaks, not as a filing label. Earn the shape with the ranked items or rewrite it. Never use empty bait, threats, shame, fake urgency, inflated stakes, invented authority, guaranteed outcomes, or unsupported drama.';
const decisionDetailRetryContract = decisionDetailContract;

function replaceBetween(code, startAnchor, endAnchor, replacement, label) {
  const start = code.indexOf(startAnchor);
  if (start < 0) throw new Error(`missing ${label} start anchor`);
  const endStart = code.indexOf(endAnchor, start);
  if (endStart < 0) throw new Error(`missing ${label} end anchor`);
  return code.slice(0, start) + replacement + code.slice(endStart + endAnchor.length);
}

function replaceRequired(code, search, replacement, label) {
  if (!code.includes(search)) throw new Error(`missing ${label} anchor`);
  return code.replace(search, replacement);
}

function replacePatternRequired(code, pattern, replacement, label) {
  if (!pattern.test(code)) throw new Error(`missing ${label} pattern`);
  pattern.lastIndex = 0;
  return code.replace(pattern, replacement);
}

const researchResolverBlock = `// RESEARCH_SOURCE_PACK_V1_BEGIN
const RESEARCH_SOURCE_CONTRACT = 'RESEARCH_SOURCE_PACK_V1';
function normalizeResearchSourcePack(value) {
  if (!value || typeof value !== 'object') return null;
  const sources = (Array.isArray(value.sources) ? value.sources : [])
    .map((entry, index) => ({
      source_id: clean(entry?.source_id) || ('S' + (index + 1)),
      title: clean(entry?.title),
      publisher: clean(entry?.publisher),
      url: clean(entry?.url),
      published_at: clean(entry?.published_at),
      source_type: clean(entry?.source_type),
    }))
    .filter((entry) => entry.title && entry.url);
  const sourceIds = new Set(sources.map((entry) => entry.source_id));
  const candidateFacts = (Array.isArray(value.candidate_facts) ? value.candidate_facts : [])
    .map((entry, index) => ({
      fact_id: clean(entry?.fact_id) || ('F' + (index + 1)),
      claim: clean(entry?.claim),
      source_ids: (Array.isArray(entry?.source_ids) ? entry.source_ids : []).map(clean).filter((id) => sourceIds.has(id)),
      evidence_summary: clean(entry?.evidence_summary),
      why_interesting: clean(entry?.why_interesting),
      viewer_relevance: clean(entry?.viewer_relevance),
      viewer_decision: clean(entry?.viewer_decision),
      necessary_condition: clean(entry?.necessary_condition),
      limitation_or_boundary: clean(entry?.limitation_or_boundary),
      confidence: clean(entry?.confidence),
    }))
    .filter((entry) => entry.claim && entry.evidence_summary && entry.source_ids.length);
  if (!sources.length || !candidateFacts.length) return null;
  return {
    contract: RESEARCH_SOURCE_CONTRACT,
    channel_profile: clean(value.channel_profile) || channelEditorialProfile.id,
    researched_at: clean(value.researched_at),
    search_queries: (Array.isArray(value.search_queries) ? value.search_queries : []).map(clean).filter(Boolean),
    sources,
    candidate_facts: candidateFacts,
    selected_angle: clean(value.selected_angle),
    rejected_angles: (Array.isArray(value.rejected_angles) ? value.rejected_angles : []).map(clean).filter(Boolean),
  };
}
const researchSourcePack = normalizeResearchSourcePack(
  cfg.research_source_pack ||
  cfg.topic_queue?.selected?.research_source_pack ||
  queuedSpec?.research_source_pack ||
  null,
);
const researchGrounded = Boolean(researchSourcePack);
function normalizePreparedCardPack(value) {
  if (!value || typeof value !== 'object') return null;
  const title = clean(value.hook_title || value.title);
  const items = (Array.isArray(value.rank_items) ? value.rank_items : []).map((item, index) => ({
    rank: index + 1,
    fact_id: clean(item?.fact_id),
    source_ids: (Array.isArray(item?.source_ids) ? item.source_ids : []).map(clean).filter(Boolean),
    name: clean(item?.name || item?.card_name),
    card_name: clean(item?.card_name || item?.name),
    reason: clean(item?.reason || item?.card_reason),
    card_reason: clean(item?.card_reason),
    caution: clean(item?.caution),
  }));
  if (!title) return null;
  if (items.length < 4 || items.length > 7) {
    throw new Error('PREPARED_CARD_PACK_INVALID: a prepared final_pack must carry 4-7 ranked items, got ' + items.length + '.');
  }
  for (const item of items) {
    if (!item.card_name || !item.card_reason) {
      throw new Error('PREPARED_CARD_PACK_INVALID: rank ' + item.rank + ' is missing card_name or card_reason, so it cannot be rendered verbatim.');
    }
  }
  // Without a scene direction the image model falls back to a generic flat
  // infographic, which is a visible quality regression on this channel.
  if (!clean(value.visual_mood_hint)) {
    throw new Error('PREPARED_CARD_PACK_INVALID: visual_mood_hint is required so the card gets a real scene, material and palette instead of a default flat layout.');
  }
  return {
    hook_title: title,
    subtitle: clean(value.subtitle),
    visual_mood_hint: clean(value.visual_mood_hint),
    visual_profile: clean(value.visual_profile),
    rank_items: items,
    video_script: clean(value.video_script),
    description: String(value.description || '').trim(),
    pinned_comment: String(value.pinned_comment || '').trim(),
    tags: (Array.isArray(value.tags) ? value.tags : []).map(clean).filter(Boolean),
    bgm_prompt: clean(value.bgm_prompt),
    medical_claims: (Array.isArray(value.medical_claims) ? value.medical_claims : []).map(clean).filter(Boolean),
    safety_notes: (Array.isArray(value.safety_notes) ? value.safety_notes : []).map(clean).filter(Boolean),
  };
}
const preparedCardPack = normalizePreparedCardPack(
  cfg.prepared_card_pack ||
  cfg.topic_queue?.selected?.final_pack ||
  queuedSpec?.final_pack ||
  null,
);
// Research is a fact-check, not the topic source. Forcing every item to cite a
// paper pulled the topics into clinical territory and cost the channel its
// accessibility, so a research pack is used when supplied and never required.
const researchRequired = cfg.require_research_source_pack === true && !cfg.dry_run && !cfg.test_mode;
if (researchRequired && !researchGrounded && !preparedCardPack) {
  throw new Error('RESEARCH_SOURCE_REQUIRED: require_research_source_pack was explicitly turned on but no usable research_source_pack was supplied.');
}
// RESEARCH_SOURCE_PACK_V1_END

`;

function compactPrompt(target) {
  return researchResolverBlock + `const editorialFlowVersion = 'single_writer_v1';
const prompt = [
  'You are the sole editorial writer for the Korean YouTube Shorts channel ${target.channel}.',
  'Create one complete, coherent editorial pack. You alone own the topic, hook title, subtitle, every ranked item, every explanation, video script, upload description, pinned comment, visual mood, and BGM direction.',
  'Audience and channel: ${target.audience}. Use natural, respectful conversational Korean 해요체 that an ordinary viewer can understand on the first read. Do not use 합니다체 or sentence endings such as 입니다, 합니다, 됩니다, or 습니다 in viewer-facing copy.',
  'CHANNEL_IDENTITY_V1: ${target.profile.purpose}',
  'Channel boundary: ${target.profile.boundary}',
  'Selected channel pillar: ' + selectedChannelPillar.title + ' (' + selectedChannelPillar.id + '). The selected broad pillar is not a narrow micro-topic. Vary the medical question, body mechanism, decision, and practical situation within it, and do not make a slightly reworded version of any recent title.',
  'Choose one useful topic with a clear promise. The title and list scope must match semantically: every item must actually fulfill the title claim, not merely relate to the same general subject. A broad title needs diverse pillars; a narrow title may keep all items inside one theme. Never use a broad longevity title for five near-duplicate walking tips.',
  'Treat the selected lane and candidates as inspiration, not commands. If they conflict, are repetitive, or would create filler, choose the most coherent safe topic instead.',
  usableQueuedSpec ? 'A queued topic is the primary source. Preserve its factual intent and details, but write the complete pack naturally: ' + JSON.stringify(usableQueuedSpec) : '',
  !usableQueuedSpec ? 'Suggested lane: ' + selectedLane.title + '. Suggested category: ' + selectedTopicCategory + '.' : '',
  !usableQueuedSpec ? 'Possible source ideas: ' + JSON.stringify(topic_candidates.slice(0, 10)) : '',
  recentTitles.length ? 'Avoid closely repeating these recent titles: ' + recentTitles.slice(0, 12).join(' / ') : '',
  researchGrounded ? ${JSON.stringify(researchGroundingContract)} : '',
  researchGrounded ? ${JSON.stringify(sourceSelectionContract(target))} : '',
  researchGrounded ? 'research_source_pack: ' + JSON.stringify(researchSourcePack) : '',
  ${JSON.stringify(editorialRules)},
  ${JSON.stringify(clearKoreanCopyContract)},
  ${JSON.stringify(titleScopeContract)},
  ${JSON.stringify(attentionPromiseContract(target))},
  ${JSON.stringify(claimStrengthContract)},
  ${JSON.stringify(decisionDetailContract)},
  'Before writing, internally compare candidate claims and keep only established high-confidence facts. Do not expose private reasoning, invent citations, or use scientific-sounding detail as decoration.',
  'CLINICAL_DEPTH_V1: Every ranked item must carry a real consequence the viewer can act on or notice, not vague encouragement. That consequence may be physiological, clinical, nutritional, medication-related, or a signal to interpret — and it may equally be a household, appliance, grocery, money, errand, or family consequence, which counts as full depth rather than filler. The channel covers the whole life of an adult over 50, so do not narrow topics to what a clinic would hand out and do not treat a non-medical subject as shallow. What fails this bar is an item that teaches nothing usable: a slogan, a restatement of common knowledge, or generic self-care.',
  'Each ranked item must add a genuinely different medically useful point and at least two linked elements: a credible body mechanism or clinically relevant signal, plus who or when it matters, an observable condition, a practical action, or a meaningful boundary. Avoid generic slogans and obvious filler. Write reason as the complete practical cause-and-effect explanation with all facts needed for accuracy. Do not fabricate exact minutes, repetitions, percentages, thresholds, or measurements merely to sound scientific; keep a number only when it is well-established, necessary, and safe. Write card_name as an image label in common everyday Korean, at most 30 Korean characters, without obscure terms. Write card_reason as one independent 해요체 sentence for the image, at most 60 Korean characters, preserving the most useful mechanism, signal, or decision. PLAIN_MEANING_V1: clarity outranks brevity — never trim a line until a first-time reader cannot tell what it refers to. card_reason must stand on its own without card_name: name the actual thing instead of leaning on 그것, 이때, 이렇게, or a comparative with nothing to compare to, and spend the extra characters when the shorter wording loses the subject, the object, or what actually happens. Short but vague is a defect. NO_FIGURATIVE_COPY_V1: state things directly — no metaphor, simile, analogy, or roundabout phrasing that makes the viewer infer the point; name the actual object, the actual action, and the actual consequence. KOREAN_VOICE_V1: write Korean somebody would speak, not English carried across into Korean words. Drop the subject when the situation already makes it obvious, the way a Korean speaker does — 두 식구가 큰 통을 다 쓰기 전에 냄새가 변해요 should be 큰 통은 다 쓰기도 전에 냄새부터 변해요. Do not let an inanimate thing drive a transitive verb: 소음이 말소리를 덮어요 is English word order, and Korean says 소음 때문에 말이 안 들려요. Do not bend every ranked line into the same sentence shape, especially the if-then 조건절; mix in 대조 with ~는데 or ~지만, plain statements, cause with ~어서, and endings such as 거든요 or 잖아요 so the list does not scan identically line after line. Prefer an active verb over stacked passives and causatives. Read each line aloud in your head and keep it only if a Korean speaker would say it that way to a neighbour. TITLE_SPOKEN_KOREAN_V1: the same voice rules govern hook_title and subtitle, and the commonest title failure is the bookish metaphor — an abstract noun driven by a figurative transitive verb, as in 결과를 흔드는 실수, 건강을 깎는 습관, or 노후를 지키는 선택. Nobody says those sentences out loud. Name the actual effect instead: 결과를 흔드는 실수 becomes 혈압이 다르게 나오는 이유, 건강을 깎는 becomes 몸이 상하는. Before accepting any title, say it aloud in your head as one neighbour warning another; if it only works as printed copy, rewrite it. Never put 왜:, 이유:, 핵심:, or TIP: in card_reason. Write 5 ranked items by default. Use 6 or 7 when the researched facts genuinely support that many distinct points, and drop to 4 only when a fifth item would be filler. Never go below 4.',
  'Write description and pinned_comment as finished upload copy, not placeholders. Format description for easy scanning under 650 Korean characters: 1-2 short opening sentences, a blank line, a numbered list with one concise line per ranked item, another blank line, one calm closing sentence, then 3-5 relevant hashtags on the final line. Use the exact item order and preserve essential facts, but do not repeat every full explanation. Never make description one dense paragraph. In the upload description, do not add generic subscribe/like requests or visible medical disclaimers. Write pinned_comment as a short useful summary of the exact video, not a viewer question, and keep it under 260 Korean characters.',
  ${JSON.stringify(commentSummaryContract(target))},
  'Write bgm_prompt as a short warm acoustic instrumental mood direction for this exact video. Choose a fitting feel such as reflective, hopeful, reassuring, restorative, or gently lively instead of forcing the same mood every time. If naming instruments, use only felt piano, gentle acoustic piano, nylon acoustic guitar, or soft bowed strings. No synth, pad, ambient wash, breathy texture, percussion, drums, brushes, marimba, mallets, electronic or fusion sounds. No singing, lyrics, speech, humming, chanting, choir, ooh/aah, vocal chops, wordless vocals, or any human voice.',
  'Return strict JSON only with this schema: ' + JSON.stringify(schema),
].filter(Boolean).join('\\n\\n');`;
}

function channelProfileBlock(target) {
  return `const channelEditorialProfileMarker = 'CHANNEL_EDITORIAL_PROFILE_V1';
const channelEditorialProfile = ${JSON.stringify(target.profile, null, 2)};
if (channelEditorialProfile.pillars.length < 5) throw new Error('channel editorial profile requires at least five broad pillars');
const channelAllowedLaneIds = new Set(channelEditorialProfile.pillars.map((pillar) => pillar.lane));
const channelIdentityTerms = [...new Set(channelEditorialProfile.pillars.flatMap((pillar) => pillar.keywords || []))];
function channelPillarForTitle(value) {
  const title = clean(value);
  const scored = channelEditorialProfile.pillars.map((pillar) => ({
    pillar,
    score: (pillar.keywords || []).reduce((sum, keyword) => title.includes(keyword) ? sum + [...keyword].length : sum, 0),
  })).filter((entry) => entry.score > 0).sort((left, right) => right.score - left.score);
  return scored[0]?.pillar.id || null;
}
function isChannelConceptCandidate(candidate, title) {
  if (['manual', 'topic_file', 'topic_queue'].includes(clean(candidate?.source))) return true;
  if (channelAllowedLaneIds.has(clean(candidate?.lane))) return true;
  return channelIdentityTerms.some((keyword) => clean(title).includes(keyword));
}
const recentPillarTitleHistory = Array.isArray(cfg.recent_titles_for_pillar_rotation)
  ? cfg.recent_titles_for_pillar_rotation.map(clean).filter(Boolean)
  : recentTitles;
const recentChannelPillars = recentPillarTitleHistory.slice(0, 10).map(channelPillarForTitle).filter(Boolean);
const immediateRecentPillars = new Set(recentChannelPillars.slice(0, 2));
const recentPillarCounts = recentChannelPillars.reduce((counts, pillarId) => {
  counts[pillarId] = (counts[pillarId] || 0) + 1;
  return counts;
}, {});
const categoryEligiblePillars = channelEditorialProfile.pillars.filter((pillar) => {
  const category = categoryForLane(pillar.lane);
  if (topicCategoryCooldown.forced_category) return category === topicCategoryCooldown.forced_category;
  return !topicCategoryCooldown.blocked_categories.includes(category);
});
const cooldownEligiblePillars = categoryEligiblePillars.filter((pillar) =>
  !immediateRecentPillars.has(pillar.id) && (recentPillarCounts[pillar.id] || 0) < 2
);
const nonImmediatePillars = categoryEligiblePillars.filter((pillar) => !immediateRecentPillars.has(pillar.id));
const broadPillarPool = cooldownEligiblePillars.length
  ? cooldownEligiblePillars
  : (nonImmediatePillars.length ? nonImmediatePillars : (categoryEligiblePillars.length ? categoryEligiblePillars : channelEditorialProfile.pillars));
const requestedPillar = findById(channelEditorialProfile.pillars, cfg.channel_pillar_override);
const suppliedTopic = Array.isArray(cfg.topic_candidates) ? cfg.topic_candidates[0] : null;
const suppliedTopicTitle = typeof suppliedTopic === 'string'
  ? suppliedTopic
  : clean(suppliedTopic?.title || suppliedTopic?.topic || suppliedTopic?.name);
const suppliedTopicPillar = findById(channelEditorialProfile.pillars, channelPillarForTitle(suppliedTopicTitle));
const requestedLanePillars = clean(cfg.content_lane_override)
  ? broadPillarPool.filter((pillar) => pillar.lane === clean(cfg.content_lane_override))
  : [];
const selectedChannelPillar = requestedPillar || suppliedTopicPillar || pick(
  requestedLanePillars.length ? requestedLanePillars : broadPillarPool,
  'channel_pillar|' + recentChannelPillars.join(',') + '|' + recentPillarTitleHistory.slice(0, 10).join('|'),
);`;
}

const publishedLedgerPaths = [
  'C:/dev/n8n-youtube-shorts-automation/하루건강약사 소재/기록/업로드기록.jsonl',
  'C:/dev/n8n-youtube-shorts-automation/건강장수비결 소재/기록/업로드기록.jsonl',
];

function patchTopicDuplicateGuard(code, target) {
  code = code.replace(/\/\/ TOPIC_DUPLICATE_GUARD_V1_BEGIN[\s\S]*?\/\/ TOPIC_DUPLICATE_GUARD_V1_END\n/, '');
  const block = `// TOPIC_DUPLICATE_GUARD_V1_BEGIN
// A topic already published on either channel must never be queued again.
// Everything here reads local files only, so it costs nothing and runs before
// any paid generation.
const PUBLISHED_LEDGER_PATHS = ${JSON.stringify(publishedLedgerPaths, null, 2).replace(/\n/g, '\n')};

function dupNormalize(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim().toLowerCase()
    .replace(/top\\s*\\d+/gi, ' ')
    .replace(/[0-9０-９]+\\s*(?:가지|개|위|선|순위|top)?/gi, ' ')
    .replace(/[ㄱ-ㅎㅏ-ㅣ]/g, ' ')
    .replace(/[^a-z0-9가-힣]+/gi, ' ')
    .replace(/\\s+/g, '');
}

function dupGrams(value, size = 3) {
  const text = dupNormalize(value);
  if (text.length <= size) return text ? [text] : [];
  const grams = [];
  for (let index = 0; index <= text.length - size; index += 1) grams.push(text.slice(index, index + size));
  return grams;
}

function dupSimilarity(left, right) {
  const a = new Set(dupGrams(left));
  const b = new Set(dupGrams(right));
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

function dupTokens(value) {
  return String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase()
    .replace(/top\\s*\\d+/gi, ' ')
    .replace(/[0-9０-９]+\\s*(?:가지|개|위|선|순위|top)?/gi, ' ')
    .replace(/[^a-z0-9가-힣]+/gi, ' ')
    .split(/\\s+/)
    .map((token) => token.replace(/(에서|으로|부터|까지|처럼|만큼|보다|에게|한테|께|은|는|이|가|을|를|만|도|과|와|의|에|로)$/g, ''))
    .filter((token) => token.length >= 2);
}

function dupTokenOverlap(left, right) {
  const a = new Set(dupTokens(left));
  const b = new Set(dupTokens(right));
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

function loadPublishedLedger(paths) {
  const titles = [];
  const topicKeys = new Set();
  for (const filePath of paths) {
    try {
      if (!filePath || !fs.existsSync(filePath)) continue;
      for (const line of fs.readFileSync(filePath, 'utf8').split(/\\r?\\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let row = null;
        try { row = JSON.parse(trimmed); } catch (error) { continue; }
        if (!row || !row.url) continue;
        const title = cleanString(row.title);
        if (title) titles.push(title);
        const key = cleanString(row.topic_key);
        if (key) topicKeys.add(key.toLowerCase());
      }
    } catch (error) { continue; }
  }
  return { titles, topicKeys };
}

function findPublishedConflict(spec, ledger) {
  const key = cleanString(spec?.topic_key || spec?.final_pack?.topic_key).toLowerCase();
  if (key && ledger.topicKeys.has(key)) {
    return { kind: 'topic_key', matched: key };
  }
  const title = cleanString(spec?.final_pack?.hook_title || spec?.title);
  if (!title) return null;
  for (const published of ledger.titles) {
    const normalized = dupNormalize(title);
    const publishedKey = dupNormalize(published);
    if (!normalized || !publishedKey) continue;
    if (normalized === publishedKey || normalized.includes(publishedKey) || publishedKey.includes(normalized)) {
      return { kind: 'title_contains', matched: published };
    }
    if (dupTokenOverlap(title, published) >= 0.48) return { kind: 'title_tokens', matched: published };
    if (dupSimilarity(normalized, publishedKey) >= 0.58) return { kind: 'title_similarity', matched: published };
  }
  return null;
}
// TOPIC_DUPLICATE_GUARD_V1_END
`;
  code = replacePatternRequired(
    code,
    /^function loadTopicQueue\(\{/m,
    block + '$&',
    `${target.id}: topic duplicate guard`,
  );

  // Normalise any previously injected picker back to the stock shape first, so this
  // patch produces the same result whether it runs on pristine or already-patched code.
  const stockPicker = `    const files = listPendingFiles(pendingDir);
    result.remaining_before = files.length;
    if (files.length) {
      const picked = files[0];
      const spec = parseTopicFile(picked.filePath);
      if (!spec) throw new Error('Could not parse topic file: ' + picked.filePath);
`;
  code = code.replace(
    /    const files = listPendingFiles\(pendingDir\);\n    result\.remaining_before = files\.length;\n    const ledger = loadPublishedLedger\(PUBLISHED_LEDGER_PATHS\);\n[\s\S]*?\n    if \((?:pickedFile|picked)\) \{\n(?:      const picked = pickedFile;\n      const spec = pickedSpec;\n)?/,
    stockPicker,
  );

  // Pick the first topic that is not already published instead of blindly taking files[0].
  code = code.replace(
    /    const files = listPendingFiles\(pendingDir\);\n    result\.remaining_before = files\.length;\n    if \(files\.length\) \{\n      const picked = files\[0\];\n      const spec = parseTopicFile\(picked\.filePath\);\n      if \(!spec\) throw new Error\('Could not parse topic file: ' \+ picked\.filePath\);\n/,
    `    const files = listPendingFiles(pendingDir);
    result.remaining_before = files.length;
    const ledger = loadPublishedLedger(PUBLISHED_LEDGER_PATHS);
    let pickedFile = null;
    let pickedSpec = null;
    for (const candidate of files) {
      const candidateSpec = parseTopicFile(candidate.filePath);
      if (!candidateSpec) throw new Error('Could not parse topic file: ' + candidate.filePath);
      const conflict = findPublishedConflict(candidateSpec, ledger);
      if (conflict) {
        result.skipped_duplicates.push({
          file: candidate.filePath,
          title: candidateSpec.final_pack?.hook_title || candidateSpec.title,
          topic_key: candidateSpec.topic_key || null,
          conflict_kind: conflict.kind,
          conflicts_with: conflict.matched,
        });
        continue;
      }
      pickedFile = candidate;
      pickedSpec = candidateSpec;
      break;
    }
    if (files.length && !pickedFile) {
      result.all_pending_are_duplicates = true;
    }
    if (pickedFile) {
      const picked = pickedFile;
      const spec = pickedSpec;
`,
  );
  code = code.replace(
    "      result.remaining_after = Math.max(0, files.length - (result.consumed ? 1 : 0));\n      return result;\n    }",
    "      result.remaining_after = Math.max(0, files.length - result.skipped_duplicates.length - (result.consumed ? 1 : 0));\n      return result;\n    }",
  );
  if (!code.includes('skipped_duplicates: [],')) {
    code = replaceRequired(
      code,
      '    remaining_before: 0,\n    remaining_after: 0,',
      '    remaining_before: 0,\n    remaining_after: 0,\n    skipped_duplicates: [],\n    all_pending_are_duplicates: false,',
      `${target.id}: duplicate skip report`,
    );
  }
  return code;
}

function patchLoadConfig(code, target) {
  code = code.replace('return uniqueStrings(titles);', 'return titles;');
  code = patchTopicDuplicateGuard(code, target);
  if (!code.includes('research_source_pack: value.research_source_pack')) {
    code = replaceRequired(
      code,
      "    source_format: value.source_format || (sourceFile ? 'topic_file' : 'manual'),\n  };",
      "    source_format: value.source_format || (sourceFile ? 'topic_file' : 'manual'),\n    research_source_pack: value.research_source_pack || value.research_pack || null,\n  };",
      `${target.id}: topic-file research source pack passthrough`,
    );
  }
  if (!code.includes('final_pack: value.final_pack')) {
    code = replaceRequired(
      code,
      '    research_source_pack: value.research_source_pack || value.research_pack || null,\n  };',
      '    research_source_pack: value.research_source_pack || value.research_pack || null,\n    final_pack: value.final_pack || null,\n  };',
      `${target.id}: topic-file prepared pack passthrough`,
    );
  }
  code = code
    .replace(/rank_count_min: Number\(incoming\.rank_count_min \|\| \d+\)/, 'rank_count_min: Number(incoming.rank_count_min || 4)')
    .replace(/rank_count_max: Number\(incoming\.rank_count_max \|\| \d+\)/, 'rank_count_max: Number(incoming.rank_count_max || 7)');
  if (!code.includes('require_research_source_pack:')) {
    code = replaceRequired(
      code,
      '  medical_review_max_retries: Number(incoming.medical_review_max_retries || 2),',
      '  medical_review_max_retries: Number(incoming.medical_review_max_retries || 2),\n  require_research_source_pack: bool(incoming.require_research_source_pack, false),\n  research_source_pack: incoming.research_source_pack || null,',
      `${target.id}: research source config`,
    );
  }
  // Research stays opt-in: an older install seeded this default as true, which
  // made every live run without a research pack throw RESEARCH_SOURCE_REQUIRED.
  code = code.replace(
    'require_research_source_pack: bool(incoming.require_research_source_pack, true),',
    'require_research_source_pack: bool(incoming.require_research_source_pack, false),',
  );
  if (!code.includes('prepared_card_pack: incoming.prepared_card_pack')) {
    code = replaceRequired(
      code,
      '  research_source_pack: incoming.research_source_pack || null,',
      '  research_source_pack: incoming.research_source_pack || null,',
      `${target.id}: prepared card pack config`,
    );
  }
  if (!code.includes('config.research_source_pack = config.research_source_pack')) {
    code = replaceRequired(
      code,
      'if (topicQueue.selected) {\n  config.topic_candidates = [topicQueue.selected, ...config.topic_candidates];\n}',
      'if (topicQueue.selected) {\n  config.topic_candidates = [topicQueue.selected, ...config.topic_candidates];\n}\nconfig.research_source_pack = config.research_source_pack || topicQueue.selected?.research_source_pack || null;',
      `${target.id}: research source queue wiring`,
    );
  }
  if (!code.includes('config.prepared_card_pack = config.prepared_card_pack')) {
    code = replaceRequired(
      code,
      'config.research_source_pack = config.research_source_pack || topicQueue.selected?.research_source_pack || null;',
      'config.research_source_pack = config.research_source_pack || topicQueue.selected?.research_source_pack || null;\nconfig.prepared_card_pack = config.prepared_card_pack || topicQueue.selected?.final_pack || null;',
      `${target.id}: prepared card pack queue wiring`,
    );
  }
  if (!code.includes('function loadRecentBgmProfileHistory(')) {
    code = replaceRequired(
      code,
      '\nfunction slug(value) {',
      `
function loadRecentBgmProfileHistory(filePath, limit = 8) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return [];
    const profiles = fs.readFileSync(filePath, 'utf8')
      .split(/\\r?\\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch (error) { return null; }
      })
      .filter(Boolean)
      .reverse()
      .map((row) => cleanString(row.bgm_profile_id || row.bgm_profile?.id))
      .filter(Boolean);
    return uniqueStrings(profiles).slice(0, limit);
  } catch (error) {
    return [];
  }
}

function slug(value) {`,
      `${target.id}: recent BGM history loader`,
    );
  }
  if (!code.includes('config.recent_bgm_profiles =')) {
    code = replaceRequired(
      code,
      'const uploadLogRecentTitles = loadRecentTitleHistory(config.upload_log_path, Number(incoming.recent_title_history_limit || 100));',
      `const uploadLogRecentTitles = loadRecentTitleHistory(config.upload_log_path, Number(incoming.recent_title_history_limit || 100));
const incomingRecentBgmProfiles = list(incoming.recent_bgm_profiles || incoming.previous_bgm_profiles);
const uploadLogRecentBgmProfiles = loadRecentBgmProfileHistory(config.upload_log_path, Number(incoming.recent_bgm_history_limit || 8));
config.recent_bgm_profiles = uniqueStrings([
  ...incomingRecentBgmProfiles,
  ...uploadLogRecentBgmProfiles,
]).slice(0, Number(incoming.recent_bgm_history_limit || 8));`,
      `${target.id}: recent BGM profile config`,
    );
  }
  if (!code.includes('config.recent_titles_for_pillar_rotation =')) {
    code = replaceRequired(
      code,
      'config.recent_titles = uniqueStrings([\n',
      `config.recent_titles_for_pillar_rotation = [
  ...incomingRecentTitles,
  ...uploadLogRecentTitles,
  ...topicLogRecentTitles,
].map(cleanString).filter(Boolean).slice(0, Number(incoming.recent_title_history_limit || 160));
config.recent_titles = uniqueStrings([\n`,
      `${target.id}: raw recent-title history`,
    );
  }
  code = code
    .replace(/^\s*channel_name:\s*[^\n]+\n?/gm, '')
    .replace(/^\s*channel_editorial_profile:\s*[^\n]+\n?/gm, '')
    .replace(/^\s*channel_pillar_override:\s*[^\n]+\n?/gm, '');
  return replaceRequired(
    code,
    'const config = {\n',
    `const config = {\n  channel_name: '${target.channel}',\n  channel_editorial_profile: '${target.profile.id}',\n  channel_pillar_override: cleanString(incoming.channel_pillar || incoming.channel_pillar_override),\n`,
    `${target.id}: channel config`,
  );
}

function patchUploadIdempotency(code, target) {
  code = code.replace(/\/\/ ALREADY_UPLOADED_GUARD_V1_BEGIN[\s\S]*?\/\/ ALREADY_UPLOADED_GUARD_V1_END\n/, '');
  code = code.replace(
    /if \(alreadyUploaded\) \{\n  uploadGuard = \{ \.\.\.uploadGuard, acquired: false, reason: 'already_uploaded', already_uploaded: alreadyUploaded \};\n\} else \{\n  tryAcquire\(\);\n\}/,
    'tryAcquire();',
  );
  code = code.replace(', upload_guard: uploadGuard, already_uploaded: alreadyUploaded }', ', upload_guard: uploadGuard }');
  const block = `// ALREADY_UPLOADED_GUARD_V1_BEGIN
function findAlreadyUploaded() {
  const title = String(base.pack?.hook_title || '').replace(/\\s+/g, ' ').trim();
  const logPath = String(cfg.upload_log_path || '').trim();
  if (!title || !logPath) return null;
  try {
    if (!fs.existsSync(logPath)) return null;
    const rows = fs.readFileSync(logPath, 'utf8').split(/\\r?\\n/).map((line) => line.trim()).filter(Boolean);
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      let row = null;
      try { row = JSON.parse(rows[index]); } catch (error) { continue; }
      const rowTitle = String(row?.title || '').replace(/\\s+/g, ' ').trim();
      if (rowTitle && rowTitle === title && row?.url) {
        return { url: row.url, video_id: row.video_id || null, uploaded_at: row.uploaded_at || null, matched_title: rowTitle };
      }
    }
  } catch (error) {
    return null;
  }
  return null;
}
const alreadyUploaded = guardEnabled ? findAlreadyUploaded() : null;
// ALREADY_UPLOADED_GUARD_V1_END
`;
  code = replacePatternRequired(
    code,
    /^tryAcquire\(\);$/m,
    block + `if (alreadyUploaded) {
  uploadGuard = { ...uploadGuard, acquired: false, reason: 'already_uploaded', already_uploaded: alreadyUploaded };
} else {
  tryAcquire();
}`,
    `${target.id}: already-uploaded guard`,
  );
  return replaceRequired(
    code,
    ', upload_guard: uploadGuard }',
    ', upload_guard: uploadGuard, already_uploaded: alreadyUploaded }',
    `${target.id}: already-uploaded guard output`,
  );
}

function patchSkipUploadReason(code, target) {
  if (code.includes("already_uploaded")) return code;
  return replaceRequired(
    code,
    "if (data.upload_guard?.reason === 'overlapping_upload_in_progress') {",
    `if (data.upload_guard?.reason === 'already_uploaded') {
  return [{ json: { ...data, result_stage: 'skipped_already_uploaded', youtube: { skipped: true, reason: 'already_uploaded', existing_url: data.upload_guard?.already_uploaded?.url || null }, comment: { skipped: true, reason: 'Already uploaded in an earlier run' } } }];
}
if (data.upload_guard?.reason === 'overlapping_upload_in_progress') {`,
    `${target.id}: already-uploaded skip branch`,
  );
}

function patchFinalResultConsumeGate(code, target) {
  if (code.includes('const alreadyUploadedRecovery =')) return code;
  return replaceRequired(
    code,
    '  const youtube = data.youtube || {};\n  if (!youtube.url || youtube.skipped) return;',
    `  const youtube = data.youtube || {};
  // A run that was skipped because this exact topic was already published in an
  // earlier run must still release the topic, or the queue would retry it forever.
  const alreadyUploadedRecovery = data.upload_guard?.reason === 'already_uploaded'
    ? (data.upload_guard?.already_uploaded || null)
    : null;
  const publishedUrl = youtube.url && !youtube.skipped ? youtube.url : (alreadyUploadedRecovery?.url || null);
  if (!publishedUrl) return;`,
    `${target.id}: consume gate recovery`,
  ).replace(
    /(\n      consumed_file: destination,[\s\S]*?)\n      url: youtube\.url,/,
    '$1\n      url: publishedUrl,',
  );
}

function patchFinalResult(code, target) {
  if (code.includes('bgm_profile_id: data.diversity?.bgm_profile?.id || null')) return code;
  return replaceRequired(
    code,
    '    video_id: youtube.video_id || null,\n    topic_queue:',
    "    video_id: youtube.video_id || null,\n    topic_key: data.topic_key || data.config?.topic_queue?.selected?.topic_key || data.prepared_card_pack?.topic_key || null,\n    bgm_profile_id: data.diversity?.bgm_profile?.id || null,\n    bgm_profile_title: data.diversity?.bgm_profile?.title || null,\n    topic_queue:",
    `${target.id}: upload log BGM profile`,
  );
}

function patchRankCountTarget(code, target) {
  code = code.replace(/const rankCountMax = Number\(cfg\.rank_count_max \|\| \d+\);/, 'const rankCountMax = Number(cfg.rank_count_max || 7);');
  code = code.replace(/const rankCountMin = Number\(cfg\.rank_count_min \|\| \d+\);/, 'const rankCountMin = Number(cfg.rank_count_min || 4);');
  return replacePatternRequired(
    code,
    /: '- Choose the (?:strongest )?ranking count between ' \+ rankCountMin \+ ' and ' \+ rankCountMax \+ '\.[^']*';/,
    ": '- Choose the ranking count between ' + rankCountMin + ' and ' + rankCountMax + '. Default to 5 items. Use 6 or 7 only when the researched facts genuinely support that many distinct points, and drop to 4 only when a fifth item would be filler. Do not add filler items just to make the list longer.';",
    `${target.id}: rank count target`,
  );
}

function patchResearchGrounding(code, target) {
  code = code.replace(/\/\/ RESEARCH_SOURCE_PACK_V1_BEGIN[\s\S]*?\/\/ RESEARCH_SOURCE_PACK_V1_END\n\n/, '');
  code = code.replace(/^\s*researchGrounded \? [^\n]+\n/gm, '');
  code = code.replace(/^\s*"(?:EVERYDAY_LANGUAGE_V\d+|EVERYDAY_TOPIC_ANGLE_V\d+):[^\n]+\n/gm, '');
  code = replacePatternRequired(
    code,
    /^const editorialFlowVersion = 'single_writer_v1';$/m,
    researchResolverBlock + "const editorialFlowVersion = 'single_writer_v1';",
    `${target.id}: research source resolver`,
  );
  code = replacePatternRequired(
    code,
    /^\s*"Editorial rules: use common everyday Korean[^\n]+$/m,
    `  ${JSON.stringify(everydayLanguageContract)},\n  ${JSON.stringify(everydayTopicAngleContract)},\n  researchGrounded ? ${JSON.stringify(researchGroundingContract)} : '',\n  researchGrounded ? ${JSON.stringify(sourceSelectionContract(target))} : '',\n  researchGrounded ? 'research_source_pack: ' + JSON.stringify(researchSourcePack) : '',\n$&`,
    `${target.id}: research grounding prompt`,
  );
  code = code.replace(
    /rank_items: \[\n?\s*\{ rank: 1, (?:fact_id: [^\n]*?source_ids: \[[^\]]*\], )?name: '항목명',/,
    "rank_items: [\n    { rank: 1, fact_id: 'research_source_pack candidate_fact id this item is written from; required whenever a research_source_pack is supplied', source_ids: ['source ids cited by that fact'], name: '항목명',",
  );
  code = code.replace(
    /return \[\{ json: \{ \.\.\.base, (?:config: preparedCardPack [^,]+, [^,]+, prepared_card_pack: preparedCardPack, )?(?:research_source_pack: researchSourcePack, research_grounded: researchGrounded, )?channel_editorial_profile: channelEditorialProfile,/,
    'return [{ json: { ...base, config: preparedCardPack ? { ...cfg, use_live_kie_ai: false } : cfg, prepared_card_pack: preparedCardPack, research_source_pack: researchSourcePack, research_grounded: researchGrounded, channel_editorial_profile: channelEditorialProfile,',
  );
  if (!code.includes('prepared_card_pack: preparedCardPack')) {
    throw new Error(`${target.id}: prepared card pack output anchor missing`);
  }
  return code;
}

function patchBuild(code, target) {
  if (!code.includes("const editorialFlowVersion = 'single_writer_v1';")) {
    code = replaceBetween(code, 'const prompt = [', "].filter(Boolean).join('\\n\\n');", compactPrompt(target), 'generation prompt');
  }
  const profileStart = code.includes("const channelEditorialProfileMarker = 'CHANNEL_EDITORIAL_PROFILE_V1';")
    ? "const channelEditorialProfileMarker = 'CHANNEL_EDITORIAL_PROFILE_V1';"
    : 'const channelAllowedLaneIds = new Set([';
  code = replaceBetween(
    code,
    profileStart,
    'const eligibleContentLanes =',
    channelProfileBlock(target) + '\nconst eligibleContentLanes =',
    `${target.id}: channel editorial profile`,
  );
  code = replaceBetween(
    code,
    'const lanePool = eligibleContentLanes.length',
    'const selectedTopicCategory =',
    `const lanePool = eligibleContentLanes.length ? eligibleContentLanes : contentLanes.filter((lane) => channelAllowedLaneIds.has(lane.id));
const selectedLane =
  findById(contentLanes, cfg.content_lane_override) ||
  findById(contentLanes, selectedChannelPillar.lane) ||
  pick(lanePool, 'content_lane|' + selectedChannelPillar.id + '|' + topicCategoryCooldown.blocked_categories.join(','));
const selectedTopicCategory =`,
    `${target.id}: channel pillar lane selection`,
  );
  const topicPoolStart = code.includes('const channelTopicPool = [...channelEditorialProfile.topic_pool]')
    ? 'const channelTopicPool = [...channelEditorialProfile.topic_pool]'
    : 'const laneCandidates = evergreenPool';
  code = replaceBetween(
    code,
    topicPoolStart,
    '.slice(0, 16);',
    `const channelTopicPool = [...channelEditorialProfile.topic_pool]
  .sort((left, right) => Number(right.pillar === selectedChannelPillar.id) - Number(left.pillar === selectedChannelPillar.id));
const laneCandidates = channelTopicPool
  .map((entry, index) => ({
    title: entry.title,
    source: entry.pillar === selectedChannelPillar.id ? 'channel_selected_pillar' : 'channel_cross_pillar',
    lane: entry.lane,
    pillar: entry.pillar,
    score: (entry.pillar === selectedChannelPillar.id ? 128 : 72) - index / 100,
    category: categoryForTitle(entry.title) || categoryForLane(entry.lane),
  }))
  .slice(0, 16);`,
    `${target.id}: channel topic pool`,
  );
  if (!code.includes('const topic_candidates = [...manual, ...laneCandidates, ...rss, ...referenceViral]')) {
    code = replaceRequired(
      code,
      'const topic_candidates = [...manual, ...referenceViral, ...rss, ...laneCandidates].filter((candidate) => {',
      'const topic_candidates = [...manual, ...laneCandidates, ...rss, ...referenceViral].filter((candidate) => {',
      `${target.id}: channel candidate priority`,
    );
  }
  if (!code.includes('channel_editorial_profile: channelEditorialProfile.id,')) {
    code = replaceRequired(
      code,
      'const schema = {\n',
      'const schema = {\n  channel_editorial_profile: channelEditorialProfile.id,\n  channel_content_pillar: selectedChannelPillar.id,\n',
      `${target.id}: channel schema`,
    );
  }
  if (!code.includes('selected_channel_pillar: selectedChannelPillar')) {
    code = replaceRequired(
      code,
      'return [{ json: { ...base, selected_content_lane: selectedLane, topic_candidates,',
      'return [{ json: { ...base, channel_editorial_profile: channelEditorialProfile, selected_channel_pillar: selectedChannelPillar, selected_content_lane: selectedLane, topic_candidates,',
      `${target.id}: selected channel pillar output`,
    );
  }
  if (!code.includes('recent_channel_pillars: recentChannelPillars')) {
    code = replaceRequired(
      code,
      'channel_editorial_profile: channelEditorialProfile, selected_channel_pillar: selectedChannelPillar,',
      'channel_editorial_profile: channelEditorialProfile, selected_channel_pillar: selectedChannelPillar, recent_channel_pillars: recentChannelPillars,',
      `${target.id}: recent channel pillar output`,
    );
  }
  code = code
    .replace(/^\s*'CHANNEL_IDENTITY_V1:[^\n]+\n?/gm, '')
    .replace(/^\s*'Channel boundary:[^\n]+\n?/gm, '')
    .replace(/^\s*'Selected channel pillar:[^\n]+\n?/gm, '');
  code = replacePatternRequired(
    code,
    /^\s*'Audience and channel:[^\n]+$/m,
    `  'Audience and channel: ${target.audience}. Use natural, respectful conversational Korean 해요체 that an ordinary viewer can understand on the first read. Do not use 합니다체 or sentence endings such as 입니다, 합니다, 됩니다, or 습니다 in viewer-facing copy.',
  'CHANNEL_IDENTITY_V1: ${target.profile.purpose}',
  'Channel boundary: ${target.profile.boundary}',
  'Selected channel pillar: ' + selectedChannelPillar.title + ' (' + selectedChannelPillar.id + '). The selected broad pillar is not a narrow micro-topic. Vary the medical question, body mechanism, decision, and practical situation within it, and do not make a slightly reworded version of any recent title.',`,
    `${target.id}: channel prompt identity`,
  );
  code = code.replace(/^\s*['\"]COMMENT_(?:VOICE|SUMMARY)_V\d+:[^\n]+\n?/gm, '');
  code = code.replace(/^\s*['\"](?:NATURAL_KOREAN_COPY_V1|FIRST_READ_KOREAN_V1|HUMAN_KOREAN_VOICE_V1|CLEAR_KOREAN_COPY_V2|TITLE_SCOPE_V\d+|ATTENTION_PROMISE_V\d+|CLAIM_STRENGTH_V\d+|DECISION_DETAIL_V\d+):[^\n]+\n?/gm, '');
  code = code.replace(
    /^\s*['\"]Editorial rules:[^\n]+$/gm,
    `  ${JSON.stringify(editorialRules)},\n  ${JSON.stringify(clearKoreanCopyContract)},\n  ${JSON.stringify(titleScopeContract)},\n  ${JSON.stringify(attentionPromiseContract(target))},\n  ${JSON.stringify(claimStrengthContract)},\n  ${JSON.stringify(decisionDetailContract)},`,
  );
  code = code.replace(
    /^\s*'Write description and pinned_comment[^\n]+$/gm,
    "  'Write description and pinned_comment as finished upload copy, not placeholders. Format description for easy scanning under 650 Korean characters: 1-2 short opening sentences, a blank line, a numbered list with one concise line per ranked item, another blank line, one calm closing sentence, then 3-5 relevant hashtags on the final line. Use the exact item order and preserve essential facts, but do not repeat every full explanation. Never make description one dense paragraph. In the upload description, do not add generic subscribe/like requests or visible medical disclaimers. Write pinned_comment as a short useful summary of the exact video, not a viewer question, and keep it under 260 Korean characters.',",
  );
  code = code.replace(
    /^\s*'Write bgm_prompt[^\n]+$/gm,
    "  'Write bgm_prompt as a short warm acoustic instrumental mood direction for this exact video. Choose a fitting feel such as reflective, hopeful, reassuring, restorative, or gently lively instead of forcing the same mood every time. If naming instruments, use only felt piano, gentle acoustic piano, nylon acoustic guitar, or soft bowed strings. No synth, pad, ambient wash, breathy texture, percussion, drums, brushes, marimba, mallets, electronic or fusion sounds. No singing, lyrics, speech, humming, chanting, choir, ooh/aah, vocal chops, wordless vocals, or any human voice.',",
  );
  code = code.replace(
    /^\s*'Before writing, internally compare candidate claims[^\n]+\n?/gm,
    '',
  );
  code = code.replace(
    /^\s*'CLINICAL_DEPTH_V1:[^\n]+\n?/gm,
    '',
  );
  code = code.replace(
    /^\s*'Each ranked item[^\n]+$/gm,
    "  'Before writing, internally compare candidate claims and keep only established high-confidence facts. Do not expose private reasoning, invent citations, or use scientific-sounding detail as decoration.',\n  'CLINICAL_DEPTH_V1: Every ranked item must carry a real consequence the viewer can act on or notice, not vague encouragement. That consequence may be physiological, clinical, nutritional, medication-related, or a signal to interpret — and it may equally be a household, appliance, grocery, money, errand, or family consequence, which counts as full depth rather than filler. The channel covers the whole life of an adult over 50, so do not narrow topics to what a clinic would hand out and do not treat a non-medical subject as shallow. What fails this bar is an item that teaches nothing usable: a slogan, a restatement of common knowledge, or generic self-care.',\n  'Each ranked item must add a genuinely different medically useful point and at least two linked elements: a credible body mechanism or clinically relevant signal, plus who or when it matters, an observable condition, a practical action, or a meaningful boundary. Avoid generic slogans and obvious filler. Write reason as the complete practical cause-and-effect explanation with all facts needed for accuracy. Do not fabricate exact minutes, repetitions, percentages, thresholds, or measurements merely to sound scientific; keep a number only when it is well-established, necessary, and safe. Write card_name as an image label in common everyday Korean, at most 30 Korean characters, without obscure terms. Write card_reason as one independent 해요체 sentence for the image, at most 60 Korean characters, preserving the most useful mechanism, signal, or decision. PLAIN_MEANING_V1: clarity outranks brevity — never trim a line until a first-time reader cannot tell what it refers to. card_reason must stand on its own without card_name: name the actual thing instead of leaning on 그것, 이때, 이렇게, or a comparative with nothing to compare to, and spend the extra characters when the shorter wording loses the subject, the object, or what actually happens. Short but vague is a defect. NO_FIGURATIVE_COPY_V1: state things directly — no metaphor, simile, analogy, or roundabout phrasing that makes the viewer infer the point; name the actual object, the actual action, and the actual consequence. KOREAN_VOICE_V1: write Korean somebody would speak, not English carried across into Korean words. Drop the subject when the situation already makes it obvious, the way a Korean speaker does — 두 식구가 큰 통을 다 쓰기 전에 냄새가 변해요 should be 큰 통은 다 쓰기도 전에 냄새부터 변해요. Do not let an inanimate thing drive a transitive verb: 소음이 말소리를 덮어요 is English word order, and Korean says 소음 때문에 말이 안 들려요. Do not bend every ranked line into the same sentence shape, especially the if-then 조건절; mix in 대조 with ~는데 or ~지만, plain statements, cause with ~어서, and endings such as 거든요 or 잖아요 so the list does not scan identically line after line. Prefer an active verb over stacked passives and causatives. Read each line aloud in your head and keep it only if a Korean speaker would say it that way to a neighbour. TITLE_SPOKEN_KOREAN_V1: the same voice rules govern hook_title and subtitle, and the commonest title failure is the bookish metaphor — an abstract noun driven by a figurative transitive verb, as in 결과를 흔드는 실수, 건강을 깎는 습관, or 노후를 지키는 선택. Nobody says those sentences out loud. Name the actual effect instead: 결과를 흔드는 실수 becomes 혈압이 다르게 나오는 이유, 건강을 깎는 becomes 몸이 상하는. Before accepting any title, say it aloud in your head as one neighbour warning another; if it only works as printed copy, rewrite it. Never put 왜:, 이유:, 핵심:, or TIP: in card_reason. Write 5 ranked items by default. Use 6 or 7 when the researched facts genuinely support that many distinct points, and drop to 4 only when a fifth item would be filler. Never go below 4.',",
  );
  code = code.replace(
    /description: 'finished upload description tailored to this exact video; preserve the same facts and practical nuance',/,
    "description: 'under 650 Korean characters: 1-2 short opening sentences, blank line, numbered item list with one concise line per rank, blank line, one calm closing sentence, then 3-5 relevant hashtags; no dense paragraph, generic engagement request, or visible medical disclaimer',",
  );
  if (!code.includes('const channelAllowedLaneIds = new Set(')) {
    code = replaceRequired(
      code,
      'const eligibleContentLanes = contentLanes.filter((lane) => {',
      `const channelAllowedLaneIds = new Set([
  'daily_health_lifestyle',
  'body_signal_selfcheck',
  'sleep_energy_recovery',
  'movement_mobility_longevity',
  'food_nutrition_table',
]);
const channelHealthTerms = /건강|영양|음식|식사|식품|혈당|당뇨|수면|잠|피로|회복|걷|운동|무릎|허리|관절|몸|신호|약|복용|비타민|피부|활력|소화|장 건강|수분|소금|나트륨|혈압|혈관|노화|면역|눈|손톱|소변|붓기|기력/;
function isChannelConceptCandidate(candidate, title) {
  return channelAllowedLaneIds.has(clean(candidate?.lane)) || channelHealthTerms.test(clean(title));
}
const eligibleContentLanes = contentLanes.filter((lane) => channelAllowedLaneIds.has(lane.id)).filter((lane) => {`,
      `${target.id}: channel lane allowlist`,
    );
    code = replaceRequired(
      code,
      'const lanePool = eligibleContentLanes.length ? eligibleContentLanes : contentLanes;',
      'const lanePool = eligibleContentLanes.length ? eligibleContentLanes : contentLanes.filter((lane) => channelAllowedLaneIds.has(lane.id));',
      `${target.id}: channel lane fallback`,
    );
    code = replaceRequired(
      code,
      'const laneCandidates = evergreenPool\n  .map((entry, index) => ({',
      'const laneCandidates = evergreenPool\n  .filter((entry) => channelAllowedLaneIds.has(entry.lane))\n  .map((entry, index) => ({',
      `${target.id}: evergreen channel filter`,
    );
    code = replaceRequired(
      code,
      "  const key = normalizeDuplicateTitle(title);\n  if (!title || seen.has(key)) return false;",
      "  const key = normalizeDuplicateTitle(title);\n  if (!title || seen.has(key)) return false;\n  if (!isChannelConceptCandidate(candidate, title)) {\n    duplicateTopicCandidates.push({ title, source: candidate.source, lane: candidate.lane, reason: 'channel_concept_candidate_rejected' });\n    return false;\n  }",
      `${target.id}: candidate channel filter`,
    );
  }
  code = code
    .replace('max_tokens: 3200,', 'max_tokens: 6000,')
    .replace(
      'Choose one useful topic with a clear promise. The title and list scope must match: a broad title needs diverse pillars; a narrow title may keep all items inside one theme. Never use a broad longevity title for five near-duplicate walking tips.',
      'Choose one useful topic with a clear promise. The title and list scope must match semantically: every item must actually fulfill the title claim, not merely relate to the same general subject. A broad title needs diverse pillars; a narrow title may keep all items inside one theme. Never use a broad longevity title for five near-duplicate walking tips.',
    )
    .replace(
      'Each ranked item must add a genuinely different point. Explain the practical cause and effect in one easy complete Korean sentence. Keep only as many items as the topic naturally supports, between 3 and 5.',
      'Each ranked item must add a genuinely different point. Explain the practical cause and effect in one easy complete Korean sentence. Write image-ready Korean: concise enough to read on a phone, but preserve any condition, number, medical term, or factual detail needed for accuracy. Do not add mechanical labels such as 왜:, 이유:, 핵심:, or TIP: to every item; the sentence itself should read naturally. Keep only as many items as the topic naturally supports, between 3 and 5.',
    )
    .replace(
      "reason: '18-32 Korean characters: one concrete cause-and-effect sentence', caution: '10-24 Korean characters: one practical action, or empty only when unnecessary'",
      "reason: 'one natural, concrete cause-and-effect sentence; concise for phone reading without a hard character limit; retain essential conditions, numbers, and technical terms', caution: 'optional practical action only when it adds distinct value; otherwise empty; never repeat the reason'",
    )
    .replace(
      "reason: 'one natural, concrete cause-and-effect sentence; concise for phone reading without a hard character limit; retain essential conditions, numbers, and technical terms', caution: 'optional practical action only when it adds distinct value; otherwise empty; never repeat the reason'",
      "reason: 'complete natural cause-and-effect explanation retaining essential conditions, numbers, and technical terms', card_reason: '18-42 Korean characters: one self-contained mobile-card sentence with the single most important cause and result; no 왜:, 이유:, 핵심:, or TIP: prefix', caution: 'optional practical action only when it adds distinct value; otherwise empty; never repeat the reason'",
    )
    .replace(
      "reason: 'complete natural cause-and-effect explanation retaining essential conditions, numbers, and technical terms', card_reason: '18-42 Korean characters: one self-contained mobile-card sentence with the single most important cause and result; no 왜:, 이유:, 핵심:, or TIP: prefix', caution: 'optional practical action only when it adds distinct value; otherwise empty; never repeat the reason'",
      "reason: 'complete 해요체 cause-and-effect explanation with an established body mechanism or clinically relevant signal and a practical decision', card_name: 'at most 22 Korean characters: common everyday Korean image label without jargon or obscure object terms', card_reason: 'at most 40 Korean characters: one self-contained 해요체 sentence with the most useful body mechanism, signal, or medical decision; no 왜:, 이유:, 핵심:, or TIP: prefix', caution: 'optional 해요체 boundary or action only when it adds distinct value; otherwise empty; never repeat the reason'",
    )
    .replace(
      'Each ranked item must add a genuinely different point. Explain the practical cause and effect in one easy complete Korean sentence. Write image-ready Korean: concise enough to read on a phone, but preserve any condition, number, medical term, or factual detail needed for accuracy. Do not add mechanical labels such as 왜:, 이유:, 핵심:, or TIP: to every item; the sentence itself should read naturally. Keep only as many items as the topic naturally supports, between 3 and 5.',
      'Each ranked item must add a genuinely different point. Write reason as the complete practical cause-and-effect explanation with all facts needed for accuracy. Also write card_reason as one independent natural Korean sentence for the image: 18-42 Korean characters, one short line when possible, preserving the single most important cause and result. Never put 왜:, 이유:, 핵심:, or TIP: in card_reason. Write 5 ranked items by default. Use 6 or 7 when the researched facts genuinely support that many distinct points, and drop to 4 only when a fifth item would be filler. Never go below 4.',
    )
    .replace(
      /description: 'Temporary draft only\.[^\n]+',/,
      "description: 'under 650 Korean characters: 1-2 short opening sentences, blank line, numbered item list with one concise line per rank, blank line, one calm closing sentence, then 3-5 relevant hashtags; no dense paragraph, generic engagement request, or visible medical disclaimer',",
    )
    .replace(
      'pinned_comment: ctaComment,',
      "pinned_comment: 'under 260 Korean characters: 2-4 natural Korean 해요체 sentences that summarize 2-3 useful actions or principles from this exact title and item set, followed by one calm channel-aligned subscription invitation; no questions, requests to reply or comment, like requests, generic engagement filler, or invented first-person or family anecdote',",
    )
    .replace(
      'Write description and pinned_comment as finished upload copy, not placeholders. Make them match this exact video rather than a generic channel template.',
      'Write description and pinned_comment as finished upload copy, not placeholders. Format description for easy scanning under 650 Korean characters: 1-2 short opening sentences, a blank line, a numbered list with one concise line per ranked item, another blank line, one calm closing sentence, then 3-5 relevant hashtags on the final line. Use the exact item order and preserve essential facts, but do not repeat every full explanation. Never make description one dense paragraph. In the upload description, do not add generic subscribe/like requests or visible medical disclaimers. Write pinned_comment as a short useful summary of the exact video, not a viewer question, and keep it under 260 Korean characters.',
    )
    .replace(
      'Write bgm_prompt as a short instrumental background-music direction for this exact video. Specify a pleasant approachable mood and suitable instruments. Never request singing, lyrics, spoken words, humming, chanting, choir, vocal chops, or any human voice. Avoid dark, ominous, tense, dissonant, or sad minor-key music.',
      'Write bgm_prompt as a short mature instrumental direction for this exact video. Aim for warm, calm, natural, quietly optimistic Korean lifestyle-program underscore. Piano may be used but is never mandatory; choose naturally among soft piano, nylon guitar, restrained strings, gentle woodwinds, or subtle organic plucks. Avoid cute commercial jingles, ukulele, bright marimba, glockenspiel, handclaps, finger snaps, toy-like sounds, and busy percussion. Never request singing, lyrics, spoken words, humming, chanting, choir, vocal chops, vocal-like synth pads, or any human voice.',
    )
    .replace(
      'topic mood only, no instrument list. Final BGM profile is selected downstream for diversity.',
      'complete pleasant musical direction for this exact video, including suitable mood and instrumentation.',
    )
    .replace(
      "bgm_prompt: 'complete pleasant musical direction for this exact video, including suitable mood and instrumentation.',",
      "bgm_prompt: 'short warm acoustic instrumental mood direction for this exact video; vary the feel; allowed instruments only; no human voice',",
    )
    .replace(
      "bgm_prompt: 'one varied calm premium instrumental music direction, no vocals',",
      "bgm_prompt: 'short warm acoustic instrumental mood direction for this exact video; vary the feel; allowed instruments only; no human voice',",
    )
    .replace(
      "bgm_prompt: 'short warm gentle felt-piano solo direction for this exact video; piano only, no other instruments and no human voice',",
      "bgm_prompt: 'short warm acoustic instrumental mood direction for this exact video; vary the feel; allowed instruments only; no human voice',",
    );

  if (!code.includes('The primary promise must directly concern health')) {
    code = replaceRequired(
      code,
      "  'Editorial rules: use concrete familiar actions and objects; avoid filler, duplicate points, fake authority, fearmongering, invented statistics, dosage instructions, diagnosis, cure, or guaranteed prevention.',",
      "  'Channel concept rule: The primary promise must directly concern health, nutrition, medicine or supplement literacy, body signals, sleep and recovery, movement and mobility, skin and vitality, or health-relevant food and daily habits. Do not choose general housekeeping, appliance tricks, home-object replacement, cars, money, etiquette, or relationship advice merely because the audience is older.',\n  'Editorial rules: use concrete familiar actions and objects; avoid filler, duplicate points, fake authority, fearmongering, invented statistics, dosage instructions, diagnosis, cure, or guaranteed prevention.',",
      `${target.id}: channel concept prompt`,
    );
  }

  if (!code.includes('CLINICAL_DEPTH_V1')) {
    code = replaceRequired(
      code,
      "  'Before writing, internally compare candidate claims and keep only established high-confidence facts. Do not expose private reasoning, invent citations, or use scientific-sounding detail as decoration.',",
      "  'Before writing, internally compare candidate claims and keep only established high-confidence facts. Do not expose private reasoning, invent citations, or use scientific-sounding detail as decoration.',\n  'CLINICAL_DEPTH_V1: Every ranked item must carry a real consequence the viewer can act on or notice, not vague encouragement. That consequence may be physiological, clinical, nutritional, medication-related, or a signal to interpret — and it may equally be a household, appliance, grocery, money, errand, or family consequence, which counts as full depth rather than filler. The channel covers the whole life of an adult over 50, so do not narrow topics to what a clinic would hand out and do not treat a non-medical subject as shallow. What fails this bar is an item that teaches nothing usable: a slogan, a restatement of common knowledge, or generic self-care.',",
      `${target.id}: clinical depth prompt`,
    );
  }

  if (!code.includes('conversational Korean 해요체')) {
    code = replaceRequired(
      code,
      'Use natural, respectful Korean that an ordinary viewer can understand on the first read.',
      'Use natural, respectful conversational Korean 해요체 that an ordinary viewer can understand on the first read. Do not use 합니다체 or sentence endings such as 입니다, 합니다, 됩니다, or 습니다 in viewer-facing copy.',
      `${target.id}: conversational Korean tone`,
    );
  }

  code = patchRankCountTarget(code, target);
  code = patchResearchGrounding(code, target);

  const commentVoice = commentSummaryContract(target);
  if (commentVoice && !code.includes(commentVoice)) {
    code = replaceRequired(
      code,
      "  'Return strict JSON only with this schema: ' + JSON.stringify(schema),",
      `  ${JSON.stringify(commentVoice)},\n  'Return strict JSON only with this schema: ' + JSON.stringify(schema),`,
      `${target.id}: comment voice instruction`,
    );
  }
  return code;
}

function patchPrepare(code) {
  if (code.includes('if (queuedSpecForPack) {')) {
    code = replaceBetween(
      code,
      'if (queuedSpecForPack) {',
      'const sortedItems =',
      "// single_writer_v1: queued material is supplied to the writer and is not re-applied downstream.\n\nconst sortedItems =",
      'queued pack override',
    );
  }
  code = code
    .replaceAll('name: safePublicText(item.name),', 'name: cleanQueuedValue(item.name),')
    .replaceAll('reason: safePublicText(item.reason),', 'reason: cleanQueuedValue(item.reason),')
    .replaceAll('caution: safePublicText(item.caution),', 'caution: cleanQueuedValue(item.caution),');
  // Strip any previously injected helper before re-injecting: the replace below
  // matches the cardRows it produces, so without this it stacks a fresh copy of
  // the helper on every run and the node dies on a duplicate declaration.
  code = code.replace(/\/\/ RANK_LABEL_MODE_V1:[\s\S]*?return item\.rank \+ rankSuffix;\n\};\n/g, '');
  code = code.replace(
    /const cardRows = sortedItems[\s\S]*?\.join\(LF \+ LF\);/,
    `// RANK_LABEL_MODE_V1: the row label was hardcoded to N위, which forced every
// card to read as a ranking. A tier chart, a this-instead-of-that list, or a
// by-part guide is not a ranking, and numbering those rows makes the card lie
// about what it is. A pack may set rank_label_mode; 'rank' stays the default.
const rankLabelMode = String(pack.rank_label_mode || 'rank').trim().toLowerCase();
const rankRowLabel = (item) => {
  if (rankLabelMode === 'none') return '';
  if (rankLabelMode === 'step') return item.rank + String.fromCharCode(45800, 44228);
  if (rankLabelMode === 'bullet') return String.fromCharCode(9679);
  return item.rank + rankSuffix;
};
const cardRows = sortedItems
  .map((item) => {
    const cardReason = String(item.card_reason || '').replace(/\\s+/g, ' ').trim();
    const label = rankRowLabel(item);
    const name = String(item.card_name || item.name || '').replace(/\\s+/g, ' ').trim();
    return [
      label ? label + ' ' + name : name,
      cardReason,
    ].filter(Boolean).join(LF);
  })
  .join(LF + LF);`,
  );
  if (!code.includes('const title = cleanQueuedValue(pack.hook_title')) {
    if (/const title = normalizeHookTitle\([^\n]+\);/.test(code)) {
      code = code.replace(/const title = normalizeHookTitle\([^\n]+\);/, "const title = cleanQueuedValue(pack.hook_title || pack.theme || ('생활 랭킹 TOP ' + (sortedItems.length || cfg.rank_count || 5)));");
    } else {
      code = replacePatternRequired(code, /const title = pack\.hook_title[^\n]+;/, "const title = cleanQueuedValue(pack.hook_title || pack.theme || ('생활 랭킹 TOP ' + (sortedItems.length || cfg.rank_count || 5)));", 'title preservation');
    }
  }
  if (!code.includes('const subtitle = cleanQueuedValue(pack.subtitle')) {
    if (/const subtitle = safePublicText\([^\n]+\);/.test(code)) {
      code = code.replace(/const subtitle = safePublicText\([^\n]+\);/, 'const subtitle = cleanQueuedValue(pack.subtitle || \'매일 하는데 놓치기 쉬운 것들\');');
    } else {
      code = replacePatternRequired(code, /const subtitle = pack\.subtitle[^\n]+;/, 'const subtitle = cleanQueuedValue(pack.subtitle || \'매일 하는데 놓치기 쉬운 것들\');', 'subtitle preservation');
    }
  }
  if (!code.includes('function channelFallbackCopy()')) {
    code = replacePatternRequired(
      code,
      /function buildUniversalCommentCta\(\) \{[\s\S]*?\n\}/,
      `function channelFallbackCopy() {
  if (cfg.channel_editorial_profile === 'haru_health_literacy') {
    return {
      channel: '하루건강약사',
      subscription: '몸과 성분을 이해하는 건강 이야기, 구독으로 함께 이어가요.',
      intro: '영양, 음식, 영양제 성분, 몸의 신호를 일상 언어로 쉽게 설명해요.',
      promise: '과장된 비법보다 내 몸에 맞는 건강 선택 기준을 차근차근 알려드려요.',
      daily: '하루에 하나씩, 건강한 선택에 도움이 되는 내용을 전해드려요.',
    };
  }
  return {
    channel: '건강장수비결',
    subscription: '건강한 노년을 지키는 습관, 구독으로 함께 이어가요.',
    intro: '식사, 운동, 수면, 혈압, 혈당, 관절 관리 내용을 일상 언어로 쉽게 설명해요.',
    promise: '특별한 비법보다 일상 기능과 자립을 오래 지키는 생활 습관을 정리해 드려요.',
    daily: '하루에 하나씩, 건강한 노년에 도움이 되는 내용을 전해드려요.',
  };
}

function buildUniversalCommentCta() {
  return channelFallbackCopy().subscription;
}`,
      'channel fallback comment copy',
    );
    code = replacePatternRequired(
      code,
      /  const pharmacistIntro = \[[\s\S]*?\n  \]\.join\(LF\);/,
      `  const channelCopy = channelFallbackCopy();
  const pharmacistIntro = [
    '안녕하세요. ' + channelCopy.channel + '입니다.',
    '',
    channelCopy.intro,
    channelCopy.promise,
    '',
    channelCopy.daily,
  ].join(LF);`,
      'channel fallback description copy',
    );
    code = replacePatternRequired(
      code,
      /  const tagList = Array\.from\(new Set\(\[\.\.\.\(pack\.tags \|\| \[\]\), '[^']+', '건강정보', '시니어건강', '쇼츠'\]\)\)/,
      "  const tagList = Array.from(new Set([...(pack.tags || []), channelCopy.channel, '건강정보', '시니어건강', '쇼츠']))",
      'channel fallback description tags',
    );
  }
  if (!code.includes("const youtubeDescription = String(pack.description || '').trim()")) {
    code = replaceRequired(code, 'const youtubeDescription = buildYoutubeDescription();', "const youtubeDescription = String(pack.description || '').trim() || buildYoutubeDescription();", 'description preservation');
  }

  const writerBgmBlock = `const channelVisualIdentity = cfg.channel_editorial_profile === 'haru_health_literacy'
  ? '하루건강약사: 50대 이후 시청자가 영양, 음식, 영양제 성분, 몸 신호, 피부, 활력을 이해하고 건강한 선택을 판단하도록 돕는 차분하고 현대적인 건강교육 채널.'
  : (cfg.channel_editorial_profile === 'longevity_daily_function'
    ? '건강장수비결: 50대 이후 시청자가 식사, 운동, 수면, 혈압, 혈당, 관절을 관리해 일상 기능과 자립을 오래 지키도록 돕는 따뜻하고 실천적인 건강교육 채널.'
    : '50대 이후 시청자를 위한 차분하고 신뢰할 수 있는 건강교육 채널.');
const rawBgmWriterDirection = String(pack.bgm_prompt || '').replace(/\\s+/g, ' ').trim();
const bgmWriterDirection = rawBgmWriterDirection || 'warm calm acoustic instrumental for this health topic';
const bgmProfilePool = [
  { id: 'intimate_felt_piano', sound_family: 'piano_solo', title: '포근한 펠트 피아노', prompt: 'Warm intimate felt piano solo, sparse rounded notes, reflective and unhurried.' },
  { id: 'hopeful_acoustic_piano', sound_family: 'piano_solo', title: '밝은 어쿠스틱 피아노', prompt: 'Gentle acoustic piano solo, flowing melody, quietly hopeful and light.' },
  { id: 'grounded_nylon_guitar', sound_family: 'guitar_solo', title: '차분한 나일론 기타', prompt: 'Warm nylon acoustic guitar solo, smooth fingerstyle phrases, calm and grounded.' },
  { id: 'reassuring_piano_strings', sound_family: 'piano_strings', title: '피아노와 부드러운 현악', prompt: 'Gentle acoustic piano with soft bowed strings, reassuring and steady.' },
  { id: 'daylight_guitar_piano', sound_family: 'guitar_piano', title: '나일론 기타와 피아노', prompt: 'Nylon acoustic guitar with sparse felt piano, warm daylight mood and easy movement.' },
  { id: 'restorative_strings_piano', sound_family: 'piano_strings', title: '잔잔한 현악과 피아노', prompt: 'Soft bowed strings with minimal gentle piano, restorative and spacious.' },
];
const requestedBgmProfile = findById(bgmProfilePool, cfg.bgm_profile_override);
const recentBgmProfileIds = (Array.isArray(cfg.recent_bgm_profiles) ? cfg.recent_bgm_profiles : []).slice(0, 2);
const recentBgmProfiles = new Set(recentBgmProfileIds);
const mostRecentBgmProfile = findById(bgmProfilePool, recentBgmProfileIds[0]);
const mostRecentBgmSoundFamily = mostRecentBgmProfile?.sound_family || '';
const cooledBgmProfilePool = bgmProfilePool.filter((profile) =>
  !recentBgmProfiles.has(profile.id) &&
  (!mostRecentBgmSoundFamily || profile.sound_family !== mostRecentBgmSoundFamily)
);
const selectableBgmProfiles = cooledBgmProfilePool.length ? cooledBgmProfilePool : bgmProfilePool;
const bgmVariation = requestedBgmProfile || pick(
  selectableBgmProfiles,
  'bgm_variation|' + (pack.content_lane || data.selected_content_lane?.id || 'general') + '|' + bgmWriterDirection,
);
const bgmPrompt = limitPrompt([
  'Profile ' + bgmVariation.id + ': ' + bgmVariation.prompt,
  'No voice, vocals, singing, lyrics, speech, humming, choir, chant, ooh/aah, vocal chops, or wordless vocals.',
  'Allowed instruments only: felt piano, gentle acoustic piano, nylon acoustic guitar, soft bowed strings.',
  'No synth, pad, ambient wash, breathy texture, percussion, drums, brushes, marimba, mallets, electronic or fusion sounds.',
].join(' '), 480);
const bgmProfile = { ...bgmVariation, writer_direction: bgmWriterDirection, safety_envelope: 'warm_acoustic_zero_voice_v2' };
const bgm_payload = {
  prompt: bgmPrompt,
  model: cfg.kie_bgm_model,
  customMode: false,
  instrumental: true,
};

`;
  const bgmStart = code.includes('const channelVisualIdentity =')
    ? 'const channelVisualIdentity ='
    : (code.includes('const rawBgmWriterDirection =')
      ? 'const rawBgmWriterDirection ='
      : (code.includes('const bgmWriterDirection =')
      ? 'const bgmWriterDirection ='
      : (code.includes('const bgmProfile = pickBgmProfile();') ? 'const bgmProfile = pickBgmProfile();' : 'const bgmProfile =')));
  code = replaceBetween(code, bgmStart, 'const shortsSafeZoneInstruction =', writerBgmBlock + 'const shortsSafeZoneInstruction =', 'BGM profile override');
  const unifiedFormatModeBlock = `const formatModes = [
  {
    id: 'editorial_list_poster',
    title: '에디토리얼 목록 포스터',
    prompt: 'Unified editorial poster with one large headline zone, one quiet background, and aligned numbered text rows.',
  },
  {
    id: 'single_subject_guide',
    title: '단일 주제 가이드',
    prompt: 'One contextual subject or still life occupies one background region while a consistent ranked text column remains dominant.',
  },
  {
    id: 'continuous_information_board',
    title: '통합 정보 보드',
    prompt: 'One continuous information surface with a clear headline, restrained numbered markers, aligned rows, and no detached cards.',
  },
];

`;
  code = replaceBetween(
    code,
    'const formatModes = [',
    'const formatMode = pick(',
    unifiedFormatModeBlock + 'const formatMode = pick(',
    'unified poster format modes',
  );
  const safeZoneBlock = `const shortsSafeZoneInstruction = [
  'MANDATORY SHORTS SAFE LAYOUT for 1080x1920: make the main information card large, left-expanded, and visually dominant without making the copy dense.',
  'Use main-card footprint x 0-990 px and y 160-1820 px. There is no reserved left background band. The main card may reach the left frame edge, while critical text uses comfortable internal padding inside the card.',
  'Reserve 90 px right, 160 px top, and 100 px bottom for feed UI and crop tolerance. Published frames placed the title against the very top edge where the Shorts search bar sits, so the top reserve is deliberately deeper than the bottom. Keep the title, rank numbers, item names, card_reason, faces, logos, and key objects clear of the top, right, and bottom UI bands.',
  'The top 160 px must remain background-only. Do not place text, faces, logos, foreground objects, or ornament in that band.',
  'VERTICAL_FILL_V1: distribute the content across the full footprint from y 160 to y 1820. The title zone starts at the top of the footprint and the last ranked row must end near its bottom. Published frames compressed all rows into the upper half, leaving a large empty band at the bottom while the type shrank; that is a layout failure. When vertical space remains, spend it on larger type, taller rows, and wider spacing. When space is tight, cut decoration and secondary copy, never the Korean type size.',
  'GLYPH_INTEGRITY_V1: small Korean type renders with broken or malformed strokes, so glyph size is a rendering-safety floor, not a style choice. Keep card_reason text no smaller than about 3 percent of frame height (roughly 55 px) and item names clearly larger. If the copy cannot fit at that size, remove decoration or drop the frame to fewer visual elements; never render Korean text small enough to risk broken glyphs.',
  'The main card should use nearly the full footprint. Make Korean title, item names, and card_reason substantially larger than decorative elements and readable in a small channel-grid thumbnail. Never solve fitting by shrinking all text; simplify decoration and secondary copy first.',
  'Only the title, ranked item names, and their supplied card_reason are critical. Auxiliary copy and decoration are optional and may be cropped or covered; never shrink critical information to preserve them.',
  'Assume channel grids and previews may crop the outer frame. The main card must keep its useful message intact, but auxiliary copy does not need protection.',
  'Decorative background may extend edge to edge. Do not use full-bleed critical text, right-edge badges, bottom CTA strips, or cropped title letters.',
].join(LF);

const posterReadabilityInstruction = [
  'POSTER_READABILITY_V2: Build one unified typography-led information poster with one coherent reading path.',
  'Use one primary visual region for the whole frame: a contextual background, still life, or single subject.',
  'Use text-first ranked rows. Each row may include at most one compact non-narrative cue, but the cue must not become an independent scene.',
  'Do not divide the frame into multiple full narrative scenes or repeat a subject to reenact each entry.',
  'Keep one restrained color system, strong contrast, generous spacing, and consistent row alignment. Remove secondary decoration whenever it competes with the title or ranked copy. The frame must read clearly at channel-grid thumbnail size and during a 5-second Short.',
].join(LF);

`;
  code = replaceBetween(
    code,
    'const shortsSafeZoneInstruction =',
    'const imagePrompt =',
    safeZoneBlock + 'const imagePrompt =',
    'Shorts safe-zone block',
  );
  code = code.replace(
    /The chosen format must [^']+/,
    'The selected visual format controls background, material, and color direction only. Keep the title and all ranked rows in a single consistent text system inside the primary visual region.',
  );
  code = code.replace(
    'For every rank, render the item name as the strong first line and the 왜: explanation below it in one or two readable lines. Preserve the full explanation without shortening or paraphrasing it.',
    'For every rank, render the exact item name as the strong first line, then present its cause-and-effect sentence naturally below it. Do not force repeated labels such as 왜:, 이유:, 핵심:, or TIP:. Preserve the original meaning, conditions, numbers, and necessary technical terms; prefer one readable line and use two only when accuracy requires it. Never collapse the explanation into vague keywords.',
  );
  code = code.replace(
    'Use calm text hierarchy and enough breathing room. Explanation clarity is more important than decorative UI density.',
    'Use calm text hierarchy and enough breathing room. Mobile readability outranks decoration: use the largest practical Korean type, let the content card occupy nearly the full safe area, and prioritize title, item name, and cause-and-effect sentence. Keep supporting objects compact. Remove secondary decoration whenever it competes for space or resembles information. Decoration must support the topic and never look like extra data.',
  );
  code = code.replace(
    /Use calm text hierarchy and enough breathing room\. Mobile readability outranks decoration:[^']+Decoration must support the topic and never look like extra data\./g,
    'Use calm text hierarchy and enough breathing room. Mobile readability outranks decoration: use the largest practical Korean type, let the content card occupy nearly the full safe area, and prioritize title, item name, and cause-and-effect sentence. Keep supporting objects compact. Remove secondary decoration whenever it competes for space or resembles information. Decoration must support the topic and never look like extra data.',
  );
  if (!code.includes('  posterReadabilityInstruction,')) {
    code = replaceRequired(
      code,
      "  'Use calm text hierarchy and enough breathing room. Mobile readability outranks decoration: use the largest practical Korean type, let the content card occupy nearly the full safe area, and prioritize title, item name, and cause-and-effect sentence. Keep supporting objects compact. Remove secondary decoration whenever it competes for space or resembles information. Decoration must support the topic and never look like extra data.',",
      "  posterReadabilityInstruction,\n  'Use calm text hierarchy and enough breathing room. Mobile readability outranks decoration: use the largest practical Korean type, let the content card occupy nearly the full safe area, and prioritize title, item name, and cause-and-effect sentence. Keep supporting objects compact. Remove secondary decoration whenever it competes for space or resembles information. Decoration must support the topic and never look like extra data.',",
      'poster readability instruction',
    );
  }
  code = code.replace(
    /'For every rank, render the exact item name[^']+',/,
    "'For every rank, render the supplied short card_name exactly as the strong first line and the supplied card_reason exactly once below it. Copy every Korean character verbatim: do not alter, substitute, respell, abbreviate, or invent any word. If space is tight, remove decoration or use two lines; never alter the Korean copy. Never add labels such as 왜:, 이유:, 핵심:, or TIP:. Do not render the longer name, reason, or caution fields. Keep card_reason visually to one line when possible and at most two short lines.',",
  );
  // Matches whether this runs on pristine node code or on code a previous run
  // already rewrote, so the mode branch lands either way.
  code = code.replace(
    /  'Rank order must (?:read clearly|follow one continuous reading path) from ' \+ \('1' \+ rankSuffix\) \+ ' to the final rank[^']*',/,
    "  (rankLabelMode === 'rank'\n    ? 'Rank order must follow one continuous reading path from ' + ('1' + rankSuffix) + ' to the final rank, using consistent alignment and spacing.'\n    : 'Rows must follow one continuous reading path from the first row to the last, using consistent alignment and spacing. Do not add rank numbers, medals, or place markers of any kind: these rows are a list, not a ranking.'),",
  );
  code = code.replace(
    /Composition rule:[^']+/,
    'Composition rule: use one dominant title zone, one primary visual region, and one aligned ranked-copy region.',
  );
  // The rank label leaked into six more places than the card rows: the visible-text
  // header, the badge direction, the text whitelist, and the description/comment
  // builders. A non-ranking card that still gets rank seals drawn on it is worse
  // than one labelled 1위 throughout, so every site follows the same mode.
  code = code.replace(
    "  'RANKED EXPLANATION BLOCKS, keep ' + ('1' + rankSuffix) + ' first:',",
    "  (rankLabelMode === 'rank' ? 'RANKED EXPLANATION BLOCKS, keep ' + ('1' + rankSuffix) + ' first:' : 'EXPLANATION BLOCKS in the supplied order, with no rank numbers:'),",
  );
  code = code.replace(
    "'; number marks: ' + sanitizeImageInstruction(badgeFamily) + '; motif: '",
    "'; ' + (rankLabelMode === 'rank' ? 'number marks: ' + sanitizeImageInstruction(badgeFamily) : 'row markers: plain aligned rows with no numbers, medals, seals, or place badges of any kind') + '; motif: '",
  );
  code = code.replace(
    'and their rank numerals.',
    "and, when the rows are ranked, their rank numerals.",
  );
  code = code.replace(
    /    return item\.rank \+ rankSuffix \+ ' ' \+ item\.name \+ \(reason \? ' - ' \+ reason : ''\);/,
    "    return (rankRowLabel(item) ? rankRowLabel(item) + ' ' : '') + item.name + (reason ? ' - ' + reason : '');",
  );
  code = code.replace(
    /      return item\.rank \+ rankSuffix \+ ' ' \+ name \+ \(reason \? ' - ' \+ reason : ''\);/,
    "      return (rankRowLabel(item) ? rankRowLabel(item) + ' ' : '') + name + (reason ? ' - ' + reason : '');",
  );
  code = code.replace(
    /Text placement rule:[^']+/,
    'Text placement rule: keep ranked rows consistent in shape and alignment; create hierarchy with type size, weight, spacing, and color rather than independent containers.',
  );
  code = code.replace(
    "  'Style ingredients: ' + sanitizeImageInstruction(visualProfile.prompt),",
    "  'Styling reference for palette and material only; ignore layout or widget suggestions: ' + sanitizeImageInstruction(visualProfile.prompt),",
  );
  code = code.replace(
    "  pack.visual_mood_hint ? 'Topic visual hint: ' + sanitizeImageInstruction(pack.visual_mood_hint) : '',",
    "  pack.visual_mood_hint ? 'Topic mood and subject hint only; do not change the poster structure: ' + sanitizeImageInstruction(pack.visual_mood_hint) : '',",
  );
  code = code.replace(
    "  'Channel identity: practical Korean food, shopping, kitchen, and daily health-choice guide. Make it fast, clever, useful, and modern.',",
    "  'Channel identity: ' + channelVisualIdentity,",
  );
  code = code.replace("  'FOOTER: ' + ctaComment,\n", '');
  code = code.replace(
    "positiveBgmText(pack.bgm_prompt || 'pleasant, bright, approachable instrumental background music')",
    "String(pack.bgm_prompt || 'pleasant, bright, approachable instrumental background music').replace(/\\s+/g, ' ').trim()",
  );
  if (!code.includes("pinned_comment: String(pack.pinned_comment || '').trim()")) {
    const longReturn = 'pack: { ...pack, hook_title: title, subtitle, rank_items: sortedItems, description: youtubeDescription, pinned_comment: buildPinnedComment() },';
    const shortReturn = 'pack: { ...pack, rank_items: sortedItems, description: youtubeDescription, pinned_comment: buildPinnedComment() },';
    if (code.includes(longReturn)) code = code.replace(longReturn, "pack: { ...pack, hook_title: title, subtitle, rank_items: sortedItems, description: youtubeDescription, pinned_comment: String(pack.pinned_comment || '').trim() || buildPinnedComment() },");
    else code = replaceRequired(code, shortReturn, "pack: { ...pack, hook_title: title, subtitle, rank_items: sortedItems, description: youtubeDescription, pinned_comment: String(pack.pinned_comment || '').trim() || buildPinnedComment() },", 'pinned comment preservation');
  }
  return code;
}

function patchPreparedCardPackPassthrough(code, target) {
  code = code.replace(/\/\/ PREPARED_CARD_PACK_V1_BEGIN[\s\S]*?\/\/ PREPARED_CARD_PACK_V1_END\n/, '');
  const block = `// PREPARED_CARD_PACK_V1_BEGIN
const preparedCardPack = data.prepared_card_pack;
if (preparedCardPack) {
  const preparedItems = (preparedCardPack.rank_items || []).map((item, index) => ({ ...item, rank: index + 1 }));
  if (preparedItems.length < 4 || preparedItems.length > 7) {
    throw new Error('PREPARED_CARD_PACK_INVALID: a prepared final_pack must carry 4-7 ranked items.');
  }
  const preparedPack = {
    channel_editorial_profile: data.config?.channel_editorial_profile || data.channel_editorial_profile?.id || '',
    channel_content_pillar: data.selected_channel_pillar?.id || '',
    content_lane: data.selected_content_lane?.id || 'prepared_source_grounded',
    format_angle: 'prepared_card_pack_verbatim',
    theme: preparedCardPack.hook_title,
    hook_title: preparedCardPack.hook_title,
    subtitle: preparedCardPack.subtitle || '',
    visual_mood_hint: preparedCardPack.visual_mood_hint || '',
    visual_profile: preparedCardPack.visual_profile || '',
    rank_items: preparedItems,
    video_script: preparedCardPack.video_script || preparedCardPack.hook_title,
    description: preparedCardPack.description || '',
    tags: preparedCardPack.tags || [],
    pinned_comment: preparedCardPack.pinned_comment || '',
    bgm_prompt: preparedCardPack.bgm_prompt || 'warm calm acoustic instrumental for this everyday health topic',
    medical_claims: preparedCardPack.medical_claims || preparedItems.map((item) => item.reason),
    safety_notes: preparedCardPack.safety_notes || ['사전 조사와 검수를 마친 고정 카드 팩'],
  };
  return [{ json: { ...data, pack: preparedPack, ai_source: 'prepared_card_pack' } }];
}
// PREPARED_CARD_PACK_V1_END
`;
  return replacePatternRequired(
    code,
    /^const dryRun = Boolean\(data\.config\?\.test_mode \|\| data\.config\?\.dry_run\);$/m,
    block + '$&',
    `${target.id}: prepared card pack passthrough`,
  );
}

function patchFallbackTone(code) {
  const replacements = [
    ['익숙해서 더 놓치기 쉽습니다', '익숙해서 더 놓치기 쉬워요'],
    ['주방 보관과 조리 전 확인할 습관을 정리했습니다.', '주방 보관과 조리 전 확인할 습관을 정리했어요.'],
    ['무엇을 먼저 먹느냐가 달라집니다', '무엇을 먼저 먹느냐가 달라져요'],
    ['같은 밥상도 순서와 조합에 따라 식후 느낌이 달라질 수 있습니다.', '같은 밥상도 순서와 조합에 따라 식후 느낌이 달라질 수 있어요.'],
    ['식사 순서와 혈당 부담을 랭킹으로 정리했습니다.', '식사 순서와 혈당 부담을 랭킹으로 정리했어요.'],
    ['걷기 전 작은 준비가 무릎과 허리 부담을 줄이는 데 도움 될 수 있습니다.', '걷기 전 작은 준비가 무릎과 허리 부담을 줄이는 데 도움 될 수 있어요.'],
    ['걷기 전후에 피하면 좋은 습관을 정리했습니다.', '걷기 전후에 피하면 좋은 습관을 정리했어요.'],
    ['큰 병 이야기보다 생활 점검입니다', '큰 병 이야기보다 생활 점검이에요'],
    ['몸이 보내는 작은 신호는 전날 생활을 돌아보는 힌트가 될 수 있습니다.', '몸이 보내는 작은 신호는 전날 생활을 돌아보는 힌트가 될 수 있어요.'],
    ['몸의 작은 신호와 생활 습관을 정리했습니다.', '몸의 작은 신호와 생활 습관을 정리했어요.'],
    ['돈 쓰기 전에 식탁부터 봅니다', '돈 쓰기 전에 식탁부터 봐요'],
    ['영양제 전에 먼저 볼 음식과 습관을 정리했습니다.', '영양제 전에 먼저 볼 음식과 습관을 정리했어요.'],
  ];
  for (const [formal, conversational] of replacements) code = code.replaceAll(formal, conversational);
  return code;
}

function patchParse(code) {
  code = patchFallbackTone(code);
  code = code.replace(
    'return { rank: index + 1, name, reason, caution };',
    'return { rank: index + 1, name, card_name: name, reason, card_reason: reason, caution };',
  );
  code = code.replace(
    'return { rank: index + 1, name, reason, card_reason: reason, caution };',
    'return { rank: index + 1, name, card_name: name, reason, card_reason: reason, caution };',
  );
  const parseFallbackMetadata = `function inferFallbackChannelPillar(fallbackPack, context) {
  const pillars = Array.isArray(context?.channel_editorial_profile?.pillars) ? context.channel_editorial_profile.pillars : [];
  const text = [
    fallbackPack?.hook_title,
    fallbackPack?.theme,
    ...(Array.isArray(fallbackPack?.rank_items) ? fallbackPack.rank_items.flatMap((item) => [item?.name, item?.reason]) : []),
  ].map((value) => String(value || '').replace(/\\s+/g, ' ').trim()).filter(Boolean).join(' ');
  const scored = pillars.map((pillar) => ({
    pillar,
    score: (pillar.keywords || []).reduce((sum, keyword) => text.includes(String(keyword || '')) ? sum + [...String(keyword || '')].length : sum, 0),
  })).filter((entry) => entry.score > 0).sort((left, right) => right.score - left.score);
  return scored[0]?.pillar?.id || context?.selected_channel_pillar?.id || '';
}
const selectedFallbackPack = pickFallbackPack(base, cfg.variation_seed || new Date().toISOString(), 'parse_fallback');
const fallbackPackChannelMetadata = {
  channel_editorial_profile: cfg.channel_editorial_profile || base.channel_editorial_profile?.id || '',
  channel_content_pillar: inferFallbackChannelPillar(selectedFallbackPack, base),
};
const fallbackPack = {
  ...selectedFallbackPack,
  ...fallbackPackChannelMetadata,
};`;
  if (code.includes('function inferFallbackChannelPillar(fallbackPack, context) {')) {
    code = replaceBetween(code, 'function inferFallbackChannelPillar(fallbackPack, context) {', '};\n\nfunction responseText', parseFallbackMetadata + '\n\nfunction responseText', 'parse fallback channel metadata');
  } else if (code.includes('const fallbackPackChannelMetadata =')) {
    code = replaceBetween(code, 'const fallbackPackChannelMetadata =', '};\n\nfunction responseText', parseFallbackMetadata + '\n\nfunction responseText', 'parse fallback channel metadata');
  } else {
    code = replaceRequired(
      code,
      "const fallbackPack = pickFallbackPack(base, cfg.variation_seed || new Date().toISOString(), 'parse_fallback');",
      parseFallbackMetadata,
      'parse fallback channel metadata',
    );
  }
  const duplicateFallback = `const duplicateOf = parseRecentTitleMatch(pack.hook_title);
if (duplicateOf) {
  return fallback('KIE Claude generated a recent duplicate title; rotating fallback pack used: ' + pack.hook_title + ' ~= ' + duplicateOf, response);
}

return [{
  json: {
    ...base,
    pack,
    ai_source: 'kie_claude',
    kie_claude_raw: response,
    kie_claude_parse_error: null,
  },
}];`;
  const preserveWriterPack = `const duplicateOf = parseRecentTitleMatch(pack.hook_title);

return [{
  json: {
    ...base,
    pack,
    ai_source: 'kie_claude',
    kie_claude_raw: response,
    kie_claude_parse_error: null,
    content_duplicate_check: duplicateOf ? {
      code: 'recent_title_duplicate',
      generated_title: pack.hook_title,
      similar_to: duplicateOf,
      blocking: true,
    } : null,
  },
}];`;
  if (code.includes(duplicateFallback)) return code.replace(duplicateFallback, preserveWriterPack);
  if (code.includes('content_duplicate_advisory')) {
    return code
      .replace('content_duplicate_advisory', 'content_duplicate_check')
      .replace("code: 'recent_title_similarity'", "code: 'recent_title_duplicate'")
      .replace('blocking: false', 'blocking: true');
  }
  if (code.includes('content_duplicate_check')) return code;
  throw new Error('missing duplicate-title fallback anchor');
}

function patchRetryContracts(code, target) {
  code = code
    .replace(/^const attentionPromiseRetryInstruction = [^\n]+\n/m, '')
    .replace(/^const decisionDetailRetryInstruction = [^\n]+\n/m, '')
    .replace(/^const researchGroundingRetryInstruction = [^\n]+\n/m, '')
    .replace(/^const everydayLanguageRetryInstruction = [^\n]+\n/m, '')
    .replace(/^\s*everydayLanguageRetryInstruction,\n/gm, '')
    .replace(/^\s*attentionPromiseRetryInstruction,\n/gm, '')
    .replace(/^\s*decisionDetailRetryInstruction,\n/gm, '')
    .replace(/^\s*researchGroundingRetryInstruction,\n/gm, '');
  code = replacePatternRequired(
    code,
    /^const claimStrengthRetryInstruction = [^\n]+$/m,
    `$&\nconst attentionPromiseRetryInstruction = ${JSON.stringify(attentionPromiseRetryContract)};\nconst decisionDetailRetryInstruction = ${JSON.stringify(decisionDetailRetryContract)};\nconst everydayLanguageRetryInstruction = ${JSON.stringify(everydayLanguageContract + ' ' + everydayTopicAngleContract)};\nconst researchGroundingRetryInstruction = data.research_source_pack ? ${JSON.stringify(researchGroundingRetryContract)} + ' Regenerate strictly inside this same research_source_pack: ' + JSON.stringify(data.research_source_pack) : '';`,
    `${target.id}: attention promise retry declaration`,
  );
  const claimStrengthReferences = (code.match(/^\s*claimStrengthRetryInstruction,$/gm) || []).length;
  if (claimStrengthReferences < 2) throw new Error(`${target.id}: attention promise retry insertion points missing`);
  return code.replace(
    /^\s*claimStrengthRetryInstruction,$/gm,
    '  claimStrengthRetryInstruction,\n  attentionPromiseRetryInstruction,\n  decisionDetailRetryInstruction,\n  everydayLanguageRetryInstruction,\n  researchGroundingRetryInstruction,',
  );
}

function patchWorkflow(workflow, target) {
  const load = workflow.nodes.find((node) => node.name === 'Load Config');
  const build = workflow.nodes.find((node) => node.name === 'Build Viral Rank Pack Request');
  const parse = workflow.nodes.find((node) => node.name === 'Parse KIE Claude Pack');
  const prepare = workflow.nodes.find((node) => node.name === 'Prepare Image and BGM Payloads');
  const mock = workflow.nodes.find((node) => node.name === 'Mock Viral Rank Pack');
  const final = workflow.nodes.find((node) => node.name === 'Final Result');
  const retry = workflow.nodes.find((node) => node.name === 'Prepare Medical Retry Request');
  if (!load || !build || !parse || !prepare || !mock || !final || !retry) throw new Error(`${target.id}: required editorial nodes missing`);
  load.parameters.jsCode = patchLoadConfig(load.parameters.jsCode, target);
  build.parameters.jsCode = patchBuild(build.parameters.jsCode, target);
  parse.parameters.jsCode = patchParse(parse.parameters.jsCode);
  prepare.parameters.jsCode = patchPrepare(prepare.parameters.jsCode);
  mock.parameters.jsCode = patchPreparedCardPackPassthrough(patchFallbackTone(mock.parameters.jsCode), target);
  final.parameters.jsCode = patchFinalResultConsumeGate(patchFinalResult(final.parameters.jsCode, target), target);
  const attach = workflow.nodes.find((node) => node.name === 'Attach Downloaded MP4');
  const skipUpload = workflow.nodes.find((node) => node.name === 'Skip YouTube Upload');
  if (!attach || !skipUpload) throw new Error(`${target.id}: upload guard nodes missing`);
  attach.parameters.jsCode = patchUploadIdempotency(attach.parameters.jsCode, target);
  skipUpload.parameters.jsCode = patchSkipUploadReason(skipUpload.parameters.jsCode, target);
  retry.parameters.jsCode = patchRetryContracts(retry.parameters.jsCode, target);
  if (!mock.parameters.jsCode.includes('channel_editorial_profile: data.config?.channel_editorial_profile')) {
    mock.parameters.jsCode = mock.parameters.jsCode.replace(
      "    content_lane: lockedSource.lane || 'source_grounded',",
      "    channel_editorial_profile: data.config?.channel_editorial_profile || data.channel_editorial_profile?.id || '',\n    channel_content_pillar: data.selected_channel_pillar?.id || '',\n    content_lane: lockedSource.lane || 'source_grounded',",
    );
  }
  if (!mock.parameters.jsCode.includes("card_name: String(item.card_name || item.name || '')")) {
    mock.parameters.jsCode = mock.parameters.jsCode.replace(
        "name: String(item.name || '').replace(/\\s+/g, ' ').trim(),",
        "name: String(item.name || '').replace(/\\s+/g, ' ').trim(),\n    card_name: String(item.card_name || item.name || '').replace(/\\s+/g, ' ').trim(),",
      );
  }
  mock.parameters.jsCode = mock.parameters.jsCode.replace(
      'return { rank: index + 1, name, reason, caution };',
      'return { rank: index + 1, name, card_name: name, reason, card_reason: reason, caution };',
  );
  const mockFallbackMetadata = `function inferFallbackChannelPillar(fallbackPack, context) {
  const pillars = Array.isArray(context?.channel_editorial_profile?.pillars) ? context.channel_editorial_profile.pillars : [];
  const text = [
    fallbackPack?.hook_title,
    fallbackPack?.theme,
    ...(Array.isArray(fallbackPack?.rank_items) ? fallbackPack.rank_items.flatMap((item) => [item?.name, item?.reason]) : []),
  ].map((value) => String(value || '').replace(/\\s+/g, ' ').trim()).filter(Boolean).join(' ');
  const scored = pillars.map((pillar) => ({
    pillar,
    score: (pillar.keywords || []).reduce((sum, keyword) => text.includes(String(keyword || '')) ? sum + [...String(keyword || '')].length : sum, 0),
  })).filter((entry) => entry.score > 0).sort((left, right) => right.score - left.score);
  return scored[0]?.pillar?.id || context?.selected_channel_pillar?.id || '';
}
const selectedFallbackPack = pickFallbackPack(data, cfg.variation_seed || new Date().toISOString(), 'dry_run_mock');
const fallbackPackChannelMetadata = {
  channel_editorial_profile: cfg.channel_editorial_profile || data.channel_editorial_profile?.id || '',
  channel_content_pillar: inferFallbackChannelPillar(selectedFallbackPack, data),
};
const pack = {
  ...selectedFallbackPack,
  ...fallbackPackChannelMetadata,
};`;
  if (mock.parameters.jsCode.includes('function inferFallbackChannelPillar(fallbackPack, context) {')) {
    mock.parameters.jsCode = replaceBetween(mock.parameters.jsCode, 'function inferFallbackChannelPillar(fallbackPack, context) {', '};\nreturn [{ json:', mockFallbackMetadata + '\nreturn [{ json:', `${target.id}: mock fallback channel metadata`);
  } else if (mock.parameters.jsCode.includes('const fallbackPackChannelMetadata =')) {
    mock.parameters.jsCode = replaceBetween(mock.parameters.jsCode, 'const fallbackPackChannelMetadata =', '};\nreturn [{ json:', mockFallbackMetadata + '\nreturn [{ json:', `${target.id}: mock fallback channel metadata`);
  } else {
    mock.parameters.jsCode = replaceRequired(
      mock.parameters.jsCode,
      "const pack = pickFallbackPack(data, cfg.variation_seed || new Date().toISOString(), 'dry_run_mock');",
      mockFallbackMetadata,
      `${target.id}: mock fallback channel metadata`,
    );
  }
  workflow.versionId = randomUUID();
  return workflow;
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function done(error) {
    if (error) reject(error); else resolve(this.changes);
  }));
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
}

const nodePatchArg = process.argv.find((value) => value.startsWith('--emit-node-patch='));
if (nodePatchArg) {
  const [workflowId, nodeName] = nodePatchArg.slice('--emit-node-patch='.length).split('::');
  const target = targets.find((entry) => entry.id === workflowId);
  if (!target || !nodeName) throw new Error('Invalid --emit-node-patch argument');
  const filePath = path.join(root, target.file);
  const original = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const updated = patchWorkflow(structuredClone(original), target);
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
  const emitted = targets.map((target) => {
    const filePath = path.join(root, target.file);
    const workflow = patchWorkflow(JSON.parse(fs.readFileSync(filePath, 'utf8')), target);
    return { filePath, content: JSON.stringify(workflow, null, 2) + '\n' };
  });
  process.stdout.write(JSON.stringify(emitted));
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(root, 'etc', `backup-before-single-writer-${stamp}`);
fs.mkdirSync(backupDir, { recursive: true });

for (const target of targets) {
  const filePath = path.join(root, target.file);
  fs.copyFileSync(filePath, path.join(backupDir, path.basename(filePath)));
  const workflow = patchWorkflow(JSON.parse(fs.readFileSync(filePath, 'utf8')), target);
  fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
}

const db = new sqlite3.Database(dbPath);
const backupDb = path.join(backupDir, 'database.sqlite').replace(/\\/g, '/').replaceAll("'", "''");
await run(db, `VACUUM INTO '${backupDb}'`);
await run(db, 'BEGIN IMMEDIATE');
try {
  for (const target of targets) {
    const row = await get(db, 'SELECT * FROM workflow_entity WHERE id=?', [target.id]);
    if (!row) throw new Error(`workflow not found in DB: ${target.id}`);
    const workflow = patchWorkflow({ id: row.id, name: row.name, nodes: JSON.parse(row.nodes), connections: JSON.parse(row.connections), versionId: row.versionId }, target);
    await run(db, `UPDATE workflow_entity SET nodes=?, connections=?, versionId=?, versionCounter=versionCounter+1,
      updatedAt=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=?`,
      [JSON.stringify(workflow.nodes), JSON.stringify(workflow.connections), workflow.versionId, target.id]);
  }
  await run(db, 'COMMIT');
} catch (error) {
  try { await run(db, 'ROLLBACK'); } catch {}
  throw error;
} finally {
  await new Promise((resolve) => db.close(resolve));
}

console.log(JSON.stringify({ ok: true, workflowIds: targets.map((target) => target.id), backupDir }, null, 2));
