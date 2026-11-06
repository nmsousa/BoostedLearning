/**
 * Back Interceptor
 *
 * Lets the currently-visible page claim the Android hardware/gesture back press
 * so it can do exactly what its own on-screen "X"/close does — e.g. the Write
 * exercise shows its "you'll lose progress" confirmation instead of the global
 * handler silently popping the page.
 *
 * A page registers a handler on enter and clears it on leave. The root back
 * handler (app.component.ts) calls `runActive()` first; if a handler is set and
 * it HANDLES the press (returns true), the global navigation is skipped.
 *
 * Only ONE handler is active at a time (the foreground page). Kept trivially
 * simple — no stack — because Ionic shows one page at a time in this app.
 *
 * @module app/services
 */

import { Injectable } from '@angular/core';

/** Returns true when the page handled the back press (so the app must not also
 *  navigate). May be async (e.g. it awaits a confirmation dialog). */
export type BackHandler = () => boolean | Promise<boolean>;

@Injectable({ providedIn: 'root' })
export class BackInterceptorService {
  private handler: BackHandler | null = null;

  /** The active page registers its back handler (on ionViewWillEnter). */
  register(handler: BackHandler): void {
    this.handler = handler;
  }

  /** Clear a handler (on ionViewWillLeave). Pass the same ref to avoid clearing
   *  a newer page's handler if teardown races with the next page's setup. */
  clear(handler: BackHandler): void {
    if (this.handler === handler) this.handler = null;
  }

  /** Run the active handler, if any. Returns true when it handled the press. */
  async runActive(): Promise<boolean> {
    if (!this.handler) return false;
    try {
      return await this.handler();
    } catch {
      return false;
    }
  }
}
