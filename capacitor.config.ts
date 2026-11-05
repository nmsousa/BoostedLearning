import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.boostedlearning.app',
  appName: 'Boostionary',
  webDir: 'www',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Keyboard: {
      // Resize the WebView (not just the content) when the keyboard opens, so
      // Ionic's <ion-footer> rides up and sits just above the keys. 'native'
      // uses Android's windowSoftInputMode=adjustResize behaviour.
      resize: 'native',
      resizeOnFullScreen: true,
    },
    CapacitorUpdater: {
      // OTA auto-update. Background download; applied on the NEXT cold start.
      autoUpdate: true,
      // `resetWhenUpdate` (default) discards a stored OTA bundle and falls back
      // to the APK's builtin whenever the native app version changes. The
      // builtin version is the Android versionName, now auto-synced to
      // package.json on every build (scripts/gen-build-info.mjs), so a new APK
      // never gets shadowed by an old downloaded bundle.
      resetWhenUpdate: true,
      // The Capgo plugin POSTs to this URL on launch and expects the SERVER to
      // compare versions and return the bundle to download. A static file (e.g.
      // the GitHub release updates.json) can't do that — GitHub even rejects the
      // POST with 422 — so we point at our Cloudflare Worker's /ota route, which
      // reads the device's current version, checks the latest release manifest,
      // and returns { version, url, checksum } only when a newer bundle exists.
      updateUrl: 'https://boostionary-feedback.nmsousa.workers.dev/ota',
      // NOTE: `directUpdate` is intentionally OFF. With it on, the plugin tried
      // to apply a pending update DURING launch, which made a blocking network
      // call to the update URL — so starting the app OFFLINE hung on the splash
      // until the request timed out. Background download + apply-on-next-start
      // keeps startup instant and fully functional offline.
    },
  },
  android: {
    backgroundColor: '#ffffff',
    allowMixedContent: false,
    // captureInput is OFF. When ON, the native WebView intercepts key input,
    // which disables Gboard's glide/swipe typing AND its suggestion dictionary
    // (both need the IME to drive the field directly). It was originally a
    // workaround (Capacitor #1753) so typed/accented text reached the web input
    // before the keyboard closed — but the Write screen now reads the LIVE DOM
    // value at submit (syncNativeValue) and uses composition handlers, so that
    // reason no longer applies and we can leave input to the keyboard.
    captureInput: false,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
