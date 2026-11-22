/**
 * Builder+ Page (EXPERIMENTAL — self-checking variant of Builder)
 *
 * Same "grammar groups → phrases" dataset and map as the classic Builder, but
 * the phrase stage is SELF-CHECKING with no Check button:
 *   - the target shows one DASHED UNDERLINE per word still to place (not a
 *     dashed rectangle);
 *   - you may only place words in the CORRECT ORDER. Tapping (or dragging) the
 *     next correct word drops it onto the next underline; tapping a wrong word
 *     flashes it RED/blinking in the bank and refuses it;
 *   - placing the final word completes the phrase and plays its audio.
 *
 * It reuses the Builder datasets (assets/decks/*-builder.json) and the Tree
 * phrase-builder for the Journey node, so Builder+ can run both standalone
 * (home mode list) and — if wired as a journey node — generated phrases.
 *
 * Self-contained prototype: standalone progress lives in localStorage under its
 * OWN key (so it never clobbers the classic Builder's progress).
 *
 * @module app/exercises/builder-plus
 */

import {
  Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy,
  ElementRef, HostListener, ViewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { ActionSheetController, NavController, ViewWillEnter, ViewWillLeave } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { I18nAngularService } from '../../services/i18n.service';
import { AudioService } from '../../services/audio.service';
import { SettingsService } from '../../services/settings.service';
import { AddWordService } from '../../services/add-word.service';
import { FlashcardService } from '../../services/flashcard.service';
import { BackInterceptorService } from '../../services/back-interceptor.service';
import { ExitConfirmService } from '../../services/exit-confirm.service';
import { journeyBackUrl } from '../../maps/journey/journey-back';
import { GameRulesService } from '../../services/game-rules.service';
import { builderRulesText } from '../../shared/star-rules';
import {
  buildTokens, buildTreeTokens, generatePhrases, type GeneratedPhrase,
} from '../../../core/phrase-builder/phrase-builder';
import { lessonPhrases } from '../../maps/explore-plus/lessons/lessons';

interface BuilderWord { text: string; translations: string[]; article?: string; lemma?: string; }
interface BuilderGroup { id: string; category: string; name: string; order: number; words: BuilderWord[]; }
interface BuilderPhrase { id: string; unlockAfter: string[]; target: string; en: string; tokens: string[]; }
interface BuilderData { id: string; name: string; languageCode: string; groups: BuilderGroup[]; phrases: BuilderPhrase[]; }

/** One tile in the word bank. Each tile has its own id so duplicate words are
 *  independent (tapping one never affects its twin), and a tile that has been
 *  placed stays in the bank — greyed out — so the bank never reflows. */
export interface BankWord { id: number; word: string; used: boolean; }

type Stage =
  | { kind: 'map' }
  | { kind: 'group'; group: BuilderGroup; index: number }
  | { kind: 'phrase'; phrase: BuilderPhrase; chosen: string[]; done: boolean }
  /** Journey only: the end-of-node recap of the phrases just built. */
  | { kind: 'recap' };

@Component({
  selector: 'app-builder-plus',
  templateUrl: './builder-plus.page.html',
  styleUrls: ['./builder-plus.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuilderPlusPage implements OnInit, OnDestroy, ViewWillEnter, ViewWillLeave {
  private http = inject(HttpClient);
  private router = inject(Router);
  private navCtrl = inject(NavController);
  private route = inject(ActivatedRoute);
  private i18n = inject(I18nAngularService);
  private audio = inject(AudioService);
  /** Audio state for the play icons: which kind is playing, and a counter that
   *  bumps on EVERY play so the icon replays its sound-wave animation. */
  readonly playKind = this.audio.playKind;
  readonly playSeq = this.audio.playSeq;
  private settings = inject(SettingsService);
  private rules = inject(GameRulesService);
  /** Admin mode: shows the star-rules button. */
  get adminMode(): boolean { return this.settings.adminMode(); }
  /** ADMIN: how this activity is completed. */
  showRules(): void { void this.rules.showRules(builderRulesText('Builder+', this.journeyPhrases.length)); }
  private addWordService = inject(AddWordService);
  private flashcards = inject(FlashcardService);
  private actionSheet = inject(ActionSheetController);
  private cdr = inject(ChangeDetectorRef);
  private backInterceptor = inject(BackInterceptorService);
  private exitConfirm = inject(ExitConfirmService);

  private readonly onHardwareBack: () => Promise<boolean> =
    () => this.exitConfirm.request(this.hasProgress, () => this.leave());

  ngOnDestroy(): void { this.backInterceptor.clear(this.onHardwareBack); this.exitConfirm.reset(); }
  ionViewWillLeave(): void { this.backInterceptor.clear(this.onHardwareBack); this.exitConfirm.reset(); }

  /** True only when there's actual work to lose (a group flip, or a phrase with
   *  at least one word placed but not finished). */
  private get hasProgress(): boolean {
    if (this.stage.kind === 'group') return true;
    if (this.stage.kind === 'phrase') return this.stage.chosen.length > 0 && !this.stage.done;
    return false;
  }

  private leave(): void {
    if (this.journeyMode) { this.navCtrl.navigateBack(this.journeyBack); return; }
    this.router.navigate(['/home']);
  }

  // ── Journey node (generated phrases) ───────────────────────────────────────
  journeyMode = false;
  private get journeyBack(): string { return journeyBackUrl(this.route.snapshot.queryParamMap); }
  private journeyDeckId = '';
  private journeyLevel = 0;
  private journeyPhrases: GeneratedPhrase[] = [];
  private journeyIndex = 0;
  private journeyWordPool: string[] = [];

  private static readonly DATASETS: Record<string, string> = {
    nl: 'assets/decks/dutch-builder.json',
    fr: 'assets/decks/french-builder.json',
  };
  private static readonly LANG_NAMES: Record<string, string> = { nl: 'Dutch', fr: 'French' };

  private langCode = 'nl';

  availableLanguages: { code: string; name: string; flagUrl: string }[] = Object.keys(BuilderPlusPage.DATASETS)
    .map(code => ({ code, name: BuilderPlusPage.LANG_NAMES[code] ?? code.toUpperCase(), flagUrl: this.flagUrl(code) }));

  private flagUrl(code: string): string {
    const toCountry: Record<string, string> = {
      nl: 'nl', dn: 'nl', fr: 'fr', es: 'es', it: 'it', de: 'de', pt: 'pt',
      en: 'gb', da: 'dk', el: 'gr', ja: 'jp', ko: 'kr', zs: 'cn', uk: 'ua',
      nb: 'no', he: 'il', hi: 'in', vi: 'vn', cs: 'cz', sv: 'se', ga: 'ie',
      gd: 'gb', cy: 'gb', hw: 'us', ht: 'ht', zu: 'za', sw: 'ke',
    };
    return `https://flagcdn.com/${toCountry[code] ?? code}.svg`;
  }
  get learningLanguage(): string { return this.langCode; }
  get currentLanguage(): { code: string; name: string; flagUrl: string } {
    return (
      this.availableLanguages.find(l => l.code === this.langCode) ??
      this.availableLanguages[0] ?? { code: this.langCode, name: this.langCode.toUpperCase(), flagUrl: this.flagUrl(this.langCode) }
    );
  }
  async selectLanguage(code: string): Promise<void> {
    if (code === this.langCode) return;
    this.settings.updateSetting('learningLanguage', code);
    this.langCode = code;
    this.stage = { kind: 'map' };
    this.isLoading = true;
    this.cdr.detectChanges();
    await this.loadDataset();
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  async openMenu(): Promise<void> {
    const sheet = await this.actionSheet.create({
      cssClass: 'mode-menu-sheet',
      buttons: [
        {
          text: this.i18n.t('feedback.report'),
          icon: 'flag-outline',
          handler: () => {
            void this.addWordService.reportProblem({
              languageCode: this.langCode,
              modeName: 'Builder+',
              reportContext: 'generic',
            });
          },
        },
        { text: this.i18n.t('common.cancel'), icon: 'close-outline', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  data: BuilderData | null = null;
  isLoading = true;
  stage: Stage = { kind: 'map' };

  private completed = new Set<string>();

  /** The word bank to pick from (correct tokens + distractors, shuffled). A
   *  placed word is flagged used (greyed) rather than removed. */
  bank: BankWord[] = [];

  /** The bank tile (by id) currently flashing red after a wrong pick, or null. */
  rejectedId: number | null = null;

  /** How many dashed answer lines to draw = how many rows the word bank wraps
   *  to. Measured from the real layout so the answer area is as tall as it will
   *  ever need and nothing below it moves while you build. */
  lineRows = 1;
  get lineIndexes(): number[] { return Array.from({ length: this.lineRows }, (_v, i) => i); }

  @ViewChild('bankEl') private bankEl?: ElementRef<HTMLElement>;

  /** The phrases just built in a journey node, shown on the recap page. */
  recapPhrases: { target: string; en: string }[] = [];

  trackBank = (_i: number, b: BankWord): number => b.id;
  private rejectTimer: ReturnType<typeof setTimeout> | null = null;

  t(key: string, params?: Record<string, string | number>): string { return this.i18n.t(key, params); }

  async ngOnInit(): Promise<void> { await this.setup(); }

  async ionViewWillEnter(): Promise<void> {
    this.backInterceptor.register(this.onHardwareBack);
    if (this.didSetup) await this.setup();
  }

  private didSetup = false;

  private async setup(): Promise<void> {
    this.didSetup = true;
    this.isLoading = true;
    this.journeyMode = false;
    this.stage = { kind: 'map' };
    this.cdr.detectChanges();

    if (this.route.snapshot.queryParamMap.get('mode') === 'journey-builder-plus') {
      await this.startJourneyBuilder();
      return;
    }
    const appLang = this.settings.learningLanguage();
    this.langCode = BuilderPlusPage.DATASETS[appLang] ? appLang : Object.keys(BuilderPlusPage.DATASETS)[0];
    await this.loadDataset();
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  private async startJourneyBuilder(): Promise<void> {
    await this.flashcards.initialize();
    this.journeyMode = true;
    this.langCode = this.settings.learningLanguage();
    const deckId = this.route.snapshot.paramMap.get('id') ?? '';
    const level = Number(this.route.snapshot.queryParamMap.get('level') ?? 0);
    this.journeyDeckId = deckId;
    this.journeyLevel = level;

    const toSrc = (c: { text: string; translations: string[] }) => ({ text: c.text, translations: c.translations });
    const current = this.flashcards.getLevelCards(deckId, level).map(toSrc);
    const earlierLevels = this.poolLevels(level) ?? Array.from({ length: Math.max(0, level - 1) }, (_v, i) => i + 1);
    const earlier: { text: string; translations: string[] }[] = [];
    for (const n of earlierLevels) {
      for (const c of this.flashcards.getLevelCards(deckId, n)) earlier.push(toSrc(c));
    }

    if (this.flashcards.isLessonDeckId(deckId)) {
      // Explore+ lessons: the lesson's AUTHORED sentences (never generated).
      this.journeyPhrases = lessonPhrases(level, 5);
      this.journeyWordPool = [];
    } else if (this.flashcards.isTreeDeckId(deckId)) {
      const tokens = buildTreeTokens(current, earlier);
      this.journeyPhrases = generatePhrases(tokens, 5, 'fr', { engine: 'v2', seed: 1 + Math.floor(Math.random() * 1e6) });
      this.journeyWordPool = [];
    } else {
      const tokens = buildTokens(current, earlier);
      this.journeyPhrases = generatePhrases(tokens, 5);
      this.journeyWordPool = tokens.map(t => t.text).filter(w => w && !/\s/.test(w));
    }

    if (this.journeyPhrases.length === 0) {
      this.isLoading = true;
      this.cdr.detectChanges();
      await this.flashcards.saveRoundProgress(deckId, 'journey-builder-plus', level, 100);
      this.navCtrl.navigateBack(this.journeyBack);
      return;
    }

    this.journeyIndex = 0;
    this.isLoading = false;
    this.openJourneyPhrase();
  }

  private poolLevels(level: number): number[] | null {
    const raw = this.route.snapshot.queryParamMap.get('pool');
    if (!raw) return null;
    const levels = [...new Set(raw.split(',').map(s => Number(s.trim())))]
      .filter(n => Number.isInteger(n) && n > 0 && n !== level);
    return levels.length ? levels : null;
  }

  private openJourneyPhrase(): void {
    const p = this.journeyPhrases[this.journeyIndex];
    const phrase: BuilderPhrase = {
      id: `journey-${this.journeyIndex}`, unlockAfter: [],
      target: p.target, en: p.en, tokens: p.tokens,
    };
    this.showPhrase(phrase, this.buildBank(phrase.tokens, p.distractors ?? this.journeyWordPool));
  }

  /** Show a phrase: set the bank + stage, render, then measure how many rows
   *  the bank takes so the answer area gets the same number of lines. All
   *  synchronous (before the browser paints) so there's no visible re-layout. */
  private showPhrase(phrase: BuilderPhrase, words: string[]): void {
    this.clearReject();
    this.bank = words.map((word, id) => ({ id, word, used: false }));
    this.stage = { kind: 'phrase', phrase, chosen: [], done: false };
    this.lineRows = 1;
    this.cdr.detectChanges();
    this.measureBankRows();
    // Fonts / the page transition can still settle a frame later; re-check.
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => this.measureBankRows());
  }

  /** Count the distinct rows the bank tiles wrap onto and size the answer
   *  lines to match. */
  private measureBankRows(): void {
    const el = this.bankEl?.nativeElement;
    if (!el) return;
    const tops = new Set<number>();
    el.querySelectorAll<HTMLElement>('.bank-word').forEach(b => tops.add(b.offsetTop));
    const rows = Math.max(1, tops.size);
    if (rows !== this.lineRows) { this.lineRows = rows; this.cdr.detectChanges(); }
  }

  /** Re-measure on rotation / window resize (the bank may wrap differently). */
  @HostListener('window:resize') onResize(): void { this.measureBankRows(); }

  private buildBank(tokens: string[], pool: string[]): string[] {
    const inPhrase = new Set(tokens.map(t => t.toLowerCase()));
    const seen = new Set(tokens.map(t => t.toLowerCase()));
    const candidates: string[] = [];
    for (const w of this.shuffle([...pool])) {
      const key = w.toLowerCase();
      if (inPhrase.has(key) || seen.has(key)) continue;
      seen.add(key);
      candidates.push(w);
    }
    const extra = Math.max(2, Math.min(4, Math.ceil(tokens.length / 2)));
    return this.shuffle([...tokens, ...candidates.slice(0, extra)]);
  }

  async journeyNext(): Promise<void> {
    this.journeyIndex++;
    if (this.journeyIndex < this.journeyPhrases.length) { this.openJourneyPhrase(); return; }
    await this.flashcards.saveRoundProgress(this.journeyDeckId, 'journey-builder-plus', this.journeyLevel, 100);
    // Don't close instantly: show a recap of what was built first (like Learn).
    this.recapPhrases = this.journeyPhrases.map(p => ({ target: p.target, en: p.en }));
    this.stage = { kind: 'recap' };
    this.cdr.detectChanges();
  }

  /** Leave the recap (progress was already saved) and return to the map. */
  finishRecap(): void { this.navCtrl.navigateBack(this.journeyBack); }

  private async loadDataset(): Promise<void> {
    this.loadProgress();
    const url = BuilderPlusPage.DATASETS[this.langCode];
    if (!url) { this.data = null; return; }
    try {
      this.data = await firstValueFrom(this.http.get<BuilderData>(url));
    } catch {
      this.data = null;
    }
  }

  // ── Progress (own key so it never clobbers the classic Builder) ─────────────
  private get storeKey(): string { return `boosted-builder-plus-progress-${this.langCode}`; }

  private loadProgress(): void {
    try {
      const raw = localStorage.getItem(this.storeKey);
      this.completed = raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { this.completed = new Set(); }
  }
  private saveProgress(): void {
    try { localStorage.setItem(this.storeKey, JSON.stringify([...this.completed])); } catch { /* ignore */ }
  }

  isDone(id: string): boolean { return this.completed.has(id); }
  isPhraseUnlocked(p: BuilderPhrase): boolean { return p.unlockAfter.every(g => this.completed.has(g)); }

  get groups(): BuilderGroup[] { return [...(this.data?.groups ?? [])].sort((a, b) => a.order - b.order); }
  get phrases(): BuilderPhrase[] { return this.data?.phrases ?? []; }

  // ── Group learning ──────────────────────────────────────────────────────────
  openGroup(group: BuilderGroup): void {
    this.stage = { kind: 'group', group, index: 0 };
    this.cdr.detectChanges();
  }

  get groupWord(): BuilderWord | null {
    return this.stage.kind === 'group' ? this.stage.group.words[this.stage.index] ?? null : null;
  }

  nextWord(): void {
    if (this.stage.kind !== 'group') return;
    if (this.stage.index < this.stage.group.words.length - 1) {
      this.stage = { ...this.stage, index: this.stage.index + 1 };
    } else {
      this.completed.add(this.stage.group.id);
      this.saveProgress();
      this.stage = { kind: 'map' };
    }
    this.cdr.detectChanges();
  }

  playWord(text: string): void { void this.audio.playWord(text, undefined, this.langCode); }

  // ── Phrase building (self-checking: correct order only) ─────────────────────
  openPhrase(phrase: BuilderPhrase): void {
    if (!this.isPhraseUnlocked(phrase)) return;
    const pool = (this.data?.groups ?? [])
      .flatMap(g => g.words.map(w => w.text))
      .filter(w => w && !/\s/.test(w));
    this.showPhrase(phrase, this.buildBank(phrase.tokens, pool));
  }

  /**
   * Self-check pick: accept the word ONLY if it's the next correct token.
   * Correct → drop it into the next slot (and complete the phrase if it was the
   * last). Wrong → flash that bank word red/blinking and refuse it.
   */
  pick(item: BankWord): void {
    if (this.stage.kind !== 'phrase' || this.stage.done || item.used) return;
    const expected = this.stage.phrase.tokens[this.stage.chosen.length];
    // Only the tile that was tapped is judged — a duplicate twin is untouched.
    if (item.word !== expected) { this.reject(item.id); return; }

    this.clearReject();
    const chosen = [...this.stage.chosen, item.word];
    item.used = true;     // stays in place, greyed out (the bank never reflows)
    const done = chosen.length === this.stage.phrase.tokens.length;
    this.stage = { ...this.stage, chosen, done };
    this.cdr.detectChanges();

    if (done) {
      this.completed.add(this.stage.phrase.id);
      this.saveProgress();
      void this.audio.playWord(this.stage.phrase.target, undefined, this.langCode);
    }
  }

  /** Flash the tapped (wrong) bank tile red for a moment, then clear it. */
  private reject(id: number): void {
    this.rejectedId = id;
    if (this.rejectTimer) clearTimeout(this.rejectTimer);
    this.rejectTimer = setTimeout(() => {
      this.rejectedId = null;
      this.rejectTimer = null;
      this.cdr.detectChanges();
    }, 600);
    this.cdr.detectChanges();
  }

  private clearReject(): void {
    if (this.rejectTimer) { clearTimeout(this.rejectTimer); this.rejectTimer = null; }
    this.rejectedId = null;
  }

  backToMap(): void {
    this.stage = { kind: 'map' };
    this.cdr.detectChanges();
  }

  close(): void { void this.exitConfirm.request(this.hasProgress, () => this.leave()); }

  private shuffle<T>(a: T[]): T[] {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
