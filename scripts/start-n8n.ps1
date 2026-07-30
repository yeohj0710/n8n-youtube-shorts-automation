param(
  [switch]$Import
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$BinaryFolder = Join-Path $Root "binary-data"
$RenderFolder = Join-Path $Root "renders"
$DefaultFilesFolder = Join-Path $env:USERPROFILE ".n8n-files"
# Korean paths must NOT be literals in this file. Windows PowerShell 5 reads a
# BOM-less .ps1 as ANSI, which mangles them, and the mangled string lands in
# N8N_RESTRICT_FILE_ACCESS_TO — the Read File node then fails with
# "Access to the file is not allowed". Read them from UTF-8 JSON instead.
$LocalPathsFile = Join-Path $Root "config\local-paths.json"
if (-not (Test-Path -LiteralPath $LocalPathsFile)) {
  throw "Local paths config not found: $LocalPathsFile"
}
$LocalPaths = (Get-Content -LiteralPath $LocalPathsFile -Encoding UTF8 -Raw) | ConvertFrom-Json
$CardDropFolder = $LocalPaths.cardDropFolder
if (-not $CardDropFolder) {
  throw "cardDropFolder missing from $LocalPathsFile"
}
if (-not (Test-Path -LiteralPath $CardDropFolder)) {
  throw "cardDropFolder does not exist (encoding problem?): $CardDropFolder"
}

$FallbackFfmpeg = "C:\Users\hjyeo\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin\ffmpeg.exe"
$FfmpegCommand = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($FfmpegCommand) {
  $Ffmpeg = $FfmpegCommand.Source
} elseif ($env:FFMPEG_PATH) {
  $Ffmpeg = $env:FFMPEG_PATH
} elseif (Test-Path -LiteralPath $FallbackFfmpeg) {
  $Ffmpeg = $FallbackFfmpeg
} else {
  throw "ffmpeg not found. Add ffmpeg to PATH or set FFMPEG_PATH."
}

New-Item -ItemType Directory -Force -Path (Join-Path $Root ".n8n"), $BinaryFolder, $RenderFolder, $DefaultFilesFolder | Out-Null

$env:N8N_USER_FOLDER = $Root
$env:N8N_HOST = "localhost"
$env:N8N_PORT = "5678"
$env:N8N_PROTOCOL = "http"
$env:WEBHOOK_URL = "http://localhost:5678/"
$env:N8N_DEFAULT_BINARY_DATA_MODE = "filesystem"
$env:N8N_BINARY_DATA_STORAGE_PATH = $BinaryFolder
$env:N8N_RESTRICT_FILE_ACCESS_TO = "$DefaultFilesFolder;$RenderFolder;$Root;$CardDropFolder"
$env:NODE_FUNCTION_ALLOW_BUILTIN = "crypto,child_process,fs,path"
$env:NODE_FUNCTION_ALLOW_EXTERNAL = ""
$env:FFMPEG_PATH = $Ffmpeg
$env:LOCAL_RENDER_DIR = $RenderFolder
$env:LOCAL_RENDER_SCRIPT = (Join-Path $Root "scripts\render-static-card.mjs")

Set-Location $Root

# One-time seeding only (fresh n8n DB): run with -Import, or use `npm run import`.
# Importing on every launch deactivates workflow gates and rewrites node positions.
if ($Import) {
  $CanonicalWorkflows = @(
    (Join-Path $Root "workflows\n8n_source_reel_longevity_manual.json"),
    (Join-Path $Root "workflows\n8n_source_reel_haru_manual.json")
  )
  foreach ($Workflow in $CanonicalWorkflows) {
    if (-not (Test-Path -LiteralPath $Workflow)) {
      throw "Canonical workflow file not found: $Workflow"
    }
    & "$Root\node_modules\.bin\n8n.cmd" import:workflow --input $Workflow
    if ($LASTEXITCODE -ne 0) {
      throw "Canonical workflow import failed: $Workflow"
    }
  }
}

& "$Root\node_modules\.bin\n8n.cmd" start
