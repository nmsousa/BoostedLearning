import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { TreePageModule } from './tree.module';
import { TreePage } from './tree.page';
import { FlashcardService } from '../../services/flashcard.service';
import { SettingsService } from '../../services/settings.service';
import { THEME_DEFS } from './tree-curriculum';

/**
 * Tree page tests (curriculum build): Core-first gating. The synthetic deck +
 * progress are mocked. `progress` is a Map keyed `journey-flip-<level>`; the
 * page marks a milestone complete when bestScore >= 70.
 *
 * Level layout from the page's load(): Core 1..6 occupy levels 1..6, then the
 * themes occupy levels 7.. in THEME_DEFS order.
 */

function makeProgress(passedLevels: number[]): Map<string, { bestScore: number }> {
  const m = new Map<string, { bestScore: number }>();
  for (const lvl of passedLevels) m.set(`journey-flip-${lvl}`, { bestScore: 100 });
  return m;
}

let progressLevels: number[] = [];

const flashcardMock = {
  initialize: () => Promise.resolve(),
  getAvailableLanguages: () => [{ code: 'fr', name: 'French' }],
  registerTreeDeck: () => 'tree-fr',
  getDeckLevelProgressMap: () => Promise.resolve(makeProgress(progressLevels)),
};

const settingsMock = {
  learningLanguage: () => 'fr',
  appLanguage: () => 'en',
  adminMode: () => false,
  updateSetting: () => { /* noop */ },
};

describe('TreePage (curriculum)', () => {
  let component: TreePage;
  let fixture: ComponentFixture<TreePage>;

  beforeEach(async () => {
    progressLevels = [];
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
    progressLevels = []; // nothing passed
    await component.ngOnInit();
    fixture.detectChanges();
    expect(component.coreTier).toBe(1);
    // No theme is available until Core L1 is complete.
    expect(component.nodes.every(n => n.state === 'locked')).toBe(true);
  });

  it('unlocks themes (L1) once Core L1 is complete', async () => {
    progressLevels = [1]; // Core 1 is level 1
    await component.ngOnInit();
    fixture.detectChanges();
    expect(component.coreTier).toBe(1);
    expect(component.nodes.every(n => n.state === 'active')).toBe(true);
  });

  it('keeps Core at L1 until 3 distinct themes are done, then unlocks Core L2', async () => {
    // Core 1 (level 1) + first 3 theme L1s (levels 7,8,9).
    const coreLevel = 1;
    const themeLevels = [7, 8, 9];
    progressLevels = [coreLevel, ...themeLevels];
    await component.ngOnInit();
    fixture.detectChanges();
    expect(component.coreTier).toBe(2);
  });

  it('does NOT unlock Core L2 with only 2 themes done', async () => {
    progressLevels = [1, 7, 8];
    await component.ngOnInit();
    fixture.detectChanges();
    expect(component.coreTier).toBe(1);
  });

  it('shows one radial node per theme', async () => {
    await component.ngOnInit();
    expect(component.nodes.length).toBe(THEME_DEFS.length);
  });

  it('opens the Core panel with lesson rows', async () => {
    progressLevels = [1];
    await component.ngOnInit();
    component.openCore();
    expect(component.panelOpen).toBe(true);
    expect(component.panelLessons.length).toBeGreaterThan(0);
    // Core L1 lesson is playable (active) and authored.
    const l1 = component.panelLessons[0];
    expect(l1.authored).toBe(true);
  });
});
