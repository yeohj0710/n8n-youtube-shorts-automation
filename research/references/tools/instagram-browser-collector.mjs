import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const channelsPath = path.join(root, 'channels.jsonl');
const itemsPath = path.join(root, 'items.jsonl');
const collectedAt = '2026-07-25';

const drafts = new Map();
const queue = [];
let tab;

const wait = (ms) => tab.playwright.waitForTimeout(ms);

function readJsonl(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

function parseMetric(text) {
  const match = String(text || '').replace(/,/g, '').trim().match(/([\d.]+)\s*([천만억]?)/);
  if (!match) return null;
  return Math.round(Number(match[1]) * ({ '': 1, 천: 1e3, 만: 1e4, 억: 1e8 }[match[2]] ?? 1));
}

function firstLine(caption) {
  return String(caption || '').split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
}

function listCount(title) {
  const match = String(title).match(/(?:TOP\s*|BEST\s*)(\d{1,3})/i) ||
    String(title).match(/(\d{1,3})\s*(?:가지|개명|계명|곳|종|단계|방법|비법|습관|원칙|법칙|특징|이유)/);
  return match ? Number(match[1]) : null;
}

function hookPatterns(title) {
  const rules = [
    ['age_call_out', /(?:\b(?:50|60|70|80)\s*(?:대|세|넘)|나이\s*들|내\s*나이|중년|노년|시니어)/i],
    ['loss_frame', /(?:손해|후회|돈\s*버|억울|늦게\s*알|놓치면|아끼지\s*말)/],
    ['command', /(?:당장|절대|하지\s*마|버리세요|조심|멈추세요|꼭\s*(?:하|먹|알)|챙기세요|외우)/],
    ['authority_flip', /(?:의사.*(?:안|않|말)|고수.*(?:아는|알)|사장님.*알려|전문가.*알려|교수.*알려)/],
    ['number_list', /(?:TOP\s*\d+|BEST\s*\d+|\d+\s*(?:가지|개명|계명|곳|종|단계|방법|비법|습관|원칙|법칙|특징|이유))/i],
    ['paren_preview', /\([^)]{2,}\)/],
    ['belief_reversal', /(?:99%|잘못\s*알|아니라|아닙니다|사실은|진짜\s*이유)/],
    ['threat', /(?:돌연사|생명.*위협|큰일|위험|망가|폭망|암|치매|뇌졸중|심근경색|사망)/],
    ['versus', /(?:\bvs\b|대신|보다\s*더)/i],
    ['identity_quiz', /(?:혈액형|출생년도|사주|체크리스트|몇\s*개\s*맞|재물운|띠별)/],
    ['moment_trigger', /(?:아침|눈뜨자마자|밥\s*먹고|식후|자기\s*전|잠들기\s*전|공복|기상\s*후)/],
    ['insider_reveal', /(?:며느리도|30년\s*차|비밀|폭로|알려주는|공개)/],
  ];
  return rules.filter(([, pattern]) => pattern.test(title)).map(([name]) => name);
}

function topicAxis(text) {
  const rules = [
    ['real_estate_tax', /(?:부동산|등기부|전세|증여세|상속세|재산세|양도세)/],
    ['money_policy', /(?:연금|노후\s*자금|지원금|보험|은행|돈|재물|주식|세금|퇴직|은퇴)/],
    ['hospital_pharmacy', /(?:병원|약국|약\s|복용|처방|의사|검사|수술)/],
    ['disease_risk', /(?:암|치매|뇌졸중|심근경색|당뇨|고혈압|고지혈증|관절염|질환|질병|돌연사)/],
    ['health_signal', /(?:신호|증상|통증|아프|부족|몸이\s*보내|징후|소변|대변|냄새)/],
    ['health_habit', /(?:운동|수면|습관|걷기|스트레칭|근육|장수|건강|혈압|혈당|낙상|양치)/],
    ['cooking_recipe', /(?:레시피|반찬|요리|국|찌개|무침|볶음|밥상|맛있|조리)/],
    ['food_ingredient', /(?:음식|식품|식재료|과일|채소|고기|마늘|양파|콩|두부|계란|보관)/],
    ['cleaning_home', /(?:청소|살림|빨래|냉장고|욕실|화장실|정리|수건|집안일)/],
    ['relationships_family', /(?:인간관계|관계|자식|부모|배우자|가족|인연|대화|손절)/],
    ['phone_digital', /(?:스마트폰|휴대폰|카톡|유튜브|디지털|앱|보이스피싱)/],
    ['appliance_manual', /(?:에어컨|냉장고|세탁기|전자레인지|가전|전기세)/],
    ['clothing_appearance', /(?:옷|패션|외모|머리|피부|젊어|냄새|화장품)/],
    ['car_transport', /(?:자동차|운전|교통|차량|면허|주차)/],
    ['season_weather', /(?:여름|겨울|장마|폭염|한파|무더위|날씨)/],
    ['travel_leisure', /(?:여행|항공권|관광|등산|골프)/],
    ['fortune_identity', /(?:사주|운세|출생년도|혈액형|재물운|풍수|띠별|이름)/],
    ['life_wisdom_psych', /(?:인생|지혜|조언|명언|심리|마음|감정|자존감|품격|행복|불행|태도)/],
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] || 'life_wisdom_psych';
}

function channelAxes(rows) {
  const counts = new Map();
  for (const row of rows) counts.set(row.topic_axis, (counts.get(row.topic_axis) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([axis]) => axis);
}

const targetPattern = /(?:50|60|70|80|나이|중년|노년|시니어|노후|은퇴|연금|건강|혈압|혈당|관절|치매|장수|살림|주부|생활|청소|요리|반찬|식재료|음식|식품|약|인생|지혜|부모|자식)/;
const excludePattern = /(?:여드름|선크림|다이어트\s*보조제|벌크업|취업|아이돌|드라마|예능|뉴스|대통령|국회의원|정당)/;

async function scrollPage() {
  await wait(18000);
  await tab.cua.scroll({ x: 400, y: 300, scrollX: 0, scrollY: 2200 });
  await wait(5000);
}

async function start(handle) {
  const existing = readJsonl(channelsPath);
  if (existing.some((row) => row.platform === 'instagram' && row.handle === handle)) return { handle, status: 'exists' };
  drafts.set(handle, { phase: 'profile', caps: [], metrics: [], meta: null });
  await wait(18000);
  await tab.goto(`https://www.instagram.com/${handle}/`);
  await wait(5000);
  const state = await tab.playwright.evaluate(() => {
    const main = document.querySelector('main');
    return {
    error: Array.from(document.querySelectorAll('main h3')).some((node) => (node.textContent || '').includes('문제가 발생했습니다')),
    login: !!document.querySelector('input[name="username"]'),
    security: Array.from(document.querySelectorAll('main h1,main h2,main h3')).some((node) => /보안|비정상|captcha/i.test(node.textContent || '')),
    og: document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '',
    followerText: Array.from(main?.querySelectorAll('a') || []).map((a) => (a.textContent || '').trim()).find((text) => text.startsWith('팔로워')) || '',
  }});
  if (state.error || state.login || state.security) {
    drafts.delete(handle);
    return { handle, status: state.security ? 'security' : state.login ? 'login' : 'error' };
  }
  drafts.get(handle).meta = state;
  await scrollPage();
  return { handle, status: 'profile_started' };
}

async function profileStep(handle) {
  const draft = drafts.get(handle);
  if (!draft || draft.phase !== 'profile') return { handle, status: 'bad_phase' };
  const profile = await tab.playwright.evaluate((h) => {
    const main = document.querySelector('main');
    const og = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
    const followerText = Array.from(main?.querySelectorAll('a') || []).map((a) => (a.textContent || '').trim()).find((text) => text.startsWith('팔로워')) || '';
    const cards = Array.from(main?.querySelectorAll('a[href*="/reel/"],a[href*="/p/"]') || []).map((a) => {
      const href = a.getAttribute('href') || '';
      const alts = Array.from(a.querySelectorAll('img[alt]')).map((img) => img.getAttribute('alt') || '').filter((alt) => alt && alt !== '클립' && alt !== '릴스');
      return { href, caption: alts.sort((a, b) => b.length - a.length)[0] || '' };
    }).filter((row) => (row.href.includes(`/${h}/reel/`) || row.href.includes(`/${h}/p/`)) && row.caption);
    return { og, followerText, cards };
  }, handle);
  draft.meta ||= profile;
  for (const card of profile.cards) if (!draft.caps.some((row) => row.href === card.href)) draft.caps.push(card);
  if (draft.caps.length < 31) {
    await scrollPage();
    return { handle, status: 'profile_more', captions: draft.caps.length };
  }
  draft.phase = 'reels';
  await wait(18000);
  await tab.goto(`https://www.instagram.com/${handle}/reels/`);
  await wait(5000);
  return { handle, status: 'reels_started', captions: draft.caps.length };
}

function buildPacket(handle) {
  const draft = drafts.get(handle);
  const capMap = new Map(draft.caps.map((row) => [row.href.match(/\/(?:reel|p)\/([^/]+)/)?.[1] || row.href, row.caption]));
  const merged = draft.metrics.map((metric) => {
    const code = metric.href.match(/\/(?:reel|p)\/([^/]+)/)?.[1] || '';
    const isReel = metric.href.includes('/reel/');
    const likes = isReel ? (metric.values.length >= 3 ? parseMetric(metric.values[0]) : null) : parseMetric(metric.values[0]);
    const views = isReel ? parseMetric(metric.values.at(-1)) : null;
    const caption = capMap.get(code) || '';
    return { code, href: metric.href, likes, views, caption, title: firstLine(caption) };
  }).filter((row) => row.code && row.title && (row.views != null || row.likes != null));
  const ranked = merged.filter((row) => row.likes != null).sort((a, b) => b.likes - a.likes);
  const topCount = Math.ceil(draft.metrics.length * 0.3);
  const selected = ranked.filter((row, index) => row.likes >= 500 || index < topCount).slice(0, 10);
  const targetHits = selected.filter((row) => targetPattern.test(row.caption)).length;
  const excludedHits = selected.filter((row) => excludePattern.test(row.caption)).length;
  const accountTarget = targetPattern.test(`${handle} ${draft.meta.og}`) || /(?:senior|silver|health|sallim|salim|life|yaksa)/i.test(handle);
  if (selected.length < 10) return { handle, status: 'few', captions: draft.caps.length, metrics: draft.metrics.length, merged: merged.length, selected: selected.length };
  if ((!accountTarget && targetHits < 4) || excludedHits > 2) return { handle, status: 'off_target', targetHits, excludedHits };
  const ids = new Set(readJsonl(itemsPath).map((row) => row.item_id));
  for (const packet of queue) for (const row of packet.itemRows) ids.add(row.item_id);
  const itemRows = selected.filter((row) => !ids.has(row.code)).map((row) => ({
    platform: 'instagram', channel_handle: handle, item_id: row.code,
    url: `https://www.instagram.com${row.href}`, title: row.title, views: row.views,
    likes: row.likes, published_at: null, list_count: listCount(row.title),
    hook_patterns: hookPatterns(row.title), topic_axis: topicAxis(row.caption), collected_at: collectedAt,
  }));
  if (itemRows.length < 10) return { handle, status: 'duplicate', unique: itemRows.length };
  const display = (draft.meta.og.match(/^(.+?)\s*\(@/) || [])[1] || handle;
  const followers = parseMetric(draft.meta.followerText.replace(/^팔로워\s*/, ''));
  const channelRow = {
    platform: 'instagram', handle, url: `https://www.instagram.com/${handle}/`, name: display,
    subscribers: followers, topic_axes: channelAxes(itemRows), item_count: itemRows.length,
    collected_at: collectedAt, blocked: false,
  };
  queue.push({ channelRow, itemRows });
  drafts.delete(handle);
  return { handle, status: 'ready', followers, captions: draft.caps.length, metrics: draft.metrics.length, merged: merged.length, likesKnown: itemRows.filter((row) => row.likes != null).length, viewsMin: Math.min(...itemRows.map((row) => row.views)), viewsMax: Math.max(...itemRows.map((row) => row.views)) };
}

async function metricsStep(handle) {
  const draft = drafts.get(handle);
  if (!draft || draft.phase !== 'reels') return { handle, status: 'bad_phase' };
  const rows = await tab.playwright.evaluate((h) => Array.from(document.querySelectorAll('main a[href*="/reel/"],main a[href*="/p/"]')).map((a) => {
    const href = a.getAttribute('href') || '';
    const values = Array.from(a.querySelectorAll('span')).map((span) => (span.textContent || '').trim()).filter(Boolean).filter((value, index, all) => index === 0 || value !== all[index - 1]);
    const caption = Array.from(a.querySelectorAll('img[alt]')).map((img) => img.getAttribute('alt') || '').filter((alt) => alt && alt !== '클립' && alt !== '릴스').sort((a, b) => b.length - a.length)[0] || '';
    return { href, values, caption };
  }).filter((row) => (row.href.includes(`/${h}/reel/`) || row.href.includes(`/${h}/p/`)) && row.values.length >= 1), handle);
  for (const row of rows) {
    if (row.caption && !draft.caps.some((card) => card.href === row.href)) draft.caps.push({ href: row.href, caption: row.caption });
    const old = draft.metrics.find((metric) => metric.href === row.href);
    if (!old) draft.metrics.push(row);
    else if (row.values.length > old.values.length) old.values = row.values;
  }
  if (draft.metrics.length < 31) {
    await scrollPage();
    return { handle, status: 'metrics_more', metrics: draft.metrics.length };
  }
  return buildPacket(handle);
}

function flush() {
  const existingChannels = readJsonl(channelsPath);
  const existingItems = readJsonl(itemsPath);
  const handles = new Set(existingChannels.filter((row) => row.platform === 'instagram').map((row) => row.handle));
  const ids = new Set(existingItems.map((row) => row.item_id));
  const channelRows = [];
  const itemRows = [];
  for (const packet of queue) {
    if (handles.has(packet.channelRow.handle)) continue;
    const fresh = packet.itemRows.filter((row) => !ids.has(row.item_id));
    if (fresh.length < 10) continue;
    channelRows.push(packet.channelRow);
    itemRows.push(...fresh);
    handles.add(packet.channelRow.handle);
    for (const row of fresh) ids.add(row.item_id);
  }
  if (itemRows.length) fs.appendFileSync(itemsPath, `${itemRows.map(JSON.stringify).join('\n')}\n`, 'utf8');
  if (channelRows.length) fs.appendFileSync(channelsPath, `${channelRows.map(JSON.stringify).join('\n')}\n`, 'utf8');
  queue.length = 0;
  return { channels: channelRows.length, items: itemRows.length };
}

export function installInstagramCollector(browserTab) {
  tab = browserTab;
  return { start, profileStep, metricsStep, flush, drafts, queue };
}
