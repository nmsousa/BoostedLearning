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

/** Fully complete so theme 0 reaches tier `maxTier`: Core 1..maxTier + 3 themes per earlier tier. */
function openThemeAtTier(maxTier: number): number[] {
  const levels: number[] = [];
  for (let t = 1; t <= maxTier; t++) levels.push(t);
  for (let t = 1; t < maxTier; t++) for (const ti of [0, 1, 2]) levels.push(themeTier1Level(ti) + (t - 1));
  return levels;
}

let doneLevels: number[] = [];
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
  getDeckLevelProgressMap: () => Promise.resolve(makeProgress(doneLevels)),
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
    expect(component.themes.every(n => n.state === 'locked')).toBe(true);
  });

  it('unlocks themes once Core L1 is complete', async () => {
    doneLevels = [1];
    await component.ngOnInit();
    expect(component.core.doneLevel).toBe(1);
    expect(component.themes.every(n => n.availTier >= 1)).toBe(true);
  });

  it('shows a "next Core" tier that advances with progress', async () => {
    doneLevels = [1];
    await component.ngOnInit();
    expect(component.nextCoreTier).toBe(2);
  });

  it('expands a node inline into its tiers + 5 activities (newest first)', async () => {
    doneLevels = openThemeAtTier(3);
    await component.ngOnInit();
    const food = component.themes.find(n => n.id === 'food')!;
    component.toggleNode(food);
    expect(component.expandedId).toBe('food');
    expect(component.expandedTiers.map(t => t.tier)).toEqual([3, 2, 1]);
    expect(component.expandedTiers[0].modes.length).toBe(TREE_MODES.length);
    // Earlier tiers are complete.
    expect(component.expandedTiers.find(t => t.tier === 1)!.done).toBe(true);
  });

  it('toggling the same node closes it', async () => {
    doneLevels = [1];
    await component.ngOnInit();
    const food = component.themes.find(n => n.id === 'food')!;
    component.toggleNode(food);
    expect(component.expandedId).toBe('food');
    component.toggleNode(food);
    expect(component.expandedId).toBeNull();
  });

  it('launches a mode with the deck, level and Builder pool', async () => {
    doneLevels = openThemeAtTier(2);
    await component.ngOnInit();
    const nav = TestBed.inject(NavController);
    const spy = vi.spyOn(nav, 'navigateForward').mockResolvedValue(true);
    const food = component.themes.find(n => n.id === 'food')!;
    component.toggleNode(food);
    const tier2 = component.expandedTiers.find(t => t.tier === 2)!;
    const builderIdx = tier2.modes.findIndex(m => m.id === 'builder');
    // Builder is locked until the earlier 4 modes pass; force a launch directly.
    component.onModeTap({ ...tier2, modes: tier2.modes.map(m => ({ ...m, state: 'active' })) }, builderIdx);
    const [route, extras] = spy.mock.calls[0] as [string[], { queryParams: Record<string, string | number> }];
    expect(route).toEqual(['/practice/journey-builder', 'tree-v2-fr']);
    expect(extras.queryParams['level']).toBe(themeLevelOf(0, 2));
    expect(extras.queryParams['pool']).toBe(`1,2,${themeLevelOf(0, 1)}`);
  });

  it('computes a rough percent-learned for a node', async () => {
    doneLevels = [1, themeTier1Level(0)]; // Core 1 + food L1 fully done
    await component.ngOnInit();
    const food = component.themes.find(n => n.id === 'food')!;
    // food availTier 1, all 5 modes done → 100%.
    expect(component.percentOf(food)).toBe(100);
  });
});
