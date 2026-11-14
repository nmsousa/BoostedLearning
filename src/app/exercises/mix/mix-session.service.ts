/**
 * MixSessionService — holds the state of an in-progress "Mix" session.
 *
 * Mix plays several activity types for ONE level in a row. Because each
 * activity is a separate page that navigates back when done, we keep the
 * session (deck, level, the ordered steps, and our position) in this singleton
 * so it survives the forward/back navigation between the Mix orchestrator and
 * each exercise.
 *
 * @module app/exercises/mix
 */
import { Injectable } from '@angular/core';
import type { PracticeMode } from '../../services/flashcard.service';

/** One planned step: which exercise route + the journey-mode it runs under. */
export interface MixStep {
  /** Short id for display/debug. */
  id: string;
  /** Exercise route to launch (e.g. '/practice/quiz'). */
  route: string;
  /** Progress namespace the exercise runs under (single-pass journey modes). */
  mode: PracticeMode;
  /** Icon for the step dots. */
  icon: string;
}

export interface MixSession {
  deckId: string;
  level: number;
  steps: MixStep[];
  /** Index of the NEXT step to play. */
  index: number;
}

@Injectable({ providedIn: 'root' })
export class MixSessionService {
  private session: MixSession | null = null;

  /** The activity recipe for Mix: builder, blanks, match, quiz, match-audio,
   *  and (added last, capped at one) a write. Blanks is only useful for
   *  languages with the sentence generator; the orchestrator may drop it. */
  private static readonly RECIPE: MixStep[] = [
    { id: 'quiz',        route: '/practice/quiz',            mode: 'journey-quiz',        icon: 'help' },
    { id: 'match',       route: '/practice/match',           mode: 'journey-match',       icon: 'git-compare-outline' },
    { id: 'match-audio', route: '/practice/match',           mode: 'journey-match-audio', icon: 'volume-high-outline' },
    { id: 'blanks',      route: '/practice/blanks',          mode: 'journey-blanks',      icon: 'reorder-four-outline' },
    { id: 'builder',     route: '/practice/journey-builder', mode: 'journey-builder',     icon: 'construct-outline' },
    // Exactly ONE write, last (it's the most effortful).
    { id: 'write',       route: '/practice/journey-play',    mode: 'journey-write',       icon: 'create-outline' },
  ];

  /** Start (or restart) a Mix session for a deck/level. `includeBlanks` drops
   *  the blanks step for languages without sentence support. */
  start(deckId: string, level: number, includeBlanks: boolean): MixSession {
    const steps = MixSessionService.RECIPE.filter(s => s.id !== 'blanks' || includeBlanks);
    this.session = { deckId, level, steps, index: 0 };
    return this.session;
  }

  /** The current session, or null if none is active. */
  current(): MixSession | null { return this.session; }

  /** True when a session exists for this exact deck+level. */
  matches(deckId: string, level: number): boolean {
    return !!this.session && this.session.deckId === deckId && this.session.level === level;
  }

  /** Advance to the next step. Returns the now-current step, or null if done. */
  advance(): MixStep | null {
    if (!this.session) return null;
    this.session.index++;
    return this.session.index < this.session.steps.length
      ? this.session.steps[this.session.index]
      : null;
  }

  /** The step at the current index (the one to play now), or null if finished. */
  currentStep(): MixStep | null {
    if (!this.session) return null;
    return this.session.index < this.session.steps.length
      ? this.session.steps[this.session.index]
      : null;
  }

  /** Clear the session (finished or abandoned). */
  clear(): void { this.session = null; }
}
