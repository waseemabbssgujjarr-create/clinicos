# PowerShell push — Git Bash/WSL is not installed on this PC.
# From PowerShell:
#   cd $HOME\Downloads\clinicosmg
#   .\push.ps1
param(
  [string]$Message = "Apply professional dashboard design system"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

git add -A
git reset HEAD -- .env, .env.local, "clinicos-api/.env", "iqpigeon/config.local.php" 2>$null

$staged = git diff --cached --name-only
if (-not $staged) {
  Write-Host "Nothing to commit. Pushing main..."
} else {
  git commit -m $Message
}

git push origin main
if ($LASTEXITCODE -ne 0) { throw "git push failed" }

Write-Host "Push succeeded. Pulling on MiddleHost..."
ssh MiddleHost "cd /home/digitals/doctorsmyagency.com/clinicos-api && git pull"
