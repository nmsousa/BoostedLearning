/**
 * App Update Service
 *
 * Thin wrapper around @capgo/capacitor-updater for over-the-air (OTA) updates.
 *
 * With `autoUpdate` enabled in capacitor.config.ts, the native plugin checks
 * the configured updateUrl on launch and downloads a newer web bundle on its
 * own. The one thing the app MUST do is call `notifyAppReady()` after it has
 * booted successfully — otherwise the plugin assumes the update is broken and
 * rolls back to the previous bundle. This service does that and surfaces a few
 * lifecycle logs.
 *
 * On the web (and anywhere the native plugin isn't available) every call is a
 * safe no-op, so this is harmless in the browser build and in tests.
 *
 * @module app/services
 */

import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { BUILD_INFO } from '../../build-info';

/** Outcome of a manual "check for updates" so the UI can message the user. */
export type ManualUpdateResult =
  | { status: 'updated'; version: string }     // downloaded + applied (reloading)
  | { status: 'uptodate'; version?: string }   // already on the latest bundle
  | { status: 'unsupported' }                   // web/no native plugin
  | { status: 'error'; error: string };

/** Result of a passive update check. `ok:false` means the CHECK itself failed
 *  (network/plugin error) — distinct from a successful check that found no
 *  newer bundle (`ok:true, available:false`). The old code collapsed both into
 *  "available:false", so a failed check was reported to the user as "you're on
 *  the latest version". */
export interface UpdateStatus {
  ok: boolean;
  available: boolean;
  version?: string;
  url?: string;
  checksum?: string;
  error?: string;
}

/** The OTA endpoint the native plugin is pointed at (capacitor.config.ts). Used
 *  as a direct fallback when the plugin's getLatest() returns nothing, so a
 *  plugin quirk can't mask a genuinely-available update. */
const OTA_URL = 'https://boostionary-feedback.nmsousa.workers.dev/ota';

@Injectable({
  providedIn: 'root',
})
export class AppUpdateService {
  private started = false;

  /**
   * Call once, as early as possible after the app boots. Tells the updater the
   * current bundle launched successfully (preventing rollback) and wires up
   * basic logging for update events.
   */
  async init(): Promise<void> {
    if (this.started) return;
    this.started = true;

    try {
      // Confirm the running bundle is healthy so the plugin keeps it (otherwise
      // the plugin assumes the bundle is broken and rolls back to the previous
      // one). Stale-bundle recovery is handled natively by `resetWhenUpdate`
      // (the APK's versionName now tracks package.json), so we don't force a
      // reset from JS here — that would undo a legitimately newer OTA bundle.
      await CapacitorUpdater.notifyAppReady();

      // Optional visibility into the OTA lifecycle.
      CapacitorUpdater.addListener('updateAvailable', info => {
        console.log('OTA: update available', info.bundle?.version);
      });
      CapacitorUpdater.addListener('downloadComplete', info => {
        console.log('OTA: new bundle downloaded', info.bundle?.version);
      });
      CapacitorUpdater.addListener('updateFailed', info => {
        console.warn('OTA: update failed', info.bundle?.version);
      });
    } catch (err) {
      // Web/no-plugin environments land here; nothing to do.
      console.debug('OTA updater not active:', err);
    }
  }

  /**
   * Passively check whether a NEWER bundle than the one running is available,
   * WITHOUT downloading anything. Used to show a "new version" badge when the
   * Settings page opens. Compares the server manifest version against
   * BUILD_INFO.version (the version actually baked into the running web bundle)
   * — this is reliable, unlike the native plugin's `current()` which reports
   * 'builtin' and caused false "update available / download failed" loops.
   */
  async getUpdateStatus(): Promise<UpdateStatus> {
    if (!Capacitor.isNativePlatform()) return { ok: true, available: false };

    // Primary: ask the Capgo plugin. If it throws or returns nothing usable we
    // DON'T silently claim "up to date" — we fall back to the OTA endpoint, and
    // if that also fails we report the error so the UI can show it.
    let pluginError: string | undefined;
    try {
      const latest = await CapacitorUpdater.getLatest();
      const latestV = latest?.version;
      if (latestV && latest.url) {
        return {
          ok: true,
          available: this.isNewer(latestV, BUILD_INFO.version),
          version: latestV,
          url: latest.url,
          checksum: latest.checksum,
        };
      }
      // Plugin returned nothing actionable — fall through to the direct check.
    } catch (err) {
      pluginError = err instanceof Error ? err.message : String(err);
    }

    // Fallback: query the OTA worker directly with the running version. This is
    // the same endpoint the plugin uses; doing it ourselves avoids a plugin
    // state/cache quirk masking a genuinely-available update.
    try {
      const res = await fetch(`${OTA_URL}?current=${encodeURIComponent(BUILD_INFO.version)}`, {
        headers: { accept: 'application/json' },
      });
      if (!res.ok) {
        return { ok: false, available: false, error: pluginError ?? `OTA check HTTP ${res.status}` };
      }
      const data = await res.json() as { version?: string; url?: string; checksum?: string };
      if (!data?.version || !data.url) {
        // A valid response with no newer bundle = genuinely up to date.
        return { ok: true, available: false, version: data?.version };
      }
      return {
        ok: true,
        available: this.isNewer(data.version, BUILD_INFO.version),
        version: data.version,
        url: data.url,
        checksum: data.checksum,
      };
    } catch (err) {
      const fetchError = err instanceof Error ? err.message : String(err);
      return { ok: false, available: false, error: pluginError ?? fetchError };
    }
  }

  /**
   * Download the given bundle, set it as next, and reload into it immediately.
   * Called when the user taps the "new version available" badge. Guards against
   * re-downloading the version already running (BUILD_INFO.version).
   */
  async downloadAndApply(version: string, url: string, checksum?: string): Promise<ManualUpdateResult> {
    if (!Capacitor.isNativePlatform()) return { status: 'unsupported' };
    if (!this.isNewer(version, BUILD_INFO.version)) {
      return { status: 'uptodate', version };
    }
    try {
      const bundle = await CapacitorUpdater.download({ version, url, checksum });
      await CapacitorUpdater.set({ id: bundle.id });
      // reload() restarts the webview (lands on Home), wiping any toast we show
      // now. Persist the applied version so the NEXT boot can confirm it.
      try { localStorage.setItem(AppUpdateService.JUST_UPDATED_KEY, version); } catch { /* ignore */ }
      await CapacitorUpdater.reload();
      return { status: 'updated', version };
    } catch (err) {
      return { status: 'error', error: err instanceof Error ? err.message : String(err) };
    }
  }

  private static readonly JUST_UPDATED_KEY = 'boosted-just-updated-version';

  /**
   * If the app just reloaded into a freshly-applied OTA bundle, return that
   * version (once) so the UI can show a "Updated to x.y.z" confirmation. Clears
   * the flag so it only shows on the first boot after the update.
   */
  consumeJustUpdatedVersion(): string | null {
    try {
      const v = localStorage.getItem(AppUpdateService.JUST_UPDATED_KEY);
      if (v) {
        localStorage.removeItem(AppUpdateService.JUST_UPDATED_KEY);
        // Only confirm if the running bundle is actually that version now.
        if (v === BUILD_INFO.version) return v;
      }
    } catch { /* ignore */ }
    return null;
  }

  /**
   * Manually check + apply in one go (the Settings button). Checks passively
   * first (no download if we're already on the latest), then downloads only
   * when there's genuinely a newer version.
   */
  async checkForUpdateNow(): Promise<ManualUpdateResult> {
    if (!Capacitor.isNativePlatform()) return { status: 'unsupported' };
    const s = await this.getUpdateStatus();
    // The CHECK failed (network/plugin) — report it as an error, don't pretend
    // we're on the latest version (the old behaviour that hid this bug).
    if (!s.ok) {
      return { status: 'error', error: s.error ?? 'Update check failed' };
    }
    // Checked fine, but nothing newer than what's running.
    if (!s.available || !s.url || !s.version) {
      return { status: 'uptodate', version: s.version };
    }
    return this.downloadAndApply(s.version, s.url, s.checksum);
  }

  /** True when semver `a` is strictly greater than `b` (major.minor.patch). */
  private isNewer(a: string, b: string): boolean {
    const p = (v: string) => {
      const m = /(\d+)\.(\d+)\.(\d+)/.exec(v ?? '');
      return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
    };
    const pa = p(a), pb = p(b);
    for (let i = 0; i < 3; i++) {
      if (pa[i] > pb[i]) return true;
      if (pa[i] < pb[i]) return false;
    }
    return false;
  }
}
