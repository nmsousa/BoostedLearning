import { Component, inject, effect } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import {
  ModalController,
  PopoverController,
  ActionSheetController,
  AlertController,
} from '@ionic/angular';
import { SettingsService } from './services/settings.service';
import { AppUpdateService } from './services/app-update.service';

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
  private location = inject(Location);
  private router = inject(Router);
  private modalCtrl = inject(ModalController);
  private popoverCtrl = inject(PopoverController);
  private actionSheetCtrl = inject(ActionSheetController);
  private alertCtrl = inject(AlertController);

  constructor() {
    // Mark the current OTA bundle as healthy and enable live updates.
    void this.appUpdate.init();

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
        const bar =
          styles.getPropertyValue('--ion-toolbar-background').trim() ||
          styles.getPropertyValue('--ion-background-color').trim() ||
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
   * Picks the overlay that is actually on top across the four controllers.
   */
  private async dismissTopOverlay(): Promise<boolean> {
    const tops = await Promise.all([
      this.alertCtrl.getTop(),
      this.actionSheetCtrl.getTop(),
      this.popoverCtrl.getTop(),
      this.modalCtrl.getTop(),
    ]);
    // Keep only the open overlays, then dismiss the one on top (highest
    // z-index = latest presented).
    const open = tops.filter(Boolean) as HTMLElement[];
    if (open.length === 0) return false;
    let top = open[0];
    for (const o of open) {
      if ((Number(o.style.zIndex) || 0) >= (Number(top.style.zIndex) || 0)) top = o;
    }
    await (top as unknown as { dismiss: () => Promise<boolean> }).dismiss();
    return true;
  }
}
