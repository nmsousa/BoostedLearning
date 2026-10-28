import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.boostedlearning.app',
  appName: 'Boosted Learning',
  webDir: 'www',
  server: {
    androidScheme: 'https',
  },
  plugins: {},
  android: {
    backgroundColor: '#ffffff',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
