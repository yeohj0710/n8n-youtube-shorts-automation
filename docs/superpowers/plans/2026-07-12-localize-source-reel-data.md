# Localize Source Reel Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make both source-reel n8n workflows runnable using only files inside `C:\dev\n8n-youtube-shorts-automation`.

**Architecture:** Preserve Google Drive as a backup and copy every source bundle into `data/source-reel-bundles`. Rewrite bundle manifests, pending MD files, and workflow loader roots to the local repository, then verify all exported paths and required artifacts without reading G Drive.

**Tech Stack:** Node.js, PowerShell/Robocopy, n8n workflow JSON, SQLite.

---

### Task 1: Copy source bundles without deleting originals

**Files:**
- Create: `data/source-reel-bundles/**`

- [ ] Run `robocopy` from the G Drive `10_작업` directory to `data/source-reel-bundles` with `/E /COPY:DAT /DCOPY:DAT /R:2 /W:2`.
- [ ] Confirm 29 directories, 493 files, and matching byte totals.

### Task 2: Rewrite runtime paths

**Files:**
- Create: `scripts/localize-source-reel-data.mjs`
- Modify: `하루건강약사 소재/*.md`
- Modify: `건강장수비결 소재/*.md`
- Modify: `data/source-reel-bundles/*/manifest.json`
- Modify: `scripts/build-source-reel-workflows.mjs`

- [ ] Replace each MD `SOURCE_BUNDLE=` value with its matching local bundle path.
- [ ] Set each local manifest `bundle_dir` and `exported_topic_md` to existing repo paths.
- [ ] Change the workflow recovery root to `C:/dev/n8n-youtube-shorts-automation/data/source-reel-bundles`.
- [ ] Rebuild and re-import both workflows with their existing IDs and credentials.

### Task 3: Verify repo-only operation

**Files:**
- Create: `scripts/verify-local-source-reel-data.mjs`

- [ ] Validate 29 local bundles and all required files: `source.mp4`, `source.json`, `caption.txt`, `transcript.json`, `evidence.json`, `content-brief.json`, `contact-sheet.jpg`, and eight keyframes.
- [ ] Validate 29 pending MD files contain local `SOURCE_BUNDLE` paths and no G Drive runtime paths.
- [ ] Validate both live workflows reference only the local bundle root while retaining the existing KIE and YouTube credential IDs.
- [ ] Run `node scripts/verify-local-source-reel-data.mjs` and expect `PASS` with 29 bundles and 29 MD files.
