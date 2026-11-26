/**
 * <app-tap-text> — a sentence whose words can be tapped to see their meaning.
 *
 *  - dir="learning" (default): a sentence in the language being learned; each
 *    word, or block of words with one meaning ("s’il vous plaît"), shows its
 *    meaning in the user's language;
 *  - dir="native": the prompt in the user's language; each word or block shows
 *    the learning-language word(s) it corresponds to. Pass `context` = the
 *    learning-language words of the sentence it translates, so the right word
 *    is shown (not every possible one).
 *
 * Look: every tappable word or block has a subtle dotted underline (a block is
 * ONE continuous underline); no icons. Pressed = slight highlight; open = muted
 * green. The whole word area is the tap target. The meaning is shown in the
 * single shared popup (TapPopupService) with an arrow to the middle of the word.
 */
import {
  ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, ViewEncapsulation, inject,
} from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { GlossaryService } from './glossary.service';
import type { GlossSegment } from './glossary';
import { TAP_SEGMENT_CLASS, TapPopupService, type AnchorRect } from './tap-popup.service';
import { SettingsService } from '../services/settings.service';

@Component({
  selector: 'app-tap-text',
  standalone: true,
  imports: [NgFor, NgIf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `<span class="tt"><ng-container *ngIf="segs; else plain"><ng-container *ngFor="let s of segs; let last = last; trackBy: trackSeg"><span
    *ngIf="s.lines.length; else dead" class="tt-seg" role="button" tabindex="0"
    [class.tt-open]="popup.current() === s" [attr.aria-expanded]="popup.current() === s"
    (click)="toggle($event, s)" (keydown.enter)="toggle($event, s)" (keydown.space)="toggle($event, s)"
    (pointerleave)="onLeave($event, s)">{{ s.text }}</span><ng-template #dead>{{ s.text }}</ng-template>{{ last ? '' : ' ' }}</ng-container></ng-container><ng-template #plain>{{ text }}</ng-template></span>`,
  styles: [`
    app-tap-text { display: inline; }
    .tt-seg {
      cursor: pointer; border-radius: 6px;
      /* The whole word area is tappable: padding grows the hit area without moving the text. */
      padding: 4px 2px; margin: -4px -2px;
      text-decoration: underline dotted; text-decoration-color: rgba(255, 255, 255, 0.4);
      text-decoration-thickness: 1px; text-underline-offset: 0.24em;
      -webkit-tap-highlight-color: transparent; transition: background-color 120ms ease;
    }
    .tt-seg:active { background-color: rgba(255, 255, 255, 0.14); }
    .tt-seg.tt-open { background-color: rgba(90, 209, 155, 0.2); }
    .tt-seg:focus-visible { outline: 2px solid var(--ion-color-primary, #6c63ff); outline-offset: 1px; }
    .reduced-motion .tt-seg { transition: none; }
  `],
})
export class TapTextComponent implements OnChanges, OnDestroy {
  protected readonly popup = inject(TapPopupService);
  private glossary = inject(GlossaryService);
  private settings = inject(SettingsService);

  /** The sentence. */
  @Input() text = '';
  /** 'learning' = a sentence in the language being learned; 'native' = the user's-language prompt. */
  @Input() dir: 'learning' | 'native' = 'learning';
  /** native only: the learning-language words of the sentence this prompt translates. */
  @Input() context: readonly string[] = [];
  /** Language being learned; defaults to the user's current one. */
  @Input() lang?: string;

  segs: GlossSegment[] | null = null;

  ngOnChanges(): void {
    this.closeMine();
    const lang = this.lang ?? this.settings.learningLanguage();
    this.segs = this.dir === 'native'
      ? this.glossary.native(lang, this.text, this.context)
      : this.glossary.learning(lang, this.text);
  }

  ngOnDestroy(): void { this.closeMine(); }

  trackSeg = (i: number, s: GlossSegment): string => `${i}:${s.text}`;

  private closeMine(): void {
    const mine = this.segs;
    if (mine) this.popup.closeWhere(o => mine.includes(o as GlossSegment));
  }

  /** Open this word's popup; tapping the open word again closes it; another word switches. */
  toggle(ev: Event, seg: GlossSegment): void {
    if (ev instanceof KeyboardEvent) ev.preventDefault();
    if (this.popup.isOpenFor(seg)) { this.popup.close(); return; }
    this.popup.show(seg, this.anchorOf(ev), seg.lines);
  }

  /** A mouse leaving the word closes its popup at once (touch has no hover). */
  onLeave(ev: PointerEvent, seg: GlossSegment): void {
    if (ev.pointerType === 'mouse') this.popup.closeIf(seg);
  }

  /** The box to point at: the line of the word that was tapped (a block can wrap onto two lines). */
  private anchorOf(ev: Event): AnchorRect {
    const el = ev.currentTarget as HTMLElement;
    const rects = Array.from(el.getClientRects());
    let r: DOMRect = rects[0] ?? el.getBoundingClientRect();
    if (rects.length > 1 && ev instanceof MouseEvent) {
      r = rects.find(x => ev.clientY >= x.top && ev.clientY <= x.bottom) ?? r;
    }
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  }
}

export { TAP_SEGMENT_CLASS };
