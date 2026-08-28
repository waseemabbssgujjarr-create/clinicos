# Push current main, then git pull on MiddleHost.
#   cd $HOME\Downloads\clinicosmg
#   .\push-only.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

git push origin main
if ($LASTEXITCODE -ne 0) { throw "git push failed" }

Write-Host "Push succeeded. Pulling on MiddleHost..."
ssh MiddleHost "cd /home/digitals/doctorsmyagency.com/clinicos-api && git pull"
