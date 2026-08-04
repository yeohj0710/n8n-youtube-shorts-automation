import fs from 'node:fs';
const edits = [
  {
    file: 'scripts/build-reference-card-workflow.mjs',
    importAfter: "import { safeBoxFor } from './lib/safe-zone.mjs';",
    importLine: "import { applyFrameMarginPolicy } from './lib/frame-margin-policy.mjs';",
    before: "const outputPath = path.join(workflowDir, OUTPUT_FILE);",
    insert: "// 여백 정책은 빌드의 마지막 단계다. 여기서 얹지 않으면 이 빌더를 다시 돌릴 때마다\n// 정책이 벗겨진다.\napplyFrameMarginPolicy(workflow);\n\n",
  },
  {
    file: 'scripts/build-image-drop-workflows.mjs',
    importAfter: null,
    importLine: "import { applyFrameMarginPolicy } from './lib/frame-margin-policy.mjs';",
    before: "  fs.writeFileSync(outputPath, JSON.stringify(workflow, null, 2) + '\n', 'utf8');",
    insert: "  // 여백 정책은 빌드의 마지막 단계다(이 회로는 카드를 생성하지 않으므로 렌더 축소 차단만 걸린다).\n  applyFrameMarginPolicy(workflow);\n",
  },
  {
    file: 'scripts/build-source-reel-workflows.mjs',
    importAfter: null,
    importLine: "import { applyFrameMarginPolicy } from './lib/frame-margin-policy.mjs';",
    before: "  fs.writeFileSync(path.join(root,'workflows',outputFile),JSON.stringify(workflow,null,2)+'\n','utf8');",
    insert: "  // 여백 정책은 빌드의 마지막 단계다.\n  applyFrameMarginPolicy(workflow);\n",
  },
];
for (const e of edits) {
  let text = fs.readFileSync(e.file, 'utf8');
  if (!text.includes(e.importLine)) {
    if (e.importAfter) text = text.replace(e.importAfter, `${e.importAfter}\n${e.importLine}`);
    else {
      const lines = text.split('\n');
      let last = 0;
      for (let i = 0; i < lines.length && i < 40; i += 1) if (lines[i].startsWith('import ')) last = i;
      lines.splice(last + 1, 0, e.importLine);
      text = lines.join('\n');
    }
  }
  if (!text.includes('applyFrameMarginPolicy(workflow);')) {
    if (!text.includes(e.before)) throw new Error(`${e.file}: anchor not found -> ${e.before.slice(0, 60)}`);
    text = text.replace(e.before, e.insert + e.before);
  }
  fs.writeFileSync(e.file, text, 'utf8');
  console.log(`${e.file}: wired`);
}
