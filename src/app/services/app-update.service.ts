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
      // Confirm the running bundle is healthy so the plugin keeps it.
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
  async getUpdateStatus(): Promise<{ available: boolean; version?: string; url?: string; checksum?: string }> {
    if (!Capacitor.isNativePlatform()) return { available: false };
    try {
      const latest = await CapacitorUpdater.getLatest();
      const latestV = latest?.version;
      if (!latestV || !latest.url) return { available: false, version: latestV };
      const available = this.isNewer(latestV, BUILD_INFO.version);
      return { available, version: latestV, url: latest.url, checksum: latest.checksum };
    } catch {
      return { available: false };
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
      await CapacitorUpdater.reload();
      return { status: 'updated', version };
    } catch (err) {
      return { status: 'error', error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Manually check + apply in one go (the Settings button). Checks passively
   * first (no download if we're already on the latest), then downloads only
   * when there's genuinely a newer version.
   */
  async checkForUpdateNow(): Promise<ManualUpdateResult> {
    if (!Capacitor.isNativePlatform()) return { status: 'unsupported' };
    const s = await this.getUpdateStatus();
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
