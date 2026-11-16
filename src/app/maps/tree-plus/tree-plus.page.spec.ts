import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { NavController } from '@ionic/angular';

import { TreePlusPageModule } from './tree-plus.module';
import { TreePlusPage } from './tree-plus.page';
import { FlashcardService } from '../../services/flashcard.service';
import { SettingsService } from '../../services/settings.service';
import { THEME_DEFS, TREE_LAYOUT, themeLevelOf } from '../tree/tree-curriculum';
import { TREE_MODES } from '../tree/tree-modes';

/**
 * Tree+ tests. Tree+ is a vertical view over the SAME TreeEngine as the star
 * Tree, so it shares the deck, layout and progression. These verify the engine
 * is driven correctly and the Builder pool is passed on launch.
 */

function themeTier1Level(i: number): number { return themeLevelOf(i, 1); }

function makeProgress(fullyDoneLevels: number[]): Map<string, { bestScore: number }> {
  const m = new Map<string, { bestScore: number }>();
  for (const lvl of fullyDoneLevels) for (const mode of TREE_MODES) m.set(`${mode.mode}-${lvl}`, { bestScore: 100 });
  return m;
}

/** Levels for ALL themes that author tier `tier`. Core/Theme N+1 now unlock
 *  only once EVERY theme's tier N is complete (strict rule). */
function allThemesAtTier(tier: number): number[] {
  const levels: number[] = [];
  THEME_DEFS.forEach((th, i) => { if (tier <= th.tiers.length) levels.push(themeLevelOf(i, tier)); });
  return levels;
}

/** Fully complete so theme 0 reaches tier `maxTier`: Core 1..maxTier + ALL
 *  themes at each earlier tier. */
function openThemeAtTier(maxTier: number): number[] {
  const levels: number[] = [];
  for (let t = 1; t <= maxTier; t++) levels.push(t);
  for (let t = 1; t < maxTier; t++) levels.push(...allThemesAtTier(t));
  return levels;
}

let doneLevels: number[] = [];
/** Extra individually-passed modes, as "<mode>-<level>" keys (partial progress). */
let extraPassed: string[] = [];
interface TreeGroup { skill: string; words: { fr: string; en: string }[] }
let registered: { lang: string; groups: TreeGroup[]; prefix?: string } | null = null;

const flashcardMock = {
  initialize: () => Promise.resolve(),
  getAvailableLanguages: () => [{ code: 'fr', name: 'French' }],
  registerTreeDeck: (lang: string, groups: TreeGroup[], prefix?: string) => {
    registered = { lang, groups, prefix };
    return `${prefix ?? 'tree'}-${lang}`;
  },
  getLevelCards: () => [],
  getDeckLevelProgressMap: () => {
    const m = makeProgress(doneLevels);
    for (const key of extraPassed) m.set(key, { bestScore: 100 });
    return Promise.resolve(m);
  },
};

const settingsMock = {
  learningLanguage: () => 'fr',
  appLanguage: () => 'en',
  adminMode: () => false,
  updateSetting: () => { /* noop */ },
};

describe('TreePlusPage (vertical Tree)', () => {
  let component: TreePlusPage;
  let fixture: ComponentFixture<TreePlusPage>;

  beforeEach(async () => {
    doneLevels = [];
    extraPassed = [];
    registered = null;
    await TestBed.configureTestingModule({
      imports: [TreePlusPageModule, RouterModule.forRoot([])],
      providers: [
        { provide: FlashcardService, useValue: flashcardMock },
        { provide: SettingsService, useValue: settingsMock },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TreePlusPage);
    component = fixture.componentInstance;
  });

  it('creates and shares the Tree deck (tree-v2)', async () => {
    await component.ngOnInit();
    expect(registered!.prefix).toBe('tree-v2');
    // Same fixed slot layout as the star Tree.
    expect(registered!.groups.length).toBe(TREE_LAYOUT.coreSlots + THEME_DEFS.length * TREE_LAYOUT.themeSlots);
  });

  it('starts with Core active and all themes locked', async () => {
    doneLevels = [];
    await component.ngOnInit();
    expect(component.core.state).toBe('active');
    expect(component.core.doneLevel).toBe(0);
    // Strict rule: themes open only once the matching Core tier is COMPLETED,
    // so before Core L1 is done every theme is locked.
    expect(component.themes.every(n => n.state === 'locked')).toBe(true);
  });

  it('unlocks themes once Core L1 is complete', async () => {
    doneLevels = [1];
    await component.ngOnInit();
    expect(component.core.doneLevel).toBe(1);
    expect(component.themes.every(n => n.availTier >= 1)).toBe(true);
  });

  it('Core reads Level 1 at the start (not Level 0)', async () => {
    doneLevels = [];
    await component.ngOnInit();
    expect(component.currentTier(component.core)).toBe(1);
  });

  it('opens the shared level page for a node (its current level)', async () => {
    doneLevels = openThemeAtTier(3);
    await component.ngOnInit();
    const nav = TestBed.inject(NavController);
    const spy = vi.spyOn(nav, 'navigateForward').mockResolvedValue(true);
    const food = component.themes.find(n => n.id === 'food')!;
    component.toggleNode(food);
    expect(spy).toHaveBeenCalledWith(['/practice/tier', 'food', 3], { queryParams: { origin: 'tree-plus' } });
  });

  it('does not open a locked node', async () => {
    doneLevels = [];
    await component.ngOnInit();
    const nav = TestBed.inject(NavController);
    const spy = vi.spyOn(nav, 'navigateForward').mockResolvedValue(true);
    component.toggleNode(component.themes[0]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('the Core is the next thing to do at the start, with Continue playing Learn', async () => {
    doneLevels = [];
    await component.ngOnInit();
    expect(component.nextTargetId).toBe('core');
    expect(component.isNext(component.core)).toBe(true);
    const nav = TestBed.inject(NavController);
    const spy = vi.spyOn(nav, 'navigateForward').mockResolvedValue(true);
    component.continueNext();
    const [route, extras] = spy.mock.calls[0] as [string[], { queryParams: Record<string, string | number> }];
    expect(route).toEqual(['/practice/learn', 'tree-v2-fr']);
    expect(extras.queryParams['level']).toBe(1);
    expect(extras.queryParams['from']).toBe('tree-plus');
  });

  it('once the Core level is complete, the next target and Continue move to the first topic', async () => {
    doneLevels = [1];
    await component.ngOnInit();
    expect(component.isTierDone(component.core)).toBe(true);
    expect(component.nextTargetId).toBe('food');
    const nav = TestBed.inject(NavController);
    const spy = vi.spyOn(nav, 'navigateForward').mockResolvedValue(true);
    component.continueNext();
    const [route, extras] = spy.mock.calls[0] as [string[], { queryParams: Record<string, string | number> }];
    expect(route).toEqual(['/practice/learn', 'tree-v2-fr']);
    expect(extras.queryParams['level']).toBe(themeLevelOf(0, 1));
  });

  it('Continue picks a game (not Learn) once Learn is done', async () => {
    // Core L1: Learn passed, no games yet → the next activity is the first game.
    extraPassed = ['journey-learn-1'];
    await component.ngOnInit();
    const nav = TestBed.inject(NavController);
    const spy = vi.spyOn(nav, 'navigateForward').mockResolvedValue(true);
    component.continueNext();
    const [route] = spy.mock.calls[0] as [string[]];
    expect(route[0]).toBe('/practice/quiz');
  });

  it('progress follows the rule: Learn + 3 games of 5 = 4 of 6 steps = 67%', async () => {
    extraPassed = ['journey-learn-1', 'journey-quiz-1', 'journey-write-1', 'journey-match-1'];
    await component.ngOnInit();
    expect(component.percentOf(component.core)).toBe(67);
    expect(component.isTierDone(component.core)).toBe(false);
  });

  it('Learn + any 5 games completes the level (even skipping some games)', async () => {
    // Skips Match + Match Audio; plays quiz, write, builder, builder+, mix.
    extraPassed = ['journey-learn-1', 'journey-quiz-1', 'journey-write-1', 'journey-builder-1', 'journey-builder-plus-1', 'journey-mix-1'];
    await component.ngOnInit();
    expect(component.percentOf(component.core)).toBe(100);
    expect(component.isTierDone(component.core)).toBe(true);
    expect(component.core.doneLevel).toBe(1);
  });

  it('a completed tier stays at 100% until the NEXT tier unlocks', async () => {
    // Core 1 + food L1 fully done, but food L2 isn't unlocked yet (Core 2 not
    // done). The card must read its completed tier at 100% — NOT jump to the
    // next (still-locked) tier at 0%. It only moves on once L2 actually opens.
    doneLevels = [1, themeTier1Level(0)];
    await component.ngOnInit();
    const food = component.themes.find(n => n.id === 'food')!;
    expect(component.currentTier(food)).toBe(1);
    expect(component.percentOf(food)).toBe(100);
  });

  it('percent is 100% only once the LAST authored tier is complete', async () => {
    // Open food up to its last tier, THEN complete that last tier too, so
    // food.doneLevel === maxTier → the node reads 100%.
    const food0 = THEME_DEFS.find(t => t.id === 'food')!;
    const lastTier = food0.tiers.length;
    const foodIdx = THEME_DEFS.findIndex(t => t.id === 'food');
    doneLevels = [...openThemeAtTier(lastTier), themeLevelOf(foodIdx, lastTier)];
    await component.ngOnInit();
    const food = component.themes.find(n => n.id === 'food')!;
    expect(food.doneLevel).toBe(lastTier);
    expect(component.percentOf(food)).toBe(100);
  });
});
