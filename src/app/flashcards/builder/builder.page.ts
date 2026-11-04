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

import { Component, OnInit, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { ActionSheetController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { I18nAngularService } from '../../services/i18n.service';
import { AudioService } from '../../services/audio.service';
import { SettingsService } from '../../services/settings.service';
import { AddWordService } from '../../services/add-word.service';
import { FlashcardService } from '../../services/flashcard.service';
import { buildTokens, generatePhrases, type GeneratedPhrase } from '../../../core/phrase-builder/phrase-builder';

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
export class BuilderPage implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private i18n = inject(I18nAngularService);
  private audio = inject(AudioService);
  private settings = inject(SettingsService);
  private addWordService = inject(AddWordService);
  private flashcards = inject(FlashcardService);
  private actionSheet = inject(ActionSheetController);
  private cdr = inject(ChangeDetectorRef);

  // ── Journey Builder node: generated phrases from a skill's words ───────────
  /** True when opened as a Journey node (?mode=journey-builder&level=N). */
  journeyMode = false;
  private journeyDeckId = '';
  private journeyLevel = 0;
  /** The generated phrases to play through, and our position in them. */
  private journeyPhrases: GeneratedPhrase[] = [];
  private journeyIndex = 0;

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
    const earlier: { text: string; translations: string[] }[] = [];
    for (let n = 1; n < level; n++) {
      for (const c of this.flashcards.getLevelCards(deckId, n)) earlier.push(toSrc(c));
    }
    const tokens = buildTokens(current, earlier);
    this.journeyPhrases = generatePhrases(tokens, 5);

    if (this.journeyPhrases.length === 0) {
      // Nothing to build — auto-pass so the chapter can continue.
      await this.flashcards.saveRoundProgress(deckId, 'journey-builder', level, 100);
      this.router.navigate(['/practice/journey'], { replaceUrl: true });
      return;
    }

    this.journeyIndex = 0;
    this.isLoading = false;
    this.openJourneyPhrase();
  }

  /** Load the current generated phrase into the phrase stage. */
  private openJourneyPhrase(): void {
    const p = this.journeyPhrases[this.journeyIndex];
    const phrase: BuilderPhrase = {
      id: `journey-${this.journeyIndex}`, unlockAfter: [],
      target: p.target, en: p.en, tokens: p.tokens,
    };
    this.clearWrong();
    this.bank = this.shuffle([...phrase.tokens]);
    this.stage = { kind: 'phrase', phrase, chosen: [], done: false };
    this.cdr.detectChanges();
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
    this.router.navigate(['/practice/journey'], { replaceUrl: true });
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
    this.bank = this.shuffle([...phrase.tokens]);
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

  // ── Drag-to-reorder the chosen chips ────────────────────────────────────────
  /** Index of the chip being dragged, or null. Drives the `.dragging` style. */
  dragIndex: number | null = null;
  /** True briefly after a drag so the trailing click doesn't also unpick. */
  private justDragged = false;

  onDragStart(index: number, ev: DragEvent): void {
    if (this.stage.kind !== 'phrase' || this.stage.done) return;
    this.dragIndex = index;
    // Firefox needs data set for a drag to start.
    ev.dataTransfer?.setData('text/plain', String(index));
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
  }

  onDragOver(index: number, ev: DragEvent): void {
    // Allow dropping (default is to reject).
    if (this.dragIndex === null) return;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
  }

  onDrop(targetIndex: number, ev: DragEvent): void {
    ev.preventDefault();
    if (this.stage.kind !== 'phrase' || this.dragIndex === null) return;
    const from = this.dragIndex;
    if (from === targetIndex) { this.dragIndex = null; return; }

    const chosen = [...this.stage.chosen];
    const [moved] = chosen.splice(from, 1);
    chosen.splice(targetIndex, 0, moved);
    this.justDragged = true;
    this.dragIndex = null;
    // Reordering is an edit: clear the wrong-order state and re-validate.
    this.clearWrong();

    // If the new order completes the phrase correctly, accept it.
    const correct =
      chosen.length === this.stage.phrase.tokens.length &&
      this.stage.phrase.tokens.every((t, i) => t === chosen[i]);
    this.stage = { ...this.stage, chosen, done: correct };
    if (correct) {
      this.completed.add(this.stage.phrase.id);
      this.saveProgress();
      void this.audio.playWord(this.stage.phrase.target, undefined, this.langCode);
    }
    this.cdr.detectChanges();
  }

  onDragEnd(): void {
    this.dragIndex = null;
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

  close(): void {
    // As a Journey node, the X returns to the map; standalone goes home.
    this.router.navigate([this.journeyMode ? '/practice/journey' : '/home']);
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
