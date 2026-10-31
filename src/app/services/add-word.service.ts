/**
 * Add Word Service
 *
 * Shows a small localized prompt (word + translations) and adds a custom card
 * to the given language's deck. Shared by the practice mode pages so the user
 * can add vocabulary without going into Settings.
 *
 * @module app/services
 */

import { Injectable, inject } from '@angular/core';
import { ActionSheetController, AlertController, ToastController } from '@ionic/angular';
import { FlashcardService } from './flashcard.service';
import { SettingsService } from './settings.service';
import { I18nAngularService } from './i18n.service';

/** Options for the practice-page header menu. */
export interface ModeMenuOptions {
  /** Target language code for adding words. */
  languageCode?: string;
  /** The word currently shown, enabling the "hide this word" action. */
  currentWord?: string | null;
  /** Called after the current word was hidden (e.g. to advance the card). */
  onHidden?: () => void;
}

@Injectable({
  providedIn: 'root',
})
export class AddWordService {
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private actionSheet = inject(ActionSheetController);
  private flashcards = inject(FlashcardService);
  private settings = inject(SettingsService);
  private i18n = inject(I18nAngularService);

  /**
   * Base/origin language for translations. Fixed to English for now; this will
   * become a user-selectable setting (see TODO: source/origin language).
   */
  private readonly BASE_LANGUAGE = 'en';

  /** Localized display name of a language code, falling back to the code. */
  private langName(code: string): string {
    const key = `langName.${code}`;
    const name = this.i18n.t(key);
    return name === key ? code.toUpperCase() : name;
  }

  /**
   * Open the practice-page header menu (the 3-dots / "+" action): add a word,
   * and — when a current word is provided — hide that word from future
   * practice.
   */
  async openModeMenu(opts: ModeMenuOptions = {}): Promise<void> {
    const lang = opts.languageCode ?? this.settings.learningLanguage();
    const t = (k: string, p?: Record<string, string | number>) => this.i18n.t(k, p);

    const buttons: any[] = [
      {
        text: t('mode.addWord'),
        icon: 'add-circle-outline',
        handler: () => { this.promptAddWord(lang); },
      },
    ];

    if (opts.currentWord) {
      buttons.push({
        text: t('mode.hideThisWord'),
        icon: 'eye-off-outline',
        role: 'destructive',
        handler: async () => {
          await this.flashcards.setWordPriority(opts.currentWord as string, 'hide', lang);
          await this.toast(t('mode.hiddenToast'));
          opts.onHidden?.();
        },
      });
    }

    buttons.push({ text: t('common.cancel'), role: 'cancel' });

    const sheet = await this.actionSheet.create({ buttons });
    await sheet.present();
  }

  /**
   * Open a two-field prompt to add a word + translation(s) to the given
   * language (defaults to the currently selected learning language).
   * Returns true if a new card was added.
   */
  async promptAddWord(languageCode?: string): Promise<boolean> {
    const lang = languageCode ?? this.settings.learningLanguage();
    const t = (k: string, p?: Record<string, string | number>) => this.i18n.t(k, p);

    // Field labels name the actual languages: the word in the language being
    // learned, and its translation in the base language (English for now —
    // the base language will become user-selectable, see TODO).
    const targetName = this.langName(lang);
    const baseName = this.langName(this.BASE_LANGUAGE);
    const wordPlaceholder = t('mode.wordInLang', { lang: targetName });
    const translationPlaceholder = t('mode.wordInLang', { lang: baseName });

    return new Promise<boolean>(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header: t('mode.addWord'),
        message: t('mode.addWordMsg'),
        inputs: [
          { name: 'word', type: 'text', placeholder: wordPlaceholder, attributes: { autocapitalize: 'off' } },
          { name: 'translations', type: 'text', placeholder: translationPlaceholder },
        ],
        buttons: [
          { text: t('common.cancel'), role: 'cancel', handler: () => resolve(false) },
          {
            text: t('mode.add'),
            handler: async (data: { word: string; translations: string }) => {
              const added = await this.add(data.word, data.translations, lang);
              resolve(added);
              return true;
            },
          },
        ],
      });
      await alert.present();
    });
  }

  private async add(word: string, translationsRaw: string, lang: string): Promise<boolean> {
    const text = (word ?? '').trim();
    const translations = (translationsRaw ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (!text || translations.length === 0) {
      await this.toast(this.i18n.t('mode.addFailedToast'));
      return false;
    }

    const result = await this.flashcards.addManualCard(text, translations, lang);
    if (!result) {
      await this.toast(this.i18n.t('mode.addFailedToast'));
      return false;
    }
    if (result.isDuplicate) {
      await this.toast(this.i18n.t('mode.duplicateToast'));
      return false;
    }

    await this.toast(this.i18n.t('mode.addedToast'));
    return true;
  }

  private async toast(message: string): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 2200, position: 'bottom' });
    await t.present();
  }
}
