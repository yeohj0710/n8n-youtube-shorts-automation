import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sqlite3 from 'sqlite3';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const dbPath = path.join(root, '.n8n', 'database.sqlite');
const stamp = timestamp();
const dbBackupDir = path.join(root, '.n8n', 'backup-before-popular-topic-lanes-' + stamp);
const workflowIds = ['mxrYb3maJS31gEYC', 'baekse100Life01'];

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  return JSON.parse(value);
}

function backupDatabase() {
  fs.mkdirSync(dbBackupDir, { recursive: true });
  for (const suffix of ['', '-wal', '-shm']) {
    const source = dbPath + suffix;
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, path.join(dbBackupDir, path.basename(source)));
    }
  }
}

function findWorkflowFile(id) {
  const workflowDir = path.join(root, 'workflows');
  for (const name of fs.readdirSync(workflowDir)) {
    if (!name.endsWith('.json') || name.includes('.backup')) continue;
    const file = path.join(workflowDir, name);
    try {
      const workflow = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (workflow.id === id) return file;
    } catch {
      // Ignore non-workflow JSON.
    }
  }
  throw new Error('Workflow file not found for id: ' + id);
}

function requireNode(nodes, name) {
  const node = nodes.find((entry) => entry.name === name);
  if (!node) throw new Error('Missing node: ' + name);
  return node;
}

function replaceBetween(code, startMarker, endMarker, replacement) {
  const start = code.indexOf(startMarker);
  if (start < 0) throw new Error('Missing start marker: ' + startMarker);
  const end = code.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error('Missing end marker after ' + startMarker + ': ' + endMarker);
  return code.slice(0, start) + replacement + code.slice(end);
}

const broadViralReferenceTitles = `const broadViralReferenceTitles = [
  '나이 들수록 매일 먼저 바꿔야 할 생활 습관 10',
  '내 몸이 보내는 조용한 SOS 신호 10',
  '수면 자세 하나로 아침 컨디션이 달라지는 이유 6',
  '약 먹는 날 무심코 하면 손해 보는 생활 습관 10',
  '물 한 잔도 보약처럼 마시는 타이밍 7',
  '시니어라면 꼭 알아둘 건강 숫자 10',
  '대부분 잘못 알고 있는 자동차 상식 10',
  '생활비 새는 집에서 먼저 확인할 것 7',
  '손톱과 얼굴로 보는 내 몸 체크 신호 9',
  '전기밥솥 200% 활용하는 살림 비법 6',
  '주방 일이 10배 쉬워지는 살림 지혜 10',
  '사람 관계에서 절대 고쳐 쓰려 하지 말아야 할 순간 7',
  '똑똑한 사람은 절대 안 하는 생활 선택 8',
  '혼자 살아도 품위 있게 나이 드는 습관 7',
  '유통기한 지났다고 바로 버리면 손해 보는 활용법 12',
  '돈 걱정 줄이는 노후 생활 관리법 10',
];`;

const benchmarkInspiredTitles = `const benchmarkInspiredTitles = [
  '병원비 쓰기 전에 매일 먼저 챙길 생활 습관 10',
  '내 몸을 편하게 하는 건강 수면 자세 6가지',
  '약 먹는 날 효과를 깎을 수 있는 생활 습관 10',
  '약 먹는 시간만 바꿔도 놓치기 쉬운 포인트 7',
  '손톱이 알려주는 건강 이상 신호 9가지',
  '얼굴만 봐도 알 수 있는 몸 상태 신호 10가지',
  '아침마다 장이 편해지는 생활 루틴 7',
  '물 마시는 습관 하나로 달라지는 몸의 신호 7',
  '꼭 알아둬야 할 시니어 필수 건강 숫자 10',
  '나이 들수록 반드시 줄여야 할 음식 습관 5',
  '영양제 사기 전 먼저 볼 대체 식품 11',
  '된장찌개 맛이 안 나는 진짜 이유 8',
  '요리 맛이 2배 좋아지는 특급 비결 10',
  '대부분 잘못 알고 있는 자동차 상식 10',
  '수리비 아끼는 자동차 소모품 교체 주기 총정리',
  '내 지갑 속 숨은 보물 희귀 동전 시세 총정리',
  '평생 돈 걱정 덜어주는 후회 없는 돈 관리법 10',
  '전기밥솥 아직 밥만 하면 손해 보는 활용법 6',
  '주방 일을 10배 쉽게 만드는 고수들의 지혜',
  '다 부질없다 싶을 때 나를 위해 바꿀 생활 태도 7',
  '절대 사람을 고쳐 쓰려 하지 말아야 할 이유 7',
  '진짜 똑똑한 사람은 절대 안 하는 8가지',
];`;

const combinedBroadViralReferenceTitles = `const broadViralReferenceTitles = [
  '나이 들수록 매일 먼저 바꿔야 할 생활 습관 10',
  '내 몸이 보내는 조용한 SOS 신호 10',
  '수면 자세 하나로 아침 컨디션이 달라지는 이유 6',
  '약 먹는 날 무심코 하면 손해 보는 생활 습관 10',
  '물 한 잔도 보약처럼 마시는 타이밍 7',
  '시니어라면 꼭 알아둘 건강 숫자 10',
  '대부분 잘못 알고 있는 자동차 상식 10',
  '생활비 새는 집에서 먼저 확인할 것 7',
  '손톱과 얼굴로 보는 내 몸 체크 신호 9',
  '전기밥솥 200% 활용하는 살림 비법 6',
  '주방 일이 10배 쉬워지는 살림 지혜 10',
  '사람 관계에서 절대 고쳐 쓰려 하지 말아야 할 순간 7',
  '똑똑한 사람은 절대 안 하는 생활 선택 8',
  '혼자 살아도 품위 있게 나이 드는 습관 7',
  '유통기한 지났다고 바로 버리면 손해 보는 활용법 12',
  '돈 걱정 줄이는 노후 생활 관리법 10',
  '병원비 쓰기 전에 매일 먼저 챙길 생활 습관 10',
  '약 먹는 시간만 바꿔도 놓치기 쉬운 포인트 7',
  '영양제 사기 전 먼저 볼 대체 식품 11',
  '대부분 잘못 알고 있는 생활 상식 10가지',
];`;

const laneCategoryMap = `const laneCategoryMap = {
  daily_health_lifestyle: 'body_signal',
  body_signal_selfcheck: 'body_signal',
  sleep_energy_recovery: 'sleep',
  movement_mobility_longevity: 'movement',
  food_nutrition_table: 'food',
  home_kitchen_living: 'home',
  money_smart_living: 'money',
  practical_life_common_sense: 'common_sense',
  senior_life_relationship: 'senior_life',
  daily_health_habits: 'body_signal',
  sleep_posture_recovery: 'sleep',
  medicine_routine_safety: 'body_signal',
  body_signal_checks: 'body_signal',
  health_numbers_knowledge: 'common_sense',
  water_hydration_timing: 'body_signal',
  movement_longevity: 'movement',
  senior_relationship_mindset: 'senior_life',
  money_life_management: 'money',
  household_saving_tricks: 'home',
  car_home_maintenance: 'common_sense',
  practical_common_sense: 'common_sense',
  cooking_reason_secrets: 'food',
  food_immunity_table: 'food',
  shopping_label_savings: 'food',
  blood_sugar_meals: 'food',
  digestion_gut: 'food',
  hydration_salt: 'food',
  kitchen_storage: 'food',
  shopping_labels: 'food',
  supplement_basics: 'food',
  food_cooking_magic: 'food',
  sleep_recovery: 'sleep',
  evening_reset: 'sleep',
  joint_mobility: 'movement',
  body_signals: 'body_signal',
  morning_energy: 'body_signal',
  seasonal_home: 'home',
  household_common_sense: 'home',
  money_saving_home: 'money',
  senior_life_wisdom: 'senior_life',
  brain_memory_knowledge: 'common_sense',
};

`;

const categoryForTitle = `function categoryForTitle(value) {
  const text = clean(value).toLowerCase();
  const checks = [
    ['sleep', /잠|수면|새벽|침실|자기 전|밤|저녁 루틴|불면|아침까지|잠자기|수면 자세|베개|뒤척/],
    ['movement', /걷|무릎|허리|관절|계단|다리|발목|하체|자세|스트레칭|운동|발로|보행/],
    ['body_signal', /몸|신호|피로|갈증|붓|소변|컨디션|기력|뇌|기억|눈|손발|손톱|얼굴|외모|아침 몸|매일 습관|건강 습관|약 먹는 날|복용|약 먹는 시간|면역/],
    ['money', /돈|생활비|병원비|약값|전기요금|절약|반값|손해|장바구니|지갑|시세|동전|수리비|관리법/],
    ['senior_life', /은퇴|혼자|대접|말습관|품위|시니어|노후|자격증|인간관계|말년|사람|복수|부질없|나를 위해/],
    ['home', /집|정리|살림|에어컨|장마|습도|환기|조명|실내|전자레인지|전기밥솥|생활 필수품|자동차|소모품|주방 일/],
    ['common_sense', /상식|외래어|대화|퀴즈|모르면|잘못 알고|궁금|지식|숫자|top|총정리|비하인드|대운|똑똑/],
    ['food', /식사|식탁|밥|음식|식품|식재료|재료|반찬|집밥|조리|요리|국물|찌개|커피|간식|야식|과일|먹으면|먹는 음식|먹을 음식|먹어야|혈당|당뇨|단맛|나트륨|소금|더부룩|소화|장 건강|냉장고|보관|유통기한|라벨|장볼|장보기|마트|간편식|영양제|약국|주방|면역 음식/],
  ];
  return checks.find(([, pattern]) => pattern.test(text))?.[0] || '';
}

`;

const contentLanes = `const contentLanes = [
  { id: 'daily_health_lifestyle', title: '생활건강 습관', angle: '아침·저녁·외출·집안 루틴, 물·커피·약 먹는 날 주변 습관, 병원 가기 전 생활 점검처럼 매일 반복되는 행동 전체' },
  { id: 'body_signal_selfcheck', title: '몸 신호와 자가체크', angle: '손톱, 얼굴, 눈, 소변색, 붓기, 피로, 갈증, 체온감, 컨디션 변화처럼 진단이 아닌 관찰형 신호 전체' },
  { id: 'sleep_energy_recovery', title: '수면·피로·회복', angle: '수면 자세 하나가 아니라 잠자리 환경, 새벽 각성, 낮잠, 저녁 루틴, 아침 피로, 기력 회복까지 넓게 다룸' },
  { id: 'movement_mobility_longevity', title: '걷기·움직임·자세', angle: '걷기, 계단, 신발, 보폭, 균형, 허리·무릎 부담, 집안 동선, 오래 앉기처럼 평생 움직임 전체' },
  { id: 'food_nutrition_table', title: '식탁·영양·장보기', angle: '음식 하나가 아니라 식사 순서, 장보기, 라벨, 대체 식품, 보관, 조리, 영양제 비용까지 식탁 의사결정 전체' },
  { id: 'home_kitchen_living', title: '살림·주거·주방', angle: '냉장고, 전기밥솥, 전자레인지, 청소, 정리, 계절 환경, 생활용품 활용처럼 저장형 생활 지혜 전체' },
  { id: 'money_smart_living', title: '생활비·소비·절약', angle: '병원비·약값 표현에 갇히지 않고 생활비, 수리비, 장바구니, 전기요금, 지갑 속 물건, 노후 돈 관리까지 다룸' },
  { id: 'practical_life_common_sense', title: '생활상식·물건관리', angle: '자동차, 유통기한, 소모품, 숫자, 대부분 잘못 아는 상식, 총정리형 정보처럼 중장년 저장 욕구가 큰 실용 지식' },
  { id: 'senior_life_relationship', title: '노후생활·관계·태도', angle: '혼자 살기, 은퇴 후 루틴, 말습관, 사람 관계, 품위, 나를 위해 사는 법처럼 시니어 삶의 기술 전체' },
];`;

const evergreenPool = `const evergreenPool = [
  { lane: 'daily_health_lifestyle', title: '나이 들수록 매일 먼저 바꿔야 할 생활 습관 10' },
  { lane: 'daily_health_lifestyle', title: '병원 가기 전 집에서 먼저 확인할 생활 체크 10' },
  { lane: 'daily_health_lifestyle', title: '아침 첫 30분에 몸을 망치는 습관 7' },
  { lane: 'daily_health_lifestyle', title: '약 먹는 날 무심코 하면 손해 보는 생활 습관 7' },
  { lane: 'daily_health_lifestyle', title: '물 한 잔도 보약처럼 느껴지는 하루 루틴 7' },
  { lane: 'daily_health_lifestyle', title: '건강하게 오래 사는 사람들이 매일 피하는 행동 7' },
  { lane: 'body_signal_selfcheck', title: '내 몸이 보내는 조용한 SOS 신호 10' },
  { lane: 'body_signal_selfcheck', title: '손톱이 알려주는 몸 상태 신호 9가지' },
  { lane: 'body_signal_selfcheck', title: '얼굴만 봐도 알 수 있는 몸 상태 신호 10가지' },
  { lane: 'body_signal_selfcheck', title: '소변 색으로 확인하는 하루 컨디션 신호 7' },
  { lane: 'body_signal_selfcheck', title: '아침마다 붓는 사람이 놓치는 몸의 신호 7' },
  { lane: 'body_signal_selfcheck', title: '피곤함이 오래갈 때 먼저 볼 생활 신호 7' },
  { lane: 'sleep_energy_recovery', title: '새벽에 자주 깨는 사람이 무심코 하는 행동 7' },
  { lane: 'sleep_energy_recovery', title: '아침까지 피곤한 사람이 놓치는 침실 조건 7' },
  { lane: 'sleep_energy_recovery', title: '수면 자세보다 먼저 봐야 할 잠자리 습관 7' },
  { lane: 'sleep_energy_recovery', title: '낮에 졸린 사람이 저녁에 반복하는 습관 7' },
  { lane: 'sleep_energy_recovery', title: '자기 전 이것만 줄여도 밤이 편해지는 습관 7' },
  { lane: 'sleep_energy_recovery', title: '쉬었는데 더 피곤한 사람의 회복 습관 7' },
  { lane: 'movement_mobility_longevity', title: '평생 내 발로 걷고 싶다면 먼저 볼 습관 7' },
  { lane: 'movement_mobility_longevity', title: '무릎이 먼저 늙는 사람이 반복하는 행동 7' },
  { lane: 'movement_mobility_longevity', title: '걷기 운동해도 다리가 무거운 이유 7' },
  { lane: 'movement_mobility_longevity', title: '계단 오를 때 무릎 부담 키우는 실수 7' },
  { lane: 'movement_mobility_longevity', title: '오래 앉아 있는 사람이 꼭 바꿀 자세 습관 7' },
  { lane: 'movement_mobility_longevity', title: '집안에서 낙상 위험을 키우는 동선 실수 7' },
  { lane: 'food_nutrition_table', title: '나이 들수록 반드시 줄여야 할 음식 습관 5' },
  { lane: 'food_nutrition_table', title: '영양제 사기 전 먼저 볼 대체 식품 11' },
  { lane: 'food_nutrition_table', title: '같은 밥상, 혈당 급행 vs 저속행 선택 7' },
  { lane: 'food_nutrition_table', title: '장볼 때 건강해 보여도 다시 봐야 할 라벨 7' },
  { lane: 'food_nutrition_table', title: '냉장고에 넣으면 손해 보는 식재료 7' },
  { lane: 'food_nutrition_table', title: '된장찌개 맛이 안 나는 진짜 이유 8' },
  { lane: 'home_kitchen_living', title: '전기밥솥 아직 밥만 하면 손해 보는 활용법 6' },
  { lane: 'home_kitchen_living', title: '주방 일을 10배 쉽게 만드는 고수들의 지혜 10' },
  { lane: 'home_kitchen_living', title: '유통기한 지났다고 바로 버리면 손해 보는 활용법 12' },
  { lane: 'home_kitchen_living', title: '전자레인지 돌리기 전 꼭 확인할 생활 상식 7' },
  { lane: 'home_kitchen_living', title: '집 정리할 때 1순위로 비워야 할 것 10' },
  { lane: 'home_kitchen_living', title: '여름 집안에서 컨디션을 흔드는 환경 습관 7' },
  { lane: 'money_smart_living', title: '평생 돈 걱정 덜어주는 후회 없는 돈 관리법 10' },
  { lane: 'money_smart_living', title: '생활비 새는 집에서 먼저 확인할 것 7' },
  { lane: 'money_smart_living', title: '수리비 아끼려면 먼저 보는 소모품 체크 7' },
  { lane: 'money_smart_living', title: '내 지갑 속 숨은 보물 확인법 7' },
  { lane: 'money_smart_living', title: '장바구니에서 매달 돈 새는 선택 7' },
  { lane: 'money_smart_living', title: '전기요금 줄이려면 먼저 바꿀 집안 습관 7' },
  { lane: 'practical_life_common_sense', title: '대부분 잘못 알고 있는 자동차 상식 10가지' },
  { lane: 'practical_life_common_sense', title: '수리비 아끼는 자동차 소모품 교체 주기 총정리' },
  { lane: 'practical_life_common_sense', title: '대부분이 잘못 알고 있는 생활 상식 10가지' },
  { lane: 'practical_life_common_sense', title: '모르면 평생 손해 보는 집안 상식 7' },
  { lane: 'practical_life_common_sense', title: '어른들도 자주 틀리는 생활 지식 총정리' },
  { lane: 'practical_life_common_sense', title: '차 안에 두면 손해 보는 물건 7' },
  { lane: 'senior_life_relationship', title: '절대 사람을 고쳐 쓰려 하지 말아야 할 이유 7' },
  { lane: 'senior_life_relationship', title: '다 부질없다 싶을 때 나를 위해 바꿀 생활 태도 7' },
  { lane: 'senior_life_relationship', title: '돈 없어도 대접받는 사람의 말습관 7' },
  { lane: 'senior_life_relationship', title: '혼자 살아도 품위 있게 나이 드는 습관 7' },
  { lane: 'senior_life_relationship', title: '은퇴 후 하루가 무너지지 않는 생활 루틴 7' },
  { lane: 'senior_life_relationship', title: '나이 들수록 절대 붙잡지 말아야 할 관계 7' },
];`;

function patchBuildCode(code) {
  if (code.includes('const benchmarkInspiredTitles =')) {
    code = replaceBetween(
      code,
      'const broadViralReferenceTitles = [',
      'const benchmarkInspiredTitles =',
      broadViralReferenceTitles + '\n',
    );
    code = replaceBetween(
      code,
      'const benchmarkInspiredTitles = [',
      'const rssItems =',
      benchmarkInspiredTitles + '\n',
    );
  } else {
    code = replaceBetween(
      code,
      'const broadViralReferenceTitles = [',
      'const rssItems =',
      combinedBroadViralReferenceTitles + '\n',
    );
  }
  code = replaceBetween(
    code,
    'const laneCategoryMap = {',
    'function normalizeCategory',
    laneCategoryMap,
  );
  code = replaceBetween(
    code,
    'function categoryForTitle(value) {',
    'function parseCategoryList',
    categoryForTitle,
  );
  code = replaceBetween(
    code,
    'const contentLanes = [',
    'const topicCategoryCooldown =',
    contentLanes + '\n',
  );
  code = replaceBetween(
    code,
    'const evergreenPool = [',
    'const laneCandidates =',
    evergreenPool + '\n',
  );

  const benchmarkLine =
    "'Use benchmarked high-interest patterns from @건강-d4i popular Shorts, but keep content lanes broad enough for dozens of videos. Treat 수면자세, 약 먹는 시간, 물 타이밍, 자동차 소모품, 전기밥솥 활용 as angles/examples inside broad lanes, not standalone lanes. Translate risky medical hooks into safe daily-life wording.',";
  if (code.includes('@건강-d4i popular Shorts') && !code.includes('content lanes broad enough for dozens of videos')) {
    code = code.replace(
      /\s+'Use benchmarked high-interest patterns from @건강-d4i popular Shorts[^']*',/,
      '\n  ' + benchmarkLine,
    );
  } else if (!code.includes('@건강-d4i popular Shorts')) {
    code = code.replace(
      "'This run must feel different from prior uploads. Use a fresh topic lane, fresh objects, fresh verbs, and fresh thumbnail mood.',",
      "'This run must feel different from prior uploads. Use a fresh topic lane, fresh objects, fresh verbs, and fresh thumbnail mood.',\n  " + benchmarkLine,
    );
  }

  code = code
    .replaceAll('function normalizeCategoryfunction normalizeCategory', 'function normalizeCategory')
    .replaceAll('function parseCategoryListfunction parseCategoryList', 'function parseCategoryList');

  if (!code.includes("daily_health_lifestyle")) throw new Error('Popular lanes patch failed');
  if (code.includes("sleep_posture_recovery', title: '수면 자세") || code.includes("medicine_routine_safety', title: '약 먹는 날")) {
    throw new Error('Narrow lanes survived patch');
  }
  if (!code.includes('@건강-d4i popular Shorts')) throw new Error('Benchmark prompt patch failed');
  return code;
}

function patchWorkflowShape(workflow) {
  const build = requireNode(workflow.nodes, 'Build Viral Rank Pack Request');
  build.parameters = build.parameters || {};
  build.parameters.jsCode = patchBuildCode(build.parameters.jsCode || '');
  return workflow;
}

function patchWorkflowFile(id) {
  const file = findWorkflowFile(id);
  fs.copyFileSync(file, file + '.backup-popular-topic-lanes-' + stamp);
  const workflow = JSON.parse(fs.readFileSync(file, 'utf8'));
  patchWorkflowShape(workflow);
  fs.writeFileSync(file, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
  return { id: workflow.id, name: workflow.name, nodes: workflow.nodes.length, file };
}

function readDbWorkflow(db, id) {
  return new Promise((resolve, reject) => {
    db.get('select id, name, nodes, connections from workflow_entity where id=?', [id], (error, row) => {
      if (error) reject(error);
      else if (!row) reject(new Error('Workflow not found in DB: ' + id));
      else resolve({
        id: row.id,
        name: row.name,
        nodes: parseJson(row.nodes, []),
        connections: parseJson(row.connections, {}),
      });
    });
  });
}

function updateDbWorkflow(db, workflow) {
  return new Promise((resolve, reject) => {
    db.run(
      "update workflow_entity set nodes=?, versionId=?, versionCounter=versionCounter+1, updatedAt=strftime('%Y-%m-%d %H:%M:%f','now') where id=?",
      [JSON.stringify(workflow.nodes), randomUUID(), workflow.id],
      function onUpdate(error) {
        if (error) reject(error);
        else resolve(this.changes);
      },
    );
  });
}

backupDatabase();
const fileResults = workflowIds.map((id) => patchWorkflowFile(id));

const db = new sqlite3.Database(dbPath);
const dbResults = [];
try {
  for (const id of workflowIds) {
    const workflow = await readDbWorkflow(db, id);
    patchWorkflowShape(workflow);
    const changes = await updateDbWorkflow(db, workflow);
    dbResults.push({ id, name: workflow.name, nodes: workflow.nodes.length, changes });
  }
} finally {
  await new Promise((resolve) => db.close(resolve));
}

console.log(JSON.stringify({
  ok: true,
  dbBackupDir,
  fileResults,
  dbResults,
}, null, 2));
