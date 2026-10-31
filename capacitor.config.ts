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
      // Self-hosted over-the-air updates. The plugin checks this URL in the
      // BACKGROUND; if it advertises a newer bundle, it downloads it and
      // applies it on the NEXT cold start. This lets you ship updates to
      // testers without distributing a new APK.
      // Served as a "latest release" asset on this GitHub repo. The
      // `releases/latest/download/<asset>` URL always resolves to the newest
      // published (non-pre-release) release, so publishing a new release with
      // an updated updates.json is all it takes to ship an update.
      autoUpdate: true,
      updateUrl:
        'https://github.com/nmsousa/BoostedLearning/releases/latest/download/updates.json',
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
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
