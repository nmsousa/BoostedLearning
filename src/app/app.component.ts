import { Component, inject, effect } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SettingsService } from './services/settings.service';
import { AppUpdateService } from './services/app-update.service';
import { FlashcardService } from './services/flashcard.service';

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
  private location = inject(Location);
  private router = inject(Router);

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

    App.addListener('backButton', async ({ canGoBack }) => {
      // FIRST: if any overlay (modal / popover / action sheet / alert) is open,
      // close just that and stop — a back press/swipe should dismiss the popup
      // before it ever navigates to the previous page. Only the NEXT back goes
      // back a page. (We dismiss the top-most overlay across all controllers.)
      if (await this.dismissTopOverlay()) return;

      const onHome = this.router.url === '/' || this.router.url.startsWith('/home');

      if (onHome) {
        // Already home: let the user leave the app.
        void App.exitApp();
        return;
      }

      if (canGoBack || window.history.length > 1) {
        this.location.back();
      } else {
        // No history but not on home: go to home rather than exit.
        void this.router.navigate(['/home']);
      }
    });
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
      .filter(el => !el.classList.contains('overlay-hidden'));
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
