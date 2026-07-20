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
  const payloadNode = nodes.find((node) => node.name === 'Prepare Image and BGM Payloads');
  if (!payloadNode) throw new Error('Prepare Image and BGM Payloads not found');

  const before = payloadNode.parameters.jsCode;
  let after = before.replace(
    `const bgmStructureInstruction = 'Create a complete 12-18 second background music bed, not a two-note sound effect or notification stinger. Use a clear 4-bar chord progression, gentle repeating melody, soft rhythm, smooth intro and outro, enough motion to feel like real BGM under a Shorts video.';`,
    `const bgmStructureInstruction = 'Complete 12-18 sec instrumental BGM bed, not a two-note stinger. Gentle melody, soft rhythm, smooth loop, warm Korean senior lifestyle mood. No vocals.';`,
  );
  after = after.replace(
    `const packBgmHint = limitPrompt(pack.bgm_prompt, 150);`,
    `const packBgmHint = limitPrompt(pack.bgm_prompt, 80);`,
  );
  after = after.replace(
    `].filter(Boolean).join(' '), 700);`,
    `].filter(Boolean).join(' '), 460);`,
  );

  if (after === before) throw new Error('BGM prompt patch made no changes');
  payloadNode.parameters.jsCode = after;

  const changes = await run(
    "UPDATE workflow_entity SET nodes=?, updatedAt=strftime('%Y-%m-%d %H:%M:%f','now'), versionCounter=versionCounter+1 WHERE id=?",
    [JSON.stringify(nodes), workflowId],
  );

  console.log(JSON.stringify({ ok: true, changes, changed: true }, null, 2));
} finally {
  db.close();
}
