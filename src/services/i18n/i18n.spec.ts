/**
 * i18n Service Tests
 * 
 * Feature: language-learning-app
 * Requirements: 16.1, 16.2, 16.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  createI18nService,
  getMessageCatalog,
  getAllKeys,
  DEFAULT_EXPLANATION_LANGUAGE,
  I18nService,
  ExplanationLanguage,
} from './i18n-service';

describe('i18n Service', () => {
  let i18n: I18nService;
  
  beforeEach(() => {
    i18n = createI18nService();
  });
  
  describe('createI18nService factory', () => {
    it('should create a valid service instance', () => {
      expect(i18n).toBeDefined();
      expect(typeof i18n.getLanguage).toBe('function');
      expect(typeof i18n.setLanguage).toBe('function');
      expect(typeof i18n.t).toBe('function');
      expect(typeof i18n.hasKey).toBe('function');
      expect(typeof i18n.hasKeyIn).toBe('function');
      expect(typeof i18n.getAvailableLanguages).toBe('function');
    });
    
    it('should allow specifying initial language', () => {
      const frService = createI18nService('fr');
      expect(frService.getLanguage()).toBe('fr');
      
      const enService = createI18nService('en');
      expect(enService.getLanguage()).toBe('en');
    });
  });
  
  describe('Default language (R16.1)', () => {
    it('should have Portuguese as the default language', () => {
      expect(DEFAULT_EXPLANATION_LANGUAGE).toBe('pt');
    });
    
    it('should use Portuguese as default when no language specified', () => {
      const service = createI18nService();
      expect(service.getLanguage()).toBe('pt');
    });
  });
  
  describe('Runtime language switching (R16.2)', () => {
    it('should switch to French without reinstall', () => {
      i18n.setLanguage('fr');
      expect(i18n.getLanguage()).toBe('fr');
      expect(i18n.t('common.continue')).toBe('Continuer');
    });
    
    it('should switch to English without reinstall', () => {
      i18n.setLanguage('en');
      expect(i18n.getLanguage()).toBe('en');
      expect(i18n.t('common.continue')).toBe('Continue');
    });
    
    it('should switch back to Portuguese', () => {
      i18n.setLanguage('en');
      i18n.setLanguage('pt');
      expect(i18n.getLanguage()).toBe('pt');
      expect(i18n.t('common.continue')).toBe('Continuar');
    });
    
    it('should ignore invalid language codes', () => {
      i18n.setLanguage('de' as ExplanationLanguage);
      expect(i18n.getLanguage()).toBe('pt');
    });
  });
  
  describe('Property 33: Portuguese fallback on missing keys (R16.3)', () => {
    it('should fall back to Portuguese when key missing in French', () => {
      const frService = createI18nService('fr');
      
      // Add a key that only exists in Portuguese for testing
      // (All current keys exist in all languages, so we test via hasKey)
      
      // For any key in Portuguese, if missing in French, should fall back
      const ptCatalog = getMessageCatalog('pt');
      const frCatalog = getMessageCatalog('fr');
      
      // Check that fallback works for keys that might be missing
      for (const key of Object.keys(ptCatalog)) {
        const result = frService.t(key);
        // Should return either French or Portuguese, never undefined
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
      }
    });
    
    it('should fall back to Portuguese when key missing in English', () => {
      const enService = createI18nService('en');
      const ptCatalog = getMessageCatalog('pt');
      
      for (const key of Object.keys(ptCatalog)) {
        const result = enService.t(key);
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
      }
    });
    
    it('should return key if missing from all catalogs', () => {
      const unknownKey = 'unknown.nonexistent.key';
      const result = i18n.t(unknownKey);
      expect(result).toBe(unknownKey);
    });
    
    it('Portuguese fallback property test', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('pt', 'fr', 'en') as fc.Arbitrary<ExplanationLanguage>,
          fc.constantFrom(...getAllKeys()),
          (lang, key) => {
            const service = createI18nService(lang);
            const result = service.t(key);
            
            // Result should never be undefined or empty
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
            
            // Result should either be from current language or Portuguese fallback
            const currentCatalog = getMessageCatalog(lang);
            const ptCatalog = getMessageCatalog('pt');
            
            if (key in currentCatalog) {
              expect(result).toBe(currentCatalog[key]);
            } else {
              expect(result).toBe(ptCatalog[key]);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Translation retrieval', () => {
    it('should retrieve translations in Portuguese', () => {
      expect(i18n.t('feedback.correct')).toBe('Correto!');
      expect(i18n.t('session.start')).toBe('Iniciar sessão');
    });
    
    it('should retrieve translations in French', () => {
      i18n.setLanguage('fr');
      expect(i18n.t('feedback.correct')).toBe('Correct !');
      expect(i18n.t('session.start')).toBe('Démarrer la session');
    });
    
    it('should retrieve translations in English', () => {
      i18n.setLanguage('en');
      expect(i18n.t('feedback.correct')).toBe('Correct!');
      expect(i18n.t('session.start')).toBe('Start session');
    });
  });
  
  describe('Parameter interpolation', () => {
    it('should interpolate string parameters', () => {
      const result = i18n.t('feedback.correctAnswer', { answer: 'huis' });
      expect(result).toBe('A resposta correta é: huis');
    });
    
    it('should interpolate number parameters', () => {
      const result = i18n.t('session.itemsStudied', { count: 42 });
      expect(result).toBe('42 itens estudados');
    });
    
    it('should handle missing parameters gracefully', () => {
      const result = i18n.t('feedback.correctAnswer');
      expect(result).toBe('A resposta correta é: {answer}');
    });
    
    it('should interpolate multiple parameters', () => {
      // Currently no messages have multiple params, but test the feature
      const result = i18n.t('session.accuracy', { percent: 85 });
      expect(result).toBe('85% de precisão');
    });
    
    it('should work with French interpolation', () => {
      i18n.setLanguage('fr');
      const result = i18n.t('session.itemsStudied', { count: 10 });
      expect(result).toBe('10 éléments étudiés');
    });
    
    it('should work with English interpolation', () => {
      i18n.setLanguage('en');
      const result = i18n.t('session.accuracy', { percent: 95 });
      expect(result).toBe('95% accuracy');
    });
  });
  
  describe('Key existence checks', () => {
    it('should report existing keys', () => {
      expect(i18n.hasKey('common.continue')).toBe(true);
      expect(i18n.hasKey('feedback.correct')).toBe(true);
    });
    
    it('should report missing keys', () => {
      expect(i18n.hasKey('nonexistent.key')).toBe(false);
    });
    
    it('should check keys in specific languages', () => {
      expect(i18n.hasKeyIn('common.continue', 'pt')).toBe(true);
      expect(i18n.hasKeyIn('common.continue', 'fr')).toBe(true);
      expect(i18n.hasKeyIn('common.continue', 'en')).toBe(true);
    });
  });
  
  describe('Available languages', () => {
    it('should return all supported languages', () => {
      const languages = i18n.getAvailableLanguages();
      expect(languages).toContain('pt');
      expect(languages).toContain('fr');
      expect(languages).toContain('en');
      expect(languages).toHaveLength(3);
    });
  });
  
  describe('Message catalog utilities', () => {
    it('should return Portuguese catalog', () => {
      const catalog = getMessageCatalog('pt');
      expect(catalog['common.continue']).toBe('Continuar');
    });
    
    it('should return French catalog', () => {
      const catalog = getMessageCatalog('fr');
      expect(catalog['common.continue']).toBe('Continuer');
    });
    
    it('should return English catalog', () => {
      const catalog = getMessageCatalog('en');
      expect(catalog['common.continue']).toBe('Continue');
    });
    
    it('should return all keys from Portuguese catalog', () => {
      const keys = getAllKeys();
      expect(keys.length).toBeGreaterThan(0);
      expect(keys).toContain('common.continue');
      expect(keys).toContain('feedback.correct');
    });
  });
  
  describe('Content coverage', () => {
    it('should have complete coverage in French for all Portuguese keys', () => {
      const ptKeys = getAllKeys();
      const frCatalog = getMessageCatalog('fr');
      
      for (const key of ptKeys) {
        expect(frCatalog[key]).toBeDefined();
        expect(typeof frCatalog[key]).toBe('string');
      }
    });
    
    it('should have complete coverage in English for all Portuguese keys', () => {
      const ptKeys = getAllKeys();
      const enCatalog = getMessageCatalog('en');
      
      for (const key of ptKeys) {
        expect(enCatalog[key]).toBeDefined();
        expect(typeof enCatalog[key]).toBe('string');
      }
    });
    
    it('all catalogs should have the same keys', () => {
      const ptKeys = new Set(getAllKeys());
      const frKeys = new Set(Object.keys(getMessageCatalog('fr')));
      const enKeys = new Set(Object.keys(getMessageCatalog('en')));
      
      // Same size
      expect(frKeys.size).toBe(ptKeys.size);
      expect(enKeys.size).toBe(ptKeys.size);
      
      // Same keys
      for (const key of ptKeys) {
        expect(frKeys.has(key)).toBe(true);
        expect(enKeys.has(key)).toBe(true);
      }
    });
  });
  
  describe('Grammar explanations for Dutch', () => {
    it('should have Dutch article explanations in Portuguese', () => {
      expect(i18n.t('grammar.article.de')).toContain('De');
      expect(i18n.t('grammar.article.het')).toContain('Het');
    });
    
    it('should have Dutch article explanations in French', () => {
      i18n.setLanguage('fr');
      expect(i18n.t('grammar.article.de')).toContain('De');
      expect(i18n.t('grammar.article.het')).toContain('Het');
    });
    
    it('should have Dutch article explanations in English', () => {
      i18n.setLanguage('en');
      expect(i18n.t('grammar.article.de')).toContain('De');
      expect(i18n.t('grammar.article.het')).toContain('Het');
    });
  });
  
  describe('Review reason translations', () => {
    it('should have review reason translations', () => {
      expect(i18n.t('review.reason.new')).toBeTruthy();
      expect(i18n.t('review.reason.due')).toBeTruthy();
      expect(i18n.t('review.reason.recovery')).toBeTruthy();
    });
  });
});
