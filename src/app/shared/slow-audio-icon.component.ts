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
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-slow-audio-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="sa" [class.active]="active" aria-hidden="true">
      <svg viewBox="0 0 24 24" class="sa-svg">
        <!-- gauge arc -->
        <path d="M5 16 a7 7 0 0 1 14 0" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round"/>
        <!-- needle (points low-left = slow); animates when active -->
        <path class="sa-needle" d="M12 16 L8 13" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span class="sa-rate">{{ rateLabel }}</span>
    </span>
  `,
  styles: [`
    .sa {
      display: inline-flex; flex-direction: column; align-items: center;
      justify-content: center; line-height: 1; color: inherit; gap: 1px;
    }
    .sa-svg { width: 1.15em; height: 1.15em; display: block; }
    .sa-rate { font-size: 0.5em; font-weight: 800; letter-spacing: 0.02em; }
    .sa-needle { transform-origin: 12px 16px; transition: transform 0.2s ease; }

    /* When a slow clip plays: the needle sweeps and the whole glyph bounces,
       matching the normal play button's "alive" feel. */
    .sa.active .sa-svg { animation: sa-bounce 0.6s ease-in-out infinite alternate; }
    .sa.active .sa-needle { animation: sa-needle 0.9s ease-in-out infinite alternate; }
    @keyframes sa-bounce { from { transform: scale(0.92); } to { transform: scale(1.08); } }
    @keyframes sa-needle { from { transform: rotate(-18deg); } to { transform: rotate(18deg); } }

    :host-context(.reduced-motion) .sa.active .sa-svg,
    :host-context(.reduced-motion) .sa.active .sa-needle { animation: none; }
  `],
})
export class SlowAudioIconComponent {
  /** Pulse/sweep while a slow clip is playing. */
  @Input() active = false;
  /** The REAL slow playback rate (e.g. 0.6). Shown as "0.6×". */
  @Input() rate = 0.6;

  get rateLabel(): string {
    // Trim a trailing ".0" so 0.5 shows "0.5×" and 1 would show "1×".
    const r = Math.round(this.rate * 100) / 100;
    return `${r}×`;
  }
}
