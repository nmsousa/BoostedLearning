/**
 * i18n Angular Service
 * 
 * Provides localization through Angular DI.
 * 
 * @module app/services
 */

import { Injectable } from '@angular/core';
import {
  createI18nService,
  I18nService,
  ExplanationLanguage,
  DEFAULT_EXPLANATION_LANGUAGE,
} from '../../services/i18n';

@Injectable({
  providedIn: 'root',
})
export class I18nAngularService {
  private i18n: I18nService;

  constructor() {
    this.i18n = createI18nService();
  }

  /**
   * Get current language
   */
  getLanguage(): ExplanationLanguage {
    return this.i18n.getLanguage();
  }

  /**
   * Set language
   */
  setLanguage(lang: ExplanationLanguage): void {
    this.i18n.setLanguage(lang);
  }

  /**
   * Translate a key
   */
  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  /**
   * Check if a key exists
   */
  hasKey(key: string): boolean {
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
