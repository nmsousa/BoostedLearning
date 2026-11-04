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

    // Use the plugin's own auto-update pipeline (triggerUpdateCheck) rather than
    // a manual getLatest()+download()+set(): with autoUpdate enabled the manual
    // path fights the background flow and, on an "up-to-date" server reply,
    // getLatest() can reject — which surfaced as a false "error" to the user.
    // triggerUpdateCheck() queues a native check and the outcome arrives via
    // events (downloadComplete / noNeedUpdate / downloadFailed).
    const listeners: { remove: () => void }[] = [];
    const cleanup = () => { for (const l of listeners) { try { l.remove(); } catch { /* ignore */ } } };

    try {
      const result = await new Promise<ManualUpdateResult>(resolve => {
        let settled = false;
        const done = (r: ManualUpdateResult) => { if (!settled) { settled = true; resolve(r); } };

        // A new bundle finished downloading → apply it now with a reload.
        void CapacitorUpdater.addListener('downloadComplete', info => {
          const version = info.bundle?.version ?? '';
          CapacitorUpdater.set({ id: info.bundle!.id })
            .then(() => CapacitorUpdater.reload())
            .then(() => done({ status: 'updated', version }))
            .catch(err => done({ status: 'error', error: err instanceof Error ? err.message : String(err) }));
        }).then(h => listeners.push(h));

        // Server said there's nothing newer.
        void CapacitorUpdater.addListener('noNeedUpdate', () => {
          done({ status: 'uptodate' });
        }).then(h => listeners.push(h));

        // Download/apply failed.
        void CapacitorUpdater.addListener('downloadFailed', info => {
          done({ status: 'error', error: `download failed${info.version ? ' (' + info.version + ')' : ''}` });
        }).then(h => listeners.push(h));
        void CapacitorUpdater.addListener('updateFailed', info => {
          done({ status: 'error', error: `update failed${info.bundle?.version ? ' (' + info.bundle.version + ')' : ''}` });
        }).then(h => listeners.push(h));

        // Kick off the native check. If it can't even queue (auto-update off /
        // web), resolve immediately.
        CapacitorUpdater.triggerUpdateCheck()
          .then(r => {
            if (r.status === 'unavailable') done({ status: 'unsupported' });
          })
          .catch(err => done({ status: 'error', error: err instanceof Error ? err.message : String(err) }));

        // Safety timeout: if no event arrives (e.g. offline), report up-to-date
        // rather than hanging — nothing was downloaded, so the app is unchanged.
        setTimeout(() => done({ status: 'uptodate' }), 20000);
      });
      return result;
    } finally {
      cleanup();
    }
  }
}
