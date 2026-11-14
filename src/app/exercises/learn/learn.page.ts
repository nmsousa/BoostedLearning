/**
 * Learn Page — the intro step before the drills.
 *
 * The first activity of every Tree level: it simply TEACHES the level's words
 * before any testing. For Core words it shows the English meaning plus a short
 * grammar/usage note; for theme words it shows the meaning plus an emoji (where
 * one is authored). The learner swipes through the cards and taps Done, which
 * marks the Learn node passed (no scoring — it's a teaching step).
 *
 * Nouns are AUTHORED with their article ("le café") so Write/Builder can teach
 * gender, but the Learn step shows the BARE word ("café", like Duolingo's first
 * lessons) — the article is reintroduced in the typing/building modes. The
 * borrowed recordings are the bare noun too, so audio matches the display.
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
  /** Display + audio form shown in Learn: the BARE word (article stripped). */
  fr: string;
  /** The full authored form ("le café") — kept for reference / later modes. */
  frFull: string;
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

  t(key: string, params?: Record<string, string | number>): string { return this.i18n.t(key, params); }

  ionViewWillEnter(): void { this.backInterceptor.register(this.onHardwareBack); }
  ionViewWillLeave(): void { this.backInterceptor.clear(this.onHardwareBack); }
  ngOnDestroy(): void { this.backInterceptor.clear(this.onHardwareBack); }

  /** Strip a leading French article so Learn shows the bare word ("le café" →
   *  "café", "l'école" → "école"). Mirrors the audio lookup's article rule. */
  private stripArticle(fr: string): string {
    const m = /^(le |la |les |un |une |des |l['’])\s*/i.exec(fr);
    return m ? fr.slice(m[0].length).trim() : fr;
  }

  async ngOnInit(): Promise<void> {
    await this.flashcards.initialize();
    const deckId = this.route.snapshot.paramMap.get('id');
    this.levelNumber = Number(this.route.snapshot.queryParamMap.get('level') ?? 0);
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
          fr: this.stripArticle(c.text),
          frFull: c.text,
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
    // Auto-play the FIRST card's audio (previously only cards 2..n played, so
    // the first word sounded silent). A small delay lets the view settle.
    setTimeout(() => this.playWord(), 180);
  }

  get card(): LearnCard | null { return this.cards[this.index] ?? null; }
  get progress(): number { return this.cards.length ? (this.index / this.cards.length) * 100 : 0; }
  get isLast(): boolean { return this.index >= this.cards.length - 1; }

  /** True once this card has been played at normal speed twice — reveals the
   *  slow-replay button for that card (same rule as Flashcards). */
  get showSlow(): boolean {
    return (this.playCounts.get(this.index) ?? 0) >= 2;
  }

  async playWord(slow = false): Promise<void> {
    const c = this.card;
    if (!c) return;
    if (!slow) {
      this.playCounts.set(this.index, (this.playCounts.get(this.index) ?? 0) + 1);
      this.cdr.detectChanges();
    }
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
    this.animateTo(this.index - 1);
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
      if (play) this.playWord();
    }, LearnPage.TRANSITION_MS);
  }

  /** Finish from the recap screen: mark the node passed and return to the map. */
  async finish(): Promise<void> { await this.complete(); }

  /** Mark the Learn node passed (no score) and return to the map. */
  private async complete(): Promise<void> {
    if (this.deck && this.levelNumber > 0) {
      try { await this.flashcards.saveRoundProgress(this.deck.id, 'journey-learn', this.levelNumber, 100); }
      catch { /* best-effort */ }
    }
    this.leave();
  }

  private leave(): void { this.navCtrl.navigateBack(this.backUrl); }
  close(): void { this.leave(); }
}
