# Legacy Workflow Runtime Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the two legacy workflows behaviorally identical except for credentials, channel identity/path values, and topic-selection data.

**Architecture:** Add one canonical synchronization script that copies shared node behavior and shared connections from an explicitly selected canonical workflow while retaining a small allowlist of channel-specific fields. Add a regression verifier that normalizes the allowed differences and fails when any other runtime difference appears. Continue using the existing editorial and quality-gate installers as canonical feature patchers.

**Tech Stack:** Node.js ESM, n8n workflow JSON, SQLite, `node:assert`, existing project QA runner.

---

### Task 1: Define and test the allowed difference contract

**Files:**
- Create: `scripts/verify-legacy-workflow-parity.mjs`
- Modify: `scripts/run-project-qa.mjs`

- [ ] Compare node names, types, runtime settings, connections, and shared Code-node source.
- [ ] Allow only credential IDs, channel identity/branding/path values, and the topic-selection sections in `Load Config` and `Build Viral Rank Pack Request`.
- [ ] Run `node .\scripts\verify-legacy-workflow-parity.mjs` and confirm it fails on current non-allowed differences such as `Prepare Image and BGM Payloads` and `Skip YouTube Upload`.

### Task 2: Add canonical shared-runtime synchronization

**Files:**
- Create: `scripts/sync-legacy-workflow-runtime.mjs`
- Modify: `scripts/simplify-legacy-editorial-flow.mjs`
- Modify: `workflows/n8n_geongangjangsubigyeol_manual.json`
- Modify: `workflows/n8n_하루건강약사_수동실행.json`
- Modify: `.n8n/database.sqlite`

- [ ] Back up both workflow JSON files and the database under `etc`.
- [ ] Preserve workflow IDs, node IDs, positions, credentials, channel paths/labels, and topic-selection code.
- [ ] Synchronize all other node parameters, retry settings, disabled states, and connection topology from one canonical runtime definition.
- [ ] Update both live DB workflow rows without creating workflows or changing credentials.

### Task 3: Verify runtime parity and safety

**Files:**
- Test: `scripts/verify-legacy-workflow-parity.mjs`
- Test: `scripts/verify-coherent-editorial-flow.mjs`
- Test: `scripts/verify-shared-content-quality-gate.mjs`
- Test: `scripts/verify-shared-content-quality-gate-behavior.mjs`

- [ ] Run the parity verifier and require zero non-allowed differences.
- [ ] Run all editorial and quality-gate verifiers.
- [ ] Run `npm test` and require 73/73 or the updated full count.
- [ ] Check `http://localhost:5678/rest/settings` returns HTTP 200.
- [ ] Do not execute either workflow, generate paid media, or upload to YouTube.
