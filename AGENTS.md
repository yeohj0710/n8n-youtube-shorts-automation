# n8n YouTube Shorts Automation Agent Notes

This repo is the source of truth for the user's n8n-based YouTube Shorts automation.

Primary path:

`C:\dev\n8n-youtube-shorts-automation`

Local n8n URL:

`http://localhost:5678/`

GitHub repo:

`https://github.com/yeohj0710/n8n-youtube-shorts-automation.git`

Latest known workflow:

- ID: `mxrYb3maJS31gEYC`
- Name: `하루건강약사 · 본편 (소재큐)`
- Export: `C:\dev\n8n-youtube-shorts-automation\workflows\n8n_하루건강약사_수동실행.json`
- Current shape: full-card GPT image + BGM + local ffmpeg render + YouTube public upload

## Non-Negotiables

- Do not commit secrets, tokens, OAuth client secrets, API keys, `.n8n`, SQLite DBs, `node_modules`, `renders`, `binary-data`, logs, or cache folders.
- Do not print or repeat secret values in chat or commits.
- Do not use `127.0.0.1:5678` for n8n OAuth. Use `http://localhost:5678/`.
- Do not create duplicate workflow JSON files unless explicitly asked. Fix the existing workflow/source in place.
- Do not re-import an old workflow JSON over the local DB unless intentionally resetting the user's manual node layout.
- Before editing workflow JSON, export/read the current workflow from the local DB first.
- Keep n8n Cloud and local n8n separate. Local render/upload depends on local paths and will not work in n8n Cloud without redesign.
- Do not add TTS, Veo, or Creatomate back into this workflow. User wants static ranked-card Shorts: one full 9:16 GPT image + BGM + local ffmpeg MP4.
- Do not overlay text in local ffmpeg. GPT image generation must render the final Korean title and ranked list inside the image itself.
- Ranked cards must show `1위` at the top, then `2위`, `3위`, etc. Do not sort `7위` first.
- BGM must target Korean ages 50-60: warm, calm, premium health-program mood, slow around 76 BPM, no vocals, no EDM, no heavy drums.
- Image prompt must push premium modern infographic quality: crisp Korean typography, sharp edges, high contrast, no blur, no retro/cheap clipart look.
- Default video duration is 5 seconds. Keep this short-card workflow around 4-5 seconds unless the user explicitly asks longer.
- Default YouTube upload privacy is public. Existing private videos are a public-publishing action; get explicit confirmation before changing old videos to public.
- Do not run the full workflow without considering cost and side effects. It spends KIE credits and can upload a public YouTube video.
- Do not put visible boilerplate safety copy in generated output. Avoid footer/script/description/comment text like `전문인의 조언을 받으세요`, `전문가 조언`, `진료를 대신하지 않습니다`, or generic `not medical advice` disclaimers.
- Keep internal medical safety checks for cure/guarantee/dosage/prescription-avoidance claims. Remove only the user-visible disclaimer padding.
- Pinned/top-level YouTube comment is the pack's `pinned_comment`: a short useful summary of that exact video ending with the channel's calm subscribe line, under 260 Korean characters, never a viewer question. (The old rule of posting the fixed string `좋아요와 구독 한 번씩 부탁드립니다.` was replaced by summary-style comments; the upload node posts `pinned_comment` verbatim.)

## Card Copy Rules

These are entertaining shorts for Korean adults over 50. Fun and useful is the whole bar. Do not turn them into clinical education.

- **Do not go looking for research.** Studies, papers, and public-health pages are not where topics come from. Write from ordinary life. Evidence is optional in the stockpile: `scripts\build-research-stockpile.mjs` accepts a pack with no `sources`/`facts`, and `verify-research-stockpile.mjs` only checks citations when a pack actually carries them.
- **Do not narrow the subject range.** The channel is the whole life of an adult over 50, not "be careful at home." Rotate across appliances and manuals, groceries and cooking, money and bank errands, hospital and pharmacy visits, family and relationships, clothing, phones, cars, season and home. If two queued topics sit in the same corner, the range has collapsed — that is the failure mode to watch for.
- **Every row must carry a takeaway — the "나도 알지" test.** Read each row as a 55-year-old and ask whether they would say "그건 나도 알지". If every row fails to teach something — a surprising cause, a nameable trick, a specific place/time/function — the topic ships nothing and must be killed, not padded. The published 장롱 위 물건 카드 (의자는 흔들려서 위험해요, 어두우면 헛짚어요) failed exactly this way: five rows of common sense, zero takeaways. The AI reviewer now judges prepared packs too (COMMON_KNOWLEDGE_V1), and a rejected prepared pack STOPS the run with PREPARED_PACK_REJECTED rather than being regenerated — so a takeaway-free topic wastes a run and jams the queue until fixed. Apply the test at writing time anyway. Good takeaways from this repo: 얼린 두부는 고기처럼 쫄깃해진다, 빨래 냄새는 세탁조 탓, 은행 점심시간엔 창구가 준다.
- **Prepared packs leave `description`/`pinned_comment` empty.** The Build node's prepared-pack normalizer fills both from the rank items BEFORE the quality gate — the description gets the full 1위-N위 list, and the pinned comment gets the ranked summary ending with the subscribe CTA — so the AI reviewer audits the real copy. Supplying a hand-written one-liner in the pack SUPPRESSES that builder and ships a summary-free description; and building only at the Prepare stage is too late, because the reviewer rejects an empty pinned_comment (this actually stopped a run).
- **Prepared-pack titles must hook, not label.** The generation path enforces `ATTENTION_PROMISE_V2`/`HOOK_PATTERNS`, but a prepared pack renders its `hook_title` verbatim with no reviewer — so writing a descriptive label there ships a weak title unchecked. Use the channel's proven shapes (belief reversal, loss frame, minimal-condition gain `~만 해도`, insider reveal, head-to-head, moment trigger) and only promise what the items actually deliver. `양말 신을 때 몸이 알려주는 것 5` is a filing label; `양말 신는 몇 초 동안 다 드러나는 몸의 신호 5` is the same list written as a hook.
- **Clarity outranks brevity, and the ceilings went up (2026-08-04).** `card_name` may run to 40 characters and `card_reason` to 90. They are ceilings, not targets. Never trim a line until the subject, the object, or the consequence disappears — a sentence the reader has to decode has failed at any length. A `card_reason` must make sense read alone, without its `card_name` and without the title. Queued copy written under the old 30/60 caps read as compressed telegrams (넓은 손잡이 — of what?; 어두운 계단은 넘어지는 값이 더 커요) and had to be rewritten.
- **No subtitle on the card (2026-08-04).** The image prompt no longer carries a `SUBTITLE:` line in any circuit. Subtitles mostly restated the title, and the line they occupied squeezed the rows that carry the actual content. `pack.subtitle` still exists and still feeds the YouTube description, so the writer keeps producing one — it just is not drawn. The rule lives in `simplify-legacy-editorial-flow.mjs` (NO_CARD_SUBTITLE_V1) and in the shared layout lines in `lib/safe-zone.mjs`, which now tell the model not to invent a second line under the title.
- **card_name takes the grammatical form of its role — never force ~하기 on everything.** An action or mistake reads naturally as ~하기 (다리 꼬고 재기). A signal or phenomenon is a 관형형 noun phrase (한참 안 없어지는 양말 자국); a check-list item may use ~는지 (한쪽 귀만 나빠진 건 아닌지); an object is the bare noun. Nominalizing a full clause with its subject attached — 자국이 오래 남기, 주변이 시끄럽기 — is broken Korean, and the gate now blocks it deterministically (`broken_nominalization`). A published sock-signals card shipped five of these before the check existed.
- **No demonstratives standing in for the thing.** `그것`, `이때`, `이렇게`, `그때 그 도장`, `그 물건` — name the actual thing instead. A bare comparative with nothing to compare to (`오를 때보다 내려올 때가 커요`) is the same defect: say what is bigger.
- **Use the word people say, not the word a manual prints (2026-08-04).** The precise term is the wrong term when nobody says it aloud. 손아귀 → 손힘, 상온 → 그냥 두면/밖에 두면, 단면 → 자른 자리, 눈금 → 숫자, 기한 → 날짜, 섭취/유의/권장/실시 → 먹다/보다/권하다. Read the line as one 60-year-old talking to another at the kitchen table; if it sounds like a label on a box, rewrite it. Enforced as `SPOKEN_WORDS_ONLY_V1` in the writer contract and as a `translationese_copy` ground in the gate reviewer.
- **Active voice. No 수동형, no ~게 되다 (2026-08-04).** Name who or what does the thing: 목이 꺾인 자세로 자게 돼요 → 고개가 꺾인 채로 자요; 상자째 베란다로 밀려나요 → 상자째 베란다로 내놔요; 아래쪽이 눌려서 → 위에 쌓인 무게를 받으면. Passives Korean genuinely says (문이 닫혀요) are fine — the test is whether a speaker would pick that form, not whether it parses. `ACTIVE_VOICE_ONLY_V1`.
- **No metaphor or roundabout phrasing.** Say the object, the action, and the result plainly. `키운 소리가 귀를 또 깎아요` reads as poetry and loses the point; `크게 오래 들으면 귀가 더 나빠져서 또 키우게 돼요` says it.
- **Dignified professional voice.** Both channels speak as a courteous professional in their fifties — a pharmacist or specialist — addressing viewers of the same generation as respected peers. Polite 해요체 with honorific 시 for viewer actions (살펴보세요, 확인해 보세요). Never chatty endings: 거든요, 잖아요, clipped ~죠. No slang, no exclamation marks. The test: would that professional say this line to a customer they respect?
- **Write spoken Korean, not translated Korean.** Four habits make copy read as English wearing Korean words, and all four have shown up in this repo:
  - *Subjects Korean drops.* English needs a subject in every clause and the habit survives translation. `두 식구가 큰 통을 다 쓰기 전에 냄새가 변해요` → `큰 통은 다 쓰기도 전에 냄새부터 변해 버려요`.
  - *Inanimate things driving transitive verbs.* `소음이 말소리를 덮어요` is English word order. Korean says `환풍기랑 물소리 때문에 말이 안 들려요`. Same for `먼지가 렌즈를 긁어요` → `먼지에 긁혀서`.
  - *One sentence shape all the way down.* The if-then 조건절 is the usual culprit. Mix in 대조 (`~는데`, `~지만`), plain statements, cause (`~어서`), and endings like `~거든요` / `~잖아요`. The shared gate enforces this: `monotonous_sentence_shape` fires when one marked construction covers 80% or more of the ranks. Plain statements are exempt — they are the neutral default and repeat harmlessly.
  - *Stacked passives.* Prefer an active verb where Korean has one.
  To check a queue quickly, count how many `card_reason` lines contain `면 `. Above roughly a third of the list and it will read translated.
- Items default to 5, with 4 to 7 allowed. If only three hold up, change the topic rather than padding. Never split one fact across two ranks, and never add a meta item about attitude (`어렵다는 생각`).
- Visible copy uses 해요체. `합니다`/`습니다` endings trip `channel_tone_mismatch` in the shared gate.
- Contract markers live in the canonical scripts: `PLAIN_MEANING_V1` and `NO_FIGURATIVE_COPY_V1` in both `install-shared-content-quality-gate.mjs` (reviewer rules L2/L3) and `simplify-legacy-editorial-flow.mjs` (writer prompt). Edit them there, then run install before simplify.

## Important Paths

### Instagram handoff

- Automation root: `G:\내 드라이브\영상 편집\AI 크리에이터\인스타그램 자동화`
- URL entry point: `G:\내 드라이브\영상 편집\AI 크리에이터\인스타그램 자동화\scripts\prepare-instagram.ps1`
- n8n staging script: `G:\내 드라이브\영상 편집\AI 크리에이터\인스타그램 자동화\scripts\stage-instagram-package.mjs`
- Prepared Reel folders: `G:\내 드라이브\영상 편집\AI 크리에이터\인스타그램 업로드용`
- The reference-card circuit stages the already-rendered MP4 after a successful YouTube upload. It does not publish to Instagram.
- A staging failure after YouTube upload must be recorded as `failed_after_youtube_upload` and must not cause another YouTube upload.
- Reuse an existing folder when its `metadata.json` has the same YouTube video ID. Do not create duplicate handoff folders.
- Instagram `공유` is a separate public-publishing action. Do not trigger it from this n8n circuit without explicit user approval and an authenticated Meta publishing setup.

- Runner root: `C:\dev\n8n-youtube-shorts-automation`
- n8n user folder: `C:\dev\n8n-youtube-shorts-automation\.n8n`
- n8n DB: `C:\dev\n8n-youtube-shorts-automation\.n8n\database.sqlite`
- Render outputs: `C:\dev\n8n-youtube-shorts-automation\renders`
- Binary storage: `C:\dev\n8n-youtube-shorts-automation\binary-data`
- Startup script: `C:\dev\n8n-youtube-shorts-automation\scripts\start-n8n.ps1`
- Hidden startup launcher: `C:\dev\n8n-youtube-shorts-automation\scripts\start-n8n-hidden.vbs`
- Renderer: `C:\dev\n8n-youtube-shorts-automation\scripts\render-static-card.mjs`
- Shorts card derivation — makes the `(유튜브 9x16)` card from the `(인스타 4x5)` one: `scripts\derive-shorts-card.mjs`. GPT Image flattens per-edge margins into one uniform inset, so it will not reserve the 22% bottom band a 9:16 card needs; five prompt attempts failed the same way. The 9:16 is composited, not generated.
- Dead-zone single source of truth (margin table, prompt coordinates, content measurement, render-time fit): `scripts\lib\safe-zone.mjs`
- Card safe-zone check (draws the dead-zone bands onto a copy in `검수\`): `scripts\preview-card-safe-zone.mjs`
- Card safe-zone fix (shrinks the card inside the dead zones, backs the original up to `보정전\`): `scripts\enforce-card-safe-zone.mjs`
- Both scripts, `derive-shorts-card.mjs`, the renderer, and every image prompt read the table from `lib\safe-zone.mjs`. Never copy the numbers.
- 하루건강약사 topic drop folder: `C:\dev\n8n-youtube-shorts-automation\하루건강약사 소재`
- 건강장수비결 topic drop folder: `C:\dev\n8n-youtube-shorts-automation\건강장수비결 소재`
- Used topic archive: each drop folder's `사용완료`
- Topic/upload logs: each drop folder's `기록`
- Reference-card circuit builder: `scripts\build-reference-card-workflow.mjs` (verify with `scripts\verify-reference-card-workflow.mjs`)
- Reference-card work folder / checklist: `레퍼런스 카드\기록\사용기록.jsonl`
- Workflow export script: `C:\dev\n8n-youtube-shorts-automation\scripts\export-workflow-from-db.mjs`
- Workflow import script: `C:\dev\n8n-youtube-shorts-automation\scripts\import-workflow.ps1`
- Original user folder: `G:\내 드라이브\영상 편집\유튜브 닌자`
- Saved YouTube OAuth client secret note: `G:\내 드라이브\영상 편집\유튜브 닌자\etc\youtube_oauth_client_secret.txt`

## Commands

Run from `C:\dev\n8n-youtube-shorts-automation`.

```powershell
npm install
npm run start
npm run export:workflow
npm run import
git status --short --branch
```

Check local n8n:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:5678/rest/settings' -TimeoutSec 20
```

Restart local n8n without touching workflow layout:

```powershell
$procs = Get-CimInstance Win32_Process -Filter "name='node.exe'" |
  Where-Object {
    $_.CommandLine -like '*C:\dev\n8n-youtube-shorts-automation\node_modules*\n8n*start*' -or
    $_.CommandLine -like '*C:\dev\n8n-youtube-shorts-automation\node_modules\@n8n\task-runner*'
  }
$procs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Process -FilePath 'wscript.exe' -ArgumentList '"C:\dev\n8n-youtube-shorts-automation\scripts\start-n8n-hidden.vbs"' -WindowStyle Hidden
```

If port-kill is needed, do not use `$PID` as a loop variable in PowerShell. It is reserved.

```powershell
$procIds = Get-NetTCPConnection -LocalPort 5678 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique
foreach ($procId in $procIds) {
  Stop-Process -Id $procId -Force
}
```

## Runtime Environment

`scripts\start-n8n.ps1` must set these:

```powershell
$env:N8N_USER_FOLDER = $Root
$env:N8N_HOST = "localhost"
$env:N8N_PORT = "5678"
$env:N8N_PROTOCOL = "http"
$env:WEBHOOK_URL = "http://localhost:5678/"
$env:N8N_DEFAULT_BINARY_DATA_MODE = "filesystem"
$env:N8N_BINARY_DATA_STORAGE_PATH = $BinaryFolder
$env:N8N_RESTRICT_FILE_ACCESS_TO = "$DefaultFilesFolder;$RenderFolder;$Root"
$env:NODE_FUNCTION_ALLOW_BUILTIN = "crypto,child_process,fs,path"
$env:FFMPEG_PATH = $Ffmpeg
$env:LOCAL_RENDER_DIR = $RenderFolder
$env:LOCAL_RENDER_SCRIPT = (Join-Path $Root "scripts\render-static-card.mjs")
```

Known ffmpeg path:

`C:\Users\hjyeo\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin\ffmpeg.exe`

## Workflow Flow

Expected path:

1. Manual Trigger
2. Load Config
3. Fetch Health RSS
4. Build Viral Rank Pack Request
5. KIE Claude text pack or mock pack
6. Medical Safety Review
7. Prepare Image and BGM Payloads
8. KIE image generation
9. KIE BGM generation
10. Local ffmpeg full-card image render
11. Read rendered MP4 from disk
12. YouTube public upload
13. Optional top-level comment
14. Final result

Do not reintroduce:

- TTS path
- Veo video-generation path
- Creatomate render path

## Credentials

Credentials live in the local n8n DB, not in git.

Expected local credentials:

- KIE: `Header Auth account`, type `httpHeaderAuth`, known ID `MV5JVbdiJSoVx9O8`
- YouTube: `YouTube account`, type `youTubeOAuth2Api`, known ID `l7YqloikIKiIOtOq`

KIE Header Auth:

- Header name: `Authorization`
- Header value shape: `Bearer <KIE_API_KEY>`

YouTube OAuth:

- Redirect URI: `http://localhost:5678/rest/oauth2-credential/callback`
- Use local n8n opened at `http://localhost:5678/`
- If Google Cloud asks for security, 2-step verification may be required.
- YouTube upload itself normally does not need a paid Google Cloud service; KIE credits are the paid generation cost.

## Known Failures

### OAuth Callback `Unauthorized`

Cause:

The editor was opened at `127.0.0.1`, but Google OAuth returns to `localhost`. Browser session/cookie does not match.

Fix:

- Open `http://localhost:5678/`
- Reopen credential page through `localhost`
- Save credential
- Click `Sign in with Google` again

### YouTube `Unable to sign without access token`

Cause:

The YouTube OAuth credential exists but has no valid access token.

Fix:

- Open credential `YouTube account`
- Confirm Client ID and Client Secret are filled
- Confirm redirect URI in Google Cloud exactly matches `http://localhost:5678/rest/oauth2-credential/callback`
- Click `Sign in with Google` from local n8n via `localhost`

### KIE Claude 500 Internal Error

Cause:

KIE Claude can return HTTP 500 with `Internal error, please try again later`. This is not a credential/header problem if the error is 500. The workflow used to stop at `KIE Claude Generate Pack` before image/BGM/render.

Fix:

- `KIE Claude Generate Pack` has `retryOnFail=true`, `maxTries=3`, `waitBetweenTries=10000`, and `continueOnFail=true`.
- `Parse KIE Claude Pack` must throw on auth errors, but for recoverable 429/5xx/internal/timeout errors it returns the fallback rank pack with `ai_source=mock_after_kie_claude_error`.
- Do not route this through the old `Mock Viral Rank Pack` node directly in live mode; that node intentionally throws unless dry-run.

### KIE `Unauthorized`

Cause:

Missing or malformed KIE Authorization header.

Fix:

- Confirm credential `Header Auth account`
- Header name must be `Authorization`
- Header value must be `Bearer <key>`
- Quick KIE credit checks are safe; media generation consumes credits.

### KIE Image Policy Failure

Cause:

Image prompt triggered upstream content policy.

Fix:

- Avoid cure/treatment claims, fake doctor authority, medical logos, before/after, disease claims, or impersonation.
- Keep prompt as clean Korean Shorts ranked-card final image.
- The image prompt must include the exact visible Korean title/subtitle/rank list.
- Do not ask for a blank center area or later text overlay.

### YouTube Shows `[Music]` Captions

Cause:

The workflow does not upload captions. `[Music]` is usually YouTube automatic captions or the viewer's CC setting.

Fix/limits:

- The upload node should not set `defaultLanguage`; this reduces language hints that can trigger auto-caption behavior.
- There is no reliable n8n YouTube upload-node switch to disable YouTube automatic captions globally.
- If it appears only in playback, turn CC off in the player or adjust caption settings in YouTube Studio.

### Image/BGM Not Ready

Cause:

KIE tasks can return `generating`, `PENDING`, or `TEXT_SUCCESS` after the first
wait. `TEXT_SUCCESS` means the text metadata exists; it does not mean the MP3 is
ready. On execution 252, both `streamAudioUrl` values returned HTTP 200 with a
zero-byte body while `audioUrl` was empty and `duration` was null.

Fix:

- Do not let render nodes run until `image_url` and a final BGM `audioUrl` exist.
- `Parse BGM Result` and `Parse BGM Result Final` use `BGM_FINAL_AUDIO_V1` from
  `scripts/install-media-readiness-guard.mjs`. Never accept `streamAudioUrl` or
  `sourceStreamAudioUrl` as completion; require a final state (`SUCCESS`,
  `COMPLETE`, or `COMPLETED`), a final URL, and positive track duration.
- Current BGM guard must remain:
  - `Parse BGM Result -> BGM Ready?`
  - true: `Use Live Render?`
  - false: `Wait BGM Retry 90s -> KIE Get BGM Task Retry -> Parse BGM Result Final`
- If final retry still has no final URL, use `assets/fallback-bgm.mp3` before render.
- `Local FFmpeg Render` uses asynchronous child-process execution
  (`RENDER_ASYNC_SPAWN_V1`) so the n8n task runner can send heartbeat messages
  during downloads and ffmpeg. Do not restore synchronous child-process waiting.
- `render-static-card.mjs` rejects a zero-byte image or audio response before
  starting ffmpeg.

### KIE BGM `task id cannot be empty`

Cause:

Usually a secondary error. Check `KIE Create BGM Task` first. If it returns `422 The length of prompt cannot exceed 500 characters`, `Normalize BGM Task` gets no `taskId`, then the later GET node calls KIE with an empty taskId.

Fix:

- Keep `Prepare Image and BGM Payloads` BGM prompt under 500 characters. Current cap is 480.
- Keep `Normalize BGM Task` guard: if BGM create response has HTTP/API error or no `taskId`, throw immediately instead of polling.
- Do not diagnose this as a retry wait problem until create response has a real `taskId`.

### Medical Review Blocks Safe Sleep Content

Cause:

The dosage regex was too broad. It was meant to catch real dose text such as `3 tablets` or `1 pill`, but it false-positive matched the Korean phrase equivalent to `BEST 7, I will tell you` because `7` was followed by the first syllable of `tell`.

Fix:

- Keep dosage detection, but require a real unit boundary/suffix.
- Do not match the Korean pill unit when it is the first syllable of another normal word.
- `Medical Safety Review` now returns `issue_matches`, so inspect the exact matched substring before changing policy again.

### `Local render requires bgm_audio_url`

Cause:

`Prepare Local FFmpeg Render` got input with `bgm_audio_url=null`, usually because BGM was still `PENDING` or a middle node was run without full upstream context.

Fix:

- Full workflow run: use the BGM retry guard above.
- Middle-node run: do not execute `Prepare Local FFmpeg Render` alone unless the prior execution data contains `image_url` and `bgm_audio_url`.

### `process is not defined`

Cause:

n8n Code nodes do not expose Node's `process` object.

Fix:

- Do not use `process.env` or `process.execPath` inside workflow Code nodes.
- Use fixed paths from `Load Config`.

### `Unrecognized node type: n8n-nodes-base.executeCommand`

Cause:

This local n8n install did not recognize the Execute Command node.

Fix:

- Use Code node `Local FFmpeg Render`.
- Inside it, call `child_process.spawnSync`.
- Keep `NODE_FUNCTION_ALLOW_BUILTIN = "crypto,child_process,fs,path"` in startup env.

### `Access to the file is not allowed`

Cause:

n8n read-file nodes can only access configured paths. Rendered MP4s are under `C:\dev\n8n-youtube-shorts-automation\renders`. The 하루건강약사 image-drop folder now lives on Google Drive (`G:\내 드라이브\영상 편집\AI 크리에이터\영상 데이터\카드뉴스_이미지`), so it must be listed too.

Fix:

```powershell
$env:N8N_RESTRICT_FILE_ACCESS_TO = "$DefaultFilesFolder;$RenderFolder;$Root;$CardDropFolder"
```

Then restart n8n. `scripts\start-n8n.ps1` already sets `$CardDropFolder` to the 카드뉴스_이미지 path.

### 하루건강약사 image drop folder is on Google Drive (2026-07-22)

`하루건강약사 · 완성 이미지` claims from `G:\내 드라이브\영상 편집\AI 크리에이터\영상 데이터\카드뉴스_이미지`, the same folder where the card-news pipeline saves finished cards — so the user drops nothing by hand. That folder holds BOTH aspect ratios. The haru channel definition sets `selectShortsByAspect: true`: `Claim Next Image` reads each candidate's pixel size from the file header (PNG/JPEG/WebP, no external deps — n8n Code nodes only get builtins) and takes only files with width/height < 0.7 (9:16 = 0.5625, 4:5 = 0.80). **Filenames don't matter for haru anymore** — the user found per-file naming tedious (2026-07-30). Marker names are still respected as overrides when present: `/(4x5|4:5|인스타)/i` always excludes, `/(9x16|9:16|유튜브|쇼츠)/i` includes without sniffing. A file whose dimensions can't be parsed is excluded (safe default: never publish an unknown). The pre-aspect history: a marker-less 4:5 slipped through the exclude-only filter and would have been published, which led to a require-marker phase, which lost to naming fatigue.

Both channels feed from the same card-news pipeline as of 2026-07-30, split by a
channel folder under 40:

- 하루건강약사: `…\카드뉴스_이미지\하루건강약사`
- 건강장수비결: `…\카드뉴스_이미지\건강장수비결`
- Captions for both: `…\캡션` (flat, matched by the `NN_` number)

The split is not cosmetic. Both circuits pick a random file from their drop root,
so pointing them at one shared folder publishes 하루건강약사 cards to 건강장수비결
and back. Do not collapse these folders. The local
`C:\dev\n8n-youtube-shorts-automation\건강장수비결 이미지` folder is retired; its
README points at the new location.

건강장수비결 also sets `selectShortsByAspect`, so it takes 9:16 only and skips a
4:5 rather than blur-padding it — which is what you want now that the Instagram
twin lands in the same tree.

Claiming on Google Drive was verified on 2026-07-25 (`fs.renameSync` into `처리중` works). Aspect selection verified 2026-07-30 against the user's real files: 8 runs claimed only the 941x1672 card and never the 1122x1402 one. 건강장수비결 still uses its local `건강장수비결 이미지` folder.

Two gotchas when re-importing: run `scripts\import-workflow.ps1` (it sets `N8N_USER_FOLDER=$Root`) — calling `n8n.cmd import:workflow` bare writes to `%USERPROFILE%\.n8n` instead, and the import silently appears to succeed.

### Reference-Card Circuit: 2,000 Prepared Cards, 11 Publishable (2026-07-30)

`하루건강약사 · 레퍼런스 카드` (`haruReferenceCardShorts01`) picks one unused
record from `research\single-screen-references\videos.jsonl` and ships the user's
own `*_reworked_ko` copy verbatim — no LLM rewrite of the text. The image, BGM,
render and upload nodes are **clones** of the main workflow, so quality matches
the existing Shorts; `verify-reference-card-workflow.mjs` deep-compares those
clones against the main workflow and fails on drift. Fix the main workflow and
re-run the builder rather than editing the clones. The reference-only
`Add Handle To Card Footer` postprocessor keeps the generated source at 9:16,
adds the channel handle, and sets `reference_card_frame_mode: full_frame_9x16`
plus `safe_zone_mode: off`. The reason is that the source is already the finished
full-screen card, while its prompt still places critical text inside the shared
Shorts UI-safe coordinates. That reasoning was extended to the two image-drop
circuits on 2026-08-03 (see below); it still must not reach a circuit that
generates a card from a prompt. `Normalize Image Task` is the one adapted clone:
on its first task it must restore the base object from `Add Handle To Card Footer`,
not `Prepare Image and BGM Payloads`. Otherwise the KIE HTTP response discards
the 9:16/full-frame policy before the image and BGM branches rejoin.

**Margins here are prompt-only, on purpose (2026-08-03).** The published
`health_1785734317444` card put the title at y 68 and the footer at y 1892 —
153 px into the top band, 385 px into the bottom one. The mechanical fix would be
`safe_zone_mode: auto`, but on a full-bleed 9:16 card that lands at 0.66 scale
inside a blurred surround (measured, not estimated), and the user has ruled that
out: wrongly-shrunk frames have gone up before. So this one circuit keeps
`safe_zone_mode: off` and buys its margins with `REFERENCE_CARD_MARGIN_V1`, a
short block `Add Handle To Card Footer` appends to the **end** of the prompt.
It restates the shared box as a scene ("the top 230 px and bottom 422 px are open
background") and, most importantly, redefines the closing line as the last line of
the text block rather than a bar across the bottom of the frame — that is where
the mid-prompt `SHARED_SAFE_ZONE_V1` coordinates were losing. Nothing verifies the
model obeyed; `verify-reference-card-workflow.mjs` only checks the block survived
and is last. Judge it by looking at the rendered frames.

The closing line is also one line for every topic here: `삶에 도움 되는 지혜를 매일
하나씩 전해 드려요. 팔로우해 두시면 놓치지 않고 받아보실 수 있어요.` The main circuit
builds the card footer from `channel_editorial_profile` alone, so it stamped
`몸에 도움 되는 정보` on relationship-topic cards; the description could branch on
topic but the image could not, which put the card and its caption at odds.
`Add Handle To Card Footer` rewrites the inherited line and throws if the main
circuit's wording drifts out from under it.

The number that matters: all 2,000 rows carry reworked copy, but the dataset's own
QA marks only **11** as `publish_ready`. `claim_risk` is `high` on 1,945 and
`fact_check_required` is true on 1,975. That is not a sloppy tagger — the high-risk
rows are the medical ones (낙상, 하체 운동, 시니어 건강) and the 11 ready ones are
lifestyle (요리, 관계, 예절). The default gate respects those flags, so the circuit
has 11 videos of runway before it refuses to pick.

Widening the gate is a content-safety decision, not a code change: it lives in
`레퍼런스 카드\selection-gate.json` (`require_publish_ready`,
`allowed_claim_risk`, `allow_fact_check_required`, item-count range) and takes
effect on the next run. `Medical Safety Review` only blocks cure/guarantee/
care-avoidance phrasing; it does not check whether a claim is true.

The checklist is `레퍼런스 카드\기록\사용기록.jsonl`, keyed by `record_id`. A card
that reached render is checked off even if the upload failed — the credits are
already spent and re-picking it is worse. A card blocked by medical review is NOT
checked off. On every run the circuit first merges the `통과 영상` Sheet into
`videos.jsonl` by `record_id` without deleting or reordering local records, then
reconciles `사용기록.jsonl` into the Sheet's dedicated `AU` (`업로드 완료`) Boolean
checkbox column. After a rendered card is logged, the same row is checked
immediately. The n8n credential name is `Google Sheets account`; the workflow
must stop before selection when the Sheet read or write fails.

### Shrinking Is Banned; Margins Are Bought in the Prompt (2026-08-04)

**This supersedes the render-time enforcement described in the next section.** The
user has ruled out shrink-and-blur outright — wrongly-shrunk frames have gone up
more than once, most recently `다이어트 라면 등급표` (execution 256, 2026-08-03,
`safe_zone_mode: "auto"`, 0.66 scale with a blurred surround). Do not propose it
again. On a full-bleed 9:16 card that scale is not tunable: 0.5625 is narrower
than the 0.716 safe box, so height binds first and 0.66 is the geometric floor.

`safe_zone_mode` now defaults to `off` in `render-static-card.mjs` and in every
circuit's `Prepare Local FFmpeg Render`. Turning it back on is a per-payload,
per-circuit decision, never a default.

Margins come from two places instead:

- **`SHORTS_MARGIN_V1`** — appended to the end of the image prompt in all five
  image-generating circuits. It restates the shared box as a scene ("the top
  230 px and bottom 422 px are open background") and redefines the closing line
  as the last line of the text block rather than a bar across the frame bottom.
  That last clause is the one that mattered: the model reliably parked the footer
  at the frame edge, which is where the mid-prompt `SHARED_SAFE_ZONE_V1`
  coordinates were losing. Measured on the reference card: top-band violations
  went away, bottom-band ones did not.
- **Row count.** With the same prompt, a 7-row card lands inside the box and a
  10-row card does not — the model buys the extra rows by pushing down, not by
  shrinking type. The 본편 circuits cap at `rank_count_max` 7 and their 7/6–7/9
  frames are the best this repo has produced. The reference circuit had no cap
  (gate `max_items` 13, real records 8–13), so `render_max_items` (default 7) now
  trims from the front and rewrites the count in the title and subtitle — every
  such title carries one (`…예절 10가지`). Tightening `max_items` instead would
  leave zero candidates; all 11 publish-ready records have 8+ rows.

The policy lives in `scripts/lib/frame-margin-policy.mjs` and is applied as the
LAST step of `simplify-legacy-editorial-flow.mjs` and all three builders. Do not
apply it from an install script alone: re-running a canonical script would strip
it, and `verify-research-source-grounding.mjs` §12 fails on exactly that.
`install-frame-margin-policy.mjs` is a repair tool, not the owner.
`verify-frame-margin-policy.mjs` pins the circuit counts (7 publishing, 5
image-generating) so a new circuit cannot quietly skip the policy — which is how
the margin block ended up in 1 of 5 circuits and the shrink block in 3 of 7.

It still only checks that the wording survived. Whether the model obeyed is
visible only in the published frames.

### Dead Zones Are Enforced at Render, Not by the Prompt (2026-07-31, superseded)

Every circuit ignored the Shorts dead zones for weeks even though three of them
carried a detailed `SHARED_SAFE_ZONE_V1` block in the image prompt. The published
`health_1785475066236` frame put the title in the top band, the last two rows and
the follow CTA deep in the bottom band, and ran copy past the right-hand button
column. The card-news 9:16 output did the same. **A prompt cannot hold this
line** — the same finding `derive-shorts-card.mjs` recorded after five attempts.
Checking only that the prompt contains the block is how it stayed broken:
the text was there the whole time.

The enforcement now lives in `scripts\render-static-card.mjs`, which every
publishing circuit already routes through. It calls `fitCanvasWithSafeZone`
from `scripts\lib\safe-zone.mjs`: if the frame's content reaches into a band,
the whole frame is scaled into the critical-content box (x 54-961, y 230-1498
for 1080x1920) and the edges are filled with a strongly blurred, dimmed,
zoomed copy of the same art, so no blank strip appears. The render result
reports `safe_zone.applied / reason / scale / card`, visible in the n8n
execution output.

Three properties are deliberate:

- **The shrink is measured from the whole frame, not from the detected text
  box.** Content detection on a photographic background over- and under-reports;
  under-reporting would leave a violation, which is the one outcome that must be
  impossible. Worst case here is a card smaller than it needed to be.
- **Detection only decides whether to skip.** A frame already inside the box is
  left alone (`reason: already_inside`), so refits never stack.
- **`safe_zone_mode` in the render payload** takes `auto` (default), `fit`
  (always shrink), `off`. The three finished-card circuits set `off` — the
  reference-card one and both 완성 이미지 기반 쇼츠 — because their input is
  already a complete full-bleed 9:16 card that must fill the screen. The other
  four publishing circuits remain on `auto` unless a deliberate circuit rule says
  otherwise. The dividing line is not the channel but whether the circuit
  *generates* a card that still has to be laid out, or *claims* one that is
  already laid out. Generating circuits keep `auto`.

A 9:16 source can only reach scale 0.66 — the safe box is relatively wider than
9:16, so height binds first. That automatic fit caused execution 251 to render at
0.66 scale and the attempted 4:5 correction caused execution 253 to render at
0.84 scale, leaving blurred bands in both cases. The reference-card circuit now
requests 9:16 and forwards its explicit `off` policy through `Prepare Local
FFmpeg Render`, so the renderer preserves the complete frame at 1080x1920.

`scripts\verify-safe-zone-enforcement.mjs` (in `npm test`) checks the geometry,
that the three CLI tools import the shared table instead of copying it, that all
7 publishing circuits render through `render-static-card.mjs` and no other
script, that all 5 image-generating circuits carry the shared source prompt code
in both the JSON and the live DB, and that the fit actually lands inside the box
for full-bleed, compliant, and 4:5 inputs.
`scripts\verify-reference-card-workflow.mjs` separately enforces the intentional
reference-card exception: 9:16 generation, the full-frame policy marker, and
`safe_zone_mode: off` surviving image-task normalization, image parsing, BGM-task
normalization, BGM parsing, and finally reaching the render payload.

### Finished Cards Must Not Be Refit (2026-08-03)

`하루건강약사 · 완성 이미지` published `dnIsiR-2Pkg` (다이어트 라면 등급표)
as a card floating at two-thirds size inside a blurred surround. The circuit was
never given a `safe_zone_mode`, so `Prepare Local FFmpeg Render` fell back to
`auto`. Running the published source through `fitCanvasWithSafeZone` reproduces
it exactly: `04_다이어트 라면 등급표_.png` is 941x1672, and `auto` returns
`applied: true, reason: violation, scale: 0.6604` — matching the 0.666 measured
off the YouTube frame.

This is structural, not a bad card. A finished card is full-bleed by
construction: its artwork runs to all four edges, so content detection always
reports a band violation, and a 9:16 source is taller than the safe box, so
height binds first at 0.66. `auto` therefore shrinks **every** card this circuit
will ever claim. It is the same failure the reference-card circuit hit, and it
takes the same fix — both image-drop circuits now set
`image_drop_frame_mode: full_frame_9x16` and `safe_zone_mode: off` in
`Claim Next Image`'s config.

건강장수비결 got the change too. Both image-drop circuits claim from the same
card-news pipeline (`카드뉴스_이미지`) with `selectShortsByAspect`, so the
defect and the reasoning are identical; fixing only the channel that happened to
publish first would have left a live trap.

Margins are now bought entirely upstream, in the card-news layout. Nothing in
this repo checks that a claimed card respects the bands — `render-static-card.mjs`
no longer will. If cards start landing under the Shorts UI, fix the card-news
template, not this circuit.

`verify-image-drop-workflows.mjs` covers this as `full_frame_render_policy`. It
asserts the policy reaches `render_payload`, not merely that it appears in the
config — the reference-card circuit once lost the same flag mid-chain when
`Normalize Image Task` swapped its base object. Deleting the config line makes
the chain fall back to `auto`, which the check catches.

### Copy Comes From the Caption File, Not From Reading the Image (2026-07-30)

The 하루건강약사 image-drop circuit used to send the finished card to GPT-5.2
vision and have it write the title, description, and tags from what it could
read in the picture. That is backwards: the text already exists. The card-news
pipeline wrote `캡션\NN_제목.caption.txt` from the curated material JSON, and
the card image is a rendering of that same text. Reverse-engineering it costs a
call and loses content — the vision prompt says to omit unreadable text rather
than guess, so any item the model misreads is silently dropped from a list the
user hand-restored.

`Load Card Copy` now takes the `NN_` prefix off the claimed image filename,
finds the caption file with the same number, and parses it (title / `기준:` /
`N. [등급] 이름` or `N. 이름 (N위)` / `→ 설명` / `⚠ 주의`, stopping at the
`──────────` divider so the CTA and disclaimer block stays out). `Card Copy
Found?` then routes: found → `Build Pack From Card Copy` straight to the BGM
stage, no vision call; not found → the old `Read Claimed Image` → upload →
analyze chain unchanged. `Read Claimed Image` only ever fed the vision upload,
so it now lives on the fallback branch alone; the ffmpeg render reads
`claimed_path` directly.

Label kinds are mixed across cards and must survive verbatim: `1위 이름` for
ranks, `[S] 이름` for letter grades, `이름 (추천)` / `이름 (900mg 이상)` for
Korean grades and values. Some cards have no `→` line at all — the item name IS
the content (당뇨 신호, 영양제 조합) — which is not a defect.

Titles are used exactly as the caption has them. They are the user's curated
titles; do not append counts or rewrite them into hooks mechanically.

Description and pinned comment are assembled exactly like the main workflow's
`Build Viral Rank Pack Request` (2026-07-30, user asked for parity): rows are
`<label><name> - <reason>`, the description joins title / basis / rows / closing
with blank lines and blank lines between rows, and the pinned comment is
`오늘 영상 핵심 정리` / title / blank / one row per line / blank / closing. No
hashtag block, no em dash, and no length truncation — an earlier version packed
the rows onto one comma-separated line to fit 260 characters and it read badly.
The 260-character pinned-comment guidance above applies to the generation path's
reviewer; the prepared/caption builders do not truncate. Change the main
workflow's copy first, then mirror it here.

Both channels read captions from the same `캡션` folder — the pipeline numbers
materials in one global sequence (`01B_시작 프롬프트 - 건강장수비결 MD 생성.md`
produces 건강장수비결 material alongside haru's), so a number identifies a card
regardless of channel. The closing line is the per-channel part: haru posts the
same card to Instagram so it asks for 팔로우, 건강장수비결 is YouTube-only and
keeps 구독.

`verify-image-drop-workflows.mjs` covers this as `card_copy_from_caption`: the
branch wiring, all four label kinds, the 260-char pinned-comment cap ending in
the channel closing line, the medical-claim block, and fallback when the prefix
is missing or unknown.

### Hand-Edited Workflow JSON Silently Reverted (2026-07-25)

Cause:

`simplify-legacy-editorial-flow.mjs` regenerates the two channel workflows, so an
edit made directly in `workflows\*.json` survives only until the next run — and
Codex runs it from the shared worktree. A 팔로우 CTA edit was lost this way.

Worse, editing the generator is not always enough: several of its replacement
blocks are one-time migrations guarded by `if (!code.includes('function …'))`.
Changing a string inside such a block does nothing to an already-migrated
workflow. The channel closing lines are now rewritten outside the guard, on
every run.

Fix:

- Change copy in the generator, not in the workflow JSON.
- Check whether the block you are editing sits behind a `!code.includes(...)`
  guard. If it does, add an unconditional rewrite instead.
- Verifier assertions that match copy literally must be updated in the same
  change, or `npm test` fails on the next run.

### Workflow Node Positions Keep Moving

Cause:

Importing stale workflow JSON rewrites positions and undoes the user's manual layout cleanup.

Fix:

- Always run `npm run export:workflow` before editing workflow JSON.
- Patch the exported JSON in `workflows\`.
- Import only after the user's current DB layout is exported.
- Do not run old conversion scripts over the current layout.

### PowerShell Korean Path Mojibake

Cause:

Windows PowerShell 5 reads a BOM-less UTF-8 `.ps1` as ANSI (CP949 here), which
mangles Korean literals. This bit hard on 2026-07-30: `start-n8n.ps1` hardcoded
`$CardDropFolder = "G:\내 드라이브\...\카드뉴스_이미지"`, so
`N8N_RESTRICT_FILE_ACCESS_TO` got `G:\???쒐...` and the `Read Claimed Image`
node failed with `Access to the file is not allowed` — while listing the
mangled path in its own "Allowed paths" message, which is the tell. Note that
`Claim Next Image` succeeded first: Code nodes call `fs` directly and are not
subject to the restriction, so the run gets past claim and dies one node later
with the image already moved into `처리중`.

Fix:

- Korean paths do not go in `.ps1`. They live in `config\local-paths.json` and
  are read with `Get-Content -Encoding UTF8 | ConvertFrom-Json`.
- `start-n8n.ps1` throws if the resolved folder fails `Test-Path`, so a mangled
  path stops startup instead of surfacing later as a permissions error.
- Prefer finding `workflows\*.json` with `Get-ChildItem`.
- Node scripts can write UTF-8 Korean filenames safely.

After a failure downstream of claim, put the image back before re-running: move
`처리중\<16hex>_<name>` back to the drop folder minus the prefix and delete
`기록\image-drop-workflow.lock`. Claim self-heals after 2 hours and the lock
after 30 minutes, but there is no reason to wait.

## Inspecting Executions

n8n execution data in SQLite uses `flatted`, not plain nested JSON.

Use this pattern:

```powershell
$script = @'
const { parse } = require('flatted');
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('C:/dev/n8n-youtube-shorts-automation/.n8n/database.sqlite', sqlite3.OPEN_READONLY);
db.get('select data from execution_data where executionId=?', [5], (e, row) => {
  if (e) throw e;
  const d = parse(row.data);
  const runData = d.resultData?.runData || {};
  console.log(Object.keys(runData));
  db.close();
});
'@
$script | node -
```

Useful recent root-cause finding:

- Executions 5 and 6 reached `Parse BGM Result`
- `bgm_state` was `PENDING`
- `bgm_audio_url` was `null`
- `Prepare Local FFmpeg Render` then failed
- Fix was BGM readiness branch + retry

## Workflow QA

Run before claiming healthy:

```powershell
node --check .\scripts\render-static-card.mjs
node --check .\scripts\export-workflow-from-db.mjs
```

Code-node syntax and bad-pattern check:

```powershell
node -e "const fs=require('fs'); const path=require('path'); const p=path.join('workflows',fs.readdirSync('workflows').find(f=>f.endsWith('.json'))); const wf=JSON.parse(fs.readFileSync(p,'utf8')); const bad=[]; const processHits=[]; const executeCommandHits=[]; for(const n of wf.nodes){const c=n.parameters?.jsCode; if(c){try{new Function(c)}catch(e){bad.push({node:n.name,error:e.message})} if(c.includes('process.')) processHits.push(n.name);} if(String(n.type||'').includes('executeCommand')) executeCommandHits.push(n.name);} console.log(JSON.stringify({id:wf.id,name:wf.name,nodes:wf.nodes.length,bad,processHits,executeCommandHits,hasBgmReady:!!wf.nodes.find(n=>n.name==='BGM Ready?')},null,2)); if(bad.length||processHits.length||executeCommandHits.length||!wf.nodes.find(n=>n.name==='BGM Ready?')) process.exit(1);"
```

Expected:

- `bad` empty
- `processHits` empty
- `executeCommandHits` empty
- `hasBgmReady` true

Check no secrets:

```powershell
rg -n "GOCSPX|Bearer [A-Za-z0-9_\-.]+|AIza|client_secret|api[_-]?key" . -g "!node_modules/**" -g "!.n8n/**" -g "!renders/**" -g "!binary-data/**"
```

## Git

Multiple agents (Claude, Codex) work in this SAME worktree concurrently. Never stage by directory (`git add scripts/`, `git add workflows/`, `git add -A`): that sweeps another agent's in-progress files into your commit — it has actually happened, pushing ~3,000 lines of someone else's WIP under an unrelated commit message. Stage explicit file paths only, and read `git status` for files you did not create before every commit.

Track:

- `.gitignore`
- `AGENTS.md`
- `README.md`
- `package.json`
- `package-lock.json`
- `scripts\*.ps1`
- `scripts\*.vbs`
- `scripts\*.mjs`
- `하루건강약사 소재\README.txt`
- `하루건강약사 소재\사용완료\.gitkeep`
- `하루건강약사 소재\기록\.gitkeep`
- `건강장수비결 소재\README.txt`
- `건강장수비결 소재\사용완료\.gitkeep`
- `건강장수비결 소재\기록\.gitkeep`
- `workflows\n8n_하루건강약사_수동실행.json`

Never track:

- `.n8n\`
- `.cache\`
- `node_modules\`
- `renders\`
- `binary-data\`
- `logs\`
- `*.sqlite*`
- user-added topic files under `하루건강약사 소재\`
- user-added topic files under `건강장수비결 소재\`
- `*secret*`
- `*credential*`
- `*credentials*`

Recent known commits:

- `1866316`: baseline expanded `AGENTS.md`
- `74a8ed8`: BGM polling before local render

## User Preferences

- Answer terse and direct.
- In Korean when the user writes Korean.
- Tell the user exact clicks only when browser UI action is needed.
- Keep workflow files from multiplying.
- Preserve the user's node layout.
- Existing workflow > new workflow.
- Avoid speculative fixes. Inspect DB/workflow first.
