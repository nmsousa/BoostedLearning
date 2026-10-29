import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.boostedlearning.app',
  appName: 'Boosted Learning',
  webDir: 'www',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    CapacitorUpdater: {
      // Self-hosted over-the-air updates. On launch the app checks this URL;
      // if it advertises a newer bundle than the installed one, the new web
      // bundle is downloaded and applied on the next app start. This lets you
      // ship updates to testers without distributing a new APK.
      // Point this at a static JSON you control (e.g. a GitHub Release asset).
      autoUpdate: true,
      updateUrl:
        'https://github.com/REPLACE_ME/boosted-learning-updates/releases/latest/download/updates.json',
      // Apply the downloaded update when the app returns to the foreground.
      directUpdate: true,
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
