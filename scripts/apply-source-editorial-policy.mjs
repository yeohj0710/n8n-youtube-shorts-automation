import fs from 'node:fs';
import path from 'node:path';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const topicDirs = [path.join(root, '하루건강약사 소재'), path.join(root, '건강장수비결 소재')];
const files = [];
for (const topicDir of topicDirs) {
  for (const entry of fs.readdirSync(topicDir, { recursive: true, withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md')) files.push(path.join(entry.parentPath, entry.name));
  }
}

let updated = 0;
for (const file of files) {
  let md = fs.readFileSync(file, 'utf8');
  if (!/^SOURCE_BUNDLE=/m.test(md)) continue;
  const policy = [
    'EDITORIAL_PRIORITY=원본 캡션과 전체 전사를 함께 읽고 가장 놀랍고 구체적이며 시청 가치가 큰 핵심 1개를 우선한다. 기존 요약보다 원본의 숫자·반전·비교·결론이 더 강하면 그것을 선택한다.',
    'IMAGE_COPY_POLICY=한 화면에서 1~2초 안에 읽히게 한다. 강한 훅 1개와 이해에 꼭 필요한 최소 보조 문구만 사용한다. 모든 근거를 이미지에 욱여넣지 않는다.',
    'VISIBLE_COPY_BUDGET=주요 노출 문구 총량은 한글 약 35~60자를 목표로 한다. 긴 문단·작은 설명글·과밀 카드 금지.',
    'LAYOUT_POLICY=순위·체크리스트·단계·비교 형식을 강제하지 않는다. 원본 핵심에 맞춰 이미지 AI가 자율적으로 구성한다.',
  ].join('\n');
  md = md.replace(/\nEDITORIAL_PRIORITY=.*?(?=\n(?:SOURCE_DETAIL_BEGIN|$))/s, '');
  md = md.replace(/\nSOURCE_DETAIL_BEGIN/, `\n${policy}\n\nSOURCE_DETAIL_BEGIN`);
  fs.writeFileSync(file, md, 'utf8');
  updated += 1;
}
console.log(JSON.stringify({ ok: true, updated }));
