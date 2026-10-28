/**
 * i18n (Internationalization) Module
 * 
 * Provides localization for explanations and UI text.
 * Supports Portuguese (default), French, and English with Portuguese fallback.
 * 
 * @module services/i18n
 */

export {
  createI18nService,
  getMessageCatalog,
  getAllKeys,
  DEFAULT_EXPLANATION_LANGUAGE,
  type I18nService,
  type ExplanationLanguage,
  type MessageCatalog,
} from './i18n-service';
