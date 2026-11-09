import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { TreePageModule } from './tree.module';
import { TreePage } from './tree.page';
import { FlashcardService } from '../../services/flashcard.service';
import { SettingsService } from '../../services/settings.service';
import { THEME_DEFS } from './tree-curriculum';
import { TREE_MODES } from './tree-modes';

/**
 * Tree page tests (5-modes-per-level build). Each tier contains 5 modes
 * (flip/quiz/write/match/builder); a tier is complete ONLY when all 5 are
 * passed. Progress is keyed `<mode>-<level>`. Level layout: Core 1..6, then
 * each theme's tiers in THEME_DEFS order.
 */

/** Level number of theme[index]'s tier 1 (Core occupies 6 levels). */
function themeTier1Level(themeIndex: number): number {
  let level = 6;
  for (let i = 0; i < THEME_DEFS.length; i++) {
    const first = level + 1;
    level += THEME_DEFS[i].tiers.length;
    if (i === themeIndex) return first;
  }
  return level;
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

const flashcardMock = {
  initialize: () => Promise.resolve(),
  getAvailableLanguages: () => [{ code: 'fr', name: 'French' }],
  registerTreeDeck: () => 'tree-fr',
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
    expect(component.modeNodes.length).toBe(5);
    // First mode (flip) is active; the rest are locked until the previous passes.
    expect(component.modeNodes[0].state).toBe('active');
    expect(component.modeNodes[1].state).toBe('locked');
  });

  it('unlocks the next mode in sequence once the previous is passed', async () => {
    // Core L1 done; food L1 flip passed only.
    const p = makeProgress([1]);
    const foodL1 = themeTier1Level(0);
    p.set(`journey-flip-${foodL1}`, { bestScore: 100 });
    partial = p;
    await component.ngOnInit();
    const food = component.nodes.find(n => n.id === 'food')!;
    component.openTheme(food);
    expect(component.modeNodes[0].state).toBe('done');   // flip done
    expect(component.modeNodes[1].state).toBe('active'); // quiz now active
    expect(component.modeNodes[2].state).toBe('locked'); // write still locked
  });

  it('expands the Core sub-star with 5 modes', async () => {
    doneLevels = [];
    await component.ngOnInit();
    component.openCore();
    expect(component.expandedId).toBe('core');
    expect(component.modeNodes.length).toBe(5);
    expect(component.expandedWords.length).toBeGreaterThan(0);
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
});
