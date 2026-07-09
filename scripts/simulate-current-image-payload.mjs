import sqlite3 from 'sqlite3';

const dbPath = 'C:/dev/n8n-youtube-shorts-automation/.n8n/database.sqlite';
const workflowId = 'baekse100Life01';

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

const failedPack = {
  content_lane: 'brain_memory_knowledge',
  theme: '요즘 자주 듣는 외래어 뜻 상식 랭킹',
  hook_title: '뜻 모르면 대화가 막히는 외래어 상식 7',
  subtitle: '이 뜻만 알아도 자녀와 대화가 편해집니다',
  visual_mood_hint: '밝은 아침 식탁 위 노트와 커피잔, 따뜻한 베이지 배경, 민트 포인트, 큼직한 한글 타이포, 손글씨 느낌 체크리스트',
  rank_items: [
    { rank: 1, name: '팩트체크', reason: '사실인지 먼저 확인', caution: '' },
    { rank: 2, name: '루틴', reason: '매일 반복하는 순서', caution: '' },
    { rank: 3, name: '레시피', reason: '음식 만드는 순서', caution: '' },
    { rank: 4, name: '리필', reason: '다시 채워 담기', caution: '' },
    { rank: 5, name: '팁', reason: '작은 도움 정보', caution: '' },
    { rank: 6, name: '체크리스트', reason: '확인할 목록 정리', caution: '' },
    { rank: 7, name: '셀프', reason: '내가 직접 하기', caution: '' },
  ],
  tags: ['장수건강', '시니어생활건강'],
  bgm_prompt: 'calm warm acoustic guitar with light piano',
};

const db = new sqlite3.Database(dbPath);
try {
  const row = await get(db, 'select nodes from workflow_entity where id=?', [workflowId]);
  const nodes = JSON.parse(row.nodes);
  const code = nodes.find((node) => node.name === 'Prepare Image and BGM Payloads')?.parameters?.jsCode;
  if (!code) throw new Error('Prepare Image and BGM Payloads not found');
  const fn = new Function('$input', code);
  const result = fn({ first: () => ({ json: { pack: failedPack, config: { rank_count: 7, kie_image_model: 'gpt-image-2-text-to-image', kie_bgm_model: 'V5_5', variation_seed: 'simulate' } } }) });
  const json = result[0].json;
  const prompt = json.image_payload.input.prompt;
  const bgmPrompt = json.bgm_payload.prompt;
  console.log(JSON.stringify({
    title: json.pack.hook_title,
    descriptionTitle: json.pack.description.split('\n')[0],
    pinnedTitle: json.pack.pinned_comment.split('\n')[1],
    visibleTitleLine: json.visible_card_text.split('\n')[0],
    promptLength: prompt.length,
    bgmPromptLength: bgmPrompt.length,
    bgmPromptOver500: bgmPrompt.length > 500,
    bgmPromptSample: bgmPrompt,
    promptHasWarningDots: prompt.includes('warning dots'),
    promptHasParentChildFrame: /부모님|자녀/.test(prompt),
    promptHasOerae: prompt.includes('외래어'),
    promptSample: prompt.slice(0, 1200),
  }, null, 2));
} finally {
  db.close();
}
