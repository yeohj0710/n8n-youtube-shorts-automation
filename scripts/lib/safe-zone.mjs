// 인스타/유튜브 쇼츠 앱 UI가 덮는 데드존(안전 영역)의 단일 기준.
//
// 이 표를 복사해 쓰지 말 것. preview-card-safe-zone / enforce-card-safe-zone /
// derive-shorts-card / render-static-card 와 이미지 프롬프트를 만드는 빌더가
// 전부 이 파일 하나를 본다. 과거에 표가 두 파일에 복제돼 있었고, 프롬프트의
// 픽셀 좌표는 또 따로 하드코딩돼 있어서 한쪽만 고치면 조용히 어긋났다.
//
// 왜 프롬프트만으로는 안 되는가: GPT Image는 위/아래/좌/우 마진을 따로 주면
// 하나의 균일한 여백으로 뭉개서 그린다(derive-shorts-card.mjs 주석 참고, 5회 확인).
// 9:16의 아래 22% 같은 큰 비대칭 마진은 지시해도 안 지킨다. 그래서 렌더 직전에
// 기계적으로 한 번 더 강제한다 — 그게 fitCanvasWithSafeZone이다.

import sharp from 'sharp';

// 캔버스 가장자리에서 띄울 비율.
//
// 왼쪽이 0인 이유(2026-08-04 사용자 지시): 쇼츠·릴스 UI는 왼쪽 가장자리를 덮지 않는다.
// 오른쪽에는 좋아요·댓글·공유 아이콘 세로열이, 아래에는 계정명·캡션·음원이, 위에는
// 카메라·검색이 올라오지만 왼쪽에는 아무것도 없다. 5%를 버리던 건 근거 없는 대칭이었고,
// 가로 폭이 아쉬운 카드에서 그만큼 손해였다. 좌우를 비대칭으로 두는 게 요점이다.
export const SAFE_ZONE_MARGINS = {
  '4:5': { top: 0.08, bottom: 0.12, left: 0, right: 0.12 },
  '9:16': { top: 0.12, bottom: 0.22, left: 0, right: 0.11 },
};

export const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

// 4:5 = 0.800, 9:16 = 0.5625 — 가까운 쪽으로 판정
export function detectAspect(width, height) {
  const ratio = width / height;
  return Math.abs(ratio - 0.8) < Math.abs(ratio - 0.5625) ? '4:5' : '9:16';
}

export function marginsFor(aspect) {
  const margins = SAFE_ZONE_MARGINS[aspect];
  if (!margins) throw new Error(`Unknown safe-zone aspect: ${aspect}`);
  return margins;
}

// 캔버스 크기를 주면 임계 콘텐츠가 들어가야 할 상자를 픽셀로 돌려준다.
export function safeBoxFor(width, height, aspect = detectAspect(width, height)) {
  const margins = marginsFor(aspect);
  const left = Math.round(width * margins.left);
  const top = Math.round(height * margins.top);
  const rightInset = Math.round(width * margins.right);
  const bottomInset = Math.round(height * margins.bottom);
  return {
    aspect,
    margins,
    left,
    top,
    right: width - rightInset,
    bottom: height - bottomInset,
    leftInset: left,
    topInset: top,
    rightInset,
    bottomInset,
    width: width - left - rightInset,
    height: height - top - bottomInset,
  };
}

// 이미지 프롬프트에 넣는 안전 영역 지시문. 좌표는 위 표에서 계산해 박으므로
// 표를 바꾸면 프롬프트 숫자도 같이 바뀐다. 문구를 손으로 베껴 쓰지 말 것.
export function shortsSafeZonePromptLines(width = 1080, height = 1920) {
  const box = safeBoxFor(width, height, '9:16');
  return [
    `MANDATORY SHORTS SAFE LAYOUT for ${width}x${height}: make the information poster visually dominant without placing any supplied copy under the Shorts interface.`,
    `SHARED_SAFE_ZONE_V1: keep every critical element inside the critical-content box x ${box.left}-${box.right} px and y ${box.top}-${box.bottom} px. These coordinates match the repository preview-card-safe-zone, enforce-card-safe-zone, and derive-shorts-card tools for 9:16 output.`,
    `Reserve ${box.rightInset} px on the right, ${box.topInset} px on top, and ${box.bottomInset} px at the bottom for feed UI, captions, controls, and crop tolerance.${box.leftInset > 0 ? ` Reserve ${box.leftInset} px on the left.` : ' The LEFT edge carries no interface: content may run all the way to x 0, and leaving a matching left margin only wastes width. The usable area is deliberately asymmetric — wider on the left than on the right.'} Keep all supplied text — including the footer and handle — plus rank numbers, faces, logos, and key objects clear of the top, right, and bottom UI bands.`,
    'BAND_BACKGROUND_V1: the reserved bands are exclusion zones for critical content, not empty voids. The card background — its color, texture, pattern, and soft decorative elements — may reach every frame edge, so the frame never shows a blank strip. Only supplied text, faces, logos, and key subject objects stay inside the critical-content box.',
    `VERTICAL_FILL_V2: distribute the title, rows, and footer across the critical-content box from y ${box.top} to y ${box.bottom}. Start the title near the top of that box. Keep the last row above the footer with a visible gap, and keep the footer bottom at or above y ${box.bottom}. When vertical space remains, spend it on taller rows and wider row spacing. When space is tight, cut decoration and secondary copy, never the Korean type size or safe margins.`,
    // CONTENT_PANEL_V1 (2026-08-05): 보이지 않는 좌표는 몇 주째 안 지켜졌다. 실측한
    // 두 프레임의 유일한 차이는 "모델이 직접 그린 테두리가 있느냐"였다 — 테두리가 있는
    // 카드는 행이 그 안에서 멈췄고, 사진 위에 글자만 얹은 카드는 아래로 흘렀다.
    // 좌표를 지키라고 다시 말하는 대신, 지킬 대상을 눈에 보이는 물체로 준다.
    `CONTENT_PANEL_V1: draw one rounded panel and put every supplied Korean letter inside it. Its top edge sits at or below y ${box.top} and its BOTTOM EDGE SITS AT y ${box.bottom} — the panel stops there and the photographed background continues below it to the frame edge. Treat the panel as a physical container: rows stack inside it and the last row ends above its bottom edge. If the rows do not fit, the panel does not grow; make the rows shorter instead. A card drawn without this panel has no edge to stop at and always spills into the bottom strip.`,
    'TITLE_ZONE_CAP_V1: the title zone takes at most one third of the footprint height, and about one quarter is the target. Set the title in at most 3 lines, preferably 2. There is NO subtitle on this card — do not invent a second line under the title. The space it used to take belongs to the rows. A published frame spent nearly half the card on a five-line title and starved the ranked rows; that is a failure. Leftover vertical space always goes to the ranked rows, never to enlarging the title further.',
    'GLYPH_INTEGRITY_V1: small Korean type renders with broken or malformed strokes, so glyph size is a rendering-safety floor, not a style choice. Keep card_reason text no smaller than about 3 percent of frame height (roughly 55 px) and item names clearly larger. If the copy cannot fit at that size, remove decoration or drop the frame to fewer visual elements; never render Korean text small enough to risk broken glyphs.',
    // POST_RENDER_REFIT_V1은 2026-08-05에 걷어냈다. "넘치면 렌더러가 축소한다"고
    // 위협하는 줄이었는데, 그 축소는 2026-08-03에 금지됐고 7개 회로 전부
    // safe_zone_mode: off 다. 일어나지 않는 일을 경고하는 줄이 9,500자 프롬프트
    // 한복판을 차지하고 있었다.
  ];
}

// 프롬프트 맨 뒤에 붙이는 여백 지시. 위 SHARED_SAFE_ZONE_V1과 내용이 겹치지만
// 자리와 어법이 다르다 — 그게 요점이다. 좌표 블록은 프롬프트 중간에 있었고 몇 주 동안
// 한 프레임도 안 지켜졌다. 여기서는 (1) 맨 끝에 두고 (2) 좌표 대신 "위/아래 띠에는
// 배경만"이라는 장면 지시로 다시 말하고 (3) 마무리 줄을 프레임 바닥 막대가 아니라
// 본문의 마지막 줄로 재정의한다. 모델이 푸터를 늘 바닥에 붙이던 게 아래쪽 위반의
// 주원인이었다. 2026-08-03 레퍼런스 카드에서 먼저 넣어 위쪽 위반이 사라졌고,
// 아래쪽은 행이 10개일 때 여전히 남았다(행 수 문제는 회로별 상한으로 따로 잡는다).
export function shortsMarginPromptLines(width = 1080, height = 1920) {
  const box = safeBoxFor(width, height, '9:16');
  const topPercent = Math.round(box.margins.top * 100);
  const bottomPercent = Math.round(box.margins.bottom * 100);
  return [
    'SHORTS_MARGIN_V1 — this is the last word on vertical placement and overrides any earlier line it contradicts.',
    `Every letter of the Korean copy — title, all rows, and the closing line — sits between y ${box.top} and y ${box.bottom} of the ${width}x${height} frame.`,
    `The top ${box.topInset} px (top ${topPercent} percent) and the bottom ${box.bottomInset} px (bottom ${bottomPercent} percent) are open background: photographed scene, soft blur, plants, wood, cloth, light. Draw no letters, no panel edge, no footer bar, and no divider line in those two strips. Leaving them visibly empty is the point, not a mistake.`,
    'The closing line is the final line of the text block, tucked directly under the last row. It is never a strip along the bottom of the frame.',
    'The title begins below the top strip, with clear background above its first line. Do not let the title touch the top edge.',
    'If the copy runs long, tighten row spacing, shrink decoration, or set the title in two lines. Never gain room by pushing the title up or the closing line down into the strips.',
    'The app interface covers those two strips on a phone, so any Korean text placed there is lost.',
  ];
}

// 위 지시문 뒤에 붙는, 채널 공통 레이아웃 문구. 레거시 워크플로우가 하나의
// shortsSafeZoneInstruction 배열로 갖고 있던 것을 그대로 유지한다.
export function shortsCardLayoutPromptLines() {
  return [
    // "꽉 찬 느낌이어야 한다"는 줄은 뺐다(2026-08-05). 같은 프롬프트가 위쪽에서는
    // 띠를 "눈에 띄게 비워 두는 게 요점"이라고 말한다. 채우라는 말과 비우라는 말이
    // 같이 있으면 넘칠 때 모델이 어느 쪽을 따를지가 복불복이 된다.
    'Make the Korean title, item names, and card_reason substantially larger than decorative elements and readable in a small channel-grid thumbnail. Never solve fitting by shrinking all text; simplify decoration and secondary copy first. Empty space left inside the panel is fine — it is better than a row pushed past the panel edge.',
    'The title, ranked item names, their supplied card_reason, and the supplied footer are critical. Auxiliary decoration is optional and may be cropped or covered; never shrink critical information to preserve it.',
    'Assume channel grids and previews may crop the outer frame. The main card must keep its useful message intact, but auxiliary copy does not need protection.',
    'Decorative background may extend edge to edge. Do not use full-bleed critical text, right-edge badges, or cropped title letters.',
  ];
}

// 워크플로우 jsCode 안에 그대로 심을 JS 소스. 빌더가 문자열로 이어 붙인다.
export function shortsSafeZoneInstructionSource({ joiner = 'LF', extraLines = [] } = {}) {
  const lines = [...shortsSafeZonePromptLines(), ...shortsCardLayoutPromptLines(), ...extraLines];
  const body = lines.map((line) => `  ${JSON.stringify(line)},`).join('\n');
  return `const shortsSafeZoneInstruction = [\n${body}\n].join(${joiner});`;
}

// ---------------------------------------------------------------------------
// 콘텐츠 경계 측정
// ---------------------------------------------------------------------------
//
// 배경은 가장자리까지 꽉 차도 된다(BAND_BACKGROUND_V1). 데드존 위반은 "글자와
// 주요 개체"가 띠 안에 들어갔을 때다. 그래서 단순 밝기가 아니라 국소 대비(에지)를
// 보고, 카드 테두리나 구분선처럼 한 방향으로 길게 이어지는 획은 걸러낸다.
// 그러지 않으면 배경 패널 경계 때문에 멀쩡한 카드까지 축소된다.

const ANALYSIS_WIDTH = 270;

function laplacianMagnitude(gray, width, height) {
  const mag = new Uint8ClampedArray(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const value = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width];
      mag[i] = Math.abs(value);
    }
  }
  return mag;
}

function percentile(values, fraction) {
  const histogram = new Uint32Array(256);
  for (let i = 0; i < values.length; i += 1) histogram[values[i]] += 1;
  const target = Math.floor(values.length * fraction);
  let seen = 0;
  for (let level = 0; level < 256; level += 1) {
    seen += histogram[level];
    if (seen >= target) return level;
  }
  return 255;
}

// 한 방향으로 길게 이어진 획(카드 테두리, 구분선, 밴드 경계)을 구조물로 보고 뺀다.
function dropStructuralRuns(ink, width, height) {
  const structural = new Uint8Array(width * height);
  const horizontalLimit = Math.round(width * 0.5);
  const verticalLimit = Math.round(height * 0.5);

  for (let y = 0; y < height; y += 1) {
    let run = 0;
    for (let x = 0; x <= width; x += 1) {
      const on = x < width && ink[y * width + x];
      if (on) { run += 1; continue; }
      if (run >= horizontalLimit) {
        for (let k = x - run; k < x; k += 1) structural[y * width + k] = 1;
      }
      run = 0;
    }
  }
  for (let x = 0; x < width; x += 1) {
    let run = 0;
    for (let y = 0; y <= height; y += 1) {
      const on = y < height && ink[y * width + x];
      if (on) { run += 1; continue; }
      if (run >= verticalLimit) {
        for (let k = y - run; k < y; k += 1) structural[k * width + x] = 1;
      }
      run = 0;
    }
  }
  for (let i = 0; i < ink.length; i += 1) if (structural[i]) ink[i] = 0;
  return ink;
}

// 외톨이 화소(압축 잡음, 텍스처 알갱이)는 글자가 아니다.
function dropSpeckle(ink, width, height) {
  const kept = new Uint8Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      if (!ink[i]) continue;
      let neighbours = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          if (ink[i + dy * width + dx]) neighbours += 1;
        }
      }
      if (neighbours >= 2) kept[i] = 1;
    }
  }
  return kept;
}

/**
 * 이미지 안에서 "지켜야 할 콘텐츠"의 경계 상자를 원본 좌표로 돌려준다.
 * 글자를 못 찾으면 found:false — 이때는 강제 축소하지 않는다(추상 배경 등).
 */
export async function detectContentBox(buffer, { analysisWidth = ANALYSIS_WIDTH } = {}) {
  const source = sharp(buffer);
  const meta = await source.metadata();
  const targetWidth = Math.min(analysisWidth, meta.width || analysisWidth);
  const { data, info } = await sharp(buffer)
    .flatten({ background: '#ffffff' })
    .resize({ width: targetWidth, fit: 'inside', kernel: sharp.kernel.lanczos3 })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const mag = laplacianMagnitude(data, width, height);
  const strong = percentile(mag, 0.995);
  if (strong < 8) {
    return { found: false, reason: 'no_contrast', source: { width: meta.width, height: meta.height } };
  }
  const threshold = Math.min(45, Math.max(10, Math.round(strong * 0.25)));

  let ink = new Uint8Array(width * height);
  for (let i = 0; i < mag.length; i += 1) ink[i] = mag[i] >= threshold ? 1 : 0;
  ink = dropStructuralRuns(ink, width, height);
  ink = dropSpeckle(ink, width, height);

  const rowMinimum = Math.max(3, Math.round(width * 0.015));
  const columnMinimum = Math.max(3, Math.round(height * 0.01));

  let top = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    let count = 0;
    for (let x = 0; x < width; x += 1) if (ink[y * width + x]) count += 1;
    if (count < rowMinimum) continue;
    if (top < 0) top = y;
    bottom = y;
  }
  let left = -1;
  let right = -1;
  for (let x = 0; x < width; x += 1) {
    let count = 0;
    for (let y = 0; y < height; y += 1) if (ink[y * width + x]) count += 1;
    if (count < columnMinimum) continue;
    if (left < 0) left = x;
    right = x;
  }
  if (top < 0 || left < 0) {
    return { found: false, reason: 'no_content', source: { width: meta.width, height: meta.height } };
  }

  // 분석 해상도 1px이 원본에서 몇 px인지. 경계는 바깥쪽으로 한 칸 넉넉히 잡는다.
  const scale = (meta.width || width) / width;
  const pad = 1;
  return {
    found: true,
    threshold,
    analysis: { width, height, left, top, right, bottom },
    source: { width: meta.width, height: meta.height },
    left: Math.max(0, Math.round((left - pad) * scale)),
    top: Math.max(0, Math.round((top - pad) * scale)),
    right: Math.min(meta.width, Math.round((right + 1 + pad) * scale)),
    bottom: Math.min(meta.height, Math.round((bottom + 1 + pad) * scale)),
  };
}

export function safeZoneViolation(box, safeBox, tolerance = 0) {
  return {
    top: Math.max(0, safeBox.top - box.top - tolerance),
    bottom: Math.max(0, box.bottom - safeBox.bottom - tolerance),
    left: Math.max(0, safeBox.left - box.left - tolerance),
    right: Math.max(0, box.right - safeBox.right - tolerance),
  };
}

export function hasSafeZoneViolation(violation) {
  return violation.top > 0 || violation.bottom > 0 || violation.left > 0 || violation.right > 0;
}

/**
 * 원본 이미지를 목표 캔버스에 배치하되, 데드존을 침범하면 프레임 전체를 안전
 * 영역 안으로 축소한다.
 *
 * 축소량을 "감지된 글자 상자"가 아니라 "프레임 전체"로 잡는 것이 중요하다.
 * 사진 배경이 깔린 카드에서 글자 경계 감지는 과하게도 모자라게도 나오는데,
 * 모자라게 나오면 축소가 덜 돼서 위반이 남는다 — 그게 제일 나쁜 결과다.
 * 프레임 전체를 기준으로 하면 최악이 "필요 이상으로 줄었다"(되돌릴 수 있는
 * 화질 손해)이고, 데드존 침범은 구조적으로 불가능해진다.
 * 감지는 "이미 안전 영역 안이면 건드리지 않는다"를 판단할 때만 쓴다.
 *
 * 반환: { buffer, applied, reason, canvas, safe_box, content_box, violation, scale }
 */
export async function fitCanvasWithSafeZone(buffer, options = {}) {
  const width = Number(options.width || 1080);
  const height = Number(options.height || 1920);
  const mode = options.mode || 'auto'; // auto | fit | off
  const tolerance = Number.isFinite(options.tolerance) ? Number(options.tolerance) : Math.round(width * 0.008);
  const aspect = options.aspect || detectAspect(width, height);
  const safeBox = safeBoxFor(width, height, aspect);
  const sharpen = { sigma: 0.45, m1: 0.8, m2: 1.15 };

  const meta = await sharp(buffer).metadata();
  const sourceWidth = meta.width || width;
  const sourceHeight = meta.height || height;
  const targetRatio = width / height;
  const inputRatio = sourceWidth / sourceHeight;
  const matchesTarget = Math.abs(inputRatio - targetRatio) < 0.03;

  // 데드존을 무시했을 때의 기본 배치. 비율이 같으면 cover, 다르면 중앙 배치.
  const baseScale = matchesTarget
    ? Math.max(width / sourceWidth, height / sourceHeight)
    : Math.min(width / sourceWidth, height / sourceHeight);
  const baseLeft = Math.round((width - sourceWidth * baseScale) / 2);
  const baseTop = Math.round((height - sourceHeight * baseScale) / 2);

  // 가장자리를 메우는 배경. 축소 배치일 때는 더 세게 흐리고 어둡게 하고 확대해서
  // 깐다 — 그냥 blur(40)만 걸면 원래 제목 글자가 유령처럼 읽혀서 지저분하다.
  const blurredCanvas = (strong = false) => sharp(buffer)
    .resize(Math.round(width * (strong ? 1.35 : 1)), Math.round(height * (strong ? 1.35 : 1)), {
      fit: 'cover',
      position: 'center',
    })
    .extract(strong
      ? {
        left: Math.round(width * 0.175),
        top: Math.round(height * 0.175),
        width,
        height,
      }
      : { left: 0, top: 0, width, height })
    .blur(strong ? 70 : 40)
    .modulate({ brightness: strong ? 0.82 : 0.92, saturation: strong ? 0.85 : 1 })
    .toBuffer();

  const renderBase = async () => {
    if (matchesTarget) {
      return sharp(buffer)
        .resize(width, height, { fit: 'cover', position: 'center', kernel: sharp.kernel.lanczos3 })
        .sharpen(sharpen)
        .png()
        .toBuffer();
    }
    const foreground = await sharp(buffer)
      .resize(width, height, { fit: 'inside', kernel: sharp.kernel.lanczos3 })
      .sharpen(sharpen)
      .toBuffer();
    return sharp(await blurredCanvas()).composite([{ input: foreground, gravity: 'center' }]).png().toBuffer();
  };

  const baseResult = (reason, extra = {}) => ({
    applied: false,
    reason,
    canvas: { width, height },
    safe_box: safeBox,
    ...extra,
  });

  if (mode === 'off') {
    return { buffer: await renderBase(), ...baseResult('disabled') };
  }

  let content = null;
  let violation = null;
  if (mode !== 'fit') {
    content = await detectContentBox(buffer);
    if (content.found) {
      const canvasBox = {
        left: baseLeft + content.left * baseScale,
        top: baseTop + content.top * baseScale,
        right: baseLeft + content.right * baseScale,
        bottom: baseTop + content.bottom * baseScale,
      };
      violation = safeZoneViolation(canvasBox, safeBox, tolerance);
      if (!hasSafeZoneViolation(violation)) {
        return {
          buffer: await renderBase(),
          ...baseResult('already_inside', { content_box: roundBox(canvasBox), violation }),
        };
      }
      content = { ...content, canvas_box: roundBox(canvasBox) };
    }
  }

  // 프레임 전체를 안전 상자 안으로. 남는 가장자리는 같은 그림을 흐리게 확대한
  // 배경이 메운다 — 빈 띠를 만들면 밴드가 그대로 드러나 더 싸구려로 보인다.
  const shrink = Math.min(safeBox.width / (sourceWidth * baseScale), safeBox.height / (sourceHeight * baseScale), 1);
  const finalScale = baseScale * shrink;
  const cardWidth = Math.max(1, Math.round(sourceWidth * finalScale));
  const cardHeight = Math.max(1, Math.round(sourceHeight * finalScale));
  const left = Math.round(safeBox.left + (safeBox.width - cardWidth) / 2);
  const top = Math.round(safeBox.top + (safeBox.height - cardHeight) / 2);

  const card = await sharp(buffer)
    .resize(cardWidth, cardHeight, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .sharpen(sharpen)
    .toBuffer();
  const composited = await sharp(await blurredCanvas(true))
    .composite([{ input: card, top, left }])
    .png()
    .toBuffer();

  return {
    buffer: composited,
    applied: true,
    reason: mode === 'fit' ? 'always_fit' : 'violation',
    canvas: { width, height },
    safe_box: safeBox,
    content_box: content && content.found ? content.canvas_box : undefined,
    violation: violation || undefined,
    scale: Number(shrink.toFixed(4)),
    card: { width: cardWidth, height: cardHeight, left, top },
  };
}

function roundBox(box) {
  return {
    left: Math.round(box.left),
    top: Math.round(box.top),
    right: Math.round(box.right),
    bottom: Math.round(box.bottom),
  };
}
