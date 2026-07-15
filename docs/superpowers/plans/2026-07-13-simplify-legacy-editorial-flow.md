# Simplify Legacy Editorial Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each legacy workflow produce one coherent AI-authored content pack and matching BGM without downstream editorial rewriting.

**Architecture:** Keep the existing triggers, credentials, KIE generation, image generation, rendering, upload, retry, and source-reel separation. Replace the overloaded editorial prompt with a compact channel brief, make quality review audit-only, and make the BGM payload use the original pack's mood direction instead of a deterministic instrument preset.

**Tech Stack:** n8n workflow JSON, Node.js patch/verification scripts, SQLite-backed local n8n.

---

### Task 1: Add regression checks

**Files:**
- Create: `C:/dev/n8n-youtube-shorts-automation/scripts/verify-coherent-editorial-flow.mjs`

- [ ] Assert both legacy workflows use a compact single-writer brief.
- [ ] Assert generated `pack` is preserved through quality review.
- [ ] Assert BGM uses `pack.bgm_prompt` without fixed marimba/vibraphone/key/tempo profiles.
- [ ] Run the verifier and confirm it fails against the current workflows.

### Task 2: Patch both legacy workflows

**Files:**
- Create: `C:/dev/n8n-youtube-shorts-automation/scripts/simplify-legacy-editorial-flow.mjs`
- Modify: `C:/dev/n8n-youtube-shorts-automation/workflows/n8n_geongangjangsubigyeol_manual.json`
- Modify: `C:/dev/n8n-youtube-shorts-automation/workflows/n8n_하루건강약사_수동실행.json`
- Modify: `C:/dev/n8n-youtube-shorts-automation/workflows/shared_content_quality_gate.json`
- Modify: `C:/dev/n8n-youtube-shorts-automation/scripts/install-shared-content-quality-gate.mjs`

- [ ] Reduce the generation request to channel identity, audience, topic evidence, coherence, factual safety, and output schema.
- [ ] Tell the generating AI to own title, subtitle, all rank items, descriptions, comments, visual mood, and BGM mood as one editorial package.
- [ ] Remove downstream quality-review rewriting; reject only clear factual or structural failures.
- [ ] Preserve the original pack byte-for-byte on review pass.
- [ ] Build BGM directly from the writer's `bgm_prompt` with only minimal technical requirements: instrumental, no vocals, short loop, warm clean mix.
- [ ] Patch canonical JSON and live n8n database without changing credentials or workflow IDs.

### Task 3: Verify without generation or upload

**Files:**
- Modify: `C:/dev/n8n-youtube-shorts-automation/scripts/run-project-qa.mjs`

- [ ] Add the new verifier to project QA.
- [ ] Run `node scripts/verify-coherent-editorial-flow.mjs` and expect PASS.
- [ ] Run `npm test` and expect zero failures.
- [ ] Verify both legacy workflow IDs, credential bindings, source-reel separation, and `http://localhost:5678/` response.
- [ ] Do not execute either workflow, create paid KIE tasks, or upload YouTube content.
