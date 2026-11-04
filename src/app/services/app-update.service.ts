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

    // Guard against re-downloading the version we already run. The native
    // auto-update check compares the server version against the APK's BUILTIN
    // version, not the currently-applied OTA bundle — so right after applying
    // 1.2.0 it can still think it's on the older builtin and try to download
    // 1.2.0 again, which fails ("a bundle with that version already exists").
    // So first ask the server for the latest version and compare it to the
    // bundle actually running; if they match, we're done.
    try {
      const [latest, cur] = await Promise.all([
        CapacitorUpdater.getLatest().catch(() => null),
        CapacitorUpdater.current().catch(() => null),
      ]);
      const latestV = latest?.version;
      const runningV = cur?.bundle?.version;
      // `cur.bundle.version` is 'builtin' for the APK bundle; a real OTA bundle
      // carries its semver. If the running bundle already equals the latest, or
      // the server reports no newer url, report up-to-date without downloading.
      if (latestV && runningV && latestV === runningV) {
        return { status: 'uptodate', version: latestV };
      }
      if (latest && !latest.url) {
        return { status: 'uptodate', version: latestV };
      }
    } catch {
      // Fall through to the event-driven path below.
    }

    // Otherwise use the plugin's own auto-update pipeline (triggerUpdateCheck)
    // and resolve from events (downloadComplete / noNeedUpdate / downloadFailed).
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

        // Download failed. The most common cause after a successful update is
        // the plugin re-attempting a version it already has; the upfront guard
        // catches that, so here we still surface a (soft) error for genuine
        // network failures.
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
