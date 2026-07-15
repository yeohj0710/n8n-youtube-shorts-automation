import sqlite3 from 'sqlite3';
import { parse } from 'flatted';

const ids = ['a8031b4a365c4603', '66bce6ab603c5bef'];
const db = new sqlite3.Database('.n8n/database.sqlite', sqlite3.OPEN_READONLY);
const rows = await new Promise((resolve, reject) => db.all(
  `SELECT id,workflowId,status,startedAt,stoppedAt FROM execution_entity WHERE workflowId IN (?,?) ORDER BY id DESC LIMIT 30`,
  ids,
  (error, values) => error ? reject(error) : resolve(values),
));
db.close();
const summary = rows.reduce((out, row) => ({ ...out, [row.status]: (out[row.status] || 0) + 1 }), {});
const errors = [];
for (const row of rows.filter((item) => item.status === 'error')) {
  const stored = await new Promise((resolve, reject) => {
    const readDb = new sqlite3.Database('.n8n/database.sqlite', sqlite3.OPEN_READONLY);
    readDb.get('SELECT data FROM execution_data WHERE executionId=?', [row.id], (error, value) => {
      readDb.close();
      error ? reject(error) : resolve(value);
    });
  });
  if (!stored?.data) continue;
  const execution = parse(stored.data);
  const error = execution.resultData?.error || {};
  errors.push({ id: row.id, lastNodeExecuted: execution.resultData?.lastNodeExecuted || null, message: error.message || null });
}
console.log(JSON.stringify({ ok: true, executions: rows.length, summary, historical_errors: errors, rows }, null, 2));
