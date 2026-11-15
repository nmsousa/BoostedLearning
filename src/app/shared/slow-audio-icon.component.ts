/**
 * SlowAudioIcon — the "slow replay" glyph (option G3): a small speed gauge with
 * the REAL playback rate shown beneath it (e.g. "0.6×"). The rate is passed in
 * so it always reflects what the audio actually does — and when we later add a
 * proper SSML-based slow version, just feed its rate here.
 *
 * Mirrors the play button's "alive" animation: when `active` is true (a slow
 * clip is playing) the gauge needle sweeps and the glyph gently bounces.
 *
 * Standalone so any page module can import it directly.
 *
 * @module app/shared
 */
import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-slow-audio-icon',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="sa" aria-hidden="true">
      <!-- Ionicons-style outline snail (src/assets/icon/snail-ionic-style.svg),
           inlined so it inherits currentColor. The snail alone means "slow";
           the ring (below) sweeps while a clip plays. For the NORMAL-speed
           button we want ONLY the ring (glyph="none") drawn around the button's
           own volume icon, so the snail is omitted there. -->
      <svg *ngIf="glyph === 'snail'" viewBox="0 0 24 24" class="sa-svg" fill="none" stroke="currentColor"
        [attr.stroke-width]="strokeWidth" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9.5" cy="12.5" r="6.5"/>
        <path d="M12 12.5c0-1.45-1.1-2.6-2.5-2.6S7 11.05 7 12.5s1.1 2.6 2.5 2.6 2.5-1.15 2.5-2.6"/>
        <path d="M3 18.5h12.2c3.2 0 5.8-2.6 5.8-5.8V9"/>
        <path d="M18.8 8.7 18 5.8M21.4 8.4 22.2 5.5"/>
        <circle cx="18" cy="5.5" r=".7" fill="currentColor" stroke="none"/>
        <circle cx="22.3" cy="5.2" r=".7" fill="currentColor" stroke="none"/>
      </svg>

      <!-- Progress ring: a single SVG arc that sweeps CLOCKWISE from empty to a
           full circle. The arc is driven DIRECTLY by the audio element's live
           position (progress 0→1), so it ALWAYS ends exactly with the sound at
           any playback rate — no precomputed-length guess that can drift. The
           dashoffset has a short CSS transition so it glides smoothly between
           the ~4×/s position updates instead of stepping. The -90° rotation
           starts the fill at 12 o'clock. -->
      <svg *ngIf="active && !inline" class="sa-ring" viewBox="0 0 36 36" aria-hidden="true"
        [class.finishing]="progress >= 1">
        <circle class="sa-ring-arc" cx="18" cy="18" r="17.4" fill="none"
          stroke-width="2" stroke-linecap="butt"
          transform="rotate(-90 18 18)"
          [style.stroke-dashoffset]="dashOffset"
          [style.stroke]="ringColor"/>
      </svg>
    </span>
  `,
  styles: [`
    /* Fill the whole button so the ring can be exactly the BUTTON's circle
       (inset:0) — not an em-guess that mismatches the button size on desktop.
       The snail stays centred via place-items. The parent button is a circle
       (position relative/grid), so filling it doesn't move the snail. */
    :host { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
    /* Inline mode (e.g. the Match-Audio listen tile): the glyph sits in normal
       flow INSIDE its tile instead of absolutely filling a round button, so it
       can't escape to a positioned ancestor and float off the card. No ring in
       this mode — the tile isn't a timed slow-replay button. */
    :host(.inline) { position: static; inset: auto; display: inline-grid; }
    .sa { position: static; display: grid; place-items: center; line-height: 1; }
    /* The snail glyph defaults to the app's light-blue primary (like the Quiz
       speaker icon). With tone="inherit" it uses the parent button's own colour
       (currentColor) instead, so a mode can keep both its audio icons the same
       muted tone (e.g. Learn's whitish-grey). */
    .sa-svg { width: 1.25em; height: 1.25em; display: block; overflow: visible; grid-area: 1 / 1;
      color: var(--ion-color-primary, #38bdf8); }
    :host(.tone-inherit) .sa-svg { color: currentColor; }

    /* The ring sits at the button's EDGE (inset:-1px makes the SVG ~2px larger
       than the button, like the old 2.1em look), concentric with it. Anchoring
       to the button (not an em-guess) keeps it aligned on desktop too. */
    .sa-ring {
      position: absolute; inset: -1px;
      pointer-events: none; overflow: visible;
    }
    /* r=17.4 → circumference = 2*pi*17.4 ≈ 109.33. The arc's fill is set from
       the live audio position (dashOffset binding): offset 109.33 = empty,
       0 = full. A short transition glides the stroke between the ~4×/s position
       updates so it looks continuous rather than stepping. Colour also eases
       from lavender toward primary as it fills (bound inline). */
    .sa-ring-arc {
      stroke-dasharray: 109.33;
      /* No transition on dashoffset: the service updates progress every frame
         (rAF), so the fill is already smooth. A transition here would make the
         ring LAG behind the sound and never quite reach full before it fades.
         Colour eases gently; width/opacity ease only for the finish fade. */
      transition: stroke 0.2s linear;
    }
    /* When the clip ends (progress hit 1) thin + fade the full ring so it
       doesn't linger as a solid circle. */
    .sa-ring.finishing .sa-ring-arc {
      stroke-width: 1;
      opacity: 0;
      transition: stroke-width 0.4s ease-in, opacity 0.4s ease-in;
    }
    :host-context(.reduced-motion) .sa-ring-arc { transition: none; }
  `],
})
export class SlowAudioIconComponent {
  /** The ring's full-circle circumference (2·π·17.4). */
  private static readonly CIRC = 109.33;

  /** True while this button's clip plays — shows the ring. */
  @Input() active = false;
  /** Kept for template compatibility (the rate label was removed). */
  @Input() rate = 0.6;
  /** Kept for template compatibility; no longer drives a rebuild (the ring now
   *  tracks live progress, which resets to 0 on each new play). */
  @Input() playToken = 0;
  /** Kept for template compatibility (the ring no longer uses a precomputed
   *  length — it tracks real playback progress instead). */
  @Input() durationMs = 0;
  /** Live playback progress 0→1 from the audio element. Drives the arc's fill
   *  DIRECTLY, so the ring ends exactly with the sound at any rate. */
  @Input() progress = 0;
  /** Snail glyph stroke width. 1.5 reads cleanly between too-thin and heavy. */
  @Input() strokeWidth = 1.5;
  /** Which centre glyph to draw: 'snail' (the slow-replay button) or 'none'
   *  (the NORMAL-speed button, where only the progress ring is wanted around
   *  the button's own volume icon). */
  @Input() glyph: 'snail' | 'none' = 'snail';
  /** Inline mode: the glyph sits in normal flow inside its container (no
   *  absolute fill, no ring). Used where the icon IS the tile's content (e.g.
   *  Match-Audio listen tiles) rather than an overlay on a round button. */
  @Input() @HostBinding('class.inline') inline = false;
  /** Snail colour: 'primary' (default blue) or 'inherit' (the parent button's
   *  own colour, so a mode can keep both audio icons the same tone). */
  @Input() tone: 'primary' | 'inherit' = 'primary';
  @HostBinding('class.tone-inherit') get toneInherit(): boolean { return this.tone === 'inherit'; }

  /** Clamp progress to 0→1. */
  private get p(): number { return Math.min(1, Math.max(0, this.progress || 0)); }

  /** stroke-dashoffset for the current progress: full circumference = empty,
   *  0 = full. */
  get dashOffset(): number {
    return +(SlowAudioIconComponent.CIRC * (1 - this.p)).toFixed(2);
  }

  /** Ring colour eases from lavender (empty) toward primary (full) as it
   *  fills, mixed in sRGB by the current progress. */
  get ringColor(): string {
    const pct = Math.round(this.p * 100);
    return `color-mix(in srgb, var(--ion-color-primary, #38bdf8) ${pct}%, #c9cdff)`;
  }
}
