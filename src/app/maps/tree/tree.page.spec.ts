import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { NavController } from '@ionic/angular';

import { TreePageModule } from './tree.module';
import { TreePage } from './tree.page';
import { FlashcardService } from '../../services/flashcard.service';
import { SettingsService } from '../../services/settings.service';
import { THEME_DEFS, TREE_LAYOUT, themeLevelOf } from './tree-curriculum';
import { TREE_MODES } from './tree-modes';

/**
 * Tree page tests (5-modes-per-level build). Each tier contains 5 modes
 * (flip/quiz/write/match/builder); a tier is complete ONLY when all 5 are
 * passed. Progress is keyed `<mode>-<level>`. Level layout is FIXED
 * (TREE_LAYOUT): Core tier t → level t; theme #i tier t → coreSlots +
 * i*themeSlots + t.
 */

/** Level number of theme[index]'s tier 1. */
function themeTier1Level(themeIndex: number): number {
  return themeLevelOf(themeIndex, 1);
}

/** Build a progress map where the given levels are FULLY complete (all modes). */
function makeProgress(fullyDoneLevels: number[]): Map<string, { bestScore: number }> {
  const m = new Map<string, { bestScore: number }>();
  for (const lvl of fullyDoneLevels) {
    for (const mode of TREE_MODES) m.set(`${mode.mode}-${lvl}`, { bestScore: 100 });
  }
  return m;
}

let doneLevels: number[] = [];
let partial: Map<string, { bestScore: number }> | null = null;

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
  getDeckLevelProgressMap: () => Promise.resolve(partial ?? makeProgress(doneLevels)),
};

const settingsMock = {
  learningLanguage: () => 'fr',
  appLanguage: () => 'en',
  adminMode: () => false,
  updateSetting: () => { /* noop */ },
};

describe('TreePage (5 modes per level)', () => {
  let component: TreePage;
  let fixture: ComponentFixture<TreePage>;

  beforeEach(async () => {
    doneLevels = [];
    partial = null;
    await TestBed.configureTestingModule({
      imports: [TreePageModule, RouterModule.forRoot([])],
      providers: [
        { provide: FlashcardService, useValue: flashcardMock },
        { provide: SettingsService, useValue: settingsMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TreePage);
    component = fixture.componentInstance;
  });

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  it('registers a fixed-slot deck (tree-v2) so levels never shift', async () => {
    await component.ngOnInit();
    expect(component.deckId).toBe('tree-v2-fr');
    const skills = registered!.groups.map(g => g.skill);
    // Group index + 1 === deck level.
    expect(skills.length).toBe(TREE_LAYOUT.coreSlots + THEME_DEFS.length * TREE_LAYOUT.themeSlots);
    expect(skills[0]).toBe('Core 1');
    expect(skills[TREE_LAYOUT.coreSlots - 1]).toBe(`Core ${TREE_LAYOUT.coreSlots}`);
    THEME_DEFS.forEach((th, i) => expect(skills[themeLevelOf(i, 1) - 1]).toBe(`${th.id}:1`));
  });

  it('passes the Builder a pool of Core 1..T + the theme\'s earlier tiers', async () => {
    // Core L1 + L2 done, food L1 done → food L2 is open.
    doneLevels = [1, 2, themeTier1Level(0), themeTier1Level(1), themeTier1Level(2)];
    await component.ngOnInit();
    const nav = TestBed.inject(NavController);
    const spy = vi.spyOn(nav, 'navigateForward').mockResolvedValue(true);
    const food = component.nodes.find(n => n.id === 'food')!;
    component.openTheme(food);
    expect(component.expandedTier).toBe(2);
    const builder = component.modeNodes.find(m => m.id === 'builder')!;
    component.openMode({ ...builder, state: 'active' });
    const extras = spy.mock.calls[0][1] as { queryParams: Record<string, string | number> };
    expect(extras.queryParams['level']).toBe(themeLevelOf(0, 2));
    expect(extras.queryParams['pool']).toBe(`1,2,${themeLevelOf(0, 1)}`);
  });

  it('starts with Core L1 and all themes locked', async () => {
    doneLevels = [];
    await component.ngOnInit();
    fixture.detectChanges();
    expect(component.coreAvailTier).toBe(1);
    expect(component.coreDoneLevel).toBe(0);
    expect(component.nodes.every(n => n.state === 'locked')).toBe(true);
  });

  it('requires ALL 5 modes to complete a tier (one missing = not complete)', async () => {
    // Core L1 = level 1: pass only 4 of 5 modes → NOT complete → themes stay locked.
    const p = new Map<string, { bestScore: number }>();
    for (const mode of TREE_MODES.slice(0, 4)) p.set(`${mode.mode}-1`, { bestScore: 100 });
    partial = p;
    await component.ngOnInit();
    fixture.detectChanges();
    expect(component.coreDoneLevel).toBe(0);
    expect(component.nodes.every(n => n.state === 'locked')).toBe(true);
  });

  it('unlocks themes (L1) once all 5 modes of Core L1 are done', async () => {
    doneLevels = [1];
    await component.ngOnInit();
    fixture.detectChanges();
    expect(component.coreDoneLevel).toBe(1);
    expect(component.nodes.every(n => n.availTier >= 1)).toBe(true);
  });

  it('shows each theme\'s last completed level on the node', async () => {
    // Core L1 done + food (theme 0) L1 fully done.
    doneLevels = [1, themeTier1Level(0)];
    await component.ngOnInit();
    fixture.detectChanges();
    const food = component.nodes.find(n => n.id === 'food')!;
    expect(food.doneLevel).toBe(1);
  });

  it('3 distinct themes at L1 (all modes) unlock Core L2', async () => {
    doneLevels = [1, themeTier1Level(0), themeTier1Level(1), themeTier1Level(2)];
    await component.ngOnInit();
    fixture.detectChanges();
    expect(component.coreAvailTier).toBe(2);
  });

  it('expands a sub-star of 5 mode nodes when a theme is opened', async () => {
    doneLevels = [1]; // themes L1 available
    await component.ngOnInit();
    const food = component.nodes.find(n => n.id === 'food')!;
    component.openTheme(food);
    expect(component.expandedId).toBe('food');
    expect(component.modeNodes.length).toBe(TREE_MODES.length);
    // First mode (flip) is active; the rest are locked until the previous passes.
    expect(component.modeNodes[0].state).toBe('active');
    expect(component.modeNodes[1].state).toBe('locked');
  });

  it('unlocks the next mode in sequence once the previous is passed', async () => {
    // Core L1 done; food L1 FIRST mode passed only → 2nd unlocks, 3rd stays locked.
    const p = makeProgress([1]);
    const foodL1 = themeTier1Level(0);
    p.set(`${TREE_MODES[0].mode}-${foodL1}`, { bestScore: 100 });
    partial = p;
    await component.ngOnInit();
    const food = component.nodes.find(n => n.id === 'food')!;
    component.openTheme(food);
    expect(component.modeNodes[0].state).toBe('done');   // first mode done
    expect(component.modeNodes[1].state).toBe('active'); // second now active
    expect(component.modeNodes[2].state).toBe('locked'); // third still locked
  });

  it('expands the Core sub-star with 5 modes', async () => {
    doneLevels = [];
    await component.ngOnInit();
    component.openCore();
    expect(component.expandedId).toBe('core');
    expect(component.modeNodes.length).toBe(TREE_MODES.length);
    expect(component.expandedWords.length).toBeGreaterThan(0);
  });

  it('registers each theme level with ONLY its own words (no Core-mix drills)', async () => {
    await component.ngOnInit();
    // Education L1 is a theme group; its registered words must be exactly the
    // curriculum's Education L1 words — no "je / une / oui" Core padding.
    const edu = THEME_DEFS.find(t => t.id === 'education')!;
    const eduL1Skill = `education:1`;
    const group = registered!.groups.find(g => g.skill === eduL1Skill)!;
    const registeredFr = group.words.map(w => w.fr).sort();
    const ownFr = edu.tiers[0].map(w => w.fr).sort();
    expect(registeredFr).toEqual(ownFr);
    // Core-only words must not leak into the theme drill set.
    for (const coreWord of ['je', 'oui', 'et', 'c’est', 'j’ai']) {
      expect(group.words.some(w => w.fr === coreWord)).toBe(false);
    }
  });

  /** Levels to fully complete so theme 0 (food) is open at tier `maxTier`:
   *  Core 1..maxTier done + 3 distinct themes at each tier 1..maxTier-1. */
  function openThemeAtTier(maxTier: number): number[] {
    const levels: number[] = [];
    for (let t = 1; t <= maxTier; t++) levels.push(t); // Core tiers
    for (let t = 1; t < maxTier; t++) {
      for (const ti of [0, 1, 2]) levels.push(themeTier1Level(ti) + (t - 1)); // 3 themes per tier
    }
    // Food's own earlier tiers 1..maxTier-1 (already added for theme 0 above).
    return levels;
  }

  it('lists the current level plus every earlier one, grouped, newest first', async () => {
    // Food (theme 0) reaches L3, so opening it lands on L3 with L1+L2 behind.
    doneLevels = openThemeAtTier(3);
    await component.ngOnInit();
    const food = component.nodes.find(n => n.id === 'food')!;
    component.openTheme(food);
    expect(component.expandedTier).toBe(3);
    // One entry per authored tier, newest first, each with its OWN words.
    expect(component.tierPreviews.map(p => p.tier)).toEqual([3, 2, 1]);
    expect(component.tierPreviews[0].active).toBe(true);
    expect(component.tierPreviews[1].active).toBe(false);
    expect(component.tierPreviews[1].done).toBe(true);
    expect(component.tierPreviews.every(p => p.words.length > 0)).toBe(true);
  });

  it('switches the sub-star to an earlier level to review / replay it', async () => {
    doneLevels = openThemeAtTier(3);
    await component.ngOnInit();
    const food = component.nodes.find(n => n.id === 'food')!;
    component.openTheme(food);
    const l1Words = component.tierPreviews.find(p => p.tier === 1)!.words.map(w => w.fr);
    component.selectTier(1);
    expect(component.expandedTier).toBe(1);
    // The active tier's words + mode nodes now reflect L1, so replay uses them.
    expect(component.expandedWords.map(w => w.fr)).toEqual(l1Words);
    expect(component.tierPreviews.find(p => p.active)!.tier).toBe(1);
  });

  it('starts centred and un-zoomed', async () => {
    await component.ngOnInit();
    expect(component.viewportTransform).toBe('translate(0px, 0px) scale(1)');
  });

  it('pans with a pointer drag', async () => {
    await component.ngOnInit();
    component.onPanPointerDown({ pointerId: 1, clientX: 100, clientY: 100 } as PointerEvent);
    component.onPanPointerMove({ pointerId: 1, clientX: 160, clientY: 130 } as PointerEvent);
    expect(component.viewportTransform).toBe('translate(60px, 30px) scale(1)');
    component.onPanPointerUp({ pointerId: 1 } as PointerEvent);
  });

  it('zooms with the wheel (clamped)', async () => {
    await component.ngOnInit();
    for (let i = 0; i < 20; i++) component.onWheelZoom({ deltaY: -100, preventDefault() {} } as unknown as WheelEvent);
    // Clamped to the max zoom.
    expect(component.viewportTransform).toContain('scale(2.4)');
  });

  it('closes the sub-star on a background click', async () => {
    doneLevels = [1];
    await component.ngOnInit();
    const food = component.nodes.find(n => n.id === 'food')!;
    component.openTheme(food);
    expect(component.expandedId).toBe('food');
    // Click on a plain background element (not a node/button).
    const bg = document.createElement('div');
    component.onBackgroundClick({ target: bg } as unknown as Event);
    expect(component.expandedId).toBeNull();
  });

  it('recenters the map when the sub-star is collapsed', async () => {
    doneLevels = [1];
    await component.ngOnInit();
    // Pan away first.
    component.onPanPointerDown({ pointerId: 1, clientX: 0, clientY: 0 } as PointerEvent);
    component.onPanPointerMove({ pointerId: 1, clientX: 120, clientY: 80 } as PointerEvent);
    component.onPanPointerUp({ pointerId: 1 } as PointerEvent);
    expect(component.viewportTransform).not.toBe('translate(0px, 0px) scale(1)');
    // Collapsing recenters.
    component.collapse();
    expect(component.viewportTransform).toBe('translate(0px, 0px) scale(1)');
  });

  it('does NOT close when the click lands on a mode node', async () => {
    doneLevels = [1];
    await component.ngOnInit();
    const food = component.nodes.find(n => n.id === 'food')!;
    component.openTheme(food);
    // Simulate a click whose target is inside a .tree-mode element.
    const modeBtn = document.createElement('button');
    modeBtn.className = 'tree-mode';
    const icon = document.createElement('span');
    modeBtn.appendChild(icon);
    component.onBackgroundClick({ target: icon } as unknown as Event);
    expect(component.expandedId).toBe('food');
  });
});
