/**
 * Tree themes — grouping the deck's many skill chapters into a SMALL set of
 * thematic units for the radial map.
 *
 * A Duolingo-style deck has hundreds of skills (e.g. the French deck has ~295:
 * "Order at a café", "Talk about your family", …). Showing one radial node per
 * skill is unreadable, so the Tree map groups every chapter into ~11 themes by
 * keyword-matching its skill name. Each theme keeps its chapters as "lessons"
 * shown in a detail view when the theme is opened.
 *
 * This is a pure, deterministic module (no Angular, no services) so it can be
 * unit-tested directly.
 *
 * @module app/flashcards/tree
 */

import type { JourneyChapter } from '../journey/journey-model';

/** A theme definition: id, display key, emoji, colour hue, and match rules. */
export interface ThemeDef {
  id: string;
  /** i18n key for the theme name (tree.theme.<id>). */
  nameKey: string;
  emoji: string;
  /** Base hue (deg) for the node gradient. */
  hue: number;
  /** Lower-cased keywords; a chapter joins the FIRST theme that matches. */
  keywords: readonly string[];
}

/**
 * Theme taxonomy, in radial order. Colours roughly follow the concept mockup.
 * `keywords` are matched (substring, case-insensitive) against the skill name.
 * Order matters: the first matching theme wins, so put more specific themes
 * before broad ones.
 */
export const TREE_THEMES: readonly ThemeDef[] = [
  { id: 'food',          nameKey: 'tree.theme.food',          emoji: '🍽️', hue: 140, keywords: ['café', 'cafe', 'bakery', 'baking', 'food', 'drink', 'cook', 'dinner', 'breakfast', 'grocer', 'restaurant', 'meal', 'lunch'] },
  { id: 'travel',        nameKey: 'tree.theme.travel',        emoji: '✈️', hue: 350, keywords: ['travel', 'trip', 'flight', 'hotel', 'pack', 'vacation', 'holiday', 'direction', 'cities', 'city', 'countr', 'abroad'] },
  { id: 'relationships', nameKey: 'tree.theme.relationships', emoji: '❤️', hue: 275, keywords: ['family', 'friend', 'love', 'relationship', 'neighbor', 'neighbour', 'relative', 'wedding', 'people', 'trait', 'greet', 'introduc', 'kids', 'guest', 'gossip', 'community', 'date'] },
  { id: 'home',          nameKey: 'tree.theme.home',          emoji: '🏠', hue: 190, keywords: ['house', 'home', 'belonging', 'host', 'party', 'furniture', 'room', 'chore', 'mess'] },
  { id: 'health',        nameKey: 'tree.theme.health',        emoji: '🩺', hue: 165, keywords: ['health', 'doctor', 'hygiene', 'injur', 'yoga', 'workout', 'body', 'medic', 'sick', 'appointment'] },
  { id: 'education',     nameKey: 'tree.theme.education',     emoji: '🎓', hue: 215, keywords: ['school', 'class', 'exam', 'study', 'studies', 'teacher', 'language', 'learn', 'universit'] },
  { id: 'work',          nameKey: 'tree.theme.work',          emoji: '💼', hue: 255, keywords: ['job', 'work', 'colleague', 'career', 'bank', 'customer service', 'office', 'business', 'meeting', 'project'] },
  { id: 'shopping',      nameKey: 'tree.theme.shopping',      emoji: '🛍️', hue: 30,  keywords: ['cloth', 'shop', 'buy', 'price', 'store', 'money'] },
  { id: 'culture',       nameKey: 'tree.theme.culture',       emoji: '🎭', hue: 50,  keywords: ['music', 'theater', 'theatre', 'concert', 'sport', 'game', 'art exhibit', 'exhibit', 'novel', 'festival', 'zoo', 'histor', 'film', 'movie', 'book', 'perform'] },
  { id: 'nature',        nameKey: 'tree.theme.nature',        emoji: '🌳', hue: 100, keywords: ['outdoor', 'weather', 'nature', 'animal', 'pet', 'science', 'tech', 'electronic', 'internet', 'online', 'post'] },
  // Fallback bucket LAST — catches anything unmatched (routines, feelings, etc.).
  { id: 'daily',         nameKey: 'tree.theme.daily',         emoji: '💬', hue: 25,  keywords: [] },
];

/** The fallback theme id (receives chapters no other theme matched). */
export const TREE_FALLBACK_THEME = 'daily';

/** A theme with its member chapters + rolled-up progress. */
export interface TreeTheme {
  def: ThemeDef;
  /** Member chapters, in course order. */
  chapters: JourneyChapter[];
  /** Completed chapters (all nodes passed). */
  doneChapters: number;
  totalChapters: number;
  /** % of this theme's lessons (chapter nodes) that are passed. */
  pct: number;
  /** done / active / locked for the theme node. */
  state: 'done' | 'active' | 'locked';
}

/** Pick the theme id a chapter belongs to (first keyword match, else fallback). */
export function themeIdForSkill(skill: string): string {
  const s = (skill || '').toLowerCase();
  for (const t of TREE_THEMES) {
    if (t.keywords.length === 0) continue; // skip the fallback here
    if (t.keywords.some(k => s.includes(k))) return t.id;
  }
  return TREE_FALLBACK_THEME;
}

/**
 * Group chapters into themes. Only themes that actually have member chapters
 * are returned, preserving TREE_THEMES order. Progress is rolled up from the
 * chapters' node pass-state.
 *
 * Theme state:
 *  - done   = every member chapter is complete;
 *  - locked = no member chapter is unlocked yet;
 *  - active = otherwise (some chapter is unlocked and not all complete).
 */
export function groupChaptersIntoThemes(chapters: JourneyChapter[]): TreeTheme[] {
  const byId = new Map<string, JourneyChapter[]>();
  for (const ch of chapters) {
    const id = themeIdForSkill(ch.name);
    const list = byId.get(id) ?? [];
    list.push(ch);
    byId.set(id, list);
  }

  const themes: TreeTheme[] = [];
  for (const def of TREE_THEMES) {
    const members = byId.get(def.id);
    if (!members || members.length === 0) continue;

    const totalNodes = members.reduce((s, c) => s + c.nodes.length, 0);
    const doneNodes = members.reduce((s, c) => s + c.done, 0);
    const doneChapters = members.filter(c => c.complete).length;
    const anyUnlocked = members.some(c => c.unlocked);
    const allComplete = members.every(c => c.complete);

    themes.push({
      def,
      chapters: members,
      doneChapters,
      totalChapters: members.length,
      pct: totalNodes === 0 ? 0 : Math.round((doneNodes / totalNodes) * 100),
      state: allComplete ? 'done' : anyUnlocked ? 'active' : 'locked',
    });
  }
  return themes;
}
