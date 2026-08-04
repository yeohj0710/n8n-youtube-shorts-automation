// 디스크에 있는 워크플로우 JSON에 여백 정책을 한 번에 다시 적용한다.
//
// 정책 자체는 `lib/frame-margin-policy.mjs`에 있고, 정본 스크립트와 빌더들이 각자
// 마지막 단계에서 그걸 부른다. 그러니 평소에는 이 스크립트가 필요 없다. 손으로 고친
// JSON이나 오래된 백업을 되살릴 때, 그리고 정책을 바꾼 뒤 전부 다시 돌리기 귀찮을 때
// 쓰는 복구 도구다.
//
// 실행: node scripts/install-frame-margin-policy.mjs
// 검사: node scripts/verify-frame-margin-policy.mjs

import fs from 'node:fs';
import path from 'node:path';
import { applyFrameMarginPolicy } from './lib/frame-margin-policy.mjs';

const root = path.resolve(import.meta.dirname, '..');
const workflowDir = path.join(root, 'workflows');

const report = [];
for (const file of fs.readdirSync(workflowDir).filter((name) => name.endsWith('.json')).sort()) {
  const filePath = path.join(workflowDir, file);
  const workflow = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const before = JSON.stringify(workflow);
  const applied = applyFrameMarginPolicy(workflow);
  if (!applied) continue;
  const after = JSON.stringify(workflow);
  if (after !== before) fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
  report.push({
    ...applied,
    margin_node: applied.margin_node || '(이미지 생성 없음 — 프롬프트 없음)',
    changed: after !== before,
  });
}

console.log(JSON.stringify({ ok: true, publishing_circuits: report.length, circuits: report }, null, 2));
