// 배경음 생성 지시의 단일 원본. 회로 7개가 여기서 같은 표를 받아 간다.
//
// 왜 생겼나 (2026-08-06): 회로마다 BGM 문구를 손으로 넣다 보니 세 갈래로 갈렸다.
//   - 본편 2회로: 프로필 6종 + 쿨다운
//   - 완성 이미지 2회로: 같은 프로필 6종이지만 480자에서 잘려 타악기 금지와 단조 금지
//     문장이 통째로 사라진 채 발송되고 있었다(실측 636자)
//   - 원본 릴스 2회로: 프로필 없이 문자열 하나가 하드코딩돼 모든 영상이 같은 지시
// 검사는 "코드에 문장이 있는가"만 봐서 잘림을 못 잡았다.
//
// 사용자 요구(2026-08-06): 곡의 풍·분위기·악기 편성·장조는 지금이 최고라 건드리지
// 말 것. 다만 곡이 서로 너무 비슷하니 다양성만 올릴 것.
// 그래서 프로필 6종과 제약 5줄은 한 글자도 안 바꾸고, 그 위에 편곡 축만 얹는다.
// 편곡 축은 템포·짜임새·음역·선율 진행·화성 색채·도입 형식이다. 전부 장조 안에서,
// 허용 악기 안에서 움직인다.

export const BGM_PROFILE_POOL = [
  { id: 'intimate_felt_piano', sound_family: 'piano_solo', title: '햇살 펠트 피아노', prompt: 'Bright friendly felt piano solo, buoyant rounded melody, sunny and gently cheerful.' },
  { id: 'hopeful_acoustic_piano', sound_family: 'piano_solo', title: '희망찬 어쿠스틱 피아노', prompt: 'Uplifting acoustic piano solo, flowing major-key melody, warm, light, and optimistic.' },
  { id: 'grounded_nylon_guitar', sound_family: 'guitar_solo', title: '밝은 나일론 기타', prompt: 'Sunny nylon acoustic guitar solo, lively fingerstyle phrases, friendly and contented.' },
  { id: 'reassuring_piano_strings', sound_family: 'piano_strings', title: '기분 좋은 피아노와 현악', prompt: 'Cheerful acoustic piano with soft bowed strings, reassuring, graceful, and positive.' },
  { id: 'daylight_guitar_piano', sound_family: 'guitar_piano', title: '햇살 기타와 피아노', prompt: 'Happy nylon acoustic guitar with bright piano, warm daylight mood and easy movement.' },
  { id: 'restorative_strings_piano', sound_family: 'piano_strings', title: '산뜻한 현악과 피아노', prompt: 'Light joyful bowed strings with gentle piano, spacious, fresh, and quietly celebratory.' },
];

// 안전 문장. 순서가 곧 우선순위다. 길이 제한에 걸리면 뒤에서부터 사라지므로
// 사람 목소리 금지를 맨 앞에 둔다.
export const BGM_CONSTRAINT_LINES = [
  'ZERO HUMAN VOICE: no singing, humming, la-la, ooh/aah, vocalise, scat, choir, chant, a cappella, backing vocals, vocal chops, wordless vocals, or speech. Instruments only, start to finish.',
  'Allowed instruments only: felt piano, gentle acoustic piano, nylon acoustic guitar, soft bowed strings.',
  'No synth, pad, ambient wash, breathy texture, percussion, drums, brushes, marimba, mallets, electronic or fusion sounds.',
  'No dark, sad, melancholic, ominous, tense, sleepy, or minor-key mood.',
  'Bright, cheerful, warm, optimistic major-key instrumental background music, gently lively.',
];

export const BGM_NEGATIVE_TAGS = 'voice, vocals, singing, lyrics, speech, humming, hum, choir, chant, ooh, aah, la la, vocalise, scat, a cappella, backing vocals, harmonies, vocal chops, wordless vocals, vocal pad, voice-like synth, spoken words, whispering, breathing, dark, sad, melancholic, ominous, tense, sleepy, minor key';
export const BGM_SAFETY_ENVELOPE = 'bright_acoustic_zero_voice_v3';

// KIE(Suno)의 style 필드 상한은 1000자다. 본편은 900, 완성 이미지 회로는 480을 썼고
// 480짜리는 조용히 잘려 나갔다. 이제 한 값으로 맞춘다.
//
// 1000인 이유: V5_5 style 필드의 실제 상한이다. 처음엔 900으로 뒀는데, 보컬 금지
// 문장을 촘촘하게 늘리자 최악 조합이 1016자가 되면서 그 조합들만 편곡 줄을 잃게 됐다
// (검사가 잡았다). 안전 문장이 우선이므로 상한을 올리고 문장을 다듬어 맞췄다.
// verify-bgm-contracts.mjs가 최악값을 매번 계산하니, 넘치면 검사가 먼저 막는다.
//
// 참고: AGENTS.md의 "500자 제한"은 심플 모드 prompt 필드 이야기다. 이 회로들은
// customMode로 style을 보내고, V5_5의 style 상한은 1000자다.
export const BGM_STYLE_MAX_CHARS = 1000;

// 곡을 얼마나 지시대로 뽑을지(styleWeight)와 얼마나 벗어나게 둘지(weirdnessConstraint).
//
// weirdness는 0.1에서 절대 올리지 않는다. 2026-08-06에 다양성을 늘리겠다고 0.32로
// 올렸다가 **사람 목소리와 허밍이 섞인 BGM이 나왔다**. instrumental: true 와 금지
// 태그가 다 붙어 있어도, weirdness를 풀면 Suno가 그 제약을 넘어선다. 사용자가 여러 번
// 금지한 사고를 내가 직접 재발시킨 값이다.
//
// 다양성은 이 값이 아니라 다른 데서 나온다 — 재생 구간 무작위화(lib/bgm-window.mjs)와
// 편곡 축 768가지 조합. 둘 다 보컬 위험이 0이다. 곡이 비슷하다고 느껴지면 축을 늘리지
// 이 숫자를 건드리지 마라. verify-bgm-contracts.mjs가 0.15를 넘으면 실패시킨다.
export const BGM_STYLE_WEIGHT = 0.9;
export const BGM_WEIRDNESS = 0.1;
export const BGM_WEIRDNESS_CEILING = 0.15;

// BGM 폴링 예산. 30초 뒤 한 번, 그 뒤 이만큼 기다렸다 한 번 더 본다.
//
// 왜 늘렸나 (2026-08-06): 최근 실행 31건 중 6건이 폴백 음원(assets/fallback-bgm.mp3)으로
// 떨어졌는데, 실패 사유가 전부 state=FIRST_SUCCESS 또는 TEXT_SUCCESS였다. 즉 실패가
// 아니라 **아직 만드는 중인데 120초 만에 포기**한 것이다. 그 6편은 서로 음악이 비슷한
// 정도가 아니라 바이트까지 같은 파일을 썼다.
export const BGM_RETRY_WAIT_SECONDS = 240;

// 편곡 축. 곡의 분위기·악기·조성은 여기서 절대 건드리지 않는다. 연주 방식만 바꾼다.
export const BGM_ARRANGEMENT_AXES = {
  tempo: [
    'about 92 BPM',
    'about 96 BPM',
    'about 100 BPM',
    'about 104 BPM',
  ],
  texture: [
    'flowing broken chords running under the melody',
    'simple block chords with clear space between phrases',
    'one plain melody line over sparse accompaniment',
    'a light repeating figure under a slow melody',
  ],
  register: [
    'played in the middle register, close and rounded',
    'the melody sits in the upper register, light and clear',
    'the melody sits high over a warm low anchor',
  ],
  motion: [
    'the melody moves mostly stepwise between neighbouring notes',
    'phrases rise gently and settle downward at the end',
    'two voices trade short call-and-response phrases',
    'a short two-note motif repeats and grows',
  ],
  color: [
    'plain major triads',
    'warm add9 and sus2 colours',
    'soft major-seventh colours',
    'open fifths held under the melody',
  ],
  // 도입 형식 축은 뺐다. 렌더가 곡의 도입부를 아예 건너뛰고 중간부터 쓰기 때문에
  // (lib/bgm-window.mjs) 시청자에게 도입 형식은 들리지 않는다. 들리지도 않는 문장에
  // 60자를 쓰면 style 상한만 잡아먹는다.
};

export function bgmArrangementCombinationCount() {
  return Object.values(BGM_ARRANGEMENT_AXES).reduce((total, options) => total * options.length, 1);
}

// 워크플로 안에서 쓸 JS 조각. n8n 코드 노드는 이 저장소를 import할 수 없으므로
// 빌더가 이 문자열을 그대로 박아 넣는다. 회로 세 갈래가 같은 코드를 갖게 하는 방법이다.
export function bgmArrangementSource() {
  return `const BGM_ARRANGEMENT_AXES = ${JSON.stringify(BGM_ARRANGEMENT_AXES, null, 0)};
function bgmArrangementFor(seedText) {
  const text = String(seedText || '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  // FNV의 하위 비트는 잘 안 흩어진다. 축 하나는 선택지가 2개(% 2), 여럿이 4개(% 4)라
  // 곧바로 나머지를 취하면 조합이 뭉친다(실측: 100개 중 서로 다른 조합이 53개뿐).
  // 나머지를 취하기 전에 한 번 섞는다.
  const mix = (value) => {
    let x = value >>> 0;
    x ^= x >>> 16; x = Math.imul(x, 2246822507);
    x ^= x >>> 13; x = Math.imul(x, 3266489909);
    x ^= x >>> 16;
    return x >>> 0;
  };
  const chosen = {};
  const parts = [];
  let axisIndex = 0;
  for (const axis of Object.keys(BGM_ARRANGEMENT_AXES)) {
    const options = BGM_ARRANGEMENT_AXES[axis];
    axisIndex += 1;
    hash = Math.imul(hash ^ (axis.charCodeAt(0) + axisIndex * 131), 16777619);
    const option = options[mix(hash) % options.length];
    chosen[axis] = option;
    parts.push(option);
  }
  return { chosen, line: 'Arrangement for this piece: ' + parts.join('; ') + '.' };
}`;
}

// 검사와 빌더가 같은 규칙으로 문자열을 만든다. 안전 문장이 잘려 나가는 사고를
// 구조적으로 막으려고, 자를 때는 항상 편곡 줄부터 버린다.
export function composeBgmStyle({ profilePrompt, profileId, arrangementLine, maxChars = BGM_STYLE_MAX_CHARS }) {
  const head = `Profile ${profileId}: ${profilePrompt}`;
  const safety = BGM_CONSTRAINT_LINES.join(' ');
  const withArrangement = [head, arrangementLine, safety].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (withArrangement.length <= maxChars) return withArrangement;
  const withoutArrangement = [head, safety].join(' ').replace(/\s+/g, ' ').trim();
  return withoutArrangement.slice(0, maxChars);
}
