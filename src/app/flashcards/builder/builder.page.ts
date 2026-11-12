/**
 * Builder Page (EXPERIMENTAL mode)
 *
 * Prototype of the "grammar groups -> phrases" idea. Loads a small hand-
 * categorised Dutch dataset (assets/flashcards/dutch-builder.json): words are
 * grouped by part of speech (articles, pronouns, nouns, verbs, adjectives).
 * The user learns groups; once the prerequisite groups are done, phrase nodes
 * unlock that combine already-learned words into short sentences.
 *
 * Self-contained prototype: progress is kept in localStorage (no DB changes),
 * and it uses the existing word-audio service for pronunciation. Nothing here
 * touches the four original modes or their data.
 *
 * @module app/flashcards/builder
 */

import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy, ViewChild, ElementRef } from '@angular/core';
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
import { journeyBackUrl } from '../journey/journey-back';
import {
  buildTokens, buildTreeTokens, generatePhrases, type GeneratedPhrase,
} from '../../../core/phrase-builder/phrase-builder';

interface BuilderWord { text: string; translations: string[]; article?: string; lemma?: string; }
interface BuilderGroup { id: string; category: string; name: string; order: number; words: BuilderWord[]; }
interface BuilderPhrase { id: string; unlockAfter: string[]; target: string; en: string; tokens: string[]; }
interface BuilderData { id: string; name: string; languageCode: string; groups: BuilderGroup[]; phrases: BuilderPhrase[]; }

type Stage =
  | { kind: 'map' }
  | { kind: 'group'; group: BuilderGroup; index: number }
  | { kind: 'phrase'; phrase: BuilderPhrase; chosen: string[]; done: boolean };

@Component({
  selector: 'app-builder',
  templateUrl: './builder.page.html',
  styleUrls: ['./builder.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuilderPage implements OnInit, OnDestroy, ViewWillEnter, ViewWillLeave {
  /** The chosen-chips row, used to hit-test the pointer against chips on drag. */
  @ViewChild('slotsRow') private slotsRow?: ElementRef<HTMLElement>;

  private http = inject(HttpClient);
  private router = inject(Router);
  private navCtrl = inject(NavController);
  private route = inject(ActivatedRoute);
  private i18n = inject(I18nAngularService);
  private audio = inject(AudioService);
  private settings = inject(SettingsService);
  private addWordService = inject(AddWordService);
  private flashcards = inject(FlashcardService);
  private actionSheet = inject(ActionSheetController);
  private cdr = inject(ChangeDetectorRef);
  private backInterceptor = inject(BackInterceptorService);
  private exitConfirm = inject(ExitConfirmService);

  /** Hardware/gesture back: if the user is inside a group/phrase stage (not on
   *  the map), confirm before leaving; otherwise leave straight away. */
  private readonly onHardwareBack: () => Promise<boolean> =
    () => this.exitConfirm.request(this.hasProgress, () => this.leave());

  ngOnDestroy(): void { this.backInterceptor.clear(this.onHardwareBack); this.exitConfirm.reset(); }
  ionViewWillLeave(): void { this.backInterceptor.clear(this.onHardwareBack); this.exitConfirm.reset(); }

  /**
   * True only when there's actual work to lose. Just OPENING a phrase (the
   * Tree/journey Builder jumps straight into one) is NOT progress — the user
   * hasn't placed anything yet. Progress means: a group flip is underway, or a
   * phrase has at least one word placed but isn't finished. A completed phrase
   * is already saved, so there's nothing to lose there either.
   */
  private get hasProgress(): boolean {
    if (this.stage.kind === 'group') return true;
    if (this.stage.kind === 'phrase') return this.stage.chosen.length > 0 && !this.stage.done;
    return false;
  }

  /** Leave the Builder (shared by the X and the confirm's End). */
  private leave(): void {
    if (this.journeyMode) { this.navCtrl.navigateBack(this.journeyBack); return; }
    this.router.navigate(['/home']);
  }

  // ── Journey Builder node: generated phrases from a skill's words ───────────
  /** True when opened as a Journey node (?mode=journey-builder&level=N). */
  journeyMode = false;
  /** Map to return to (classic Journey or Journey+, via ?from=). */
  private get journeyBack(): string { return journeyBackUrl(this.route.snapshot.queryParamMap); }
  private journeyDeckId = '';
  private journeyLevel = 0;
  /** The generated phrases to play through, and our position in them. */
  private journeyPhrases: GeneratedPhrase[] = [];
  private journeyIndex = 0;
  /** All word surface-forms available this chapter — the pool for distractors. */
  private journeyWordPool: string[] = [];

  /**
   * Builder datasets per learning language. Each is a hand-categorised set in
   * assets/flashcards. Languages without an entry here simply show the
   * "unavailable" empty state (the mode is experimental / content-gated).
   */
  private static readonly DATASETS: Record<string, string> = {
    nl: 'assets/flashcards/dutch-builder.json',
    fr: 'assets/flashcards/french-builder.json',
  };

  /** Display names for the languages the Builder has a dataset for. */
  private static readonly LANG_NAMES: Record<string, string> = { nl: 'Dutch', fr: 'French' };

  /** The language this Builder session is running in (drives audio + storage). */
  private langCode = 'nl';

  // ── Header language flag (only languages with a Builder dataset) ───────────
  availableLanguages: { code: string; name: string; flagUrl: string }[] = Object.keys(BuilderPage.DATASETS)
    .map(code => ({ code, name: BuilderPage.LANG_NAMES[code] ?? code.toUpperCase(), flagUrl: this.flagUrl(code) }));

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
  /** Switch the Builder's language, persist it, and reload its dataset. */
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

  /**
   * Header "⋮" menu: a problem report (Report / Cancel), tagged with a FIXED
   * ENGLISH screen name so GitHub issues stay consistent across app languages.
   */
  async openMenu(): Promise<void> {
    const sheet = await this.actionSheet.create({
      cssClass: 'mode-menu-sheet',   // shared tightened icon↔label gap
      buttons: [
        {
          text: this.i18n.t('feedback.report'),
          icon: 'flag-outline',
          handler: () => {
            void this.addWordService.reportProblem({
              languageCode: this.langCode,
              modeName: 'Builder',
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

  /** Completed group/phrase ids. */
  private completed = new Set<string>();

  /** For a phrase stage: the shuffled word bank to pick from. */
  bank: string[] = [];

  /**
   * True briefly when the user fills every slot but the ORDER is wrong — drives
   * a red shake on the chosen slots, prompting them to remove a word (tap it)
   * or Reset and try again. Cleared on a timer / on any edit.
   */
  wrongOrder = false;
  /** Short-lived: drives the shake animation (re-armed on each wrong attempt)
   *  without clearing the persistent `wrongOrder` red state. */
  shaking = false;
  private wrongTimer: ReturnType<typeof setTimeout> | null = null;

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  async ngOnInit(): Promise<void> {
    await this.setup();
  }

  /**
   * Ionic keeps page instances cached in the router outlet and REUSES them on
   * re-entry, so `ngOnInit` runs only once per instance. Re-running setup on
   * every view-enter means a reused instance (e.g. a journey node re-opened
   * after failing to generate phrases) always re-initialises instead of being
   * stuck on whatever stale/blank state it was left in.
   */
  async ionViewWillEnter(): Promise<void> {
    // Claim hardware/gesture back while the Builder is on screen.
    this.backInterceptor.register(this.onHardwareBack);
    // ngOnInit already ran setup for a fresh instance; only re-run on reuse.
    if (this.didSetup) await this.setup();
  }

  private didSetup = false;

  private async setup(): Promise<void> {
    this.didSetup = true;
    this.isLoading = true;
    this.journeyMode = false;
    this.stage = { kind: 'map' };
    this.cdr.detectChanges();

    // Journey Builder node: generate phrases from a skill's words (+ earlier)
    // and play straight through them — no dataset/map.
    if (this.route.snapshot.queryParamMap.get('mode') === 'journey-builder') {
      await this.startJourneyBuilder();
      return;
    }
    // Standalone Builder: use the selected language's dataset, else the first
    // language the Builder supports (so it's never just "unavailable").
    const appLang = this.settings.learningLanguage();
    this.langCode = BuilderPage.DATASETS[appLang] ? appLang : Object.keys(BuilderPage.DATASETS)[0];
    await this.loadDataset();
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  /**
   * Set up the Journey Builder node: gather the chapter skill's cards (+ all
   * earlier skills for review), generate simple phrases via the phrase-builder,
   * and start the first one. If none can be generated (no nouns to anchor), the
   * node auto-passes so the chapter isn't blocked.
   */
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
    // Earlier words to combine with: the explicit `pool` levels when the
    // caller provides them (the Tree's fixed-slot layout, where "earlier deck
    // levels" aren't earlier lessons), else every level before this one.
    const earlierLevels = this.poolLevels(level) ?? Array.from({ length: Math.max(0, level - 1) }, (_v, i) => i + 1);
    const earlier: { text: string; translations: string[] }[] = [];
    for (const n of earlierLevels) {
      for (const c of this.flashcards.getLevelCards(deckId, n)) earlier.push(toSrc(c));
    }

    if (this.flashcards.isTreeDeckId(deckId)) {
      // Tree: authored nouns with articles + Core chunks → the v2 generator
      // (real phrases like "un professeur et un élève"). A random seed varies
      // the phrases between sessions.
      const tokens = buildTreeTokens(current, earlier);
      this.journeyPhrases = generatePhrases(tokens, 5, 'fr', { engine: 'v2', seed: 1 + Math.floor(Math.random() * 1e6) });
      this.journeyWordPool = [];
    } else {
      const tokens = buildTokens(current, earlier);
      this.journeyPhrases = generatePhrases(tokens, 5);
      // Pool of every single-word token in the chapter, for bank distractors.
      this.journeyWordPool = tokens.map(t => t.text).filter(w => w && !/\s/.test(w));
    }

    if (this.journeyPhrases.length === 0) {
      // Nothing to build (no noun to anchor a phrase, or the level had no
      // usable cards) — auto-pass so the chapter is never blocked, and leave
      // loading on so the user sees the spinner (not a blank frame) during the
      // brief async gap before the navigation swaps the page out.
      this.isLoading = true;
      this.cdr.detectChanges();
      await this.flashcards.saveRoundProgress(deckId, 'journey-builder', level, 100);
      this.navCtrl.navigateBack(this.journeyBack);
      return;
    }

    this.journeyIndex = 0;
    this.isLoading = false;
    this.openJourneyPhrase();
  }

  /**
   * Levels named by the `pool` query param ("1,2,21"), excluding this level;
   * null when absent/empty so the caller falls back to 1..level-1.
   */
  private poolLevels(level: number): number[] | null {
    const raw = this.route.snapshot.queryParamMap.get('pool');
    if (!raw) return null;
    const levels = [...new Set(raw.split(',').map(s => Number(s.trim())))]
      .filter(n => Number.isInteger(n) && n > 0 && n !== level);
    return levels.length ? levels : null;
  }

  /** Load the current generated phrase into the phrase stage. */
  private openJourneyPhrase(): void {
    const p = this.journeyPhrases[this.journeyIndex];
    const phrase: BuilderPhrase = {
      id: `journey-${this.journeyIndex}`, unlockAfter: [],
      target: p.target, en: p.en, tokens: p.tokens,
    };
    this.clearWrong();
    // v2 phrases bring their own distractors (chosen so they never form a
    // second correct answer); legacy phrases draw from the chapter's words.
    this.bank = this.buildBank(phrase.tokens, p.distractors ?? this.journeyWordPool);
    this.stage = { kind: 'phrase', phrase, chosen: [], done: false };
    this.cdr.detectChanges();
  }

  /**
   * Build the word bank for a phrase: the exact tokens needed PLUS a few
   * distractor words drawn from `pool` (words not in the phrase), so the puzzle
   * isn't trivially "just use every chip". Shuffled. Adds up to a third extra
   * (min 2, max 4) when enough distractors exist.
   */
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

  /** Advance to the next generated phrase, or finish the node. */
  async journeyNext(): Promise<void> {
    this.journeyIndex++;
    if (this.journeyIndex < this.journeyPhrases.length) {
      this.openJourneyPhrase();
      return;
    }
    // All phrases done → pass the node and return to the map.
    await this.flashcards.saveRoundProgress(this.journeyDeckId, 'journey-builder', this.journeyLevel, 100);
    this.navCtrl.navigateBack(this.journeyBack);
  }

  /** (Re)load the Builder dataset + progress for the current `langCode`. */
  private async loadDataset(): Promise<void> {
    this.loadProgress();
    const url = BuilderPage.DATASETS[this.langCode];
    if (!url) { this.data = null; return; }
    try {
      this.data = await firstValueFrom(this.http.get<BuilderData>(url));
    } catch {
      this.data = null;
    }
  }

  // ── Progress ──────────────────────────────────────────────────────────────
  /** Progress is kept per language so French/Dutch don't clobber each other. */
  private get storeKey(): string { return `boosted-builder-progress-${this.langCode}`; }

  private loadProgress(): void {
    try {
      const raw = localStorage.getItem(this.storeKey);
      this.completed = raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { this.completed = new Set(); }
  }
  private saveProgress(): void {
    try {
      localStorage.setItem(this.storeKey, JSON.stringify([...this.completed]));
    } catch { /* ignore */ }
  }

  isDone(id: string): boolean { return this.completed.has(id); }

  /** A phrase unlocks once all its prerequisite groups are done. */
  isPhraseUnlocked(p: BuilderPhrase): boolean {
    return p.unlockAfter.every(g => this.completed.has(g));
  }

  get groups(): BuilderGroup[] {
    return [...(this.data?.groups ?? [])].sort((a, b) => a.order - b.order);
  }
  get phrases(): BuilderPhrase[] { return this.data?.phrases ?? []; }

  // ── Group learning (flip through the words) ─────────────────────────────────
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
      // Group finished.
      this.completed.add(this.stage.group.id);
      this.saveProgress();
      this.stage = { kind: 'map' };
    }
    this.cdr.detectChanges();
  }

  playWord(text: string): void {
    void this.audio.playWord(text, undefined, this.langCode);
  }

  // ── Phrase building (tap words in order) ────────────────────────────────────
  openPhrase(phrase: BuilderPhrase): void {
    if (!this.isPhraseUnlocked(phrase)) return;
    this.clearWrong();
    // Pool of every single-word surface form in the dataset, for bank distractors.
    const pool = (this.data?.groups ?? [])
      .flatMap(g => g.words.map(w => w.text))
      .filter(w => w && !/\s/.test(w));
    this.bank = this.buildBank(phrase.tokens, pool);
    this.stage = { kind: 'phrase', phrase, chosen: [], done: false };
    this.cdr.detectChanges();
  }

  pick(token: string): void {
    if (this.stage.kind !== 'phrase' || this.stage.done) return;

    // Accept ANY word in ANY order — the user is allowed to make mistakes, then
    // fix them by tapping a chosen word to remove it (or Reset). Validation
    // happens only once the phrase is full (below). (The older version rejected
    // out-of-order taps, which made the remove/reset actions pointless and let
    // the user "spam" words until the right ones stuck — confusing feedback.)
    this.clearWrong();
    const chosen = [...this.stage.chosen, token];
    this.bank = this.removeFirst(this.bank, token);

    const full = chosen.length === this.stage.phrase.tokens.length;
    const correct = full && this.stage.phrase.tokens.every((t, i) => t === chosen[i]);

    this.stage = { ...this.stage, chosen, done: correct };

    if (correct) {
      this.completed.add(this.stage.phrase.id);
      this.saveProgress();
      void this.audio.playWord(this.stage.phrase.target, undefined, this.langCode);
    } else if (full) {
      // Full but wrong order: mark it wrong and KEEP it (red chips + message)
      // until the user edits — removes/reorders a word (unpick / drop) or Reset.
      // A short-lived `shaking` flag replays just the shake animation on each
      // new wrong attempt without clearing the persistent red state.
      this.wrongOrder = true;
      this.shaking = true;
      if (this.wrongTimer) clearTimeout(this.wrongTimer);
      this.wrongTimer = setTimeout(() => {
        this.shaking = false;
        this.wrongTimer = null;
        this.cdr.detectChanges();
      }, 450);
    }
    this.cdr.detectChanges();
  }

  /** Remove a chosen word (tap-to-undo) and return it to the bank. */
  unpick(index: number): void {
    if (this.stage.kind !== 'phrase' || this.stage.done) return;
    // A drag that ends on the SAME chip fires a click too — ignore it so a
    // reorder gesture doesn't also remove the word.
    if (this.justDragged) { this.justDragged = false; return; }
    if (index < 0 || index >= this.stage.chosen.length) return;
    const chosen = [...this.stage.chosen];
    const [removed] = chosen.splice(index, 1);
    this.bank = [...this.bank, removed];
    this.clearWrong();
    this.stage = { ...this.stage, chosen, done: false };
    this.cdr.detectChanges();
  }

  // ── Pointer-based drag-to-reorder (touch-friendly, with a live-moving chip) ──
  // HTML5 drag events show no moving "ghost" on touch, so we track the pointer
  // ourselves: the dragged chip follows the finger (CSS transform), and we
  // reorder as it crosses another chip's centre.
  /** Index of the chip being dragged, or null. Drives the `.dragging` style. */
  dragIndex: number | null = null;
  /** Live transform applied to the dragged chip so it follows the finger. */
  dragTransform: string | null = null;
  /** True briefly after a drag so the trailing click doesn't also unpick. */
  private justDragged = false;

  private dragStartX = 0;
  private dragStartY = 0;
  private dragActive = false;        // movement passed the start threshold
  private readonly DRAG_THRESHOLD = 6; // px before a press becomes a drag
  private moveHandler?: (e: PointerEvent) => void;
  private upHandler?: (e: PointerEvent) => void;

  onPointerDown(index: number, ev: PointerEvent): void {
    if (this.stage.kind !== 'phrase' || this.stage.done) return;
    if (ev.button !== undefined && ev.button !== 0) return; // left/primary only
    this.dragIndex = index;
    this.dragActive = false;
    this.dragStartX = ev.clientX;
    this.dragStartY = ev.clientY;
    this.dragTransform = null;

    this.moveHandler = (e: PointerEvent) => this.onPointerMove(e);
    this.upHandler = (e: PointerEvent) => this.onPointerUp(e);
    window.addEventListener('pointermove', this.moveHandler, { passive: false });
    window.addEventListener('pointerup', this.upHandler);
    window.addEventListener('pointercancel', this.upHandler);
  }

  private onPointerMove(ev: PointerEvent): void {
    if (this.dragIndex === null || this.stage.kind !== 'phrase') return;
    const dx = ev.clientX - this.dragStartX;
    const dy = ev.clientY - this.dragStartY;

    if (!this.dragActive) {
      if (Math.hypot(dx, dy) < this.DRAG_THRESHOLD) return; // still a tap
      this.dragActive = true;
    }
    ev.preventDefault();
    // The chip follows the finger.
    this.dragTransform = `translate(${dx}px, ${dy}px) scale(1.06)`;

    // Reorder when the pointer is over a different chip's centre.
    const target = this.chipIndexAtPoint(ev.clientX, ev.clientY);
    if (target !== null && target !== this.dragIndex) {
      const chosen = [...this.stage.chosen];
      const [moved] = chosen.splice(this.dragIndex, 1);
      chosen.splice(target, 0, moved);
      this.stage = { ...this.stage, chosen, done: false };
      this.dragIndex = target;
      this.dragStartX = ev.clientX; // re-anchor so the transform stays small
      this.dragStartY = ev.clientY;
      this.dragTransform = 'scale(1.06)';
    }
    this.cdr.detectChanges();
  }

  private onPointerUp(_ev: PointerEvent): void {
    window.removeEventListener('pointermove', this.moveHandler!);
    window.removeEventListener('pointerup', this.upHandler!);
    window.removeEventListener('pointercancel', this.upHandler!);
    this.moveHandler = undefined;
    this.upHandler = undefined;

    const wasDrag = this.dragActive;
    this.dragIndex = null;
    this.dragActive = false;
    this.dragTransform = null;

    if (!wasDrag || this.stage.kind !== 'phrase') { this.cdr.detectChanges(); return; }

    // A real drag happened: suppress the trailing click (unpick) and validate
    // the new order.
    this.justDragged = true;
    this.clearWrong();
    const chosen = this.stage.chosen;
    const correct =
      chosen.length === this.stage.phrase.tokens.length &&
      this.stage.phrase.tokens.every((t, i) => t === chosen[i]);
    this.stage = { ...this.stage, done: correct };
    if (correct) {
      this.completed.add(this.stage.phrase.id);
      this.saveProgress();
      void this.audio.playWord(this.stage.phrase.target, undefined, this.langCode);
    }
    this.cdr.detectChanges();
  }

  /**
   * The drop index for the pointer among the chosen chips. First try a direct
   * hit (pointer inside a chip). Otherwise fall back to the NEAREST chip by
   * centre distance so dragging into the gaps — or past the last chip toward
   * the empty placeholder — still reorders (previously this returned null, so
   * you could never drag a word to a LATER position / to the end).
   */
  private chipIndexAtPoint(x: number, y: number): number | null {
    const row = this.slotsRow?.nativeElement;
    if (!row) return null;
    const chips = Array.from(row.querySelectorAll<HTMLElement>('.slot:not(.empty)'));
    if (!chips.length) return null;
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < chips.length; i++) {
      const r = chips[i].getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = Math.hypot(x - cx, y - cy);
      if (d < best) { best = d; nearest = i; }
    }
    return nearest;
  }

  private clearWrong(): void {
    if (this.wrongTimer) { clearTimeout(this.wrongTimer); this.wrongTimer = null; }
    this.wrongOrder = false;
    this.shaking = false;
  }

  backToMap(): void {
    this.stage = { kind: 'map' };
    this.cdr.detectChanges();
  }

  /** Header X: confirm if mid-activity, else leave. `leave()` handles the
   *  journey-vs-standalone destination. */
  close(): void {
    void this.exitConfirm.request(this.hasProgress, () => this.leave());
  }

  /** "n / total" progress label for the Journey Builder node. */
  get journeyPosition(): string {
    return `${this.journeyIndex + 1} / ${this.journeyPhrases.length}`;
  }

  private shuffle<T>(a: T[]): T[] {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  private removeFirst(arr: string[], v: string): string[] {
    const i = arr.indexOf(v);
    if (i < 0) return arr;
    return [...arr.slice(0, i), ...arr.slice(i + 1)];
  }
}
