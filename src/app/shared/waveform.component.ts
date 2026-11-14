/**
 * Waveform — a small decorative audio-bars visual (equalizer look).
 *
 * Purely cosmetic: it does NOT analyse the audio. It renders a fixed set of
 * bars that signal "this is audio", and when `active` is true the bars pulse
 * like an equalizer to show a clip is playing. Reused everywhere we play a
 * word (Learn, Match Audio, Quiz, Flashcards, Words, Builder).
 *
 * Standalone so any page module can import it directly.
 *
 * @module app/shared
 */
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NgFor } from '@angular/common';

@Component({
  selector: 'app-waveform',
  standalone: true,
  imports: [NgFor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="wf" [class.active]="active" aria-hidden="true">
      <span class="wf-bar" *ngFor="let h of bars; let i = index"
        [style.height.%]="h" [style.animation-delay.ms]="i * 90"></span>
    </span>
  `,
  styles: [`
    .wf {
      display: inline-flex; align-items: center; gap: 2px; height: 1em;
      color: inherit; vertical-align: middle;
    }
    .wf-bar {
      width: 2.5px; border-radius: 2px; background: currentColor;
      min-height: 12%;
    }
    /* Only animate while a clip is playing; otherwise the bars sit static at
       their preset heights (still reads as a waveform). */
    .wf.active .wf-bar {
      animation: wf-pulse 0.7s ease-in-out infinite alternate;
    }
    @keyframes wf-pulse {
      from { transform: scaleY(0.35); }
      to   { transform: scaleY(1); }
    }
    /* Respect reduced-motion: no pulsing, just the static bars. */
    :host-context(.reduced-motion) .wf.active .wf-bar { animation: none; }
  `],
})
export class WaveformComponent {
  /** Pulse the bars (a clip is playing) vs sit static. */
  @Input() active = false;
  /** Preset bar heights (%). A gentle organic shape, not real amplitude data. */
  readonly bars = [40, 70, 100, 55, 85, 35, 95, 60, 45, 80, 30];
}
