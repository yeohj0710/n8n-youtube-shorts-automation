import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const workflowDir = path.join(root, 'workflows');

const KIE_CREDENTIAL = {
  httpHeaderAuth: {
    id: 'MV5JVbdiJSoVx9O8',
    name: 'Header Auth account',
  },
};

const channels = [
  {
    key: 'haru',
    sourceWorkflowId: 'mxrYb3maJS31gEYC',
    workflowId: 'haruImageDropShorts01',
    workflowName: '하루건강약사 - 완성 이미지 기반 쇼츠',
    outputFile: 'n8n_image_drop_haru_manual.json',
    channelName: '하루건강약사',
    channelPurpose: '50대 이후 시청자가 영양, 음식, 영양제 성분, 몸 신호, 피부와 활력에 관한 선택을 이해하도록 돕는 건강정보 채널',
    dropRoot: 'C:/dev/n8n-youtube-shorts-automation/하루건강약사 이미지',
  },
  {
    key: 'longevity',
    sourceWorkflowId: 'baekse100Life01',
    workflowId: 'longevityImageDropShorts01',
    workflowName: '건강장수비결 - 완성 이미지 기반 쇼츠',
    outputFile: 'n8n_image_drop_longevity_manual.json',
    channelName: '건강장수비결',
    channelPurpose: '50대 이후 시청자가 식사, 운동, 수면, 혈압, 혈당과 관절을 관리해 일상 기능과 자립을 오래 지키도록 돕는 건강정보 채널',
    dropRoot: 'C:/dev/n8n-youtube-shorts-automation/건강장수비결 이미지',
  },
];

const clonedNodeNames = [
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

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readCanonicalWorkflow(workflowId) {
  for (const fileName of fs.readdirSync(workflowDir).filter((name) => name.endsWith('.json'))) {
    const filePath = path.join(workflowDir, fileName);
    const workflow = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (workflow.id === workflowId) return workflow;
  }
  throw new Error(`Canonical workflow not found: ${workflowId}`);
}

function claimNextImageRuntime(definition) {
  const fs = require('fs');
  const path = require('path');
  const crypto = require('crypto');
  const supported = new Map([
    ['.png', 'image/png'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.webp', 'image/webp'],
  ]);
  const dropRoot = definition.dropRoot;
  const processingDir = path.join(dropRoot, '처리중');
  const usedDir = path.join(dropRoot, '사용완료');
  const logDir = path.join(dropRoot, '기록');
  const workflowLockPath = path.join(logDir, 'image-drop-workflow.lock');
  const workflowLockTtlMs = 30 * 60 * 1000;
  const staleClaimMs = 2 * 60 * 60 * 1000;
  const maxImageBytes = 50 * 1024 * 1024;
  const token = Date.now().toString(36) + '-' + crypto.randomBytes(6).toString('hex');

  for (const directory of [dropRoot, processingDir, usedDir, logDir]) {
    fs.mkdirSync(directory, { recursive: true });
  }

  function uniquePath(directory, fileName) {
    const parsed = path.parse(fileName);
    let candidate = path.join(directory, fileName);
    let counter = 2;
    while (fs.existsSync(candidate)) {
      candidate = path.join(directory, parsed.name + '-' + counter + parsed.ext);
      counter += 1;
    }
    return candidate;
  }

  function releaseOwnedLock() {
    try {
      if (!fs.existsSync(workflowLockPath)) return;
      const current = JSON.parse(fs.readFileSync(workflowLockPath, 'utf8'));
      if (current.token === token) fs.unlinkSync(workflowLockPath);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  if (fs.existsSync(workflowLockPath)) {
    let stale = false;
    try {
      const current = JSON.parse(fs.readFileSync(workflowLockPath, 'utf8'));
      stale = Date.now() - Date.parse(current.acquired_at || 0) > workflowLockTtlMs;
    } catch (error) {
      stale = Date.now() - fs.statSync(workflowLockPath).mtimeMs > workflowLockTtlMs;
    }
    if (stale) fs.unlinkSync(workflowLockPath);
    else throw new Error('이미지 회로가 이미 실행 중입니다. 현재 실행이 끝난 뒤 다시 실행하세요.');
  }

  const lockHandle = fs.openSync(workflowLockPath, 'wx');
  try {
    fs.writeFileSync(lockHandle, JSON.stringify({ token, acquired_at: new Date().toISOString() }), 'utf8');
  } finally {
    fs.closeSync(lockHandle);
  }

  try {
    for (const entry of fs.readdirSync(processingDir, { withFileTypes: true })) {
      if (!entry.isFile() || !supported.has(path.extname(entry.name).toLowerCase())) continue;
      const claimedPath = path.join(processingDir, entry.name);
      if (Date.now() - fs.statSync(claimedPath).mtimeMs <= staleClaimMs) continue;
      fs.renameSync(claimedPath, uniquePath(dropRoot, entry.name.replace(/^[a-f0-9]{16}_/, '')));
    }

    const candidates = fs.readdirSync(dropRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && supported.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => entry.name);
    if (!candidates.length) {
      throw new Error(definition.channelName + ' 이미지 폴더에 처리할 PNG, JPG, JPEG 또는 WebP 파일이 없습니다: ' + dropRoot);
    }

    const originalName = candidates[crypto.randomInt(candidates.length)];
    const sourcePath = path.join(dropRoot, originalName);
    const stat = fs.statSync(sourcePath);
    if (!stat.size) throw new Error('빈 이미지 파일은 처리할 수 없습니다: ' + sourcePath);
    if (stat.size > maxImageBytes) throw new Error('이미지 파일이 50MB를 초과합니다: ' + sourcePath);

    const extension = path.extname(originalName).toLowerCase();
    const sha256 = crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');
    const claimedName = sha256.slice(0, 16) + '_' + originalName;
    const claimedPath = uniquePath(processingDir, claimedName);
    fs.renameSync(sourcePath, claimedPath);

    const dryRun = false;
    return [{
      json: {
        config: {
          channel_name: definition.channelName,
          drop_root: dropRoot,
          processing_dir: processingDir,
          used_dir: usedDir,
          image_log_path: path.join(logDir, '이미지처리기록.jsonl'),
          upload_log_path: path.join(logDir, '업로드기록.jsonl'),
          workflow_lock_path: workflowLockPath,
          workflow_lock_token: token,
          dry_run: dryRun,
          test_mode: dryRun,
          use_live_bgm: !dryRun,
          use_live_render: !dryRun,
          allow_youtube_upload: !dryRun,
          youtube_privacy_status: 'public',
          youtube_category_id: '27',
          region_code: 'KR',
          duration_seconds: 5,
          kie_bgm_model: 'V5_5',
          poll_interval_seconds: 30,
          bgm_retry_wait_seconds: 90,
          local_render_dir: 'C:/dev/n8n-youtube-shorts-automation/renders',
          local_render_script: 'C:/dev/n8n-youtube-shorts-automation/scripts/render-static-card.mjs',
          ffmpeg_path: 'C:/Users/hjyeo/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin/ffmpeg.exe',
          node_path: 'C:/Program Files/nodejs/node.exe',
        },
        channel_key: definition.key,
        channel_name: definition.channelName,
        original_image_name: originalName,
        claimed_path: claimedPath,
        image_sha256: sha256,
        image_mime_type: supported.get(extension),
        image_size_bytes: stat.size,
        vision_upload_name: definition.key + '-' + sha256.slice(0, 16) + extension,
        claimed_at: new Date().toISOString(),
      },
    }];
  } catch (error) {
    releaseOwnedLock();
    throw error;
  }
}

function buildVisionCopyRequestRuntime(definition) {
  const base = $('Claim Next Image').first().json;
  const response = $input.first().json || {};
  const imageUrl = response.data?.downloadUrl || response.data?.fileUrl || response.downloadUrl || response.fileUrl || null;
  if (response.error || !imageUrl) {
    throw new Error('KIE 임시 이미지 업로드에서 URL을 받지 못했습니다: ' + JSON.stringify(response));
  }

  const prompt = [
    'You write metadata for the Korean YouTube Shorts channel "' + definition.channelName + '".',
    'Channel purpose: ' + definition.channelPurpose + '.',
    'Analyze only the supplied finished image. Read visible Korean text carefully before writing.',
    'If the image contains a title, numbered list, ranking, comparison, or advice card, preserve its actual subject and order.',
    'Do not invent facts, medical effects, dosages, personal experience, credentials, or details that are not visible in the image.',
    'If some text is unreadable, omit it instead of guessing. Never claim a cure, guaranteed result, or that medicine or medical care is unnecessary.',
    'Write natural Korean 해요체 for adults over 50. No emoji, sales language, generic medical disclaimer, question bait, or request for comments.',
    'Return one JSON object only, without markdown or code fences.',
    'Schema:',
    '{"image_summary":"one concrete Korean sentence","visible_text":["clearly readable text only"],"youtube_title":"15-80 Korean characters, no hashtag","description":"2-4 concrete Korean sentences under 600 characters","tags":["5-10 short Korean tags without #"],"confidence":"high|medium|low"}',
  ].join('\n');

  return [{
    json: {
      ...base,
      vision_upload_response: response,
      vision_image_url: imageUrl,
      vision_request: {
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        }],
        reasoning_effort: 'medium',
        max_tokens: 1800,
      },
    },
  }];
}

function parseVisionCopyRuntime(definition) {
  const base = $('Build Vision Copy Request').first().json;
  const response = $input.first().json || {};
  let content = response.choices?.[0]?.message?.content ?? response.output_text ?? response.content ?? '';
  if (Array.isArray(content)) {
    content = content.map((part) => part?.text || part?.content || '').filter(Boolean).join('\n');
  }
  const raw = String(content || '').trim();
  if (response.error || !raw) {
    throw new Error('KIE GPT-5.2 이미지 분석 결과가 비어 있습니다: ' + JSON.stringify(response));
  }

  function clean(value) {
    return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function limit(value, maxLength) {
    return Array.from(clean(value)).slice(0, maxLength).join('').trim();
  }

  function parseJson(text) {
    const unfenced = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      return JSON.parse(unfenced);
    } catch (error) {
      const first = unfenced.indexOf('{');
      const last = unfenced.lastIndexOf('}');
      if (first < 0 || last <= first) throw error;
      return JSON.parse(unfenced.slice(first, last + 1));
    }
  }

  let parsed;
  try {
    parsed = parseJson(raw);
  } catch (error) {
    throw new Error('KIE GPT-5.2 이미지 분석 JSON을 읽지 못했습니다: ' + error.message + '; raw=' + raw.slice(0, 800));
  }

  const title = limit(parsed.youtube_title || parsed.title || parsed.caption, 95);
  let description = limit(parsed.description || parsed.body, 4200)
    .replace(/(?:^|\s)#[^\s#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (title.length < 4) throw new Error('이미지 분석 결과에 사용할 수 있는 YouTube 제목이 없습니다.');
  if (description.length < 10) description = '이미지에 담긴 ' + title + ' 내용을 차근차근 확인해 보세요.';

  const unsafeCopy = title + ' ' + description;
  if (/(완치|치료\s*보장|무조건\s*(?:낫|효과)|약(?:물)?을?\s*끊|병원\s*(?:갈|에\s*갈)?\s*필요\s*(?:가\s*)?없|의사\s*(?:상담|진료)?\s*필요\s*(?:가\s*)?없)/i.test(unsafeCopy)) {
    throw new Error('이미지 분석 문안에 치료 보장 또는 진료 회피 표현이 있어 게시를 중단했습니다.');
  }

  const parsedTags = Array.isArray(parsed.tags) ? parsed.tags : String(parsed.tags || '').split(',');
  const tags = [...new Set([
    definition.channelName.replace(/\s+/g, ''),
    '건강정보',
    '쇼츠',
    ...parsedTags.map((tag) => limit(String(tag).replace(/^#+/, ''), 30)).filter(Boolean),
  ])].slice(0, 12);
  const hashtags = ['#건강정보', '#쇼츠', '#' + definition.channelName.replace(/\s+/g, '')].join(' ');
  const finalDescription = limit(description + '\n\n' + hashtags, 4500);
  const visibleText = (Array.isArray(parsed.visible_text) ? parsed.visible_text : [])
    .map((value) => limit(value, 120))
    .filter(Boolean)
    .slice(0, 12);
  const imageSummary = limit(parsed.image_summary || title, 300);
  const confidence = ['high', 'medium', 'low'].includes(clean(parsed.confidence).toLowerCase())
    ? clean(parsed.confidence).toLowerCase()
    : 'medium';

  const profiles = [
    'Warm intimate felt piano solo, sparse rounded notes, reflective and unhurried.',
    'Gentle acoustic piano solo, flowing melody, quietly hopeful and light.',
    'Warm nylon acoustic guitar solo, smooth fingerstyle phrases, calm and grounded.',
    'Gentle acoustic piano with soft bowed strings, reassuring and steady.',
  ];
  const profileIndex = Number.parseInt(String(base.image_sha256 || '0').slice(0, 8), 16) % profiles.length;
  const bgmPrompt = [
    profiles[Number.isFinite(profileIndex) ? profileIndex : 0],
    'Premium Korean health-program mood for adults over 50, slow around 76 BPM.',
    'No voice, vocals, singing, lyrics, speech, humming, choir, percussion, drums, synth, pad, ambient wash, or electronic sounds.',
  ].join(' ').slice(0, 480);

  const pack = {
    hook_title: title,
    caption: title,
    description: finalDescription,
    tags,
    pinned_comment: '좋아요와 구독 한 번씩 부탁드립니다.',
    image_summary: imageSummary,
    visible_text: visibleText,
    vision_confidence: confidence,
  };

  return [{
    json: {
      ...base,
      ai_source: 'kie_gpt_5_2_vision',
      vision_response: response,
      vision_analysis: {
        image_summary: imageSummary,
        visible_text: visibleText,
        confidence,
      },
      pack,
      image_url: base.claimed_path,
      image_state: 'local_finished_image',
      image_ready: true,
      video_source_id: base.image_sha256,
      bgm_prompt: bgmPrompt,
      bgm_payload: {
        prompt: bgmPrompt,
        model: base.config?.kie_bgm_model || 'V5_5',
        customMode: false,
        instrumental: true,
      },
    },
  }];
}

function completeImageDropRuntime(definition) {
  const fs = require('fs');
  const path = require('path');
  const data = $input.first().json;
  const cfg = data.config || {};

  function appendJsonLine(filePath, value) {
    if (!filePath) return;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(filePath, JSON.stringify(value) + '\n', 'utf8');
  }

  function uniquePath(directory, fileName) {
    const parsed = path.parse(fileName);
    let candidate = path.join(directory, fileName);
    let counter = 2;
    while (fs.existsSync(candidate)) {
      candidate = path.join(directory, parsed.name + '-' + counter + parsed.ext);
      counter += 1;
    }
    return candidate;
  }

  function releaseWorkflowLock() {
    const lockPath = String(cfg.workflow_lock_path || '');
    const token = String(cfg.workflow_lock_token || '');
    if (!lockPath || !token) return false;
    try {
      if (!fs.existsSync(lockPath)) return false;
      const current = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      if (current.token !== token) return false;
      fs.unlinkSync(lockPath);
      return true;
    } catch (error) {
      if (error?.code === 'ENOENT') return false;
      throw error;
    }
  }

  const published = data.youtube?.skipped === false;
  const alreadyUploaded = data.upload_guard?.reason === 'already_uploaded';
  const consumeImage = published || alreadyUploaded;
  const targetDirectory = consumeImage ? cfg.used_dir : cfg.drop_root;
  let archivedPath = null;
  if (data.claimed_path && fs.existsSync(data.claimed_path)) {
    fs.mkdirSync(targetDirectory, { recursive: true });
    archivedPath = uniquePath(targetDirectory, data.original_image_name || path.basename(data.claimed_path));
    fs.renameSync(data.claimed_path, archivedPath);
  }

  const completedAt = new Date().toISOString();
  const record = {
    channel: definition.channelName,
    source_file: data.original_image_name || null,
    archived_path: archivedPath,
    image_sha256: data.image_sha256 || null,
    title: data.pack?.hook_title || null,
    image_summary: data.vision_analysis?.image_summary || null,
    vision_confidence: data.vision_analysis?.confidence || null,
    result: published ? 'published' : (alreadyUploaded ? 'already_uploaded' : 'returned_to_queue'),
    video_id: data.youtube?.video_id || null,
    url: data.youtube?.url || data.youtube?.existing_url || null,
    completed_at: completedAt,
  };
  appendJsonLine(cfg.image_log_path, record);
  if (published) {
    appendJsonLine(cfg.upload_log_path, {
      title: record.title,
      video_id: record.video_id,
      url: record.url,
      source_file: record.source_file,
      image_sha256: record.image_sha256,
      uploaded_at: completedAt,
    });
  }
  const workflowLockReleased = releaseWorkflowLock();

  return [{
    json: {
      ...data,
      result_stage: published ? 'published_from_finished_image' : (alreadyUploaded ? 'skipped_already_uploaded_image_archived' : 'not_published_image_returned'),
      image_drop: {
        consumed: consumeImage,
        archived_path: archivedPath,
        workflow_lock_released: workflowLockReleased,
        record,
      },
    },
  }];
}

function codeFor(runtime, definition) {
  return [
    `const channelDefinition = ${JSON.stringify(definition)};`,
    runtime.toString(),
    `return ${runtime.name}(channelDefinition);`,
  ].join('\n\n');
}

function createNode(workflowId, name, type, typeVersion, position, parameters, extra = {}) {
  return {
    parameters,
    id: stableUuid(`${workflowId}:${name}`),
    name,
    type,
    typeVersion,
    position,
    ...extra,
  };
}

function buildWorkflow(channel) {
  const source = readCanonicalWorkflow(channel.sourceWorkflowId);
  const definition = {
    key: channel.key,
    channelName: channel.channelName,
    channelPurpose: channel.channelPurpose,
    dropRoot: channel.dropRoot,
  };
  const positions = {
    'Use Live BGM?': [2160, 300],
    'KIE Create BGM Task': [2400, 180],
    'Normalize BGM Task': [2640, 180],
    'Wait BGM 30s': [2880, 180],
    'KIE Get BGM Task': [3120, 180],
    'Parse BGM Result': [3360, 180],
    'Mock BGM Result': [2400, 480],
    'BGM Ready?': [3600, 180],
    'Wait BGM Retry 90s': [3840, 360],
    'KIE Get BGM Task Retry': [4080, 360],
    'Parse BGM Result Final': [4320, 360],
    'Use Live Render?': [4560, 180],
    'Mock Render Result': [4800, 480],
    'Prepare Local FFmpeg Render': [4800, 120],
    'Local FFmpeg Render': [5040, 120],
    'Parse Local Render Result': [5280, 120],
    'Read Rendered MP4': [5520, 120],
    'Attach Downloaded MP4': [5760, 120],
    'Allow YouTube Upload?': [6000, 120],
    'YouTube Upload Public': [6240, 0],
    'Normalize YouTube Upload': [6480, 0],
    'Post Top-Level Comment': [6720, 0],
    'Attach Comment Result': [6960, 0],
    'Skip YouTube Upload': [6240, 300],
  };

  const nodes = [
    createNode(channel.workflowId, 'Operation Note', 'n8n-nodes-base.stickyNote', 1, [-80, -360], {
      content: `## ${channel.channelName} 완성 이미지 회로\n\n입력: \`${channel.dropRoot}\`\n\n한 번 실행하면 이미지 1개를 무작위로 골라 이미지 분석 → 문안 생성 → BGM → 5초 MP4 → YouTube 공개 업로드 → 댓글 작성 → 사용완료 보관 순서로 처리합니다. 가져오기만 해서는 실행되거나 게시되지 않습니다.`,
      height: 300,
      width: 940,
      color: 5,
    }),
    createNode(channel.workflowId, 'Credential Note', 'n8n-nodes-base.stickyNote', 1, [900, -360], {
      content: '## 필요한 자격 증명\n\n- KIE: Header Auth account\n- YouTube: 기존 채널별 OAuth 자격 증명\n\n이미지 파일은 KIE 임시 저장소에 올린 뒤 GPT-5.2가 읽습니다.',
      height: 300,
      width: 650,
      color: 4,
    }),
    createNode(channel.workflowId, 'Manual Trigger', 'n8n-nodes-base.manualTrigger', 1, [0, 120], {}),
    createNode(channel.workflowId, 'Claim Next Image', 'n8n-nodes-base.code', 2, [240, 120], {
      jsCode: codeFor(claimNextImageRuntime, definition),
    }),
    createNode(channel.workflowId, 'Read Claimed Image', 'n8n-nodes-base.readWriteFile', 1, [480, 120], {
      fileSelector: '={{$json.claimed_path}}',
      options: {
        dataPropertyName: 'data',
      },
    }),
    createNode(channel.workflowId, 'Upload Image for Vision', 'n8n-nodes-base.httpRequest', 4.2, [720, 120], {
      method: 'POST',
      url: 'https://kieai.redpandaai.co/api/file-stream-upload',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      contentType: 'multipart-form-data',
      bodyParameters: {
        parameters: [
          { parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' },
          { parameterType: 'formData', name: 'uploadPath', value: 'images/n8n-shorts-vision' },
          { parameterType: 'formData', name: 'fileName', value: "={{$('Claim Next Image').first().json.vision_upload_name}}" },
        ],
      },
      options: {},
    }, { credentials: KIE_CREDENTIAL, retryOnFail: true, maxTries: 3, waitBetweenTries: 10000 }),
    createNode(channel.workflowId, 'Build Vision Copy Request', 'n8n-nodes-base.code', 2, [960, 120], {
      jsCode: codeFor(buildVisionCopyRequestRuntime, definition),
    }),
    createNode(channel.workflowId, 'Analyze Image with GPT-5.2', 'n8n-nodes-base.httpRequest', 4.2, [1200, 120], {
      method: 'POST',
      url: 'https://api.kie.ai/gpt-5-2/v1/chat/completions',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.vision_request) }}',
      options: {},
    }, { credentials: KIE_CREDENTIAL, retryOnFail: true, maxTries: 3, waitBetweenTries: 10000 }),
    createNode(channel.workflowId, 'Parse Vision Copy', 'n8n-nodes-base.code', 2, [1440, 120], {
      jsCode: codeFor(parseVisionCopyRuntime, definition),
    }),
  ];

  for (const nodeName of clonedNodeNames) {
    const sourceNode = source.nodes.find((node) => node.name === nodeName);
    if (!sourceNode) throw new Error(`${source.name}: required node missing: ${nodeName}`);
    const node = deepClone(sourceNode);
    node.id = stableUuid(`${channel.workflowId}:${nodeName}`);
    node.position = positions[nodeName];
    if (nodeName === 'Post Top-Level Comment') {
      node.continueOnFail = true;
      node.onError = 'continueRegularOutput';
    }
    nodes.push(node);
  }

  nodes.push(createNode(channel.workflowId, 'Complete Image Drop', 'n8n-nodes-base.code', 2, [7200, 120], {
    jsCode: codeFor(completeImageDropRuntime, definition),
  }));

  const connections = {};
  function connect(from, to, output = 0) {
    connections[from] ||= { main: [] };
    while (connections[from].main.length <= output) connections[from].main.push([]);
    connections[from].main[output].push({ node: to, type: 'main', index: 0 });
  }

  connect('Manual Trigger', 'Claim Next Image');
  connect('Claim Next Image', 'Read Claimed Image');
  connect('Read Claimed Image', 'Upload Image for Vision');
  connect('Upload Image for Vision', 'Build Vision Copy Request');
  connect('Build Vision Copy Request', 'Analyze Image with GPT-5.2');
  connect('Analyze Image with GPT-5.2', 'Parse Vision Copy');
  connect('Parse Vision Copy', 'Use Live BGM?');
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
  connect('Attach Comment Result', 'Complete Image Drop');
  connect('Skip YouTube Upload', 'Complete Image Drop');
  connect('Mock Render Result', 'Complete Image Drop');

  return {
    id: channel.workflowId,
    name: channel.workflowName,
    active: false,
    nodes,
    connections,
    settings: {
      executionOrder: 'v1',
      binaryMode: 'separate',
    },
    staticData: null,
    pinData: {},
    versionId: stableUuid(`${channel.workflowId}:version`),
    triggerCount: 0,
  };
}

fs.mkdirSync(workflowDir, { recursive: true });
const results = [];
for (const channel of channels) {
  const workflow = buildWorkflow(channel);
  const outputPath = path.join(workflowDir, channel.outputFile);
  fs.writeFileSync(outputPath, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
  results.push({
    id: workflow.id,
    name: workflow.name,
    nodes: workflow.nodes.length,
    output: outputPath,
  });
}

console.log(JSON.stringify({ ok: true, workflows: results }, null, 2));
