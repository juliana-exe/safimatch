# setup.ps1 — Safimatch
# Gera backend/kong.yml a partir do template + variaveis do .env
# Execute UMA VEZ antes de rodar "docker compose up"
# ─────────────────────────────────────────────────────────────────

$ErrorActionPreference = 'Stop'
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

# ── 1. Carrega .env ────────────────────────────────────────────────
$envFile = Join-Path $ROOT ".env"
if (-not (Test-Path $envFile)) {
  Write-Error "Arquivo .env nao encontrado. Copie .env.example para .env e preencha os valores."
  exit 1
}

$envVars = @{}
Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -and -not $line.StartsWith('#') -and $line -match '=') {
    $key, $val = $line -split '=', 2
    $envVars[$key.Trim()] = $val.Trim()
  }
}

$ANON_KEY        = $envVars['ANON_KEY']
$SERVICE_ROLE_KEY = $envVars['SERVICE_ROLE_KEY']

if (-not $ANON_KEY -or -not $SERVICE_ROLE_KEY) {
  Write-Error "ANON_KEY ou SERVICE_ROLE_KEY nao encontrados no .env"
  exit 1
}

# ── 2. Gera backend/kong.yml a partir do template ─────────────────
$templatePath = Join-Path $ROOT "backend\kong.yml.template"
$outputPath   = Join-Path $ROOT "backend\kong.yml"

$content = Get-Content $templatePath -Raw
$content = $content -replace '\$\{ANON_KEY\}',        $ANON_KEY
$content = $content -replace '\$\{SERVICE_ROLE_KEY\}', $SERVICE_ROLE_KEY
Set-Content -Path $outputPath -Value $content -Encoding UTF8

Write-Host "✅ backend/kong.yml gerado com sucesso." -ForegroundColor Green
Write-Host ""
Write-Host "Agora execute: docker compose up -d" -ForegroundColor Cyan
