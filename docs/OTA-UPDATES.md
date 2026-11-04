# Over-the-air (OTA) updates

This app uses [`@capgo/capacitor-updater`](https://github.com/Cap-go/capacitor-updater)
in **self-hosted** mode to push updates to testers without distributing a new
APK. Bundles are hosted free on this repo's **GitHub Releases**; a small
Cloudflare Worker acts as the update-check endpoint.

## How it works

Capgo's self-hosted "auto-update" is NOT a static file: on each launch the
plugin sends a **POST** to its `updateUrl` and expects the *server* to compare
versions and reply with the bundle to download. A static `updates.json` on
GitHub Releases can't do that — GitHub rejects the POST with `422` — so the
check goes through our Worker instead.

1. `capacitor.config.ts` points `CapacitorUpdater.updateUrl` at the Worker:
   `https://boostionary-feedback.nmsousa.workers.dev/ota`
2. On launch the plugin POSTs its current bundle version to `/ota`. The Worker
   (`worker/src/index.ts`, `handleOta`) fetches the latest release's
   `updates.json`, and if its `version` is strictly newer (semver) returns
   `{ version, url, checksum }`; otherwise it returns `{ message: "up-to-date" }`.
3. When a bundle is returned, the plugin downloads `bundle-<version>.zip` from
   the GitHub release, verifies the checksum, and applies it on the **next** app
   start (`directUpdate` is off, so startup stays instant/offline-safe).
4. `AppUpdateService.init()` calls `notifyAppReady()` so a healthy launch isn't
   rolled back.

> The `updateUrl` is baked into the native app, so changing it (or first adding
> the Worker) requires building and shipping a **new APK** once. After that,
> web updates flow over OTA.

**Scope:** OTA updates the **web layer** (Angular/Ionic code) only. Native
changes (adding a plugin, changing native config, bumping Capacitor) still
require building and distributing a new APK.

## Publishing an update

One command builds, packages **and** publishes the GitHub Release. From the
`boosted-learning/` folder:

```powershell
./scripts/publish-ota.ps1 -Version 1.0.1
```

Use a version **higher** than the last published one (semver). The script:

1. builds the web bundle,
2. zips it in Capgo's required format and computes the checksum,
3. writes `scripts/ota-out/{bundle-1.0.1.zip, updates.json}`,
4. creates a GitHub Release tagged `v1.0.1` with both files attached (not a
   pre-release, so `latest` resolves to it).

Testers with the app installed get the update automatically on next launch.

Optional flags:

- `-Notes "Fix streak counter"` — custom release notes.
- `-NoPublish` — build and package only, skip the GitHub Release (inspect the
  output in `scripts/ota-out/` before shipping).

### One-time setup

Publishing uses the [GitHub CLI](https://cli.github.com/). Install and
authenticate once:

```powershell
winget install --id GitHub.cli
gh auth login   # GitHub.com -> HTTPS -> Login with a web browser
```

The authenticated account needs write access to `nmsousa/BoostedLearning`.
After a fresh install, open a new terminal so `gh` is on the PATH.

## Testing the loop

1. Install the current debug APK on a device.
2. Make a small visible change (e.g. edit a label).
3. Run the publish script with a bumped version and create the release.
4. Relaunch the app — the change appears without reinstalling.
