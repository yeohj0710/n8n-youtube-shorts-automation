// 발행 프레임 여백 정책이 7개 회로에 빠짐없이 들어갔는지 본다.
//
// 이 검사가 있는 이유: 2026-08-04 이전에는 여백 지시가 레퍼런스 카드 1개에만, 축소
// 차단이 3개 회로에만 있었다. 회로마다 손으로 넣다 보니 빠진 걸 아무도 몰랐다.
// 새 회로를 붙일 때 이 검사가 먼저 깨지도록 회로 수를 못 박아 둔다.
//
// 한계를 분명히 해둔다. 여기서 보는 건 "지시문이 프롬프트 맨 뒤에 살아 있는가"이지
// "모델이 지켰는가"가 아니다. 이 저장소는 문구만 검사해서 몇 주를 통과시킨 전력이
// 있다(lib/safe-zone.mjs 주석). 실제 준수는 발행 프레임을 눈으로 봐야 안다.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { shortsMarginPromptLines } from './lib/safe-zone.mjs';

const root = path.resolve(import.meta.dirname, '..');
const workflowDir = path.join(root, 'workflows');

const marginLines = shortsMarginPromptLines();
const headLine = marginLines[0];
const tailLine = marginLines[marginLines.length - 1];

const publishing = [];
const generating = [];

for (const file of fs.readdirSync(workflowDir).filter((name) => name.endsWith('.json')).sort()) {
  const workflow = JSON.parse(fs.readFileSync(path.join(workflowDir, file), 'utf8'));
  const nodes = workflow.nodes || [];
  if (!nodes.some((node) => node.name === 'Local FFmpeg Render')) continue;
  publishing.push(workflow.name);

  // 1) 렌더 축소는 어느 회로에서도 기본으로 켜지지 않는다.
  const renderNode = nodes.find((node) => node.name === 'Prepare Local FFmpeg Render');
  assert.ok(renderNode, `${file}: Prepare Local FFmpeg Render is missing`);
  const renderCode = renderNode.parameters?.jsCode || '';
  assert.ok(
    renderCode.includes("cfg.safe_zone_mode || 'off'"),
    `${file}: render payload still defaults to shrink-and-blur — the user has ruled that out`,
  );
  assert.ok(
    !/cfg\.safe_zone_mode \|\| '(auto|fit)'/.test(renderCode),
    `${file}: render payload defaults to a shrinking mode`,
  );

  // 2) 이미지를 생성하는 회로는 여백 지시를 프롬프트 맨 뒤에 들고 있어야 한다.
  if (!nodes.some((node) => node.name === 'KIE Create Image Task')) continue;
  generating.push(workflow.name);

  const promptNode = nodes.find((node) => (node.parameters?.jsCode || '').includes('const imagePrompt'));
  assert.ok(promptNode, `${file}: no node assembles an imagePrompt`);
  const code = promptNode.parameters.jsCode;

  for (const line of marginLines) {
    assert.ok(code.includes(JSON.stringify(line).slice(1, -1)), `${file}: margin instruction lost a line -> ${line.slice(0, 48)}...`);
  }
  assert.ok(code.includes('shortsMarginInstruction'), `${file}: margin block is declared but never joined onto the prompt`);
  assert.match(
    code,
    /const imagePrompt[\s\S]*?\.join\([^)]*\) \+ (LF|'\\n') \+ shortsMarginInstruction;/,
    `${file}: margin instruction is not appended at the very end of the prompt`,
  );
  // 좌표를 손으로 베낀 사본이 남아 있으면 표를 고쳐도 한쪽만 바뀐다.
  assert.ok(
    !code.includes('REFERENCE_CARD_MARGIN_V1'),
    `${file}: an old per-circuit copy of the margin block is still here`,
  );
}

// 본편 2, 원본 릴스 2, 완성 이미지 2, 레퍼런스 카드 1.
assert.equal(publishing.length, 7, `expected 7 publishing circuits, found ${publishing.length}`);
// 완성 이미지 2개는 카드를 생성하지 않고 폴더에서 가져오므로 프롬프트가 없다.
assert.equal(generating.length, 5, `expected 5 image-generating circuits, found ${generating.length}`);

// 문구가 표에서 생성됐는지. 숫자를 손으로 적으면 마진 표를 고쳐도 안 따라온다.
assert.match(headLine, /^SHORTS_MARGIN_V1/, 'margin block lost its marker');
assert.match(marginLines[2], /top 230 px \(top 12 percent\).*bottom 422 px \(bottom 22 percent\)/, 'band sizes drifted from the shared table');
assert.equal(tailLine, 'The app interface covers those two strips on a phone, so any Korean text placed there is lost.');

console.log(JSON.stringify({
  ok: true,
  publishing_circuits: publishing.length,
  image_generating_circuits: generating.length,
  render_shrink_default: 'off (all 7)',
  margin_instruction: `SHORTS_MARGIN_V1 at the end of the prompt (all ${generating.length})`,
  note: '문구가 살아 있는지까지만 확인함. 모델이 지켰는지는 발행 프레임을 봐야 함.',
}, null, 2));
