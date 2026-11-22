import { LessonEngine } from './lesson-engine';
import { LESSONS } from './lessons/lessons';
import { TREE_MODES } from '../tree/tree-modes';

/** Engine with fake services; `passed` = lesson indexes whose every mode is passed. */
function makeEngine(passed: number[] = [], lang = 'fr') {
  const progress = new Map<string, { bestStars: number; bestScore: number }>();
  for (const i of passed) for (const m of TREE_MODES) progress.set(`${m.mode}-${i + 1}`, { bestStars: 3, bestScore: 100 });
  const nav = { navigateForward: vi.fn() };
  const deps = {
    flashcards: {
      registerTreeDeck: (l: string, _g: unknown, prefix: string) => `${prefix}-${l}`,
      getDeckLevelProgressMap: async () => progress,
    },
    settings: { learningLanguage: () => lang, adminMode: () => false },
    nav, t: (k: string) => k, from: 'explore-plus',
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { engine: new LessonEngine(deps as any), nav };
}

describe('LessonEngine', () => {
  beforeEach(() => localStorage.removeItem(LessonEngine.START_KEY));

  it('opens lessons one by one and points at the first unfinished one', async () => {
    const { engine } = makeEngine([0, 1]);
    await engine.load();
    expect(engine.deckId).toBe('lesson-fr');
    const cards = engine.cards();
    expect(cards[0].state).toBe('done');
    expect(cards[1].state).toBe('done');
    expect(cards[2].state).toBe('active');
    expect(cards[3].state).toBe('locked');
    expect(engine.currentIndex()).toBe(2);
    expect(cards.filter(c => c.current).map(c => c.index)).toEqual([2]);
  });

  it('opens every lesson up to the placement start and starts there', async () => {
    const a1 = LESSONS.findIndex(l => l.band === 'a1');
    const { engine } = makeEngine();
    await engine.load();
    expect(engine.startChosen).toBe(false);
    engine.setStart(LESSONS[a1].id);
    await engine.load();
    expect(engine.startChosen).toBe(true);
    expect(engine.currentIndex()).toBe(a1);
    expect(engine.unlocked(a1 - 1)).toBe(true);
    expect(engine.unlocked(a1 + 1)).toBe(false);
  });

  it('serves the level page and launches games on the lesson level', async () => {
    const { engine, nav } = makeEngine();
    await engine.load();
    const id = LESSONS[0].id;
    const node = engine.nodeById(id)!;
    expect(node.title).toBe(LESSONS[0].title);
    const [tier] = engine.tiersFor(node, 1);
    expect(tier.goal).toBe(LESSONS[0].goal);
    expect(tier.label).toContain('Pre-A1');
    expect(tier.modes[0].state).toBe('active'); // Learn
    engine.launchMode(id, 1, 0);
    expect(nav.navigateForward).toHaveBeenCalledWith(['/practice/learn', 'lesson-fr'], expect.objectContaining({
      queryParams: expect.objectContaining({ level: 1, mode: 'journey-learn', from: 'explore-plus' }),
    }));
    expect(engine.nodeById('nope')).toBeNull();
  });

  it('has nothing to show for a language without lessons', async () => {
    const { engine } = makeEngine([], 'nl');
    await engine.load();
    expect(engine.available).toBe(false);
    expect(engine.deckId).toBe('');
  });
});
