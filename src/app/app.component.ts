import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
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

  constructor() {
    // Mark the current OTA bundle as healthy and enable live updates.
    void this.appUpdate.init();

    this.registerHardwareBackButton();
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

    App.addListener('backButton', ({ canGoBack }) => {
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
}
