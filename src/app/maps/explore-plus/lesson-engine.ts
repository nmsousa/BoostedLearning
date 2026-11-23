/**
 * Lesson engine — the brain behind Explore+ (lessons grouped by CEFR band).
 *
 *  - registers the "lesson-<lang>" deck: lesson N = deck level N (its words);
 *  - reads per-mode pass state; a lesson is complete with Learn + 5 of the 7
 *    games (the same rule as Explore, tree-modes.ts);
 *  - unlocking is linear: lesson N opens when lesson N-1 is complete. Tests
 *    open more: every lesson up to the start lesson, and EVERY lesson of each
 *    band up to the highest band passed. Test results only ever RAISE this;
 *    a failed test never locks anything again;
 *  - implements LevelEngine so the shared level page (TierDetailPage) works
 *    unchanged (node id = lesson id, always tier 1).
 *
 * French only for now (the lessons are French content).
 *
 * @module app/maps/explore-plus
 */
import { englishWithArticle } from '../../shared/articles';
import {
  TREE_MODES, FLASHCARDS_REVIEW_MODE, tierProgress, modeStates, isModePassed, type TierProgress,
} from '../tree/tree-modes';
import type { LevelEngine, TreeEngineDeps, TreeModeView, TreeNode, TreeTier } from '../tree/tree-engine';
import { BANDS, LESSONS, bandOf, levelOfLesson, lessonDeckGroups, type BandDef, type Lesson, type LessonBand } from './lessons/lessons';
import type { FlashcardService } from '../../services/flashcard.service';

export type LessonState = 'done' | 'active' | 'locked';

/** One lesson card on the Explore+ carousel. */
export interface LessonCard {
  lesson: Lesson;
  /** 0-based position in LESSONS. */
  index: number;
  /** Deck level (fixed band slot, see lessons.ts BAND_SLOTS). */
  level: number;
  band: BandDef;
  /** 1-based number within its band ("Lesson 3" of A1). */
  numberInBand: number;
  state: LessonState;
  /** The lesson to do now. */
  current: boolean;
  progress: TierProgress;
}

export class LessonEngine implements LevelEngine {
  /** Deck id prefix → "lesson-<lang>". */
  static readonly DECK_PREFIX = 'lesson';
  /** localStorage key of the placement start (a lesson id). */
  static readonly START_KEY = 'boostionary.explorePlus.start';
  /** localStorage key of the highest band opened by a test (a band id). */
  static readonly OPEN_BAND_KEY = 'boostionary.explorePlus.openBand';
  /** Languages that have lessons. */
  static readonly LANGS = ['fr'];

  deckId = '';
  private passedModes = new Set<string>();
  private startIndex = 0;
  private hasStoredStart = false;
  /** Every lesson of the bands up to this index is open (-1 = none). */
  private openBandIndex = -1;

  constructor(private readonly deps: TreeEngineDeps) {}

  get adminMode(): boolean { return this.deps.settings.adminMode(); }
  /** True when the learning language has lessons. */
  get available(): boolean { return LessonEngine.LANGS.includes(this.deps.settings.learningLanguage()); }
  /** True once the learner took the placement test or chose to start from zero. */
  get startChosen(): boolean { return this.hasStoredStart; }

  async load(): Promise<void> {
    const lang = this.deps.settings.learningLanguage();
    this.readStart();
    if (!LessonEngine.LANGS.includes(lang)) { this.deckId = ''; this.passedModes.clear(); return; }

    this.deckId = this.deps.flashcards.registerTreeDeck(lang, lessonDeckGroups(), LessonEngine.DECK_PREFIX);

    const progress = await this.deps.flashcards.getDeckLevelProgressMap(this.deckId);
    this.passedModes = new Set<string>();
    LESSONS.forEach((_l, i) => {
      const level = this.levelAt(i);
      for (const m of TREE_MODES) {
        if (isModePassed(progress.get(`${m.mode}-${level}`))) this.passedModes.add(`${level}:${m.mode}`);
      }
    });
  }

  // ── Progress & unlocking ────────────────────────────────────────────────────
  /** Deck level of the lesson at a LESSONS index. */
  levelAt(index: number): number { return levelOfLesson(LESSONS[index]?.id ?? ''); }

  progressOf(index: number): TierProgress {
    const level = this.levelAt(index);
    return tierProgress(m => this.passedModes.has(`${level}:${m.mode}`));
  }
  complete(index: number): boolean { return this.progressOf(index).complete; }
  unlocked(index: number): boolean {
    const lesson = LESSONS[index];
    if (!lesson) return false;
    return index === 0 || index <= this.startIndex || this.bandIndex(lesson.band) <= this.openBandIndex
      || this.complete(index - 1) || this.complete(index);
  }

  bandIndex(band: LessonBand): number { return BANDS.findIndex(b => b.id === band); }
  /** Band index of the lesson to do now. */
  currentBandIndex(): number { return this.bandIndex(LESSONS[this.currentIndex()]?.band ?? 'pre-a1'); }

  /**
   * Tapping a locked lesson of a band above the current one offers that band's
   * level-unlock test. Returns the band, or null (finish the previous lesson).
   */
  testOfferFor(index: number): LessonBand | null {
    const lesson = LESSONS[index];
    if (!lesson || this.unlocked(index)) return null;
    return this.bandIndex(lesson.band) > this.currentBandIndex() ? lesson.band : null;
  }

  /** The next band above everything open, for "try a higher-level test" (or null). */
  nextTestBand(): LessonBand | null {
    const top = Math.max(this.openBandIndex, this.currentBandIndex());
    const next = BANDS[top + 1];
    return next && LESSONS.some(l => l.band === next.id) ? next.id : null;
  }
  /** True when any lesson has any passed activity. */
  get anyProgress(): boolean { return this.passedModes.size > 0; }

  /** The lesson to do now: the first open, unfinished lesson from the start point. */
  currentIndex(): number {
    for (let i = this.startIndex; i < LESSONS.length; i++) {
      if (this.unlocked(i) && !this.complete(i)) return i;
    }
    for (let i = 0; i < this.startIndex; i++) {
      if (!this.complete(i)) return i;
    }
    return LESSONS.length - 1;
  }

  cards(): LessonCard[] {
    const current = this.currentIndex();
    const perBand = new Map<string, number>();
    return LESSONS.map((lesson, index) => {
      const n = (perBand.get(lesson.band) ?? 0) + 1;
      perBand.set(lesson.band, n);
      const state: LessonState = this.complete(index) ? 'done' : this.unlocked(index) ? 'active' : 'locked';
      return {
        lesson, index, level: this.levelAt(index), band: bandOf(lesson.band), numberInBand: n,
        state, current: index === current, progress: this.progressOf(index),
      };
    });
  }

  // ── Test results (placement start + opened bands) ──────────────────────────
  private readStart(): void {
    let id: string | null = null;
    let band: string | null = null;
    try {
      id = localStorage.getItem(LessonEngine.START_KEY);
      band = localStorage.getItem(LessonEngine.OPEN_BAND_KEY);
    } catch { /* no storage */ }
    this.hasStoredStart = id !== null || band !== null;
    this.startIndex = id ? Math.max(0, this.indexOf(id)) : 0;
    this.openBandIndex = band ? this.bandIndex(band as LessonBand) : -1;
  }

  /**
   * Apply a test result. It only RAISES what's open: a start lesson earlier
   * than the current one, or a band below the opened one, changes nothing.
   *  - openBand: every lesson of the bands up to it opens;
   *  - start: the lesson to begin with (and everything before it opens).
   */
  applyResult(r: { openBand?: LessonBand | null; start?: string | null }): void {
    try {
      if (r.start) {
        const i = this.indexOf(r.start);
        const had = localStorage.getItem(LessonEngine.START_KEY);
        if (i >= 0 && (had === null || i > this.startIndex)) localStorage.setItem(LessonEngine.START_KEY, r.start);
      }
      if (r.openBand && this.bandIndex(r.openBand) > this.openBandIndex) {
        localStorage.setItem(LessonEngine.OPEN_BAND_KEY, r.openBand);
      }
    } catch { /* ignore */ }
    this.readStart();
  }

  /** "Start from the first lesson" (no test). */
  setStart(lessonId: string): void { this.applyResult({ start: lessonId }); }

  // ── LevelEngine (the shared level page) ─────────────────────────────────────
  private indexOf(id: string): number { return LESSONS.findIndex(l => l.id === id); }

  nodeById(id: string): TreeNode | null {
    const i = this.indexOf(id);
    if (i < 0) return null;
    const lesson = LESSONS[i];
    const open = this.unlocked(i);
    return {
      id: lesson.id, index: i, title: lesson.title, emoji: lesson.icon, hue: bandOf(lesson.band).hue,
      state: this.complete(i) ? 'done' : open ? 'active' : 'locked',
      doneLevel: this.complete(i) ? 1 : 0, availTier: open ? 1 : 0, maxTier: 1,
    };
  }

  tierAuthored(nodeId: string, tier: number): boolean {
    return tier === 1 && this.indexOf(nodeId) >= 0;
  }

  tiersFor(node: TreeNode, _maxTier: number): TreeTier[] {
    const i = this.indexOf(node.id);
    if (i < 0) return [];
    const lesson = LESSONS[i];
    const band = bandOf(lesson.band);
    const numberInBand = LESSONS.slice(0, i + 1).filter(l => l.band === lesson.band).length;
    const level = this.levelAt(i);
    const states = modeStates(m => this.passedModes.has(`${level}:${m.mode}`), true);
    const modes: TreeModeView[] = TREE_MODES.map((m, mi) => ({
      modeIndex: mi, id: m.id, mode: m.mode, route: m.route, icon: m.icon, labelKey: m.labelKey,
      homeKey: m.homeKey, accent: m.accent, state: states[mi],
    }));
    return [{
      tier: 1, level,
      label: `${band.cefr} · ${this.deps.t('xp.lessonN', { n: numberInBand })}`,
      goal: lesson.goal,
      grammar: lesson.grammar,
      words: lesson.words.map(w => ({ ...w, en: englishWithArticle(w.fr, w.en) })),
      done: this.complete(i),
      progress: this.progressOf(i),
      modes,
    }];
  }

  launchMode(nodeId: string, _tier: number, modeIndex: number): void {
    const level = levelOfLesson(nodeId);
    const def = TREE_MODES[modeIndex];
    if (!this.deckId || !level || !def) return;
    void this.deps.nav.navigateForward([def.route, this.deckId], {
      queryParams: { level, mode: def.mode, from: this.deps.from, ...(this.deps.extraQuery?.() ?? {}) },
    });
  }

  launchReview(nodeId: string, _tier: number): void {
    const level = levelOfLesson(nodeId);
    if (!this.deckId || !level) return;
    void this.deps.nav.navigateForward([FLASHCARDS_REVIEW_MODE.route, this.deckId], {
      queryParams: { level, mode: FLASHCARDS_REVIEW_MODE.mode, from: this.deps.from, ...(this.deps.extraQuery?.() ?? {}) },
    });
  }

  // ── Admin ───────────────────────────────────────────────────────────────────
  async adminCompleteMode(nodeId: string, _tier: number, modeIndex: number): Promise<void> {
    const level = levelOfLesson(nodeId);
    const def = TREE_MODES[modeIndex];
    if (!this.adminMode || !this.deckId || !level || !def) return;
    await this.passMode(level, def.mode);
  }

  /** Admin: complete a whole lesson (Learn + every game). */
  async adminCompleteLesson(index: number): Promise<void> {
    if (!this.adminMode || !this.deckId) return;
    for (const m of TREE_MODES) await this.passMode(this.levelAt(index), m.mode);
  }

  /** Admin: wipe all Explore+ progress and the placement start. */
  async adminResetProgress(): Promise<void> {
    if (!this.adminMode || !this.deckId) return;
    await this.deps.flashcards.resetDeckProgress(this.deckId);
    try {
      localStorage.removeItem(LessonEngine.START_KEY);
      localStorage.removeItem(LessonEngine.OPEN_BAND_KEY);
    } catch { /* ignore */ }
    this.readStart();
  }

  private async passMode(level: number, mode: string): Promise<void> {
    const n = Math.max(1, this.deps.flashcards.getLevelCards(this.deckId, level).length);
    try {
      await this.deps.flashcards.saveLevelProgress(
        this.deckId, mode as Parameters<FlashcardService['saveLevelProgress']>[1], level, n, n,
      );
    } catch { /* best-effort */ }
  }
}
