/**
 * Generates src/app/shared/audio-play-icon.component.ts from the audio icon:
 *
 *   src/assets/icon/play-audio-normal.svg   (speaker + 3 animated sound waves)
 *
 * WHY: the app does not load that .svg file at runtime. Its shapes are inlined
 * into the Angular component so the icon takes the button's colour and so the
 * waves can be re-created (= the animation replays) every time audio plays — an
 * SVG file on its own only animates once when it loads. So after you edit the
 * SVG, run:
 *
 *   npm run gen:audio-icon
 *
 * (It also runs automatically before every `npm run build` / `npm start`, so a
 * release can never ship a stale icon.) Never edit the generated component by
 * hand; edit the SVG, or this script for the component's behaviour.
 *
 * What is read from the SVG: the speaker body, the wave shapes (in any order),
 * an optional <g> wrapping the waves, and the animation settings (duration,
 * easing, fill mode, transform origin, end transform, per-wave delays). The wave
 * that starts LAST is the one whose animationend switches back to the still icon.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'src/assets/icon/play-audio-normal.svg'), 'utf8');

const fail = (msg) => { console.error('gen-audio-icon: ' + msg); process.exit(1); };
const squash = (s) => s.replace(/\s+/g, ' ').trim();
const unsafe = (s) => /[`\\]|\$\{/.test(s);

// ── Shapes ───────────────────────────────────────────────────────────────────
const viewBox = /<svg\b[^>]*\bviewBox="([^"]+)"/s.exec(svg)?.[1];
if (!viewBox) fail('no viewBox on the <svg>');

let body = null;
const waves = [];                                   // { cls, d } in file order
for (const m of svg.matchAll(/<path\b([^>]*?)\/>/gs)) {
  const d = /\bd="([^"]+)"/.exec(m[1])?.[1];
  if (!d) continue;
  const cls = /class="([^"]*)"/.exec(m[1])?.[1] ?? '';
  const waveCls = cls.split(/\s+/).find((c) => /^wave-/.test(c));
  if (waveCls || /\bsound-wave\b/.test(cls)) {
    if (!waveCls) fail('a wave path has no wave-* class (needed to find its delay)');
    waves.push({ cls: waveCls, d: squash(d) });
  } else if (!body) body = squash(d);
}
if (!body) fail('speaker body path not found (a <path> without a wave class)');
if (waves.length < 1) fail('no wave paths found (paths with class "sound-wave wave-…")');

// A <g> that directly wraps the waves (e.g. a translate), copied verbatim.
const wrapper = /<g\b([^>]*)>(?:\s|<!--(?:(?!-->)[\s\S])*-->)*<path\b[^>]*class="[^"]*\bwave-/.exec(svg);
const wrapperAttrs = wrapper ? squash(wrapper[1]) : null;

// ── Animation (from the file's <style>) ────────────────────────────────────────────
const css = /<style>([\s\S]*?)<\/style>/.exec(svg)?.[1] ?? '';
const a = /animation:\s*wave-expand\s+(\d+)ms\s+(cubic-bezier\([^)]*\))\s+(\w+)/.exec(css);
const origin = /transform-origin:\s*([^;]+);/.exec(css)?.[1]?.trim();
const startTransform = /0%\s*\{[^}]*transform:\s*([^;]+);/.exec(css)?.[1]?.trim();
const endTransform = /100%\s*\{[^}]*transform:\s*([^;]+);/.exec(css)?.[1]?.trim();
if (!a || !origin || !startTransform || !endTransform) fail('could not read the animation settings from <style>');
const ANIM = { ms: Number(a[1]), easing: a[2], fill: a[3], origin, from: startTransform, to: endTransform };

for (const w of waves) {
  const re = new RegExp(`\\.${w.cls}\\s*\\{[^}]*animation-delay:\\s*(\\d+)ms`);
  const delay = Number(re.exec(css)?.[1]);
  if (Number.isNaN(delay)) fail(`no animation-delay for .${w.cls}`);
  w.delay = delay;
}
for (const [n, v] of Object.entries({ body, origin, easing: ANIM.easing, ...Object.fromEntries(waves.map((w, i) => ['wave' + i, w.d])) })) {
  if (unsafe(v)) fail(`${n} contains a character that is unsafe inside a template literal`);
}
if (wrapperAttrs && unsafe(wrapperAttrs)) fail('waves wrapper has an unsafe character');

// Start order: first to appear first. The one that starts last also ends last.
const byStart = [...waves].sort((x, y) => x.delay - y.delay);
const last = byStart[byStart.length - 1];
const TOTAL_MS = last.delay + ANIM.ms + 100;       // + slack for the fallback timer

// ── Template pieces ─────────────────────────────────────────────────────────────
const stillWaves = waves.map((w) => `
          <path class="wave" d="${w.d}"/>`).join('');
const animatedWaves = byStart.map((w, i) => `
            <path class="sound-wave w${i}"${w === last ? ' (animationend)="onWaveEnd()"' : ''} d="${w.d}"/>`).join('');
const delays = byStart.map((w, i) => `    .w${i} { animation-delay: ${w.delay}ms; }`).join('\n');
const wavesBlock = `
        <ng-container *ngIf="!animating">${stillWaves}
        </ng-container>
        <ng-container *ngIf="animating">
          <ng-container *ngFor="let run of [runId]">${animatedWaves}
          </ng-container>
        </ng-container>`;
const wavesInSvg = wrapperAttrs ? `
      <g ${wrapperAttrs}>${wavesBlock}
      </g>` : wavesBlock;

const out = `/**
 * AudioPlayIcon — the play-audio icon used on every audio button: a speaker with
 * three sound waves (src/assets/icon/play-audio-normal.svg).
 *
 * >>> GENERATED by scripts/gen-audio-icon.mjs from that SVG.
 * >>> Do not edit by hand. After changing the SVG run:  npm run gen:audio-icon
 *
 * It is inlined (so it takes the button's colour). At rest the waves are drawn
 * still. EVERY time audio plays — on entering a page that auto-plays, or when the
 * user taps to hear it again — the parent bumps \`playToken\` while \`active\` is
 * true, and the waves are re-created so the animation plays again (an SVG file on
 * its own only animates once when it loads, so it can't replay itself).
 *
 * Standalone so any page module can import it directly.
 *
 * @module app/shared
 */
import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, HostBinding, Input, OnChanges, OnDestroy,
  SimpleChanges, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';

/** Fallback only: normally the last wave's animationend ends the animation. */
const WAVE_ANIM_MS = ${TOTAL_MS};

@Component({
  selector: 'app-audio-play-icon',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    <svg class="ap-svg" viewBox="${viewBox}" fill="currentColor" aria-hidden="true">
      <path d="${body}"/>${wavesInSvg}
    </svg>
  \`,
  styles: [\`
    /* Sits in the button's own centring (inline-flex / grid), like any icon. */
    :host { display: inline-grid; place-items: center; line-height: 1; pointer-events: none; }
    /* Override the size with the size input (any CSS length, e.g. size="40px").
       Colour: primary, or the button's own colour with tone="inherit". */
    .ap-svg {
      display: block; overflow: visible; color: var(--ion-color-primary, #38bdf8);
      width: var(--ap-size, 24px); height: var(--ap-size, 24px);
    }
    :host(.tone-inherit) .ap-svg { color: currentColor; }

    /* Waves expand in from the speaker, one after another (copied from the SVG). */
    .sound-wave {
      opacity: 0;
      transform-box: view-box;
      transform-origin: ${ANIM.origin};
      animation: ap-wave ${ANIM.ms}ms ${ANIM.easing} ${ANIM.fill};
    }
${delays}
    @keyframes ap-wave {
      0%   { opacity: 0; transform: ${ANIM.from}; }
      15%  { opacity: 1; }
      100% { opacity: 1; transform: ${ANIM.to}; }
    }
    @media (prefers-reduced-motion: reduce) {
      .sound-wave { animation: none; opacity: 1; transform: none; }
    }
    :host-context(.reduced-motion) .sound-wave { animation: none; opacity: 1; transform: none; }
  \`],
})
export class AudioPlayIconComponent implements OnChanges, OnDestroy {
  private cdr = inject(ChangeDetectorRef);

  /** True while audio is playing (so the icon reacts). */
  @Input() active = false;
  /** Bumps on EVERY play. When it changes while \`active\`, the wave animation
   *  restarts — on page-entry auto-plays and on every repeat tap alike. */
  @Input() playToken = 0;
  /** Colour: 'primary' (default blue) or 'inherit' (the button's own colour). */
  @Input() tone: 'primary' | 'inherit' = 'primary';
  /** Optional size override (any CSS length, e.g. "40px"). */
  @Input() size = '';

  @HostBinding('class.tone-inherit') get toneInherit(): boolean { return this.tone === 'inherit'; }
  @HostBinding('style.--ap-size') get sizeVar(): string | null { return this.size || null; }

  /** True while the waves are mid-animation (they show still otherwise). */
  animating = false;
  /** Changes on each replay so the animated waves are re-created. */
  runId = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['playToken'] && this.active && this.playToken > 0) this.replay();
  }

  ngOnDestroy(): void { if (this.timer) clearTimeout(this.timer); }

  /** The wave animation is over: show the still waves again. */
  onWaveEnd(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (!this.animating) return;
    this.animating = false;
    this.cdr.markForCheck();
  }

  private replay(): void {
    this.runId++;
    this.animating = true;
    if (this.timer) clearTimeout(this.timer);
    // Normally the last wave's animationend swaps us back (exactly when it
    // finishes). This timer is only a fallback for when no animation runs
    // (reduced motion).
    this.timer = setTimeout(() => this.onWaveEnd(), WAVE_ANIM_MS);
    this.cdr.markForCheck();
  }
}
`;

const target = join(root, 'src/app/shared/audio-play-icon.component.ts');
let previous = '';
try { previous = readFileSync(target, 'utf8'); } catch { /* first run */ }
if (previous.replace(/\r\n/g, '\n') === out) {
  console.log('audio-play-icon.component.ts is up to date.');
} else {
  writeFileSync(target, out);
  console.log(`audio-play-icon.component.ts regenerated (animation ${ANIM.ms}ms, delays ${byStart.map((w) => w.delay).join('/')}ms).`);
}
