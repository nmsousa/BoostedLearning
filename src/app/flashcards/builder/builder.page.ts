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
import { firstValueFrom } from 'rxjs';
import { I18nAngularService } from '../../services/i18n.service';
import { AudioService } from '../../services/audio.service';

interface BuilderWord { text: string; translations: string[]; article?: string; lemma?: string; }
interface BuilderGroup { id: string; category: string; name: string; order: number; words: BuilderWord[]; }
interface BuilderPhrase { id: string; unlockAfter: string[]; nl: string; en: string; tokens: string[]; }
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
  private cdr = inject(ChangeDetectorRef);

  private static readonly STORE_KEY = 'boosted-builder-progress-nl';

  data: BuilderData | null = null;
  isLoading = true;
  stage: Stage = { kind: 'map' };

  /** Completed group/phrase ids. */
  private completed = new Set<string>();

  /** For a phrase stage: the shuffled word bank to pick from. */
  bank: string[] = [];

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  async ngOnInit(): Promise<void> {
    this.loadProgress();
    try {
      const json = await firstValueFrom(
        this.http.get<BuilderData>('assets/flashcards/dutch-builder.json')
      );
      this.data = json;
    } catch {
      this.data = null;
    }
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  // ── Progress ──────────────────────────────────────────────────────────────
  private loadProgress(): void {
    try {
      const raw = localStorage.getItem(BuilderPage.STORE_KEY);
      if (raw) this.completed = new Set(JSON.parse(raw) as string[]);
    } catch { /* ignore */ }
  }
  private saveProgress(): void {
    try {
      localStorage.setItem(BuilderPage.STORE_KEY, JSON.stringify([...this.completed]));
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
    void this.audio.playWord(text, undefined, 'nl');
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
    const chosen = [...this.stage.chosen, token];
    this.bank = this.removeFirst(this.bank, token);
    const correctSoFar = this.stage.phrase.tokens
      .slice(0, chosen.length)
      .every((t, i) => t === chosen[i]);
    const done = chosen.length === this.stage.phrase.tokens.length && correctSoFar;
    this.stage = { ...this.stage, chosen, done };
    if (done) {
      this.completed.add(this.stage.phrase.id);
      this.saveProgress();
      void this.audio.playWord(this.stage.phrase.nl, undefined, 'nl');
    }
    this.cdr.detectChanges();
  }

  resetPhrase(): void {
    if (this.stage.kind !== 'phrase') return;
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
