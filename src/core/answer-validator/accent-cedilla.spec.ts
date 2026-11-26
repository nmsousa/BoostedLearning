import { gradeAgainst, gradeAnswer } from './typo-grader';

describe('typo grader: cedilla and accents', () => {
  it('"ca va" for "ça va" is an accent slip, not a typo', () => {
    expect(gradeAgainst('ca va', 'ça va')).toBe('accent');
    expect(gradeAgainst('Ca va, merci', 'Ça va, merci.')).toBe('accent');
    expect(gradeAnswer('ca va', ['ça va']).grade).toBe('accent');
  });

  it('works with a decomposed ç too', () => {
    expect(gradeAgainst('ca va', 'c\u0327a va')).toBe('accent');
    expect(gradeAgainst('ça va', 'c\u0327a va')).toBe('exact');
  });
});
