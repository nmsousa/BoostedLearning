import { sameMeaning, synonymsOf } from './synonyms';

describe('synonyms', () => {
  it('treats hello, hi and good morning as the same meaning', () => {
    expect(sameMeaning('Hi', 'hello')).toBe(true);
    expect(sameMeaning('good morning', 'Hello')).toBe(true);
    expect(sameMeaning('hello', 'goodbye')).toBe(false);
  });

  it('ignores articles and "to"', () => {
    expect(sameMeaning('the film', 'a movie')).toBe(true);
    expect(sameMeaning('to try', 'try')).toBe(true);
  });

  it('lists the other words of a group', () => {
    expect(synonymsOf('hello')).toContain('good morning');
    expect(synonymsOf('banana')).toEqual([]);
  });
});
