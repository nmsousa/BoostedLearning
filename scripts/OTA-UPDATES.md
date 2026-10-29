# Over-the-air (OTA) updates

This app uses [`@capgo/capacitor-updater`](https://github.com/Cap-go/capacitor-updater)
in **self-hosted** mode to push updates to testers without distributing a new
APK. Updates are hosted free on this repo's **GitHub Releases**.

## How it works

1. The app's `capacitor.config.ts` points `CapacitorUpdater.updateUrl` at:
   `https://github.com/nmsousa/BoostedLearning/releases/latest/download/updates.json`
2. On launch, the plugin fetches that `updates.json`. If its `version` is newer
   than the installed bundle, the plugin downloads the `bundle-<version>.zip`,
   verifies its checksum, and applies it on the next app start.
3. `AppUpdateService.init()` calls `notifyAppReady()` so a healthy launch isn't
   rolled back.

**Scope:** OTA updates the **web layer** (Angular/Ionic code) only. Native
changes (adding a plugin, changing native config, bumping Capacitor) still
require building and distributing a new APK.

## Publishing an update

From the `boosted-learning/` folder:

```powershell
./scripts/publish-ota.ps1 -Version 1.0.1
```

Use a version **higher** than the last published one (semver). The script
builds the web bundle, zips it in Capgo's required format, computes the
checksum, and writes `scripts/ota-out/{bundle-1.0.1.zip, updates.json}`.

Then create a GitHub Release:

1. https://github.com/nmsousa/BoostedLearning/releases/new
2. Tag + title: `v1.0.1`
3. Attach **both** `bundle-1.0.1.zip` and `updates.json` as assets
4. Publish (do **not** mark as pre-release, so `latest` resolves to it)

Testers get the update automatically on next launch.

## Testing the loop

1. Install the current debug APK on a device.
2. Make a small visible change (e.g. edit a label).
3. Run the publish script with a bumped version and create the release.
4. Relaunch the app — the change appears without reinstalling.
