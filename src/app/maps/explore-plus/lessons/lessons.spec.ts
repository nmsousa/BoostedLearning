import {
  BAND_SLOTS, LESSONS, keyIndex, lessonAtLevel, lessonDeckGroups, lessonPhrases, lessonWriteItems,
  levelOfLesson, sentenceTokens, toPhrase,
} from './lessons';
import { BANDS } from './lesson-types';
import {
  AdaptivePlacement, GLOBAL_MAX, GLOBAL_MIN, courseBands, estimateLevel, levelTestQuestions, levelVerdict, skillBreakdown,
} from './placement';
import { GLOBAL_ITEMS, LEVEL_ITEMS } from './placement-bank';
import { englishWithArticle } from '../../../shared/articles';

describe('Explore+ lessons content', () => {
  it('has complete Pre-A1 to B2 bands', () => {
    for (const band of ['pre-a1', 'a1', 'a2', 'b1', 'b2']) {
      expect(LESSONS.filter(l => l.band === band).length).toBeGreaterThanOrEqual(4);
    }
    // Bands come in order, never mixed.
    const order = BANDS.map(b => b.id);
    const seq = LESSONS.map(l => order.indexOf(l.band));
    expect([...seq].sort((a, b) => a - b)).toEqual(seq);
  });

  it('gives each band fixed deck slots so a new lesson never shifts the next band', () => {
    expect(levelOfLesson('pa1-01')).toBe(1);
    expect(levelOfLesson('a1-01')).toBe(BAND_SLOTS + 1);
    expect(levelOfLesson('a2-01')).toBe(2 * BAND_SLOTS + 1);
    expect(lessonAtLevel(BAND_SLOTS + 1)?.id).toBe('a1-01');
    expect(lessonAtLevel(LESSONS.filter(l => l.band === 'pre-a1').length + 1)).toBeUndefined();
    const groups = lessonDeckGroups();
    expect(groups.length).toBe(BANDS.length * BAND_SLOTS);
    for (const l of LESSONS) expect(groups[levelOfLesson(l.id) - 1].skill).toBe(l.title);
    for (const band of ['pre-a1', 'a1', 'a2', 'b1', 'b2']) {
      expect(LESSONS.filter(l => l.band === band).length).toBeLessThanOrEqual(BAND_SLOTS);
    }
  });

  it('uses unique lesson ids and titles', () => {
    expect(new Set(LESSONS.map(l => l.id)).size).toBe(LESSONS.length);
    // The title is the deck skill name, so it must be unique too.
    expect(new Set(LESSONS.map(l => l.title)).size).toBe(LESSONS.length);
  });

  it('gives every lesson enough words and sentences for all the games', () => {
    for (const l of LESSONS) {
      expect(l.words.length, l.id).toBeGreaterThanOrEqual(10);   // Match boards, Quiz options
      expect(l.sentences.length, l.id).toBeGreaterThanOrEqual(8); // Builder (5), Mix, Write
      expect(l.goal && l.grammar && l.icon, l.id).toBeTruthy();
    }
  });

  it('never teaches a standalone fragment and marks l’/les nouns with a gender', () => {
    for (const l of LESSONS) {
      const seen = new Set<string>();
      for (const w of l.words) {
        expect(['l’', "l'", 'de l’', 'de l\''], `${l.id} ${w.fr}`).not.toContain(w.fr);
        expect(seen.has(w.fr.toLowerCase()), `${l.id} duplicate ${w.fr}`).toBe(false);
        seen.add(w.fr.toLowerCase());
        if (/^(l’|les )/i.test(w.fr)) expect(w.en, `${l.id} ${w.fr}`).toMatch(/\((m|f)\.\)$/);
        expect(w.fr, `${l.id} uses a straight apostrophe`).not.toContain("'");
      }
    }
  });

  it('keeps English answers distinct inside a lesson (fair Quiz / Match)', () => {
    for (const l of LESSONS) {
      const en = l.words.map(w => englishWithArticle(w.fr, w.en).toLowerCase());
      expect(new Set(en).size, l.id).toBe(en.length);
    }
  });

  it('has a focus word in every sentence and three different wrong options', () => {
    for (const l of LESSONS) {
      for (const x of l.sentences) {
        const where = `${l.id}: ${x.fr}`;
        expect(keyIndex(x), where).toBeGreaterThanOrEqual(0);
        expect(new Set(x.wrong).size, where).toBe(3);
        for (const w of x.wrong) {
          expect(w.toLowerCase(), where).not.toBe(x.key.toLowerCase());
          expect(w.trim(), where).not.toContain(' ');
        }
        expect(x.fr, where).not.toContain("'");
        expect(sentenceTokens(x.fr).length, where).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('uses unique sentences across the course', () => {
    const all = LESSONS.flatMap(l => l.sentences.map(x => x.fr));
    expect(new Set(all).size).toBe(all.length);
  });

  it('turns a sentence into a phrase the games can play', () => {
    const p = toPhrase({ fr: 'Bonjour, madame !', en: 'Hello, madam!', key: 'Bonjour', wrong: ['Merci', 'Oui', 'Non'], alt: ['Salut, madame !'] });
    expect(p.tokens).toEqual(['Bonjour', 'madame']);
    expect(p.target).toBe('Bonjour, madame !');
    expect(p.blankIndex).toBe(0);
    expect(p.distractors).toEqual(['Merci', 'Oui', 'Non']);
    expect(p.accepted).toEqual(['Bonjour, madame !', 'Salut, madame !']);
    expect(lessonPhrases(1, 5).length).toBe(5);
    expect(lessonPhrases(999)).toEqual([]);
    expect(lessonWriteItems(1, 3).length).toBe(3);
  });
});

describe('Explore+ placement tests', () => {
  it('imported a clean question bank', () => {
    const all = [...GLOBAL_ITEMS, ...Object.values(LEVEL_ITEMS).flat()];
    expect(new Set(all.map(q => q.id)).size).toBe(all.length);
    for (const q of all) {
      expect(q.answer, q.id).toBeGreaterThanOrEqual(0);
      expect(q.answer, q.id).toBeLessThan(q.options.length);
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(3);
      if (q.skill === 'listening') expect(q.audio, q.id).toBeTruthy();
      // The transcript is never shown in the prompt.
      if (q.audio) expect(q.prompt.includes(q.audio), q.id).toBe(false);
    }
    expect(courseBands()).toEqual(['pre-a1', 'a1', 'a2', 'b1', 'b2']);
  });

  /** Runs the adaptive test with an answerer that knows bands up to `knows`. */
  const run = (knows: number) => {
    const t = new AdaptivePlacement();
    for (let q = t.next(); q; q = t.next()) t.record(q, t.bands.indexOf(q.band as never) <= knows);
    return t;
  };

  it('starts easy, adapts, and stops after 10–12 questions', () => {
    const t = new AdaptivePlacement();
    expect(t.next()!.band).toBe('pre-a1');
    for (const knows of [-1, 0, 1, 2, 3, 4]) {
      const r = run(knows);
      expect(r.answers.length).toBeGreaterThanOrEqual(GLOBAL_MIN);
      expect(r.answers.length).toBeLessThanOrEqual(GLOBAL_MAX);
      expect(new Set(r.answers.map(a => a.item.id)).size).toBe(r.answers.length);
    }
  });

  it('estimates the level the learner really has and starts at the next band', () => {
    expect(run(-1).result()).toEqual({ level: -1, start: 0 });   // total beginner → Pre-A1
    expect(run(1).result()).toEqual({ level: 1, start: 2 });     // knows A1 → start A2
    expect(run(2).result()).toEqual({ level: 2, start: 3 });     // knows A2 → start B1
    expect(run(4).result()).toEqual({ level: 4, start: 4 });     // knows B2 → stay at B2 (top)
  });

  it('needs at least 2 right and 60% at a band to count it as known', () => {
    const bands = courseBands();
    const a1 = GLOBAL_ITEMS.filter(q => q.band === 'a1');
    expect(estimateLevel([{ item: a1[0], correct: true }], bands)).toBe(-1);
    expect(estimateLevel([{ item: a1[0], correct: true }, { item: a1[1], correct: true }, { item: a1[2], correct: false }], bands)).toBe(1);
  });

  it('builds a level test from that band only: 8 questions, 10 from B2', () => {
    for (const band of ['pre-a1', 'a1', 'a2', 'b1'] as const) {
      const qs = levelTestQuestions(band);
      expect(qs.length).toBe(8);
      expect(qs.every(q => q.band === band)).toBe(true);
    }
    const b2 = levelTestQuestions('b2');
    expect(b2.length).toBe(10);
    expect(b2.every(q => q.band === 'b2')).toBe(true);
    expect(b2.some(q => q.skill === 'listening')).toBe(true);
  });

  it('grades a level test: strong, provisional or not yet', () => {
    expect(levelVerdict(8, 8)).toBe('strong');
    expect(levelVerdict(7, 8)).toBe('provisional');
    expect(levelVerdict(6, 8)).toBe('provisional');
    expect(levelVerdict(5, 8)).toBe('notYet');
    expect(levelVerdict(9, 10)).toBe('strong');
    expect(levelVerdict(7, 10)).toBe('notYet');
  });

  it('summarises strengths and points to work on by skill', () => {
    const [r1, r2] = GLOBAL_ITEMS.filter(q => q.skill === 'reading');
    const [l1, l2] = GLOBAL_ITEMS.filter(q => q.skill === 'listening');
    const out = skillBreakdown([
      { item: r1, correct: true }, { item: r2, correct: true }, { item: l1, correct: false }, { item: l2, correct: false },
    ]);
    expect(out).toEqual({ strengths: ['reading'], weaknesses: ['listening'] });
  });
});
