/**
 * Settings Angular Service
 * 
 * Manages user preferences for the app.
 * 
 * Requirements: 21.3, 21.4, 21.5, 21.6, 21.7, 21.10
 * 
 * @module app/services
 */

import { Injectable, signal, computed, effect } from '@angular/core';
import { ExplanationLanguage } from '../../services/i18n';

export type Theme = 'light' | 'dark' | 'system';
export type TextSize = 'small' | 'medium' | 'large';
export type AudioSpeed = 0.5 | 0.75 | 1.0 | 1.25;

/**
 * Flashcard typing direction:
 * - 'target-only': always type in the language being learned (default)
 * - 'mixed': mix of target-language and English prompts
 */
export type FlashcardDirection = 'target-only' | 'mixed';

export interface AppSettings {
  theme: Theme;
  textSize: TextSize;
  audioSpeed: AudioSpeed;
  reducedMotion: boolean;
  explanationLanguage: ExplanationLanguage;
  sessionLength: number; // minutes
  dailyGoal: number; // items
  notificationsEnabled: boolean;
  reducedDistraction: boolean; // hides non-essential gamification
  flashcardDirection: FlashcardDirection; // typing direction in flashcard study
  learningLanguage: string; // code of the language being learned, e.g. 'nl'
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  textSize: 'medium',
  audioSpeed: 1.0,
  reducedMotion: false,
  explanationLanguage: 'pt',
  sessionLength: 15,
  dailyGoal: 20,
  notificationsEnabled: false,
  reducedDistraction: false,
  flashcardDirection: 'target-only',
  learningLanguage: 'nl',
};

const STORAGE_KEY = 'boosted-learning-settings';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  // Use signals for reactive state
  private settingsSignal = signal<AppSettings>(this.loadSettings());

  // Computed values for individual settings
  readonly theme = computed(() => this.settingsSignal().theme);
  readonly textSize = computed(() => this.settingsSignal().textSize);
  readonly audioSpeed = computed(() => this.settingsSignal().audioSpeed);
  readonly reducedMotion = computed(() => this.settingsSignal().reducedMotion);
  readonly explanationLanguage = computed(() => this.settingsSignal().explanationLanguage);
  readonly sessionLength = computed(() => this.settingsSignal().sessionLength);
  readonly dailyGoal = computed(() => this.settingsSignal().dailyGoal);
  readonly notificationsEnabled = computed(() => this.settingsSignal().notificationsEnabled);
  readonly reducedDistraction = computed(() => this.settingsSignal().reducedDistraction);
  readonly flashcardDirection = computed(() => this.settingsSignal().flashcardDirection);
  readonly learningLanguage = computed(() => this.settingsSignal().learningLanguage);

  // Computed effective theme (resolves 'system')
  readonly effectiveTheme = computed<'light' | 'dark'>(() => {
    const theme = this.settingsSignal().theme;
    if (theme === 'system') {
      return this.getSystemTheme();
    }
    return theme;
  });

  constructor() {
    // Apply the dark/light palette to the DOM whenever the effective theme
    // changes (covers initial load, user changes, and system changes while
    // on 'system'). Keeps theming logic in one place.
    effect(() => {
      this.applyThemeToDom(this.effectiveTheme());
    });

    // Apply text size, reduced-motion, and reduced-distraction to the DOM root
    // so they take effect app-wide and persist across reloads.
    effect(() => {
      this.applyAccessibilityToDom(
        this.settingsSignal().textSize,
        this.settingsSignal().reducedMotion,
        this.settingsSignal().reducedDistraction
      );
    });

    // Listen for system theme changes
    if (typeof window !== 'undefined' && window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        // Trigger recompute if using system theme
        if (this.settingsSignal().theme === 'system') {
          this.settingsSignal.update(s => ({ ...s }));
        }
      });

      // Listen for reduced motion preference
      window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
        if (e.matches && !this.settingsSignal().reducedMotion) {
          this.updateSetting('reducedMotion', true);
        }
      });
    }
  }

  /**
   * Toggle the Ionic dark palette class on the document root.
   * `dark.class.css` activates dark mode when `.ion-palette-dark` is present.
   */
  private applyThemeToDom(effectiveTheme: 'light' | 'dark'): void {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('ion-palette-dark', effectiveTheme === 'dark');
  }

  /**
   * Apply accessibility/comfort settings to the document root:
   * - `--text-scale` CSS variable scales the app's base font size.
   * - `.reduced-motion` gates animations/transitions (see global.scss).
   * - `.reduced-distraction` hides non-essential gamification (see global.scss
   *   and per-component checks).
   */
  private applyAccessibilityToDom(
    textSize: TextSize,
    reducedMotion: boolean,
    reducedDistraction: boolean
  ): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    const scales: Record<TextSize, number> = { small: 0.9, medium: 1, large: 1.15 };
    root.style.setProperty('--text-scale', scales[textSize].toString());

    root.classList.toggle('reduced-motion', reducedMotion);
    root.classList.toggle('reduced-distraction', reducedDistraction);
  }

  /**
   * Get all current settings
   */
  getSettings(): AppSettings {
    return this.settingsSignal();
  }

  /**
   * Update a single setting
   */
  updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.settingsSignal.update(current => {
      const updated = { ...current, [key]: value };
      this.saveSettings(updated);
      return updated;
    });
  }

  /**
   * Update multiple settings at once
   */
  updateSettings(partial: Partial<AppSettings>): void {
    this.settingsSignal.update(current => {
      const updated = { ...current, ...partial };
      this.saveSettings(updated);
      return updated;
    });
  }

  /**
   * Reset all settings to defaults
   */
  resetSettings(): void {
    this.settingsSignal.set({ ...DEFAULT_SETTINGS });
    this.saveSettings(DEFAULT_SETTINGS);
  }

  /**
   * Get CSS class for current text size
   */
  getTextSizeClass(): string {
    const size = this.settingsSignal().textSize;
    return `text-size-${size}`;
  }

  /**
   * Get CSS custom properties for text size
   */
  getTextSizeStyles(): { [key: string]: string } {
    const size = this.settingsSignal().textSize;
    const scales: Record<TextSize, number> = {
      small: 0.875,
      medium: 1,
      large: 1.25,
    };
    return {
      '--text-scale': scales[size].toString(),
    };
  }

  private loadSettings(): AppSettings {
    if (typeof localStorage === 'undefined') {
      return { ...DEFAULT_SETTINGS };
    }
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      // Ignore parse errors
    }
    
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(settings: AppSettings): void {
    if (typeof localStorage === 'undefined') return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage errors
    }
  }

  private getSystemTheme(): 'light' | 'dark' {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return 'light';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
