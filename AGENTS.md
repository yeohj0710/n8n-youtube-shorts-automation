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
- Name: `하루건강약사 - n8n 유튜브 쇼츠 자동화`
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
- **Every row must carry a takeaway — the "나도 알지" test.** Read each row as a 55-year-old and ask whether they would say "그건 나도 알지". If every row fails to teach something — a surprising cause, a nameable trick, a specific place/time/function — the topic ships nothing and must be killed, not padded. The published 장롱 위 물건 카드 (의자는 흔들려서 위험해요, 어두우면 헛짚어요) failed exactly this way: five rows of common sense, zero takeaways. Prepared packs skip the AI reviewer entirely, so nothing downstream catches an empty topic; this test is the author's job at writing time. Good takeaways from this repo: 얼린 두부는 고기처럼 쫄깃해진다, 빨래 냄새는 세탁조 탓, 은행 점심시간엔 창구가 준다.
- **Prepared packs leave `description`/`pinned_comment` empty.** The Prepare node builds both from the rank items when the pack supplies none: the description gets the full 1위-N위 list plus channel intro and hashtags, and the pinned comment gets the ranked summary ending with the subscribe CTA. Supplying a hand-written one-liner in the pack SUPPRESSES those builders and ships a summary-free description — that is the bug, not the fallback.
- **Prepared-pack titles must hook, not label.** The generation path enforces `ATTENTION_PROMISE_V2`/`HOOK_PATTERNS`, but a prepared pack renders its `hook_title` verbatim with no reviewer — so writing a descriptive label there ships a weak title unchecked. Use the channel's proven shapes (belief reversal, loss frame, minimal-condition gain `~만 해도`, insider reveal, head-to-head, moment trigger) and only promise what the items actually deliver. `양말 신을 때 몸이 알려주는 것 5` is a filing label; `양말 신는 몇 초 동안 다 드러나는 몸의 신호 5` is the same list written as a hook.
- **Clarity outranks brevity.** `card_name` may run to 30 characters and `card_reason` to 60, and those are ceilings, not targets. Never trim a line until the subject, the object, or the consequence disappears. A `card_reason` must make sense read alone, without its `card_name` and without the title.
- **No demonstratives standing in for the thing.** `그것`, `이때`, `이렇게`, `그때 그 도장`, `그 물건` — name the actual thing instead. A bare comparative with nothing to compare to (`오를 때보다 내려올 때가 커요`) is the same defect: say what is bigger.
- **No metaphor or roundabout phrasing.** Say the object, the action, and the result plainly. `키운 소리가 귀를 또 깎아요` reads as poetry and loses the point; `크게 오래 들으면 귀가 더 나빠져서 또 키우게 돼요` says it.
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

- Runner root: `C:\dev\n8n-youtube-shorts-automation`
- n8n user folder: `C:\dev\n8n-youtube-shorts-automation\.n8n`
- n8n DB: `C:\dev\n8n-youtube-shorts-automation\.n8n\database.sqlite`
- Render outputs: `C:\dev\n8n-youtube-shorts-automation\renders`
- Binary storage: `C:\dev\n8n-youtube-shorts-automation\binary-data`
- Startup script: `C:\dev\n8n-youtube-shorts-automation\scripts\start-n8n.ps1`
- Hidden startup launcher: `C:\dev\n8n-youtube-shorts-automation\scripts\start-n8n-hidden.vbs`
- Renderer: `C:\dev\n8n-youtube-shorts-automation\scripts\render-static-card.mjs`
- 하루건강약사 topic drop folder: `C:\dev\n8n-youtube-shorts-automation\하루건강약사 소재`
- 건강장수비결 topic drop folder: `C:\dev\n8n-youtube-shorts-automation\건강장수비결 소재`
- Used topic archive: each drop folder's `사용완료`
- Topic/upload logs: each drop folder's `기록`
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

KIE tasks can return `generating` or `PENDING` after the first wait.

Fix:

- Do not let render nodes run until `image_url` and `bgm_audio_url` exist.
- Current BGM guard must remain:
  - `Parse BGM Result -> BGM Ready?`
  - true: `Use Live Render?`
  - false: `Wait BGM Retry 90s -> KIE Get BGM Task Retry -> Parse BGM Result Final`
- If final retry still has no URL, throw a BGM-specific error before render.

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

n8n read-file nodes can only access configured paths. Rendered MP4s are under `C:\dev\n8n-youtube-shorts-automation\renders`.

Fix:

```powershell
$env:N8N_RESTRICT_FILE_ACCESS_TO = "$DefaultFilesFolder;$RenderFolder;$Root"
```

Then restart n8n.

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

Windows PowerShell 5 can misread UTF-8 Korean literals in `.ps1`.

Fix:

- Avoid hardcoding Korean filenames inside PowerShell scripts.
- Prefer finding `workflows\*.json` with `Get-ChildItem`.
- Node scripts can write UTF-8 Korean filenames safely.

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
