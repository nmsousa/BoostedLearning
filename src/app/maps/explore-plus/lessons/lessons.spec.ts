import {
  BAND_SLOTS, LESSONS, keyIndex, lessonAtLevel, lessonDeckGroups, lessonPhrases, lessonWriteItems,
  levelOfLesson, sentenceTokens, toPhrase,
} from './lessons';
import { BANDS } from './lesson-types';
import { placementBands, placementQuestions, placementResult, PLACEMENT_PER_BAND } from './placement';
import { englishWithArticle } from '../../../shared/articles';

describe('Explore+ lessons content', () => {
  it('has complete Pre-A1, A1 and A2 bands', () => {
    for (const band of ['pre-a1', 'a1', 'a2']) {
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
    for (const band of ['pre-a1', 'a1', 'a2']) {
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

describe('Explore+ placement test', () => {
  it('asks a few questions per band, with the answer among the options', () => {
    for (const band of placementBands()) {
      const qs = placementQuestions(band);
      expect(qs.length).toBe(PLACEMENT_PER_BAND);
      for (const q of qs) {
        expect(q.options).toContain(q.answer);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.options.length).toBe(4);
      }
    }
  });

  it('starts at the first band that was not passed', () => {
    const first = (band: string) => LESSONS.find(l => l.band === band)!.id;
    expect(placementResult([{ band: 'pre-a1', correct: 1 }])).toEqual({ band: 'pre-a1', lessonId: first('pre-a1') });
    expect(placementResult([{ band: 'pre-a1', correct: 4 }, { band: 'a1', correct: 2 }])).toEqual({ band: 'a1', lessonId: first('a1') });
    expect(placementResult([{ band: 'pre-a1', correct: 3 }, { band: 'a1', correct: 3 }, { band: 'a2', correct: 1 }]))
      .toEqual({ band: 'a2', lessonId: first('a2') });
    // Passing everything starts at the last band.
    expect(placementResult([{ band: 'pre-a1', correct: 4 }, { band: 'a1', correct: 4 }, { band: 'a2', correct: 4 }]).band).toBe('a2');
  });
});
