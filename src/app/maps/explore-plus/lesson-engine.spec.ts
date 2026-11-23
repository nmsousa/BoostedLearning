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
  beforeEach(() => {
    localStorage.removeItem(LessonEngine.START_KEY);
    localStorage.removeItem(LessonEngine.OPEN_BAND_KEY);
  });

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

  it('applies a test result at once and never locks anything again', async () => {
    const first = (band: string) => LESSONS.findIndex(l => l.band === band);
    const lastOf = (band: string) => LESSONS.map(l => l.band).lastIndexOf(band as never);
    const { engine } = makeEngine();
    await engine.load();
    // Placement: knows A1 → A1 fully open, start at A2 lesson 1.
    engine.applyResult({ openBand: 'a1', start: LESSONS[first('a2')].id });
    expect(engine.unlocked(lastOf('a1'))).toBe(true);
    expect(engine.currentIndex()).toBe(first('a2'));
    expect(engine.unlocked(first('a2') + 1)).toBe(false);
    // A passed B1 test opens every B1 lesson and moves the start there.
    engine.applyResult({ openBand: 'b1', start: LESSONS[first('b1')].id });
    expect(engine.unlocked(lastOf('b1'))).toBe(true);
    expect(engine.unlocked(lastOf('a2'))).toBe(true);
    expect(engine.currentIndex()).toBe(first('b1'));
    // A lower result later (or a failed test) changes nothing.
    engine.applyResult({ openBand: 'pre-a1', start: LESSONS[0].id });
    await engine.load();
    expect(engine.unlocked(lastOf('b1'))).toBe(true);
    expect(engine.currentIndex()).toBe(first('b1'));
    expect(engine.unlocked(first('b2'))).toBe(false);
  });

  it('offers a level test only for locked lessons of a higher band', async () => {
    const { engine } = makeEngine();
    await engine.load();
    expect(engine.testOfferFor(1)).toBeNull();               // same band: finish the previous lesson
    const a2 = LESSONS.findIndex(l => l.band === 'a2');
    expect(engine.testOfferFor(a2)).toBe('a2');
    const b2 = LESSONS.findIndex(l => l.band === 'b2');
    expect(engine.testOfferFor(b2 + 1)).toBe('b2');
    expect(engine.nextTestBand()).toBe('a1');
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
