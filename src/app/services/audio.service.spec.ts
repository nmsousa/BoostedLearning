import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { AudioService } from './audio.service';
import { SettingsService } from './settings.service';

/**
 * ONE audio button per word: the first 3 hearings play at the normal speed, the
 * 4th is slower, then the cycle starts over. The icon replays its wave animation
 * on every play via `playSeq`, and `playKind` says which speed is sounding.
 */
describe('AudioService hearings and play signals', () => {
  let audio: AudioService;
  /** The rate each hearing was played at (undefined = the normal speed). */
  let rates: Array<number | undefined>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AudioService,
        { provide: HttpClient, useValue: { get: () => of({}) } },
        { provide: SettingsService, useValue: { audioSpeed: () => 1 } },
      ],
    });
    audio = TestBed.inject(AudioService);
    rates = [];
    // No real audio in tests: record the rate the (TTS fallback) path is asked for.
    vi.spyOn(audio, 'playTts').mockImplementation(async (_text: string, _lang: string, rate?: number) => {
      rates.push(rate);
      return { ok: true };
    });
  });

  const hear = async (text: string, times: number) => { for (let i = 0; i < times; i++) await audio.playWord(text, null, 'fr'); };

  it('plays the first 3 hearings of a word at the normal speed and the 4th slower', async () => {
    await hear('bonjour', 4);
    expect(rates).toEqual([undefined, undefined, undefined, 0.6]);
  });

  it('then starts the cycle over (hearings 5-7 normal, the 8th slower)', async () => {
    await hear('bonjour', 8);
    expect(rates).toEqual([undefined, undefined, undefined, 0.6, undefined, undefined, undefined, 0.6]);
  });

  it('counts a page\'s own auto-play as the first hearing', async () => {
    await audio.playWord('merci', null, 'fr');            // auto-play on arrival
    await hear('merci', 2);                                // two taps
    await audio.playWord('merci', null, 'fr');            // the 4th hearing
    expect(rates).toEqual([undefined, undefined, undefined, 0.6]);
  });

  it('starts over for a different word, and ignores case / spacing / apostrophe style', async () => {
    await hear('bonjour', 2);
    await hear('merci', 3);                                // new word: 3 normal hearings
    expect(rates).toEqual([undefined, undefined, undefined, undefined, undefined]);
    rates = [];
    await audio.playWord("L’eau", null, 'fr');
    await audio.playWord("  l'EAU ", null, 'fr');         // same word, written differently
    await audio.playWord("l'eau", null, 'fr');
    await audio.playWord("l'eau", null, 'fr');
    expect(rates).toEqual([undefined, undefined, undefined, 0.6]);
  });

  it('bumps playSeq on EVERY play, including repeats of the same word', async () => {
    const start = audio.playSeq();
    await hear('bonjour', 4);
    expect(audio.playSeq()).toBe(start + 4);
  });

  it('reports which speed started: normal, then slow on the 4th', () => {
    void audio.playWord('merci', null, 'fr');
    expect(audio.playKind()).toBe('normal');
    void audio.playWord('merci', null, 'fr');
    void audio.playWord('merci', null, 'fr');
    void audio.playWord('merci', null, 'fr');
    expect(audio.playKind()).toBe('slow');
  });
});

describe('AudioService when nothing can play', () => {
  it('does not leave the icon "playing" when there is no clip and no voice', async () => {
    TestBed.configureTestingModule({
      providers: [
        AudioService,
        { provide: HttpClient, useValue: { get: () => of({}) } },
        { provide: SettingsService, useValue: { audioSpeed: () => 1 } },
      ],
    });
    const audio = TestBed.inject(AudioService);
    await audio.playWord('inconnu', null, 'fr');
    expect(audio.playKind()).toBeNull();
  });
});
