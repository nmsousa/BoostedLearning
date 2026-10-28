// Register a fake IndexedDB implementation for every spec. The persistence and
// content layers use Dexie, which needs a global `indexedDB`. Doing this in the
// shared setup file (rather than per-spec imports) guarantees the API is present
// regardless of test file order or worker reuse.
import 'fake-indexeddb/auto';

// Polyfills for running unit tests under jsdom (the default Vitest environment).
// Ionic components such as ion-menu and ion-split-pane query `window.matchMedia`,
// which jsdom does not implement.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
