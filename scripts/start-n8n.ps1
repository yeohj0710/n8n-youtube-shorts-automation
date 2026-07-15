$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$BinaryFolder = Join-Path $Root "binary-data"
$RenderFolder = Join-Path $Root "renders"
$DefaultFilesFolder = Join-Path $env:USERPROFILE ".n8n-files"
$Ffmpeg = "C:\Users\hjyeo\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin\ffmpeg.exe"

New-Item -ItemType Directory -Force -Path (Join-Path $Root ".n8n"), $BinaryFolder, $RenderFolder, $DefaultFilesFolder | Out-Null

$env:N8N_USER_FOLDER = $Root
$env:N8N_HOST = "localhost"
$env:N8N_PORT = "5678"
$env:N8N_PROTOCOL = "http"
$env:WEBHOOK_URL = "http://localhost:5678/"
$env:N8N_DEFAULT_BINARY_DATA_MODE = "filesystem"
$env:N8N_BINARY_DATA_STORAGE_PATH = $BinaryFolder
$env:N8N_RESTRICT_FILE_ACCESS_TO = "$DefaultFilesFolder;$RenderFolder;$Root"
$env:NODE_FUNCTION_ALLOW_BUILTIN = "crypto,child_process,fs,path"
$env:NODE_FUNCTION_ALLOW_EXTERNAL = ""
$env:FFMPEG_PATH = $Ffmpeg
$env:LOCAL_RENDER_DIR = $RenderFolder
$env:LOCAL_RENDER_SCRIPT = (Join-Path $Root "scripts\render-static-card.mjs")

Set-Location $Root

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

& "$Root\node_modules\.bin\n8n.cmd" start
