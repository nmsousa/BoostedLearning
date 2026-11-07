import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { setAssetPath } from 'ionicons';

import { AppModule } from './app/app.module';

// Tell Ionicons EXACTLY where its SVGs live. angular.json copies them to
// `www/svg`, so they're served at `<baseURI>svg`. Without this the lazy loader
// tries to derive its own base and, in some hosting contexts (file://, a
// non-root base, or the WebView), fails with "Failed to construct 'URL':
// Invalid base URL" — every icon then silently fails to load. Setting an
// explicit, absolute path fixes it everywhere.
try {
  setAssetPath(new URL('svg', document.baseURI).href);
} catch {
  setAssetPath('/svg');
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.log(err));
