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
   * Manually check for an update RIGHT NOW and, if one exists, download, apply
   * and reload into it — no cold start needed. Backs the Settings "Check for
   * updates" button, which is more reliable than waiting for the background
   * flow. Safe no-op on web (returns 'unsupported').
   */
  async checkForUpdateNow(): Promise<ManualUpdateResult> {
    if (!Capacitor.isNativePlatform()) {
      return { status: 'unsupported' };
    }
    try {
      // Ask the server (our /ota Worker) what the latest bundle is.
      const latest = await CapacitorUpdater.getLatest();

      // No download URL means the server said we're up-to-date.
      if (!latest.url) {
        return { status: 'uptodate', version: latest.version };
      }

      // If the latest already matches what's running, nothing to do.
      const cur = await CapacitorUpdater.current();
      if (cur.bundle?.version && cur.bundle.version === latest.version) {
        return { status: 'uptodate', version: latest.version };
      }

      // Download the new bundle, set it as next, and reload into it now.
      const bundle = await CapacitorUpdater.download({
        version: latest.version,
        url: latest.url,
        checksum: latest.checksum,
      });
      await CapacitorUpdater.set({ id: bundle.id });
      // notifyAppReady runs on the next boot via init(); reload applies the
      // new bundle immediately.
      await CapacitorUpdater.reload();
      return { status: 'updated', version: latest.version };
    } catch (err) {
      return { status: 'error', error: err instanceof Error ? err.message : String(err) };
    }
  }
}
