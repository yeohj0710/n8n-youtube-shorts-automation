param(
  [string]$Workflow = ""
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
if (-not $Workflow) {
  $Workflow = Join-Path $Root "workflows\n8n_하루건강약사_수동실행.json"
}

if (-not (Test-Path -LiteralPath $Workflow)) {
  throw "Workflow file not found: $Workflow"
}

$env:N8N_USER_FOLDER = $Root
Set-Location $Root

& "$Root\node_modules\.bin\n8n.cmd" import:workflow --input $Workflow
