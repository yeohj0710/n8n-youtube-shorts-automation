import sqlite3 from 'sqlite3';
import { parse as flattedParse } from 'flatted';

const dbPath = 'C:/dev/n8n-youtube-shorts-automation/.n8n/database.sqlite';
const workflowId = 'baekse100Life01';

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

function parseExecution(raw) {
  try {
    return flattedParse(raw);
  } catch {
    return JSON.parse(raw);
  }
}

function firstJson(runData, nodeName) {
  return runData?.[nodeName]?.[0]?.data?.main?.[0]?.[0]?.json || null;
}

function truncate(value, limit = 900) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  if (!text) return text;
  return text.length <= limit ? text : text.slice(0, limit) + `... <truncated ${text.length - limit} chars>`;
}

const db = new sqlite3.Database(dbPath);
try {
  const latest = await get(
    db,
    `select ee.id, ee.status, ee.startedAt, ee.stoppedAt, ed.data
     from execution_entity ee
     left join execution_data ed on ed.executionId=ee.id
     where ee.workflowId=?
     order by cast(ee.id as integer) desc
     limit 1`,
    [workflowId],
  );
  if (!latest) throw new Error('no execution found');
  const parsed = parseExecution(latest.data);
  const runData = parsed?.resultData?.runData || parsed?.data?.resultData?.runData || {};
  const error = parsed?.resultData?.error || parsed?.data?.resultData?.error || null;

  const create = firstJson(runData, 'KIE Create Image Task');
  const normalize = firstJson(runData, 'Normalize Image Task');
  const poll = firstJson(runData, 'KIE Get Image Task');
  const parse = firstJson(runData, 'Parse Image Result');
  const retryPrep = firstJson(runData, 'Prepare Image Retry Poll');
  const retryPoll = firstJson(runData, 'KIE Get Image Task Retry');
  const finalParse = firstJson(runData, 'Parse Image Result Final');
  const payload = firstJson(runData, 'Prepare Image and BGM Payloads');
  const pack = payload?.pack || {};
  const imagePayload = payload?.image_payload || normalize?.image_payload || {};
  const imagePrompt = imagePayload?.input?.prompt || '';

  console.log(JSON.stringify({
    execution: {
      id: latest.id,
      status: latest.status,
      startedAt: latest.startedAt,
      stoppedAt: latest.stoppedAt,
    },
    error,
    pack: {
      content_lane: pack.content_lane,
      theme: pack.theme,
      hook_title: pack.hook_title,
      subtitle: pack.subtitle,
      rank_items: pack.rank_items,
      pinned_comment: pack.pinned_comment,
    },
    createImageTask: {
      code: create?.code,
      msg: create?.msg,
      taskId: create?.data?.taskId || create?.taskId || create?.id,
      failCode: create?.data?.failCode || create?.failCode,
      failMsg: create?.data?.failMsg || create?.failMsg,
    },
    firstPoll: {
      code: poll?.code,
      msg: poll?.msg,
      data: poll?.data,
    },
    parseImageResult: parse && {
      image_state: parse.image_state,
      image_task_id: parse.image_task_id,
      image_failed: parse.image_failed,
      image_url: parse.image_url,
    },
    retryPrep: retryPrep && {
      image_poll_attempt: retryPrep.image_poll_attempt,
      image_task_id: retryPrep.image_task_id,
    },
    retryPoll: {
      code: retryPoll?.code,
      msg: retryPoll?.msg,
      data: retryPoll?.data,
    },
    finalParse,
    promptStats: {
      length: imagePrompt.length,
      containsMedicalWords: /(질병|당뇨|혈당|고혈압|치료|예방|경고|최악|위협|위험|아프|통증|약|영양제|뇌과학자|교수|의사|병원|면역|머리카락|손톱|얼굴)/.test(imagePrompt),
      sample: truncate(imagePrompt, 1800),
    },
  }, null, 2));
} finally {
  db.close();
}
