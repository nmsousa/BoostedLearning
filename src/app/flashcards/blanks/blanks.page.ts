/**
 * Blanks Page - fill-in-the-blank multiple choice (French + Dutch).
 *
 * Shows a generated sentence with ONE word replaced by a blank, and four
 * options; the user taps the word that fits. Sentences come from the
 * phrase-builder core (the same generator the Builder uses), so no hand-authored
 * sentence list is needed. Scored like Quiz: first-try accuracy into stars under
 * the 'blanks' mode (or 'journey-blanks' as a Journey node).
 *
 * Supported languages: the phrase-builder has closed-class vocabulary for
 * French and Dutch. For any other language it yields no phrases, so the mode is
 * hidden on Home and the Journey node auto-passes.
 *
 * @module app/flashcards/blanks
 */

import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NavController, ViewWillEnter, ViewWillLeave } from '@ionic/angular';
import { FlashcardService, Flashcard, FlashcardDeck, PracticeMode } from '../../services/flashcard.service';
import { AudioService } from '../../services/audio.service';
import { SettingsService } from '../../services/settings.service';
import { I18nAngularService } from '../../services/i18n.service';
import { AddWordService } from '../../services/add-word.service';
import { BackInterceptorService } from '../../services/back-interceptor.service';
import { journeyBackUrl } from '../journey/journey-back';
import {
  buildTokens, generatePhrases, type BuilderToken, type BuilderLang,
  type GeneratedPhrase, type WordCategory,
} from '../../../core/phrase-builder/phrase-builder';

type BlanksPhase = 'play' | 'complete';

interface BlankOption {
  label: string;
  correct: boolean;
  revealed: boolean;
  chosen: boolean;
}

/** One ready-to-play question: sentence parts + blank + options. */
interface BlankQuestion {
  /** Tokens before the blank, already joined with spaces. */
  before: string;
  /** Tokens after the blank, already joined with spaces. */
  after: string;
  /** The full sentence (for the result + audio). */
  full: string;
  /** English gloss shown as a hint under the sentence. */
  gloss: string;
  /** The correct missing word. */
  answer: string;
  options: BlankOption[];
}

@Component({
  selector: 'app-blanks',
  templateUrl: './blanks.page.html',
  styleUrls: ['./blanks.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlanksPage implements OnInit, OnDestroy, ViewWillEnter, ViewWillLeave {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private navCtrl = inject(NavController);
  private flashcardService = inject(FlashcardService);
  private audio = inject(AudioService);
  private settings = inject(SettingsService);
  private cdr = inject(ChangeDetectorRef);
  private i18n = inject(I18nAngularService);
  private addWordService = inject(AddWordService);
  private backInterceptor = inject(BackInterceptorService);

  /** Hardware/gesture back → same as the header X: return to the level list /
   *  Journey map. Registered on enter, cleared on leave. Stable ref.
   *  AWAITS the navigation so the interceptor only resolves once the pop has
   *  committed — otherwise a residual back signal in the window before the pop
   *  could pop a second time (exercise → map → Home on a single press). */
  private readonly onHardwareBack: () => Promise<boolean> = async () => {
    await this.close();
    return true;
  };

  ngOnDestroy(): void { this.backInterceptor.clear(this.onHardwareBack); }
  ionViewWillEnter(): void { this.backInterceptor.register(this.onHardwareBack); }
  ionViewWillLeave(): void { this.backInterceptor.clear(this.onHardwareBack); }

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  deck: FlashcardDeck | null = null;
  levelNumber = 0;
  /** Progress namespace: 'blanks' normally, 'journey-blanks' as a Journey node. */
  private mode: PracticeMode = 'blanks';
  private backUrl = '/practice';
  /** True for a Journey node: one pass, back to the map. */
  singlePass = false;

  private readonly OPTION_COUNT = 4;
  /** How many questions a session generates. */
  private readonly MAX_QUESTIONS = 8;

  questions: BlankQuestion[] = [];
  currentIndex = 0;
  /** Skill/title of the level (for the header), if any. */
  levelTitle = '';

  phase: BlanksPhase = 'play';
  isLoading = true;
  correctCount = 0;
  mistakes = 0;
  earnedStars = 0;
  isNewBest = false;
  private answered = false;

  /** Open the header menu (report / admin complete). */
  async openMenu(): Promise<void> {
    await this.addWordService.openModeMenu({
      languageCode: this.deck?.languageCode,
      modeName: this.t('mode.titleBlanks'),
      onAdminComplete: (stars) => this.adminCompleteLevel(stars),
    });
  }

  private async adminCompleteLevel(stars: 0 | 1 | 2 | 3): Promise<void> {
    if (this.levelNumber > 0 && this.deck) {
      await this.flashcardService.adminForceComplete(this.deck.id, this.mode, this.levelNumber, stars);
    }
    this.navCtrl.navigateBack(this.backUrl);
  }

  async ngOnInit(): Promise<void> {
    await this.flashcardService.initialize();

    const deckId = this.route.snapshot.paramMap.get('id');
    const levelParam = this.route.snapshot.queryParamMap.get('level');
    this.levelNumber = levelParam ? parseInt(levelParam, 10) : 0;
    if (this.route.snapshot.queryParamMap.get('mode') === 'journey-blanks') {
      this.mode = 'journey-blanks';
      this.backUrl = journeyBackUrl(this.route.snapshot.queryParamMap);
      this.singlePass = true;
    }

    if (!deckId) { this.router.navigate([this.backUrl]); return; }
    this.deck = this.flashcardService.getDeck(deckId);
    if (!this.deck) { this.router.navigate([this.backUrl]); return; }

    // TEMPORARY: admin test level — the phrase-builder can't make sentences
    // from "wifi"/"internet", so build 2 trivial one-word questions directly.
    // No persistence (completeSession is guarded by levelNumber > 0).
    if (this.flashcardService.isTestLevel(this.levelNumber)) {
      this.levelTitle = 'Level 0 (test)';
      this.questions = this.buildTestQuestions(deckId);
      this.phase = this.questions.length === 0 ? 'complete' : 'play';
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    if (this.levelNumber > 0) {
      const isUnlocked = await this.flashcardService.isLevelUnlocked(deckId, this.mode, this.levelNumber);
      if (!isUnlocked) { this.router.navigate([this.backUrl]); return; }
      this.levelTitle = this.flashcardService.getLevelCards(deckId, this.levelNumber)[0]?.skill ?? '';
    }

    this.questions = this.buildQuestions(deckId, this.levelNumber);

    // No phrases could be generated (non-French deck, or too few words). As a
    // Journey node, auto-pass so the chapter isn't blocked; standalone shows a
    // friendly empty complete screen.
    if (this.questions.length === 0) {
      if (this.mode === 'journey-blanks' && this.levelNumber > 0) {
        await this.flashcardService.saveRoundProgress(deckId, this.mode, this.levelNumber, 100);
        this.navCtrl.navigateBack(this.backUrl);
        return;
      }
      this.phase = 'complete';
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = false;
    this.cdr.detectChanges();
  }

  /**
   * Generate fill-in-the-blank questions from the level's words (+ earlier
   * levels for review), via the phrase-builder. Only phrases that expose a
   * blankIndex are usable; options are the correct word + distractors of the
   * SAME grammatical category drawn from the token pool.
   */
  /**
   * Which closed-class vocabulary the phrase-builder should use, from the
   * deck's language. Only 'fr' and 'nl' are supported; any other language
   * falls back to 'fr', whose word lists won't match, so no phrases are
   * generated (the mode stays hidden / the Journey node auto-passes).
   */
  private builderLang(): BuilderLang {
    return this.deck?.languageCode === 'nl' ? 'nl' : 'fr';
  }

  /**
   * TEMPORARY: build the admin test-level questions. The phrase-builder can't
   * form sentences from arbitrary words, so each test word becomes a trivial
   * "pick the word" question (blank-only sentence) with 3 distractors drawn
   * from the deck's other translations.
   */
  private buildTestQuestions(deckId: string): BlankQuestion[] {
    const testCards = this.flashcardService.getTestLevelCards(deckId);
    // Distractor pool: other words from the deck (clean, de-duplicated).
    const pool = Array.from(new Set(
      (this.deck?.cards ?? [])
        .map(c => c.text.trim())
        .filter(t => t && !testCards.some(tc => tc.text.toLowerCase() === t.toLowerCase()))
    ));

    return testCards.map(card => {
      const answer = card.text;
      const distractors = this.shuffle(pool).slice(0, this.OPTION_COUNT - 1);
      const labels = this.shuffle([answer, ...distractors]);
      return {
        before: '',
        after: '',
        full: answer,
        gloss: card.translations[0] ?? answer,
        answer,
        options: labels.map(label => ({
          label,
          correct: label === answer,
          revealed: false,
          chosen: false,
        })),
      };
    });
  }

  private buildQuestions(deckId: string, level: number): BlankQuestion[] {
    const toSrc = (c: { text: string; translations: string[] }) => ({ text: c.text, translations: c.translations });
    const current = (level > 0 ? this.flashcardService.getLevelCards(deckId, level) : this.flashcardService.getFlashcardQueue(deckId, 20)).map(toSrc);
    const earlier: { text: string; translations: string[] }[] = [];
    for (let n = 1; n < level; n++) {
      for (const c of this.flashcardService.getLevelCards(deckId, n)) earlier.push(toSrc(c));
    }

    const lang = this.builderLang();
    const tokens = buildTokens(current, earlier, lang);
    const phrases = generatePhrases(tokens, this.MAX_QUESTIONS * 2, lang)
      .filter(p => p.blankIndex !== undefined);

    const questions: BlankQuestion[] = [];
    const usedAnswers = new Set<string>();
    for (const p of phrases) {
      if (questions.length >= this.MAX_QUESTIONS) break;
      const q = this.toQuestion(p, tokens);
      if (!q) continue;
      // Avoid asking the exact same missing word twice in a row of generation.
      if (usedAnswers.has(q.answer.toLowerCase())) continue;
      usedAnswers.add(q.answer.toLowerCase());
      questions.push(q);
    }
    return this.shuffle(questions);
  }

  /** Turn a generated phrase into a question with 4 options, or null. */
  private toQuestion(p: GeneratedPhrase, tokens: BuilderToken[]): BlankQuestion | null {
    const idx = p.blankIndex;
    if (idx === undefined || idx < 0 || idx >= p.tokens.length) return null;
    const answer = p.tokens[idx];
    const before = p.tokens.slice(0, idx).join(' ');
    const after = p.tokens.slice(idx + 1).join(' ');

    const distractors = this.pickDistractors(tokens, answer, p.blankCategory, this.OPTION_COUNT - 1);
    if (distractors.length < this.OPTION_COUNT - 1) return null; // not enough plausible options

    const labels = this.shuffle([answer, ...distractors]);
    return {
      before,
      after,
      full: p.target,
      gloss: p.en,
      answer,
      options: labels.map(label => ({
        label,
        correct: label === answer,
        revealed: false,
        chosen: false,
      })),
    };
  }

  /**
   * Pick `n` distinct distractor words of the SAME category as the answer (so a
   * noun blank gets other nouns, etc.), falling back to any other word if the
   * category pool is too small.
   */
  private pickDistractors(tokens: BuilderToken[], answer: string, category: WordCategory | undefined, n: number): string[] {
    const answerLower = answer.toLowerCase();
    const sameCat = tokens
      .filter(t => t.category === category && t.text.toLowerCase() !== answerLower)
      .map(t => t.text);
    const others = tokens
      .filter(t => t.category !== category && t.text.toLowerCase() !== answerLower)
      .map(t => t.text);

    const unique = (arr: string[]) => [...new Set(arr)];
    const pool = [...this.shuffle(unique(sameCat)), ...this.shuffle(unique(others))];
    const out: string[] = [];
    for (const w of pool) {
      if (out.length >= n) break;
      if (w.toLowerCase() === answerLower) continue;
      if (out.some(o => o.toLowerCase() === w.toLowerCase())) continue;
      out.push(w);
    }
    return out;
  }

  get current(): BlankQuestion | null {
    return this.questions[this.currentIndex] ?? null;
  }

  get progress(): number {
    if (this.questions.length === 0) return 0;
    return (this.currentIndex / this.questions.length) * 100;
  }

  get total(): number {
    return this.questions.length;
  }

  playFull(): void {
    const full = this.current?.full;
    if (full) void this.audio.playWord(full, undefined, this.settings.learningLanguage());
  }

  choose(option: BlankOption): void {
    if (this.answered) return;
    this.answered = true;
    option.chosen = true;
    const q = this.current;
    if (!q) return;
    for (const o of q.options) o.revealed = true;

    if (option.correct) this.correctCount++;
    else this.mistakes++;

    this.cdr.detectChanges();
    setTimeout(() => {
      this.currentIndex++;
      this.answered = false;
      if (this.currentIndex >= this.questions.length) {
        void this.completeSession();
      } else {
        this.cdr.detectChanges();
      }
    }, option.correct ? 700 : 1200);
  }

  private async completeSession(): Promise<void> {
    const total = this.questions.length;
    const scorePercent = total > 0 ? Math.round((this.correctCount / total) * 100) : 0;

    if (this.levelNumber <= 0 || !this.deck) {
      this.phase = 'complete';
      this.earnedStars = this.flashcardService.calculateStars(scorePercent);
      this.cdr.detectChanges();
      return;
    }

    // Journey node has no real fail bar beyond the shared 70%; save a single
    // pass. Standalone saves one round (the mode isn't 5-round like quiz here —
    // it's a one-session accuracy score, which is enough for stars/display).
    const result = await this.flashcardService.saveRoundProgress(
      this.deck.id, this.mode, this.levelNumber, scorePercent
    );
    this.earnedStars = result.stars;
    this.isNewBest = result.levelComplete || this.singlePass;
    this.phase = 'complete';
    this.cdr.detectChanges();
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  finish(): Promise<boolean> { return this.navCtrl.navigateBack(this.backUrl); }
  close(): Promise<boolean> { return this.navCtrl.navigateBack(this.backUrl); }
}
