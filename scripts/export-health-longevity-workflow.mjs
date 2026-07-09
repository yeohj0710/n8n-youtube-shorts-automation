import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const dbPath = path.join(root, '.n8n', 'database.sqlite');
const outPath = path.join(root, 'workflows', 'n8n_geongangjangsubigyeol_manual.json');
const workflowId = 'baekse100Life01';

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  return JSON.parse(value);
}

function readWorkflow() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
    db.get(
      'select name, nodes, connections, settings, staticData, pinData, versionId, triggerCount from workflow_entity where id=?',
      [workflowId],
      (error, row) => {
        db.close();
        if (error) reject(error);
        else if (!row) reject(new Error(`workflow not found: ${workflowId}`));
        else resolve(row);
      },
    );
  });
}

const row = await readWorkflow();
const workflow = {
  id: workflowId,
  name: row.name,
  nodes: parseJson(row.nodes, []),
  connections: parseJson(row.connections, {}),
  settings: parseJson(row.settings, {}),
  staticData: parseJson(row.staticData, null),
  pinData: parseJson(row.pinData, {}),
  versionId: row.versionId,
  triggerCount: row.triggerCount,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(workflow, null, 2) + '\n', 'utf8');

console.log(JSON.stringify({
  ok: true,
  workflow: workflow.name,
  nodes: workflow.nodes.length,
  output: outPath,
}, null, 2));
