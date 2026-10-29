<#
.SYNOPSIS
  Build and package an over-the-air (OTA) web update for Boosted Learning.

.DESCRIPTION
  Produces two files in scripts/ota-out/:
    - bundle-<version>.zip : the web bundle, zipped in Capgo's required format
    - updates.json         : the manifest the app reads to decide whether to update

  You then publish BOTH files as assets on a new GitHub Release (see steps the
  script prints at the end). The app checks
  https://github.com/nmsousa/BoostedLearning/releases/latest/download/updates.json
  on launch and downloads the bundle when the version is newer than what's
  installed.

.PARAMETER Version
  The semver version for this update (e.g. 1.0.1). Must be higher than the
  previously published version for the app to pick it up.

.EXAMPLE
  ./scripts/publish-ota.ps1 -Version 1.0.1
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$Version
)

$ErrorActionPreference = 'Stop'

# Resolve paths relative to the project root (parent of this script's folder).
$projectRoot = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $PSScriptRoot 'ota-out'
$appId = 'com.boostedlearning.app'
$downloadBase = 'https://github.com/nmsousa/BoostedLearning/releases/latest/download'

Push-Location $projectRoot
try {
  if (Test-Path $outDir) { Remove-Item -Recurse -Force $outDir }
  New-Item -ItemType Directory -Path $outDir | Out-Null

  Write-Host "1/3  Building the web bundle..." -ForegroundColor Cyan
  npm run build | Out-Null

  $zipName = "bundle-$Version.zip"
  $zipPath = Join-Path $outDir $zipName

  Write-Host "2/3  Zipping the bundle with the Capgo CLI..." -ForegroundColor Cyan
  # --json prints { version, checksum, size }. --path points at the built web dir.
  $jsonOut = npx --yes @capgo/cli@latest bundle zip $appId --path www --name $zipName --bundle $Version --json
  Move-Item -Force (Join-Path $projectRoot $zipName) $zipPath -ErrorAction SilentlyContinue
  if (-not (Test-Path $zipPath)) {
    # Some CLI versions write into the current dir with the given name already.
    $produced = Get-ChildItem $projectRoot -Filter $zipName -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($produced) { Move-Item -Force $produced.FullName $zipPath }
  }

  $info = $jsonOut | ConvertFrom-Json
  $checksum = $info.checksum

  Write-Host "3/3  Writing updates.json..." -ForegroundColor Cyan
  $manifest = [ordered]@{
    version  = $Version
    url      = "$downloadBase/$zipName"
    checksum = $checksum
  }
  $manifestPath = Join-Path $outDir 'updates.json'
  $manifest | ConvertTo-Json | Set-Content -Path $manifestPath -Encoding UTF8

  Write-Host ""
  Write-Host "Done. Files ready in: $outDir" -ForegroundColor Green
  Write-Host "  - $zipName"
  Write-Host "  - updates.json  (version=$Version, checksum=$checksum)"
  Write-Host ""
  Write-Host "Next: publish a GitHub Release with BOTH files attached:" -ForegroundColor Yellow
  Write-Host "  1. Go to https://github.com/nmsousa/BoostedLearning/releases/new"
  Write-Host "  2. Tag: v$Version   Title: v$Version"
  Write-Host "  3. Attach $zipName and updates.json as release assets"
  Write-Host "  4. Publish (leave 'pre-release' unchecked so 'latest' resolves to it)"
  Write-Host ""
  Write-Host "The app will pick up the update on its next launch."
}
finally {
  Pop-Location
}
