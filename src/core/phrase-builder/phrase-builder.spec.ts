import { describe, it, expect } from 'vitest';
import {
  classifyCard,
  buildTokens,
  generatePhrases,
  type SourceCard,
} from './phrase-builder';

describe('phrase-builder classifier', () => {
  it('classifies closed-class French words', () => {
    expect(classifyCard({ text: 'le', translations: ['the'] }).category).toBe('article');
    expect(classifyCard({ text: 'ma', translations: ['my'] }).category).toBe('possessive');
    expect(classifyCard({ text: 'je', translations: ['I'] }).category).toBe('pronoun');
    expect(classifyCard({ text: 'et', translations: ['and'] }).category).toBe('connector');
    expect(classifyCard({ text: 'merci', translations: ['thank you'] }).category).toBe('expression');
  });

  it('detects a noun + gender from a leading article in the card text', () => {
    expect(classifyCard({ text: 'la mère', translations: ['mother'] })).toEqual({
      category: 'noun',
      gender: 'f',
    });
    expect(classifyCard({ text: 'un café', translations: ['coffee'] })).toEqual({
      category: 'noun',
      gender: 'm',
    });
  });

  it('treats a bare single word with a plain-noun translation as a noun', () => {
    expect(classifyCard({ text: 'mère', translations: ['mother'] }).category).toBe('noun');
  });

  it('detects verb phrases from a verbal English gloss', () => {
    expect(classifyCard({ text: 'je voudrais', translations: ["I'd like"] }).category).toBe('verbPhrase');
    expect(classifyCard({ text: 'manger', translations: ['to eat'] }).category).toBe('verbPhrase');
  });
});

describe('phrase-builder generator', () => {
  const current: SourceCard[] = [
    { text: 'mère', translations: ['mother'] },
    { text: 'café', translations: ['coffee'] },
  ];
  const earlier: SourceCard[] = [
    { text: 'la', translations: ['the'] },
    { text: 'le', translations: ['the'] },
    { text: 'un', translations: ['a'] },
    { text: 'ma', translations: ['my'] },
    { text: 'je voudrais', translations: ["I'd like"] },
  ];

  it('builds tokens tagged by chapter origin, de-duplicated', () => {
    const tokens = buildTokens(current, [...earlier, { text: 'café', translations: ['coffee'] }]);
    const cafe = tokens.filter(t => t.text === 'café');
    expect(cafe).toHaveLength(1); // de-duped
    expect(cafe[0].fromCurrentChapter).toBe(true);
  });

  it('generates phrases that each use at least one current-chapter word', () => {
    const tokens = buildTokens(current, earlier);
    const phrases = generatePhrases(tokens, 6);
    expect(phrases.length).toBeGreaterThan(0);
    const currentWords = new Set(current.map(c => c.text));
    for (const p of phrases) {
      expect(p.tokens.some(t => currentWords.has(t))).toBe(true);
      expect(p.target).toBe(p.tokens.join(' '));
    }
  });

  it('produces an article + noun phrase like "un café" or "la mère"', () => {
    const tokens = buildTokens(current, earlier);
    const targets = generatePhrases(tokens, 10).map(p => p.target);
    const hasArticleNoun = targets.some(
      t => /(un|le) café/.test(t) || /la mère/.test(t)
    );
    expect(hasArticleNoun).toBe(true);
  });

  it('returns nothing when there are no nouns to anchor a phrase', () => {
    const tokens = buildTokens(
      [{ text: 'et', translations: ['and'] }],
      [{ text: 'je', translations: ['I'] }]
    );
    expect(generatePhrases(tokens)).toEqual([]);
  });
});
