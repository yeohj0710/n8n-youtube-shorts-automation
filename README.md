# n8n YouTube Shorts Automation

n8n-based YouTube Shorts automation for the 하루건강약사 and 건강장수비결 image+BGM workflows.

## 완성 이미지 넣는 곳

이미지 생성까지 직접 끝낸 경우 아래 폴더에 완성 이미지 파일을 바로 넣습니다.

- 하루건강약사: `G:\내 드라이브\여형준님\27 영상 데이터\40_카드뉴스_이미지` (카드뉴스 파이프라인이 카드를 저장하는 폴더 그대로라 따로 넣을 것이 없습니다)
- 건강장수비결: `C:\dev\n8n-youtube-shorts-automation\건강장수비결 이미지`

하루건강약사 폴더에는 인스타용 4:5 카드가 같이 들어 있으므로, 파일명에 `(유튜브 9x16)` 표기가 있는 카드만 쇼츠로 처리합니다. 표기가 없는 파일은 건너뜁니다.

지원 형식은 `.png`, `.jpg`, `.jpeg`, `.webp`이며 파일당 최대 크기는 50MB입니다. 각 채널에서 아래 회로를 한 번 실행하면 대기 이미지 중 1개를 무작위로 처리합니다.

- `하루건강약사 - 완성 이미지 기반 쇼츠`
- `건강장수비결 - 완성 이미지 기반 쇼츠`

처리 순서:

1. 회로가 이미지 1개를 `처리중`으로 옮겨 중복 처리를 막습니다.
2. KIE GPT-5.2가 이미지와 이미지 속 한글을 읽고 YouTube 제목, 본문, 태그를 만듭니다.
3. 회로가 BGM을 만들고 로컬 ffmpeg로 5초 MP4를 렌더링합니다.
4. 회로가 기존 채널별 YouTube OAuth로 영상을 공개 업로드합니다.
5. 회로가 그 영상 내용을 요약한 고정 댓글을 달고 이미지를 `사용완료`로 옮깁니다.

가져온 회로는 비활성 상태입니다. n8n에서 회로를 가져오거나 여는 것만으로는 실행 또는 공개 게시가 시작되지 않습니다. 실행 중 오류가 난 이미지는 `처리중`에 남습니다. 실행이 완전히 끝난 것을 확인했다면 직접 원래 이미지 폴더로 돌려놓을 수 있고, 2시간이 지난 파일은 다음 실행 때 자동으로 대기 폴더에 복구됩니다.

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
- Optional run inputs: `content_lane`, `visual_profile`, `bgm_profile`, `variation_seed`, `recent_titles`.

## Local Paths

- n8n runner: `C:\dev\n8n-youtube-shorts-automation`
- rendered videos: `C:\dev\n8n-youtube-shorts-automation\renders`
- workflow exports:
  - `workflows\n8n_하루건강약사_수동실행.json`
  - `workflows\n8n_geongangjangsubigyeol_manual.json`
  - `workflows\n8n_image_drop_haru_manual.json`
  - `workflows\n8n_image_drop_longevity_manual.json`
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
npm run build:image-drop
npm run verify:image-drop
```

`npm run start` launches n8n without importing any workflow JSON. On a fresh n8n DB only, seed the canonical workflows once with `npm run import` (or `.\scripts\start-n8n.ps1 -Import`); re-importing over an existing DB deactivates workflow gates and rewrites node positions.

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
