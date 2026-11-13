/**
 * Learn Page — the intro step before the drills.
 *
 * The first activity of every Tree level: it simply TEACHES the level's words
 * before any testing. For Core words it shows the English meaning plus a short
 * grammar/usage note; for theme words it shows the meaning plus an emoji (where
 * one is authored). The learner swipes through the cards and taps Done, which
 * marks the Learn node passed (no scoring — it's a teaching step).
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

  private readonly onHardwareBack: () => boolean = () => { this.leave(); return true; };

  deck: FlashcardDeck | null = null;
  private levelNumber = 0;
  private backUrl = '/practice';

  isLoading = true;
  cards: LearnCard[] = [];
  index = 0;
  levelTitle = '';

  t(key: string, params?: Record<string, string | number>): string { return this.i18n.t(key, params); }

  ionViewWillEnter(): void { this.backInterceptor.register(this.onHardwareBack); }
  ionViewWillLeave(): void { this.backInterceptor.clear(this.onHardwareBack); }
  ngOnDestroy(): void { this.backInterceptor.clear(this.onHardwareBack); }

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
  }

  private cdr = inject(ChangeDetectorRef);

  get card(): LearnCard | null { return this.cards[this.index] ?? null; }
  get progress(): number { return this.cards.length ? (this.index / this.cards.length) * 100 : 0; }
  get isLast(): boolean { return this.index >= this.cards.length - 1; }

  async playWord(): Promise<void> {
    const c = this.card;
    if (!c) return;
    const res = await this.audio.playWord(c.fr, c.audioUrl, this.settings.learningLanguage());
    // When there's no recording AND no device voice, tell the user why (so a
    // silent tap isn't mistaken for a bug).
    if (!res.ok && res.reason) {
      const t = await this.toast.create({ message: res.reason, duration: 2500, position: 'bottom' });
      await t.present();
    }
  }

  prev(): void { if (this.index > 0) { this.index--; this.cdr.detectChanges(); } }

  async next(): Promise<void> {
    if (this.isLast) { await this.complete(); return; }
    this.index++;
    this.cdr.detectChanges();
    this.playWord();
  }

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
