// KIE로 실제로 나가는 bgm_payload를 회로마다 뽑아서 API 한도에 맞는지 잰다.
//
// 이 검사가 있는 이유(2026-08-06): 이 저장소는 "규칙 문장이 코드에 있는가"만 검사해서
// 같은 종류의 사고를 세 번 통과시켰다.
//   1. 완성 이미지 회로가 프롬프트를 480자에서 잘라 타악기·단조 금지가 KIE에 안 갔다.
//      검사는 그 문장들이 코드에 있으니 초록이었다.
//   2. 보컬 금지어를 늘리자 negativeTags가 293자가 됐고 KIE가 422로 요청을 거절해
//      회로가 통째로 멈췄다. 검사는 여전히 초록이었다.
//   3. 같은 변경으로 style 최악 조합이 상한을 넘어 편곡 줄이 잘릴 뻔했다.
//
// 그래서 여기서는 문장이 아니라 **나가는 값**을 잰다. 규칙을 넓히거나 문구를 보강할 때
// 이 검사가 먼저 막는다.
//
// KIE 한도는 필드마다 별개 예산이고, 넘으면 잘라 주는 게 아니라 422로 거절한다.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { BGM_CONSTRAINT_LINES, BGM_NEGATIVE_TAGS_MAX_CHARS, BGM_STYLE_MAX_CHARS, BGM_WEIRDNESS_CEILING } from './lib/bgm-variation.mjs';

// KIE music(V5_5) 필드 한도. 숫자를 고칠 일이 생기면 실패 메시지의 422 문구를 먼저 확인할 것.
const KIE_LIMITS = {
  style: BGM_STYLE_MAX_CHARS,
  negativeTags: BGM_NEGATIVE_TAGS_MAX_CHARS,
  title: 80,
};
// 사람 목소리 금지는 사용자가 반복해서 요구한 항목이라 별도로 확인한다.
const VOICE_BAN_WORDS = ['humming', 'wordless vocals', 'a cappella', 'vocalise'];

const root = path.resolve(import.meta.dirname, '..');
const dbPath = path.join(root, '.n8n', 'database.sqlite');
assert.ok(fs.existsSync(dbPath), 'live n8n DB not found — this verifier measures what will actually run');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
const rows = await new Promise((resolve, reject) => {
  db.all("select id, name, nodes from workflow_entity where nodes like '%KIE Create BGM Task%'", (error, result) => (error ? reject(error) : resolve(result)));
});
db.close();

assert.equal(rows.length, 7, `expected 7 BGM-generating circuits in the live DB, found ${rows.length}`);

// 회로마다 입력 모양이 달라서 페이로드를 항상 실행으로 재현하지는 못한다. 실행되면
// 실제 값을 재고, 안 되면 코드에 박힌 문자열을 재서 어느 쪽으로든 반드시 측정한다.
function runtimePayload(code) {
  const rankItems = Array.from({ length: 4 }, (_, index) => ({
    rank: index + 1,
    name: `n${index}`,
    card_name: `n${index}`,
    reason: '이유 문장입니다',
    card_reason: '조건과 결과를 담은 설명 문장이에요',
    caution: '',
  }));
  const pack = {
    content_lane: 'daily_function',
    theme: 't',
    hook_title: '제목입니다',
    subtitle: '부제',
    visual_mood_hint: '밝은 아침',
    rank_items: rankItems,
    tags: ['t'],
    bgm_prompt: 'warm calm acoustic',
  };
  const config = { rank_count: 4, kie_bgm_model: 'V5_5', kie_image_model: 'gpt-image-2-text-to-image', variation_seed: 'seed', channel_name: '테스트', duration_seconds: 5 };
  for (const json of [{ pack, config }, { pack, config, image_sha256: 'a1b2c3d4', claimed_path: 'C:/x.png' }]) {
    try {
      const output = new Function('$input', code)({ first: () => ({ json }), all: () => [{ json }] });
      const payload = output?.[0]?.json?.bgm_payload;
      if (payload) return payload;
    } catch { /* 다음 입력 모양 */ }
  }
  return null;
}

function staticStrings(code) {
  const negatives = [
    ...[...code.matchAll(/negativeTags\s*:\s*['"]([^'"]*)['"]/g)].map((m) => m[1]),
    ...[...code.matchAll(/bgmNegativeTags\s*=\s*['"]([^'"]*)['"]/g)].map((m) => m[1]),
    ...(/negativeTags\s*:\s*definition\.bgmNegativeTags/.test(code)
      ? [...code.matchAll(/"bgmNegativeTags"\s*:\s*"([^"]*)"/g)].map((m) => m[1])
      : []),
  ];
  const weirdness = [
    ...[...code.matchAll(/weirdnessConstraint\s*:\s*([0-9.]+)/g)].map((m) => Number(m[1])),
    ...(/weirdnessConstraint\s*:\s*definition\.bgmWeirdness/.test(code)
      ? [...code.matchAll(/"bgmWeirdness"\s*:\s*([0-9.]+)/g)].map((m) => Number(m[1]))
      : []),
  ];
  return { negatives, weirdness };
}

const checked = [];
for (const row of rows) {
  const nodes = JSON.parse(row.nodes);
  const builders = nodes.filter((node) => /bgm_payload\s*[:=]/.test(String(node.parameters?.jsCode || '')));
  assert.ok(builders.length > 0, `${row.name}: no node builds a bgm_payload`);

  for (const node of builders) {
    const label = `${row.name} [${node.name}]`;
    const code = node.parameters.jsCode;
    const payload = runtimePayload(code);
    const measured = { label, mode: payload ? 'runtime' : 'static' };

    if (payload) {
      for (const [field, limit] of Object.entries(KIE_LIMITS)) {
        const length = String(payload[field] || '').length;
        assert.ok(length > 0, `${label}: ${field} is empty`);
        assert.ok(length <= limit, `${label}: ${field} is ${length} chars; KIE rejects the whole request above ${limit} (422, not a trim)`);
        measured[field] = `${length}/${limit}`;
      }
      assert.equal(payload.instrumental, true, `${label}: instrumental flag is not true`);
      assert.ok(payload.weirdnessConstraint <= BGM_WEIRDNESS_CEILING, `${label}: weirdness ${payload.weirdnessConstraint} is above ${BGM_WEIRDNESS_CEILING}, which let humming through on 2026-08-06`);
      assert.ok(String(payload.style).includes(BGM_CONSTRAINT_LINES[0]), `${label}: the shared human-voice ban line did not survive into the outgoing style`);
      measured.weirdness = payload.weirdnessConstraint;
    } else {
      const { negatives, weirdness } = staticStrings(code);
      assert.ok(negatives.length > 0, `${label}: could not locate the negativeTags string — extend staticStrings() rather than skipping the check`);
      for (const value of negatives) {
        assert.ok(value.length <= KIE_LIMITS.negativeTags, `${label}: negativeTags is ${value.length} chars; KIE rejects the whole request above ${KIE_LIMITS.negativeTags}`);
      }
      assert.ok(weirdness.length > 0, `${label}: could not locate weirdnessConstraint`);
      for (const value of weirdness) {
        assert.ok(value <= BGM_WEIRDNESS_CEILING, `${label}: weirdness ${value} is above ${BGM_WEIRDNESS_CEILING}`);
      }
      assert.match(code, /instrumental\s*:\s*true/, `${label}: instrumental flag is not true`);
      assert.ok(code.includes(BGM_CONSTRAINT_LINES[0]), `${label}: the shared human-voice ban line is missing`);
      measured.negativeTags = `${Math.max(...negatives.map((value) => value.length))}/${KIE_LIMITS.negativeTags}`;
      measured.weirdness = weirdness.join(',');
    }

    for (const word of VOICE_BAN_WORDS) {
      assert.ok(code.includes(word), `${label}: the voice ban lost "${word}"`);
    }
    checked.push(measured);
  }
}

console.log(JSON.stringify({
  ok: true,
  circuits: rows.length,
  payload_builders_checked: checked.length,
  limits: KIE_LIMITS,
  builders: checked,
  note: '나가는 값을 잰다. 규칙 문장이 코드에 있는지만 보던 검사가 같은 사고를 세 번 통과시켰다.',
}, null, 2));
