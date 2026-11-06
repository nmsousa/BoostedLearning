import { Component, inject, effect } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Platform } from '@ionic/angular';
import { SettingsService } from './services/settings.service';
import { AppUpdateService } from './services/app-update.service';
import { FlashcardService } from './services/flashcard.service';
import { BackInterceptorService } from './services/back-interceptor.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  // Inject the settings service so it is created at app startup and its
  // theme effect runs, applying the saved light/dark palette immediately.
  private settings = inject(SettingsService);
  private appUpdate = inject(AppUpdateService);
  private flashcards = inject(FlashcardService);
  private backInterceptor = inject(BackInterceptorService);
  private router = inject(Router);
  private platform = inject(Platform);

  constructor() {
    // Mark the current OTA bundle as healthy and enable live updates.
    void this.appUpdate.init();

    // Start loading decks NOW (app boot), so the heavy one-time DB/JSON work
    // overlaps the splash/startup instead of stalling the first mode the user
    // opens. initialize() is idempotent + shares one in-flight promise, so the
    // pages that also await it just join this same load.
    void this.flashcards.initialize();

    this.registerHardwareBackButton();
    this.syncStatusBarWithTheme();
  }

  /**
   * Keep the native status bar (and Android navigation bar) in step with the
   * current theme so it looks consistent across devices.
   *
   * Without this, some devices (e.g. Xiaomi/MIUI) leave the status bar
   * overlaying the web view with a device-specific inset, producing a tall
   * empty band above the header, and show a system-coloured gesture/nav bar
   * that doesn't match the app. We:
   *   - take the status bar OUT of overlay mode so it's a solid band, and
   *   - paint it (and the nav bar) with the app's current toolbar colour, with
   *     light/dark icons chosen from the effective theme.
   */
  private syncStatusBarWithTheme(): void {
    if (!Capacitor.isNativePlatform()) return;

    // React to theme/palette changes. The settings effects apply the DOM
    // classes first; we read the resulting computed colour here.
    effect(() => {
      const isDark = this.settings.effectiveTheme() === 'dark';
      // Touch colorTheme so this effect re-runs when the palette changes.
      this.settings.colorTheme();

      // Defer a tick so the CSS variables for the new theme are in place.
      setTimeout(() => {
        const styles = getComputedStyle(document.documentElement);
        // Match the APP BACKGROUND (the content area that fills most screens),
        // so the status bar blends with the page rather than standing out as a
        // slightly different toolbar shade.
        const bar =
          styles.getPropertyValue('--ion-background-color').trim() ||
          styles.getPropertyValue('--ion-toolbar-background').trim() ||
          (isDark ? '#0e1113' : '#ffffff');

        void StatusBar.setOverlaysWebView({ overlay: false });
        void StatusBar.setBackgroundColor({ color: bar });
        // NOTE: the plugin's Style names are counter-intuitive:
        //   Style.Dark  = LIGHT text (for a dark background)
        //   Style.Light = DARK text  (for a light background)
        // So a dark theme needs Style.Dark to get readable light text.
        void StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
      });
    });
  }

  /**
   * Android hardware/gesture back: navigate back through the app instead of
   * immediately closing it. Only exit the app when we're already at the home
   * screen (and no in-app history to pop). Any open Ionic overlay is closed
   * first by Ionic's own handler (higher priority), so this only runs for
   * page-level back.
   */
  private registerHardwareBackButton(): void {
    if (!Capacitor.isNativePlatform()) return;

    // Use IONIC's priority back-button system, NOT a raw @capacitor/app
    // listener. Ionic's ion-router-outlet subscribes at priority 0 to pop the
    // page on every back/gesture; a raw @capacitor/app listener runs ALONGSIDE
    // it, so the page was being popped to the list at the same moment our
    // handler tried to show the Write confirm — the confirm then appeared on
    // the ALREADY-popped list page (the reported bug). By subscribing at a
    // HIGHER priority (100) and NEVER calling the provided `_next` processor,
    // OUR handler runs first and fully owns the decision: Ionic's outlet pop
    // only happens because WE call popRouterOutlet() in step 3. When the active
    // page claims the press (step 2), nothing pops behind the confirm.
    this.platform.backButton.subscribeWithPriority(100, async (_next) => {
      // 1) An open overlay (modal/popover/action-sheet/alert) closes first.
      if (await this.dismissTopOverlay()) return;

      // 2) The active page intercepts back to do what its own X does (e.g. the
      //    Write exercise's "lose progress?" confirm). If it claimed the press,
      //    STOP — don't let Ionic pop the page behind the confirm.
      if (await this.backInterceptor.runActive()) return;

      // 3) Nobody claimed it → try to pop the ion-router-outlet stack ourselves
      //    (DOM API, since the outlet isn't reliably injectable here under
      //    @ionic/angular/lazy). If we popped, we're done and must NOT also run
      //    Ionic's default handler (that would double-pop).
      if (await this.popRouterOutlet()) return;

      // 4) Nothing to pop. On home → exit; otherwise go home.
      const onHome = this.router.url === '/' || this.router.url.startsWith('/home');
      if (onHome) {
        void App.exitApp();
      } else {
        void this.router.navigate(['/home']);
      }
    });
  }

  /**
   * Pop the Ionic router-outlet stack if it has somewhere to go back to.
   * Queries the DOM for the <ion-router-outlet> element (its custom-element API
   * exposes canGoBack()/pop()) rather than injecting IonRouterOutlet, which
   * isn't reliably injectable into the root component under @ionic/angular/lazy
   * (same reason dismissTopOverlay queries the DOM). Returns true when it popped.
   */
  private async popRouterOutlet(): Promise<boolean> {
    const outlet = document.querySelector('ion-router-outlet') as
      (HTMLElement & { canGoBack?: () => Promise<boolean> | boolean; pop?: () => Promise<void> }) | null;
    if (!outlet || typeof outlet.canGoBack !== 'function' || typeof outlet.pop !== 'function') {
      return false;
    }
    try {
      if (await outlet.canGoBack()) {
        await outlet.pop();
        return true;
      }
    } catch { /* fall through to the home/exit fallback */ }
    return false;
  }

  /**
   * Dismiss the single top-most open Ionic overlay, if any. Returns true when
   * one was dismissed (so the caller stops and does NOT also navigate back).
   *
   * We query the DOM rather than inject the overlay controllers: this app boots
   * Ionic via `@ionic/angular/lazy`, where the controllers aren't reliably
   * injectable into the root AppComponent (it threw NG0201 at startup). Every
   * open Ionic overlay is a custom element (ion-modal / ion-popover /
   * ion-action-sheet / ion-alert / ion-select-popover …) with a `.dismiss()`
   * method; the visible one lacks the `.overlay-hidden` class. We dismiss the
   * one with the highest z-index (the most recently presented).
   */
  private async dismissTopOverlay(): Promise<boolean> {
    const selector =
      'ion-modal, ion-popover, ion-action-sheet, ion-alert, ion-select-popover, ion-picker, ion-toast';
    const open = Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter(el => !el.classList.contains('overlay-hidden'))
      // The Write "lose progress?" confirm (study-end-confirm) is owned by the
      // page's back handler: back on it should close AND leave to the list, not
      // just close here. Skip it so the press flows to backInterceptor.
      .filter(el => !el.classList.contains('study-end-confirm'));
    if (open.length === 0) return false;

    let top = open[0];
    for (const el of open) {
      if ((Number(el.style.zIndex) || 0) >= (Number(top.style.zIndex) || 0)) top = el;
    }
    const dismiss = (top as unknown as { dismiss?: () => Promise<boolean> }).dismiss;
    if (typeof dismiss !== 'function') return false;
    await dismiss.call(top);
    return true;
  }
}
