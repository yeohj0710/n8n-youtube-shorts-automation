import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import sqlite3 from 'sqlite3';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const dbPath = `${root}/.n8n/database.sqlite`;
const testId = `sharedQualityGateSmoke${Date.now()}`;
const projectId = 'aEvRqZD8wENZ1iRJ';
const sharedId = 'sharedContentQualityGate01';

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function done(error) {
    if (error) reject(error);
    else resolve(this.changes);
  }));
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}

const nodes = [
  {
    parameters: {},
    id: randomUUID(),
    name: 'Manual Trigger',
    type: 'n8n-nodes-base.manualTrigger',
    typeVersion: 1,
    position: [0, 0],
  },
  {
    parameters: {
      jsCode: `return [{ json: {
  config: { dry_run: true, test_mode: true },
  pack: {
    hook_title: '공통 검수 런타임 테스트',
    rank_items: [
      { rank: 1, name: '라이터', reason: '고온이 용기 내부 압력을 높여 파열 위험을 키웁니다' },
      { rank: 2, name: '보조배터리', reason: '열이 배터리 반응을 촉진해 팽창과 손상을 부릅니다' },
      { rank: 3, name: '초콜릿', reason: '녹은 지방이 시트에 스며들어 얼룩과 냄새가 남습니다' }
    ],
    video_script: '검증용 스크립트',
    description: '검증용 설명'
  }
} }];`,
    },
    id: randomUUID(),
    name: 'Create Test Pack',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [240, 0],
  },
  {
    parameters: {
      source: 'database',
      workflowId: { __rl: true, value: sharedId, mode: 'list', cachedResultName: 'Shared Content Quality Gate' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {},
        matchingColumns: [],
        schema: [],
        attemptToConvertTypes: false,
        convertFieldsToString: true,
      },
      mode: 'once',
      options: { waitForSubWorkflow: true },
    },
    id: randomUUID(),
    name: 'Call Shared Gate',
    type: 'n8n-nodes-base.executeWorkflow',
    typeVersion: 1.3,
    position: [480, 0],
  },
];

const connections = {
  'Manual Trigger': { main: [[{ node: 'Create Test Pack', type: 'main', index: 0 }]] },
  'Create Test Pack': { main: [[{ node: 'Call Shared Gate', type: 'main', index: 0 }]] },
};

const db = new sqlite3.Database(dbPath);
let executionIds = [];
try {
  const staleExecutions = await all(db, "SELECT id FROM execution_entity WHERE workflowId LIKE 'sharedQualityGateSmoke%'");
  const staleExecutionIds = staleExecutions.map((row) => row.id);
  if (staleExecutionIds.length) {
    const placeholders = staleExecutionIds.map(() => '?').join(',');
    await run(db, `DELETE FROM execution_data WHERE executionId IN (${placeholders})`, staleExecutionIds);
    await run(db, `DELETE FROM execution_entity WHERE id IN (${placeholders})`, staleExecutionIds);
  }
  await run(db, "DELETE FROM shared_workflow WHERE workflowId LIKE 'sharedQualityGateSmoke%'");
  await run(db, "DELETE FROM workflow_entity WHERE id LIKE 'sharedQualityGateSmoke%'");

  await run(
    db,
    `INSERT INTO workflow_entity (id,name,active,nodes,connections,settings,staticData,pinData,versionId,triggerCount,meta,isArchived,versionCounter,description,nodeGroups)
     VALUES (?,?,?,?,?,?,?,?,?,0,NULL,0,1,?,?)`,
    [
      testId,
      'Temporary Shared Quality Gate Runtime Smoke Test',
      0,
      JSON.stringify(nodes),
      JSON.stringify(connections),
      JSON.stringify({ executionOrder: 'v1' }),
      null,
      JSON.stringify({}),
      randomUUID(),
      'Temporary runtime verification; removed automatically.',
      JSON.stringify([]),
    ],
  );
  await run(db, 'INSERT INTO shared_workflow (workflowId,projectId,role) VALUES (?,?,?)', [testId, projectId, 'workflow:owner']);

  const result = spawnSync(process.execPath, [`${root}/node_modules/n8n/bin/n8n`, 'execute', `--id=${testId}`], {
    cwd: root,
    encoding: 'utf8',
    timeout: 120000,
    env: { ...process.env, N8N_LOG_LEVEL: 'info', N8N_RUNNERS_BROKER_PORT: '5680', N8N_USER_FOLDER: root },
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `n8n runtime failed: ${JSON.stringify({ status: result.status, signal: result.signal, error: result.error?.message, stdout: result.stdout, stderr: result.stderr })}`);
  assert.match(result.stdout, /content_quality_review/);
  assert.match(result.stdout, /"pass":\s*true/);

  const executions = await all(db, 'SELECT id FROM execution_entity WHERE workflowId=?', [testId]);
  executionIds = executions.map((row) => row.id);
  console.log('PASS: n8n engine executed shared quality gate with passthrough input');
} finally {
  if (executionIds.length) {
    const placeholders = executionIds.map(() => '?').join(',');
    await run(db, `DELETE FROM execution_data WHERE executionId IN (${placeholders})`, executionIds).catch(() => {});
    await run(db, `DELETE FROM execution_entity WHERE id IN (${placeholders})`, executionIds).catch(() => {});
  }
  await run(db, 'DELETE FROM shared_workflow WHERE workflowId=?', [testId]).catch(() => {});
  await run(db, 'DELETE FROM workflow_entity WHERE id=?', [testId]).catch(() => {});
  const leftovers = await all(db, "SELECT id FROM workflow_entity WHERE id LIKE 'sharedQualityGateSmoke%'");
  assert.equal(leftovers.length, 0, 'temporary runtime smoke workflow cleanup failed');
  db.close();
}
