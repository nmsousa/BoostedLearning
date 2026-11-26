/**
 * The ONE tap-to-translate popup.
 *
 * Only one popup can exist at a time: opening another closes the first. It is
 * plain DOM appended to <body> (so it floats above any Ionic page, never moves
 * the layout, and needs no template), positioned next to the tapped word or
 * block with a small arrow pointing at the middle of it.
 *
 * It closes IMMEDIATELY (no fade-out) when:
 *  - you tap or click anywhere that is not a word of a sentence;
 *  - the mouse leaves the word (touch has no hover, so only for a mouse);
 *  - the page scrolls, is resized or rotated, or Esc is pressed;
 *  - the sentence changes or goes away (the component calls closeIf).
 * Tapping the open word again closes it too (a word's click handler does that).
 */
import { Injectable, signal } from '@angular/core';

/** Where the tapped word is on screen (viewport pixels). */
export interface AnchorRect { left: number; right: number; top: number; bottom: number }

/** The class of every tappable word / block (a tap on one is handled by its own click). */
export const TAP_SEGMENT_CLASS = 'tt-seg';

const GAP = 10;           // popup ↔ word (includes the arrow)
const EDGE_MARGIN = 8;    // popup ↔ screen edge
const ARROW_INSET = 12;   // arrow stays this far from the popup's corners

@Injectable({ providedIn: 'root' })
export class TapPopupService {
  /** Who owns the open popup (a segment object), or null. Components read it to highlight their word. */
  readonly current = signal<object | null>(null);

  private el: HTMLElement | null = null;
  private stopListening: (() => void) | null = null;

  isOpenFor(owner: object): boolean { return this.current() === owner; }

  /** Open the popup for `owner` next to `anchor`, closing any other one first. */
  show(owner: object, anchor: AnchorRect, lines: readonly string[]): void {
    this.close();
    if (!lines.length || typeof document === 'undefined') return;

    const el = document.createElement('div');
    el.className = 'tp-popup';
    el.setAttribute('role', 'tooltip');
    lines.forEach((line, i) => {
      const row = document.createElement('div');
      row.className = i === 0 ? 'tp-line tp-main' : 'tp-line';
      row.textContent = line;
      el.appendChild(row);
    });
    const arrow = document.createElement('span');
    arrow.className = 'tp-arrow';
    el.appendChild(arrow);
    document.body.appendChild(el);

    // Place it: below a word in the top half of the screen, above otherwise;
    // flip if it would not fit; keep it inside the screen; point the arrow at the word's middle.
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const box = el.getBoundingClientRect();
    const cx = (anchor.left + anchor.right) / 2;
    const left = Math.max(EDGE_MARGIN, Math.min(cx - box.width / 2, vw - box.width - EDGE_MARGIN));
    let below = anchor.top < vh * 0.5;
    if (below && anchor.bottom + GAP + box.height > vh - EDGE_MARGIN) below = false;
    else if (!below && anchor.top - GAP - box.height < EDGE_MARGIN) below = true;
    const top = below ? anchor.bottom + GAP : anchor.top - GAP - box.height;
    const arrowX = Math.max(ARROW_INSET, Math.min(cx - left, box.width - ARROW_INSET));

    el.classList.add(below ? 'tp-below' : 'tp-above');
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
    el.style.setProperty('--tp-arrow-x', `${Math.round(arrowX)}px`);

    this.el = el;
    this.current.set(owner);
    this.listen();
    requestAnimationFrame(() => el.classList.add('tp-in'));   // a quick fade in
  }

  /** Close right away (no fade-out). */
  close(): void {
    this.stopListening?.();
    this.stopListening = null;
    this.el?.remove();
    this.el = null;
    if (this.current() !== null) this.current.set(null);
  }

  /** Close only if the popup belongs to `owner`. */
  closeIf(owner: object): void {
    if (this.current() === owner) this.close();
  }

  /** Close if the popup belongs to any owner matching `test` (a sentence being replaced). */
  closeWhere(test: (owner: object) => boolean): void {
    const o = this.current();
    if (o && test(o)) this.close();
  }

  private listen(): void {
    const onPointerDown = (ev: Event): void => {
      // A word handles its own tap (open / switch / close); anything else closes.
      if ((ev.target as Element | null)?.closest?.(`.${TAP_SEGMENT_CLASS}`)) return;
      this.close();
    };
    const closeNow = (): void => this.close();
    const onKey = (ev: KeyboardEvent): void => { if (ev.key === 'Escape') this.close(); };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('scroll', closeNow, true);
    document.addEventListener('wheel', closeNow, { capture: true, passive: true });
    document.addEventListener('touchmove', closeNow, { capture: true, passive: true });
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', closeNow);
    window.addEventListener('orientationchange', closeNow);
    this.stopListening = () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('scroll', closeNow, true);
      document.removeEventListener('wheel', closeNow, true);
      document.removeEventListener('touchmove', closeNow, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', closeNow);
      window.removeEventListener('orientationchange', closeNow);
    };
  }
}
