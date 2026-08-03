import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8').split(/\r?\n/).filter(Boolean).map((line, index) => {
  try { return JSON.parse(line); }
  catch (error) { throw new Error(`${name}:${index + 1}: ${error.message}`); }
});

const channels = read('channels.jsonl');
const items = read('items.jsonl');
const errors = [];
const allowedHooks = new Set(['age_call_out', 'loss_frame', 'command', 'authority_flip', 'number_list', 'paren_preview', 'belief_reversal', 'threat', 'versus', 'identity_quiz', 'moment_trigger', 'insider_reveal']);
const allowedTopics = new Set(['cooking_recipe', 'food_ingredient', 'cleaning_home', 'health_signal', 'health_habit', 'disease_risk', 'money_policy', 'real_estate_tax', 'relationships_family', 'life_wisdom_psych', 'appliance_manual', 'hospital_pharmacy', 'clothing_appearance', 'phone_digital', 'car_transport', 'season_weather', 'travel_leisure', 'fortune_identity']);
const requiredChannel = ['platform', 'handle', 'url', 'name', 'subscribers', 'topic_axes', 'item_count', 'collected_at', 'blocked'];
const requiredItem = ['platform', 'channel_handle', 'item_id', 'url', 'title', 'views', 'likes', 'published_at', 'list_count', 'hook_patterns', 'topic_axis', 'collected_at'];
const key = (platform, handle) => `${platform}:${handle}`;
const channelKeys = new Set();
const itemIds = new Set();
const actualCounts = new Map();

for (const [index, row] of channels.entries()) {
  const at = `channels.jsonl:${index + 1}`;
  for (const field of requiredChannel) if (!(field in row)) errors.push(`${at}: missing ${field}`);
  if (!['youtube', 'instagram'].includes(row.platform)) errors.push(`${at}: invalid platform`);
  const id = key(row.platform, row.handle);
  if (channelKeys.has(id)) errors.push(`${at}: duplicate channel ${id}`);
  channelKeys.add(id);
  if (!Array.isArray(row.topic_axes) || row.topic_axes.length < 1 || row.topic_axes.length > 3 || row.topic_axes.some((x) => !allowedTopics.has(x))) errors.push(`${at}: invalid topic_axes`);
  if (!Number.isInteger(row.item_count) || row.item_count < 10 || row.item_count > 60) errors.push(`${at}: item_count outside 10..60`);
  if (row.subscribers !== null && (!Number.isInteger(row.subscribers) || row.subscribers < 0)) errors.push(`${at}: invalid subscribers`);
  if (row.collected_at !== '2026-07-25') errors.push(`${at}: invalid collected_at`);
  if (typeof row.blocked !== 'boolean') errors.push(`${at}: invalid blocked`);
}

for (const [index, row] of items.entries()) {
  const at = `items.jsonl:${index + 1}`;
  for (const field of requiredItem) if (!(field in row)) errors.push(`${at}: missing ${field}`);
  if (!['youtube', 'instagram'].includes(row.platform)) errors.push(`${at}: invalid platform`);
  if (itemIds.has(row.item_id)) errors.push(`${at}: duplicate item_id ${row.item_id}`);
  itemIds.add(row.item_id);
  const id = key(row.platform, row.channel_handle);
  if (!channelKeys.has(id)) errors.push(`${at}: missing channel ${id}`);
  actualCounts.set(id, (actualCounts.get(id) || 0) + 1);
  if (typeof row.title !== 'string' || !row.title.trim()) errors.push(`${at}: empty title`);
  if (row.title.includes('\uFFFD')) errors.push(`${at}: replacement character in title`);
  for (const field of ['views', 'likes', 'list_count']) if (row[field] !== null && (!Number.isInteger(row[field]) || row[field] < 0)) errors.push(`${at}: invalid ${field}`);
  if (row.views === null && row.likes === null) errors.push(`${at}: both views and likes are null`);
  if (!Array.isArray(row.hook_patterns) || row.hook_patterns.some((x) => !allowedHooks.has(x))) errors.push(`${at}: invalid hook_patterns`);
  if (!allowedTopics.has(row.topic_axis)) errors.push(`${at}: invalid topic_axis`);
  if (row.published_at !== null && !/^\d{4}-\d{2}-\d{2}$/.test(row.published_at)) errors.push(`${at}: invalid published_at`);
  if (row.collected_at !== '2026-07-25') errors.push(`${at}: invalid collected_at`);
  if (row.platform === 'youtube' && !/^https:\/\/www\.youtube\.com\/shorts\/[\w-]+$/.test(row.url)) errors.push(`${at}: invalid YouTube URL`);
  if (row.platform === 'instagram' && !/^https:\/\/www\.instagram\.com\/.+\/(?:reel|p)\/[\w-]+\/$/.test(row.url)) errors.push(`${at}: invalid Instagram URL`);
}

for (const [index, row] of channels.entries()) {
  const actual = actualCounts.get(key(row.platform, row.handle)) || 0;
  if (actual !== row.item_count) errors.push(`channels.jsonl:${index + 1}: item_count ${row.item_count} != ${actual}`);
}

const counts = {
  channels_youtube: channels.filter((x) => x.platform === 'youtube').length,
  channels_instagram: channels.filter((x) => x.platform === 'instagram').length,
  items_youtube: items.filter((x) => x.platform === 'youtube').length,
  items_instagram: items.filter((x) => x.platform === 'instagram').length,
  items_total: items.length,
  unique_ids: itemIds.size,
};

console.log(JSON.stringify({ ...counts, schema_ok: errors.length === 0, error_count: errors.length, errors: errors.slice(0, 100) }, null, 2));
process.exitCode = errors.length ? 1 : 0;
