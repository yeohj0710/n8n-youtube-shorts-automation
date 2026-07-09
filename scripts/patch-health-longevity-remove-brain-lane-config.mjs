import sqlite3 from 'sqlite3';

const dbPath = 'C:/dev/n8n-youtube-shorts-automation/.n8n/database.sqlite';
const workflowId = 'baekse100Life01';

const db = new sqlite3.Database(dbPath);

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve(this.changes);
    });
  });
}

try {
  const row = await get('select nodes from workflow_entity where id=?', [workflowId]);
  const nodes = JSON.parse(row.nodes);
  const loadNode = nodes.find((node) => node.name === 'Load Config');
  if (!loadNode) throw new Error('Load Config not found');
  const before = loadNode.parameters.jsCode;
  const after = before.replace(
    `    ['brain_memory_knowledge', /기억|뇌|퀴즈|상식|외래어|치매|대화/],\n`,
    '',
  );
  if (after === before) throw new Error('brain lane config anchor not found');
  loadNode.parameters.jsCode = after;
  const changes = await run(
    "UPDATE workflow_entity SET nodes=?, updatedAt=strftime('%Y-%m-%d %H:%M:%f','now'), versionCounter=versionCounter+1 WHERE id=?",
    [JSON.stringify(nodes), workflowId],
  );
  console.log(JSON.stringify({ ok: true, changes, changed: true }, null, 2));
} finally {
  db.close();
}
