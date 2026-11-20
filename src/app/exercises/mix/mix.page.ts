/**
 * Mix Page — an INTERLEAVED single-question session: one quiz, one match, one
 * builder, one blank, … woven together and all rendered/graded inline on this
 * one page (no sub-exercise navigation, so nothing can cascade/stack).
 *
 * Counts toward Explore tier completion via the 'journey-mix' node when
 * launched for a real level. Scored by first-try accuracy into stars.
 *
 * @module app/exercises/mix
 */
import {
  Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NavController, ViewWillEnter, ViewWillLeave } from '@ionic/angular';
import { FlashcardService, FlashcardDeck, Flashcard } from '../../services/flashcard.service';
import { SettingsService } from '../../services/settings.service';
import { I18nAngularService } from '../../services/i18n.service';
import { AudioService } from '../../services/audio.service';
import { BackInterceptorService } from '../../services/back-interceptor.service';
import { ExitConfirmService } from '../../services/exit-confirm.service';
import { journeyBackUrl } from '../../maps/journey/journey-back';
import { gradeAnswer } from '../../../core/answer-validator/typo-grader';
import type { SourceCard } from '../../../core/phrase-builder/phrase-builder';
import {
  MixSessionService, type MixItem, type MixChoice,
  type MixMatchItem, type MixBuilderItem,
} from './mix-session.service';

@Component({
  selector: 'app-mix',
  templateUrl: './mix.page.html',
  styleUrls: ['./mix.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MixPage implements OnInit, OnDestroy, ViewWillEnter, ViewWillLeave {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private navCtrl = inject(NavController);
  private flashcards = inject(FlashcardService);
  private settings = inject(SettingsService);
  private i18n = inject(I18nAngularService);
  private audio = inject(AudioService);
  private backInterceptor = inject(BackInterceptorService);
  private exitConfirm = inject(ExitConfirmService);
  private mix = inject(MixSessionService);
  private cdr = inject(ChangeDetectorRef);

  private deck: FlashcardDeck | null = null;
  private level = 0;
  private backUrl = '/practice?mode=mix';

  isLoading = true;
  phase: 'play' | 'done' = 'play';
  item: MixItem | null = null;
  index = 0;
  total = 0;
  correctCount = 0;
  earnedStars = 0;

  // Per-item answer state.
  answered = false;            // locked after answering (choice/builder/write)
  readonly playing = this.audio.playing;
  /** Audio state for the icon: whether audio is sounding, and a counter that bumps
   *  on EVERY play so the icon replays its sound-wave animation (page-entry
   *  auto-plays and every repeat tap alike). */
  readonly playKind = this.audio.playKind;
  readonly playSeq = this.audio.playSeq;


  // Match sub-state.
  matchLeftSel: string | null = null;        // selected pair id on the left
  matchRightSel: string | null = null;       // selected pair id on the right
  matchDone = new Set<string>();              // solved pair ids
  matchWrong = false;

  // Builder sub-state.
  builderChosen: string[] = [];
  builderBank: string[] = [];
  builderResult: 'none' | 'correct' | 'wrong' = 'none';

  // Write sub-state.
  writeValue = '';
  writeResult: 'none' | 'correct' | 'wrong' = 'none';

  private readonly onHardwareBack: () => Promise<boolean> =
    () => this.exitConfirm.request(this.index > 0 && this.phase === 'play', () => this.leave());

  t(key: string, p?: Record<string, string | number>): string { return this.i18n.t(key, p); }

  ngOnDestroy(): void { this.backInterceptor.clear(this.onHardwareBack); this.exitConfirm.reset(); }
  /** How many times this view has been entered. A cold load (F5 on an exercise URL)
   *  bails out to the level page and leaves this instance cached underneath it,
   *  still on its loading spinner. Ionic REUSES that instance on the next visit
   *  without re-running ngOnInit, so it would sit on the spinner forever. */
  private enterCount = 0;

  ionViewWillEnter(): void {
    this.backInterceptor.register(this.onHardwareBack);
    // Re-entered while still loading = a stale instance left by an earlier bail-out:
    // run the setup again for the NEW route.
    if (++this.enterCount > 1 && this.isLoading) void this.ngOnInit();
  }
  ionViewWillLeave(): void { this.backInterceptor.clear(this.onHardwareBack); this.exitConfirm.reset(); }

  async ngOnInit(): Promise<void> {
    await this.flashcards.initialize();
    const deckId = this.route.snapshot.paramMap.get('id');
    this.level = Number(this.route.snapshot.queryParamMap.get('level') ?? 0);
    if (!deckId) { this.router.navigate(['/practice']); return; }
    this.deck = this.flashcards.getDeck(deckId);
    if (!this.deck) { this.router.navigate(['/practice']); return; }
    const from = this.route.snapshot.queryParamMap.get('from');
    this.backUrl = from ? journeyBackUrl(this.route.snapshot.queryParamMap) : '/practice?mode=mix';

    // Source cards for the session.
    const cards: Flashcard[] = this.level > 0
      ? this.flashcards.getLevelCards(deckId, this.level)
      : this.flashcards.getFlashcardQueue(deckId, 20);
    const toSrc = (c: Flashcard): SourceCard => ({ text: c.text, translations: c.translations });
    const current = cards.map(toSrc);
    const earlier: SourceCard[] = [];
    for (let n = 1; n < this.level; n++) {
      for (const c of this.flashcards.getLevelCards(deckId, n)) earlier.push(toSrc(c));
    }

    const session = this.mix.start(
      deckId, this.level, cards, current, earlier,
      (c) => this.flashcards.bestTranslation(c),
    );
    this.total = session.items.length;
    this.loadCurrent();
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  /** Load the current item + reset per-item state; auto-play audio items. */
  private loadCurrent(): void {
    const s = this.mix.current();
    this.item = this.mix.currentItem();
    this.index = s?.index ?? 0;
    this.answered = false;
    // Clear the previous item's pick, otherwise it carries over (e.g. a Quiz
    // answer "coffee" showing up pre-filled in the next Blank's gap).
    this.chosenLabel = null;
    this.matchLeftSel = this.matchRightSel = null;
    this.matchDone = new Set();
    this.matchWrong = false;
    this.matchMistake = false;
    this.matchRightsCache = this.item?.kind === 'match'
      ? this.shuffleRights((this.item as MixMatchItem).pairs)
      : [];
    this.builderResult = 'none';
    this.builderChosen = [];
    this.builderBank = this.item && this.item.kind === 'builder' ? [...(this.item as MixBuilderItem).bank] : [];
    this.writeValue = '';
    this.writeResult = 'none';
    this.cdr.detectChanges();
    // Auto-play the pronunciation for items that show/anchor on a spoken word:
    // the Audio item (where sound IS the prompt) and the Quiz item (French word
    // + speaker) both speak on arrival, matching the other modes. Blank/builder/
    // write stay silent until the user taps (their prompt is a sentence/English).
    if (this.item?.kind === 'audio' || this.item?.kind === 'quiz') {
      setTimeout(() => this.playPrompt(), 180);
    }
  }

  // ── Audio ────────────────────────────────────────────────────────────────────
  playPrompt(): void {
    if (!this.item) return;
    let text = ''; let url: string | null = null;
    if (this.item.kind === 'quiz' || this.item.kind === 'audio') { text = this.item.prompt; url = this.item.audioUrl; }
    else if (this.item.kind === 'blank') text = this.item.full;
    else if (this.item.kind === 'builder' || this.item.kind === 'write') text = this.item.target;
    if (text) void this.audio.playWord(text, url, this.settings.learningLanguage());
  }

  // ── Quiz / audio / blank (multiple choice) ─────────────────────────────────────
  get choices(): MixChoice[] {
    if (!this.item) return [];
    if (this.item.kind === 'quiz' || this.item.kind === 'audio' || this.item.kind === 'blank') return this.item.choices;
    return [];
  }
  chosenLabel: string | null = null;
  chooseOption(opt: MixChoice): void {
    if (this.answered) return;
    this.answered = true;
    this.chosenLabel = opt.label;
    if (opt.correct) { this.mix.recordCorrect(); this.correctCount++; }
    this.cdr.detectChanges();
    this.autoNext(opt.correct);
  }

  // ── Match (mini-board) ─────────────────────────────────────────────────────────
  get matchItem(): MixMatchItem | null { return this.item?.kind === 'match' ? this.item : null; }
  /** The right (English) column, SHUFFLED once per item so it doesn't line up
   *  row-for-row with the left (French) column — otherwise matching is trivial
   *  (just tap the word straight across). Cached in `matchRightsCache` so OnPush
   *  re-renders (e.g. when a pair is solved) don't reshuffle it. */
  private matchRightsCache: { id: string; en: string }[] = [];
  get matchRights(): { id: string; en: string }[] { return this.matchRightsCache; }
  private matchMistake = false;
  /** Shuffle the English column so it never lines up row-for-row with the
   *  French column. For a small board a random shuffle can land back on the
   *  original order, so reshuffle until it differs (unless every pair is
   *  identical, which can't happen here). */
  private shuffleRights(pairs: { id: string; en: string }[]): { id: string; en: string }[] {
    const rights = pairs.map(p => ({ id: p.id, en: p.en }));
    if (rights.length < 2) return rights;
    for (let attempt = 0; attempt < 8; attempt++) {
      for (let i = rights.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rights[i], rights[j]] = [rights[j], rights[i]];
      }
      // Accept the shuffle only if at least one position differs from the
      // left column order (pairs[i].id), so it's not a trivial straight match.
      if (rights.some((r, i) => r.id !== pairs[i].id)) break;
    }
    return rights;
  }
  selectMatch(side: 'left' | 'right', id: string): void {
    if (this.matchDone.has(id)) return;
    if (side === 'left') this.matchLeftSel = this.matchLeftSel === id ? null : id;
    else this.matchRightSel = this.matchRightSel === id ? null : id;
    if (this.matchLeftSel && this.matchRightSel) {
      if (this.matchLeftSel === this.matchRightSel) {
        this.matchDone.add(this.matchLeftSel);
        this.matchLeftSel = this.matchRightSel = null;
        if (this.matchItem && this.matchDone.size === this.matchItem.pairs.length) {
          // Board solved: correct only if there were no wrong attempts.
          this.answered = true;
          if (!this.matchMistake) { this.mix.recordCorrect(); this.correctCount++; }
          this.cdr.detectChanges();
          this.autoNext(!this.matchMistake);
          return;
        }
      } else {
        this.matchMistake = true;
        this.matchWrong = true;
        const l = this.matchLeftSel, r = this.matchRightSel;
        setTimeout(() => {
          this.matchWrong = false;
          if (this.matchLeftSel === l) this.matchLeftSel = null;
          if (this.matchRightSel === r) this.matchRightSel = null;
          this.cdr.detectChanges();
        }, 550);
      }
    }
    this.cdr.detectChanges();
  }

  // ── Builder (arrange chips) ──────────────────────────────────────────────────────
  get builderItem(): MixBuilderItem | null { return this.item?.kind === 'builder' ? this.item : null; }
  builderPick(token: string): void {
    if (this.answered) return;
    this.builderResult = 'none';
    this.builderChosen = [...this.builderChosen, token];
    const i = this.builderBank.indexOf(token);
    if (i >= 0) this.builderBank = [...this.builderBank.slice(0, i), ...this.builderBank.slice(i + 1)];
    this.cdr.detectChanges();
  }
  builderUnpick(i: number): void {
    if (this.answered) return;
    const removed = this.builderChosen[i];
    this.builderChosen = this.builderChosen.filter((_, k) => k !== i);
    this.builderBank = [...this.builderBank, removed];
    this.builderResult = 'none';
    this.cdr.detectChanges();
  }
  get builderCanCheck(): boolean { return !this.answered && this.builderChosen.length > 0; }
  builderCheck(): void {
    const b = this.builderItem;
    if (!b || this.answered) return;
    const correct = this.builderChosen.length === b.tokens.length
      && b.tokens.every((tk, k) => tk === this.builderChosen[k]);
    if (correct) {
      this.answered = true;
      this.builderResult = 'correct';
      this.mix.recordCorrect(); this.correctCount++;
      this.cdr.detectChanges();
      this.autoNext(true);
    } else {
      this.builderResult = 'wrong';
      this.cdr.detectChanges();
      setTimeout(() => { if (this.builderResult === 'wrong') { this.builderResult = 'none'; this.cdr.detectChanges(); } }, 600);
    }
  }

  // ── Write (type the answer) ────────────────────────────────────────────────────
  get writeItem() { return this.item?.kind === 'write' ? this.item : null; }
  writeCheck(): void {
    const w = this.writeItem;
    if (!w || this.answered || !this.writeValue.trim()) return;
    const grade = gradeAnswer(this.writeValue, w.accepted).grade;
    const ok = grade !== 'wrong';
    this.answered = true;
    this.writeResult = ok ? 'correct' : 'wrong';
    if (ok) { this.mix.recordCorrect(); this.correctCount++; }
    this.cdr.detectChanges();
    this.autoNext(ok);
  }

  // ── Flow ───────────────────────────────────────────────────────────────────────
  /** After an item is answered, pause to show the result, then advance. */
  private autoNext(correct: boolean): void {
    setTimeout(() => {
      this.mix.advance();
      if (!this.mix.currentItem()) { void this.finishSession(); return; }
      this.loadCurrent();
    }, correct ? 750 : 1300);
  }

  get progress(): number { return this.total ? (this.index / this.total) * 100 : 0; }

  private async finishSession(): Promise<void> {
    this.phase = 'done';
    const pct = this.total > 0 ? Math.round((this.correctCount / this.total) * 100) : 0;
    this.earnedStars = this.flashcards.calculateStars(pct);
    if (this.deck && this.level > 0) {
      try { await this.flashcards.saveRoundProgress(this.deck.id, 'journey-mix', this.level, pct); }
      catch { /* best-effort */ }
    }
    this.mix.clear();
    this.cdr.detectChanges();
  }

  finish(): void { this.leave(); }
  close(): void { void this.exitConfirm.request(this.index > 0 && this.phase === 'play', () => this.leave()); }
  private leave(): void { this.mix.clear(); this.navCtrl.navigateBack(this.backUrl); }
}
