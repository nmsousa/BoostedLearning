import { describe, it, expect } from 'vitest';
import { gradeAgainst, gradeAnswer } from './typo-grader';

describe('typo-grader — single-word typo rules (gath examples)', () => {
  it('accepts an exact match', () => {
    expect(gradeAgainst('gath', 'gath')).toBe('exact');
  });
  it('one extra letter → typo (gaath)', () => {
    expect(gradeAgainst('gaath', 'gath')).toBe('typo');
  });
  it('one missing letter → typo (gth)', () => {
    expect(gradeAgainst('gth', 'gath')).toBe('typo');
  });
  it('one changed letter → typo (cath)', () => {
    expect(gradeAgainst('cath', 'gath')).toBe('typo');
  });
  it('two adjacent letters swapped → typo (gaht)', () => {
    expect(gradeAgainst('gaht', 'gath')).toBe('typo');
  });
  it('two letters wrong → wrong', () => {
    expect(gradeAgainst('caht', 'gath')).toBe('wrong'); // change + swap = 2 edits
  });
  it('digraph is two letters (chath vs gath) → wrong', () => {
    expect(gradeAgainst('chath', 'gath')).toBe('wrong');
  });
});

describe('typo-grader — word boundaries', () => {
  it('two words joined → wrong', () => {
    expect(gradeAgainst('goodmorning', 'good morning')).toBe('wrong');
  });
  it('one word split → wrong', () => {
    expect(gradeAgainst('to day', 'today')).toBe('wrong');
  });
  it('extra word (even one letter) → wrong', () => {
    expect(gradeAgainst('a good morning', 'good morning')).toBe('wrong');
  });
  it('missing word → wrong', () => {
    expect(gradeAgainst('morning', 'good morning')).toBe('wrong');
  });
  it('one typo in one of several words → typo', () => {
    expect(gradeAgainst('good mrning', 'good morning')).toBe('typo');
  });
  it('a typo in TWO words → wrong (only one typo allowed overall)', () => {
    expect(gradeAgainst('gud mrning', 'good morning')).toBe('wrong');
  });
});

describe('typo-grader — accents & apostrophes', () => {
  it('accent-only difference → accent', () => {
    expect(gradeAgainst('cafe', 'café')).toBe('accent');
  });
  it('perfect incl. accents → exact', () => {
    expect(gradeAgainst('café', 'café')).toBe('exact');
  });
  it('accent difference PLUS a typo → typo', () => {
    expect(gradeAgainst('cefe', 'café')).toBe('typo');
  });
  it('apostrophe counts as a separator: ir vs i\'r → wrong (1 word vs 2)', () => {
    expect(gradeAgainst('ir', "i'r")).toBe('wrong');
  });
  it('matching apostrophes align words: i r vs i\'r → exact', () => {
    expect(gradeAgainst("i'r", "i'r")).toBe('exact');
  });
});

describe('gradeAnswer — best across accepted answers', () => {
  it('prefers exact over typo', () => {
    expect(gradeAnswer('gath', ['cath', 'gath']).grade).toBe('exact');
  });
  it('returns typo + the matched answer when only a near one exists', () => {
    const r = gradeAnswer('gaath', ['hello', 'gath']);
    expect(r.grade).toBe('typo');
    expect(r.matched).toBe('gath');
  });
  it('wrong when nothing is close', () => {
    expect(gradeAnswer('xyz', ['hello', 'world']).grade).toBe('wrong');
  });
});
