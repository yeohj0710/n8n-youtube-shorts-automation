import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const config = JSON.parse(fs.readFileSync(path.join(root, 'config/source-pipeline.json'), 'utf8'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'source-data-toolchain-'));
const bundle = path.join(temp, 'instagram_TEST123');
fs.mkdirSync(path.join(bundle, 'keyframes'), { recursive: true });

function run(file, args, cwd = root, timeout = 120000) {
  const result = spawnSync(file, args.map(String), { cwd, encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 20 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

try {
  run(config.ffmpeg_path, ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=540x960:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=16000', '-t', '4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', path.join(bundle, 'source.mp4')]);
  fs.writeFileSync(path.join(bundle, 'audio.wav'), Buffer.from('fixture'));
  fs.writeFileSync(path.join(bundle, 'caption.txt'), '뜨거운 차 안에서는 라이터 용기 내부 압력이 높아질 수 있습니다.\n', 'utf8');
  fs.writeFileSync(path.join(bundle, 'source.json'), JSON.stringify({
    schema_version: '1.0', source_id: 'instagram_TEST123', platform: 'instagram', platform_media_id: 'TEST123',
    source_url: 'https://www.instagram.com/reel/TEST123/', canonical_url: 'https://www.instagram.com/reel/TEST123/',
    creator_id: 'owned', creator_name: '운영 약사', title: '차 안 보관 주의', caption: '뜨거운 차 안에서는 라이터 용기 내부 압력이 높아질 수 있습니다.',
    duration_seconds: 4, upload_date: '2026-07-10', thumbnail_url: '', media_path: path.join(bundle, 'source.mp4').replace(/\\/g, '/'),
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(bundle, 'transcript.json'), JSON.stringify({
    schema_version: '1.0', language: 'ko', model: 'fixture', segments: [
      { id: 't0001', start: 0, end: 1.3, text: '고온에서는 라이터 용기 내부 압력이 높아질 수 있습니다' },
      { id: 't0002', start: 1.3, end: 2.6, text: '보조배터리는 열에 오래 노출되면 손상 위험이 커집니다' },
      { id: 't0003', start: 2.6, end: 4, text: '초콜릿은 녹아 시트에 얼룩과 냄새를 남길 수 있습니다' },
    ], full_text: 'fixture',
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(bundle, 'evidence.json'), JSON.stringify({ schema_version: '1.0', caption_sentences: [{ id: 'c0001', text: '뜨거운 차 안에서는 라이터 용기 내부 압력이 높아질 수 있습니다.' }], transcript_file: 'transcript.json' }, null, 2), 'utf8');
  fs.writeFileSync(path.join(bundle, 'manifest.json'), JSON.stringify({ schema_version: '1.0', source_id: 'instagram_TEST123', status: 'prepared' }, null, 2), 'utf8');

  const keyframePayload = Buffer.from(JSON.stringify({ media_path: path.join(bundle, 'source.mp4'), keyframe_dir: path.join(bundle, 'keyframes'), contact_sheet_path: path.join(bundle, 'contact-sheet.jpg'), ffmpeg_path: config.ffmpeg_path, max_frames: 8 }), 'utf8').toString('base64');
  const keyframeResult = JSON.parse(run(process.execPath, [path.join(root, 'scripts/extract-source-keyframes.mjs'), keyframePayload]));
  assert.equal(keyframeResult.frames.length, 8);
  assert.ok(fs.existsSync(path.join(bundle, 'contact-sheet.jpg')));

  fs.writeFileSync(path.join(bundle, 'content-brief.json'), JSON.stringify({
    schema_version: '1.0', source_id: 'instagram_TEST123', core_message: '뜨거운 차 안에서는 물건 자체가 열로 손상될 수 있습니다.',
    title: '차 안에 오래 두면 안 되는 물건 3', subtitle: '압력은 차량이 아니라 용기 내부에서 높아집니다', lane: '생활안전', tags: ['차량관리', '생활안전'],
    rank_items: [
      { rank: 1, name: '라이터', reason: '고온이 용기 내부 압력을 높여 파열 위험을 키웁니다', caution: '차에서 꺼내세요', evidence_ids: ['t0001', 'c0001'] },
      { rank: 2, name: '보조배터리', reason: '열에 오래 노출되면 배터리 셀이 손상될 수 있습니다', caution: '그늘에 보관하세요', evidence_ids: ['t0002'] },
      { rank: 3, name: '초콜릿', reason: '녹은 지방이 시트에 스며들어 얼룩과 냄새가 남습니다', caution: '서늘하게 옮기세요', evidence_ids: ['t0003'] }
    ],
    visual_direction: { representative_frame: 'keyframes/frame_004.jpg', composition: '차량 내부와 세 물건을 한눈에 보여주는 세로 카드', objects: ['라이터', '보조배터리', '초콜릿'], mood: '밝고 실용적인 생활 정보' }
  }, null, 2), 'utf8');

  const finalized = JSON.parse(run(process.execPath, [path.join(root, 'scripts/validate-source-bundle.mjs'), 'finalize', `--bundle=${bundle}`]));
  assert.equal(finalized.ok, true);
  const topicDir = path.join(temp, 'topics');
  const generated = JSON.parse(run(process.execPath, [path.join(root, 'scripts/source-bundle-to-topic.mjs'), `--bundle=${bundle}`, '--channel=haru_pharmacist', `--output-dir=${topicDir}`]));
  const md = fs.readFileSync(generated.topic_md, 'utf8');
  assert.match(md, /LOCKED_SOURCE_PACK=1/);
  assert.match(md, /고온이 용기 내부 압력을 높여 파열 위험을 키웁니다/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(bundle, 'manifest.json'), 'utf8')).status, 'md_ready');
  console.log('PASS: source bundle keyframes, grounding validation, and channel MD export');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
