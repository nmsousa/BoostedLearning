<#
.SYNOPSIS
  Build, package AND publish an over-the-air (OTA) web update for Boosted
  Learning in a single command.

.DESCRIPTION
  Produces two files in scripts/ota-out/:
    - bundle-<version>.zip : the web bundle, zipped in Capgo's required format
    - updates.json         : the manifest the app reads to decide whether to update

  Then (unless -NoPublish is passed) it publishes a GitHub Release tagged
  v<version> with BOTH files attached, using the GitHub CLI (`gh`). The app
  checks
  https://github.com/nmsousa/BoostedLearning/releases/latest/download/updates.json
  on launch and downloads the bundle when the version is newer than installed.

  Requirements for publishing:
    - GitHub CLI installed and authenticated (`gh auth login`).

.PARAMETER Version
  The semver version for this update (e.g. 1.0.1). Must be higher than the
  previously published version for the app to pick it up.

.PARAMETER Notes
  Optional release notes shown on the GitHub Release. Defaults to a short line.

.PARAMETER NoPublish
  Build and package only; skip creating the GitHub Release. Use this if you
  want to inspect the output before shipping.

.EXAMPLE
  ./scripts/publish-ota.ps1 -Version 1.0.1

.EXAMPLE
  ./scripts/publish-ota.ps1 -Version 1.0.2 -Notes "Fix streak counter"

.EXAMPLE
  ./scripts/publish-ota.ps1 -Version 1.0.2 -NoPublish
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$Version,

  [string]$Notes,

  [switch]$NoPublish
)

# NOTE: deliberately NOT 'Stop'. Native tools here (npm/ng, npx, gh) write
# harmless warnings to stderr (e.g. Angular's browserslist notice), and with
# 'Stop' PowerShell treats any stderr write from a native command as a
# terminating error. We instead check $LASTEXITCODE explicitly after each
# native call, and `throw` on real failures.
$ErrorActionPreference = 'Continue'

# Resolve paths relative to the project root (parent of this script's folder).
$projectRoot = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $PSScriptRoot 'ota-out'
$appId = 'com.boostedlearning.app'
$repo = 'nmsousa/BoostedLearning'
$downloadBase = "https://github.com/$repo/releases/latest/download"
$tag = "v$Version"

Push-Location $projectRoot
try {
  # --- Pre-flight checks (fail early, before building) ----------------------
  if (-not $NoPublish) {
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
      throw "GitHub CLI (gh) not found on PATH. Install it or re-run with -NoPublish. " +
            "If you just installed it, open a new terminal so PATH refreshes."
    }
    # `gh auth status` exits non-zero when not logged in. Capture its output
    # WITHOUT letting a non-zero exit / stderr write abort the script (we only
    # care about the exit code here), hence the local ErrorAction override.
    & {
      $ErrorActionPreference = 'SilentlyContinue'
      gh auth status *>$null
    }
    if ($LASTEXITCODE -ne 0) {
      throw "GitHub CLI is not authenticated. Run 'gh auth login' first."
    }
    # Refuse to clobber an existing release/tag — bump the version instead.
    # `gh release view` writes "release not found" to stderr and exits non-zero
    # when the tag doesn't exist (the expected, good case), so swallow both.
    & {
      $ErrorActionPreference = 'SilentlyContinue'
      gh release view $tag --repo $repo *>$null
    }
    if ($LASTEXITCODE -eq 0) {
      throw "A release tagged $tag already exists on $repo. Use a higher -Version."
    }
  }

  if (Test-Path $outDir) { Remove-Item -Recurse -Force $outDir }
  New-Item -ItemType Directory -Path $outDir | Out-Null

  Write-Host "1/4  Building the web bundle..." -ForegroundColor Cyan
  npm run build 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "web build failed (exit $LASTEXITCODE)." }

  $zipName = "bundle-$Version.zip"
  $zipPath = Join-Path $outDir $zipName

  Write-Host "2/4  Zipping the bundle with the Capgo CLI..." -ForegroundColor Cyan
  # --json prints { version, checksum, size }. --path points at the built web dir.
  $jsonOut = npx --yes @capgo/cli@latest bundle zip $appId --path www --name $zipName --bundle $Version --json
  if ($LASTEXITCODE -ne 0) { throw "capgo bundle zip failed (exit $LASTEXITCODE)." }
  Move-Item -Force (Join-Path $projectRoot $zipName) $zipPath -ErrorAction SilentlyContinue
  if (-not (Test-Path $zipPath)) {
    # Some CLI versions write into the current dir with the given name already.
    $produced = Get-ChildItem $projectRoot -Filter $zipName -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($produced) { Move-Item -Force $produced.FullName $zipPath }
  }

  $info = $jsonOut | ConvertFrom-Json
  $checksum = $info.checksum

  Write-Host "3/4  Writing updates.json..." -ForegroundColor Cyan
  $manifest = [ordered]@{
    version  = $Version
    url      = "$downloadBase/$zipName"
    checksum = $checksum
  }
  $manifestPath = Join-Path $outDir 'updates.json'
  $manifest | ConvertTo-Json | Set-Content -Path $manifestPath -Encoding UTF8

  if ($NoPublish) {
    Write-Host ""
    Write-Host "Done (build only). Files ready in: $outDir" -ForegroundColor Green
    Write-Host "  - $zipName"
    Write-Host "  - updates.json  (version=$Version, checksum=$checksum)"
    Write-Host ""
    Write-Host "Re-run without -NoPublish to publish the GitHub Release." -ForegroundColor Yellow
    return
  }

  Write-Host "4/4  Publishing GitHub Release $tag..." -ForegroundColor Cyan
  if (-not $Notes) {
    $Notes = "OTA web update $Version. Installed testers get it automatically on next launch."
  }
  # Create the release (not a pre-release, so 'latest' resolves to it) and
  # attach both assets in one call.
  gh release create $tag $zipPath $manifestPath `
    --repo $repo `
    --title $tag `
    --notes $Notes
  if ($LASTEXITCODE -ne 0) {
    throw "gh release create failed (exit $LASTEXITCODE)."
  }

  Write-Host ""
  Write-Host "Published release $tag on $repo." -ForegroundColor Green
  Write-Host "  version=$Version  checksum=$checksum"
  Write-Host "  manifest: $downloadBase/updates.json"
  Write-Host ""
  Write-Host "Testers with the app installed get this update on their next launch." -ForegroundColor Green
}
finally {
  Pop-Location
}
