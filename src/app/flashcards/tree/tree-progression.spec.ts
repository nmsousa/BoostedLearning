import { describe, it, expect } from 'vitest';
import {
  computeProgression, coreMilestoneId, themeMilestoneId,
  distinctThemesCompletedAtTier, type ProgressionInput,
} from './tree-progression';

const THEMES = ['food', 'travel', 'health', 'home', 'education'];

// Helper: build the input with a set of completed ids. By default every theme
// has tiers 1..6.
function input(completed: string[], opts?: Partial<ProgressionInput>): ProgressionInput {
  return {
    config: { coreTiers: 6, themesToAdvance: 3 },
    themeIds: THEMES,
    themeHasTier: () => true,
    completed: new Set(completed),
    ...opts,
  };
}

describe('tree-progression', () => {
  it('Core L1 is the only initial unlock; themes locked until Core L1 is done', () => {
    const s = computeProgression(input([]));
    expect(s.unlockedCoreTier).toBe(1);
    // Themes are NOT available until Core L1 is completed.
    for (const id of THEMES) expect(s.unlockedThemeTier[id]).toBe(0);
  });

  it('completing Core L1 unlocks Theme L1 (but not Core L2 yet)', () => {
    const s = computeProgression(input([coreMilestoneId(1)]));
    expect(s.unlockedCoreTier).toBe(1);
    for (const id of THEMES) expect(s.unlockedThemeTier[id]).toBe(1);
  });

  it('3 distinct Theme L1 milestones + Core L1 unlock Core L2', () => {
    const s = computeProgression(input([
      coreMilestoneId(1),
      themeMilestoneId('food', 1),
      themeMilestoneId('travel', 1),
      themeMilestoneId('health', 1),
    ]));
    expect(s.unlockedCoreTier).toBe(2);
    // Core L2 is unlocked but NOT yet completed, so themes stay at tier 1.
    expect(s.unlockedThemeTier['food']).toBe(1);
  });

  it('completing Core L2 then exposes theme tier 2', () => {
    const s = computeProgression(input([
      coreMilestoneId(1),
      themeMilestoneId('food', 1), themeMilestoneId('travel', 1), themeMilestoneId('health', 1),
      coreMilestoneId(2),
    ]));
    expect(s.unlockedCoreTier).toBe(2);
    expect(s.unlockedThemeTier['food']).toBe(2);
  });

  it('does NOT unlock Core L2 with only 2 distinct themes', () => {
    const s = computeProgression(input([
      coreMilestoneId(1),
      themeMilestoneId('food', 1),
      themeMilestoneId('travel', 1),
    ]));
    expect(s.unlockedCoreTier).toBe(1);
  });

  it('does NOT count the same theme twice', () => {
    // food completed at tier 1 appears once; duplicates can't exist in a Set,
    // but completing food's OTHER tiers must not count toward tier-1 distinct.
    const s = computeProgression(input([
      coreMilestoneId(1),
      themeMilestoneId('food', 1),
      themeMilestoneId('food', 2), // different tier, shouldn't help tier-1 gate
      themeMilestoneId('travel', 1),
    ]));
    expect(s.unlockedCoreTier).toBe(1);
  });

  it('advances through multiple tiers when gates are met', () => {
    const completed = [
      coreMilestoneId(1),
      themeMilestoneId('food', 1), themeMilestoneId('travel', 1), themeMilestoneId('health', 1),
      coreMilestoneId(2),
      themeMilestoneId('food', 2), themeMilestoneId('travel', 2), themeMilestoneId('health', 2),
    ];
    const s = computeProgression(input(completed));
    expect(s.unlockedCoreTier).toBe(3);
  });

  it('safely lowers the threshold when fewer themes have that tier', () => {
    // Only 2 themes have tier-1 content → need min(3, 2) = 2 to advance.
    const only2 = input(
      [coreMilestoneId(1), themeMilestoneId('food', 1), themeMilestoneId('travel', 1)],
      { themeHasTier: (id, tier) => tier === 1 && (id === 'food' || id === 'travel') },
    );
    const s = computeProgression(only2);
    expect(s.unlockedCoreTier).toBe(2);
  });

  it('never exceeds the configured number of Core tiers', () => {
    // Complete everything; cap at 6.
    const completed: string[] = [];
    for (let n = 1; n <= 6; n++) {
      completed.push(coreMilestoneId(n));
      for (const id of THEMES) completed.push(themeMilestoneId(id, n));
    }
    const s = computeProgression(input(completed));
    expect(s.unlockedCoreTier).toBe(6);
  });

  it('distinctThemesCompletedAtTier counts unique themes only', () => {
    const set = new Set([themeMilestoneId('food', 1), themeMilestoneId('travel', 1)]);
    expect(distinctThemesCompletedAtTier(THEMES, 1, set)).toBe(2);
    expect(distinctThemesCompletedAtTier(THEMES, 2, set)).toBe(0);
  });
});
