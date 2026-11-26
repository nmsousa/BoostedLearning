import { englishAlternatives } from './articles';

describe('englishAlternatives', () => {
  it('splits on " / " best first', () => {
    expect(englishAlternatives('hello / good morning')).toEqual(['hello', 'good morning']);
    expect(englishAlternatives('flat / apartment (m.)')).toEqual(['flat', 'apartment (m.)']);
  });

  it('does not split a slash inside brackets or without spaces', () => {
    expect(englishAlternatives('you (plural / formal)')).toEqual(['you (plural / formal)']);
    expect(englishAlternatives('he/it')).toEqual(['he/it']);
  });
});
