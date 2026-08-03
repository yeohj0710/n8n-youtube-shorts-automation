import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const channelsPath = path.join(root, 'channels.jsonl');
const itemsPath = path.join(root, 'items.jsonl');
const collectedAt = '2026-07-25';
const targetChannels = 40;
const targetItems = 700;

const seedUrls = [
  'https://www.youtube.com/@BABARA-k2i/shorts',
  'https://www.youtube.com/@DreamLife99100/shorts',
  'https://www.youtube.com/@%EC%A7%80%ED%98%9C%E4%BA%BATV/shorts',
  'https://www.youtube.com/@%EA%B1%B4%EA%B0%95-d4i/shorts',
];

const queries = [
  '시니어 건강',
  '5060 건강',
  '중년 건강상식',
  '노후 준비',
  '실버 라이프',
  '살림 꿀팁',
  '생활 정보',
  '주부 꿀팁',
  '몸이 보내는 신호',
  '나이 들수록',
  '60대 건강',
  '은퇴 후',
  '연금 정보',
  '요리 꿀팁',
  '반찬 레시피',
  '식재료 보관법',
  '청소 꿀팁',
  '인생 조언',
  '삶의 지혜',
  '건강 수명',
  '낙상 예방',
  '혈압 혈당 관리',
  '무릎 관절',
  '치매 예방',
  '노년 건강',
  '부모님 건강',
  '시니어 생활정보',
  '60대 인생',
  '노후 생활비',
  '중년 살림',
];

const headers = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'accept-language': 'ko-KR,ko;q=0.9',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function appendJsonl(file, rows) {
  if (!rows.length) return;
  fs.appendFileSync(file, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
}

function extractInitialData(html) {
  for (const marker of ['var ytInitialData = ', 'ytInitialData = ']) {
    const start = html.indexOf(marker);
    if (start === -1) continue;
    const bodyStart = start + marker.length;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = bodyStart; index < html.length; index += 1) {
      const char = html[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (depth === 0) return JSON.parse(html.slice(bodyStart, index + 1));
      }
    }
  }
  return null;
}

function walk(node, visitor) {
  if (!node || typeof node !== 'object') return;
  visitor(node);
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visitor);
    return;
  }
  for (const child of Object.values(node)) walk(child, visitor);
}

function textOf(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value.simpleText === 'string') return value.simpleText;
  if (Array.isArray(value.runs)) return value.runs.map((run) => run.text || '').join('');
  if (typeof value.content === 'string') return value.content;
  return '';
}

function parseMetric(text) {
  const normalized = String(text).replace(/,/g, '').trim();
  const match = normalized.match(/([\d.]+)\s*([천만억]?)/);
  if (!match) return null;
  const value = Number(match[1]);
  const multiplier = { '': 1, 천: 1e3, 만: 1e4, 억: 1e8 }[match[2]] ?? 1;
  return Number.isFinite(value) ? Math.round(value * multiplier) : null;
}

function findVideoId(lockup) {
  let found = null;
  walk(lockup, (node) => {
    if (!found && typeof node.videoId === 'string' && /^[\w-]{6,20}$/.test(node.videoId)) {
      found = node.videoId;
    }
  });
  if (found) return found;
  const href = lockup.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url || '';
  return href.match(/\/shorts\/([\w-]+)/)?.[1] || null;
}

function extractShorts(data) {
  const out = [];
  walk(data, (node) => {
    const lockup = node.shortsLockupViewModel;
    if (!lockup) return;
    const itemId = findVideoId(lockup);
    const title =
      textOf(lockup.overlayMetadata?.primaryText) ||
      textOf(lockup.accessibilityText)?.replace(/\s+조회수\s+[\d.,]+[천만억]?\s*회.*$/, '');
    const viewsText = textOf(lockup.overlayMetadata?.secondaryText) || textOf(lockup.accessibilityText);
    const views = parseMetric(viewsText);
    if (itemId && title && views != null) {
      out.push({
        item_id: itemId,
        url: `https://www.youtube.com/shorts/${itemId}`,
        title: title.trim(),
        views,
      });
    }
  });
  const byId = new Map();
  for (const row of out) if (!byId.has(row.item_id)) byId.set(row.item_id, row);
  return [...byId.values()];
}

function canonicalChannelUrl(rawUrl) {
  if (!rawUrl) return null;
  const absolute = new URL(rawUrl, 'https://www.youtube.com');
  absolute.search = '';
  const pathname = absolute.pathname.replace(/\/(featured|videos|shorts|community|about)\/?$/, '');
  return `https://www.youtube.com${pathname}/shorts`;
}

function extractChannelCandidates(data) {
  const out = [];
  walk(data, (node) => {
    const channel = node.channelRenderer;
    if (channel) {
      const rawUrl =
        channel.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url ||
        channel.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl;
      const url = canonicalChannelUrl(rawUrl);
      if (url) {
        out.push({
          url,
          name: textOf(channel.title),
          subscribers: parseMetric(textOf(channel.subscriberCountText)),
        });
      }
    }
    const video = node.videoRenderer;
    const owner = video?.ownerText?.runs?.[0];
    if (owner) {
      const rawUrl =
        owner.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url ||
        owner.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl;
      const url = canonicalChannelUrl(rawUrl);
      if (url) out.push({ url, name: owner.text || '', subscribers: null });
    }
  });
  return out;
}

function extractChannelMeta(data, html, fallbackUrl, fallbackName, fallbackSubscribers) {
  let meta = null;
  const subscriberTexts = [];
  walk(data, (node) => {
    if (!meta && node.channelMetadataRenderer) meta = node.channelMetadataRenderer;
    for (const [key, value] of Object.entries(node)) {
      if (/subscriberCountText/i.test(key)) {
        const text = textOf(value);
        if (text) subscriberTexts.push(text);
      }
    }
  });
  const canonical =
    meta?.vanityChannelUrl ||
    html.match(/<link rel="canonical" href="([^"]+)"/)?.[1]?.replace(/&amp;/g, '&') ||
    fallbackUrl.replace(/\/shorts\/?$/, '');
  const handleFromCanonical = decodeURIComponent(new URL(canonical).pathname.split('/').filter(Boolean).at(-1) || '');
  const handle = handleFromCanonical.startsWith('@') ? handleFromCanonical : `@${handleFromCanonical}`;
  const name =
    meta?.title ||
    html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ||
    fallbackName ||
    handle;
  const subscribers =
    subscriberTexts.map(parseMetric).find((value) => value != null) ?? fallbackSubscribers ?? null;
  return {
    handle,
    url: canonicalChannelUrl(canonical),
    name,
    subscribers,
  };
}

function listCount(title) {
  const matches = [
    ...String(title).matchAll(/(?:TOP|top)\s*(\d{1,3})/g),
    ...String(title).matchAll(/(\d{1,3})\s*(?:가지|개명|계명|곳|종|단계|방법|비법|습관|원칙|법칙|특징|이유)/g),
  ];
  if (!matches.length) return null;
  const value = Number(matches[0][1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function hookPatterns(title) {
  const rules = [
    ['age_call_out', /(?:\b(?:50|60|70|80)\s*(?:대|세|넘)|나이\s*들|내\s*나이|중년|노년|시니어)/i],
    ['loss_frame', /(?:손해|후회|돈\s*버|억울|늦게\s*알|놓치면|아끼지\s*말)/],
    ['command', /(?:당장|절대|하지\s*마|버리세요|조심|멈추세요|꼭\s*(?:하|먹|알)|챙기세요|외우)/],
    ['authority_flip', /(?:의사.*(?:안|않|말)|고수.*(?:아는|알)|사장님.*알려|전문가.*알려|교수.*알려)/],
    ['number_list', /(?:TOP\s*\d+|\d+\s*(?:가지|개명|계명|곳|종|단계|방법|비법|습관|원칙|법칙|특징|이유))/i],
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

function topicAxis(title) {
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
  return rules.find(([, pattern]) => pattern.test(title))?.[0] || 'life_wisdom_psych';
}

function channelAxes(rows) {
  const counts = new Map();
  for (const row of rows) counts.set(row.topic_axis, (counts.get(row.topic_axis) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([axis]) => axis);
}

function isTargetChannel(rows) {
  if (rows.length < 10) return false;
  const targetPattern =
    /(?:50|60|70|80|나이|중년|노년|시니어|노후|은퇴|연금|건강|혈압|혈당|관절|치매|장수|살림|주부|생활|청소|요리|반찬|식재료|인생|지혜|부모|자식)/;
  const excludePattern = /(?:여드름|선크림|다이어트\s*보조제|벌크업|취업|아이돌|드라마|예능|뉴스|대통령|국회의원|정당)/;
  const targetHits = rows.filter((row) => targetPattern.test(row.title)).length;
  const excludedHits = rows.filter((row) => excludePattern.test(row.title)).length;
  return targetHits >= Math.max(4, Math.ceil(rows.length * 0.2)) && excludedHits <= Math.floor(rows.length * 0.2);
}

function selectRows(rows) {
  const ranked = rows.filter((row) => row.views != null && row.views > 0).sort((a, b) => b.views - a.views);
  const topCount = Math.ceil(ranked.length * 0.3);
  const selected = ranked.filter((row, index) => row.views >= 30000 || index < topCount);
  return selected.slice(0, 60);
}

async function fetchHtml(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function discoverCandidates() {
  const candidates = new Map(seedUrls.map((url) => [canonicalChannelUrl(url), { url }]));
  for (const query of queries) {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAg%3D%3D`;
    try {
      const html = await fetchHtml(url);
      const data = extractInitialData(html);
      for (const candidate of extractChannelCandidates(data)) {
        if (!candidates.has(candidate.url)) candidates.set(candidate.url, candidate);
      }
      process.stdout.write(`discover ${query}: ${candidates.size}\n`);
    } catch (error) {
      process.stdout.write(`discover ${query}: ${error.message}\n`);
    }
    await sleep(250);
  }
  return [...candidates.values()];
}

async function getPublishedAt(item) {
  try {
    const html = await fetchHtml(item.url);
    return (
      html.match(/"publishDate":"(\d{4}-\d{2}-\d{2})"/)?.[1] ||
      html.match(/"uploadDate":"(\d{4}-\d{2}-\d{2})"/)?.[1] ||
      null
    );
  } catch {
    return null;
  }
}

async function enrichDates(rows) {
  const output = new Array(rows.length);
  const concurrency = 8;
  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      const index = cursor;
      cursor += 1;
      output[index] = { ...rows[index], published_at: await getPublishedAt(rows[index]) };
      await sleep(80);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return output;
}

async function main() {
  const existingChannels = readJsonl(channelsPath);
  const existingItems = readJsonl(itemsPath);
  const channelKeys = new Set(
    existingChannels
      .filter((row) => row.platform === 'youtube')
      .flatMap((row) => [row.url, row.handle].filter(Boolean)),
  );
  const itemIds = new Set(existingItems.map((row) => row.item_id));
  let youtubeChannelCount = existingChannels.filter((row) => row.platform === 'youtube').length;
  let youtubeItemCount = existingItems.filter((row) => row.platform === 'youtube').length;
  const candidates = await discoverCandidates();
  process.stdout.write(`candidate_total ${candidates.length}\n`);

  for (const candidate of candidates) {
    if (youtubeChannelCount >= targetChannels && youtubeItemCount >= targetItems) break;
    if (channelKeys.has(candidate.url)) continue;
    try {
      const html = await fetchHtml(candidate.url);
      const data = extractInitialData(html);
      if (!data) throw new Error('ytInitialData missing');
      const allRows = extractShorts(data);
      const selected = selectRows(allRows);
      if (!isTargetChannel(selected)) {
        process.stdout.write(`skip ${candidate.url}: ${selected.length} selected, off target\n`);
        await sleep(150);
        continue;
      }
      if (selected.length < 10) {
        process.stdout.write(`skip ${candidate.url}: ${selected.length} selected\n`);
        await sleep(150);
        continue;
      }
      const meta = extractChannelMeta(
        data,
        html,
        candidate.url,
        candidate.name,
        candidate.subscribers,
      );
      if (channelKeys.has(meta.url) || channelKeys.has(meta.handle)) continue;
      const freshRows = selected.filter((row) => !itemIds.has(row.item_id));
      if (freshRows.length < 10) {
        process.stdout.write(`skip ${meta.handle}: ${freshRows.length} unique\n`);
        continue;
      }
      const datedRows = await enrichDates(freshRows);
      const itemRows = datedRows.map((row) => ({
        platform: 'youtube',
        channel_handle: meta.handle,
        item_id: row.item_id,
        url: row.url,
        title: row.title,
        views: row.views,
        likes: null,
        published_at: row.published_at,
        list_count: listCount(row.title),
        hook_patterns: hookPatterns(row.title),
        topic_axis: topicAxis(row.title),
        collected_at: collectedAt,
      }));
      const channelRow = {
        platform: 'youtube',
        handle: meta.handle,
        url: meta.url,
        name: meta.name,
        subscribers: meta.subscribers,
        topic_axes: channelAxes(itemRows),
        item_count: itemRows.length,
        collected_at: collectedAt,
        blocked: false,
      };
      appendJsonl(itemsPath, itemRows);
      appendJsonl(channelsPath, [channelRow]);
      for (const row of itemRows) itemIds.add(row.item_id);
      channelKeys.add(meta.url);
      channelKeys.add(meta.handle);
      youtubeChannelCount += 1;
      youtubeItemCount += itemRows.length;
      process.stdout.write(
        `add ${meta.handle}: ${itemRows.length} items; totals ${youtubeChannelCount}/${youtubeItemCount}\n`,
      );
    } catch (error) {
      process.stdout.write(`error ${candidate.url}: ${error.message}\n`);
    }
    await sleep(150);
  }
  process.stdout.write(`done youtube ${youtubeChannelCount} channels, ${youtubeItemCount} items\n`);
}

await main();
