# Dependency License Audit

This document records the licenses of runtime dependencies as required by R14.2, R14.3, and R23.1.

## Core Dependencies

| Package | Version | License | Notes |
|---------|---------|---------|-------|
| ts-fsrs | ^5.4.2 | **MIT** | ✅ Confirmed via [GitHub LICENSE](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/LICENSE). Compatible with no-paid-dependency constraint. |
| dexie | ^4.4.7 | **Apache-2.0** | ✅ Dexie.js **core only**. We do NOT use Dexie Cloud, which is a separate commercial product with restricted licensing. |
| uuid | ^11.1.1 | MIT | UUID generation for entity IDs |

## Framework Dependencies

| Package | Version | License | Notes |
|---------|---------|---------|-------|
| @angular/* | 22.2.3 | MIT | Angular framework |
| @ionic/angular | ^9.0.0 | MIT | Ionic UI components |
| @capacitor/* | ^8.5.3 | MIT | Native bridge for Android/PWA |

## Dev Dependencies

| Package | Version | License | Notes |
|---------|---------|---------|-------|
| fast-check | ^4.10.2 | MIT | Property-based testing |
| vitest | ~5.0.5 | MIT | Test runner |

## Constraints Satisfied

- ✅ **No paid dependencies** (R14.2): All dependencies are open-source with permissive licenses.
- ✅ **No external service dependencies** (R14.3): All dependencies run locally on-device.
- ✅ **Dexie Cloud excluded**: We use only the Apache-2.0 licensed Dexie.js core.
- ✅ **ts-fsrs license confirmed**: MIT license verified from GitHub repository.

## TTS/Speech Assets

- Web Speech API voices are provided by the OS/browser, not bundled with the app.
- No license obligation beyond OS/browser terms.
- Dutch voice availability varies by platform (handled by Capability_Detection_Layer).

---

*Last verified: October 2026*
