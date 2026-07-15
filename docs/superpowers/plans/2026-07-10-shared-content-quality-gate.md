# Shared Content Quality Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every generated content pack through one reusable fact-and-explanation quality gate before medical review, image generation, rendering, or upload.

**Architecture:** Add a dedicated n8n sub-workflow, `Shared Content Quality Gate`, with a pass-through trigger, deterministic preflight checks, an independent Claude review/repair call, and a fail-closed parser. Parent content workflows call it through `Execute Sub-workflow`; only `content_quality_review.pass === true` may continue. Channel-specific prompts remain producers, while the shared gate owns factual-confidence and explanation-quality policy.

**Tech Stack:** n8n 2.26.8 workflow JSON, Code nodes, HTTP Request node, Execute Sub-workflow node, SQLite workflow store, Node.js verification scripts.

---

### Task 1: Structural regression test

**Files:**
- Create: `scripts/verify-shared-content-quality-gate.mjs`
- Test: `workflows/shared_content_quality_gate.json`
- Test: `workflows/n8n_geongangjangsubigyeol_manual.json`
- Test: `workflows/n8n_하루건강약사_수동실행.json`

- [ ] **Step 1: Write failing assertions**

```js
assert.equal(shared.id, 'sharedContentQualityGate01');
assert.ok(shared.nodes.some((node) => node.type === 'n8n-nodes-base.executeWorkflowTrigger'));
assert.ok(shared.nodes.some((node) => node.name === 'KIE Claude Independent Quality Review'));
assert.ok(shared.nodes.some((node) => node.name === 'Parse and Enforce Quality Review'));
assert.equal(parent.connections['Parse KIE Claude Pack'].main[0][0].node, 'Shared Content Quality Gate');
assert.equal(parent.connections['Mock Viral Rank Pack'].main[0][0].node, 'Shared Content Quality Gate');
assert.equal(parent.connections['Content Quality Passed?'].main[0][0].node, 'Medical Safety Review');
assert.equal(parent.connections['Content Quality Passed?'].main[1][0].node, 'Prepare Blocked Result');
```

- [ ] **Step 2: Run test and confirm missing shared workflow failure**

Run: `node scripts/verify-shared-content-quality-gate.mjs`

Expected: FAIL because `workflows/shared_content_quality_gate.json` does not exist.

### Task 2: Shared quality-gate workflow

**Files:**
- Create: `workflows/shared_content_quality_gate.json`
- Create: `scripts/install-shared-content-quality-gate.mjs`

- [ ] **Step 1: Add pass-through trigger and deterministic preflight**

```js
const reasons = (data.pack?.rank_items || []).map((item) => String(item.reason || '').trim());
const issues = reasons.flatMap((reason, index) => {
  const found = [];
  if (reason.length < 16 || reason.length > 42) found.push({ rank: index + 1, code: 'reason_length' });
  if (/(점검|확인|도움|부담|충분|기본|균형|관리|변화|문제|위험)$/.test(reason)) found.push({ rank: index + 1, code: 'vague_fragment' });
  if (/\d{1,3}%/.test(reason)) found.push({ rank: index + 1, code: 'unsupported_percentage' });
  return found;
});
```

- [ ] **Step 2: Build independent review request**

```js
const request = {
  model: data.config?.kie_ai_model || 'claude-opus-4-7',
  max_tokens: 3200,
  messages: [{
    role: 'user',
    content: 'Act as a skeptical fact and explanation editor. Return strict JSON. Keep only claims with high factual confidence; rewrite each reason as a concrete cause-to-effect sentence; reject uncertain items; never invent sources or numbers. Input: ' + JSON.stringify(data.pack),
  }],
};
```

- [ ] **Step 3: Add fail-closed review parser**

```js
if (!review.pass || review.audit?.some((item) => item.confidence === 'low')) {
  return [{ json: { ...base, content_quality_review: { pass: false, issues: review.issues || [] }, blocked: true } }];
}
return [{ json: { ...base, pack: review.corrected_pack, content_quality_review: { ...review, pass: true }, blocked: false } }];
```

- [ ] **Step 4: Connect graph**

```text
When Executed by Another Workflow
  → Build Quality Review Request
  → Use AI Quality Review?
      true  → KIE Claude Independent Quality Review → Parse and Enforce Quality Review
      false → Deterministic Quality Review
```

### Task 3: Parent workflow integration

**Files:**
- Modify: `workflows/n8n_geongangjangsubigyeol_manual.json`
- Modify: `workflows/n8n_하루건강약사_수동실행.json`
- Modify: `scripts/install-shared-content-quality-gate.mjs`

- [ ] **Step 1: Add shared call node**

```json
{
  "parameters": {
    "source": "database",
    "workflowId": "sharedContentQualityGate01",
    "mode": "once",
    "options": { "waitForSubWorkflow": true }
  },
  "name": "Shared Content Quality Gate",
  "type": "n8n-nodes-base.executeWorkflow",
  "typeVersion": 1.1
}
```

- [ ] **Step 2: Add pass/fail router**

```json
{
  "parameters": {
    "conditions": {
      "boolean": [{ "value1": "={{$json.content_quality_review.pass}}", "value2": true }]
    }
  },
  "name": "Content Quality Passed?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 1
}
```

- [ ] **Step 3: Rewire both live and mock generation paths**

```text
Parse KIE Claude Pack ─┐
                      ├→ Shared Content Quality Gate → Content Quality Passed?
Mock Viral Rank Pack ─┘                                  ├ true  → Medical Safety Review
                                                        └ false → Prepare Blocked Result
```

### Task 4: Live installation and verification

**Files:**
- Modify: `.n8n/database.sqlite` through `scripts/install-shared-content-quality-gate.mjs`
- Test: `scripts/verify-shared-content-quality-gate.mjs`

- [ ] **Step 1: Back up SQLite with `VACUUM INTO`**

- [ ] **Step 2: Insert shared workflow and update both parent workflows in one transaction**

- [ ] **Step 3: Run structural verification**

Run: `node scripts/verify-shared-content-quality-gate.mjs`

Expected: `PASS: shared quality gate installed and wired into 2 parent workflows`.

- [ ] **Step 4: Run behavior simulation**

Run: `node work/simulate-shared-quality-gate.mjs`

Expected:

```text
vague reason → pass=false
unsupported percentage → pass=false
clear cause/effect reason → pass=true
low-confidence reviewer item → pass=false
```

- [ ] **Step 5: Verify n8n service**

Run: `Invoke-WebRequest http://localhost:5678/ -UseBasicParsing`

Expected: HTTP 200.

### Task 5: Optional commit

**Files:** all files above

- [ ] **Step 1: Commit only when requested**

```bash
git add docs/superpowers/plans/2026-07-10-shared-content-quality-gate.md workflows scripts
git commit -m "feat: add shared content quality gate"
```
