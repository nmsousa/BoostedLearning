/**
 * Explore+ Page — lessons grouped by CEFR band (Pre-A1 → B2).
 *
 * One big lesson card at a time in a horizontal, snapping carousel: the
 * previous and next cards peek at the edges, finished lessons are greyed out
 * and it opens on the lesson to do now. Tapping a card opens the shared level
 * page (TierDetailPage, origin 'explore-plus').
 *
 * Tests (placement.ts):
 *  - the INITIAL placement (adaptive, 10–12 questions) is offered only at the
 *    very beginning;
 *  - later, tapping a locked lesson of a higher band offers that band's
 *    LEVEL-UNLOCK test (8–10 questions of that band only).
 * A result is applied as soon as the test ends, and only ever opens more.
 *
 * Content: ./lessons/. Engine: lesson-engine.ts.
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
import { AudioService } from '../../services/audio.service';
import { JOURNEY_EXPLORE_PLUS_FROM } from '../journey/journey-back';
import { LessonEngine, type LessonCard } from './lesson-engine';
import { BANDS, LESSONS, bandOf, type BandDef, type LessonBand } from './lessons/lessons';
import {
  AdaptivePlacement, levelTestQuestions, levelVerdict, skillBreakdown,
  type LevelVerdict, type PlacementAnswer,
} from './lessons/placement';
import type { PlacementItem, PlacementSkill } from './lessons/placement-types';
import { instructionLang, localizePrompt } from './lessons/placement-i18n';

type View = 'map' | 'test' | 'result';

/** One band chip under the carousel. */
interface BandChip { band: BandDef; first: number; done: number; total: number; }

interface TestResult {
  kind: 'global' | 'level';
  /** Global: the estimated level (null = just starting). Level: the band tested. */
  band: BandDef | null;
  /** Where to continue. */
  startBand: BandDef;
  startLesson: { id: string; title: string };
  verdict?: LevelVerdict;
  correct: number;
  total: number;
  strengths: PlacementSkill[];
  weaknesses: PlacementSkill[];
  /** "Try a higher-level test" target, if any. */
  nextTest: BandDef | null;
}

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
  private audio = inject(AudioService);

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
  /** Very first visit: offer the initial placement test (only then). */
  get showIntro(): boolean { return !this.engine.startChosen && !this.engine.anyProgress; }
  bandLessonCount(band: LessonBand): number { return LESSONS.filter(l => l.band === band).length; }

  t(key: string, params?: Record<string, string | number>): string { return this.i18n.t(key, params); }
  bandLabel(b: BandDef | null | undefined): string { return b ? `${b.cefr} · ${this.t(b.nameKey)}` : ''; }
  skillLabel(sk: PlacementSkill): string { return this.t(`xp.skill.${sk}`); }

  async ngOnInit(): Promise<void> {
    await this.flashcards.initialize();
    await this.load(true);
  }

  ngOnDestroy(): void {
    this.backInterceptor.clear(this.onHardwareBack);
    if (this.tapTimer) { clearTimeout(this.tapTimer); this.tapTimer = null; }
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

  /** A locked lesson in a band above the current one can be unlocked by a test. */
  testBandFor(c: LessonCard): LessonBand | null { return this.engine.testOfferFor(c.index); }

  ctaLabel(c: LessonCard): string {
    if (c.state === 'locked') {
      const band = this.testBandFor(c);
      return band ? this.t('xp.testCta', { band: bandOf(band).cefr }) : this.t('xp.locked');
    }
    if (c.state === 'done') return this.t('xp.review');
    return this.t(c.progress.percent > 0 ? 'journeyPlus.continue' : 'xp.start');
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
      const band = this.testBandFor(c);
      if (band) { await this.offerLevelTest(band); return; }
      const toast = await this.toastCtrl.create({ message: this.t('xp.lockedHint'), duration: 1800, position: 'bottom' });
      await toast.present();
      return;
    }
    this.leftToDetail = true;
    void this.navCtrl.navigateForward(['/practice/tier', c.lesson.id, 1], {
      queryParams: { origin: JOURNEY_EXPLORE_PLUS_FROM },
    });
  }

  private async offerLevelTest(band: LessonBand): Promise<void> {
    const cefr = bandOf(band).cefr;
    const n = levelTestQuestions(band).length;
    const alert = await this.alertCtrl.create({
      header: this.t('xp.offerTitle', { band: cefr }),
      message: this.t('xp.offerBody', { band: cefr, n }),
      buttons: [
        { text: this.t('xp.notNow'), role: 'cancel' },
        { text: this.t('xp.offerGo'), handler: () => { this.startLevelTest(band); } },
      ],
    });
    await alert.present();
  }

  // ── Tests ───────────────────────────────────────────────────────────────────
  testKind: 'global' | 'level' = 'global';
  /** The band of a level-unlock test. */
  testBand: LessonBand | null = null;
  private adaptive: AdaptivePlacement | null = null;
  private levelQs: PlacementItem[] = [];
  private answers: PlacementAnswer[] = [];

  question: PlacementItem | null = null;
  /** Selected option index (before Check). */
  selected: number | null = null;
  /** True once the answer is checked (feedback shown). */
  checked = false;
  result: TestResult | null = null;

  get questionNumber(): number { return this.answers.length + (this.checked ? 0 : 1); }
  get questionTotal(): number { return this.testKind === 'global' ? (this.adaptive?.maxQuestions ?? 12) : this.levelQs.length; }
  get progressPct(): number { return Math.min(100, (this.answers.length / Math.max(1, this.questionTotal)) * 100); }
  get questionBand(): BandDef | null { return this.question ? bandOf(this.question.band as LessonBand) : null; }
  get isListening(): boolean { return this.question?.skill === 'listening' && !!this.question.audio; }
  /** The instruction: app language up to A2, French from B1 (the tested French is unchanged). */
  get promptText(): string {
    const q = this.question;
    return q ? localizePrompt(q.prompt, instructionLang(q.band, this.i18n.lang())) : '';
  }
  get testTitle(): string {
    return this.testKind === 'level' && this.testBand ? this.t('xp.levelTestTitle', { band: bandOf(this.testBand).cefr }) : this.t('xp.findLevel');
  }

  startTest(): void {
    this.testKind = 'global';
    this.testBand = null;
    this.adaptive = new AdaptivePlacement();
    this.beginTest();
  }

  startLevelTest(band: LessonBand): void {
    this.testKind = 'level';
    this.testBand = band;
    this.adaptive = null;
    this.levelQs = levelTestQuestions(band);
    this.beginTest();
  }

  private beginTest(): void {
    this.answers = [];
    this.result = null;
    this.view = 'test';
    this.loadNext();
  }

  private loadNext(): void {
    this.selected = null;
    this.checked = false;
    this.question = this.testKind === 'global'
      ? this.adaptive?.next() ?? null
      : this.levelQs[this.answers.length] ?? null;
    if (!this.question) { this.finishTest(); return; }
    this.cdr.detectChanges();
    if (this.isListening) setTimeout(() => this.playQuestion(), 350);
  }

  playQuestion(): void {
    const text = this.question?.audio;
    if (text) void this.audio.playWord(text, undefined, 'fr');
  }

  select(i: number): void {
    if (this.checked) return;
    this.selected = i;
    this.cdr.detectChanges();
  }

  optionState(i: number): 'idle' | 'selected' {
    return this.selected === i ? 'selected' : 'idle';
  }

  /**
   * Record the selected answer (or "I don't know") and go straight to the next
   * question. Right / wrong and the explanation are NEVER shown, so retaking
   * the test isn't a memory game.
   */
  check(dontKnow = false): void {
    const q = this.question;
    if (!q || this.checked) return;
    if (dontKnow) this.selected = null;
    else if (this.selected === null) return;
    const correct = this.selected === q.answer;
    this.answers.push({ item: q, correct });
    this.adaptive?.record(q, correct);
    this.checked = true;
    this.loadNext();
  }

  private finishTest(): void {
    const { strengths, weaknesses } = skillBreakdown(this.answers);
    const correct = this.answers.filter(a => a.correct).length;
    const total = this.answers.length;
    const firstOf = (band: LessonBand) => LESSONS.find(l => l.band === band) ?? LESSONS[0];

    if (this.testKind === 'global' && this.adaptive) {
      const { level, start } = this.adaptive.result();
      const bands = this.adaptive.bands;
      const startBand = bands[start] ?? bands[0];
      const lesson = firstOf(startBand);
      // Apply now: everything up to the estimated level opens, start at the next band.
      this.engine.applyResult({ openBand: level >= 0 ? bands[level] : null, start: lesson.id });
      this.result = {
        kind: 'global', band: level >= 0 ? bandOf(bands[level]) : null, startBand: bandOf(startBand),
        startLesson: { id: lesson.id, title: lesson.title }, correct, total, strengths, weaknesses,
        nextTest: this.engine.nextTestBand() ? bandOf(this.engine.nextTestBand()!) : null,
      };
    } else if (this.testBand) {
      const verdict = levelVerdict(correct, total);
      const lesson = firstOf(this.testBand);
      if (verdict !== 'notYet') this.engine.applyResult({ openBand: this.testBand, start: lesson.id });
      const current = LESSONS[this.engine.currentIndex()] ?? lesson;
      const next = verdict !== 'notYet' ? this.engine.nextTestBand() : null;
      this.result = {
        kind: 'level', band: bandOf(this.testBand), startBand: bandOf(current.band),
        startLesson: { id: current.id, title: current.title }, verdict, correct, total, strengths, weaknesses,
        nextTest: next ? bandOf(next) : null,
      };
    }
    this.question = null;
    this.view = 'result';
    void this.load(false);
  }

  /** Back to the lessons, on the lesson to do now. */
  async goToLessons(): Promise<void> {
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
    if (this.view !== 'map') { void this.goToLessons(); return; }
    this.router.navigate(['/home']);
  }

  trackCard = (_i: number, c: LessonCard): string => c.lesson.id;
  trackChip = (_i: number, c: BandChip): string => c.band.id;
  trackIdx = (i: number): number => i;
}
