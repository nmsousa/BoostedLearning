/**
 * Mix Page — orchestrates a single session that mixes several activity types
 * for one level: Quiz → Match → Match Audio → Blanks → Builder → one Write.
 *
 * It owns no exercise UI of its own: it sequences the existing exercise pages.
 * Each sub-exercise is launched with `from=mix` + `mixReturn=/practice/mix/<id>`
 * so it returns here; we then advance to the next step. When every step is
 * done, a short recap is shown.
 *
 * Progress for each activity is recorded under its normal journey-* namespace,
 * so playing Mix also advances the Explore/Tree activities for that level.
 *
 * @module app/exercises/mix
 */
import {
  Component, OnInit, inject, ChangeDetectorRef, ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NavController, ViewWillEnter } from '@ionic/angular';
import { FlashcardService, FlashcardDeck } from '../../services/flashcard.service';
import { SettingsService } from '../../services/settings.service';
import { I18nAngularService } from '../../services/i18n.service';
import { journeyBackUrl } from '../../maps/journey/journey-back';
import { MixSessionService, type MixStep } from './mix-session.service';

/** Languages with the sentence generator (Blanks is meaningful). */
const BLANKS_LANGS = new Set(['fr', 'nl']);

@Component({
  selector: 'app-mix',
  templateUrl: './mix.page.html',
  styleUrls: ['./mix.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MixPage implements OnInit, ViewWillEnter {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private navCtrl = inject(NavController);
  private flashcards = inject(FlashcardService);
  private settings = inject(SettingsService);
  private i18n = inject(I18nAngularService);
  private mix = inject(MixSessionService);
  private cdr = inject(ChangeDetectorRef);

  private deck: FlashcardDeck | null = null;
  private level = 0;
  /** Where to return when the Mix session ends: the map that launched it
   *  (Explore/Tree via ?from=…), else the Mix level list. */
  private backUrl = '/practice?mode=mix';
  /** True after the first ionViewWillEnter: subsequent entries are returns from
   *  a step we launched, so we advance the session pointer. */
  private started = false;

  isLoading = true;
  /** 'intro' = a "ready / next activity" screen with a Continue button the user
   *  taps to launch the next step (no auto-cascade); 'done' = final recap. */
  phase: 'intro' | 'done' = 'intro';
  /** Step dots for the header progress (icon + done/current/upcoming). */
  stepDots: { icon: string; state: 'done' | 'current' | 'upcoming' }[] = [];
  totalSteps = 0;
  levelTitle = '';
  /** 1-based number of the step the Continue button will launch. */
  get nextStepNumber(): number {
    const s = this.mix.current();
    return s ? Math.min(s.index + 1, s.steps.length) : 1;
  }

  t(key: string, params?: Record<string, string | number>): string { return this.i18n.t(key, params); }

  async ngOnInit(): Promise<void> {
    await this.flashcards.initialize();
    const deckId = this.route.snapshot.paramMap.get('id');
    this.level = Number(this.route.snapshot.queryParamMap.get('level') ?? 0);
    if (!deckId) { this.router.navigate(['/practice']); return; }
    this.deck = this.flashcards.getDeck(deckId);
    if (!this.deck) { this.router.navigate(['/practice']); return; }
    this.levelTitle = this.flashcards.getLevelCards(deckId, this.level)[0]?.skill ?? '';
    // If launched from a map (Explore/Tree), return there; else the Mix list.
    const from = this.route.snapshot.queryParamMap.get('from');
    this.backUrl = from ? journeyBackUrl(this.route.snapshot.queryParamMap) : '/practice?mode=mix';

    // Fresh session for this deck+level. ionViewWillEnter drives the sequence.
    this.mix.start(deckId, this.level, BLANKS_LANGS.has(this.deck.languageCode));
    this.isLoading = false;
    this.refreshDots();
  }

  /**
   * Each time Mix becomes the foreground view we ADVANCE the session pointer
   * past the step just played (except the very first entry), then show the
   * intro screen for the next step. Launching is NOT automatic — the user taps
   * Continue — so there is no push/pop cascade regardless of how a sub-exercise
   * finishes. `started` marks that the first step pointer is already current.
   */
  async ionViewWillEnter(): Promise<void> {
    if (this.isLoading || this.phase === 'done') return;

    if (!this.started) {
      this.started = true;             // first entry: step 0 is already current
    } else {
      this.mix.advance();              // returning from a step → move to next
    }
    this.refreshDots();

    if (!this.mix.currentStep()) { this.finishSession(); return; }
    // Show the intro/continue screen; the user launches the step themselves.
    this.phase = 'intro';
    this.cdr.detectChanges();
  }

  /** User tapped Continue → launch the current step's exercise. */
  playNext(): void {
    const step = this.mix.currentStep();
    if (!step || !this.deck) return;
    const queryParams: Record<string, string | number> = {
      level: this.level,
      mode: step.mode,
      from: 'mix',
      // Where the sub-exercise returns (journeyBackUrl reads this for from=mix).
      mixReturn: `/practice/mix/${this.deck.id}?level=${this.level}`,
    };
    // Builder needs the earlier-levels pool for phrase generation, like the Tree.
    if (step.mode === 'journey-builder') {
      queryParams['pool'] = this.poolLevels().join(',');
    }
    this.navCtrl.navigateForward([step.route, this.deck.id], { queryParams });
  }

  /** Earlier level numbers for the Builder pool (1..level-1). */
  private poolLevels(): number[] {
    return Array.from({ length: Math.max(0, this.level - 1) }, (_v, i) => i + 1);
  }

  private refreshDots(): void {
    const s = this.mix.current();
    if (!s) { this.stepDots = []; this.totalSteps = 0; return; }
    this.totalSteps = s.steps.length;
    this.stepDots = s.steps.map((step, i) => ({
      icon: step.icon,
      state: i < s.index ? 'done' : i === s.index ? 'current' : 'upcoming',
    }));
    this.cdr.detectChanges();
  }

  private finishSession(): void {
    this.phase = 'done';
    this.refreshDots();
    this.mix.clear();
    this.cdr.detectChanges();
  }

  /** Done → back to wherever Mix was launched from (map or the Mix list). */
  finish(): void {
    this.mix.clear();
    this.navCtrl.navigateBack(this.backUrl);
  }

  close(): void {
    this.mix.clear();
    this.navCtrl.navigateBack(this.backUrl);
  }
}
