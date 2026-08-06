// 배경음을 곡의 어느 지점에서 잘라 쓰는지 검사한다.
//
// 이 검사가 있는 이유(2026-08-06): 발행 영상은 5초인데 렌더가 오디오를 항상 0초부터
// 물었다. 최근 렌더 20개의 오디오는 103~124초짜리 서로 다른 곡이었는데 시청자가 들은
// 구간은 전부 도입부 5초였다. 밝은 어쿠스틱 곡의 도입부는 어느 곡이나 비슷해서,
// 프롬프트 다양화(프로필 6종·쿨다운)를 아무리 해도 "음악이 다 똑같다"가 됐다.
//
// 여기서 지키는 것: 시작 지점이 곡마다 갈릴 것, 도입부와 끝여운을 피할 것, 길이를
// 모르거나 곡이 너무 짧으면 예전 동작(0초)으로 안전하게 떨어질 것.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chooseBgmWindow, bgmFadeFilter, BGM_FADE_IN_SECONDS, BGM_FADE_OUT_SECONDS } from './lib/bgm-window.mjs';

const root = path.resolve(import.meta.dirname, '..');
const renderScript = fs.readFileSync(path.join(root, 'scripts', 'render-static-card.mjs'), 'utf8');

// 1) 길이를 모르면 예전 동작으로 떨어진다. 새 위험을 만들지 않는다는 보증.
for (const unknown of [undefined, null, 0, -1, NaN, 'abc']) {
  const window = chooseBgmWindow({ audioDuration: unknown, clipDuration: 5, seed: 'x' });
  assert.equal(window.offset, 0, `unknown audio duration must fall back to offset 0 (got ${window.offset})`);
}

// 2) 곡이 클립보다 짧으면 자르지 않는다.
assert.equal(chooseBgmWindow({ audioDuration: 4, clipDuration: 5, seed: 'x' }).offset, 0, 'audio shorter than the clip must not be seeked');

// 3) 실제 발행 길이대로: 5초 클립, 100초 안팎의 Suno 곡.
const seeds = Array.from({ length: 400 }, (_, index) => `health_17859${index}_${index.toString(16)}`);
const offsets = seeds.map((seed) => chooseBgmWindow({ audioDuration: 107.8, clipDuration: 5, seed }).offset);

const distinct = new Set(offsets);
assert.ok(distinct.size >= 40, `400 renders produced only ${distinct.size} distinct start points; the intro problem is back`);

const alwaysZero = offsets.every((offset) => offset === 0);
assert.ok(!alwaysZero, 'every render still starts at 0 — this is exactly the bug this file exists for');

// 도입부는 버린다. 곡을 구분 짓는 선율은 보통 10초 뒤에 나온다.
const earliest = Math.min(...offsets);
assert.ok(earliest >= 6, `a render started at ${earliest}s, inside the interchangeable intro`);

// 끝여운을 물면 소리가 빈 채로 5초가 흐른다.
const latest = Math.max(...offsets);
assert.ok(latest + 5 <= 107.8 - 3, `a render started at ${latest}s and would run past the usable tail`);

// 같은 시드는 같은 지점. 렌더를 다시 돌렸을 때 설명이 되어야 한다.
assert.equal(
  chooseBgmWindow({ audioDuration: 107.8, clipDuration: 5, seed: 'same' }).offset,
  chooseBgmWindow({ audioDuration: 107.8, clipDuration: 5, seed: 'same' }).offset,
  'the same render id must pick the same window',
);

// 4) 20초짜리 짧은 생성물·폴백 파일도 조금은 갈려야 한다.
const shortOffsets = new Set(seeds.slice(0, 60).map((seed) => chooseBgmWindow({ audioDuration: 20, clipDuration: 5, seed }).offset));
assert.ok(shortOffsets.size >= 5, `a 20s track produced only ${shortOffsets.size} distinct start points`);

// 5) 페이드. 곡 중간에서 끊고 들어오므로 없으면 첫 프레임에 딸깍 소리가 난다.
const fade = bgmFadeFilter(5);
assert.match(fade, new RegExp(`afade=t=in:st=0:d=${BGM_FADE_IN_SECONDS}`), 'fade-in is missing');
assert.match(fade, new RegExp(`afade=t=out:st=4.4:d=${BGM_FADE_OUT_SECONDS}`), 'fade-out is missing or misplaced');

// 6) 렌더 스크립트가 실제로 이 값을 ffmpeg에 넘기는지. 라이브러리만 고치고 배선을
//    안 하면 검사가 통과하면서 영상은 그대로인 사고가 이 저장소에 여러 번 있었다.
assert.match(renderScript, /BGM_WINDOW_V1/, 'render script lost the BGM window marker');
assert.match(renderScript, /chooseBgmWindow\(/, 'render script no longer chooses a BGM window');
assert.match(renderScript, /bgmWindow\.offset > 0 \? \['-ss', String\(bgmWindow\.offset\)\] : \[\]/, 'render script does not seek into the track');
assert.match(renderScript, /'-af', bgmFadeFilter\(duration\)/, 'render script does not apply the fade filter');
// -ss는 반드시 오디오 입력 바로 앞에 와야 한다. 이미지 입력 앞에 붙으면 카드가 사라진다.
const ssIndex = renderScript.indexOf("'-ss', String(bgmWindow.offset)");
const audioInputIndex = renderScript.indexOf("'-i', audioPath");
const cardInputIndex = renderScript.indexOf("'-i', cardPath");
assert.ok(ssIndex > cardInputIndex, 'the audio seek is placed before the image input and would break the card');
assert.ok(ssIndex < audioInputIndex, 'the audio seek must come before the audio input to take effect');

console.log(JSON.stringify({
  ok: true,
  distinct_start_points_per_400_renders: distinct.size,
  earliest_start_seconds: earliest,
  latest_start_seconds: latest,
  fade: fade,
  fallback: 'offset 0 when the duration is unknown or the track is shorter than the clip',
  note: '지점 선택만 검사함. 곡 자체의 분위기·악기·조성은 여기서 건드리지 않는다.',
}, null, 2));
