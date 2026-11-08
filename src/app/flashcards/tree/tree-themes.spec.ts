import { describe, it, expect } from 'vitest';
import type { JourneyChapter, JourneyNode } from '../journey/journey-model';
import { themeIdForSkill, groupChaptersIntoThemes } from './tree-themes';

// Build a minimal chapter with N nodes, `done` of them passed.
function chapter(number: number, name: string, done: number, unlocked: boolean): JourneyChapter {
  const nodes: JourneyNode[] = Array.from({ length: 5 }, (_, i) => ({
    type: 'flip', mode: 'journey-flip', route: '/practice/flip', icon: '', color: '',
    passed: i < done, unlocked: unlocked && i <= done,
  }));
  return {
    number, name, levelNumber: number, cardCount: 10,
    nodes, done, unlocked, complete: done === nodes.length,
  };
}

describe('tree-themes', () => {
  describe('themeIdForSkill', () => {
    it('maps skill phrases to the right theme by keyword', () => {
      expect(themeIdForSkill('Order at a café')).toBe('food');
      expect(themeIdForSkill('Order at a bakery')).toBe('food');
      expect(themeIdForSkill('Book a hotel room')).toBe('travel');
      expect(themeIdForSkill('Talk about your family')).toBe('relationships');
      expect(themeIdForSkill('Discuss school and your classes')).toBe('education');
      expect(themeIdForSkill('Talk about jobs')).toBe('work');
      expect(themeIdForSkill('Shop for clothes')).toBe('shopping');
      expect(themeIdForSkill('Manage doctor appointments')).toBe('health');
      expect(themeIdForSkill('Talk about music you like')).toBe('culture');
      expect(themeIdForSkill('Talk about the weather')).toBe('nature');
    });

    it('falls back to "daily" for unmatched skills', () => {
      expect(themeIdForSkill('Describe your lifestyle')).toBe('daily');
      expect(themeIdForSkill('')).toBe('daily');
    });
  });

  describe('groupChaptersIntoThemes', () => {
    it('groups chapters into themes and preserves taxonomy order', () => {
      const chapters = [
        chapter(1, 'Order at a café', 5, true),      // food, complete
        chapter(2, 'Talk about your family', 2, true), // relationships, active
        chapter(3, 'Book a hotel room', 0, false),     // travel, locked
        chapter(4, 'Order at a bakery', 0, false),     // food, locked
      ];
      const themes = groupChaptersIntoThemes(chapters);
      // food (2 chapters), travel (1), relationships (1) — in TREE_THEMES order:
      // food, travel, relationships.
      expect(themes.map(t => t.def.id)).toEqual(['food', 'travel', 'relationships']);
    });

    it('rolls up per-theme progress and state', () => {
      const chapters = [
        chapter(1, 'Order at a café', 5, true),    // 5/5 done
        chapter(2, 'Order at a bakery', 1, true),  // 1/5 done
      ];
      const [food] = groupChaptersIntoThemes(chapters);
      expect(food.totalChapters).toBe(2);
      expect(food.doneChapters).toBe(1);
      // nodes: (5 + 1) done of (5 + 5) total = 60%.
      expect(food.pct).toBe(60);
      // One chapter unlocked, not all complete → active.
      expect(food.state).toBe('active');
    });

    it('marks a theme done when every chapter is complete', () => {
      const themes = groupChaptersIntoThemes([
        chapter(1, 'Order at a café', 5, true),
        chapter(2, 'Order at a bakery', 5, true),
      ]);
      expect(themes[0].state).toBe('done');
      expect(themes[0].pct).toBe(100);
    });

    it('marks a theme locked when no chapter is unlocked', () => {
      const themes = groupChaptersIntoThemes([
        chapter(3, 'Book a hotel room', 0, false),
      ]);
      expect(themes[0].state).toBe('locked');
      expect(themes[0].pct).toBe(0);
    });

    it('omits themes with no member chapters', () => {
      const themes = groupChaptersIntoThemes([chapter(1, 'Order at a café', 0, true)]);
      expect(themes.length).toBe(1);
      expect(themes[0].def.id).toBe('food');
    });
  });
});
