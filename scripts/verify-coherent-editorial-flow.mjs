import assert from 'node:assert/strict';
import fs from 'node:fs';
import sqlite3 from 'sqlite3';
import { createRequire } from 'node:module';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const workflowFiles = [
  'workflows/n8n_geongangjangsubigyeol_manual.json',
  'workflows/n8n_하루건강약사_수동실행.json',
];
const workflowIds = new Map([
  ['baekse100Life01', {
    youtube: 'kVQv10ElQmt2iazM',
    profile: 'longevity_daily_function',
    channel: '건강장수비결',
    requiredProfileTerms: ['혈압·혈당 관리', '관절·균형·낙상 예방', '일상 기능과 자립'],
    recentTitles: ['혈압과 혈당을 함께 관리할 때 볼 것 5', '관절이 약할 때 낙상을 막는 습관 5', '집에서 혈압 관리할 때 놓치는 것 5'],
    recentPillars: ['cardiometabolic', 'joints_balance_falls', 'cardiometabolic'],
    suppliedTitle: '관절과 낙상 위험을 함께 확인할 것 5',
    suppliedPillar: 'joints_balance_falls',
  }],
  ['mxrYb3maJS31gEYC', {
    youtube: 'l7YqloikIKiIOtOq',
    profile: 'haru_health_literacy',
    channel: '하루건강약사',
    requiredProfileTerms: ['영양·음식 선택', '영양제·성분 이해', '피부·활력 관리'],
    recentTitles: ['영양제 성분표에서 확인할 것 5', '피부가 건조할 때 함께 볼 변화 5', '영양제 함량이 겹치는 경우 5'],
    recentPillars: ['supplement_ingredients', 'skin_vitality', 'supplement_ingredients'],
    suppliedTitle: '영양제 성분이 겹칠 때 확인할 것 5',
    suppliedPillar: 'supplement_ingredients',
  }],
]);
const require = createRequire(import.meta.url);
const runtimePack = {
  hook_title: '테스트 제목 3',
  subtitle: '서로 다른 핵심을 자연스럽게 정리',
  rank_items: [1, 2, 3].map((rank) => ({ rank, name: `의학적 조건과 행동을 자세히 설명하는 항목 ${rank}`, card_name: `쉬운 항목 ${rank}`, reason: `몸에서 생기는 원인과 선택 기준을 자세히 설명해요 ${rank}`, card_reason: `몸의 원인을 알면 선택이 쉬워져요 ${rank}` })),
  description: '완성된 설명',
  pinned_comment: '밝은 빛과 늦은 카페인은 잠을 얕게 만들 수 있어요. 구독하시고 몸의 원리를 쉽게 이해하는 건강 정보를 받아보세요.',
  bgm_prompt: 'warm gentle felt piano solo, calm reassuring mood',
};

for (const relativePath of workflowFiles) {
  const workflow = JSON.parse(fs.readFileSync(`${root}/${relativePath}`, 'utf8'));
  const expected = workflowIds.get(workflow.id);
  assert.ok(expected, `${relativePath}: unexpected workflow ID`);
  const load = workflow.nodes.find((node) => node.name === 'Load Config')?.parameters?.jsCode || '';
  const build = workflow.nodes.find((node) => node.name === 'Build Viral Rank Pack Request')?.parameters?.jsCode || '';
  const prepare = workflow.nodes.find((node) => node.name === 'Prepare Image and BGM Payloads')?.parameters?.jsCode || '';
  const parse = workflow.nodes.find((node) => node.name === 'Parse KIE Claude Pack')?.parameters?.jsCode || '';
  const mock = workflow.nodes.find((node) => node.name === 'Mock Viral Rank Pack')?.parameters?.jsCode || '';
  const retry = workflow.nodes.find((node) => node.name === 'Prepare Medical Retry Request')?.parameters?.jsCode || '';
  const postComment = JSON.stringify(workflow.nodes.find((node) => node.name === 'Post Top-Level Comment')?.parameters || {});
  const final = workflow.nodes.find((node) => node.name === 'Final Result')?.parameters?.jsCode || '';

  const virtualFiles = new Map();
  const uploadLogPath = `C:/virtual/${workflow.id}/upload-log.jsonl`;
  const queuePath = `C:/virtual/${workflow.id}/queue.txt`;
  virtualFiles.set(uploadLogPath, JSON.stringify({ title: '기존 형식 업로드', url: 'https://example.invalid/old' }) + '\n');
  const virtualFs = {
    existsSync: (filePath) => virtualFiles.has(String(filePath)),
    readFileSync: (filePath) => {
      const key = String(filePath);
      if (!virtualFiles.has(key)) throw new Error(`virtual file missing: ${key}`);
      return virtualFiles.get(key);
    },
    writeFileSync: (filePath, value) => virtualFiles.set(String(filePath), String(value)),
    appendFileSync: (filePath, value) => virtualFiles.set(String(filePath), (virtualFiles.get(String(filePath)) || '') + String(value)),
    mkdirSync: () => {},
    readdirSync: () => [],
    renameSync: (source, destination) => {
      virtualFiles.set(String(destination), virtualFiles.get(String(source)) || '');
      virtualFiles.delete(String(source));
    },
    statSync: () => ({ birthtimeMs: 0, ctimeMs: 0, mtimeMs: 0 }),
  };
  const virtualRequire = (specifier) => specifier === 'fs' ? virtualFs : require(specifier);
  const persistedProfile = { id: 'grounded_nylon_guitar', title: '차분한 나일론 기타', sound_family: 'guitar_solo' };
  new Function('require', '$input', final)(virtualRequire, {
    first: () => ({ json: {
      config: { upload_log_path: uploadLogPath, dry_run: false, test_mode: false, run_mode: 'verification' },
      pack: { hook_title: '새 업로드 제목', rank_items: [] },
      diversity: { bgm_profile: persistedProfile },
      medical_review: { pass: true },
      rendered_video_url: 'https://example.invalid/rendered.mp4',
      youtube: { url: 'https://example.invalid/new', video_id: 'new-video', privacy_status: 'private' },
      comment: { skipped: true },
    } }),
  });
  const loadedBgmHistory = new Function('require', '$input', load)(virtualRequire, {
    first: () => ({ json: {
      dry_run: true,
      upload_log_path: uploadLogPath,
      topic_queue_path: queuePath,
      topic_pending_dir: `C:/virtual/${workflow.id}/pending`,
      topic_used_dir: `C:/virtual/${workflow.id}/used`,
      topic_queue_used_log_path: `C:/virtual/${workflow.id}/used.jsonl`,
    } }),
  })[0].json.config;
  assert.deepEqual(loadedBgmHistory.recent_bgm_profiles, [persistedProfile.id], `${relativePath}: upload-log BGM profile did not round-trip through Final Result and Load Config`);
  assert.equal(loadedBgmHistory.recent_titles[0], '새 업로드 제목', `${relativePath}: newest upload-log row was not read first`);

  assert.match(build, /single_writer_v1/, `${relativePath}: single-writer version marker missing`);
  assert.match(load, new RegExp(`channel_editorial_profile:\\s*'${expected.profile}'`), `${relativePath}: channel profile is missing from Load Config`);
  assert.match(load, new RegExp(`channel_name:\\s*'${expected.channel}'`), `${relativePath}: channel name is missing from Load Config`);
  assert.match(load, /recent_titles_for_pillar_rotation/, `${relativePath}: raw title history for pillar rotation is missing`);
  assert.match(load, /recent_bgm_profiles/, `${relativePath}: recent BGM profile history is missing`);
  assert.match(load, /bgm_profile_id/, `${relativePath}: upload log BGM profile loader is missing`);
  assert.doesNotMatch(load, /return uniqueStrings\(titles\);/, `${relativePath}: title-history loader still removes repeated uploads`);
  assert.match(build, /CHANNEL_EDITORIAL_PROFILE_V1/, `${relativePath}: channel editorial profile marker missing`);
  assert.match(build, new RegExp(expected.profile), `${relativePath}: wrong channel editorial profile`);
  for (const term of expected.requiredProfileTerms) {
    assert.match(build, new RegExp(term), `${relativePath}: channel profile is missing ${term}`);
  }
  assert.match(build, /channelEditorialProfile\.pillars\.length\s*<\s*5/, `${relativePath}: channel profile does not enforce at least five broad pillars`);
  assert.match(build, /recentChannelPillars\.slice\(0,\s*2\)/, `${relativePath}: latest-two-pillar cooldown missing`);
  assert.match(build, /recentPillarCounts\[pillar\.id\].*<\s*2/s, `${relativePath}: recent-ten pillar repetition guard missing`);
  assert.match(build, /channelTopicPool/, `${relativePath}: channel-specific topic candidate pool missing`);
  assert.match(build, /channel_content_pillar:\s*selectedChannelPillar\.id/, `${relativePath}: selected channel pillar is missing from writer schema`);
  assert.match(build, /selected broad pillar is not a narrow micro-topic/i, `${relativePath}: anti-narrowing instruction missing`);
  assert.match(build, /max_tokens:\s*6000/, `${relativePath}: generation output budget is too small for complete JSON`);
  assert.match(build, /sole editorial writer/, `${relativePath}: generating AI must own the complete pack`);
  assert.match(build, /broad title.*diverse pillars|diverse pillars.*broad title/is, `${relativePath}: title-to-item scope rule missing`);
  assert.match(build, /every item must actually fulfill the title claim/i, `${relativePath}: semantic title-to-item contract missing`);
  assert.match(build, /TITLE_SCOPE_V3/, `${relativePath}: semantic list-type contract marker missing`);
  assert.match(build, /count-bearing.*semantic class|semantic class.*count-bearing/is, `${relativePath}: title and ranked entries do not share an explicit semantic class`);
  assert.match(build, /ATTENTION_PROMISE_V\d+/, `${relativePath}: truthful attention contract marker missing`);
  assert.match(build, /this may apply to me/i, `${relativePath}: viewer self-relevance test missing`);
  assert.match(build, /concrete condition, situation, action, choice, or observable signal/i, `${relativePath}: concrete hook subject contract missing`);
  assert.match(build, /subtitle must add the missing condition, contrast, or payoff/i, `${relativePath}: subtitle only repeats the hook title`);
  // The channel owner raised the aggression ceiling on 2026-07-21: urgency,
  // stakes, and imperatives are now encouraged. What remains prohibited is the
  // honesty floor — fabricated numbers, fake insiders, and disease scares.
  assert.match(build, /INTENSITY:.*go hard/is, `${relativePath}: raised-intensity direction missing from the hook contract`);
  assert.match(build, /invented statistics or percentages.*invented authority.*disease scares/is, `${relativePath}: the honesty floor under aggressive hooks is not prohibited`);
  assert.match(build, /RESEARCH_SOURCE_PACK_V1/, `${relativePath}: research source pack resolver missing`);
  assert.match(build, /RESEARCH_GROUNDING_V\d+/, `${relativePath}: research grounding contract marker missing`);
  assert.equal((build.match(/RESEARCH_GROUNDING_V\d+/g) || []).length, 1, `${relativePath}: research grounding contract is duplicated`);
  assert.match(build, /SOURCE_SELECTION_V\d+/, `${relativePath}: interest and decision-value selection contract missing`);
  assert.equal((build.match(/SOURCE_SELECTION_V\d+/g) || []).length, 1, `${relativePath}: selection contract is duplicated`);
  assert.match(build, /RESEARCH_SOURCE_REQUIRED/, `${relativePath}: ungrounded live generation is not stopped`);
  assert.match(build, /most change what the viewer already believes or already does/i, `${relativePath}: selection contract does not demand judgment-changing material`);
  assert.match(build, /surprise value/i, `${relativePath}: selection contract does not score surprise`);
  assert.match(build, /Earn attention with the true finding itself/i, `${relativePath}: selection contract does not separate real interest from bait`);
  assert.match(build, /absent from the cited fact evidence_summary/i, `${relativePath}: writer may add facts outside the source pack`);
  assert.match(build, /CLAIM_STRENGTH_V2/, `${relativePath}: evidence-calibrated claim contract marker missing`);
  assert.match(build, /observation.*association.*cause.*diagnosis/is, `${relativePath}: claim contract does not distinguish evidence relations`);
  assert.match(build, /established high-confidence facts/i, `${relativePath}: evidence-aware topic writing contract missing`);
  assert.match(build, /medically useful point|practical decision/i, `${relativePath}: useful-detail contract missing`);
  assert.match(build, /DECISION_DETAIL_V1/, `${relativePath}: decision-detail contract marker missing`);
  assert.match(build, /not inferable from the title or item name/i, `${relativePath}: writer may restate the title instead of adding information`);
  assert.match(build, /what the viewer should notice or do differently.*why/is, `${relativePath}: writer lacks a concrete decision-change requirement`);
  assert.match(build, /state established facts directly/i, `${relativePath}: writer lacks an anti-overhedging rule`);
  assert.match(build, /do not stack.*may.*could.*might|do not stack.*수 있어요/is, `${relativePath}: writer allows repeated safety-padding hedges`);
  assert.match(build, /clinical_depth_v1/i, `${relativePath}: clinical-depth policy marker missing`);
  assert.match(build, /CLEAR_KOREAN_COPY_V2/, `${relativePath}: consolidated Korean copy contract missing`);
  assert.equal((build.match(/CLEAR_KOREAN_COPY_V2/g) || []).length, 1, `${relativePath}: consolidated Korean copy contract is duplicated`);
  assert.doesNotMatch(build, /NATURAL_KOREAN_COPY_V1|FIRST_READ_KOREAN_V1|HUMAN_KOREAN_VOICE_V1/, `${relativePath}: superseded overlapping Korean copy contracts remain`);
  assert.match(build, /draft the complete reason first.*derive card_name and card_reason/is, `${relativePath}: card copy is not derived from the complete explanation`);
  assert.match(build, /title.*card_name.*card_reason.*without the long reason/is, `${relativePath}: standalone card-pair reading test missing`);
  assert.match(build, /what happens.*under which condition.*specific meaning or action/is, `${relativePath}: actor, condition, and object contract missing`);
  assert.match(build, /확인해요.*살펴봐요.*without naming the object/is, `${relativePath}: vague placeholder-verb guard missing`);
  assert.match(build, /do not reverse.*observed loss of capacity.*cause/is, `${relativePath}: ambiguous causal-direction guard missing`);
  assert.match(build, /report heading|search keyword list/i, `${relativePath}: mechanical AI-copy guard is missing`);
  assert.match(build, /without rereading|without mentally supplying/is, `${relativePath}: first-read comprehension test missing`);
  assert.match(build, /final native-Korean copy-edit pass/i, `${relativePath}: final Korean read-through is missing`);
  assert.match(build, /subject.*predicate|predicate.*subject/is, `${relativePath}: natural Korean subject-predicate check missing`);
  assert.match(build, /physiological|clinical|medical relevance/i, `${relativePath}: direct health-depth contract missing`);
  assert.match(build, /housekeeping|organizing/i, `${relativePath}: housekeeping-only content guard missing`);
  assert.match(build, /해요체/, `${relativePath}: conversational Korean tone contract missing`);
  assert.match(build, /합니다체|습니다/i, `${relativePath}: formal sentence-ending prohibition missing`);
  assert.match(build, /card_name/i, `${relativePath}: short image-copy field missing`);
  assert.match(build, /common everyday Korean/i, `${relativePath}: plain visible-word contract missing`);
  assert.match(build, /Do not fabricate exact minutes, repetitions, percentages, thresholds, or measurements/i, `${relativePath}: fabricated-precision guard missing`);
  assert.match(build, /channelAllowedLaneIds/, `${relativePath}: health-channel topic lane allowlist missing`);
  assert.match(build, /primary promise must directly concern health/i, `${relativePath}: channel-concept generation contract missing`);
  assert.match(build, /channel_concept_candidate_rejected/, `${relativePath}: off-concept candidate filter missing`);
  assert.match(build, /card_reason.*at most 40 Korean characters/is, `${relativePath}: writer mobile-card contract missing`);
  assert.match(build, /Never put 왜:.*card_reason/i, `${relativePath}: writer label prohibition missing`);
  assert.match(build, /COMMENT_SUMMARY_V1/, `${relativePath}: summary-style comment contract missing`);
  assert.equal((build.match(/COMMENT_SUMMARY_V1/g) || []).length, 1, `${relativePath}: duplicate summary-style comment instructions remain`);
  assert.match(build, /summarize the exact title and item set/i, `${relativePath}: comment does not summarize the exact pack`);
  assert.match(build, /most useful actions or principles/i, `${relativePath}: comment summary lacks useful-detail selection`);
  assert.match(build, /one restrained subscription invitation/i, `${relativePath}: calm subscription closing is missing`);
  assert.match(build, /Do not ask a question|no questions/i, `${relativePath}: question CTA prohibition missing`);
  assert.match(build, /Do not ask viewers to reply or comment|no requests to reply or comment/i, `${relativePath}: reply CTA prohibition missing`);
  assert.match(build, /Do not ask for likes|no like requests/i, `${relativePath}: like CTA prohibition missing`);
  assert.match(build, /invent a first-person channel-owner or family anecdote/i, `${relativePath}: fabricated comment anecdote guard missing`);
  assert.doesNotMatch(build, /COMMENT_VOICE_V2|Ask one thoughtful question|ask one concrete question/i, `${relativePath}: old question-style comment contract remains`);
  assert.match(build, /Avoid slang, cute phrasing, casual chatter, emoji decoration/i, `${relativePath}: casual comment guard missing`);
  assert.match(build, /under 260 Korean characters/i, `${relativePath}: concise comment schema contract missing`);
  assert.match(postComment, /\$json\.pack\.pinned_comment/, `${relativePath}: comment node must post the writer-authored pack comment unchanged`);
  if (expected.profile === 'haru_health_literacy') {
    assert.match(build, /understand their body.*ingredients.*health choices/i, `${relativePath}: 하루건강약사 comment closing is not channel-specific`);
  } else {
    assert.match(build, /healthy aging.*daily function.*independence/i, `${relativePath}: 건강장수비결 comment closing is not channel-specific`);
  }
  assert.doesNotMatch(build, /18-32 Korean characters|10-24 Korean characters/i, `${relativePath}: hard copy-length schema still constrains the writer`);
  assert.doesNotMatch(build, /Temporary draft only/i, `${relativePath}: schema still tells writer final description is temporary`);
  assert.match(build, /under 650 Korean characters.*numbered item list/i, `${relativePath}: final description schema contract missing`);
  assert.match(build, /numbered list with one concise line per ranked item/i, `${relativePath}: structured YouTube description contract missing`);
  assert.match(build, /Never make description one dense paragraph/i, `${relativePath}: dense-description guard missing`);
  assert.match(build, /3-5 relevant hashtags/i, `${relativePath}: description hashtag contract missing`);
  assert.match(retry, /one concise numbered line per ranked item/i, `${relativePath}: retry lost structured description contract`);
  assert.match(retry, /Never return one dense paragraph/i, `${relativePath}: retry dense-description guard missing`);
  assert.match(retry, /physiological|clinical|medical relevance/i, `${relativePath}: retry lost health-depth contract`);
  assert.match(retry, /해요체/, `${relativePath}: retry lost conversational Korean tone`);
  assert.match(retry, /card_name/i, `${relativePath}: retry lost short visible-copy contract`);
  assert.match(retry, /CLEAR_KOREAN_COPY_V2/, `${relativePath}: retry lost consolidated Korean copy contract`);
  assert.equal((retry.match(/CLEAR_KOREAN_COPY_V2/g) || []).length, 1, `${relativePath}: retry duplicates the consolidated Korean copy contract`);
  assert.doesNotMatch(retry, /NATURAL_KOREAN_COPY_V1|FIRST_READ_KOREAN_V1|HUMAN_KOREAN_VOICE_V1/, `${relativePath}: retry retains superseded overlapping copy contracts`);
  assert.match(retry, /title.*card_name.*card_reason.*without the long reason/is, `${relativePath}: retry lost standalone card-pair reading test`);
  assert.match(retry, /TITLE_SCOPE_V3/, `${relativePath}: retry lost semantic list-type contract`);
  assert.match(retry, /ATTENTION_PROMISE_V\d+/, `${relativePath}: retry lost truthful attention contract`);
  assert.equal((retry.match(/ATTENTION_PROMISE_V\d+/g) || []).length, 1, `${relativePath}: retry duplicates the attention contract`);
  assert.match(retry, /DECISION_DETAIL_V1/, `${relativePath}: retry lost decision-detail contract`);
  assert.equal((retry.match(/DECISION_DETAIL_V1/g) || []).length, 1, `${relativePath}: retry duplicates the decision-detail contract`);
  assert.match(retry, /state established facts directly/i, `${relativePath}: retry lost anti-overhedging guidance`);
  assert.match(retry, /RESEARCH_GROUNDING_V\d+/, `${relativePath}: retry lost the research grounding contract`);
  assert.match(retry, /research_source_pack/, `${relativePath}: retry does not re-supply the research pack to the writer`);
  assert.match(retry, /CLAIM_STRENGTH_V2/, `${relativePath}: retry lost evidence-calibrated claim contract`);
  assert.match(retry, /COMMENT_SUMMARY_V1/, `${relativePath}: retry lost summary-style comment contract`);
  assert.match(retry, /Do not ask a question|no questions/i, `${relativePath}: retry lost question CTA prohibition`);
  assert.match(retry, /one restrained subscription invitation/i, `${relativePath}: retry lost calm subscription closing`);
  assert.match(build, /optional 해요체 boundary or action only when it adds distinct value/i, `${relativePath}: optional caution contract missing`);
  assert.doesNotMatch(build, /Final BGM profile is selected downstream/, `${relativePath}: downstream BGM rewrite instruction remains`);
  assert.match(build, /bgm_prompt: 'short warm acoustic instrumental mood direction/i, `${relativePath}: writer BGM schema does not request varied safe acoustic moods`);
  assert.doesNotMatch(build, /Piano must be the only instrument/i, `${relativePath}: writer is still locked to one piano sound`);

  assert.match(prepare, /bgmWriterDirection/, `${relativePath}: writer BGM direction is not used`);
  assert.match(prepare, /recentBgmProfiles/, `${relativePath}: BGM profile cooldown is missing`);
  assert.match(prepare, /sound_family/, `${relativePath}: perceptual BGM family metadata is missing`);
  assert.match(prepare, /nylon acoustic guitar/i, `${relativePath}: nylon-guitar variation is missing`);
  assert.match(prepare, /soft bowed strings/i, `${relativePath}: soft-string variation is missing`);
  if (/positiveBgmText\(/.test(prepare)) assert.match(prepare, /function positiveBgmText\(/, `${relativePath}: BGM helper is called but undefined`);
  assert.doesNotMatch(prepare, /const bgmProfile = pickBgmProfile\(\);/, `${relativePath}: deterministic BGM profile still active`);
  assert.doesNotMatch(prepare, /soundTempo: bgmProfile\.tempo|soundKey: bgmProfile\.key/, `${relativePath}: forced tempo or key remains`);
  assert.match(final, /bgm_profile_id/, `${relativePath}: completed upload does not persist its BGM profile`);
  assert.match(prepare, /x 0-990 px and y 130-1800 px/, `${relativePath}: expanded main-card footprint missing`);
  assert.match(prepare, /no reserved left background band/i, `${relativePath}: left dead zone was not removed`);
  // Published frames tried both extremes: title against the Shorts search bar,
  // then the last row clipped at the bottom. 130 top / 120 bottom is the tuned
  // middle, and the fill contract requires the last row fully inside.
  assert.match(prepare, /90 px right.*130 px top.*120 px bottom/s, `${relativePath}: Shorts UI exclusion bands missing or wrong depth`);
  assert.match(prepare, /VERTICAL_FILL_V2/, `${relativePath}: bottom-fill contract missing, cards will compress upward or clip again`);
  assert.match(prepare, /BAND_BACKGROUND_V1/, `${relativePath}: reserved bands would render as blank strips without the background-continuation contract`);
  assert.match(prepare, /GLYPH_INTEGRITY_V1/, `${relativePath}: minimum glyph size contract missing, small Korean text renders broken`);
  assert.match(prepare, /SUBSCRIBE_FOOTER_V1/, `${relativePath}: bottom-band subscribe footer contract missing`);
  assert.match(prepare, /매일 하나씩 전해 드려요. 구독해 두시면/, `${relativePath}: dignified value-first subscribe copy missing`);
  assert.match(prepare, /POSTER_READABILITY_V2/, `${relativePath}: generalized poster readability marker missing`);
  assert.match(prepare, /one primary visual region/i, `${relativePath}: image prompt has no frame-level visual budget`);
  assert.match(prepare, /text-first ranked rows/i, `${relativePath}: ranked rows are not constrained to a readable information hierarchy`);
  assert.match(prepare, /compact non-narrative cue/i, `${relativePath}: row-level visual allowance is not bounded`);
  assert.match(prepare, /multiple full narrative scenes/i, `${relativePath}: image prompt still permits independent scene stacks`);
  assert.match(prepare, /background, material, and color direction/i, `${relativePath}: visual variation is not limited to non-structural styling`);
  assert.match(prepare, /single consistent text system/i, `${relativePath}: title and ranked rows can still fragment into unrelated containers`);
  assert.match(prepare, /one continuous reading path/i, `${relativePath}: rank order can still fragment across independent layouts`);
  assert.doesNotMatch(prepare, /mini-comic|5-7 small panels|every numbered Korean item into objects/i, `${relativePath}: legacy multi-panel format instructions conflict with the poster contract`);
  assert.match(prepare, /reserved bands are exclusion zones for critical content, not empty voids/i, `${relativePath}: image prompt does not reserve the top UI band`);
  assert.match(prepare, /auxiliary.*may be cropped or covered/i, `${relativePath}: auxiliary-copy crop tolerance missing`);
  assert.match(prepare, /readable in a small channel-grid thumbnail/i, `${relativePath}: thumbnail readability contract missing`);
  assert.match(prepare, /Never solve fitting by shrinking all text/i, `${relativePath}: tiny-text prevention missing`);
  assert.match(prepare, /main card may reach the left frame edge/i, `${relativePath}: left-expanded card permission missing`);
  assert.match(prepare, /clear of the top, right, and bottom UI bands/i, `${relativePath}: critical UI clearance missing`);
  assert.doesNotMatch(prepare, /dominate the whole composition/, `${relativePath}: full-bleed layout instruction conflicts with safe zone`);
  assert.doesNotMatch(prepare, /the 왜: explanation below it/i, `${relativePath}: literal 왜 label is still forced`);
  assert.match(prepare, /supplied card_reason exactly once/i, `${relativePath}: image card_reason contract missing`);
  assert.match(prepare, /item\.card_name\s*\|\|\s*item\.name/, `${relativePath}: image must prefer writer-authored short card_name`);
  assert.match(prepare, /do not alter|never alter/i, `${relativePath}: exact Korean copy preservation instruction missing`);
  assert.match(prepare, /Never add labels such as 왜:/i, `${relativePath}: image label prohibition missing`);
  assert.match(prepare, /Mobile readability outranks decoration/i, `${relativePath}: mobile hierarchy guidance missing`);
  assert.match(prepare, /Decoration must support the topic and never look like extra data/i, `${relativePath}: decoration restraint missing`);
  assert.match(prepare, /channelVisualIdentity/, `${relativePath}: channel-specific image identity missing`);
  assert.match(prepare, /haru_health_literacy/, `${relativePath}: 하루건강약사 image identity branch missing`);
  assert.match(prepare, /longevity_daily_function/, `${relativePath}: 건강장수비결 image identity branch missing`);
  assert.doesNotMatch(parse, /recent duplicate title; rotating fallback pack used/i, `${relativePath}: duplicate title still discards the single-writer pack`);
  assert.match(parse, /content_duplicate_check/, `${relativePath}: duplicate title check metadata missing`);
  assert.match(parse, /card_reason:\s*reason/, `${relativePath}: fallback packs lack mobile card copy compatibility`);
  assert.match(parse, /blocking: true/, `${relativePath}: recent duplicate must trigger regeneration`);
  assert.match(parse, /fallbackPackChannelMetadata/, `${relativePath}: recoverable AI fallback lacks channel metadata`);
  assert.match(mock, /fallbackPackChannelMetadata/, `${relativePath}: dry-run fallback lacks channel metadata`);
  const executeBuild = new Function('$', '$input', build);
  const built = executeBuild(
    (name) => {
      assert.equal(name, 'Load Config');
      return { first: () => ({ json: { config: {
        rank_count: null,
        rank_count_min: 3,
        rank_count_max: 5,
        topic_queue: { selected: null },
        recent_titles: expected.recentTitles,
        recent_titles_for_pillar_rotation: expected.recentTitles,
        category_cooldown_window: 5,
        category_cooldown_threshold: 2,
        blocked_topic_categories: [],
        variation_seed: `channel-diversity-${workflow.id}`,
        topic_candidates: [],
        kie_ai_model: 'verification-model',
        require_research_source_pack: false,
      } } }) };
    },
    { all: () => [] },
  )[0].json;
  assert.equal(built.channel_editorial_profile.id, expected.profile, `${relativePath}: runtime selected the wrong channel profile`);
  assert.ok(built.channel_editorial_profile.pillars.length >= 5, `${relativePath}: runtime profile is too narrow`);
  assert.deepEqual(built.recent_channel_pillars, expected.recentPillars, `${relativePath}: recent titles were mapped to the wrong channel pillars`);
  assert.ok(!new Set(expected.recentPillars.slice(0, 2)).has(built.selected_channel_pillar.id), `${relativePath}: runtime repeated one of the latest two pillars`);
  assert.ok((expected.recentPillars.filter((id) => id === built.selected_channel_pillar.id).length) < 2, `${relativePath}: runtime reused an overrepresented recent pillar`);
  assert.ok(built.topic_candidates.slice(0, 3).every((candidate) => candidate.pillar === built.selected_channel_pillar.id), `${relativePath}: selected pillar candidates are not prioritized`);
  const repeatedTitleHistory = [expected.recentTitles[0], expected.recentTitles[0], expected.recentTitles[1]];
  const repeatedHistoryBuild = executeBuild(
    () => ({ first: () => ({ json: { config: {
      rank_count: null,
      rank_count_min: 3,
      rank_count_max: 5,
      topic_queue: { selected: null },
      recent_titles: [...new Set(repeatedTitleHistory)],
      recent_titles_for_pillar_rotation: repeatedTitleHistory,
      category_cooldown_window: 5,
      category_cooldown_threshold: 2,
      blocked_topic_categories: [],
      variation_seed: `repeated-history-${workflow.id}`,
      topic_candidates: [],
      kie_ai_model: 'verification-model',
      require_research_source_pack: false,
    } } }) }),
    { all: () => [] },
  )[0].json;
  assert.deepEqual(repeatedHistoryBuild.recent_channel_pillars.slice(0, 2), [expected.recentPillars[0], expected.recentPillars[0]], `${relativePath}: repeated uploads were collapsed before pillar counting`);
  assert.notEqual(repeatedHistoryBuild.selected_channel_pillar.id, expected.recentPillars[0], `${relativePath}: twice-used recent pillar was selected again`);
  const suppliedTopicBuild = executeBuild(
    () => ({ first: () => ({ json: { config: {
      rank_count: null,
      rank_count_min: 3,
      rank_count_max: 5,
      topic_queue: { selected: null },
      recent_titles: [],
      category_cooldown_window: 5,
      category_cooldown_threshold: 2,
      blocked_topic_categories: [],
      variation_seed: `supplied-topic-${workflow.id}`,
      topic_candidates: [expected.suppliedTitle],
      kie_ai_model: 'verification-model',
      require_research_source_pack: false,
    } } }) }),
    { all: () => [] },
  )[0].json;
  assert.equal(suppliedTopicBuild.selected_channel_pillar.id, expected.suppliedPillar, `${relativePath}: supplied topic did not select its matching channel pillar`);
  const mockResult = new Function('$input', mock)({
    first: () => ({ json: { ...built, config: { ...built.config, dry_run: true, test_mode: true, variation_seed: `mock-${workflow.id}`, rank_count_min: 3, rank_count_max: 5 } } }),
  })[0].json;
  assert.equal(mockResult.pack.channel_editorial_profile, expected.profile, `${relativePath}: dry-run fallback lost channel profile`);
  const fallbackPillarText = (pack) => [
    pack.hook_title,
    pack.theme,
    ...(Array.isArray(pack.rank_items) ? pack.rank_items.flatMap((item) => [item.name, item.reason]) : []),
  ].filter(Boolean).join(' ');
  const inferFallbackPillar = (pack) => built.channel_editorial_profile.pillars.map((pillar) => ({
    id: pillar.id,
    score: (pillar.keywords || []).reduce((sum, keyword) => fallbackPillarText(pack).includes(keyword) ? sum + [...keyword].length : sum, 0),
  })).filter((entry) => entry.score > 0).sort((left, right) => right.score - left.score)[0]?.id || built.selected_channel_pillar.id;
  assert.equal(mockResult.pack.channel_content_pillar, inferFallbackPillar(mockResult.pack), `${relativePath}: dry-run fallback pillar does not match its actual content`);
  const mockViewerCopy = [mockResult.pack.subtitle, mockResult.pack.video_script, mockResult.pack.description].join(' ');
  assert.doesNotMatch(mockViewerCopy, /[가-힣]니다(?:[.!?]|\s|$)/, `${relativePath}: dry-run fallback reintroduced 합니다체`);
  const parseResult = new Function('$', '$input', parse)(
    (name) => {
      if (name === 'Prepare Medical Retry Request') return { all: () => [] };
      if (name === 'Build Viral Rank Pack Request') return { first: () => ({ json: built }) };
      throw new Error(`unexpected parser dependency: ${name}`);
    },
    { first: () => ({ json: { error: 'internal error, please try again later' } }) },
  )[0].json;
  assert.equal(parseResult.pack.channel_editorial_profile, expected.profile, `${relativePath}: recoverable AI fallback lost channel profile`);
  assert.equal(parseResult.pack.channel_content_pillar, inferFallbackPillar(parseResult.pack), `${relativePath}: recoverable AI fallback pillar does not match its actual content`);
  assert.match(retry, /allowedChannelPillars\.includes\(selectedChannelPillar\)/, `${relativePath}: quality retry does not prefer the configured selected pillar`);
  const retryResult = new Function('$input', retry)({
    first: () => ({ json: {
      ...built,
      config: { ...built.config, channel_editorial_profile: expected.profile, use_live_kie_ai: false, dry_run: true, content_quality_max_retries: 2 },
      pack: { ...runtimePack, channel_editorial_profile: expected.profile, channel_content_pillar: 'wrong_pillar' },
      content_quality_review: { pass: false, issues: ['channel_pillar_mismatch'] },
      kie_claude_request: { messages: [{ role: 'user', content: 'original request' }] },
    } }),
  })[0].json;
  assert.match(retryResult.content_quality_retry.instruction, new RegExp(`channel_content_pillar=${built.selected_channel_pillar.id}`), `${relativePath}: retry did not restore the configured selected pillar`);
  assert.doesNotMatch(retryResult.content_quality_retry.instruction, /channel_content_pillar=wrong_pillar/, `${relativePath}: retry preserved the rejected pack pillar`);
  const parseFallbackViewerCopy = [parseResult.pack.subtitle, parseResult.pack.video_script, parseResult.pack.description].join(' ');
  assert.doesNotMatch(parseFallbackViewerCopy, /[가-힣]니다(?:[.!?]|\s|$)/, `${relativePath}: recoverable AI fallback reintroduced 합니다체`);
  const executePrepare = new Function('require', '$input', prepare);
  const channelRuntimePack = { ...structuredClone(runtimePack), channel_editorial_profile: expected.profile, channel_content_pillar: 'verification_pillar' };
  const channelConfig = { channel_name: expected.channel, channel_editorial_profile: expected.profile };
  const prepared = executePrepare(require, { first: () => ({ json: { pack: channelRuntimePack, config: { ...channelConfig, variation_seed: 'verification', kie_bgm_model: 'V5_5', kie_image_model: 'gpt-image-2-text-to-image' } } }) })[0].json;
  const hostileBgmPack = structuredClone(runtimePack);
  hostileBgmPack.bgm_prompt = 'warm saxophone solo with gentle brass and flute';
  const hostilePrepared = executePrepare(require, { first: () => ({ json: { pack: hostileBgmPack, config: { ...channelConfig, variation_seed: 'verification-hostile', kie_bgm_model: 'V5_5', kie_image_model: 'gpt-image-2-text-to-image' } } }) })[0].json;
  assert.doesNotMatch(hostilePrepared.bgm_payload.prompt, /saxophone|brass|flute/i, `${relativePath}: writer-supplied unsafe instrument leaked into runtime prompt`);
  assert.match(prepared.bgm_payload.prompt, new RegExp(`^Profile ${prepared.diversity.bgm_profile.id}:`, 'i'), `${relativePath}: distinct profile direction is not first in the KIE prompt`);
  assert.match(prepared.bgm_payload.prompt, /No voice, vocals.*humming.*ooh\/aah.*wordless vocals/i, `${relativePath}: zero-voice safety envelope missing`);
  assert.match(prepared.bgm_payload.prompt, /Allowed instruments only:.*felt piano.*gentle acoustic piano.*nylon acoustic guitar.*soft bowed strings/i, `${relativePath}: acoustic allowlist missing`);
  assert.match(prepared.bgm_payload.prompt, /No synth, pad, ambient wash, breathy texture, percussion, drums, brushes, marimba, mallets/i, `${relativePath}: voice-like and rhythmic timbre guard missing`);
  assert.ok(prepared.bgm_payload.prompt.includes(prepared.diversity.bgm_profile.prompt), `${relativePath}: profile-specific sound direction was truncated`);
  assert.doesNotMatch(prepared.diversity?.bgm_profile?.prompt || '', /gayageum|korean fusion|pad|woodwind|marimba|percussion|drums/i, `${relativePath}: unsafe BGM variation remains`);
  assert.ok(prepared.bgm_payload.prompt.length <= 480, `${relativePath}: BGM prompt exceeds KIE limit`);
  assert.equal(prepared.bgm_payload.customMode, false, `${relativePath}: BGM must use simple mode`);
  assert.equal(prepared.bgm_payload.instrumental, true, `${relativePath}: KIE instrumental flag missing`);
  assert.equal(prepared.bgm_payload.grabLyrics, undefined, `${relativePath}: obsolete grabLyrics flag remains`);
  assert.equal(prepared.bgm_payload.soundTempo, undefined, `${relativePath}: runtime forced tempo`);
  assert.equal(prepared.bgm_payload.soundKey, undefined, `${relativePath}: runtime forced key`);
  assert.match(prepared.image_payload.input.prompt, /x 0-990 px and y 130-1800 px/, `${relativePath}: runtime image prompt lost expanded main-card footprint`);
  assert.match(prepared.image_payload.input.prompt, /90 px right, 130 px top, and 120 px bottom/i, `${relativePath}: runtime image prompt lost the UI reserve bands`);
  assert.match(prepared.image_payload.input.prompt, /VERTICAL_FILL_V2/, `${relativePath}: runtime image prompt lost the bottom-fill contract`);
  assert.match(prepared.image_payload.input.prompt, /BAND_BACKGROUND_V1/, `${relativePath}: runtime image prompt lost the band background continuation`);
  assert.match(prepared.image_payload.input.prompt, /GLYPH_INTEGRITY_V1/, `${relativePath}: runtime image prompt lost the glyph-size floor`);
  assert.match(prepared.image_payload.input.prompt, /FOOTER SUBSCRIBE LINE.*구독해 두시면/s, `${relativePath}: runtime image prompt lost the subscribe footer copy`);
  assert.match(prepared.image_payload.input.prompt, /largest practical Korean type/i, `${relativePath}: runtime image prompt lost large-type priority`);
  assert.match(prepared.image_payload.input.prompt, new RegExp(expected.channel), `${relativePath}: runtime image prompt lost the channel identity`);
  assert.doesNotMatch(prepared.visible_card_text, /(?:^|\n)왜\s*[:：]/, `${relativePath}: visible card still emits 왜 label`);
  assert.doesNotMatch(prepared.visible_card_text, /자세히 설명하는 문장/, `${relativePath}: visible card still emits full reason`);
  assert.doesNotMatch(prepared.visible_card_text, /FOOTER:/, `${relativePath}: visible card still emits footer CTA`);
  assert.match(prepared.visible_card_text, /몸의 원인을 알면 선택이 쉬워져요/, `${relativePath}: visible card lost writer-authored card_reason`);
  assert.match(prepared.visible_card_text, /쉬운 항목 1/, `${relativePath}: visible card lost short card_name`);
  assert.doesNotMatch(prepared.visible_card_text, /의학적 조건과 행동을 자세히 설명하는 항목 1/, `${relativePath}: visible card still uses long item name`);
  assert.match(prepared.image_payload.input.prompt, /Never add labels such as 왜:/i, `${relativePath}: runtime label prohibition missing`);
  assert.match(prepared.image_payload.input.prompt, /Mobile readability outranks decoration/i, `${relativePath}: runtime lost mobile hierarchy`);
  const profileIds = new Set();
  const profilePrompts = new Set();
  const profileSamples = new Map();
  for (let index = 0; index < 32; index += 1) {
    const varied = executePrepare(require, { first: () => ({ json: { pack: structuredClone(channelRuntimePack), config: { ...channelConfig, variation_seed: `verification-${index}`, kie_bgm_model: 'V5_5', kie_image_model: 'gpt-image-2-text-to-image' } } }) })[0].json;
    profileIds.add(varied.diversity?.bgm_profile?.id);
    profilePrompts.add(varied.diversity?.bgm_profile?.prompt);
    profileSamples.set(varied.diversity?.bgm_profile?.id, varied.diversity?.bgm_profile);
  }
  assert.deepEqual([...profileIds].sort(), [
    'daylight_guitar_piano',
    'grounded_nylon_guitar',
    'hopeful_acoustic_piano',
    'intimate_felt_piano',
    'reassuring_piano_strings',
    'restorative_strings_piano',
  ], `${relativePath}: one or more BGM profiles are unreachable or missing`);
  const profilePalette = [...profilePrompts].join(' ');
  assert.match(profilePalette, /felt piano/i, `${relativePath}: felt-piano profile is missing`);
  assert.match(profilePalette, /nylon acoustic guitar/i, `${relativePath}: nylon-guitar profile is missing`);
  assert.match(profilePalette, /soft bowed strings/i, `${relativePath}: soft-string profile is missing`);
  const cooldownPrepared = executePrepare(require, { first: () => ({ json: { pack: structuredClone(channelRuntimePack), config: { ...channelConfig, variation_seed: 'verification', recent_bgm_profiles: [prepared.diversity.bgm_profile.id], kie_bgm_model: 'V5_5', kie_image_model: 'gpt-image-2-text-to-image' } } }) })[0].json;
  assert.notEqual(cooldownPrepared.diversity?.bgm_profile?.id, prepared.diversity?.bgm_profile?.id, `${relativePath}: the most recent BGM profile repeated immediately`);
  assert.notEqual(cooldownPrepared.diversity?.bgm_profile?.sound_family, prepared.diversity?.bgm_profile?.sound_family, `${relativePath}: the most recent BGM sound family repeated immediately`);
  for (const previousProfile of profileSamples.values()) {
    assert.ok(previousProfile.sound_family, `${relativePath}: ${previousProfile.id} lacks sound-family metadata`);
    for (let index = 0; index < 16; index += 1) {
      const familyCooled = executePrepare(require, { first: () => ({ json: { pack: structuredClone(channelRuntimePack), config: { ...channelConfig, variation_seed: `family-cooldown-${previousProfile.id}-${index}`, recent_bgm_profiles: [previousProfile.id], kie_bgm_model: 'V5_5', kie_image_model: 'gpt-image-2-text-to-image' } } }) })[0].json;
      assert.notEqual(familyCooled.diversity?.bgm_profile?.sound_family, previousProfile.sound_family, `${relativePath}: ${previousProfile.sound_family} repeated after ${previousProfile.id}`);
    }
  }
}

const shared = JSON.parse(fs.readFileSync(`${root}/workflows/shared_content_quality_gate.json`, 'utf8'));
const reviewBuild = shared.nodes.find((node) => node.name === 'Build Quality Review Request')?.parameters?.jsCode || '';
const reviewParse = shared.nodes.find((node) => node.name === 'Parse and Enforce Quality Review')?.parameters?.jsCode || '';
assert.match(reviewBuild, /audit only/i, 'quality gate must be audit-only');
assert.match(reviewBuild, /Do not rewrite/i, 'quality gate rewrite prohibition missing');
assert.match(reviewParse, /pack: base\.pack/, 'quality gate must preserve the original writer pack');
assert.match(reviewParse, /independent_ai_audit_only/, 'audit-only mode marker missing');
assert.doesNotMatch(reviewParse, /pack: correctedPack/, 'quality gate still replaces writer pack');

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}

const db = new sqlite3.Database(`${root}/.n8n/database.sqlite`);
try {
  const rows = await all(db, 'SELECT id,nodes FROM workflow_entity WHERE id IN (?,?)', [...workflowIds.keys()]);
  assert.equal(rows.length, 2, 'both live legacy workflows must exist');
  for (const row of rows) {
    const nodes = JSON.parse(row.nodes);
    const build = nodes.find((node) => node.name === 'Build Viral Rank Pack Request')?.parameters?.jsCode || '';
    const prepare = nodes.find((node) => node.name === 'Prepare Image and BGM Payloads')?.parameters?.jsCode || '';
    const parse = nodes.find((node) => node.name === 'Parse KIE Claude Pack')?.parameters?.jsCode || '';
    assert.match(build, /single_writer_v1/, `${row.id}: live DB single-writer marker missing`);
    assert.match(build, /max_tokens:\s*6000/, `${row.id}: live generation output budget is too small`);
    assert.match(prepare, /bgmWriterDirection/, `${row.id}: live DB writer-directed BGM missing`);
    assert.doesNotMatch(parse, /recent duplicate title; rotating fallback pack used/i, `${row.id}: live DB still replaces duplicate AI packs with fallback`);
    if (/positiveBgmText\(/.test(prepare)) assert.match(prepare, /function positiveBgmText\(/, `${row.id}: live DB BGM helper is called but undefined`);
    const kieIds = nodes.flatMap((node) => Object.values(node.credentials || {}).map((credential) => credential.id));
    assert.ok(kieIds.includes('MV5JVbdiJSoVx9O8'), `${row.id}: existing KIE credential binding changed`);
    assert.ok(kieIds.includes(workflowIds.get(row.id).youtube), `${row.id}: existing YouTube credential binding changed`);
    const retry = nodes.find((node) => node.name === 'Prepare Medical Retry Request')?.parameters?.jsCode || '';
    assert.doesNotMatch(retry, /18-32 Korean character/i, `${row.id}: retry reintroduces hard copy length`);
    assert.match(retry, /one concise numbered line per ranked item/i, `${row.id}: live retry lost structured description contract`);
  }
} finally {
  await new Promise((resolve) => db.close(resolve));
}

console.log('PASS: coherent single-writer editorial flow and writer-directed BGM verified');
