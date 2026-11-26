/**
 * The authored French glossary (no Angular): hand-written words + the lesson
 * and curriculum words. The service adds the course deck on top as a fallback.
 */
import { Glossary, type GlossEntry } from './glossary';
import { COMMON_FRENCH } from './french-glosses';
import { LESSONS } from '../maps/explore-plus/lessons/lessons';
import { CORE_TIERS, THEME_DEFS } from '../maps/tree/tree-curriculum';

const real = (e: GlossEntry): boolean => !!e.fr && e.fr !== '—';

/** The lesson + curriculum words (they add to each other's meanings). */
export function curriculumFrenchEntries(): GlossEntry[] {
  return [
    ...LESSONS.flatMap(l => l.words.map(w => ({ fr: w.fr, en: w.en }))),
    ...CORE_TIERS.flatMap(c => c.words.map(w => ({ fr: w.fr, en: w.en }))),
    ...THEME_DEFS.flatMap(th => th.tiers.flat().map(w => ({ fr: w.fr, en: w.en }))),
  ].filter(real);
}

/** Hand-written words are final; curriculum words add to the rest. */
export function authoredFrenchGlossary(): Glossary {
  return new Glossary().add(COMMON_FRENCH, { lock: true }).add(curriculumFrenchEntries());
}
