# Source Reel Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two new n8n workflows that consume validated source-reel bundles directly, generate a grounded single-card visual, render a short, and optionally upload it without using the legacy RSS/topic-generation circuit.

**Architecture:** Keep the two 72-node legacy workflows unchanged. A shared local runner owns queue selection, bundle validation, representative-frame loading, render preparation, state transitions, and failure recovery; two small channel-specific n8n workflows call that runner and reuse the existing image/BGM/upload credentials only at the provider boundaries.

**Tech Stack:** n8n workflow JSON, Node.js 24, SQLite, FFmpeg, KIE image/BGM APIs, YouTube n8n credential.

---

### Task 1: Define the source-reel job contract

**Files:**
- Create: `schemas/source-reel-job.schema.json`
- Create: `scripts/verify-source-reel-job-contract.mjs`

- [ ] **Step 1: Write the failing contract test**

```js
assert.equal(job.schema_version, '1.0');
assert.ok(['haru_pharmacist', 'health_longevity'].includes(job.channel_id));
assert.equal(job.bundle_status, 'md_ready');
assert.ok(fs.existsSync(job.content_brief_path));
assert.ok(fs.existsSync(job.representative_frame_path));
assert.ok(job.rank_items.length >= 3 && job.rank_items.length <= 4);
for (const item of job.rank_items) assert.ok(item.evidence_ids.length > 0);
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node scripts/verify-source-reel-job-contract.mjs`

Expected: FAIL because the schema and loader do not exist.

- [ ] **Step 3: Add the JSON Schema**

The schema requires `source_id`, `channel_id`, `bundle_dir`, `title`, `subtitle`, `core_message`, three or four `rank_items`, `representative_frame_path`, `source_url`, and `output_dir`. Each rank item requires `rank`, `name`, `reason`, and at least one `evidence_id` matching `^[ct][0-9]{4}$`.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node scripts/verify-source-reel-job-contract.mjs`

Expected: `PASS: source reel job contract`

### Task 2: Add atomic queue claiming and recovery

**Files:**
- Create: `scripts/source-reel-runner.mjs`
- Create: `scripts/verify-source-reel-queue.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing queue tests**

```js
const first = claimNext('haru_pharmacist');
assert.equal(first.status, 'render_claimed');
assert.equal(claimNext('haru_pharmacist').source_id === first.source_id, false);
recover(first.source_id);
assert.equal(readManifest(first.bundle_dir).status, 'md_ready');
```

- [ ] **Step 2: Implement commands**

```text
node scripts/source-reel-runner.mjs claim --channel=haru_pharmacist
node scripts/source-reel-runner.mjs complete --source-id=SOURCE_ID --output=ABSOLUTE_MP4
node scripts/source-reel-runner.mjs fail --source-id=SOURCE_ID --error=TEXT
node scripts/source-reel-runner.mjs recover --source-id=SOURCE_ID
node scripts/source-reel-runner.mjs status
```

`claim` validates `manifest.json`, `content-brief.json`, `evidence.json`, and the representative frame before atomically changing `md_ready` to `render_claimed`. `complete` changes it to `rendered`; `fail` records `render_failed` without consuming another bundle.

- [ ] **Step 3: Add package scripts**

```json
"reel:status": "node ./scripts/source-reel-runner.mjs status",
"reel:recover": "node ./scripts/source-reel-runner.mjs recover"
```

- [ ] **Step 4: Run tests**

Run: `node scripts/verify-source-reel-queue.mjs`

Expected: `PASS: source reel queue claim, complete, fail, and recover`

### Task 3: Build a grounded source-card renderer

**Files:**
- Create: `scripts/render-source-reel-card.mjs`
- Create: `scripts/verify-source-reel-render.mjs`

- [ ] **Step 1: Write a failing render test**

```js
const result = renderFixture();
assert.equal(result.width, 1080);
assert.equal(result.height, 1920);
assert.ok(result.duration_seconds >= 7);
assert.ok(result.used_source_ids.length === 1);
assert.ok(result.output_path.endsWith('.mp4'));
```

- [ ] **Step 2: Implement the renderer interface**

```text
node scripts/render-source-reel-card.mjs BASE64_JSON_PAYLOAD
```

The payload contains the generated vertical card image, optional BGM, channel ID, title, source ID, and output directory. FFmpeg renders 1080x1920 H.264/AAC, 7 seconds, with a subtle scale motion. It never inserts the original reel video into the output.

- [ ] **Step 3: Run the render test**

Run: `node scripts/verify-source-reel-render.mjs`

Expected: `PASS: grounded source reel card renders to playable MP4`

### Task 4: Create two separate n8n workflows

**Files:**
- Create: `workflows/n8n_source_reel_haru_manual.json`
- Create: `workflows/n8n_source_reel_longevity_manual.json`
- Create: `scripts/build-source-reel-workflows.mjs`
- Create: `scripts/verify-source-reel-workflows.mjs`

- [ ] **Step 1: Write failing workflow structure tests**

```js
for (const workflow of workflows) {
  assert.deepEqual(requiredNodes.filter((name) => !names.has(name)), []);
  assert.equal(names.has('Fetch Health RSS'), false);
  assert.equal(names.has('Build Viral Rank Pack Request'), false);
  assert.equal(names.has('KIE Claude Generate Pack'), false);
}
```

- [ ] **Step 2: Generate each workflow with these nodes**

```text
Manual Trigger
Load Channel Config
Claim Source Bundle
Parse Claimed Job
Read Representative Frame
Prepare Grounded Image Prompt
KIE Create Source Card
Wait / Poll Image
Image Ready?
Download Generated Card
Prepare Source Reel Render
Local FFmpeg Render
Parse Render Result
Read Rendered MP4
Dry Run?
YouTube Upload
Mark Bundle Complete
Final Result
Mark Bundle Failed
```

The image prompt must copy the exact title and rank-item wording from `content-brief.json`, use the representative frame only for visual context, prohibit invented numbers and medical claims, and request legible Korean typography. Manual runs default to `dry_run=true` and `allow_youtube_upload=false`; upload requires explicit input.

- [ ] **Step 3: Verify workflow structure**

Run: `node scripts/verify-source-reel-workflows.mjs`

Expected: `PASS: two isolated source reel workflows contain no legacy topic-generation nodes`

### Task 5: Import safely and run one dry-run pilot per channel

**Files:**
- Modify: `scripts/import-workflow.ps1`
- Create: `scripts/verify-source-reel-live-install.mjs`
- Modify: `README.md`

- [ ] **Step 1: Back up the n8n database**

```powershell
Copy-Item .n8n ".n8n\backup-before-source-reel-workflows-$(Get-Date -Format yyyyMMddTHHmmss)" -Recurse
```

- [ ] **Step 2: Import under new names**

```text
하루건강약사 - 원본 릴스 기반 쇼츠
건강장수비결 - 원본 릴스 기반 쇼츠
```

- [ ] **Step 3: Run one dry-run per channel**

Use `dry_run=true` and `allow_youtube_upload=false`. Confirm one MP4 per channel, exact MD wording, correct source ID, and no YouTube upload.

- [ ] **Step 4: Verify live installation**

Run: `node scripts/verify-source-reel-live-install.mjs`

Expected: `PASS: source reel workflows installed, dry-run renders valid, uploads disabled`

- [ ] **Step 5: Document operating order**

```text
Open only a workflow whose queue count is greater than zero.
Run dry-run once and inspect the MP4.
Set allow_youtube_upload=true only after approval.
Never run the two source-reel workflows concurrently.
Use reel:recover after an interrupted execution.
```
