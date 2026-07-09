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
- Optional run inputs: `content_lane`, `visual_profile`, `bgm_profile`, `variation_seed`, `recent_titles`.

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

## Secrets

Do not commit credentials, n8n databases, rendered outputs, or OAuth secrets.

Required local credentials in n8n:

- `Header Auth account` for KIE API
- `YouTube account` for 하루건강약사
- `YouTube account 2` for 건강장수비결

Use `http://localhost:5678/rest/oauth2-credential/callback` as the local OAuth redirect URI.
