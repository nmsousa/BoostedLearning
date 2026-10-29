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
import { CapacitorUpdater } from '@capgo/capacitor-updater';

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
}
