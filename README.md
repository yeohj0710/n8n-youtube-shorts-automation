# n8n Local Video Runner

Local n8n setup for the 하루건강약사 image+BGM Shorts workflow.

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

- n8n runner: `C:\dev\n8n-local`
- rendered videos: `C:\dev\n8n-local\renders`
- workflow export: `workflows\n8n_하루건강약사_수동실행.json`
- startup script: `scripts\start-n8n.ps1`
- renderer: `scripts\render-static-card.mjs`

## Commands

```powershell
npm install
npm run start
npm run import
npm run export:workflow
```

## Secrets

Do not commit credentials, n8n databases, rendered outputs, or OAuth secrets.

Required local credentials in n8n:

- `Header Auth account` for KIE API
- `YouTube account` for YouTube OAuth2 API

Use `http://localhost:5678/rest/oauth2-credential/callback` as the local OAuth redirect URI.
