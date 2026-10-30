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
import { AlertController, ToastController } from '@ionic/angular';
import { FlashcardService } from './flashcard.service';
import { SettingsService } from './settings.service';
import { I18nAngularService } from './i18n.service';

@Injectable({
  providedIn: 'root',
})
export class AddWordService {
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private flashcards = inject(FlashcardService);
  private settings = inject(SettingsService);
  private i18n = inject(I18nAngularService);

  /**
   * Open a two-field prompt to add a word + translation(s) to the given
   * language (defaults to the currently selected learning language).
   * Returns true if a new card was added.
   */
  async promptAddWord(languageCode?: string): Promise<boolean> {
    const lang = languageCode ?? this.settings.learningLanguage();
    const t = (k: string, p?: Record<string, string | number>) => this.i18n.t(k, p);

    return new Promise<boolean>(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header: t('mode.addWord'),
        message: t('mode.addWordMsg'),
        inputs: [
          { name: 'word', type: 'text', placeholder: t('mode.wordLabel'), attributes: { autocapitalize: 'off' } },
          { name: 'translations', type: 'text', placeholder: t('mode.translationLabel') },
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
