/**
 * Where a Journey node exercise returns to when it finishes / closes.
 *
 * The classic Journey map, Journey+ and Journey++ all launch the SAME node
 * exercises (journey-flip, journey-quiz, …). The redesigned maps add
 * `?from=<page>` to the node route so the exercise returns to the page that
 * started it.
 *
 * @module app/flashcards/journey
 */
import type { ParamMap } from '@angular/router';

/** `from` value passed by Journey+. */
export const JOURNEY_PLUS_FROM = 'journey-plus';
/** `from` value passed by Journey++. */
export const JOURNEY_PLUS_PLUS_FROM = 'journey-plus-plus';

/** Return route for a Journey node exercise. */
export function journeyBackUrl(query: ParamMap): string {
  switch (query.get('from')) {
    case JOURNEY_PLUS_FROM: return '/practice/journey-plus';
    case JOURNEY_PLUS_PLUS_FROM: return '/practice/journey-plus-plus';
    default: return '/practice/journey';
  }
}

// NOTE: exercises RETURN to the map with NavController.navigateBack(backUrl)
// rather than router.navigate(backUrl, { replaceUrl: true }). The map pushes
// the exercise onto the ion-router-outlet stack; a forward navigate back to the
// map URL (even with replaceUrl) left a DUPLICATE map page each time, so after
// playing several nodes the back gesture walked through stacked map/exercise
// pages (and could surface a previously-open node) instead of leaving. A back
// navigation pops to the existing map page with no duplication.
