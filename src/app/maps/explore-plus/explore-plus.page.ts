/**
 * Explore+ Page — lessons grouped by CEFR band (Pre-A1, A1, A2…).
 *
 * One big lesson card at a time in a horizontal, snapping carousel: the
 * previous and next cards peek at the edges, finished lessons are greyed out
 * and it opens on the lesson to do now. Tapping a card opens the shared level
 * page (TierDetailPage, origin 'explore-plus'), which runs the same Learn +
 * 7 games as Explore but on the lesson's own words and AUTHORED sentences.
 *
 * A placement test ("Find my level") places the learner in the right band:
 * every lesson before the start stays open for review.
 *
 * Content: src/app/maps/explore-plus/lessons/. Engine: lesson-engine.ts.
 *
 * @module app/maps/explore-plus
 */

import {
  Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy, ElementRef, ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { NavController, AlertController, ToastController } from '@ionic/angular';
import { FlashcardService } from '../../services/flashcard.service';
import { SettingsService } from '../../services/settings.service';
import { I18nAngularService } from '../../services/i18n.service';
import { BackInterceptorService } from '../../services/back-interceptor.service';
import { JOURNEY_EXPLORE_PLUS_FROM } from '../journey/journey-back';
import { LessonEngine, type LessonCard } from './lesson-engine';
import { BANDS, LESSONS, bandOf, type BandDef, type LessonBand } from './lessons/lessons';
import {
  PLACEMENT_PASS, bandPassed, placementBands, placementQuestions, placementResult, type PlacementQuestion,
} from './lessons/placement';

type View = 'map' | 'test' | 'result';

/** One band chip under the carousel. */
interface BandChip { band: BandDef; first: number; done: number; total: number; }

@Component({
  selector: 'app-explore-plus',
  templateUrl: './explore-plus.page.html',
  styleUrls: ['./explore-plus.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExplorePlusPage implements OnInit, OnDestroy {
  private router = inject(Router);
  private flashcards = inject(FlashcardService);
  private settings = inject(SettingsService);
  private i18n = inject(I18nAngularService);
  private cdr = inject(ChangeDetectorRef);
  private navCtrl = inject(NavController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private backInterceptor = inject(BackInterceptorService);

  @ViewChild('track') private trackRef?: ElementRef<HTMLElement>;

  readonly engine = new LessonEngine({
    flashcards: this.flashcards,
    settings: this.settings,
    nav: this.navCtrl,
    t: (k, p) => this.i18n.t(k, p),
    from: JOURNEY_EXPLORE_PLUS_FROM,
  });

  private readonly onHardwareBack: () => boolean = () => { this.back(); return true; };

  isLoading = true;
  view: View = 'map';
  cards: LessonCard[] = [];
  chips: BandChip[] = [];
  /** The card centred in the carousel (drives the header). */
  focused = 0;

  private leftToDetail = false;

  get adminMode(): boolean { return this.engine.adminMode; }
  get available(): boolean { return this.engine.available; }
  get focusedCard(): LessonCard | null { return this.cards[this.focused] ?? null; }
  /** First visit: offer the placement test. */
  get showIntro(): boolean { return !this.engine.startChosen && !this.engine.anyProgress; }
  bandLessonCount(band: LessonBand): number { return LESSONS.filter(l => l.band === band).length; }

  t(key: string, params?: Record<string, string | number>): string { return this.i18n.t(key, params); }

  async ngOnInit(): Promise<void> {
    await this.flashcards.initialize();
    await this.load(true);
  }

  ngOnDestroy(): void {
    this.backInterceptor.clear(this.onHardwareBack);
    if (this.tapTimer) { clearTimeout(this.tapTimer); this.tapTimer = null; }
    if (this.testTimer) { clearTimeout(this.testTimer); this.testTimer = null; }
  }

  async ionViewWillEnter(): Promise<void> {
    this.backInterceptor.register(this.onHardwareBack);
    if (this.engine.deckId && this.leftToDetail) {
      this.leftToDetail = false;
      await this.load(false);
      this.scrollToCard(this.engine.currentIndex(), true);
    }
  }

  ionViewWillLeave(): void { this.backInterceptor.clear(this.onHardwareBack); }

  private async load(initialScroll: boolean): Promise<void> {
    await this.engine.load();
    this.cards = this.engine.cards();
    this.chips = BANDS
      .map(band => {
        const own = this.cards.filter(c => c.band.id === band.id);
        return { band, first: own[0]?.index ?? -1, done: own.filter(c => c.state === 'done').length, total: own.length };
      })
      .filter(c => c.total > 0);
    this.isLoading = false;
    this.cdr.detectChanges();
    if (initialScroll) this.scrollToCard(this.engine.currentIndex(), false);
  }

  // ── Carousel ────────────────────────────────────────────────────────────────
  private scrollRaf = 0;

  onTrackScroll(): void {
    if (this.scrollRaf) return;
    this.scrollRaf = requestAnimationFrame(() => {
      this.scrollRaf = 0;
      const i = this.indexAtCentre();
      if (i !== this.focused) { this.focused = i; this.cdr.detectChanges(); }
    });
  }

  private cardStep(): number {
    const track = this.trackRef?.nativeElement;
    const first = track?.querySelector<HTMLElement>('.xp-card');
    if (!track || !first) return 0;
    const gap = parseFloat(getComputedStyle(track).columnGap || '0') || 0;
    return first.offsetWidth + gap;
  }

  private indexAtCentre(): number {
    const track = this.trackRef?.nativeElement;
    const step = this.cardStep();
    if (!track || !step) return this.focused;
    return Math.max(0, Math.min(this.cards.length - 1, Math.round(track.scrollLeft / step)));
  }

  /** Centre a card (after the view has rendered). */
  scrollToCard(index: number, smooth: boolean): void {
    this.focused = Math.max(0, Math.min(this.cards.length - 1, index));
    this.cdr.detectChanges();
    setTimeout(() => {
      const track = this.trackRef?.nativeElement;
      const step = this.cardStep();
      if (!track || !step) return;
      track.scrollTo({ left: this.focused * step, behavior: smooth ? 'smooth' : 'auto' });
    }, smooth ? 60 : 0);
  }

  jumpToBand(chip: BandChip): void {
    if (chip.first >= 0) this.scrollToCard(chip.first, true);
  }

  ctaKey(c: LessonCard): string {
    if (c.state === 'locked') return 'xp.locked';
    if (c.state === 'done') return 'xp.review';
    return c.progress.percent > 0 ? 'journeyPlus.continue' : 'xp.start';
  }

  onCardTap(c: LessonCard): void {
    if (c.index !== this.focused) { this.scrollToCard(c.index, true); return; }
    if (this.adminMode) {
      this.handleAdminDoubleTap(`card:${c.lesson.id}`, () => void this.open(c), () => void this.adminComplete(c));
      return;
    }
    void this.open(c);
  }

  private async open(c: LessonCard): Promise<void> {
    if (c.state === 'locked') {
      const toast = await this.toastCtrl.create({ message: this.t('xp.lockedHint'), duration: 1800, position: 'bottom' });
      await toast.present();
      return;
    }
    this.leftToDetail = true;
    void this.navCtrl.navigateForward(['/practice/tier', c.lesson.id, 1], {
      queryParams: { origin: JOURNEY_EXPLORE_PLUS_FROM },
    });
  }

  // ── Placement test ──────────────────────────────────────────────────────────
  private testBands: LessonBand[] = [];
  private bandIdx = 0;
  private scores: { band: LessonBand; correct: number }[] = [];
  private correctInBand = 0;
  private testTimer: ReturnType<typeof setTimeout> | null = null;

  questions: PlacementQuestion[] = [];
  qIndex = 0;
  /** Questions answered across the whole test (for the progress line). */
  answeredTotal = 0;
  chosen: string | null = null;
  result: { band: BandDef; lessonId: string; lessonTitle: string; allPassed: boolean } | null = null;

  get question(): PlacementQuestion | null { return this.questions[this.qIndex] ?? null; }
  get testBand(): BandDef { return bandOf(this.testBands[this.bandIdx] ?? 'pre-a1'); }
  /** Total questions if every band is played (for the progress bar). */
  get testTotal(): number { return this.testBands.length * this.questions.length || 1; }

  startTest(): void {
    this.testBands = placementBands();
    this.bandIdx = 0;
    this.scores = [];
    this.answeredTotal = 0;
    this.result = null;
    this.startBand();
    this.view = 'test';
    this.cdr.detectChanges();
  }

  private startBand(): void {
    this.questions = placementQuestions(this.testBands[this.bandIdx]);
    this.qIndex = 0;
    this.correctInBand = 0;
    this.chosen = null;
  }

  optionState(opt: string): 'idle' | 'right' | 'wrong' | 'dim' {
    const q = this.question;
    if (!q || this.chosen === null) return 'idle';
    if (opt === q.answer) return 'right';
    if (opt === this.chosen) return 'wrong';
    return 'dim';
  }

  answer(opt: string | null): void {
    const q = this.question;
    if (!q || this.chosen !== null) return;
    this.chosen = opt ?? '';
    if (opt === q.answer) this.correctInBand++;
    this.answeredTotal++;
    this.cdr.detectChanges();
    this.testTimer = setTimeout(() => this.nextQuestion(), opt === q.answer ? 650 : 1300);
  }

  private nextQuestion(): void {
    this.testTimer = null;
    this.chosen = null;
    this.qIndex++;
    const left = this.questions.length - this.qIndex;
    const decided = bandPassed(this.correctInBand) || this.correctInBand + left < PLACEMENT_PASS;
    if (decided || left <= 0) {
      this.scores.push({ band: this.testBands[this.bandIdx], correct: this.correctInBand });
      if (bandPassed(this.correctInBand) && this.bandIdx + 1 < this.testBands.length) {
        this.bandIdx++;
        this.startBand();
      } else {
        this.finishTest();
        return;
      }
    }
    this.cdr.detectChanges();
  }

  private finishTest(): void {
    const r = placementResult(this.scores);
    const lesson = LESSONS.find(l => l.id === r.lessonId) ?? LESSONS[0];
    const allPassed = this.scores.length === this.testBands.length && this.scores.every(sc => bandPassed(sc.correct));
    this.result = { band: bandOf(r.band), lessonId: lesson.id, lessonTitle: lesson.title, allPassed };
    this.view = 'result';
    this.cdr.detectChanges();
  }

  async confirmResult(): Promise<void> {
    if (!this.result) return;
    this.engine.setStart(this.result.lessonId);
    this.view = 'map';
    await this.load(false);
    this.scrollToCard(this.engine.currentIndex(), false);
  }

  async startFromZero(): Promise<void> {
    this.engine.setStart(LESSONS[0].id);
    await this.load(false);
    this.scrollToCard(0, true);
  }

  // ── Admin ───────────────────────────────────────────────────────────────────
  async resetProgress(): Promise<void> {
    if (!this.adminMode) return;
    const alert = await this.alertCtrl.create({
      header: this.t('treePlus.resetConfirmTitle'),
      message: this.t('treePlus.resetConfirmBody'),
      buttons: [
        { text: this.t('common.cancel'), role: 'cancel' },
        { text: this.t('treePlus.resetConfirmYes'), role: 'destructive', handler: () => { void this.doReset(); } },
      ],
    });
    await alert.present();
  }

  private async doReset(): Promise<void> {
    await this.engine.adminResetProgress();
    await this.load(false);
    this.scrollToCard(0, false);
    const toast = await this.toastCtrl.create({ message: this.t('treePlus.resetDone'), duration: 2000, position: 'bottom' });
    await toast.present();
  }

  private static readonly DOUBLE_TAP_MS = 320;
  private tapTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingTapKey: string | null = null;

  private handleAdminDoubleTap(key: string, single: () => void, double: () => void): void {
    if (this.tapTimer && this.pendingTapKey === key) {
      clearTimeout(this.tapTimer); this.tapTimer = null; this.pendingTapKey = null;
      double();
      return;
    }
    if (this.tapTimer) clearTimeout(this.tapTimer);
    this.pendingTapKey = key;
    this.tapTimer = setTimeout(() => { this.tapTimer = null; this.pendingTapKey = null; single(); }, ExplorePlusPage.DOUBLE_TAP_MS);
  }

  private async adminComplete(c: LessonCard): Promise<void> {
    await this.engine.adminCompleteLesson(c.index);
    await this.load(false);
    this.scrollToCard(this.engine.currentIndex(), true);
  }

  // ── Misc ────────────────────────────────────────────────────────────────────
  back(): void {
    if (this.view !== 'map') {
      if (this.testTimer) { clearTimeout(this.testTimer); this.testTimer = null; }
      this.view = 'map';
      this.cdr.detectChanges();
      this.scrollToCard(this.focused, false);
      return;
    }
    this.router.navigate(['/home']);
  }

  trackCard = (_i: number, c: LessonCard): string => c.lesson.id;
  trackChip = (_i: number, c: BandChip): string => c.band.id;
  trackOpt = (_i: number, o: string): string => o;
}
