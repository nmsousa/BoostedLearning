/**
 * i18n Angular Service
 * 
 * Provides localization through Angular DI.
 * 
 * @module app/services
 */

import { Injectable, inject, computed } from '@angular/core';
import {
  createI18nService,
  I18nService,
  ExplanationLanguage,
  DEFAULT_EXPLANATION_LANGUAGE,
} from '../../services/i18n';
import { SettingsService } from './settings.service';

@Injectable({
  providedIn: 'root',
})
export class I18nAngularService {
  private i18n: I18nService;
  private settings = inject(SettingsService);

  /**
   * The active UI language, driven solely by the app-language setting.
   * Exposed as a computed signal so every `t()` call reads it and therefore
   * participates in change detection: when the setting changes, all bound
   * `t(...)` expressions re-evaluate in the same tick.
   */
  readonly lang = computed<ExplanationLanguage>(() => this.settings.appLanguage());

  constructor() {
    this.i18n = createI18nService();
  }

  /**
   * Get current language
   */
  getLanguage(): ExplanationLanguage {
    return this.lang();
  }

  /**
   * Set language. Kept for API compatibility; the real source of truth is the
   * app-language setting, so this just updates that setting.
   */
  setLanguage(lang: ExplanationLanguage): void {
    this.settings.updateSetting('appLanguage', lang);
  }

  /**
   * Translate a key. Reads the `lang` signal first so the current language is
   * always in sync with the setting and so the call is reactive.
   */
  t(key: string, params?: Record<string, string | number>): string {
    const lang = this.lang();
    this.i18n.setLanguage(lang);
    return this.i18n.t(key, params);
  }

  /**
   * Check if a key exists
   */
  hasKey(key: string): boolean {
    this.i18n.setLanguage(this.lang());
    return this.i18n.hasKey(key);
  }

  /**
   * Get available languages
   */
  getAvailableLanguages(): ExplanationLanguage[] {
    return this.i18n.getAvailableLanguages();
  }

  /**
   * Get default language
   */
  getDefaultLanguage(): ExplanationLanguage {
    return DEFAULT_EXPLANATION_LANGUAGE;
  }
}
