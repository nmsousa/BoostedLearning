# Boostionary — Known bugs (fix later)

Bugs we're aware of but deliberately deferring. Each should be reproduced and
fixed in its own focused change; they are parked here so they aren't forgotten.

## Journey++

### Enter shows the previous chapter title but none of its nodes
Status: **open — intermittent.**

When entering Journey++ (sometimes), the header briefly shows the *previous*
chapter's title while **none of that previous chapter's nodes are visible** —
i.e. the header and the rendered content disagree for a moment on entry. It's
intermittent (timing/scroll-settle related), likely in the same area as the
earlier language-switch header-flash work (header index vs. the on-screen
chapter after the initial scroll-to-current).

Where to look: `src/app/flashcards/journey-plus-plus/journey-plus-plus.page.ts`
— `load()` / `scrollToCurrent()` / `updateHeaderChapter()` / `onContentScroll()`
and the `headerChapterIndex` getters; also `ionViewWillEnter` re-running `load`.

### Hardware/gesture back can double-pop (back-twice) in some flows
Status: **open — partially addressed, not fully fixed.**

The Android hardware/gesture back can still pop two levels in some cases (e.g.
returning from a node exercise occasionally skips past the map). We added the
BackInterceptor registration on the maps and made flip/blanks await their
`navigateBack`, which fixed the main reported case, but the underlying
race (synchronous interceptor result over an async navigation, plus the global
handler's outlet-pop fallback) can still mis-fire in edge cases and needs a
proper, root-cause fix.

Where to look: `src/app/app.component.ts` (`registerHardwareBackButton`,
`popRouterOutlet`), `src/app/services/back-interceptor.service.ts` (consider a
handler STACK instead of a single slot, and awaiting navigation before
resolving), and each exercise/map page's `onHardwareBack` + `ionViewWillEnter`/
`ionViewWillLeave` registration.
