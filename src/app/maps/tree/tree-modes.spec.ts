import { describe, it, expect } from 'vitest';
import { convertToParamMap } from '@angular/router';
import {
  TREE_MODES, REQUIRED_GAMES, GAME_COUNT, isGameMode, tierProgress, modeStates, type TreeModeDef,
} from './tree-modes';
import { journeyBackUrl, tierDetailUrl, tierOriginUrl } from '../journey/journey-back';
import { topicLevelsUpTo, themeLevelOf } from './tree-curriculum';

/** A `passed` predicate from a list of mode ids. */
const passing = (ids: string[]) => (m: TreeModeDef) => ids.includes(m.id);
const GAMES = TREE_MODES.filter(isGameMode).map(m => m.id);

describe('level completion rule (Learn + 5 of 7 games)', () => {
  it('has Learn plus 7 games, 5 of them required', () => {
    expect(REQUIRED_GAMES).toBe(5);
    expect(GAME_COUNT).toBe(7);
    expect(TREE_MODES.filter(m => !isGameMode(m)).map(m => m.id)).toEqual(['learn']);
  });

  it('is incomplete with nothing passed', () => {
    const p = tierProgress(passing([]));
    expect(p.complete).toBe(false);
    expect(p.percent).toBe(0);
  });

  it('is incomplete with Learn + only 4 games', () => {
    const p = tierProgress(passing(['learn', ...GAMES.slice(0, 4)]));
    expect(p.complete).toBe(false);
    expect(p.gamesDone).toBe(4);
    expect(p.percent).toBe(83);   // 5 of 6 steps
  });

  it('is complete with Learn + any 5 games, in any order', () => {
    // Deliberately NOT the first five, to show the order doesn't matter.
    const p = tierProgress(passing(['learn', GAMES[6], GAMES[2], GAMES[4], GAMES[0], GAMES[5]]));
    expect(p.complete).toBe(true);
    expect(p.percent).toBe(100);
  });

  it('needs Learn: 5 games alone do not complete a level', () => {
    const p = tierProgress(passing(GAMES.slice(0, 5)));
    expect(p.complete).toBe(false);
    expect(p.learnDone).toBe(false);
  });

  it('extra games beyond 5 are optional and never push past 100%', () => {
    const p = tierProgress(passing(['learn', ...GAMES]));
    expect(p.gamesDone).toBe(7);
    expect(p.complete).toBe(true);
    expect(p.percent).toBe(100);
  });
});

describe('mode states', () => {
  const idx = (id: string) => TREE_MODES.findIndex(m => m.id === id);

  it('before Learn: Learn is playable, the games are locked', () => {
    const s = modeStates(passing([]));
    expect(s[idx('learn')]).toBe('active');
    for (const g of GAMES) expect(s[idx(g)]).toBe('locked');
  });

  it('after Learn: every game is open at once (any order), passed ones are done', () => {
    const s = modeStates(passing(['learn', 'write']));
    expect(s[idx('learn')]).toBe('done');
    expect(s[idx('write')]).toBe('done');
    for (const g of GAMES.filter(g => g !== 'write')) expect(s[idx(g)]).toBe('active');
  });

  it('an unauthored tier locks everything', () => {
    expect(modeStates(passing(['learn']), false).every(x => x === 'locked')).toBe(true);
  });
});

describe('level page return route', () => {
  it('builds the level page URL for a node + tier + origin', () => {
    expect(tierDetailUrl('food', 2, 'tree-plus')).toBe('/practice/tier/food/2?origin=tree-plus');
  });

  it('an exercise started from the level page returns to that exact page', () => {
    const q = convertToParamMap({ from: 'tier-detail', tierNode: 'core', tierTier: '3', tierOrigin: 'explore-plus' });
    expect(journeyBackUrl(q)).toBe('/practice/tier/core/3?origin=explore-plus');
  });

  it('falls back to the list if the level details are missing', () => {
    expect(journeyBackUrl(convertToParamMap({ from: 'tier-detail', tierOrigin: 'explore-plus' }))).toBe('/practice/explore-plus');
    expect(journeyBackUrl(convertToParamMap({ from: 'tier-detail' }))).toBe('/practice/tree-plus');
  });

  it('maps the origin to its list page', () => {
    expect(tierOriginUrl('explore-plus')).toBe('/practice/explore-plus');
    expect(tierOriginUrl('tree-plus')).toBe('/practice/tree-plus');
    expect(tierOriginUrl(null)).toBe('/practice/tree-plus');
  });
});

describe('topicLevelsUpTo (same-topic wrong answers)', () => {
  it('Core level N → Core levels 1..N', () => {
    expect(topicLevelsUpTo(1)).toEqual([1]);
    expect(topicLevelsUpTo(3)).toEqual([1, 2, 3]);
  });

  it('a theme level → that theme\'s own earlier levels only (never Core or other themes)', () => {
    // Theme #0 tier 2 and theme #1 tier 3.
    expect(topicLevelsUpTo(themeLevelOf(0, 2))).toEqual([themeLevelOf(0, 1), themeLevelOf(0, 2)]);
    expect(topicLevelsUpTo(themeLevelOf(1, 3))).toEqual([themeLevelOf(1, 1), themeLevelOf(1, 2), themeLevelOf(1, 3)]);
  });

  it('is empty for levels outside the Tree layout', () => {
    expect(topicLevelsUpTo(0)).toEqual([]);
    expect(topicLevelsUpTo(-4)).toEqual([]);
    expect(topicLevelsUpTo(99999)).toEqual([]);
  });
});
