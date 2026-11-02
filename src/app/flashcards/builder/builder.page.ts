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
   * Token the user just tapped in the wrong order. Drives a brief red "shake"
   * on that bank word so a wrong pick gives feedback instead of silently
   * getting the phrase stuck. Cleared on a timer / the next correct pick.
   */
  wrongToken: string | null = null;
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
    this.bank = this.shuffle([...phrase.tokens]);
    this.stage = { kind: 'phrase', phrase, chosen: [], done: false };
    this.cdr.detectChanges();
  }

  pick(token: string): void {
    if (this.stage.kind !== 'phrase' || this.stage.done) return;

    // Only accept the word if it is the correct NEXT token. A wrong pick used
    // to be appended silently, which gave no feedback and left the phrase
    // permanently un-completable (stuck). Now a wrong pick is rejected with a
    // brief visual flash and the word stays in the bank.
    const expected = this.stage.phrase.tokens[this.stage.chosen.length];
    if (token !== expected) {
      this.flashWrong(token);
      return;
    }

    this.clearWrong();
    const chosen = [...this.stage.chosen, token];
    this.bank = this.removeFirst(this.bank, token);
    const done = chosen.length === this.stage.phrase.tokens.length;
    this.stage = { ...this.stage, chosen, done };
    if (done) {
      this.completed.add(this.stage.phrase.id);
      this.saveProgress();
      void this.audio.playWord(this.stage.phrase.target, undefined, this.langCode);
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

  private flashWrong(token: string): void {
    this.wrongToken = token;
    if (this.wrongTimer) clearTimeout(this.wrongTimer);
    this.wrongTimer = setTimeout(() => {
      this.wrongToken = null;
      this.wrongTimer = null;
      this.cdr.detectChanges();
    }, 600);
    this.cdr.detectChanges();
  }
  private clearWrong(): void {
    if (this.wrongTimer) { clearTimeout(this.wrongTimer); this.wrongTimer = null; }
    this.wrongToken = null;
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
