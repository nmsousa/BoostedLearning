import { englishWithArticle, genderOf } from './articles';
import { MixSessionService } from '../exercises/mix/mix-session.service';
import type { Flashcard } from '../services/flashcard.service';

describe('article rule', () => {
  it('adds the matching English article and drops the gender note', () => {
    expect(englishWithArticle('le café', 'coffee')).toBe('the coffee');
    expect(englishWithArticle('un café', 'coffee')).toBe('a coffee');
    expect(englishWithArticle('une orange', 'orange')).toBe('an orange');
    expect(englishWithArticle('l’hôtel', 'hotel (m.)')).toBe('the hotel');
    expect(englishWithArticle('les enfants', 'children')).toBe('the children');
    expect(englishWithArticle('le voyage', 'trip / journey')).toBe('the trip / journey');
  });

  it('leaves bare function words and non-nouns as authored', () => {
    expect(englishWithArticle('un', 'a (m.)')).toBe('a (m.)');
    expect(englishWithArticle('ma', 'my (f.)')).toBe('my (f.)');
    expect(englishWithArticle('voyager', 'to travel')).toBe('to travel');
  });

  it('reads the gender from the article or the note', () => {
    expect(genderOf('le café')).toBe('m');
    expect(genderOf('une pomme')).toBe('f');
    expect(genderOf('l’eau', 'water (f.)')).toBe('f');
    expect(genderOf('l’ami', 'friend')).toBeNull();
    expect(genderOf('un', 'a (m.)')).toBeNull();
  });
});

describe('Mix progressive difficulty', () => {
  const card = (correctCount: number, streak: number, last?: 'correct' | 'incorrect') =>
    ({ correctCount, streak, recentResults: last ? [last] : [] }) as unknown as Flashcard;

  it('starts with recognition for new words and moves to Write when well practised', () => {
    expect(MixSessionService.levelStage([card(0, 0), card(1, 1)])).toBe(0);
    expect(MixSessionService.levelStage([card(2, 2, 'correct'), card(3, 1, 'correct')])).toBe(1);
    expect(MixSessionService.levelStage([card(6, 4, 'correct'), card(5, 3, 'correct')])).toBe(2);
    expect(MixSessionService.familiarity(card(9, 5, 'incorrect'))).toBe(0);
  });

  it('uses more Write than Builder in the late stage and none early', () => {
    const count = (s: 0 | 1 | 2, k: string) => MixSessionService.PLANS[s].filter(x => x === k).length;
    expect(count(0, 'write')).toBe(0);
    expect(count(2, 'write')).toBeGreaterThan(count(2, 'builder'));
  });
});
