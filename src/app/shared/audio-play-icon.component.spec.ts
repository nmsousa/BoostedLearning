import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AudioPlayIconComponent } from './audio-play-icon.component';

/**
 * The audio icon (speaker + waves) replays its wave animation EVERY time audio
 * plays: when a page auto-plays on entry, and on every tap to hear it again.
 * These tests drive the inputs the way a page does (active + a play counter that
 * bumps on each play).
 */
describe('AudioPlayIconComponent', () => {
  let fixture: ComponentFixture<AudioPlayIconComponent>;
  let comp: AudioPlayIconComponent;
  const el = () => fixture.nativeElement as HTMLElement;
  const animatedWaves = () => el().querySelectorAll('.sound-wave').length;
  const stillWaves = () => el().querySelectorAll('.wave').length;

  /** Set inputs and run change detection (ngOnChanges needs setInput). */
  function set(inputs: Partial<{ active: boolean; playToken: number; tone: 'primary' | 'inherit'; size: string }>) {
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({ imports: [AudioPlayIconComponent] }).compileComponents();
    fixture = TestBed.createComponent(AudioPlayIconComponent);
    comp = fixture.componentInstance;
  });
  afterEach(() => vi.useRealTimers());

  it('draws the speaker with its still waves when nothing is playing', () => {
    set({ active: false, playToken: 0 });
    expect(el().querySelector('svg')).toBeTruthy();
    expect(animatedWaves()).toBe(0);
    expect(comp.animating).toBe(false);
    expect(stillWaves()).toBe(3);
  });

  it('plays the wave animation when audio starts (page auto-play)', () => {
    set({ active: false, playToken: 4 });   // page opened; token already > 0
    expect(animatedWaves()).toBe(0);
    set({ active: true, playToken: 5 });    // audio starts
    expect(comp.animating).toBe(true);
    expect(animatedWaves()).toBe(3);
  });

  it('replays the animation on every repeat tap, even while still playing', () => {
    set({ active: true, playToken: 1 });
    const firstRun = comp.runId;
    expect(animatedWaves()).toBe(3);
    const firstEl = el().querySelector('.sound-wave');

    set({ playToken: 2 });                  // tapped again mid-play
    expect(comp.runId).toBe(firstRun + 1);
    expect(animatedWaves()).toBe(3);
    // The waves were re-created (a new element), which is what restarts the CSS animation.
    expect(el().querySelector('.sound-wave')).not.toBe(firstEl);
  });

  it('settles back to still waves after the animation, even if the audio stopped sooner', () => {
    set({ active: true, playToken: 1 });
    set({ active: false });                 // the short clip already ended
    expect(animatedWaves()).toBe(3);        // animation keeps going to completion
    vi.advanceTimersByTime(1500);           // past the fallback timer (last delay + duration + slack)
    fixture.detectChanges();
    expect(comp.animating).toBe(false);
    expect(animatedWaves()).toBe(0);
    expect(stillWaves()).toBe(3);
  });

  it('switches back the moment the last wave finishes (no blurry in-between frames)', () => {
    set({ active: true, playToken: 1 });
    const waves = [...el().querySelectorAll('.sound-wave')];
    // Only the wave that starts LAST ends the animation.
    waves[0].dispatchEvent(new Event('animationend'));
    fixture.detectChanges();
    expect(comp.animating).toBe(true);
    waves[waves.length - 1].dispatchEvent(new Event('animationend'));
    fixture.detectChanges();
    expect(comp.animating).toBe(false);
    expect(stillWaves()).toBe(3);
  });

  it('does not animate for the initial token alone (no audio, just a page with history)', () => {
    set({ active: false, playToken: 9 });
    expect(comp.animating).toBe(false);
  });

  it('applies tone and size', () => {
    set({ tone: 'inherit', size: '40px' });
    expect(el().classList.contains('tone-inherit')).toBe(true);
    expect(el().style.getPropertyValue('--ap-size')).toBe('40px');
  });
});
