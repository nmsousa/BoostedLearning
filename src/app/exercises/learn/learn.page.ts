/**
 * Learn Page — the intro step before the drills.
 *
 * The first activity of every Tree level: it simply TEACHES the level's words
 * before any testing. For Core words it shows the English meaning plus a short
 * grammar/usage note; for theme words it shows the meaning plus an emoji (where
 * one is authored). The learner swipes through the cards and taps Done, which
 * marks the Learn node passed (no scoring — it's a teaching step).
 *
 * Words are shown EXACTLY as authored ("le thé"), matching the bundled audio
 * clip and every other mode (Flashcards/Write). Audio must always match the
 * displayed text, so no article stripping here.
 *
 * It reads the level's words from the synthetic Tree deck and enriches each
 * with its note/emoji from the curriculum (looked up by French text). Launched
 * as a Journey node: /practice/learn/:id?level=N&mode=journey-learn&from=…
 *
 * @module app/exercises/learn
 */

import {
  Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NavController, ToastController, ViewWillEnter, ViewWillLeave } from '@ionic/angular';
import { FlashcardService, Flashcard, FlashcardDeck } from '../../services/flashcard.service';
import { I18nAngularService } from '../../services/i18n.service';
import { SettingsService } from '../../services/settings.service';
import { AudioService } from '../../services/audio.service';
import { BackInterceptorService } from '../../services/back-interceptor.service';
import { journeyBackUrl } from '../../maps/journey/journey-back';
import { lookupCoreWord } from '../../maps/tree/tree-curriculum';

interface LearnCard {
  /** The word exactly as authored ("le thé") — matches the audio clip. */
  fr: string;
  en: string;
  audioUrl: string | null;
  /** Grammar/usage note (Core words). */
  note?: string;
  /** Representative emoji (early theme words). */
  icon?: string;
}

@Component({
  selector: 'app-learn',
  templateUrl: './learn.page.html',
  styleUrls: ['./learn.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LearnPage implements OnInit, OnDestroy, ViewWillEnter, ViewWillLeave {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private navCtrl = inject(NavController);
  private flashcards = inject(FlashcardService);
  private i18n = inject(I18nAngularService);
  private settings = inject(SettingsService);
  private audio = inject(AudioService);
  private toast = inject(ToastController);
  private backInterceptor = inject(BackInterceptorService);
  private cdr = inject(ChangeDetectorRef);

  private readonly onHardwareBack: () => boolean = () => { this.leave(); return true; };

  deck: FlashcardDeck | null = null;
  private levelNumber = 0;
  private backUrl = '/practice';
  /** True when opened as a Tree/Journey node (has ?from=…): completing then
   *  marks the journey-learn node passed. When opened standalone from the home
   *  Learn mode list, it's pure practice and records no node progress. */
  private isJourneyNode = false;

  isLoading = true;
  /** 'learning' = swiping cards; 'done' = recap/summary screen. */
  phase: 'learning' | 'done' = 'learning';
  cards: LearnCard[] = [];
  index = 0;
  levelTitle = '';

  /** True during the brief card-change animation; gates Continue so a fast
   *  double-tap can't skip a card (and drives the slide/fade transition). */
  transitioning = false;
  /** Minimum gap between advances (ms) — matches the CSS transition. */
  private static readonly TRANSITION_MS = 160;

  /** Per-card normal-speed play count, so a 2nd tap plays the slow version
   *  (same "turtle" rule as the Flashcard modes). Keyed by card index. */
  private playCounts = new Map<number, number>();

  /** The live "is a clip playing" signal, read in the template so the play
   *  button's waveform pulses while sound is playing. */
  readonly playing = this.audio.playing;
  /** Real slow-replay rate, shown on the slow (gauge) icon. */
  readonly slowRate = this.audio.slowRate;

  t(key: string, params?: Record<string, string | number>): string { return this.i18n.t(key, params); }

  ionViewWillEnter(): void { this.backInterceptor.register(this.onHardwareBack); }
  ionViewWillLeave(): void { this.backInterceptor.clear(this.onHardwareBack); }
  ngOnDestroy(): void { this.backInterceptor.clear(this.onHardwareBack); }

  async ngOnInit(): Promise<void> {
    await this.flashcards.initialize();
    const deckId = this.route.snapshot.paramMap.get('id');
    this.levelNumber = Number(this.route.snapshot.queryParamMap.get('level') ?? 0);
    this.isJourneyNode = !!this.route.snapshot.queryParamMap.get('from');
    this.backUrl = journeyBackUrl(this.route.snapshot.queryParamMap);

    if (!deckId) { this.router.navigate([this.backUrl]); return; }
    this.deck = this.flashcards.getDeck(deckId);
    if (!this.deck) { this.router.navigate([this.backUrl]); return; }

    const levelCards: Flashcard[] = this.levelNumber > 0
      ? this.flashcards.getLevelCards(deckId, this.levelNumber)
      : [];
    this.levelTitle = levelCards[0]?.skill ?? '';
    this.cards = levelCards
      .filter(c => c.text && c.text !== '—')
      .map(c => {
        const meta = lookupCoreWord(c.text);
        return {
          // Show the FULL authored form ("le thé") — it matches both the audio
          // clip and the other modes (Flashcards/Write). Consistency of text
          // and audio is required.
          fr: c.text,
          en: this.flashcards.bestTranslation(c),
          audioUrl: c.audioUrl ?? null,
          note: meta?.note,
          icon: meta?.icon,
        };
      });

    if (this.cards.length === 0) {
      // Nothing to teach (e.g. a placeholder level) — pass through immediately.
      await this.complete();
      return;
    }
    this.isLoading = false;
    this.cdr.detectChanges();
    // Auto-play the FIRST card's audio (always normal speed, not counted).
    setTimeout(() => this.playWord(true), 180);
  }

  /** True when at least one card in the set has an emoji — drives whether the
   *  recap reserves a fixed emoji column (aligned) or omits it (left-aligned). */
  get anyIcon(): boolean { return this.cards.some(c => !!c.icon); }

  get card(): LearnCard | null { return this.cards[this.index] ?? null; }
  get progress(): number { return this.cards.length ? (this.index / this.cards.length) * 100 : 0; }
  get isLast(): boolean { return this.index >= this.cards.length - 1; }

  /** True once the user has MANUALLY tapped the audio button twice for this
   *  card — then the button shows the slow (gauge) icon AND the next tap plays
   *  the slow replay. Auto-plays (card arrival, Back/Continue) do NOT count, so
   *  navigating back/forth never flips it to slow on its own. The icon and the
   *  slow playback share this single threshold, so the icon never gets "ahead"
   *  of the sound (what caused the earlier off-by-one: gauge shown but still
   *  playing fast for one extra tap). */
  get showSlow(): boolean {
    return (this.playCounts.get(this.index) ?? 0) >= 3;
  }

  /**
   * Play the current word. `auto` = triggered by navigation/card-open or a
   * Back/Continue move (always NORMAL speed, and NOT counted toward the slow
   * threshold — only real taps on the audio button count). A manual tap plays
   * slow once this card has already had 2 counted (fast) plays; the icon flips
   * on the same threshold so what you see is what you hear.
   */
  async playWord(auto = false): Promise<void> {
    const c = this.card;
    if (!c) return;
    // Count this tap FIRST, then decide fast vs slow from the new count — the
    // exact same value `showSlow` reads for the icon. So the instant the gauge
    // appears (2 taps done) THIS tap already plays slow: icon and sound flip
    // together, with no "gauge shown but still fast" tap in between.
    if (!auto) {
      this.playCounts.set(this.index, (this.playCounts.get(this.index) ?? 0) + 1);
      this.cdr.detectChanges();
    }
    const slow = !auto && this.showSlow;
    const res = await this.audio.playWord(c.fr, c.audioUrl, this.settings.learningLanguage(), slow);
    // When there's no recording AND no device voice, tell the user why (so a
    // silent tap isn't mistaken for a bug).
    if (!res.ok && res.reason) {
      const t = await this.toast.create({ message: res.reason, duration: 2500, position: 'bottom' });
      await t.present();
    }
  }

  prev(): void {
    if (this.transitioning || this.index === 0) return;
    // Back replays the card's audio too (same as Continue): landing on a card
    // always speaks it. It's an AUTO play, so it never counts toward the slow
    // threshold — tapping Back/Continue repeatedly won't flip to the slow clip.
    this.animateTo(this.index - 1, true);
  }

  async next(): Promise<void> {
    if (this.transitioning) return;           // debounce: ignore a quick 2nd tap
    if (this.isLast) { this.phase = 'done'; this.cdr.detectChanges(); return; }
    this.animateTo(this.index + 1, true);
  }

  /** Change the visible card with a short transition, blocking further taps
   *  until it finishes (so a double-tap can't skip a card). Optionally plays
   *  the new card's audio once it's shown. */
  private animateTo(newIndex: number, play = false): void {
    this.transitioning = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.index = newIndex;
      this.transitioning = false;
      this.cdr.detectChanges();
      if (play) this.playWord(true);   // auto-play: normal speed, not counted
    }, LearnPage.TRANSITION_MS);
  }

  /** Finish from the recap screen: mark the node passed and return to the map. */
  async finish(): Promise<void> { await this.complete(); }

  /** Mark the Learn node passed (no score) and return. Only records node
   *  progress when launched as a Tree/Journey node; standalone Learn (home
   *  mode list) is pure practice and leaves progress untouched. */
  private async complete(): Promise<void> {
    if (this.isJourneyNode && this.deck && this.levelNumber > 0) {
      try { await this.flashcards.saveRoundProgress(this.deck.id, 'journey-learn', this.levelNumber, 100); }
      catch { /* best-effort */ }
    }
    this.leave();
  }

  private leave(): void { this.navCtrl.navigateBack(this.backUrl); }
  close(): void { this.leave(); }
}
