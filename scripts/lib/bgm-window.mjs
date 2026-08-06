// 영상에 쓸 배경음 구간을 고른다. 회로 7개가 전부 render-static-card.mjs를 거치므로
// 여기 한 곳만 고치면 전부 바뀐다.
//
// 왜 생겼나 (2026-08-06 실측): 발행 영상은 전부 5.000초인데 ffmpeg가 오디오를
// `-stream_loop -1 -i bgm.mp3 -t 5`로 물어서 **어느 곡이든 0~5초**만 썼다. 최근 렌더
// 20개의 오디오 길이를 재보니 103초, 108초, 113초, 124초짜리 서로 다른 곡이었는데
// 시청자가 들은 건 전부 도입부 5초였다. 밝은 어쿠스틱 피아노 곡의 도입부는 어느 곡이나
// 길게 눌린 화음 아니면 단순한 상행 분산화음이라, 곡을 아무리 다양하게 뽑아도
// "음악이 다 똑같다"는 결과가 나왔다. 곡을 구분 짓는 선율은 보통 10~30초에 들어온다.
//
// 그래서 분위기·악기·장조는 하나도 안 건드리고, 듣는 위치만 곡마다 옮긴다.

// 도입부로 버리는 구간. 곡 길이의 비율과 초 단위 하한 중 큰 쪽을 쓴다. 20초짜리
// 짧은 생성물까지 12초를 버리면 남는 데가 없어서 비율을 같이 본다.
const INTRO_SKIP_RATIO = 0.18;
const INTRO_SKIP_MIN_SECONDS = 6;
const INTRO_SKIP_MAX_SECONDS = 30;

// 끝부분은 페이드아웃·여운이라 잘라 쓰면 소리가 빈다. 뒤에서 이만큼은 안 쓴다.
const OUTRO_GUARD_RATIO = 0.08;
const OUTRO_GUARD_MIN_SECONDS = 3;

// 시작점을 0.5초 격자에 맞춘다. 로그와 재현이 읽기 편해진다.
const OFFSET_GRID_SECONDS = 0.5;

// 곡 중간에서 끊고 들어오므로 짧은 페이드가 필요하다. 없으면 첫 프레임에서 딸깍
// 소리가 난다. 끝은 원래도 5초에서 그냥 잘렸으므로 같이 다듬는다.
export const BGM_FADE_IN_SECONDS = 0.25;
export const BGM_FADE_OUT_SECONDS = 0.6;

function hashSeed(value) {
  const text = String(value ?? '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0);
}

function finiteOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * 배경음에서 잘라 쓸 구간을 고른다.
 *
 * 길이를 모르거나(ffprobe 실패) 곡이 짧으면 offset 0으로 떨어진다. 즉 이 함수가
 * 최악으로 동작해도 2026-08-06 이전 동작과 같다. 새 위험을 만들지 않는다.
 */
export function chooseBgmWindow({ audioDuration, clipDuration, seed } = {}) {
  const clip = finiteOrNull(clipDuration) || 5;
  const total = finiteOrNull(audioDuration);

  if (!total) {
    return { offset: 0, reason: 'unknown_audio_duration', usable_span: 0, audio_duration: null, clip_duration: clip };
  }

  const introSkip = Math.min(
    INTRO_SKIP_MAX_SECONDS,
    Math.max(INTRO_SKIP_MIN_SECONDS, total * INTRO_SKIP_RATIO),
  );
  const outroGuard = Math.max(OUTRO_GUARD_MIN_SECONDS, total * OUTRO_GUARD_RATIO);
  const latestStart = total - outroGuard - clip;

  // 20초 이하 짧은 생성물이나 폴백 파일은 여기로 온다. 도입부만 조금 건너뛴다.
  if (latestStart <= introSkip) {
    const relaxedLatest = total - clip;
    if (relaxedLatest <= 0.5) {
      return { offset: 0, reason: 'audio_too_short', usable_span: 0, audio_duration: total, clip_duration: clip };
    }
    const span = relaxedLatest;
    const offset = quantize((hashSeed(seed) % 10000) / 10000 * span);
    return {
      offset: Math.min(offset, quantize(relaxedLatest)),
      reason: 'short_audio_relaxed_window',
      usable_span: span,
      audio_duration: total,
      clip_duration: clip,
    };
  }

  const span = latestStart - introSkip;
  const offset = quantize(introSkip + (hashSeed(seed) % 10000) / 10000 * span);
  return {
    offset: Math.min(offset, quantize(latestStart)),
    reason: 'varied_window',
    usable_span: span,
    audio_duration: total,
    clip_duration: clip,
  };
}

function quantize(seconds) {
  return Math.max(0, Math.round(seconds / OFFSET_GRID_SECONDS) * OFFSET_GRID_SECONDS);
}

/**
 * ffmpeg의 -af 필터 문자열. 곡 중간에서 시작하므로 앞은 짧게 열고 끝은 접는다.
 */
export function bgmFadeFilter(clipDuration) {
  const clip = finiteOrNull(clipDuration) || 5;
  const fadeOutStart = Math.max(0, clip - BGM_FADE_OUT_SECONDS);
  return `afade=t=in:st=0:d=${BGM_FADE_IN_SECONDS},afade=t=out:st=${round3(fadeOutStart)}:d=${BGM_FADE_OUT_SECONDS}`;
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}
