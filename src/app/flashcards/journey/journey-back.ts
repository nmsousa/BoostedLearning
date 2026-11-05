/**
 * Where a Journey node exercise returns to when it finishes / closes.
 *
 * Both the classic Journey map and the Journey+ redesign launch the SAME node
 * exercises (journey-flip, journey-quiz, …). Journey+ adds `?from=journey-plus`
 * to the node route so the exercise returns to the page that started it.
 *
 * @module app/flashcards/journey
 */
import type { ParamMap } from '@angular/router';

/** Query-param value Journey+ passes in `from`. */
export const JOURNEY_PLUS_FROM = 'journey-plus';

/** Return route for a Journey node exercise. */
export function journeyBackUrl(query: ParamMap): string {
  return query.get('from') === JOURNEY_PLUS_FROM ? '/practice/journey-plus' : '/practice/journey';
}
