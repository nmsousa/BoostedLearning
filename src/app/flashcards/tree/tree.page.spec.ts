import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { TreePageModule } from './tree.module';
import { TreePage } from './tree.page';
import { FlashcardService } from '../../services/flashcard.service';
import { SettingsService } from '../../services/settings.service';

/**
 * Tree page tests: focus on the radial view-model — progress calculation
 * (per-unit % and the aggregate hub %), unit/lesson state derivation, and the
 * even radial spread. The data pipeline is mocked so the assertions are
 * deterministic.
 */

// Three skill levels: level 1 fully complete, level 2 in progress (flip passed),
// level 3 locked (prev not complete). Progress keyed `${mode}-${levelNumber}`.
const LEVELS = [
  { levelNumber: 1, startIndex: 0, endIndex: 4, cardCount: 5, bestStars: 3, bestScore: 100, roundsCompleted: 5, attempts: 1, isUnlocked: true, skill: 'Greetings' },
  { levelNumber: 2, startIndex: 5, endIndex: 9, cardCount: 5, bestStars: 0, bestScore: 0, roundsCompleted: 0, attempts: 0, isUnlocked: true, skill: 'Travel' },
  { levelNumber: 3, startIndex: 10, endIndex: 14, cardCount: 5, bestStars: 0, bestScore: 0, roundsCompleted: 0, attempts: 0, isUnlocked: false, skill: 'Food' },
];

function progressMap(): Map<string, { bestScore: number }> {
  const m = new Map<string, { bestScore: number }>();
  // Level 1: every node passed (bestScore >= 70).
  for (const mode of ['journey-flip', 'journey-quiz', 'journey-write', 'journey-match', 'journey-builder']) {
    m.set(`${mode}-1`, { bestScore: 100 });
  }
  // Level 2: only the first node (flip) passed → unit is "active", 1/5 done.
  m.set('journey-flip-2', { bestScore: 90 });
  return m;
}

const flashcardMock = {
  initialize: () => Promise.resolve(),
  getAvailableLanguages: () => [{ code: 'nl', name: 'Dutch' }],
  getAllDecks: () => [{ id: 'd1', name: 'Dutch', languageCode: 'nl', cards: [] }],
  getDeckLevels: () => Promise.resolve(LEVELS),
  getDeckLevelProgressMap: () => Promise.resolve(progressMap()),
};

const settingsMock = {
  learningLanguage: () => 'nl',
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

  it('builds one unit per level with the right state', async () => {
    await component.ngOnInit();
    fixture.detectChanges();
    expect(component.units.length).toBe(3);
    expect(component.units[0].state).toBe('done');    // level 1 complete
    expect(component.units[1].state).toBe('active');  // level 2 in progress
    expect(component.units[2].state).toBe('locked');  // level 3 gated
  });

  it('computes per-unit progress and the aggregate hub %', async () => {
    await component.ngOnInit();
    // Unit 1: 5/5 nodes done = 100%.
    expect(component.units[0].pct).toBe(100);
    expect(component.units[0].done).toBe(5);
    // Unit 2: 1/5 nodes done = 20%.
    expect(component.units[1].pct).toBe(20);
    expect(component.units[1].done).toBe(1);
    // Unit 3: 0/5 = 0%.
    expect(component.units[2].pct).toBe(0);
    // Hub = total done / total nodes = (5 + 1 + 0) / 15 = 40%.
    expect(component.hubPct).toBe(40);
    expect(component.hubStarted).toBe(true);
  });

  it('spreads units evenly around the circle starting at the top', async () => {
    await component.ngOnInit();
    // 3 units → 120° apart, first at -90° (top).
    expect(component.units[0].angle).toBe(-90);
    expect(component.units[1].angle).toBe(30);
    expect(component.units[2].angle).toBe(150);
  });

  it('marks lesson dots done/active/locked within a unit', async () => {
    await component.ngOnInit();
    // Unit 2: flip done, quiz is the next active one, rest locked.
    const lessons = component.units[1].lessons;
    expect(lessons[0].state).toBe('done');
    expect(lessons[1].state).toBe('active');
    expect(lessons[2].state).toBe('locked');
  });
});
