import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { Glossary, meaningsOf, normKey, splitSentence } from './glossary';
import { authoredFrenchGlossary } from './glossary-data';
import { TapWordsComponent } from './tap-word.component';
import { GlossaryService } from './glossary.service';
import { SettingsService } from '../services/settings.service';
import { I18nAngularService } from '../services/i18n.service';
import { LESSONS } from '../maps/explore-plus/lessons/lessons';

describe('glossary', () => {
  it('normalises words and drops the punctuation around them', () => {
    expect(normKey('Café,')).toBe('café');
    expect(normKey('« S’il »')).toBe("s'il");
    expect(normKey('?')).toBe('');
    expect(normKey('aujourd’hui.')).toBe("aujourd'hui");
  });

  it('splits meanings and keeps the gender note out of noun meanings', () => {
    expect(meaningsOf('bonjour', 'hello / good morning')).toEqual(['hello', 'good morning']);
    expect(meaningsOf('l’hôtel', 'hotel (m.)')).toEqual(['hotel']);
    expect(meaningsOf('un', 'a (m.)')).toEqual(['a (m.)']); // the note IS the meaning of a bare article
    expect(meaningsOf('est-ce que', '(yes/no question marker)')).toEqual(['(yes/no question marker)']);
  });

  it('keeps punctuation attached to its word, including the French space before ! and ?', () => {
    expect(splitSentence('Bonjour, madame !').map(w => w.text)).toEqual(['Bonjour,', 'madame\u00A0!']);
    expect(splitSentence('Où est la gare ?').map(w => w.text)).toEqual(['Où', 'est', 'la', 'gare\u00A0?']);
    expect(splitSentence('Je ne sais pas.').map(w => w.token)).toEqual(['Je', 'ne', 'sais', 'pas.']);
  });

  it('shows several meanings, and a phrase on each of its words', () => {
    const g = new Glossary().add([
      { fr: 'bonjour', en: 'hello / good morning' },
      { fr: 'je voudrais', en: 'I would like' },
      { fr: 'un café', en: 'coffee' },
      { fr: 'je', en: 'I' },
    ]);
    const out = g.lookup(['Je', 'voudrais', 'un', 'café,']);
    expect(out[0].lines).toEqual(['I', 'je voudrais = I would like']);
    expect(out[1].lines).toEqual(['je voudrais = I would like']);   // "voudrais" alone has no entry
    expect(out[3].lines).toEqual(['coffee', 'un café = coffee']);   // the bare noun matches too
    expect(g.lookup(['Bonjour,'])[0].lines).toEqual(['hello / good morning']);
  });

  it('understands elisions and plural / feminine forms', () => {
    const g = new Glossary().add([{ fr: 'habiter', en: 'to live' }, { fr: 'habite', en: 'live' }, { fr: 'petit', en: 'small' }, { fr: 'ami', en: 'friend' }]);
    expect(g.lookup(['j’habite'])[0].lines).toEqual(['live', 'j’ = I']);
    expect(g.lookup(['petite'])[0].lines).toEqual(['small (f.)']);
    expect(g.lookup(['amis'])[0].lines).toEqual(['friend (plural)']);
    expect(g.lookup(['inconnu'])[0].lines).toEqual([]);
  });

  it('keeps hand-written words final and lets a fallback fill only the gaps', () => {
    const g = new Glossary()
      .add([{ fr: 'de', en: 'of / from' }], { lock: true })
      .add([{ fr: 'de', en: 'president’s' }, { fr: 'bateau', en: 'boat' }])
      .add([{ fr: 'bateau', en: 'ship' }, { fr: 'navire', en: 'vessel' }], { fallback: true });
    expect(g.lookup(['de'])[0].lines).toEqual(['of / from']);
    expect(g.lookup(['bateau'])[0].lines).toEqual(['boat']);
    expect(g.lookup(['navire'])[0].lines).toEqual(['vessel']);
  });

  it('gives a meaning to EVERY word of every authored lesson sentence', () => {
    const g = authoredFrenchGlossary();
    const missing = new Set<string>();
    for (const l of LESSONS) {
      for (const s of l.sentences) {
        const words = splitSentence(s.fr);
        const out = g.lookup(words.map(w => w.token));
        // A word needs a real meaning: a lone elision line ("d’ = of / from") isn't one.
        words.forEach((w, i) => { if (out[i].lines.every(x => /^[a-zà-ÿ]+’ = /i.test(x))) missing.add(`${normKey(w.token)} (${l.id})`); });
      }
    }
    expect([...missing], 'add these to src/app/shared/french-glosses.ts').toEqual([]);
  });
});

describe('tap-to-translate component', () => {
  @Component({ standalone: true, imports: [TapWordsComponent], template: `<p id="outside">outside</p><app-tap-words [text]="text"></app-tap-words>` })
  class Host { text = 'Bonjour, madame !'; }

  const lines: Record<string, string[]> = { 'Bonjour,': ['hello'], 'madame': ['madam'] };
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        { provide: GlossaryService, useValue: {
          supports: (l: string) => l === 'fr',
          lookup: (_l: string, tokens: string[]) => tokens.map(t => ({ lines: lines[t.replace(/[!?]/g, '').trim()] ?? [] })),
        } },
        { provide: SettingsService, useValue: { learningLanguage: () => 'fr' } },
        { provide: I18nAngularService, useValue: { t: (k: string) => k } },
      ],
    });
  });

  const setup = () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const buttons = () => fixture.debugElement.queryAll(By.css('.tw-hit')).map(d => d.nativeElement as HTMLButtonElement);
    const isOpen = (i: number) => (fixture.nativeElement as HTMLElement).querySelectorAll('.tw')[i].classList.contains('tw-open');
    return { fixture, buttons, isOpen };
  };

  it('shows each word with its punctuation attached, no icons', () => {
    const { fixture, buttons } = setup();
    expect(buttons().map(b => b.textContent)).toEqual(['Bonjour,', 'madame\u00A0!']);
    expect(fixture.nativeElement.querySelector('ion-icon')).toBeNull();
  });

  it('reveals the meaning underneath on tap and hides it on a second tap', () => {
    const { fixture, buttons, isOpen } = setup();
    buttons()[0].click(); fixture.detectChanges();
    expect(isOpen(0)).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.tw-gloss-text')[0].textContent).toContain('hello');
    buttons()[0].click(); fixture.detectChanges();
    expect(isOpen(0)).toBe(false);
  });

  it('lets several words stay open independently, and a tap outside hides them all', () => {
    const { fixture, buttons, isOpen } = setup();
    buttons()[0].click(); fixture.detectChanges();
    buttons()[1].click(); fixture.detectChanges();
    expect(isOpen(0) && isOpen(1)).toBe(true);
    (fixture.nativeElement.querySelector('#outside') as HTMLElement).click(); fixture.detectChanges();
    expect(isOpen(0) || isOpen(1)).toBe(false);
  });

  it('says so when a word has no translation yet, and renders plain text for other languages', () => {
    const { fixture, buttons } = setup();
    buttons()[1].click(); fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.tw-gloss-text')[1].textContent).toContain('madam');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        { provide: GlossaryService, useValue: { supports: () => false, lookup: () => [] } },
        { provide: SettingsService, useValue: { learningLanguage: () => 'nl' } },
        { provide: I18nAngularService, useValue: { t: (k: string) => k } },
      ],
    });
    const plain = TestBed.createComponent(Host);
    plain.detectChanges();
    expect(plain.nativeElement.querySelectorAll('.tw-hit').length).toBe(0);
    expect(plain.nativeElement.textContent).toContain('Bonjour, madame !');
  });
});
