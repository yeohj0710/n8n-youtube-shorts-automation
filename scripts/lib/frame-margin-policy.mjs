// 발행 프레임 여백 정책. 워크플로우 객체 하나를 받아 제자리에서 고친다.
//
// 이 파일이 따로 있는 이유: 정본 스크립트를 다시 돌려도 JSON이 그대로여야 한다는
// 불변식이 있다(verify-research-source-grounding.mjs 12번). 정책을 설치 스크립트로만
// 덧칠하면 정본을 재실행하는 순간 지워진다. 그래서 변환을 여기 한 곳에 두고
// 정본 스크립트와 빌더들이 각자 마지막 단계에서 부른다.
//
// 두 가지를 심는다.
//
// 1) SHORTS_MARGIN_V1 — 이미지 프롬프트 맨 뒤에 붙는 여백 지시. 문구와 좌표는
//    lib/safe-zone.mjs의 마진 표에서 생성한다.
//
// 2) 렌더 축소 차단 — `Prepare Local FFmpeg Render`의 safe_zone_mode 기본값을 'off'로.
//    'auto'는 데드존을 넘긴 프레임을 0.66배로 줄이고 흐린 띠를 두르는데, 그렇게
//    잘못 줄어든 영상이 여러 번 발행돼 사용자가 금지했다.
//
// 몇 번을 적용해도 결과가 같다. 이전 주입분을 먼저 걷어낸다.

import { shortsMarginPromptLines } from './safe-zone.mjs';

const BEGIN = '// shorts_margin_v1_begin';
const END = '// shorts_margin_v1_end';

function marginSource(joinerExpr) {
  const body = shortsMarginPromptLines().map((line) => `  ${JSON.stringify(line)},`).join('\n');
  return `${BEGIN}\nconst shortsMarginInstruction = [\n${body}\n].join(${joinerExpr});\n${END}\n`;
}

function stripPrevious(code) {
  return code
    .replace(new RegExp(`${BEGIN}[\\s\\S]*?${END}\\n`, 'g'), '')
    .replace(/ \+ LF \+ shortsMarginInstruction/g, '')
    .replace(/ \+ '\\n' \+ shortsMarginInstruction/g, '');
}

// `const imagePrompt = [...].join(...);` 의 종결 세미콜론을 찾는다. 배열 안 문자열에
// 들어 있는 괄호에 속지 않도록 `const imagePrompt` 뒤 첫 `.join(` 만 본다.
function findPromptTerminator(code) {
  const start = code.indexOf('const imagePrompt');
  if (start < 0) return null;
  const joinAt = code.indexOf('.join(', start);
  if (joinAt < 0) return null;
  const closeAt = code.indexOf(')', joinAt);
  const semicolon = code.indexOf(';', closeAt);
  if (closeAt < 0 || semicolon < 0) return null;
  return { start, semicolon, joiner: code.slice(joinAt + 6, closeAt).trim() };
}

export function applyMarginInstruction(node) {
  let code = stripPrevious(node.parameters.jsCode);
  const term = findPromptTerminator(code);
  if (!term) throw new Error(`${node.name}: could not locate the imagePrompt terminator`);
  // 배열 요소를 잇는 것과 같은 구분자를 써야 붙인 줄도 같은 방식으로 이어진다.
  const joinerExpr = term.joiner === 'LF' ? 'LF' : "'\\n'";
  const suffix = joinerExpr === 'LF' ? ' + LF + shortsMarginInstruction' : " + '\\n' + shortsMarginInstruction";
  code = code.slice(0, term.semicolon) + suffix + code.slice(term.semicolon);
  code = code.slice(0, term.start) + marginSource(joinerExpr) + code.slice(term.start);
  node.parameters.jsCode = code;
}

export function applyRenderShrinkOff(node) {
  node.parameters.jsCode = node.parameters.jsCode.replace(
    /cfg\.safe_zone_mode \|\| 'auto'/g,
    "cfg.safe_zone_mode || 'off'",
  );
}

/**
 * 발행 회로 하나에 정책을 적용한다. 발행 회로가 아니면 아무것도 하지 않는다.
 * 반환: 무엇을 건드렸는지 (호출부 리포트용)
 */
export function applyFrameMarginPolicy(workflow) {
  const nodes = workflow.nodes || [];
  if (!nodes.some((node) => node.name === 'Local FFmpeg Render')) return null;

  const renderNode = nodes.find((node) => node.name === 'Prepare Local FFmpeg Render');
  if (!renderNode) throw new Error(`${workflow.name}: Prepare Local FFmpeg Render is missing`);
  applyRenderShrinkOff(renderNode);

  // 완성 이미지 회로는 카드를 생성하지 않고 폴더에서 가져오므로 프롬프트가 없다.
  const promptNode = nodes.find((node) => (node.parameters?.jsCode || '').includes('const imagePrompt'));
  if (promptNode) applyMarginInstruction(promptNode);

  return { workflow: workflow.name, margin_node: promptNode ? promptNode.name : null };
}
