import fs from 'node:fs';
import path from 'node:path';

const root = 'C:/dev/n8n-youtube-shorts-automation/data/source-reel-bundles';
const titles = new Map(Object.entries({
  '약사가 쓰는 여드름 꿀템': '여드름 올라올 때마다 짜면 흉터 남습니다… 약사가 쓰는 꿀템 3가지',
  '레티놀 바르는 방법': '레티날, 얼굴에 그냥 막 바르세요? 주름·기미 고민 부위 4곳',
  '아스파탐, 정말로 위험할까': '제로콜라 마시면 암 걸린다? 약사가 밝히는 아스파탐의 진실',
  '영양제에 1억 태운 약사가 말해주는 좋은 오메가3 찾는 법': '영양제에 1억 태운 약사가 말합니다… 좋은 오메가3 고르는 법',
  '괄사 제대로 쓰는 법': '붓기 빼려다 피부 망칩니다… 괄사 제대로 쓰는 4단계',
  '여드름에 좋은 영양제': '여드름이 계속 올라온다면? 약사가 고른 영양 성분 4가지',
  '증상별 영양제 조합': '이 조합만 알면 5년은 건강 걱정 끝? 증상별 영양제 4가지',
  '여름철 피로회복제': '약사는 여름에 이 3가지를 먹습니다… 축 처질 때 회복 조합',
  '선크림 제대로 바르고 화장하는 법': '선크림 바르고 화장만 하면 밀린다면? 바르는 순서가 틀렸습니다',
  '뷰티약국 약사가 알려주는 화장품 바르는 순서': '화장품 순서 아직도 헷갈리세요? 약사가 정리한 정답 4단계',
  '위고비 마운자로 전에 고려해볼 다이어트 약': '위고비·마운자로만 찾았다면 잠깐… 목적별 다이어트 약 4가지',
  '막힌 코 뚫는 법': '자다가 코 막혀 깬다면 코 풀지 말고 이렇게 해보세요',
  '옛날 약사 vs 요즘 약사': '유명한 약만 찾으면 손해 봅니다… 요즘 약사가 고르는 대안템',
  '피부 망가지는 습관': '매일 피부를 망치고 있었습니다… 둘 중 더 나쁜 습관 4가지',
  '피부미용 약국 꿀템 10가지': '피부 고민 있는데 비싼 것부터 샀다면? 약국 꿀템 4가지',
  '증상별 부족 영양소': '그냥 피곤한 줄 알았죠? 몸이 보내는 SOS 신호 4가지',
  '피로회복제 티어리스트': '피로회복제 이름만 보고 사면 돈 낭비… 약사가 매긴 진짜 순위',
  '물 대신 마셔도 되는거 vs 안 되는 거': '물 대신 아무 차나 마시면 안 됩니다… 매일 마셔도 되는 차',
  '영양제 언제 먹어야하는지 빠르게 알려드릴게요': '비싼 영양제도 이 시간에 먹으면 손해… 약사가 정리한 복용 시간',
  '머리카락에 안 좋은 음식 Top 5': '탈모가 걱정된다면 당장 줄이세요… 머리카락에 안 좋은 음식 TOP 4',
  '몸이 보내는 염증신호 오히려 좋은 이유': '염증 신호가 오히려 좋은 이유… 무조건 없애면 안 됩니다?',
  '스트레스 신호와 해결법': '스트레스가 쌓이면 입안에 이 흔적이 생깁니다',
  '종합비타민 티어표': '광고 없이 약사가 매긴 종합비타민 등급표… 1위는?',
  '타이레놀 사용법': '타이레놀, 감기약과 같이 먹어도 될까? 꼭 알아야 할 4가지',
  '뷰티약국 약사는 쓰는 vs 안쓰는': '뷰티약국 약사는 이건 매일 안 씁니다… 피부장벽 교체템 4가지',
  '블랙헤드인줄 알고 짜면 왕모공된다고': '블랙헤드인 줄 알고 짜면 왕모공 됩니다… 정체는 따로 있습니다',
  '라면 티어리스트': '다이어트 중에도 먹을 수 있는 라면은? 약사가 매긴 티어리스트',
}));

let updated = 0;
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const manifestPath = path.join(root, entry.name, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
  if (manifest.status !== 'md_ready') continue;
  const sourceName = entry.name.replace(/^\d{6}\s+/, '');
  const title = titles.get(sourceName);
  if (!title) throw new Error(`curated title missing: ${sourceName}`);
  if (title.length > 70) throw new Error(`curated title too long: ${title}`);
  manifest.youtube_hook_title = title;
  manifest.youtube_hook_source = 'original_folder_caption_transcript';
  manifest.updated_at = new Date().toISOString();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  updated += 1;
}
if (updated === 0) throw new Error('no pending titles found');
console.log(JSON.stringify({ ok: true, updated }));
