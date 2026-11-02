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
import { Router } from '@angular/router';
import { ActionSheetController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { I18nAngularService } from '../../services/i18n.service';
import { AudioService } from '../../services/audio.service';
import { SettingsService } from '../../services/settings.service';
import { AddWordService } from '../../services/add-word.service';

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
  private i18n = inject(I18nAngularService);
  private audio = inject(AudioService);
  private settings = inject(SettingsService);
  private addWordService = inject(AddWordService);
  private actionSheet = inject(ActionSheetController);
  private cdr = inject(ChangeDetectorRef);

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
  private wrongTimer: ReturnType<typeof setTimeout> | null = null;

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  async ngOnInit(): Promise<void> {
    // If the selected app language has a Builder dataset use it; otherwise fall
    // back to the first language the Builder does support, so the mode is never
    // just "unavailable" when opened from a language without content.
    const appLang = this.settings.learningLanguage();
    this.langCode = BuilderPage.DATASETS[appLang] ? appLang : Object.keys(BuilderPage.DATASETS)[0];
    await this.loadDataset();
    this.isLoading = false;
    this.cdr.detectChanges();
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
      // Full but wrong order: flag it so the slots flash, prompting the user to
      // tap a word to remove it (or Reset) and try a different order.
      this.wrongOrder = true;
      if (this.wrongTimer) clearTimeout(this.wrongTimer);
      this.wrongTimer = setTimeout(() => {
        this.wrongOrder = false;
        this.wrongTimer = null;
        this.cdr.detectChanges();
      }, 800);
    }
    this.cdr.detectChanges();
  }

  /** Remove a chosen word (tap-to-undo) and return it to the bank. */
  unpick(index: number): void {
    if (this.stage.kind !== 'phrase' || this.stage.done) return;
    if (index < 0 || index >= this.stage.chosen.length) return;
    const chosen = [...this.stage.chosen];
    const [removed] = chosen.splice(index, 1);
    this.bank = [...this.bank, removed];
    this.clearWrong();
    this.stage = { ...this.stage, chosen, done: false };
    this.cdr.detectChanges();
  }

  private clearWrong(): void {
    if (this.wrongTimer) { clearTimeout(this.wrongTimer); this.wrongTimer = null; }
    this.wrongOrder = false;
  }

  resetPhrase(): void {
    if (this.stage.kind !== 'phrase') return;
    this.clearWrong();
    this.bank = this.shuffle([...this.stage.phrase.tokens]);
    this.stage = { ...this.stage, chosen: [], done: false };
    this.cdr.detectChanges();
  }

  backToMap(): void {
    this.stage = { kind: 'map' };
    this.cdr.detectChanges();
  }

  close(): void {
    this.router.navigate(['/home']);
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
