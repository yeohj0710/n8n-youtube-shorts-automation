// 한 화면 정보 카드 레퍼런스 2,000건에서 한 건을 골라 쇼츠로 만드는 회로를 빌드한다.
//
// 소재는 `research/single-screen-references/videos.jsonl`이며, 사용자가 이미 우리
// 채널용으로 재가공한 `*_reworked_ko` 필드를 그대로 쓴다. 이미지 생성·BGM·렌더·업로드는
// 메인 워크플로우(`n8n_하루건강약사_수동실행.json`)의 노드를 그대로 복제해 쓰므로
// 그림 품질과 음악 규칙이 기존 쇼츠와 같다.
//
// 실행: node scripts/build-reference-card-workflow.mjs
// 임포트: scripts\import-workflow.ps1 -Workflow workflows\n8n_reference_card_haru_manual.json

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const workflowDir = path.join(root, 'workflows');

const SOURCE_WORKFLOW_ID = 'mxrYb3maJS31gEYC';
const WORKFLOW_ID = 'haruReferenceCardShorts01';
const WORKFLOW_NAME = '하루건강약사 - 레퍼런스 카드 쇼츠';
const OUTPUT_FILE = 'n8n_reference_card_haru_manual.json';

const KIE_CREDENTIAL = { httpHeaderAuth: { id: 'MV5JVbdiJSoVx9O8', name: 'Header Auth account' } };
const GOOGLE_SHEETS_CREDENTIAL = {
  googleSheetsOAuth2Api: { id: 'haruSheetsOAuth1', name: 'Google Sheets account' },
};
const REFERENCE_SPREADSHEET_ID = '1K6gT9TY_WHuxB3SHEx5VyJK2JunQWJRdkdV4ecNu_fc';
const REFERENCE_SHEET_ID = 159350994;
const REFERENCE_SHEET_NAME = '통과 영상';
const UPLOAD_COMPLETE_COLUMN = '업로드 완료';
const UPLOAD_COMPLETE_COLUMN_INDEX = 46; // AU, zero-based

const definition = {
  channelName: '하루건강약사',
  handle: '@haruyaksa',
  datasetPath: path.join(root, 'research', 'single-screen-references', 'videos.jsonl').replace(/\\/g, '/'),
  datasetBackupPath: path.join(root, 'research', 'single-screen-references', 'etc', 'videos.before-sheet-sync.jsonl').replace(/\\/g, '/'),
  datasetStatePath: path.join(root, 'research', 'single-screen-references', 'state.json').replace(/\\/g, '/'),
  sheetSyncConfigPath: path.join(root, 'research', 'single-screen-references', 'etc', 'google_sheet_sync_config.json').replace(/\\/g, '/'),
  workRoot: path.join(root, '레퍼런스 카드').replace(/\\/g, '/'),
  spreadsheetId: REFERENCE_SPREADSHEET_ID,
  sheetId: REFERENCE_SHEET_ID,
  sheetName: REFERENCE_SHEET_NAME,
  uploadCompleteColumn: UPLOAD_COMPLETE_COLUMN,
  uploadCompleteColumnIndex: UPLOAD_COMPLETE_COLUMN_INDEX,
  // 선별 기준은 파일로 뺀다. 데이터셋의 자체 QA 플래그가 2,000건 중 11건만
  // publish_ready로 표시하므로(claim_risk high 1,945건), 기준을 넓히는 판단은
  // 사용자가 이 파일을 고쳐서 하도록 한다. 코드 수정 없이 바꿀 수 있다.
  gateConfigFile: 'selection-gate.json',
  defaultGate: {
    require_publish_ready: true,
    allowed_claim_risk: ['low'],
    allow_fact_check_required: false,
    min_items: 4,
    max_items: 13,
  },
};

// 이 노드들은 메인 워크플로우에서 그대로 복제한다. 이미지 프롬프트·BGM 규칙·렌더·업로드가
// 기존 쇼츠와 한 글자도 다르지 않아야 하므로 다시 쓰지 않는다.
const clonedNodeNames = [
  'Load Config',
  'Medical Safety Review',
  'Medical Review Passed?',
  'Prepare Image and BGM Payloads',
  'Use Live Image?',
  'KIE Create Image Task',
  'Normalize Image Task',
  'Wait Image 30s',
  'KIE Get Image Task',
  'Parse Image Result',
  'Image Ready?',
  'Image Task Retryable?',
  'Wait Image Task Retry 30s',
  'Prepare Image Task Retry',
  'Wait Image Retry 30s',
  'Prepare Image Retry Poll',
  'KIE Get Image Task Retry',
  'Parse Image Result Final',
  'Mock Image Result',
  'Use Live BGM?',
  'KIE Create BGM Task',
  'Normalize BGM Task',
  'Wait BGM 30s',
  'KIE Get BGM Task',
  'Parse BGM Result',
  'Mock BGM Result',
  'BGM Ready?',
  'Wait BGM Retry 90s',
  'KIE Get BGM Task Retry',
  'Parse BGM Result Final',
  'Use Live Render?',
  'Mock Render Result',
  'Prepare Local FFmpeg Render',
  'Local FFmpeg Render',
  'Parse Local Render Result',
  'Read Rendered MP4',
  'Attach Downloaded MP4',
  'Allow YouTube Upload?',
  'YouTube Upload Public',
  'Normalize YouTube Upload',
  'Post Top-Level Comment',
  'Attach Comment Result',
  'Skip YouTube Upload',
];

function stableUuid(seed) {
  const hash = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 32).split('');
  hash[12] = '4';
  hash[16] = ['8', '9', 'a', 'b'][Number.parseInt(hash[16], 16) % 4];
  const value = hash.join('');
  return [value.slice(0, 8), value.slice(8, 12), value.slice(12, 16), value.slice(16, 20), value.slice(20)].join('-');
}

function readCanonicalWorkflow(workflowId) {
  for (const fileName of fs.readdirSync(workflowDir).filter((name) => name.endsWith('.json'))) {
    const workflow = JSON.parse(fs.readFileSync(path.join(workflowDir, fileName), 'utf8'));
    if (workflow.id === workflowId) return workflow;
  }
  throw new Error(`Canonical workflow not found: ${workflowId}`);
}

function codeFor(runtime, config) {
  return [
    `const referenceDefinition = ${JSON.stringify(config)};`,
    runtime.toString(),
    `return ${runtime.name}(referenceDefinition);`,
  ].join('\n\n');
}

function createNode(name, type, typeVersion, position, parameters, extra = {}) {
  return {
    parameters,
    id: stableUuid(`${WORKFLOW_ID}:${name}`),
    name,
    type,
    typeVersion,
    position,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// 새로 쓰는 노드 + 차단 처리
// ---------------------------------------------------------------------------

// Google Sheet의 현재 2,000행을 record_id로 videos.jsonl에 병합한다. 로컬 레코드의
// 개수와 순서는 유지한다. 이어서 사용기록 전체를 AU 체크박스에 반영할 batchUpdate 본문을
// 만든다. 이 동기화가 실패하면 소재 선택 전에 실행을 중단한다.
function mergeReferenceSheetRuntime(definition) {
  const fs = require('fs');
  const path = require('path');
  const crypto = require('crypto');

  const sheetRows = $input.all().map((item) => item.json || {});
  if (!fs.existsSync(definition.datasetPath)) {
    throw new Error('레퍼런스 데이터셋을 찾지 못했습니다: ' + definition.datasetPath);
  }

  const originalText = fs.readFileSync(definition.datasetPath, 'utf8');
  const localRecords = originalText.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error('videos.jsonl ' + (index + 1) + '행 JSON 오류: ' + error.message); }
  });
  if (!localRecords.length) throw new Error('레퍼런스 데이터셋이 비어 있습니다.');
  if (sheetRows.length !== localRecords.length) {
    throw new Error('Google Sheet 행 수가 videos.jsonl과 다릅니다: sheet=' + sheetRows.length + ', jsonl=' + localRecords.length);
  }

  const state = JSON.parse(fs.readFileSync(definition.datasetStatePath, 'utf8'));
  const syncConfig = JSON.parse(fs.readFileSync(definition.sheetSyncConfigPath, 'utf8'));
  const ids = [definition.spreadsheetId, state.google_sheet?.sheet_id, syncConfig.spreadsheet_id];
  if (new Set(ids).size !== 1) {
    throw new Error('Google Sheet ID가 설정 파일마다 다릅니다: ' + ids.join(', '));
  }

  const localById = new Map();
  for (const record of localRecords) {
    const id = String(record.record_id || '');
    if (!id) throw new Error('videos.jsonl에 record_id가 없는 레코드가 있습니다.');
    if (localById.has(id)) throw new Error('videos.jsonl record_id 중복: ' + id);
    localById.set(id, record);
  }

  const sheetById = new Map();
  const rowsByNumber = new Map();
  for (let index = 0; index < sheetRows.length; index += 1) {
    const row = sheetRows[index];
    const id = String(row.record_id || '');
    if (!id) throw new Error('Google Sheet ' + (index + 2) + '행에 record_id가 없습니다.');
    if (!localById.has(id)) throw new Error('Google Sheet에 videos.jsonl에 없는 record_id가 있습니다: ' + id);
    if (sheetById.has(id)) throw new Error('Google Sheet record_id 중복: ' + id);
    const rowNumber = Number(row.row_number || index + 2);
    if (!Number.isInteger(rowNumber) || rowNumber < 2 || rowNumber > localRecords.length + 1) {
      throw new Error('Google Sheet row_number가 범위를 벗어났습니다: ' + rowNumber);
    }
    if (rowsByNumber.has(rowNumber)) throw new Error('Google Sheet row_number 중복: ' + rowNumber);
    sheetById.set(id, row);
    rowsByNumber.set(rowNumber, row);
  }
  for (let rowNumber = 2; rowNumber <= localRecords.length + 1; rowNumber += 1) {
    if (!rowsByNumber.has(rowNumber)) throw new Error('Google Sheet 데이터 행이 비어 있습니다: ' + rowNumber);
  }

  const schema = new Map();
  for (const key of Object.keys(localRecords[0])) schema.set(key, { types: new Set(), nullable: false });
  for (const record of localRecords) {
    for (const key of schema.keys()) {
      const value = record[key];
      const entry = schema.get(key);
      if (value === null || value === undefined) entry.nullable = true;
      else entry.types.add(Array.isArray(value) ? 'array' : typeof value);
    }
  }

  function parseCell(key, row, recordId, priorValue) {
    const entry = schema.get(key);
    const present = Object.prototype.hasOwnProperty.call(row, key);
    const value = present ? row[key] : undefined;
    if (value === undefined || value === null || value === '') {
      if (entry.nullable) return null;
      if (entry.types.has('array')) return [];
      if (entry.types.has('boolean')) return false;
      if (entry.types.has('string')) return '';
      return null;
    }
    if (entry.types.has('array')) {
      if (Array.isArray(value)) return value;
      if (typeof value !== 'string') throw new Error(recordId + ' ' + key + ': 배열은 JSON 문자열이어야 합니다.');
      let parsed;
      try { parsed = JSON.parse(value); }
      catch (error) { throw new Error(recordId + ' ' + key + ': 배열 JSON 오류: ' + error.message); }
      if (!Array.isArray(parsed)) throw new Error(recordId + ' ' + key + ': JSON 배열이 아닙니다.');
      return parsed;
    }
    if (entry.types.size === 1 && entry.types.has('boolean')) {
      if (typeof value !== 'boolean') throw new Error(recordId + ' ' + key + ': Boolean 체크박스 값이 아닙니다.');
      return value;
    }
    if (entry.types.size === 1 && entry.types.has('number')) {
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(recordId + ' ' + key + ': 숫자 값이 아닙니다.');
      return value;
    }
    if (entry.types.size === 1 && entry.types.has('string')) {
      if (typeof value !== 'string') throw new Error(recordId + ' ' + key + ': 문자열 값이 아닙니다.');
      if (value.startsWith("'") && value.slice(1) === priorValue) return priorValue;
      if (key === 'source_handle' && value.startsWith("'@")) return value.slice(1);
      if (key === 'item_id' && value.startsWith("'") && value.slice(1) === recordId) return value.slice(1);
      if (key === 'collected_at') {
        const kst = value.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) \(KST\)$/);
        if (kst) return kst[1] + 'T' + kst[2] + '+09:00';
      }
      return value;
    }
    return value;
  }

  const mergedRecords = localRecords.map((record) => {
    const id = String(record.record_id);
    const row = sheetById.get(id);
    const merged = { ...record };
    for (const key of schema.keys()) {
      if (key === 'record_id') continue;
      merged[key] = parseCell(key, row, id, record[key]);
    }
    return merged;
  });
  const mergedText = mergedRecords.map((record) => JSON.stringify(record)).join('\n') + '\n';
  const changedRecords = mergedRecords.reduce((count, record, index) => (
    JSON.stringify(record) === JSON.stringify(localRecords[index]) ? count : count + 1
  ), 0);
  const syncRunId = Date.now().toString(36) + '-' + crypto.randomBytes(6).toString('hex');

  if (mergedText !== originalText) {
    fs.mkdirSync(path.dirname(definition.datasetBackupPath), { recursive: true });
    fs.copyFileSync(definition.datasetPath, definition.datasetBackupPath);
    const tempPath = definition.datasetPath + '.sheet-sync-' + syncRunId + '.tmp';
    try {
      fs.writeFileSync(tempPath, mergedText, 'utf8');
      fs.renameSync(tempPath, definition.datasetPath);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }

  const syncedAt = new Date().toISOString();
  state.google_sheet ||= {};
  state.google_sheet.last_synced_row = mergedRecords.length;
  state.google_sheet.last_synced_at = syncedAt;
  state.updated_at = syncedAt;
  const stateTempPath = definition.datasetStatePath + '.sheet-sync-' + syncRunId + '.tmp';
  try {
    fs.writeFileSync(stateTempPath, JSON.stringify(state, null, 2) + '\n', 'utf8');
    fs.renameSync(stateTempPath, definition.datasetStatePath);
  } finally {
    if (fs.existsSync(stateTempPath)) fs.unlinkSync(stateTempPath);
  }

  const usedIds = new Set();
  const usedLogPath = path.join(definition.workRoot, '기록', '사용기록.jsonl');
  if (fs.existsSync(usedLogPath)) {
    for (const line of fs.readFileSync(usedLogPath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const entry = JSON.parse(trimmed);
        if (entry.record_id) usedIds.add(String(entry.record_id));
      } catch (error) { throw new Error('사용기록.jsonl JSON 오류: ' + error.message); }
    }
  }

  const uploadValues = [];
  let checkedRows = 0;
  for (let rowNumber = 2; rowNumber <= mergedRecords.length + 1; rowNumber += 1) {
    const row = rowsByNumber.get(rowNumber);
    const checked = row[definition.uploadCompleteColumn] === true || usedIds.has(String(row.record_id));
    if (checked) checkedRows += 1;
    uploadValues.push({ values: [{ userEnteredValue: { boolValue: checked } }] });
  }

  return [{
    json: {
      sheet_sync: {
        spreadsheet_id: definition.spreadsheetId,
        sheet_name: definition.sheetName,
        rows: mergedRecords.length,
        changed_records: changedRecords,
        used_records: usedIds.size,
        checked_rows: checkedRows,
        synced_at: syncedAt,
      },
      sheet_batch_update: {
        requests: [
          {
            updateCells: {
              range: {
                sheetId: definition.sheetId,
                startRowIndex: 1,
                endRowIndex: mergedRecords.length + 1,
                startColumnIndex: definition.uploadCompleteColumnIndex,
                endColumnIndex: definition.uploadCompleteColumnIndex + 1,
              },
              rows: uploadValues,
              fields: 'userEnteredValue',
            },
          },
          {
            setDataValidation: {
              range: {
                sheetId: definition.sheetId,
                startRowIndex: 1,
                endRowIndex: mergedRecords.length + 1,
                startColumnIndex: definition.uploadCompleteColumnIndex,
                endColumnIndex: definition.uploadCompleteColumnIndex + 1,
              },
              rule: { condition: { type: 'BOOLEAN' }, strict: true, showCustomUi: true },
            },
          },
        ],
      },
    },
  }];
}

// 데이터셋에서 아직 안 쓴 레코드 하나를 고르고 잠금을 잡는다.
function pickReferenceCardRuntime(definition) {
  const fs = require('fs');
  const path = require('path');
  const crypto = require('crypto');

  const base = $input.first().json;
  const config = base.config || {};
  const workRoot = definition.workRoot;
  const logDir = path.join(workRoot, '기록');
  const usedLogPath = path.join(logDir, '사용기록.jsonl');
  const uploadLogPath = path.join(logDir, '업로드기록.jsonl');
  const lockPath = path.join(logDir, 'reference-card.lock');
  const lockTtlMs = 30 * 60 * 1000;
  const token = Date.now().toString(36) + '-' + crypto.randomBytes(6).toString('hex');

  fs.mkdirSync(logDir, { recursive: true });

  if (fs.existsSync(lockPath)) {
    let stale = false;
    try {
      const current = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      stale = Date.now() - Date.parse(current.acquired_at || 0) > lockTtlMs;
    } catch (error) {
      stale = Date.now() - fs.statSync(lockPath).mtimeMs > lockTtlMs;
    }
    if (stale) fs.unlinkSync(lockPath);
    else throw new Error('레퍼런스 카드 회로가 이미 실행 중입니다. 현재 실행이 끝난 뒤 다시 실행하세요.');
  }
  const lockHandle = fs.openSync(lockPath, 'wx');
  try {
    fs.writeFileSync(lockHandle, JSON.stringify({ token, acquired_at: new Date().toISOString() }), 'utf8');
  } finally {
    fs.closeSync(lockHandle);
  }

  try {
    // 선별 기준은 파일이 있으면 그걸 쓰고, 없으면 기본값을 쓴다.
    let gate = { ...definition.defaultGate };
    const gatePath = path.join(workRoot, definition.gateConfigFile);
    if (fs.existsSync(gatePath)) {
      try {
        gate = { ...gate, ...JSON.parse(fs.readFileSync(gatePath, 'utf8')) };
      } catch (error) {
        throw new Error('선별 기준 파일을 읽지 못했습니다(JSON 오류): ' + gatePath + ' — ' + error.message);
      }
    }

    if (!fs.existsSync(definition.datasetPath)) {
      throw new Error('레퍼런스 데이터셋을 찾지 못했습니다: ' + definition.datasetPath);
    }
    const records = [];
    for (const line of fs.readFileSync(definition.datasetPath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        records.push(JSON.parse(trimmed));
      } catch (error) { /* 깨진 줄은 건너뛴다 */ }
    }
    if (!records.length) throw new Error('레퍼런스 데이터셋이 비어 있습니다: ' + definition.datasetPath);

    // 이미 쓴 record_id. 사용기록이 곧 체크리스트다.
    const used = new Set();
    for (const logPath of [usedLogPath, uploadLogPath]) {
      if (!fs.existsSync(logPath)) continue;
      for (const line of fs.readFileSync(logPath, 'utf8').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const entry = JSON.parse(trimmed);
          if (entry.record_id) used.add(String(entry.record_id));
        } catch (error) { /* 무시 */ }
      }
    }

    const allowedRisk = new Set((gate.allowed_claim_risk || []).map((value) => String(value).toLowerCase()));
    const reasons = { used: 0, publish_ready: 0, claim_risk: 0, fact_check: 0, item_count: 0, missing_copy: 0 };
    const candidates = records.filter((record) => {
      if (used.has(String(record.record_id))) { reasons.used += 1; return false; }
      if (gate.require_publish_ready && record.publish_ready !== true) { reasons.publish_ready += 1; return false; }
      if (allowedRisk.size && !allowedRisk.has(String(record.claim_risk || '').toLowerCase())) { reasons.claim_risk += 1; return false; }
      if (!gate.allow_fact_check_required && record.fact_check_required === true) { reasons.fact_check += 1; return false; }
      const items = Array.isArray(record.card_items_reworked_ko) ? record.card_items_reworked_ko : [];
      if (!record.title_reworked_ko || !record.card_headline_reworked_ko || !items.length) { reasons.missing_copy += 1; return false; }
      if (items.length < gate.min_items || items.length > gate.max_items) { reasons.item_count += 1; return false; }
      return true;
    });

    if (!candidates.length) {
      throw new Error('선별 기준을 통과한 미사용 레퍼런스가 없습니다. 제외 사유: '
        + '이미사용 ' + reasons.used + ', publish_ready아님 ' + reasons.publish_ready
        + ', claim_risk제외 ' + reasons.claim_risk + ', 사실확인필요 ' + reasons.fact_check
        + ', 항목수범위밖 ' + reasons.item_count + ', 문안누락 ' + reasons.missing_copy
        + '. 기준을 넓히려면 ' + gatePath + ' 를 고치세요.');
    }

    const record = candidates[crypto.randomInt(candidates.length)];
    return [{
      json: {
        ...base,
        config: {
          ...config,
          reference_work_root: workRoot,
          reference_used_log_path: usedLogPath,
          reference_upload_log_path: uploadLogPath,
          reference_lock_path: lockPath,
          reference_lock_token: token,
          // 메인 회로의 소재 큐 로그와 섞이지 않게 이 회로 전용 경로로 덮어쓴다.
          topic_queue_used_log_path: usedLogPath,
          upload_log_path: uploadLogPath,
        },
        reference: record,
        reference_pool: {
          total: records.length,
          used: used.size,
          eligible: candidates.length,
          gate,
        },
      },
    }];
  } catch (error) {
    try {
      if (fs.existsSync(lockPath)) {
        const current = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
        if (current.token === token) fs.unlinkSync(lockPath);
      }
    } catch (cleanupError) { /* 무시 */ }
    throw error;
  }
}

// 재가공 문안을 메인 회로의 pack 모양으로 옮긴다. 원문에 없는 말은 만들지 않는다.
function buildReferencePackRuntime(definition) {
  const base = $input.first().json;
  const record = base.reference;
  if (!record) throw new Error('reference 레코드가 없습니다. Pick Reference Card 연결을 확인하세요.');

  const LF = String.fromCharCode(10);
  function clean(value) {
    return String(value == null ? '' : value).replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').replace(/[ \t]+/g, ' ').trim();
  }
  function limit(value, maxLength) {
    return Array.from(clean(value)).slice(0, maxLength).join('').trim();
  }

  const title = limit(record.title_reworked_ko, 95);
  const headline = limit(record.card_headline_reworked_ko, 60);
  if (title.length < 4) throw new Error('재가공 제목이 너무 짧습니다: ' + record.record_id);

  // 재가공 항목은 "1. " 같은 번호가 붙어 오는 경우가 있어 떼고 쓴다. 번호는
  // rank_label_mode가 붙인다.
  const rawItems = Array.isArray(record.card_items_reworked_ko) ? record.card_items_reworked_ko : [];
  const items = rawItems
    .map((value) => clean(value).replace(/^\s*\d+\s*[.)]\s*/, '').trim())
    .filter(Boolean)
    .map((value, index) => {
      // "이름 - 이유" 형태면 쪼개고, 아니면 한 줄을 이름으로 둔다.
      const split = value.split(/\s+[-–—]\s+/);
      const name = clean(split[0]);
      const reason = clean(split.slice(1).join(' - '));
      return {
        rank: index + 1,
        name: limit(name, 60),
        reason: limit(reason || name, 120),
        card_name: limit(name, 30),
        card_reason: limit(reason, 60),
      };
    });
  if (items.length < 3) throw new Error('재가공 항목이 3개 미만입니다: ' + record.record_id);

  const topicText = (Array.isArray(record.topics) ? record.topics : []).join(' ');
  const lifeWisdomTopic = /인간관계|부부관계|인생교훈|심리|예절|말|관계/.test(topicText);
  const closing = lifeWisdomTopic
    ? '관계와 삶에 도움 되는 지혜를 매일 하나씩 전해 드려요. 팔로우해 두시면 놓치지 않고 받아보실 수 있어요.'
    : '몸에 도움 되는 정보를 매일 하나씩 전해 드려요. 팔로우해 두시면 놓치지 않고 받아보실 수 있어요.';
  const descriptionRows = items.map((item) => item.name + (item.card_reason ? ' - ' + item.card_reason : ''));
  const description = limit([title, headline, descriptionRows.join(LF + LF), closing].filter(Boolean).join(LF + LF), 4500);
  const pinnedComment = limit(
    ['오늘 영상 핵심 정리', title, ''].concat(descriptionRows).concat(['', closing]).join(LF),
    1000,
  );

  const topicTags = (Array.isArray(record.topics) ? record.topics : [])
    .flatMap((topic) => String(topic).split('_'))
    .map((token) => clean(token))
    .filter((token) => token.length >= 2);
  const tags = [...new Set([
    definition.channelName.replace(/\s+/g, ''),
    '건강정보',
    '시니어건강',
    '쇼츠',
    ...topicTags,
  ])].slice(0, 12);

  return [{
    json: {
      ...base,
      ai_source: 'single_screen_reference_rework',
      pack: {
        hook_title: title,
        subtitle: headline,
        // 이 카드들은 순위표가 아니라 목록이므로 N위를 붙이지 않는다.
        rank_label_mode: 'bullet',
        rank_items: items,
        description,
        pinned_comment: pinnedComment,
        tags,
        topic_category: (Array.isArray(record.topics) ? record.topics[0] : '') || 'reference_card',
        content_lane: 'single_screen_reference',
        bgm_prompt: lifeWisdomTopic
          ? 'bright happy acoustic instrumental for a warm life-wisdom topic'
          : 'bright happy acoustic instrumental for this health topic',
        visual_mood_hint: '',
      },
      reference_summary: {
        record_id: record.record_id,
        source_url: record.url,
        source_handle: record.source_handle,
        claim_risk: record.claim_risk,
        publish_ready: record.publish_ready === true,
        item_count: items.length,
      },
    },
  }];
}

// 메인 회로의 이미지 프롬프트 푸터에는 팔로우 문구만 있고 채널 핸들이 없다. 카드뉴스
// 디자인처럼 마무리 줄에 `@haruyaksa`를 붙인다(사용자 요청). 메인 회로를 건드리지 않고
// 이 회로에서만 프롬프트 문자열을 손보는 방식이라, 메인 쇼츠 문안은 그대로다.
function addHandleToCardFooterRuntime(definition) {
  const data = $input.first().json;
  const handle = definition.handle;

  function withHandle(text) {
    const value = String(text == null ? '' : text);
    if (!value || value.includes(handle)) return value;
    // 푸터 줄 끝에만 붙인다. 줄 전체를 다시 쓰지 않아야 안전영역·크기 지시가 살아남는다.
    return value.replace(/(FOOTER SUBSCRIBE LINE[^\n]*?)(?=\n|$)/m, '$1 · ' + handle);
  }

  const imagePayload = data.image_payload ? JSON.parse(JSON.stringify(data.image_payload)) : null;
  if (imagePayload?.input?.prompt) {
    imagePayload.input.prompt = withHandle(imagePayload.input.prompt);
  }
  const visibleCardText = withHandle(data.visible_card_text);

  if (imagePayload?.input?.prompt && !imagePayload.input.prompt.includes(handle)) {
    throw new Error('이미지 프롬프트에 채널 핸들을 넣지 못했습니다. 메인 회로의 FOOTER SUBSCRIBE LINE 문구가 바뀌었는지 확인하세요.');
  }

  return [{ json: { ...data, image_payload: imagePayload, visible_card_text: visibleCardText, card_footer_handle: handle } }];
}

// 의학 안전 검수에서 막히면 잠금을 풀고 사유만 남긴다. 이 회로는 재생성하지 않는다.
function blockedReferenceCardRuntime(definition) {
  const fs = require('fs');
  const data = $input.first().json;
  const config = data.config || {};
  try {
    if (config.reference_lock_path && fs.existsSync(config.reference_lock_path)) {
      const current = JSON.parse(fs.readFileSync(config.reference_lock_path, 'utf8'));
      if (current.token === config.reference_lock_token) fs.unlinkSync(config.reference_lock_path);
    }
  } catch (error) { /* 무시 */ }
  return [{
    json: {
      ...data,
      reference_result: {
        published: false,
        blocked: true,
        record_id: data.reference_summary?.record_id || null,
        reason: data.medical_review?.issues || data.medical_review || '의학 안전 검수에서 차단됨',
        note: '이 레코드는 사용기록에 남기지 않았습니다. 문안을 고치거나 다른 레코드로 다시 실행하세요.',
      },
    },
  }];
}

// 업로드까지 끝났으면 record_id를 사용기록에 남긴다. 이게 체크리스트다.
function completeReferenceCardRuntime(definition) {
  const fs = require('fs');
  const data = $input.first().json;
  const config = data.config || {};
  const summary = data.reference_summary || {};
  const youtube = data.youtube || {};
  const uploaded = !!youtube.video_id && youtube.skipped !== true;
  const now = new Date().toISOString();

  if (summary.record_id) {
    const entry = {
      record_id: summary.record_id,
      title: data.pack?.hook_title || null,
      source_url: summary.source_url || null,
      claim_risk: summary.claim_risk || null,
      item_count: summary.item_count || null,
      published: uploaded,
      video_id: youtube.video_id || null,
      video_url: youtube.url || null,
      used_at: now,
    };
    // 업로드 여부와 무관하게 소비된 것으로 표시한다. 렌더까지 갔으면 비용이 났고,
    // 같은 레코드를 다시 뽑아 또 쓰는 게 더 나쁘다.
    fs.appendFileSync(config.reference_used_log_path, JSON.stringify(entry) + '\n', 'utf8');
    if (uploaded && config.reference_upload_log_path) {
      fs.appendFileSync(config.reference_upload_log_path, JSON.stringify(entry) + '\n', 'utf8');
    }
  }

  try {
    if (config.reference_lock_path && fs.existsSync(config.reference_lock_path)) {
      const current = JSON.parse(fs.readFileSync(config.reference_lock_path, 'utf8'));
      if (current.token === config.reference_lock_token) fs.unlinkSync(config.reference_lock_path);
    }
  } catch (error) { /* 무시 */ }

  return [{
    json: {
      ...data,
      reference_result: {
        published: uploaded,
        blocked: false,
        record_id: summary.record_id || null,
        title: data.pack?.hook_title || null,
        video_url: youtube.url || null,
        checked_off_at: now,
        pool: data.reference_pool || null,
      },
    },
  }];
}

// ---------------------------------------------------------------------------
// 빌드
// ---------------------------------------------------------------------------

const source = readCanonicalWorkflow(SOURCE_WORKFLOW_ID);
const sourceByName = new Map(source.nodes.map((node) => [node.name, node]));

const positions = {
  'Load Config': [240, 300],
  'Pick Reference Card': [480, 300],
  'Build Reference Pack': [720, 300],
  'Medical Safety Review': [960, 300],
  'Medical Review Passed?': [1200, 300],
  'Blocked Reference Card': [1200, 620],
  'Prepare Image and BGM Payloads': [1440, 300],
  'Add Handle To Card Footer': [1680, 300],
  'Use Live Image?': [1920, 300],
  'KIE Create Image Task': [2160, 180],
  'Normalize Image Task': [2160, 180],
  'Wait Image 30s': [2400, 180],
  'KIE Get Image Task': [2640, 180],
  'Parse Image Result': [2880, 180],
  'Image Ready?': [3120, 180],
  'Image Task Retryable?': [3120, 480],
  'Wait Image Task Retry 30s': [3360, 560],
  'Prepare Image Task Retry': [3600, 560],
  'Wait Image Retry 30s': [3360, 680],
  'Prepare Image Retry Poll': [3600, 680],
  'KIE Get Image Task Retry': [3840, 680],
  'Parse Image Result Final': [4080, 680],
  'Mock Image Result': [2160, 480],
  'Use Live BGM?': [3360, 180],
  'KIE Create BGM Task': [3600, 60],
  'Normalize BGM Task': [3840, 60],
  'Wait BGM 30s': [4080, 60],
  'KIE Get BGM Task': [4320, 60],
  'Parse BGM Result': [4560, 60],
  'Mock BGM Result': [3600, 320],
  'BGM Ready?': [4800, 60],
  'Wait BGM Retry 90s': [5040, 220],
  'KIE Get BGM Task Retry': [5280, 220],
  'Parse BGM Result Final': [5520, 220],
  'Use Live Render?': [5760, 60],
  'Mock Render Result': [6000, 320],
  'Prepare Local FFmpeg Render': [6000, 0],
  'Local FFmpeg Render': [6240, 0],
  'Parse Local Render Result': [6480, 0],
  'Read Rendered MP4': [6720, 0],
  'Attach Downloaded MP4': [6960, 0],
  'Allow YouTube Upload?': [7200, 0],
  'YouTube Upload Public': [7440, -120],
  'Normalize YouTube Upload': [7680, -120],
  'Post Top-Level Comment': [7920, -120],
  'Attach Comment Result': [8160, -120],
  'Skip YouTube Upload': [7440, 200],
  'Complete Reference Card': [8400, 60],
};

// 시작 동기화 노드 3개가 들어가므로 기존 본선은 오른쪽으로 같은 간격만큼 민다.
for (const position of Object.values(positions)) position[0] += 720;
Object.assign(positions, {
  'Read Reference Sheet': [240, 300],
  'Merge Sheet Into Dataset': [480, 300],
  'Apply Sheet Checklist Sync': [720, 300],
  'Mark Upload Complete In Sheet': [9360, 60],
});

const nodes = [
  createNode('Operation Note', 'n8n-nodes-base.stickyNote', 1, [-80, -260], {
    content: `## ${WORKFLOW_NAME}\n\n소재: \`research/single-screen-references/videos.jsonl\` (2,000건)\n원본 시트: \`${REFERENCE_SHEET_NAME}\`\n체크리스트: \`레퍼런스 카드/기록/사용기록.jsonl\` + 시트 \`${UPLOAD_COMPLETE_COLUMN}\`\n선별 기준: \`레퍼런스 카드/selection-gate.json\`\n\n실행 시작 때 시트 수정 내용을 JSONL에 병합하고 사용기록을 체크박스에 맞춥니다. 그 뒤 미사용 레코드 1건을 골라 재가공 문안 그대로 카드 이미지를 만들고, BGM → 5초 MP4 → YouTube 공개 업로드 → 고정 댓글 → 사용기록과 시트 체크까지 처리합니다. 가져오기만 해서는 실행되거나 게시되지 않습니다.`,
    height: 320,
    width: 940,
    color: 5,
  }),
  createNode('Gate Note', 'n8n-nodes-base.stickyNote', 1, [900, -260], {
    content: '## 선별 기준 주의\n\n데이터셋 자체 QA가 2,000건 중 `publish_ready`를 11건만 true로 두고 있습니다(`claim_risk` high 1,945건, `fact_check_required` true 1,975건). 기본 기준은 그 플래그를 존중합니다.\n\n기준을 넓히려면 `레퍼런스 카드/selection-gate.json`을 고치세요. 의학성 주제를 열 때는 약사 검수를 먼저 거치는 것을 전제로 합니다.',
    height: 320,
    width: 640,
    color: 3,
  }),
  createNode('Manual Trigger', 'n8n-nodes-base.manualTrigger', 1, [0, 300], {}),
  createNode('Read Reference Sheet', 'n8n-nodes-base.googleSheets', 4.7, positions['Read Reference Sheet'], {
    authentication: 'oAuth2',
    resource: 'sheet',
    operation: 'read',
    documentId: { __rl: true, mode: 'id', value: REFERENCE_SPREADSHEET_ID },
    sheetName: { __rl: true, mode: 'name', value: REFERENCE_SHEET_NAME },
    filtersUI: { values: [] },
    combineFilters: 'OR',
    options: {
      dataLocationOnSheet: {
        values: { rangeDefinition: 'specifyRangeA1', range: 'A1:AU2001' },
      },
      outputFormatting: {
        values: { general: 'UNFORMATTED_VALUE', date: 'FORMATTED_STRING' },
      },
      returnFirstMatch: false,
    },
  }, { credentials: GOOGLE_SHEETS_CREDENTIAL }),
  createNode('Apply Sheet Checklist Sync', 'n8n-nodes-base.httpRequest', 4.2, positions['Apply Sheet Checklist Sync'], {
    method: 'POST',
    url: `https://sheets.googleapis.com/v4/spreadsheets/${REFERENCE_SPREADSHEET_ID}:batchUpdate`,
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'googleSheetsOAuth2Api',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={{ JSON.stringify($json.sheet_batch_update) }}',
    options: {},
  }, { credentials: GOOGLE_SHEETS_CREDENTIAL }),
  createNode('Mark Upload Complete In Sheet', 'n8n-nodes-base.googleSheets', 4.7, positions['Mark Upload Complete In Sheet'], {
    authentication: 'oAuth2',
    resource: 'sheet',
    operation: 'update',
    documentId: { __rl: true, mode: 'id', value: REFERENCE_SPREADSHEET_ID },
    sheetName: { __rl: true, mode: 'name', value: REFERENCE_SHEET_NAME },
    columns: {
      mappingMode: 'defineBelow',
      value: {
        record_id: '={{ $json.reference_result.record_id }}',
        [UPLOAD_COMPLETE_COLUMN]: true,
      },
      matchingColumns: ['record_id'],
      schema: [
        {
          id: 'record_id',
          displayName: 'record_id',
          required: false,
          defaultMatch: true,
          display: true,
          type: 'string',
          canBeUsedToMatch: true,
        },
        {
          id: UPLOAD_COMPLETE_COLUMN,
          displayName: UPLOAD_COMPLETE_COLUMN,
          required: false,
          defaultMatch: false,
          display: true,
          type: 'boolean',
          canBeUsedToMatch: false,
        },
      ],
      attemptToConvertTypes: false,
      convertFieldsToString: false,
    },
    options: {
      cellFormat: 'RAW',
      locationDefine: { values: { headerRow: 1, firstDataRow: 2 } },
    },
  }, { credentials: GOOGLE_SHEETS_CREDENTIAL }),
];

for (const name of clonedNodeNames) {
  const original = sourceByName.get(name);
  if (!original) throw new Error(`Source workflow is missing node: ${name}`);
  const clone = JSON.parse(JSON.stringify(original));
  clone.id = stableUuid(`${WORKFLOW_ID}:${name}`);
  clone.position = positions[name] || original.position;
  nodes.push(clone);
}

nodes.push(
  createNode('Merge Sheet Into Dataset', 'n8n-nodes-base.code', 2, positions['Merge Sheet Into Dataset'], {
    jsCode: codeFor(mergeReferenceSheetRuntime, definition),
  }),
  createNode('Pick Reference Card', 'n8n-nodes-base.code', 2, positions['Pick Reference Card'], {
    jsCode: codeFor(pickReferenceCardRuntime, definition),
  }),
  createNode('Build Reference Pack', 'n8n-nodes-base.code', 2, positions['Build Reference Pack'], {
    jsCode: codeFor(buildReferencePackRuntime, definition),
  }),
  createNode('Blocked Reference Card', 'n8n-nodes-base.code', 2, positions['Blocked Reference Card'], {
    jsCode: codeFor(blockedReferenceCardRuntime, definition),
  }),
  createNode('Add Handle To Card Footer', 'n8n-nodes-base.code', 2, positions['Add Handle To Card Footer'], {
    jsCode: codeFor(addHandleToCardFooterRuntime, definition),
  }),
  createNode('Complete Reference Card', 'n8n-nodes-base.code', 2, positions['Complete Reference Card'], {
    jsCode: codeFor(completeReferenceCardRuntime, definition),
  }),
);

const connections = {};
function connect(from, to, output = 0) {
  connections[from] ||= { main: [] };
  while (connections[from].main.length <= output) connections[from].main.push([]);
  connections[from].main[output].push({ node: to, type: 'main', index: 0 });
}

connect('Manual Trigger', 'Read Reference Sheet');
connect('Read Reference Sheet', 'Merge Sheet Into Dataset');
connect('Merge Sheet Into Dataset', 'Apply Sheet Checklist Sync');
connect('Apply Sheet Checklist Sync', 'Load Config');
connect('Load Config', 'Pick Reference Card');
connect('Pick Reference Card', 'Build Reference Pack');
connect('Build Reference Pack', 'Medical Safety Review');
connect('Medical Safety Review', 'Medical Review Passed?');
connect('Medical Review Passed?', 'Prepare Image and BGM Payloads', 0);
connect('Medical Review Passed?', 'Blocked Reference Card', 1);
connect('Prepare Image and BGM Payloads', 'Add Handle To Card Footer');
connect('Add Handle To Card Footer', 'Use Live Image?');
connect('Use Live Image?', 'KIE Create Image Task', 0);
connect('Use Live Image?', 'Mock Image Result', 1);
connect('KIE Create Image Task', 'Normalize Image Task');
connect('Normalize Image Task', 'Wait Image 30s');
connect('Wait Image 30s', 'KIE Get Image Task');
connect('KIE Get Image Task', 'Parse Image Result');
connect('Parse Image Result', 'Image Ready?');
connect('Image Ready?', 'Use Live BGM?', 0);
connect('Image Ready?', 'Image Task Retryable?', 1);
connect('Image Task Retryable?', 'Wait Image Task Retry 30s', 0);
connect('Image Task Retryable?', 'Wait Image Retry 30s', 1);
connect('Wait Image Task Retry 30s', 'Prepare Image Task Retry');
connect('Prepare Image Task Retry', 'KIE Create Image Task');
connect('Wait Image Retry 30s', 'Prepare Image Retry Poll');
connect('Prepare Image Retry Poll', 'KIE Get Image Task Retry');
connect('KIE Get Image Task Retry', 'Parse Image Result Final');
connect('Parse Image Result Final', 'Image Ready?');
connect('Mock Image Result', 'Use Live BGM?');
connect('Use Live BGM?', 'KIE Create BGM Task', 0);
connect('Use Live BGM?', 'Mock BGM Result', 1);
connect('KIE Create BGM Task', 'Normalize BGM Task');
connect('Normalize BGM Task', 'Wait BGM 30s');
connect('Wait BGM 30s', 'KIE Get BGM Task');
connect('KIE Get BGM Task', 'Parse BGM Result');
connect('Parse BGM Result', 'BGM Ready?');
connect('BGM Ready?', 'Use Live Render?', 0);
connect('BGM Ready?', 'Wait BGM Retry 90s', 1);
connect('Wait BGM Retry 90s', 'KIE Get BGM Task Retry');
connect('KIE Get BGM Task Retry', 'Parse BGM Result Final');
connect('Parse BGM Result Final', 'Use Live Render?');
connect('Mock BGM Result', 'Use Live Render?');
connect('Use Live Render?', 'Prepare Local FFmpeg Render', 0);
connect('Use Live Render?', 'Mock Render Result', 1);
connect('Prepare Local FFmpeg Render', 'Local FFmpeg Render');
connect('Local FFmpeg Render', 'Parse Local Render Result');
connect('Parse Local Render Result', 'Read Rendered MP4');
connect('Read Rendered MP4', 'Attach Downloaded MP4');
connect('Attach Downloaded MP4', 'Allow YouTube Upload?');
connect('Allow YouTube Upload?', 'YouTube Upload Public', 0);
connect('Allow YouTube Upload?', 'Skip YouTube Upload', 1);
connect('YouTube Upload Public', 'Normalize YouTube Upload');
connect('Normalize YouTube Upload', 'Post Top-Level Comment');
connect('Post Top-Level Comment', 'Attach Comment Result');
connect('Attach Comment Result', 'Complete Reference Card');
connect('Skip YouTube Upload', 'Complete Reference Card');
connect('Mock Render Result', 'Complete Reference Card');
connect('Complete Reference Card', 'Mark Upload Complete In Sheet');

const workflow = {
  name: WORKFLOW_NAME,
  nodes,
  connections,
  active: false,
  settings: source.settings ? JSON.parse(JSON.stringify(source.settings)) : { executionOrder: 'v1' },
  id: WORKFLOW_ID,
  meta: source.meta ? JSON.parse(JSON.stringify(source.meta)) : undefined,
  tags: [],
  versionId: stableUuid(`${WORKFLOW_ID}:version`),
};

// 작업 폴더와 기본 선별 기준 파일을 만들어 둔다.
const workRoot = path.join(root, '레퍼런스 카드');
fs.mkdirSync(path.join(workRoot, '기록'), { recursive: true });
const gatePath = path.join(workRoot, definition.gateConfigFile);
if (!fs.existsSync(gatePath)) {
  fs.writeFileSync(gatePath, JSON.stringify(definition.defaultGate, null, 2) + '\n', 'utf8');
}

const outputPath = path.join(workflowDir, OUTPUT_FILE);
fs.writeFileSync(outputPath, JSON.stringify(workflow, null, 2) + '\n', 'utf8');

const missingCredentials = nodes.filter((node) => node.type === 'n8n-nodes-base.httpRequest'
  && node.parameters?.authentication === 'genericCredentialType' && !node.credentials);
console.log(JSON.stringify({
  ok: true,
  workflow: { id: workflow.id, name: workflow.name, nodes: nodes.length },
  output: outputPath,
  workRoot,
  gateFile: gatePath,
  credentialsMissing: missingCredentials.map((node) => node.name),
  kieCredentialExpected: KIE_CREDENTIAL.httpHeaderAuth.name,
}, null, 2));
