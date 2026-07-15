import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const files = ['n8n_geongangjangsubigyeol_manual.json', 'n8n_하루건강약사_수동실행.json'];
const ids = new Set(['mxrYb3maJS31gEYC', 'baekse100Life01']);

function check(workflow) {
  const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
  const load = nodes.get('Load Config').parameters.jsCode;
  const build = nodes.get('Build Viral Rank Pack Request').parameters.jsCode;
  const condition = nodes.get('Use Live KIE Claude?').parameters.conditions.boolean[0].value1;
  assert.match(load, /LOCKED_SOURCE_PACK=1/);
  assert.match(load, /fs\.readFileSync\(entry\.filePath, 'utf8'\)/);
  assert.match(build, /const lockedSourcePack = null;/);
  assert.equal(condition, '={{$json.config.use_live_kie_ai}}');
}

for (const name of files) check(JSON.parse(fs.readFileSync(path.join(root, 'workflows', name), 'utf8')));
const db = new sqlite3.Database(path.join(root, '.n8n/database.sqlite'));
const rows = await new Promise((resolve, reject) => db.all(`SELECT id,nodes FROM workflow_entity WHERE id IN ('mxrYb3maJS31gEYC','baekse100Life01')`, (error, value) => error ? reject(error) : resolve(value)));
db.close();
assert.equal(rows.length, 2);
for (const row of rows) { assert.ok(ids.has(row.id)); check({ nodes: JSON.parse(row.nodes) }); }
console.log('PASS: legacy workflows ignore source-reel MD files and always use live self-generation');
