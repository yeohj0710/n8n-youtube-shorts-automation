import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const require = createRequire(import.meta.url);
const workflow = JSON.parse(fs.readFileSync(path.join(root, 'workflows/n8n_geongangjangsubigyeol_manual.json'), 'utf8'));
const loadCode = workflow.nodes.find((node) => node.name === 'Load Config').parameters.jsCode;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-source-separation-'));
try {
  fs.writeFileSync(path.join(temp, 'source.md'), 'title: source reel\nnotes:\nLOCKED_SOURCE_PACK=1\n', 'utf8');
  fs.writeFileSync(path.join(temp, 'normal.md'), 'title: normal legacy topic\nsubtitle: normal\nranks:\n1. item | reason\n', 'utf8');
  const load = new Function('$input', 'require', loadCode);
  const output = load({ first: () => ({ json: {
    dry_run: true,
    topic_pending_dir: temp,
    topic_queue_path: path.join(temp, 'queue.txt'),
    topic_used_dir: path.join(temp, 'used'),
    topic_queue_used_log_path: path.join(temp, 'used.jsonl'),
    upload_log_path: path.join(temp, 'upload.jsonl'),
  } }) }, require)[0].json;
  assert.equal(output.config.topic_queue.selected.title, 'normal legacy topic');
  assert.doesNotMatch(output.config.topic_queue.selected.notes || '', /LOCKED_SOURCE_PACK=1/);
  console.log('PASS: legacy topic loader skips source-reel MD and selects normal topic');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
