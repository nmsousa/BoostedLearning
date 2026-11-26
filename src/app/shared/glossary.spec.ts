import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { Glossary, meaningsOf, normEn, normKey, splitSentence } from './glossary';
import { authoredFrenchGlossary } from './glossary-data';
import { TapTextComponent } from './tap-text.component';
import { TapPopupService } from './tap-popup.service';
import { GlossaryService } from './glossary.service';
import { SettingsService } from '../services/settings.service';
import { LESSONS, sentenceTokens } from '../maps/explore-plus/lessons/lessons';

const texts = (segs: { text: string }[]): string[] => segs.map(s => s.text);

describe('glossary: words and blocks', () => {
  it('normalises words and drops the punctuation around them', () => {
    expect(normKey('Café,')).toBe('café');
    expect(normKey('« S’il »')).toBe("s'il");
    expect(normKey('?')).toBe('');
    expect(normKey('aujourd’hui.')).toBe("aujourd'hui");
  });

  it('splits meanings and keeps the gender note out of noun meanings', () => {
    expect(meaningsOf('bonjour', 'hello / good morning')).toEqual(['hello', 'good morning']);
    expect(meaningsOf('l’hôtel', 'hotel (m.)')).toEqual(['hotel']);
    expect(meaningsOf('un', 'a (m.)')).toEqual(['a (m.)']);
  });

  it('keeps punctuation attached to its word, including the French space before ! and ?', () => {
    expect(splitSentence('Bonjour, madame !').map(w => w.text)).toEqual(['Bonjour,', 'madame\u00A0!']);
    expect(splitSentence('Où est la gare ?').map(w => w.text)).toEqual(['Où', 'est', 'la', 'gare\u00A0?']);
  });

  const g = new Glossary().add([
    { fr: 'je', en: 'I' }, { fr: 'voudrais', en: 'would like' }, { fr: 'je voudrais', en: 'I would like' },
    { fr: 'un', en: 'a / one (m.)' }, { fr: 'un café', en: 'coffee' },
    { fr: 's’il vous plaît', en: 'please' }, { fr: 'la salle de bain', en: 'bathroom' }, { fr: 'habiter', en: 'to live' },
    { fr: 'habite', en: 'live' }, { fr: 'petit', en: 'small' }, { fr: 'ami', en: 'friend' },
  ]);

  it('makes ONE block of words that have one meaning together', () => {
    const segs = g.segmentSentence('Je voudrais un café, s’il vous plaît.');
    expect(texts(segs)).toEqual(['Je voudrais', 'un', 'café,', 's’il vous plaît.']);
    expect(segs[0].lines).toEqual(['I would like']);
    expect(segs[3].lines).toEqual(['please']);
  });

  it('does not block an article and its noun, but blocks a fixed noun phrase', () => {
    expect(texts(g.segmentSentence('un café'))).toEqual(['un', 'café']);
    expect(texts(g.segmentSentence('Où est la salle de bain ?'))).toEqual(['Où', 'est', 'la', 'salle de bain\u00A0?']);
    expect(g.segmentSentence('la salle de bain')[1].lines).toEqual(['bathroom']);
  });

  it('understands elisions and plural / feminine forms', () => {
    expect(g.segmentSentence('j’habite')[0].lines).toEqual(['live', 'j’ = I']);
    expect(g.segmentSentence('petite')[0].lines).toEqual(['small (f.)']);
    expect(g.segmentSentence('amis')[0].lines).toEqual(['friend (plural)']);
    expect(g.segmentSentence('inconnu')[0].lines).toEqual([]);
  });

  it('keeps hand-written words final; a dictionary only fills gaps and never forms blocks', () => {
    const h = new Glossary()
      .add([{ fr: 'de', en: 'of / from' }], { lock: true })
      .add([{ fr: 'de', en: 'president’s' }, { fr: 'bateau', en: 'boat' }])
      .add([{ fr: 'bateau', en: 'ship' }, { fr: 'navire', en: 'vessel' }, { fr: 'bon marché', en: 'cheap' }], { fallback: true });
    expect(h.segmentSentence('de')[0].lines).toEqual(['of / from']);
    expect(h.segmentSentence('bateau')[0].lines).toEqual(['boat']);
    expect(h.segmentSentence('navire')[0].lines).toEqual(['vessel']);
    expect(texts(h.segmentSentence('bon marché'))).toEqual(['bon', 'marché']);   // a dictionary phrase is not a block
  });
});

describe('glossary: the English prompt', () => {
  const full = authoredFrenchGlossary();
  const align = (en: string, fr: string) => full.alignNative(en, sentenceTokens(fr));
  const at = (segs: { text: string; lines: string[] }[], word: string) => segs.find(s => s.text.startsWith(word))!;

  it('shows the French of each English word, using the sentence it translates', () => {
    const segs = align('The bill, please.', 'L’addition, s’il vous plaît.');
    expect(texts(segs)).toEqual(['The', 'bill,', 'please.']);
    expect(at(segs, 'bill').lines[0]).toBe('L’addition');
    expect(at(segs, 'please').lines[0]).toBe('s’il vous plaît');   // a block on the French side
    expect(at(segs, 'The').lines[0]).toContain('l');                // an article, never nothing
  });

  it('makes a block of English words that are one French word or block', () => {
    const segs = align('I would like a coffee, please.', 'Je voudrais un café, s’il vous plaît.');
    expect(texts(segs)).toEqual(['I would like', 'a', 'coffee,', 'please.']);
    expect(segs[0].lines[0]).toBe('Je voudrais');
    expect(segs[2].lines[0]).toBe('café');
    expect(align('I live in London.', 'J’habite à Londres.').map(s => s.lines[0])).toEqual(['J’habite à', 'Londres']);
  });

  it('copes with -ing forms and contractions, and does not translate "do" or the (tu) note', () => {
    expect(normEn('going')).toBe(normEn('go'));
    expect(normEn('making')).toBe(normEn('make'));
    expect(normEn('children')).toBe(normEn('child'));
    expect(normEn('don’t')).toBe('not');
    const q = align('Do you speak Spanish? (tu)', 'Tu parles espagnol ?');
    expect(at(q, 'Do').lines).toEqual([]);
    expect(at(q, '(tu)').lines).toEqual([]);
    expect(at(q, 'you speak').lines[0]).toBe('Tu parles');
  });

  it('shows what the exercises need: every French word has a meaning, nearly every English word a French', () => {
    const noMeaning = new Set<string>();
    let en = 0, enOk = 0;
    for (const l of LESSONS) {
      for (const s of l.sentences) {
        for (const seg of full.segmentSentence(s.fr)) {
          // A lone elision note ("d’ = of / from") is not a meaning.
          if (seg.lines.every(x => /^[a-zà-ÿ]+’ = /i.test(x))) noMeaning.add(`${normKey(seg.text)} (${l.id})`);
        }
        for (const seg of align(s.en, s.fr)) {
          if (/^\(.*\)$/.test(seg.text)) continue;   // "(tu)" / "(vous)" notes
          en++;
          if (seg.lines.length) enOk++;
        }
      }
    }
    expect([...noMeaning], 'add these to src/app/shared/french-glosses.ts').toEqual([]);
    expect(enOk / en).toBeGreaterThan(0.95);
  });
});

describe('tap-to-translate: one popup', () => {
  @Component({
    standalone: true, imports: [TapTextComponent],
    template: `<p id="outside">outside</p><app-tap-text id="a" [text]="a()"></app-tap-text><app-tap-text id="b" [text]="b" dir="native" [context]="ctx"></app-tap-text>`,
  })
  class Host { a = signal('Je voudrais un café !'); b = 'The bill'; ctx = ['L’addition']; }

  const meanings: Record<string, string[]> = { 'Je voudrais': ['I would like'], 'un': ['a'], 'The': ['l’'], 'bill': ['L’addition'] };
  let popup: TapPopupService;

  beforeEach(() => {
    Object.defineProperty(document.documentElement, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        { provide: GlossaryService, useValue: {
          supports: (l: string) => l === 'fr',
          learning: (_l: string, t: string) => t.split(' ').reduce<{ text: string; lines: string[] }[]>((acc, w) => {
            if (w === 'voudrais') acc[acc.length - 1].text += ' voudrais'; else acc.push({ text: w, lines: [] });
            return acc;
          }, []).map(s => ({ ...s, lines: meanings[s.text] ?? [] })),
          native: (_l: string, t: string) => t.split(' ').map(w => ({ text: w, lines: meanings[w] ?? [] })),
        } },
        { provide: SettingsService, useValue: { learningLanguage: () => 'fr' } },
      ],
    });
    popup = TestBed.inject(TapPopupService);
  });
  afterEach(() => { popup.close(); document.querySelectorAll('.tp-popup').forEach(e => e.remove()); });

  const setup = () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const segs = (id: string) => Array.from(root.querySelectorAll<HTMLElement>(`#${id} .tt-seg`));
    const popups = () => document.querySelectorAll<HTMLElement>('.tp-popup');
    return { fixture, root, segs, popups };
  };
  const fire = (el: Element | Document, type: string, extra: Record<string, unknown> = {}) => {
    const ev = new Event(type, { bubbles: true });
    Object.assign(ev, extra);
    el.dispatchEvent(ev);
  };

  it('underlines each word or block, with no icons, and leaves unknown words plain', () => {
    const { root, segs } = setup();
    expect(segs('a').map(s => s.textContent)).toEqual(['Je voudrais', 'un']);          // "café" / "!" have no meaning: plain text
    expect(root.querySelector('#a')!.textContent).toContain('café');
    expect(root.querySelector('ion-icon')).toBeNull();
    expect(segs('b').map(s => s.textContent)).toEqual(['The', 'bill']);
  });

  it('shows one popup with the meaning and an arrow, for either language', () => {
    const { fixture, segs, popups } = setup();
    segs('a')[0].click(); fixture.detectChanges();
    expect(popups().length).toBe(1);
    expect(popups()[0].textContent).toContain('I would like');
    expect(popups()[0].querySelector('.tp-arrow')).not.toBeNull();
    segs('b')[1].click(); fixture.detectChanges();
    expect(popups().length).toBe(1);                       // never two at once
    expect(popups()[0].textContent).toContain('L’addition');
  });

  it('closes when the same word is tapped again, and highlights only the open word', () => {
    const { fixture, segs, popups } = setup();
    segs('a')[0].click(); fixture.detectChanges();
    expect(segs('a')[0].classList.contains('tt-open')).toBe(true);
    expect(segs('a')[1].classList.contains('tt-open')).toBe(false);
    segs('a')[0].click(); fixture.detectChanges();
    expect(popups().length).toBe(0);
    expect(segs('a')[0].classList.contains('tt-open')).toBe(false);
  });

  it('closes immediately on a tap anywhere else, on Esc, and when a mouse leaves the word', () => {
    const { fixture, root, segs, popups } = setup();
    segs('a')[0].click(); fixture.detectChanges();
    fire(root.querySelector('#outside')!, 'pointerdown');
    expect(popups().length).toBe(0);

    segs('a')[0].click(); fixture.detectChanges();
    fire(document, 'keydown', { key: 'Escape' });
    expect(popups().length).toBe(0);

    segs('a')[0].click(); fixture.detectChanges();
    fire(segs('a')[0], 'pointerleave', { pointerType: 'touch' });
    expect(popups().length).toBe(1);                       // a finger lifting is not "leaving"
    fire(segs('a')[0], 'pointerleave', { pointerType: 'mouse' });
    expect(popups().length).toBe(0);
  });

  it('does not close on the press that is about to switch to another word', () => {
    const { fixture, segs, popups } = setup();
    segs('a')[0].click(); fixture.detectChanges();
    fire(segs('a')[1], 'pointerdown');                     // pressing another word: its own tap decides
    expect(popups().length).toBe(1);
    segs('a')[1].click(); fixture.detectChanges();
    expect(popups()[0].textContent).toContain('a');
    expect(popups().length).toBe(1);
  });

  it('closes when the sentence goes away', () => {
    const { fixture, segs, popups } = setup();
    segs('a')[0].click(); fixture.detectChanges();
    fixture.componentInstance.a.set('Un autre texte');
    fixture.detectChanges();
    expect(popups().length).toBe(0);
  });

  describe('placement', () => {
    const rect = (w: number, h: number) =>
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        return (this.classList.contains('tp-popup')
          ? { width: w, height: h, left: 0, top: 0, right: w, bottom: h, x: 0, y: 0, toJSON: () => ({}) }
          : { width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
      });
    afterEach(() => vi.restoreAllMocks());
    const owner = {};

    it('points the arrow at the middle of the word, below a word in the top half', () => {
      rect(120, 40);
      popup.show(owner, { left: 100, right: 160, top: 100, bottom: 124 }, ['x']);
      const el = document.querySelector<HTMLElement>('.tp-popup')!;
      expect(el.classList.contains('tp-below')).toBe(true);
      expect(el.style.top).toBe('134px');                    // under the word + gap
      expect(el.style.left).toBe('70px');                    // centred on the word (middle 130 - 60)
      expect(el.style.getPropertyValue('--tp-arrow-x')).toBe('60px');   // 130 - 70: the middle of the word
    });

    it('goes above a word in the bottom half, and keeps the arrow on the word near a screen edge', () => {
      rect(120, 40);
      popup.show(owner, { left: 4, right: 36, top: 600, bottom: 624 }, ['x']);
      const el = document.querySelector<HTMLElement>('.tp-popup')!;
      expect(el.classList.contains('tp-above')).toBe(true);
      expect(el.style.top).toBe('550px');                    // 600 - gap - height
      expect(el.style.left).toBe('8px');                     // pushed back on screen
      expect(el.style.getPropertyValue('--tp-arrow-x')).toBe('12px');   // word middle (20) - 8
    });
  });
});
