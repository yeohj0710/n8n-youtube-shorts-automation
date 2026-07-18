# n8n YouTube Shorts Automation

n8n-based YouTube Shorts automation for the 하루건강약사 and 건강장수비결 image+BGM workflows.

## 소재 넣는 곳

복잡한 `topics` 폴더는 더 이상 직접 쓰지 않습니다. 아래 한글 폴더에 영상 1개당 `.txt` 파일 1개를 바로 넣으면 됩니다.

- 하루건강약사: `C:\dev\n8n-youtube-shorts-automation\하루건강약사 소재`
- 건강장수비결: `C:\dev\n8n-youtube-shorts-automation\건강장수비결 소재`

동작:

- 대기 파일 중 1개를 랜덤으로 선택합니다.
- `.txt`, `.md`, `.json` 파일을 인식합니다.
- 사용한 파일은 같은 폴더의 `사용완료`로 이동합니다.
- 업로드/사용 기록은 같은 폴더의 `기록`에 남습니다.

## What It Does

- Runs n8n locally on `http://localhost:5678/`
- Generates image and BGM through KIE
- Renders a full-card GPT image into an MP4 locally with ffmpeg
- Uploads to YouTube as public through the YouTube OAuth2 credential
- Rotates content lanes, visual profiles, and calm BGM profiles per run

## Quality Rules

- The GPT image is the complete 9:16 card, including all Korean title/list text.
- The list order is `1위` first at the top.
- BGM targets Korean ages 50-60: calm, warm, premium, slow, no vocals, with rotating instrumental profiles.
- Default video duration is 5 seconds.
- Local ffmpeg does not add text overlays; it only sharpens/resizes the final image and muxes BGM.
- Generated cards pass an AI image QC gate (KIE Claude vision) that proofreads the rendered Korean text against the pack copy; garbled or incomplete cards are regenerated before upload.
- Optional run inputs: `content_lane`, `visual_profile`, `bgm_profile`, `variation_seed`, `recent_titles`, `enable_image_qc`.

## Local Paths

- n8n runner: `C:\dev\n8n-youtube-shorts-automation`
- rendered videos: `C:\dev\n8n-youtube-shorts-automation\renders`
- workflow exports:
  - `workflows\n8n_하루건강약사_수동실행.json`
  - `workflows\n8n_geongangjangsubigyeol_manual.json`
- startup script: `scripts\start-n8n.ps1`
- renderer: `scripts\render-static-card.mjs`
- topic drop folders:
  - `하루건강약사 소재`
  - `건강장수비결 소재`

## Commands

```powershell
npm install
npm run start
npm run import
npm run export:workflow
```

## Topic Queue

Preferred: put one `.txt`, `.md`, or `.json` spec file directly in the matching Korean topic folder. Specs can include just a title or a title plus ranked items. Live runs randomly choose one pending file and move it to `사용완료`. If no files exist, the workflow falls back to its hidden line queue, then to auto-topic rotation.

Daily 21:00 scheduling is wired but disabled until explicitly activated. The schedule guard checks recent YouTube uploads through the YouTube API, so manual YouTube Studio uploads count as "uploaded today".

## Owned Reel Source Pipeline

실제 로컬 경로는 Git에 포함하지 않는 `config/source-pipeline.json`에 저장합니다. 먼저 공개용 예시를 복사하고 각 경로를 현재 PC에 맞게 바꿉니다.

```powershell
Copy-Item config/source-pipeline.example.json config/source-pipeline.json
```

아래 설명에서는 원본 영상 작업 공간을 `G:\owned-media\shorts`로 가정합니다.

작업 방식:

1. `00_링크큐\links.txt`에 소유·사용 허락된 YouTube/Instagram 링크를 한 줄에 하나씩 추가합니다.
2. `npm run source:run`을 실행합니다.
3. `10_작업\<플랫폼_영상ID>` 폴더에 영상, 게시물 캡션, 메타데이터, 음성, 타임코드 전사, 근거 ID, 키프레임, 콘택트시트가 생성됩니다.
4. G 드라이브의 `00_시작 프롬프트 - 링크 데이터 준비.md`를 새 Codex 작업에 보내 `content-brief.json`을 완성합니다.
5. `01A` 또는 `01B` 프롬프트를 새 Codex 작업에 보내 원하는 채널 소재 폴더에 MD를 생성합니다.

주요 명령:

```powershell
npm run source:setup
npm run source:run
npm run source:status
node scripts/validate-source-bundle.mjs finalize --bundle="G:\owned-media\shorts\10_작업\instagram_ABC123"
node scripts/source-bundle-to-topic.mjs --bundle="G:\owned-media\shorts\10_작업\instagram_ABC123" --channel=haru_pharmacist
```

생성된 MD에는 `LOCKED_SOURCE_PACK=1`이 기록됩니다. 두 채널 n8n 워크플로는 이 표시가 있는 소재를 발견하면 RSS/주제 생성 AI를 건너뛰고 MD의 제목·순위·이유를 그대로 사용합니다. 일반 소재는 기존 생성 흐름을 유지합니다.

## Secrets

Do not commit credentials, n8n databases, rendered outputs, or OAuth secrets.

Required local credentials in n8n:

- `Header Auth account` for KIE API
- `YouTube account` for 하루건강약사
- `YouTube account 2` for 건강장수비결

Use `http://localhost:5678/rest/oauth2-credential/callback` as the local OAuth redirect URI.
