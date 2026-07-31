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

// 메인 워크플로우(`n8n_하루건강약사_수동실행.json`)의 `Prepare Image and BGM Payloads`와
// 글자 하나까지 같아야 한다. image_drop 쪽이 짧은 금지 목록을 쓰다가 허밍·무가사 보컬이
// 섞인 BGM이 나왔다(2026-07-30 사용자 지적). verify-image-drop-workflows.mjs가 두
// 회로의 이 문장들이 일치하는지 검사하므로, 고칠 때는 메인 쪽 원본을 먼저 고친다.
const BGM_PROFILE_POOL = [
  { id: 'intimate_felt_piano', sound_family: 'piano_solo', title: '햇살 펠트 피아노', prompt: 'Bright friendly felt piano solo, buoyant rounded melody, sunny and gently cheerful.' },
  { id: 'hopeful_acoustic_piano', sound_family: 'piano_solo', title: '희망찬 어쿠스틱 피아노', prompt: 'Uplifting acoustic piano solo, flowing major-key melody, warm, light, and optimistic.' },
  { id: 'grounded_nylon_guitar', sound_family: 'guitar_solo', title: '밝은 나일론 기타', prompt: 'Sunny nylon acoustic guitar solo, lively fingerstyle phrases, friendly and contented.' },
  { id: 'reassuring_piano_strings', sound_family: 'piano_strings', title: '기분 좋은 피아노와 현악', prompt: 'Cheerful acoustic piano with soft bowed strings, reassuring, graceful, and positive.' },
  { id: 'daylight_guitar_piano', sound_family: 'guitar_piano', title: '햇살 기타와 피아노', prompt: 'Happy nylon acoustic guitar with bright piano, warm daylight mood and easy movement.' },
  { id: 'restorative_strings_piano', sound_family: 'piano_strings', title: '산뜻한 현악과 피아노', prompt: 'Light joyful bowed strings with gentle piano, spacious, fresh, and quietly celebratory.' },
];
const BGM_CONSTRAINT_LINES = [
  'Bright, cheerful, warm, optimistic major-key instrumental background music, gently lively at about 92-106 BPM.',
  'No voice, vocals, singing, lyrics, speech, humming, choir, chant, ooh/aah, vocal chops, or wordless vocals.',
  'Allowed instruments only: felt piano, gentle acoustic piano, nylon acoustic guitar, soft bowed strings.',
  'No synth, pad, ambient wash, breathy texture, percussion, drums, brushes, marimba, mallets, electronic or fusion sounds.',
  'No dark, sad, melancholic, ominous, tense, sleepy, or minor-key mood.',
];
const BGM_NEGATIVE_TAGS = 'voice, vocals, singing, lyrics, speech, humming, choir, chant, ooh, aah, vocal chops, wordless vocals, spoken words, whispering, breathing, dark, sad, melancholic, ominous, tense, sleepy, minor key';
const BGM_SAFETY_ENVELOPE = 'bright_acoustic_zero_voice_v3';

const channels = [
  {
    key: 'haru',
    sourceWorkflowId: 'mxrYb3maJS31gEYC',
    workflowId: 'haruImageDropShorts01',
    workflowName: '하루건강약사 - 완성 이미지 기반 쇼츠',
    outputFile: 'n8n_image_drop_haru_manual.json',
    channelName: '하루건강약사',
    channelPurpose: '50대 이후 시청자가 영양, 음식, 영양제 성분, 몸 신호, 피부와 활력에 관한 선택을 이해하도록 돕는 건강정보 채널',
    // 40_카드뉴스_이미지는 두 채널 공용이라 채널 폴더로 나눈다(2026-07-30 사용자 확정).
    // 한 더미에서 둘 다 무작위로 집으면 하루건강약사 카드가 건강장수비결에 올라간다.
    dropRoot: 'G:/내 드라이브/영상 편집/AI 크리에이터/영상 데이터/40_카드뉴스_이미지/하루건강약사',
    // 채널 폴더가 비었으면 40 루트에 그냥 둔 카드도 집는다. 어느 채널로 갈지는
    // 사용자가 어느 회로를 실행하느냐로 정해진다(2026-07-30).
    fallbackDropRoot: 'G:/내 드라이브/영상 편집/AI 크리에이터/영상 데이터/40_카드뉴스_이미지',
    // 카드뉴스 파이프라인이 4:5(인스타)와 9:16(쇼츠)을 한 폴더에 저장한다.
    // 파일명 표기에 기대지 않고 이미지 픽셀 크기를 읽어 9:16만 집는다
    // (사용자가 매번 이름 붙이기 귀찮다고 함, 2026-07-30). 파일명 표기는
    // 있으면 우선 존중한다: 인스타/4x5 → 제외, 9x16/유튜브/쇼츠 → 포함.
    selectShortsByAspect: true,
    // 카드 문안의 원본. 카드뉴스 파이프라인이 소재 JSON에서 만든 사람이 읽는 산문이며
    // 이미지 파일과 `NN_` 접두어를 공유한다. 이게 있으면 vision을 안 부른다 —
    // 그림에서 글자를 역산하면 못 읽은 항목이 조용히 빠진다(2026-07-30 사용자 지적).
    captionRoot: 'G:/내 드라이브/영상 편집/AI 크리에이터/영상 데이터/50_캡션',
  },
  {
    key: 'longevity',
    sourceWorkflowId: 'baekse100Life01',
    workflowId: 'longevityImageDropShorts01',
    workflowName: '건강장수비결 - 완성 이미지 기반 쇼츠',
    outputFile: 'n8n_image_drop_longevity_manual.json',
    channelName: '건강장수비결',
    channelPurpose: '50대 이후 시청자가 식사, 운동, 수면, 혈압, 혈당과 관절을 관리해 일상 기능과 자립을 오래 지키도록 돕는 건강정보 채널',
    // 하루건강약사와 같은 카드뉴스 파이프라인을 쓴다(`01B_시작 프롬프트 - 건강장수비결
    // MD 생성.md`). 채널 폴더만 다르고 캡션은 50_캡션에 번호로 함께 들어간다.
    // 로컬 `건강장수비결 이미지` 폴더는 이제 쓰지 않는다.
    dropRoot: 'G:/내 드라이브/영상 편집/AI 크리에이터/영상 데이터/40_카드뉴스_이미지/건강장수비결',
    fallbackDropRoot: 'G:/내 드라이브/영상 편집/AI 크리에이터/영상 데이터/40_카드뉴스_이미지',
    selectShortsByAspect: true,
    captionRoot: 'G:/내 드라이브/영상 편집/AI 크리에이터/영상 데이터/50_캡션',
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

    // 같은 폴더에 인스타용 4:5 카드가 섞여 있으므로 세로 쇼츠(9:16)만 집는다.
    // 파일명에 4x5 / 4:5 / 인스타가 들어간 파일은 쇼츠 대상이 아니다.
    // selectShortsByAspect 채널은 파일명 표기 없이도 이미지 헤더에서 픽셀 크기를
    // 읽어 판정한다. 4:5=0.80, 9:16=0.5625이므로 0.7을 경계로 나눈다.
    function imageDimensions(buffer) {
      try {
        if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) {
          return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
        }
        if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
          let i = 2;
          while (i + 9 < buffer.length) {
            if (buffer[i] !== 0xff) { i += 1; continue; }
            const marker = buffer[i + 1];
            if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
              return { width: buffer.readUInt16BE(i + 7), height: buffer.readUInt16BE(i + 5) };
            }
            if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
            i += 2 + buffer.readUInt16BE(i + 2);
          }
          return null;
        }
        if (buffer.length > 30 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
          const chunk = buffer.toString('ascii', 12, 16);
          if (chunk === 'VP8X') {
            return {
              width: 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)),
              height: 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)),
            };
          }
          if (chunk === 'VP8 ') {
            return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
          }
          if (chunk === 'VP8L') {
            const bits = buffer.readUInt32LE(21);
            return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
          }
        }
      } catch (error) { /* 판정 불가 파일은 후보에서 제외 */ }
      return null;
    }

    const instagramOnly = /(4x5|4:5|인스타)/i;
    const shortsMarker = /(9x16|9:16|유튜브|쇼츠)/i;
    const selectShortsByAspect = definition.selectShortsByAspect === true;

    function shortsCandidatesIn(directory) {
      if (!fs.existsSync(directory)) return [];
      return fs.readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && supported.has(path.extname(entry.name).toLowerCase()))
        .filter((entry) => !instagramOnly.test(entry.name))
        .filter((entry) => {
          if (!selectShortsByAspect) return true;
          if (shortsMarker.test(entry.name)) return true;
          const size = imageDimensions(fs.readFileSync(path.join(directory, entry.name)));
          return size !== null && size.height > 0 && size.width / size.height < 0.7;
        })
        .map((entry) => entry.name);
    }

    // 채널 폴더를 먼저 본다. 비어 있으면 공용 루트(40_카드뉴스_이미지)에 그냥 둔
    // 카드도 집는다 — 채널 폴더로 옮기는 걸 잊어도 실행이 막히지 않게. 어느 채널로
    // 갈지는 사용자가 어느 회로를 실행하느냐로 정해지고, 집은 카드는 채널 폴더로
    // 옮겨 놓은 뒤 처리하므로 처리중·사용완료 기록은 채널 폴더에 남는다.
    let sourceDir = dropRoot;
    let candidates = shortsCandidatesIn(dropRoot);
    let adoptedFromFallback = false;
    const fallbackRoot = definition.fallbackDropRoot;
    if (!candidates.length && fallbackRoot && path.resolve(fallbackRoot) !== path.resolve(dropRoot)) {
      const fallbackCandidates = shortsCandidatesIn(fallbackRoot);
      if (fallbackCandidates.length) {
        sourceDir = fallbackRoot;
        candidates = fallbackCandidates;
        adoptedFromFallback = true;
      }
    }
    if (!candidates.length) {
      throw new Error(definition.channelName + ' 이미지 폴더에 처리할 세로(9:16) 이미지가 없습니다. ' + (selectShortsByAspect
        ? '이미지 크기를 읽어 9:16 비율만 처리하며, 파일명에 4x5·인스타가 들어간 카드는 제외됩니다: '
        : '파일명에 4x5·인스타가 들어간 카드는 제외됩니다: ') + dropRoot
        + (fallbackRoot ? ' (공용 루트도 확인했습니다: ' + fallbackRoot + ')' : ''));
    }

    const originalName = candidates[crypto.randomInt(candidates.length)];
    const sourcePath = path.join(sourceDir, originalName);
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
        claimed_from_shared_root: adoptedFromFallback,
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

// 이미지 파일명의 `NN_` 접두어로 같은 번호의 캡션 파일을 찾아 문안 원본을 읽는다.
// 찾으면 vision을 건너뛴다. 못 찾으면 card_copy=null로 두고 vision 경로로 흐른다.
function loadCardCopyRuntime(definition) {
  const fs = require('fs');
  const path = require('path');
  const base = $input.first().json;

  function emptyResult(reason) {
    return [{ json: { ...base, card_copy: null, card_copy_found: false, card_copy_skip_reason: reason } }];
  }

  const captionRoot = definition.captionRoot;
  if (!captionRoot || !fs.existsSync(captionRoot)) return emptyResult('캡션 폴더가 없습니다: ' + captionRoot);

  const prefixMatch = String(base.original_image_name || '').match(/^(\d+)[_\s-]/);
  if (!prefixMatch) return emptyResult('파일명에 NN_ 접두어가 없습니다: ' + base.original_image_name);
  const prefix = prefixMatch[1];

  const captionFile = fs.readdirSync(captionRoot)
    .filter((name) => name.toLowerCase().endsWith('.caption.txt'))
    .find((name) => {
      const own = name.match(/^(\d+)[_\s-]/);
      return own && own[1] === prefix;
    });
  if (!captionFile) return emptyResult(prefix + '번 캡션 파일을 찾지 못했습니다');

  const text = fs.readFileSync(path.join(captionRoot, captionFile), 'utf8').replace(/\r/g, '');
  const lines = text.split('\n');
  const title = (lines[0] || '').trim();
  let basis = '';
  const items = [];
  let current = null;
  for (const rawLine of lines.slice(1)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^[─-╿]+$/.test(line)) break; // 구분선 아래는 CTA·면책 블록
    if (line.startsWith('기준:')) { basis = line.replace(/^기준:\s*/, '').trim(); continue; }
    const head = line.match(/^(\d+)\.\s*(.+)$/);
    if (head) {
      if (current) items.push(current);
      let name = head[2].trim();
      let label = '';
      const bracket = name.match(/^\[([^\]]+)\]\s*(.+)$/);
      if (bracket) {
        label = bracket[1].trim();
        name = bracket[2].trim();
      } else {
        const trailing = name.match(/^(.+?)\s*\(([^()]+)\)$/);
        if (trailing) {
          name = trailing[1].trim();
          label = trailing[2].trim();
        }
      }
      current = { rank: Number(head[1]), label, name, description: '', note: '' };
      continue;
    }
    if (!current) continue;
    if (line.startsWith('→')) { current.description = line.replace(/^→\s*/, '').trim(); continue; }
    if (line.startsWith('⚠')) { current.note = line.replace(/^⚠\s*/, '').trim(); continue; }
  }
  if (current) items.push(current);

  if (!title || items.length < 2) {
    return emptyResult('캡션을 읽었지만 제목/항목이 부족합니다 (' + captionFile + ', 항목 ' + items.length + '개)');
  }

  return [{
    json: {
      ...base,
      card_copy: { title, basis, items, source_file: captionFile },
      card_copy_found: true,
      card_copy_skip_reason: '',
    },
  }];
}

// 캡션에서 읽은 문안으로 업로드용 pack을 만든다. Parse Vision Copy와 같은 모양을
// 내보내야 하며(둘 다 Use Live BGM?으로 들어간다), 원문에 없는 말은 만들지 않는다.
function buildPackFromCardCopyRuntime(definition) {
  const base = $input.first().json;
  const card = base.card_copy;
  if (!card) throw new Error('card_copy가 비어 있습니다. Card Copy Found? 분기가 잘못 연결됐습니다.');

  function clean(value) {
    return String(value || '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').replace(/[ \t]+/g, ' ').trim();
  }
  function limit(value, maxLength) {
    return Array.from(clean(value)).slice(0, maxLength).join('').trim();
  }

  // 라벨은 종류가 섞여 있다: 순위(1위), 등급(S·A·B), 수치(900mg 이상), 우리말 등급(추천).
  function headline(item) {
    const label = clean(item.label);
    const name = clean(item.name);
    if (!label) return name;
    if (/^\d+위$/.test(label)) return label + ' ' + name;
    if (/^[A-Z]{1,2}$/.test(label)) return '[' + label + '] ' + name;
    return name + ' (' + label + ')';
  }

  const title = limit(card.title, 95);
  if (title.length < 4) throw new Error('캡션 제목이 너무 짧습니다: ' + card.title);

  const descriptionRows = card.items.map((item) => {
    const parts = [headline(item)];
    if (clean(item.description)) parts.push(clean(item.description));
    const row = parts.join(' - ');
    return clean(item.note) ? row + ' (주의: ' + clean(item.note) + ')' : row;
  });

  const unsafeCopy = [title, card.basis, descriptionRows.join(' ')].join(' ');
  if (/(완치|치료\s*보장|무조건\s*(?:낫|효과)|약(?:물)?을?\s*끊|병원\s*(?:갈|에\s*갈)?\s*필요\s*(?:가\s*)?없|의사\s*(?:상담|진료)?\s*필요\s*(?:가\s*)?없)/i.test(unsafeCopy)) {
    throw new Error('캡션 문안에 치료 보장 또는 진료 회피 표현이 있어 게시를 중단했습니다.');
  }

  // 메인 워크플로우(Build Viral Rank Pack Request)의 조립 방식을 그대로 쓴다.
  // 설명: [제목, 부제, 항목들(빈 줄 구분), 마무리]를 빈 줄로 이어붙임.
  // 고정 댓글: '오늘 영상 핵심 정리' / 제목 / 빈 줄 / 항목들(한 줄씩) / 빈 줄 / 마무리.
  // 구분자는 ' - '이고 항목마다 이유를 붙인다. 한쪽만 바꾸면 두 회로 문안이 갈린다.
  const NL = '\n';
  const closing = definition.key === 'haru'
    ? '몸에 도움 되는 정보를 매일 하나씩 전해 드려요. 팔로우해 두시면 놓치지 않고 받아보실 수 있어요.'
    : '건강하게 나이 드는 습관을 매일 하나씩 전해 드려요. 구독해 두시면 놓치지 않고 받아보실 수 있어요.';
  const description = limit([
    title,
    clean(card.basis),
    descriptionRows.join(NL + NL),
    closing,
  ].filter(Boolean).join(NL + NL), 4500);
  const pinnedComment = limit(
    ['오늘 영상 핵심 정리', title, ''].concat(descriptionRows).concat(['', closing]).join(NL),
    1000,
  );

  const titleTags = title.split(/\s+/)
    .map((token) => token.replace(/[^0-9A-Za-z가-힣]/g, ''))
    .filter((token) => token.length >= 2);
  const tags = [...new Set([
    definition.channelName.replace(/\s+/g, ''),
    '건강정보',
    '시니어건강',
    '쇼츠',
    ...titleTags,
  ])].slice(0, 12);

  const visibleText = card.items.map((item) => limit(headline(item), 120)).filter(Boolean).slice(0, 12);
  const imageSummary = limit(title + (clean(card.basis) ? ' — ' + clean(card.basis) : ''), 300);

  // 메인 워크플로우와 같은 풀·같은 금지 문장을 쓴다(definition으로 주입). 프로필은
  // 이미지 해시로 골라 카드마다 달라지되 같은 이미지면 같은 곡 성격이 나온다.
  const bgmPool = definition.bgmProfiles;
  const bgmIndex = Number.parseInt(String(base.image_sha256 || '0').slice(0, 8), 16) % bgmPool.length;
  const bgmVariation = bgmPool[Number.isFinite(bgmIndex) ? bgmIndex : 0];
  const bgmPrompt = [
    'Profile ' + bgmVariation.id + ': ' + bgmVariation.prompt,
    ...definition.bgmConstraints,
  ].join(' ').replace(/\s+/g, ' ').trim().slice(0, 480);
  const bgmProfile = { ...bgmVariation, safety_envelope: definition.bgmSafetyEnvelope };

  return [{
    json: {
      ...base,
      ai_source: 'card_news_caption',
      vision_response: null,
      vision_analysis: {
        image_summary: imageSummary,
        visible_text: visibleText,
        confidence: 'high',
      },
      pack: {
        hook_title: title,
        caption: title,
        description,
        tags,
        pinned_comment: pinnedComment,
        image_summary: imageSummary,
        visible_text: visibleText,
        vision_confidence: 'high',
      },
      image_url: base.claimed_path,
      image_state: 'local_finished_image',
      image_ready: true,
      video_source_id: base.image_sha256,
      bgm_prompt: bgmPrompt,
      bgm_profile: bgmProfile,
      bgm_payload: {
        model: base.config?.kie_bgm_model || 'V5_5',
        customMode: true,
        instrumental: true,
        style: bgmPrompt,
        title: ('Bright instrumental - ' + bgmVariation.title).slice(0, 80),
        negativeTags: definition.bgmNegativeTags,
        styleWeight: 0.9,
        weirdnessConstraint: 0.1,
      },
    },
  }];
}

function parseVisionCopyRuntime(definition) {
  const base = $('Build Vision Copy Request').first().json;
  // KIE가 JSON 본문을 text/plain 등으로 돌려주면 n8n HTTP 노드가 파싱하지 않고
  // 문자열 그대로 json.data에 담아 넘긴다. 그러면 choices를 못 찾아 "분석 결과가
  // 비어 있습니다"로 죽는다 — 정작 호출은 성공했고 크레딧도 이미 쓴 상태다.
  // (2026-07-30 실제 실행에서 발생.) 그래서 문자열로 온 경우를 먼저 푼다.
  let response = $input.first().json || {};
  if (typeof response === 'string') {
    try { response = JSON.parse(response); } catch (error) { response = { data: response }; }
  }
  if (typeof response.data === 'string' && response.data.trim().startsWith('{')) {
    try { response = JSON.parse(response.data); } catch (error) { /* 아래에서 빈 응답으로 처리 */ }
  }
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

  // 메인 워크플로우와 같은 풀·같은 금지 문장을 쓴다(definition으로 주입). 프로필은
  // 이미지 해시로 골라 카드마다 달라지되 같은 이미지면 같은 곡 성격이 나온다.
  const bgmPool = definition.bgmProfiles;
  const bgmIndex = Number.parseInt(String(base.image_sha256 || '0').slice(0, 8), 16) % bgmPool.length;
  const bgmVariation = bgmPool[Number.isFinite(bgmIndex) ? bgmIndex : 0];
  const bgmPrompt = [
    'Profile ' + bgmVariation.id + ': ' + bgmVariation.prompt,
    ...definition.bgmConstraints,
  ].join(' ').replace(/\s+/g, ' ').trim().slice(0, 480);
  const bgmProfile = { ...bgmVariation, safety_envelope: definition.bgmSafetyEnvelope };

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
      bgm_profile: bgmProfile,
      bgm_payload: {
        model: base.config?.kie_bgm_model || 'V5_5',
        customMode: true,
        instrumental: true,
        style: bgmPrompt,
        title: ('Bright instrumental - ' + bgmVariation.title).slice(0, 80),
        negativeTags: definition.bgmNegativeTags,
        styleWeight: 0.9,
        weirdnessConstraint: 0.1,
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
    selectShortsByAspect: channel.selectShortsByAspect === true,
    captionRoot: channel.captionRoot || null,
    fallbackDropRoot: channel.fallbackDropRoot || null,
    bgmProfiles: BGM_PROFILE_POOL,
    bgmConstraints: BGM_CONSTRAINT_LINES,
    bgmNegativeTags: BGM_NEGATIVE_TAGS,
    bgmSafetyEnvelope: BGM_SAFETY_ENVELOPE,
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
    ...(channel.captionRoot ? [
      createNode(channel.workflowId, 'Load Card Copy', 'n8n-nodes-base.code', 2, [480, 120], {
        jsCode: codeFor(loadCardCopyRuntime, definition),
      }),
      createNode(channel.workflowId, 'Card Copy Found?', 'n8n-nodes-base.if', 1, [720, 120], {
        conditions: {
          boolean: [
            { value1: '={{$json.card_copy_found}}', value2: true },
          ],
        },
      }),
      createNode(channel.workflowId, 'Build Pack From Card Copy', 'n8n-nodes-base.code', 2, [960, 0], {
        jsCode: codeFor(buildPackFromCardCopyRuntime, definition),
      }),
    ] : []),
    createNode(channel.workflowId, 'Read Claimed Image', 'n8n-nodes-base.readWriteFile', 1, [960, 320], {
      fileSelector: "={{$('Claim Next Image').first().json.claimed_path}}",
      options: {
        dataPropertyName: 'data',
      },
    }),
    createNode(channel.workflowId, 'Upload Image for Vision', 'n8n-nodes-base.httpRequest', 4.2, [1200, 320], {
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
    createNode(channel.workflowId, 'Build Vision Copy Request', 'n8n-nodes-base.code', 2, [1440, 320], {
      jsCode: codeFor(buildVisionCopyRequestRuntime, definition),
    }),
    createNode(channel.workflowId, 'Analyze Image with GPT-5.2', 'n8n-nodes-base.httpRequest', 4.2, [1680, 320], {
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
    createNode(channel.workflowId, 'Parse Vision Copy', 'n8n-nodes-base.code', 2, [1920, 320], {
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
  // 캡션 파일에 문안 원본이 있으면 vision을 건너뛴다. 없으면 기존 vision 경로로 흐른다.
  // Read Claimed Image는 vision 업로드에만 쓰이므로 폴백 쪽에만 있으면 된다
  // (ffmpeg 렌더는 claimed_path를 직접 읽는다).
  if (definition.captionRoot) {
    connect('Claim Next Image', 'Load Card Copy');
    connect('Load Card Copy', 'Card Copy Found?');
    connect('Card Copy Found?', 'Build Pack From Card Copy', 0);
    connect('Card Copy Found?', 'Read Claimed Image', 1);
    connect('Build Pack From Card Copy', 'Use Live BGM?');
  } else {
    connect('Claim Next Image', 'Read Claimed Image');
  }
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
