import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { TreePageModule } from './tree.module';
import { TreePage } from './tree.page';
import { FlashcardService } from '../../services/flashcard.service';
import { SettingsService } from '../../services/settings.service';

/**
 * Tree page tests: the page groups the deck's skill levels into themes
 * (tree-themes.ts is tested separately) and builds the radial node view-model
 * + the aggregate hub %. The data pipeline is mocked for determinism.
 */

// Skill levels across a few themes. Level 1 (food) complete; level 2 (family /
// relationships) in progress; level 3 (travel) locked.
const LEVELS = [
  { levelNumber: 1, startIndex: 0, endIndex: 4, cardCount: 5, bestStars: 3, bestScore: 100, roundsCompleted: 5, attempts: 1, isUnlocked: true, skill: 'Order at a café' },
  { levelNumber: 2, startIndex: 5, endIndex: 9, cardCount: 5, bestStars: 0, bestScore: 0, roundsCompleted: 0, attempts: 0, isUnlocked: true, skill: 'Talk about your family' },
  { levelNumber: 3, startIndex: 10, endIndex: 14, cardCount: 5, bestStars: 0, bestScore: 0, roundsCompleted: 0, attempts: 0, isUnlocked: false, skill: 'Book a hotel room' },
];

// NOTE: a FRENCH deck appends the 'journey-blanks' node, so each level has 6
// nodes. Level 1 must pass ALL 6 to be complete.
function progressMap(): Map<string, { bestScore: number }> {
  const m = new Map<string, { bestScore: number }>();
  // Level 1: all 6 nodes passed → food theme complete.
  for (const mode of ['journey-flip', 'journey-quiz', 'journey-write', 'journey-match', 'journey-builder', 'journey-blanks']) {
    m.set(`${mode}-1`, { bestScore: 100 });
  }
  // Level 2: only flip passed → relationships theme active.
  m.set('journey-flip-2', { bestScore: 90 });
  return m;
}

const flashcardMock = {
  initialize: () => Promise.resolve(),
  getAvailableLanguages: () => [{ code: 'fr', name: 'French' }],
  getAllDecks: () => [{ id: 'd1', name: 'French', languageCode: 'fr', cards: [] }],
  getDeckLevels: () => Promise.resolve(LEVELS),
  getDeckLevelProgressMap: () => Promise.resolve(progressMap()),
};

const settingsMock = {
  learningLanguage: () => 'fr',
  appLanguage: () => 'en',
  adminMode: () => false,
  updateSetting: () => { /* noop */ },
};

describe('TreePage', () => {
  let component: TreePage;
  let fixture: ComponentFixture<TreePage>;

  beforeEach(async () => {
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

  it('builds one radial node per theme (not per skill level)', async () => {
    await component.ngOnInit();
    fixture.detectChanges();
    // 3 levels → 3 distinct themes: food, relationships, travel.
    expect(component.nodes.length).toBe(3);
    const ids = component.nodes.map(n => n.theme.def.id).sort();
    expect(ids).toEqual(['food', 'relationships', 'travel']);
  });

  it('derives theme state from its chapters', async () => {
    await component.ngOnInit();
    const byId = Object.fromEntries(component.nodes.map(n => [n.theme.def.id, n.state]));
    expect(byId['food']).toBe('done');           // level 1 complete
    expect(byId['relationships']).toBe('active'); // level 2 in progress
    expect(byId['travel']).toBe('locked');        // level 3 gated
  });

  it('computes the aggregate hub %', async () => {
    await component.ngOnInit();
    // French deck → 6 nodes per level, 3 levels = 18 total.
    // done nodes = 6 (L1) + 1 (L2) + 0 (L3) = 7 of 18 ≈ 39%.
    expect(component.hubPct).toBe(Math.round((7 / 18) * 100));
    expect(component.hubStarted).toBe(true);
  });

  it('opens a theme into a readable lesson list', async () => {
    await component.ngOnInit();
    const food = component.nodes.find(n => n.theme.def.id === 'food')!;
    component.openThemeNode(food);
    expect(component.openTheme).toBe(food);
    expect(component.openLessons.length).toBe(1);
    expect(component.openLessons[0].state).toBe('done');
  });

  it('spreads theme nodes evenly starting at the top', async () => {
    await component.ngOnInit();
    // 3 nodes → first at the top; x≈centre, y above centre.
    expect(component.nodes[0].y).toBeLessThan(component.view / 2);
    expect(Math.round(component.nodes[0].x)).toBe(component.view / 2);
  });
});
