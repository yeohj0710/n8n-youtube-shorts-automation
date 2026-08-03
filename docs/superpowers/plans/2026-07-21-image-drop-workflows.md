# Image Drop Shorts Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one inactive n8n workflow per existing YouTube channel that randomly claims a finished local image, understands it with a vision model, writes the YouTube copy, renders a five-second Short with BGM, uploads it, comments, and archives the image.

**Architecture:** Each channel gets its own drop folder and workflow, but both workflow JSON files are generated from one deterministic builder so shared behavior cannot drift. The workflow streams the local image to KIE temporary storage, sends the temporary URL to KIE GPT-5.2 vision, normalizes the response into the existing `pack` contract, then reuses the current BGM, local ffmpeg, YouTube upload, overlap guard, and comment nodes from the matching canonical channel workflow. Claimed images move into `처리중`; successful images move into `사용완료`, and stale claims return to the input folder after six hours.

**Tech Stack:** n8n 2.26.8 workflow JSON, Node.js ESM, KIE File Upload API, KIE GPT-5.2 multimodal chat, KIE BGM API, Sharp, ffmpeg, YouTube Data API.

---

### Task 1: Add deterministic workflow generation

**Files:**
- Create: `scripts/build-image-drop-workflows.mjs`
- Create: `workflows/n8n_image_drop_haru_manual.json`
- Create: `workflows/n8n_image_drop_longevity_manual.json`

- [ ] **Step 1: Write a generator that reads the current canonical channel JSON files**

The generator must locate source workflows by ID (`mxrYb3maJS31gEYC` and `baekse100Life01`), clone the proven BGM/render/upload nodes by name, preserve each channel's YouTube credential, and assign deterministic node IDs.

- [ ] **Step 2: Define the image input nodes**

Create this node sequence for both channels:

```text
Manual Trigger
  -> Claim Next Image
  -> Read Claimed Image
  -> Upload Image for Vision
  -> Build Vision Copy Request
  -> Analyze Image with GPT-5.2
  -> Parse Vision Copy
```

`Claim Next Image` must accept PNG, JPEG, and WebP, claim one random file with an atomic rename, reject empty or oversized files, create the required folders, and use a workflow lock to prevent concurrent claims.

- [ ] **Step 3: Connect the proven downstream nodes**

Connect `Parse Vision Copy` to the cloned BGM branch, then render, upload, top-level comment, and `Complete Image Drop`. Use `좋아요와 구독 한 번씩 부탁드립니다.` as the exact top-level comment.

- [ ] **Step 4: Generate both workflow files**

Run:

```powershell
node .\scripts\build-image-drop-workflows.mjs
```

Expected: two workflow JSON files, each inactive and carrying the correct channel-specific YouTube credential.

### Task 2: Add workflow verification

**Files:**
- Create: `scripts/verify-image-drop-workflows.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add structural assertions**

Assert unique workflow and node IDs, no image-generation nodes, no `process.env` in Code nodes, required KIE credentials, correct YouTube credentials, public privacy, exact comment text, local image path propagation, and complete connections.

- [ ] **Step 2: Add behavior checks for vision parsing**

Execute each `Parse Vision Copy` Code node with a mocked GPT response:

```js
const response = {
  choices: [{
    message: {
      content: JSON.stringify({
        image_summary: '식사 순서 안내 카드',
        visible_text: ['채소부터 드세요'],
        youtube_title: '식사 순서만 바꿔도 편해지는 습관',
        description: '이미지의 식사 순서를 차근차근 확인해 보세요.',
        tags: ['건강정보', '식사습관'],
        confidence: 'high',
      }),
    },
  }],
};
```

Assert the result contains a non-empty `pack.hook_title`, `pack.description`, normalized tags, the exact comment, `image_url` equal to the claimed local path, and a BGM prompt shorter than 500 characters.

- [ ] **Step 3: Expose verification through npm**

Add `build:image-drop` and `verify:image-drop` scripts without changing the existing `test` command.

- [ ] **Step 4: Run focused verification**

Run:

```powershell
npm run build:image-drop
npm run verify:image-drop
```

Expected: all image-drop workflow checks pass.

### Task 3: Add user-facing image folders

**Files:**
- Create: `하루건강약사 이미지/README.txt`
- Create: `하루건강약사 이미지/처리중/.gitkeep`
- Create: `하루건강약사 이미지/사용완료/.gitkeep`
- Create: `하루건강약사 이미지/기록/.gitkeep`
- Create: `건강장수비결 이미지/README.txt`
- Create: `건강장수비결 이미지/처리중/.gitkeep`
- Create: `건강장수비결 이미지/사용완료/.gitkeep`
- Create: `건강장수비결 이미지/기록/.gitkeep`
- Modify: `.gitignore`

- [ ] **Step 1: Create the folder contract**

Explain that the user places finished PNG, JPG, JPEG, or WebP files directly in the channel folder. Explain random selection, temporary claiming, automatic archive, stale-claim recovery, and public upload behavior.

- [ ] **Step 2: Ignore runtime images and logs**

Ignore user images and generated log files while keeping each `README.txt` and `.gitkeep` tracked.

### Task 4: Update project instructions

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document both new workflows and paths**

Add exact folder paths, exact workflow names, processing behavior, vision model behavior, and the fact that importing a workflow does not execute or publish it.

- [ ] **Step 2: Document normal use**

```text
1. Put one or more finished images in the matching channel image folder.
2. Open the matching “완성 이미지 기반 쇼츠” workflow in local n8n.
3. Click Execute Workflow once to process one random image.
```

### Task 5: Verify and import inactive workflows

**Files:**
- Verify: `workflows/n8n_image_drop_haru_manual.json`
- Verify: `workflows/n8n_image_drop_longevity_manual.json`

- [ ] **Step 1: Run project QA**

Run:

```powershell
npm test
node --check .\scripts\build-image-drop-workflows.mjs
node --check .\scripts\verify-image-drop-workflows.mjs
```

Expected: all existing and new checks pass.

- [ ] **Step 2: Import only the two new workflow files**

Run:

```powershell
.\scripts\import-workflow.ps1 -Workflow .\workflows\n8n_image_drop_haru_manual.json
.\scripts\import-workflow.ps1 -Workflow .\workflows\n8n_image_drop_longevity_manual.json
```

Expected: both workflows are added to the local DB as inactive; no workflow runs.

- [ ] **Step 3: Verify DB state and cleanliness**

Read `workflow_entity` from `.n8n/database.sqlite` and confirm the two IDs, names, node counts, and `active = 0`. Run `git status --short`, inspect the final diff, and confirm no image files, credentials, DB files, renders, or logs are tracked.
