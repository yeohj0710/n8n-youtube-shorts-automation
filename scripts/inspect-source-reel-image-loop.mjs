import sqlite3 from 'sqlite3';
import { parse } from 'flatted';

const executionId = Number(process.argv[2] || 137);
const db = new sqlite3.Database('.n8n/database.sqlite', sqlite3.OPEN_READONLY);
const row = await new Promise((resolve, reject) => db.get(
  `SELECT ee.id,ee.workflowId,ee.status,ee.startedAt,ee.stoppedAt,ed.data FROM execution_entity ee JOIN execution_data ed ON ed.executionId=ee.id WHERE ee.id=?`,
  [executionId], (error, value) => error ? reject(error) : resolve(value),
));
db.close();
if (!row) throw new Error(`execution ${executionId} not found`);
const parsed = parse(row.data);
const runData = parsed.resultData?.runData || {};
const names = ['KIE Create Image Task','Normalize Image Task','KIE Get Image Task','Parse Image Result','Image Ready?','Image Task Retryable?','Prepare Image Retry Poll','KIE Get Image Task Retry','Parse Image Result Final','Prepare Image Task Retry'];
const summary = {};
for (const name of names) {
  const runs = runData[name] || [];
  summary[name] = runs.map((run, index) => {
    const items = run.data?.main?.flat()?.map((item) => item?.json || {}) || [];
    return { index, executionTime: run.executionTime, error: run.error?.message || null, items: items.map((json) => ({
      taskId: json.image_task_id || json.data?.taskId || json.taskId || null,
      state: json.image_state || json.data?.state || json.data?.status || json.status || null,
      failed: json.image_failed || false,
      failCode: json.data?.failCode || json.failCode || null,
      failMsg: json.data?.failMsg || json.failMsg || null,
      pollAttempt: json.image_poll_attempt,
      taskAttempt: json.image_task_attempt,
      retryable: json.image_task_retryable,
      url: json.image_url || null,
    })) };
  });
}
console.log(JSON.stringify({ execution: { id: row.id, workflowId: row.workflowId, status: row.status, startedAt: row.startedAt, stoppedAt: row.stoppedAt }, lastNode: parsed.resultData?.lastNodeExecuted, error: parsed.resultData?.error?.message || null, summary }, null, 2));
