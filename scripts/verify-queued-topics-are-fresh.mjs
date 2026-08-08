// 대기 중인 소재가 이미 발행한 소재와 '같은 이야기'인지 본다.
//
// 이 검사가 있는 이유(2026-08-06): 중복 가드(TOPIC_DUPLICATE_GUARD_V1)는 제목만 본다.
// 그래서 글자가 안 겹치는 같은 주제가 계속 나갔다. 건강장수비결에 낙상 소재가 다섯 편
// 쌓였고, 사용자가 "너무 비슷한 릴스가 계속 나온다"고 지적했다.
//   욕실에서 미끄러지기 쉬운 순간 5
//   장롱 위 물건 꺼내다 다치는 순간 5
//   밤에 화장실 가다 넘어지지 않는 순서 4
//   집만 밝게 해도 넘어질 위험이 줄어드는 자리 4
// 마지막 둘은 '밤 화장실 길에 발밑 등을 두라'는 항목까지 같았다.
//
// 제목이 아니라 **행 내용**을 견준다. 발행된 팩의 원문은 '<채널> 소재/사용완료'에 남는다.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const channels = ['하루건강약사', '건강장수비결'];

// 같은 소재로 보는 기준. 낮추면 멀쩡한 소재까지 걸리고, 높이면 오늘 같은 중복을 놓친다.
const OVERLAP_LIMIT = 0.34;

// 조사·어미를 떼고 내용어만 남긴다. 이게 없으면 '넘어지지'와 '넘어질'이 다른 말이 된다.
const STOPWORDS = new Set(['그리고', '하지만', '때문에', '이것', '그것', '해요', '돼요', '있어요', '없어요', '드세요', '보세요', '하세요']);

function contentWords(text) {
  return String(text || '')
    .replace(/[^가-힣0-9 ]/g, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/(으로|에서|에게|부터|까지|보다|처럼|한테|이나|라도|마다|만큼|은|는|이|가|을|를|의|에|도|만|과|와|로|랑)$/, ''))
    .map((word) => word.replace(/(하지|하면|하고|해서|지면|으면|면서|아서|어서|니까|는데|지만|고요|다면|려면|어요|아요|세요|예요|이요|져요|워요|녀요|겨요|줘요|와요|나요)$/, ''))
    .filter((word) => word.length >= 2 && !STOPWORDS.has(word));
}

function packText(pack) {
  return [
    pack.hook_title,
    ...(pack.rank_items || []).flatMap((item) => [item.card_name, item.card_reason, item.name, item.reason]),
  ].filter(Boolean).join(' ');
}

// 자카드가 아니라 '작은 쪽 기준' 겹침을 쓴다. 항목 수가 달라도 같은 이야기면 잡아야 한다.
function overlapRatio(left, right) {
  const a = new Set(contentWords(left));
  const b = new Set(contentWords(right));
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

function loadPack(file) {
  try {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    return doc.final_pack || doc.pack || null;
  } catch {
    return null;
  }
}

const findings = [];
let comparisons = 0;

for (const channel of channels) {
  const queueDir = path.join(root, 'research', 'queue', channel);
  const usedDir = path.join(root, `${channel} 소재`, '사용완료');
  if (!fs.existsSync(queueDir)) continue;

  const published = [];
  if (fs.existsSync(usedDir)) {
    for (const name of fs.readdirSync(usedDir).filter((entry) => entry.endsWith('.json'))) {
      const pack = loadPack(path.join(usedDir, name));
      if (pack) published.push({ name, text: packText(pack), title: pack.hook_title || name });
    }
  }

  const queued = [];
  for (const name of fs.readdirSync(queueDir).filter((entry) => entry.endsWith('.json'))) {
    const pack = loadPack(path.join(queueDir, name));
    if (pack) queued.push({ name, text: packText(pack), title: pack.hook_title || name });
  }

  // 1) 대기 소재끼리
  for (let i = 0; i < queued.length; i += 1) {
    for (let j = i + 1; j < queued.length; j += 1) {
      comparisons += 1;
      const ratio = overlapRatio(queued[i].text, queued[j].text);
      if (ratio >= OVERLAP_LIMIT) {
        findings.push({ channel, kind: 'queued_vs_queued', ratio: Math.round(ratio * 100), a: queued[i].title, b: queued[j].title });
      }
    }
  }

  // 2) 대기 소재 vs 이미 발행한 소재
  for (const item of queued) {
    for (const past of published) {
      comparisons += 1;
      const ratio = overlapRatio(item.text, past.text);
      if (ratio >= OVERLAP_LIMIT) {
        findings.push({ channel, kind: 'queued_vs_published', ratio: Math.round(ratio * 100), a: item.title, b: past.title });
      }
    }
  }
}

for (const finding of findings) {
  console.error(`${finding.channel} ${finding.kind} ${finding.ratio}%\n    ${finding.a}\n    ${finding.b}`);
}
assert.equal(
  findings.length,
  0,
  `${findings.length} queued topic(s) retell a topic this channel already covered — pick a different subject, do not just reword the title`,
);

console.log(JSON.stringify({
  ok: true,
  comparisons,
  overlap_limit_pct: OVERLAP_LIMIT * 100,
  note: '제목이 아니라 행 내용을 견준다. 제목만 보는 중복 가드는 같은 주제를 계속 통과시켰다.',
}, null, 2));
