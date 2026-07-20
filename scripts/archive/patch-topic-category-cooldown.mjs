import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sqlite3 from 'sqlite3';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const dbPath = path.join(root, '.n8n', 'database.sqlite');
const backupDir = path.join(root, '.n8n', 'backup-before-topic-category-cooldown-' + timestamp());

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
  fs.mkdirSync(backupDir, { recursive: true });
  for (const suffix of ['', '-wal', '-shm']) {
    const source = dbPath + suffix;
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, path.join(backupDir, path.basename(source)));
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

function nodeByName(nodes, name) {
  return nodes.find((node) => node.name === name);
}

function requireNode(nodes, name) {
  const node = nodeByName(nodes, name);
  if (!node) throw new Error('Missing node: ' + name);
  return node;
}

function patchLoadConfigCode(code) {
  if (code.includes('topic_category_override:')) return code;

  return code.replace(
    /diversity_mode:\s*incoming\.diversity_mode\s*\|\|\s*'rotating_profiles',\n/,
    [
      "diversity_mode: incoming.diversity_mode || 'rotating_profiles',",
      '  category_cooldown_window: Number(incoming.category_cooldown_window || 5),',
      '  category_cooldown_threshold: Number(incoming.category_cooldown_threshold || 2),',
      '  topic_category_override: cleanString(incoming.topic_category || incoming.topic_category_override),',
      '  blocked_topic_categories: list(incoming.blocked_topic_categories || incoming.blocked_categories),',
      '',
    ].join('\n'),
  );
}

function patchBuildCode(code) {
  if (code.includes('const topicCategories = [')) return code;

  const cooldownBlock = `const topicCategories = [
  { id: 'food', title: '음식·식사·식품·장보기' },
  { id: 'sleep', title: '수면·저녁 루틴' },
  { id: 'movement', title: '걷기·무릎·자세' },
  { id: 'body_signal', title: '몸의 신호·컨디션' },
  { id: 'home', title: '집안·계절·살림' },
  { id: 'money', title: '생활비·병원비·절약' },
  { id: 'senior_life', title: '노후·인간관계·생활태도' },
  { id: 'common_sense', title: '상식·지식·궁금증' },
];

const laneCategoryMap = {
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

function normalizeCategory(value) {
  const key = clean(value).toLowerCase().replace(/[\\s-]+/g, '_');
  const aliases = {
    meal: 'food',
    meals: 'food',
    eating: 'food',
    shopping: 'food',
    grocery: 'food',
    groceries: 'food',
    movement_mobility: 'movement',
    walking: 'movement',
    body_signals: 'body_signal',
    signals: 'body_signal',
    household: 'home',
    house: 'home',
    senior: 'senior_life',
    life: 'senior_life',
    knowledge: 'common_sense',
    common: 'common_sense',
  };
  const normalized = aliases[key] || key;
  return topicCategories.some((category) => category.id === normalized) ? normalized : '';
}

function categoryForLane(lane) {
  return laneCategoryMap[clean(lane)] || '';
}

function categoryForTitle(value) {
  const text = clean(value).toLowerCase();
  const checks = [
    ['food', /식사|식탁|밥|먹|음식|식품|식재료|재료|반찬|집밥|조리|요리|국물|커피|간식|야식|과일|혈당|당뇨|단맛|나트륨|소금|더부룩|소화|장 건강|냉장고|보관|유통기한|라벨|장볼|장보기|마트|간편식|영양제|약국|주방/],
    ['sleep', /잠|수면|새벽|침실|자기 전|밤|저녁 루틴|불면|아침까지|잠자기/],
    ['movement', /걷|무릎|허리|관절|계단|다리|발목|하체|자세|스트레칭|운동/],
    ['body_signal', /몸|신호|피로|갈증|붓|소변|컨디션|기력|뇌|기억|눈|손발/],
    ['money', /돈|생활비|병원비|약값|전기요금|절약|반값|손해|장바구니/],
    ['senior_life', /은퇴|혼자|대접|말습관|품위|시니어|노후|자격증|인간관계|말년/],
    ['home', /집|정리|살림|에어컨|장마|습도|환기|조명|실내|전자레인지|생활 필수품/],
    ['common_sense', /상식|외래어|대화|퀴즈|모르면|잘못 알고|궁금|지식/],
  ];
  return checks.find(([, pattern]) => pattern.test(text))?.[0] || '';
}

function parseCategoryList(value) {
  if (Array.isArray(value)) return value.map(normalizeCategory).filter(Boolean);
  return clean(value).split(/[,|\\s]+/).map(normalizeCategory).filter(Boolean);
}

function buildTopicCategoryCooldown(recentTitles, cfg) {
  const windowSize = Number(cfg.category_cooldown_window || 5);
  const threshold = Number(cfg.category_cooldown_threshold || 2);
  const recentWindow = recentTitles.slice(0, windowSize).map((title) => ({
    title,
    category: categoryForTitle(title),
  })).filter((entry) => entry.category);

  const counts = {};
  for (const entry of recentWindow) {
    counts[entry.category] = (counts[entry.category] || 0) + 1;
  }

  const blockedSet = new Set(parseCategoryList(cfg.blocked_topic_categories));
  for (const [category, count] of Object.entries(counts)) {
    if (count >= threshold) blockedSet.add(category);
  }
  if (recentWindow.length >= 2 && recentWindow[0].category === recentWindow[1].category) {
    blockedSet.add(recentWindow[0].category);
  }

  const forcedCategory = normalizeCategory(cfg.topic_category_override);
  if (forcedCategory) blockedSet.delete(forcedCategory);

  const blockedCategories = [...blockedSet];
  return {
    window_size: windowSize,
    threshold,
    recent_window: recentWindow,
    counts,
    forced_category: forcedCategory || null,
    blocked_categories: blockedCategories,
    allowed_categories: topicCategories.map((category) => category.id).filter((id) => !blockedCategories.includes(id) || id === forcedCategory),
  };
}

`;

  const insertMarker = 'const queuedTopicDuplicateOf =';
  if (!code.includes(insertMarker)) throw new Error('Could not find queued topic marker');
  code = code.replace(insertMarker, cooldownBlock + insertMarker);

  code = code.replace(
    /const selectedLane =\n\s+findById\(contentLanes, cfg\.content_lane_override\) \|\|\n\s+pick\(contentLanes, 'content_lane'\);/,
    `const topicCategoryCooldown = buildTopicCategoryCooldown(recentTitles, cfg);
const eligibleContentLanes = contentLanes.filter((lane) => {
  const category = categoryForLane(lane.id);
  if (topicCategoryCooldown.forced_category) return category === topicCategoryCooldown.forced_category;
  return !topicCategoryCooldown.blocked_categories.includes(category);
});
const lanePool = eligibleContentLanes.length ? eligibleContentLanes : contentLanes;
const selectedLane =
  findById(contentLanes, cfg.content_lane_override) ||
  pick(lanePool, 'content_lane|' + topicCategoryCooldown.blocked_categories.join(',') + '|' + recentTitles.slice(0, 5).join('|'));
const selectedTopicCategory = categoryForLane(selectedLane.id) || categoryForTitle(selectedLane.title) || 'common_sense';`,
  );

  code = code.replace(
    /score: \(entry\.lane === selectedLane\.id \? 85 : 55\) - index \/ 100,\n\s+}\)\)/,
    "score: (entry.lane === selectedLane.id ? 85 : 55) - index / 100,\n    category: categoryForTitle(entry.title) || categoryForLane(entry.lane),\n  }))",
  );

  const seenStart = code.indexOf('const seen = new Set();');
  const tiredStart = code.indexOf('const tiredExamples = [', seenStart);
  if (seenStart < 0 || tiredStart < 0) throw new Error('Could not find candidate filter block');

  const candidateBlock = `const seen = new Set();
const duplicateTopicCandidates = [];
const topic_candidates = [...manual, ...referenceViral, ...rss, ...laneCandidates].filter((candidate) => {
  const title = clean(candidate.title);
  const key = normalizeDuplicateTitle(title);
  if (!title || seen.has(key)) return false;
  seen.add(key);

  const duplicateOf = recentTitleMatch(title);
  if (duplicateOf) {
    duplicateTopicCandidates.push({ title, source: candidate.source, lane: candidate.lane, duplicate_of: duplicateOf });
    return false;
  }

  const category = categoryForTitle(title) || categoryForLane(candidate.lane) || candidate.category || selectedTopicCategory;
  candidate.category = category;
  const manualSource = ['manual', 'topic_file', 'topic_queue'].includes(candidate.source);
  if (!manualSource && topicCategoryCooldown.blocked_categories.includes(category)) {
    duplicateTopicCandidates.push({ title, source: candidate.source, lane: candidate.lane, blocked_category: category });
    return false;
  }

  return true;
}).slice(0, 30);

`;
  code = code.slice(0, seenStart) + candidateBlock + code.slice(tiredStart);

  code = code.replace(
    /content_lane: selectedLane\.id,\n/,
    "topic_category: selectedTopicCategory,\n  content_lane: selectedLane.id,\n",
  );

  code = code.replace(
    /'Selected content lane: ' \+ selectedLane\.id \+ ' \/ ' \+ selectedLane\.title \+ '\. Angle: ' \+ selectedLane\.angle \+ '\.',/,
    [
      "'Selected content lane: ' + selectedLane.id + ' / ' + selectedLane.title + '. Angle: ' + selectedLane.angle + '.',",
      "'Selected top-level category: ' + selectedTopicCategory + '.',",
      "topicCategoryCooldown.blocked_categories.length ? 'Hard category cooldown for this run: do not choose or generate topics in these overused categories: ' + topicCategoryCooldown.blocked_categories.join(', ') + '. Food means meals, blood sugar, digestion, hydration/salt, food labels, groceries, supplements, fridge/storage, cooking, and any food object. Pick from allowed categories instead: ' + topicCategoryCooldown.allowed_categories.join(', ') + '.' : '',",
      "topicCategoryCooldown.recent_window.length ? 'Recent category window used for cooldown: ' + topicCategoryCooldown.recent_window.map((entry) => entry.category + '=' + entry.title).join(' / ') + '.' : '',",
    ].join('\n  '),
  );

  code = code.replace(
    /return \[\{ json: \{ \.\.\.base, selected_content_lane: selectedLane, topic_candidates, duplicate_topic_candidates, recent_titles_used: recentTitles, queued_topic_duplicate_of: queuedTopicDuplicateOf, kie_claude_request \} \}\];/,
    'return [{ json: { ...base, selected_content_lane: selectedLane, selected_topic_category: selectedTopicCategory, topic_category_cooldown: topicCategoryCooldown, topic_candidates, duplicate_topic_candidates, recent_titles_used: recentTitles, queued_topic_duplicate_of: queuedTopicDuplicateOf, kie_claude_request } }];',
  );

  if (!code.includes('topicCategoryCooldown')) throw new Error('Category cooldown patch failed');
  if (!code.includes('blocked_category')) throw new Error('Candidate category filter patch failed');
  return code;
}

function patchWorkflowShape(workflow) {
  const loadConfig = requireNode(workflow.nodes, 'Load Config');
  loadConfig.parameters = loadConfig.parameters || {};
  loadConfig.parameters.jsCode = patchLoadConfigCode(loadConfig.parameters.jsCode || '');

  const build = requireNode(workflow.nodes, 'Build Viral Rank Pack Request');
  build.parameters = build.parameters || {};
  build.parameters.jsCode = patchBuildCode(build.parameters.jsCode || '');
  return workflow;
}

function patchWorkflowFile(id) {
  const file = findWorkflowFile(id);
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
  backupDir,
  fileResults,
  dbResults,
}, null, 2));
