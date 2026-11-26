/**
 * Tap-to-translate words.
 *
 *  - <app-tap-words text="Je voudrais un café, s’il vous plaît.">: a French
 *    sentence whose words each reveal their meaning when tapped;
 *  - <app-tap-word word="voudrais" [lines]="…">: ONE word (used for the Builder
 *    tiles, where the page decides the meaning and the look: 'tile' / 'chip').
 *
 * Behaviour (the visual rules):
 *  - a normal word: plain text with a subtle dotted underline, no icons;
 *  - the WHOLE word area is tappable (padding), not just the underline;
 *  - pressed: a slight background highlight;
 *  - revealed: the meaning slides in UNDERNEATH (150 ms fade/expand) on a small
 *    muted-green background, no modal or sheet;
 *  - words are independent: several can be open at once;
 *  - tap the word again, or tap anywhere that is not a word (or press Esc), to hide;
 *  - punctuation stays attached to its word (see splitSentence).
 */
import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, Input, OnChanges, ViewChild, ViewEncapsulation, inject,
} from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { GlossaryService } from './glossary.service';
import { splitSentence } from './glossary';
import { I18nAngularService } from '../services/i18n.service';
import { SettingsService } from '../services/settings.service';

export type TapWordVariant = 'inline' | 'tile' | 'chip';

@Component({
  selector: 'app-tap-word',
  standalone: true,
  imports: [NgFor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <span class="tw" [class.tw-open]="open" [class.tw-tile]="variant === 'tile'" [class.tw-chip]="variant === 'chip'" [class.tw-used]="used">
      <button type="button" class="tw-hit" [attr.aria-expanded]="open" (click)="toggle()">{{ word }}</button>
      <span class="tw-gloss" [attr.aria-hidden]="!open">
        <span class="tw-gloss-in">
          <span class="tw-gloss-text" #glossText><span class="tw-line" *ngFor="let l of shown">{{ l }}</span></span>
        </span>
      </span>
    </span>`,
  styles: [`
    app-tap-word { display: inline-block; vertical-align: top; max-width: 100%; }
    .tw { display: inline-flex; flex-direction: column; align-items: flex-start; max-width: 100%; }

    /* Whole word area is the tap target: padding around the text, not just the underline. */
    .tw-hit {
      appearance: none; -webkit-appearance: none; background: transparent; border: 0; margin: 0 -3px;
      padding: 4px 3px; font: inherit; color: inherit; cursor: pointer; border-radius: 6px; text-align: inherit;
      text-decoration: underline dotted; text-decoration-color: rgba(255, 255, 255, 0.38);
      text-decoration-thickness: 1px; text-underline-offset: 0.24em;
      -webkit-tap-highlight-color: transparent; transition: background-color 150ms ease;
    }
    .tw-hit:active { background-color: rgba(255, 255, 255, 0.14); }          /* pressed */
    .tw-hit:focus-visible { outline: 2px solid var(--ion-color-primary, #6c63ff); outline-offset: 1px; }

    /* The meaning, underneath: fades and expands in 150 ms (no layout jump from a modal). */
    /* width 0 + min-width 100%: the box is as wide as the word and adds nothing to it, so a
       longer meaning overhangs instead of pushing the neighbouring words apart. */
    .tw-gloss {
      display: grid; grid-template-rows: 0fr; width: 0; min-width: 100%; opacity: 0; visibility: hidden;
      transition: grid-template-rows 150ms ease, opacity 150ms ease, visibility 0s linear 150ms;
    }
    .tw-open .tw-gloss { grid-template-rows: 1fr; opacity: 1; visibility: visible; transition-delay: 0s; }
    .tw-gloss-in { overflow-y: clip; overflow-x: visible; min-height: 0; }
    .tw-tile .tw-gloss-in, .tw-chip .tw-gloss-in { display: flex; justify-content: center; }
    .tw-gloss-text {
      display: block; width: max-content; flex: none; margin: 3px 0 2px; padding: 2px 8px; border-radius: 8px; max-width: 14em;
      transform: translateX(var(--tw-dx, 0px));   /* nudged back on screen by fit() */
      font-size: 0.74rem; font-weight: 600; line-height: 1.3; text-align: left; white-space: normal;
      font-style: normal; text-decoration: none; letter-spacing: 0;
      color: #c8f3de; background: rgba(90, 209, 155, 0.16);                   /* small, muted green */
    }
    .tw-line { display: block; }
    .tw-line + .tw-line { opacity: 0.78; font-weight: 500; }

    /* Builder bank tile: the usual tile look, same dotted underline on the word. */
    .tw-tile .tw-hit, .tw-chip .tw-hit {
      display: inline-flex; align-items: center; height: 46px; box-sizing: border-box; margin: 0;
      padding: 0 16px; border-radius: 12px; font-size: 1.05rem; font-weight: 700; line-height: 1;
      border: 2px solid transparent;
    }
    .tw-tile .tw-hit { background: var(--ion-color-step-150, #24405f); color: var(--ion-text-color); }
    .tw-chip .tw-hit { background: var(--ion-color-primary); color: #fff; text-decoration-color: rgba(255, 255, 255, 0.55); }
    .tw-tile .tw-hit:active, .tw-chip .tw-hit:active { transform: scale(0.97); }
    .tw-tile.tw-used .tw-hit { opacity: 0.45; }
    .tw-tile, .tw-chip { align-items: center; }
    .tw-tile .tw-gloss-text, .tw-chip .tw-gloss-text { text-align: center; }

    .reduced-motion .tw-gloss, .reduced-motion .tw-hit { transition: none; }
  `],
})
export class TapWordComponent {
  private cdr = inject(ChangeDetectorRef);
  private i18n = inject(I18nAngularService);

  @Input() word = '';
  /** Meaning lines (first = main meanings, then phrases). Empty = "no translation yet". */
  @Input() lines: readonly string[] = [];
  @Input() variant: TapWordVariant = 'inline';
  /** Dimmed (e.g. a Builder tile that is already placed). */
  @Input() used = false;

  open = false;
  @ViewChild('glossText') private glossText?: ElementRef<HTMLElement>;

  get shown(): readonly string[] {
    return this.lines.length ? this.lines : [this.i18n.t('tw.none')];
  }

  toggle(): void {
    this.open = !this.open;
    this.cdr.markForCheck();
    if (this.open && typeof requestAnimationFrame === 'function') requestAnimationFrame(() => this.fit());
  }

  /** Keep the meaning inside the screen (a word near an edge would push it off). */
  private fit(): void {
    const el = this.glossText?.nativeElement;
    if (!el) return;
    el.style.setProperty('--tw-dx', '0px');
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const margin = 8;
    let dx = 0;
    if (r.right > vw - margin) dx = vw - margin - r.right;
    if (r.left + dx < margin) dx = margin - r.left;
    if (dx) el.style.setProperty('--tw-dx', `${Math.round(dx)}px`);
  }

  /** Tap anywhere that is not a word hides the meaning (another word keeps its own). */
  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: Event): void {
    if (!this.open) return;
    const t = ev.target as Element | null;
    if (t?.closest?.('.tw')) return;
    this.open = false;
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.open) return;
    this.open = false;
    this.cdr.markForCheck();
  }
}

@Component({
  selector: 'app-tap-words',
  standalone: true,
  imports: [NgFor, NgIf, TapWordComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `<span class="tws" lang="fr"><ng-container *ngIf="active; else plain"><app-tap-word *ngFor="let w of words; trackBy: trackWord"
    [word]="w.text" [lines]="w.lines"></app-tap-word></ng-container><ng-template #plain>{{ text }}</ng-template></span>`,
  styles: [`
    app-tap-words { display: inline; }
    .tws app-tap-word { margin-right: 0.28em; }
    .tws app-tap-word:last-child { margin-right: 0; }
  `],
})
export class TapWordsComponent implements OnChanges {
  private glossary = inject(GlossaryService);
  private settings = inject(SettingsService);

  /** The French sentence (or a piece of one). */
  @Input() text = '';
  /** Language of the sentence; defaults to the language being learned. */
  @Input() lang?: string;

  words: { text: string; lines: string[] }[] = [];
  active = false;

  ngOnChanges(): void {
    const lang = this.lang ?? this.settings.learningLanguage();
    this.active = this.glossary.supports(lang);
    if (!this.active) { this.words = []; return; }
    const parts = splitSentence(this.text);
    const glosses = this.glossary.lookup(lang, parts.map(p => p.token));
    this.words = parts.map((p, i) => ({ text: p.text, lines: glosses[i].lines }));
  }

  trackWord = (i: number, w: { text: string }): string => `${i}:${w.text}`;
}
