/**
 * Journey Page (EXPERIMENTAL mode)
 *
 * A game-style map of the deck's levels: a "continue" hero for the current
 * level at the top, then the levels grouped into chapters, each drawn as a
 * winding colour-coded trail (CSS/SVG, no painted art). Tapping a level runs
 * the normal Write exercise, but scored under the independent `journey` mode
 * namespace so it doesn't affect the original modes.
 *
 * This sits ALONGSIDE the existing four modes; nothing here changes them.
 *
 * @module app/flashcards/journey
 */

import { Component, OnInit, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { ActionSheetController } from '@ionic/angular';
import { FlashcardService, FlashcardDeck, DeckLevel, PracticeMode } from '../../services/flashcard.service';
import { SettingsService } from '../../services/settings.service';
import { I18nAngularService } from '../../services/i18n.service';
import { AddWordService } from '../../services/add-word.service';

/** The five node types of a chapter, in play order. */
type NodeType = 'flip' | 'quiz' | 'match' | 'write' | 'builder';

/** One node (activity) within a chapter. */
interface JourneyNode {
  type: NodeType;
  /** The per-node progress mode ('journey-flip', …). */
  mode: PracticeMode;
  /** The exercise route to navigate to. */
  route: string;
  icon: string;
  color: string;
  passed: boolean;
  unlocked: boolean;
}

/** A chapter = ONE skill, played as five fixed single-pass nodes. */
interface Chapter {
  /** Chapter number (1-based), shown as a small badge. */
  number: number;
  /** Skill name (shown as the chapter title). */
  name: string;
  /** The skill's level number (the shared level index used by every node mode). */
  levelNumber: number;
  nodes: JourneyNode[];
  /** How many of the 5 nodes are passed. */
  done: number;
  /** True when the chapter is reachable (chapter 1, or prev chapter complete). */
  unlocked: boolean;
  /** True when all 5 nodes are passed. */
  complete: boolean;
}

@Component({
  selector: 'app-journey',
  templateUrl: './journey.page.html',
  styleUrls: ['./journey.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JourneyPage implements OnInit {
  private router = inject(Router);
  private flashcards = inject(FlashcardService);
  private settings = inject(SettingsService);
  private i18n = inject(I18nAngularService);
  private addWordService = inject(AddWordService);
  private actionSheet = inject(ActionSheetController);
  private cdr = inject(ChangeDetectorRef);

  // ── Header language flag (mirrors the homepage / mode-list selector) ───────
  availableLanguages: { code: string; name: string; flagUrl: string }[] = [];

  private flagUrl(code: string): string {
    const toCountry: Record<string, string> = {
      nl: 'nl', dn: 'nl', fr: 'fr', es: 'es', it: 'it', de: 'de', pt: 'pt',
      en: 'gb', da: 'dk', el: 'gr', ja: 'jp', ko: 'kr', zs: 'cn', uk: 'ua',
      nb: 'no', he: 'il', hi: 'in', vi: 'vn', cs: 'cz', sv: 'se', ga: 'ie',
      gd: 'gb', cy: 'gb', hw: 'us', ht: 'ht', zu: 'za', sw: 'ke',
    };
    return `https://flagcdn.com/${toCountry[code] ?? code}.svg`;
  }
  private refreshLanguages(): void {
    this.availableLanguages = this.flashcards
      .getAvailableLanguages()
      .map(l => ({ ...l, flagUrl: this.flagUrl(l.code) }));
  }
  get learningLanguage(): string { return this.settings.learningLanguage(); }
  get currentLanguage(): { code: string; name: string; flagUrl: string } {
    return (
      this.availableLanguages.find(l => l.code === this.learningLanguage) ??
      this.availableLanguages[0] ?? {
        code: this.learningLanguage,
        name: this.learningLanguage.toUpperCase(),
        flagUrl: this.flagUrl(this.learningLanguage),
      }
    );
  }
  async selectLanguage(code: string): Promise<void> {
    if (code === this.learningLanguage) return;
    this.settings.updateSetting('learningLanguage', code);
    this.isLoading = true;
    this.cdr.detectChanges();
    await this.flashcards.initialize();
    await this.load();
  }

  /**
   * Header "⋮" menu: just a problem report for now (Report / Cancel). The
   * report is tagged with a FIXED ENGLISH screen name so GitHub issues are
   * consistent regardless of the app's display language.
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
              languageCode: this.settings.learningLanguage(),
              modeName: 'Journey',
              reportContext: 'generic',
            });
          },
        },
        { text: this.i18n.t('common.cancel'), icon: 'close-outline', role: 'cancel' },
      ],
    });
    await sheet.present();
  }
  deck: FlashcardDeck | null = null;
  chapters: Chapter[] = [];
  /** Index of the chapter currently in progress (for auto-scroll on enter). */
  currentChapterIndex = 0;
  isLoading = true;

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  async ngOnInit(): Promise<void> {
    await this.flashcards.initialize();
    await this.load();
  }

  async ionViewWillEnter(): Promise<void> {
    // Recompute stars/unlock when returning from an exercise.
    if (!this.isLoading || this.deck) await this.load();
  }

  private async load(): Promise<void> {
    this.refreshLanguages();
    const lang = this.settings.learningLanguage();
    const decks = this.flashcards.getAllDecks().filter(d => d.languageCode === lang);
    this.deck = decks[0] ?? this.flashcards.getAllDecks()[0] ?? null;

    if (!this.deck) {
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    // One chapter per skill level. Node modes share this skill level index.
    const levels = await this.flashcards.getDeckLevels(this.deck.id, 'journey-flip');
    this.chapters = await this.buildChapters(this.deck.id, levels);
    // Current chapter = first not-yet-complete unlocked chapter.
    this.currentChapterIndex = Math.max(
      0,
      this.chapters.findIndex(c => c.unlocked && !c.complete),
    );
    this.isLoading = false;
    this.cdr.detectChanges();
    // Jump (smoothly) to the chapter being played once the view has painted.
    setTimeout(() => this.scrollToCurrentChapter(), 150);
  }

  /** Node definitions in play order (type → mode / route / icon / colour). */
  private static readonly NODE_DEFS: { type: NodeType; mode: PracticeMode; route: string; icon: string; color: string }[] = [
    { type: 'flip',    mode: 'journey-flip',    route: '/practice/flip',            icon: 'albums-outline',      color: 'primary' },
    { type: 'quiz',    mode: 'journey-quiz',    route: '/practice/quiz',            icon: 'help-circle-outline', color: 'success' },
    { type: 'match',   mode: 'journey-match',   route: '/practice/match',           icon: 'git-compare-outline', color: 'tertiary' },
    { type: 'write',   mode: 'journey-write',   route: '/practice/journey-play',    icon: 'create-outline',      color: 'secondary' },
    { type: 'builder', mode: 'journey-builder', route: '/practice/journey-builder', icon: 'construct-outline',   color: 'warning' },
  ];

  /**
   * Build one chapter per skill. Each chapter has the 5 fixed nodes; a node is
   * `passed` when its LevelProgress bestScore ≥ 70. Nodes unlock left→right
   * (node 1, else previous node passed). A chapter unlocks when the previous
   * chapter's 5 nodes are all passed (chapter 1 always unlocked).
   */
  private async buildChapters(deckId: string, levels: DeckLevel[]): Promise<Chapter[]> {
    const chapters: Chapter[] = [];
    let prevComplete = true; // chapter 1 is always reachable
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const chapterUnlocked = prevComplete;

      // Determine each node's passed state from its per-node progress.
      const passed: boolean[] = [];
      for (const def of JourneyPage.NODE_DEFS) {
        const p = await this.flashcards.getLevelProgress(deckId, def.mode, level.levelNumber);
        passed.push((p?.bestScore ?? 0) >= 70);
      }

      const nodes: JourneyNode[] = JourneyPage.NODE_DEFS.map((def, n) => ({
        type: def.type,
        mode: def.mode,
        route: def.route,
        icon: def.icon,
        color: def.color,
        passed: passed[n],
        // Unlocked if the chapter is reachable AND (first node or previous passed).
        unlocked: chapterUnlocked && (n === 0 || passed[n - 1]),
      }));

      const doneCount = passed.filter(Boolean).length;
      const complete = doneCount === JourneyPage.NODE_DEFS.length;
      chapters.push({
        number: i + 1,
        name: level.skill ?? this.t('practice.level', { n: level.levelNumber }),
        levelNumber: level.levelNumber,
        nodes,
        done: doneCount,
        unlocked: chapterUnlocked,
        complete,
      });
      prevComplete = complete;
    }
    return chapters;
  }

  /** Scroll the content so the chapter being played is in view on entry, with
   *  a custom EASE-OUT (fast at the start, slowing as it arrives). */
  private async scrollToCurrentChapter(): Promise<void> {
    if (this.currentChapterIndex <= 0) return;
    const el = document.getElementById(`journey-chapter-${this.currentChapterIndex}`);
    const content = document.querySelector('ion-content.journey-content') as HTMLIonContentElement | null;
    if (!el || !content) return;
    const scrollEl = await content.getScrollElement();
    const box = el.getBoundingClientRect();
    const from = scrollEl.scrollTop;
    const to = Math.max(0, Math.min(from + box.top - 90, scrollEl.scrollHeight - scrollEl.clientHeight));
    if (Math.abs(to - from) < 4) return;
    const duration = 650;
    const start = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const stepFn = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      scrollEl.scrollTop = from + (to - from) * ease(t);
      if (t < 1) requestAnimationFrame(stepFn);
    };
    requestAnimationFrame(stepFn);
  }

  /** Human label for a node's activity (for the a11y label / tooltip). */
  nodeLabel(type: NodeType): string {
    return this.t(`journey.node.${type}`);
  }

  /** Start a node: navigate to its exercise with the per-node mode + level. */
  startNode(chapter: Chapter, node: JourneyNode): void {
    if (!node.unlocked || !this.deck) return;
    this.router.navigate([node.route, this.deck.id], {
      queryParams: { level: chapter.levelNumber, mode: node.mode },
    });
  }

  close(): void {
    this.router.navigate(['/home']);
  }
}
