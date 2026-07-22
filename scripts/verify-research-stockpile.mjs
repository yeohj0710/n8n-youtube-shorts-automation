// Every stockpile file must survive the real pipeline: Load Config -> Build ->
// verbatim render -> deterministic quality gate -> image payload.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = 'C:/dev/n8n-youtube-shorts-automation';
const queueDir = path.join(root, 'research', 'queue');

const channels = {
  '하루건강약사': { file: 'workflows/n8n_하루건강약사_수동실행.json', profile: 'haru_health_literacy' },
  '건강장수비결': { file: 'workflows/n8n_geongangjangsubigyeol_manual.json', profile: 'longevity_daily_function' },
};

const shared = JSON.parse(fs.readFileSync(path.join(root, 'workflows/shared_content_quality_gate.json'), 'utf8'));
const gateCode = (name) => shared.nodes.find((n) => n.name === name).parameters.jsCode;

assert.ok(fs.existsSync(queueDir), 'research/queue is missing; run scripts/build-research-stockpile.mjs');

let checked = 0;
const perChannel = {};

for (const [channelDir, channel] of Object.entries(channels)) {
  const dir = path.join(queueDir, channelDir);
  assert.ok(fs.existsSync(dir), `${channelDir}: stockpile folder missing`);
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort();
  assert.ok(files.length >= 1, `${channelDir}: the stockpile is empty, so the next run has nothing to publish`);
  perChannel[channelDir] = files.length;

  const workflow = JSON.parse(fs.readFileSync(path.join(root, channel.file), 'utf8'));
  const code = (name) => workflow.nodes.find((n) => n.name === name).parameters.jsCode;

  const seenTitles = new Set();
  for (const file of files) {
    const label = `${channelDir}/${file}`;
    const spec = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));

    assert.ok(spec.final_pack, `${label}: final_pack missing, so it would fall back to generation`);
    assert.equal(spec.final_pack.channel_editorial_profile, channel.profile, `${label}: belongs to the other channel`);
    assert.ok(!seenTitles.has(spec.final_pack.hook_title), `${label}: duplicate hook_title in the stockpile`);
    seenTitles.add(spec.final_pack.hook_title);

    // Evidence is optional: these are everyday shorts, not clinical education.
    // Requiring a citation per item pulls every topic toward clinic-handout
    // material. When a pack does carry evidence, the citations must be real.
    if (spec.research_source_pack) {
      assert.equal(spec.research_source_pack.channel_profile, channel.profile, `${label}: research pack belongs to the other channel`);
      const factIds = new Set(spec.research_source_pack.candidate_facts.map((f) => f.fact_id));
      const sourceIds = new Set(spec.research_source_pack.sources.map((s) => s.source_id));
      for (const item of spec.final_pack.rank_items) {
        assert.ok(factIds.has(item.fact_id), `${label}: rank ${item.rank} cites unknown fact ${item.fact_id}`);
        assert.ok(item.source_ids.length, `${label}: rank ${item.rank} cites no source`);
        for (const sid of item.source_ids) {
          assert.ok(sourceIds.has(sid), `${label}: rank ${item.rank} cites unknown source ${sid}`);
        }
      }
      for (const source of spec.research_source_pack.sources) {
        assert.match(source.url, /^https:\/\//, `${label}: source ${source.source_id} has no usable url`);
      }
    } else {
      // An ungrounded pack must not leave dangling citations behind.
      for (const item of spec.final_pack.rank_items) {
        assert.ok(!item.fact_id, `${label}: rank ${item.rank} cites a fact but the file carries no research pack`);
        assert.ok(!item.source_ids?.length, `${label}: rank ${item.rank} cites a source but the file carries no research pack`);
      }
    }

    // Drive the real nodes with this file sitting in a drop folder.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stockpile-'));
    const pending = path.join(tmp, 'pending');
    fs.mkdirSync(pending, { recursive: true });
    fs.copyFileSync(path.join(dir, file), path.join(pending, file));

    const loaded = new Function('require', '$input', code('Load Config'))(require, {
      first: () => ({ json: {
        dry_run: false,
        topic_pending_dir: pending,
        topic_used_dir: path.join(tmp, 'used'),
        topic_queue_path: path.join(tmp, 'queue.txt'),
        topic_queue_used_log_path: path.join(tmp, 'used.jsonl'),
        upload_log_path: path.join(tmp, 'upload.jsonl'),
      } }),
    })[0].json;

    const built = new Function('$', '$input', code('Build Viral Rank Pack Request'))(
      () => ({ first: () => ({ json: loaded }) }),
      { all: () => [] },
    )[0].json;

    assert.ok(built.prepared_card_pack, `${label}: prepared pack was not picked up from the drop folder`);
    assert.equal(built.config.use_live_kie_ai, false, `${label}: text generation was not switched off`);

    const rendered = new Function('$input', code('Mock Viral Rank Pack'))({ first: () => ({ json: built }) })[0].json;
    assert.equal(rendered.ai_source, 'prepared_card_pack', `${label}: not rendered verbatim`);
    assert.equal(rendered.pack.hook_title, spec.final_pack.hook_title, `${label}: title changed during render`);
    assert.deepEqual(
      rendered.pack.rank_items.map((i) => [i.card_name, i.card_reason]),
      spec.final_pack.rank_items.map((i) => [i.card_name, i.card_reason]),
      `${label}: visible copy changed during render`,
    );

    const gate = new Function('$input', gateCode('Deterministic Quality Review'))({ first: () => ({ json: rendered }) })[0].json;
    assert.equal(
      gate.content_quality_review.pass,
      true,
      `${label}: quality gate rejected this prepared pack: ${JSON.stringify(gate.content_quality_review.issues)}`,
    );

    const gateBuild = new Function('$input', gateCode('Build Quality Review Request'))({ first: () => ({ json: rendered }) })[0].json;
    // Offline this exercises only the request build; live runs send it to the
    // AI reviewer, which now judges prepared packs for usefulness too.
    assert.equal(gateBuild.use_ai_quality_review, true, `${label}: prepared pack must be judged by the AI reviewer`);
    assert.ok(gateBuild.kie_quality_review_request?.messages?.length, `${label}: reviewer request was not built for the prepared pack`);

    const payload = new Function('require', '$input', code('Prepare Image and BGM Payloads'))(require, {
      first: () => ({ json: { ...rendered, config: { ...rendered.config, variation_seed: file, kie_bgm_model: 'V5_5', kie_image_model: 'gpt-image-2-text-to-image' } } }),
    })[0].json;
    for (const item of spec.final_pack.rank_items) {
      assert.ok(payload.visible_card_text.includes(item.card_name), `${label}: rank ${item.rank} card_name missing from the image text`);
      assert.ok(payload.visible_card_text.includes(item.card_reason), `${label}: rank ${item.rank} card_reason missing from the image text`);
    }
    assert.ok(payload.bgm_payload.prompt.length <= 480, `${label}: BGM prompt exceeds the KIE limit`);

    fs.rmSync(tmp, { recursive: true, force: true });
    checked += 1;
  }
}

console.log(`PASS: ${checked} prepared topics render verbatim and clear the quality gate ${JSON.stringify(perChannel)}`);
