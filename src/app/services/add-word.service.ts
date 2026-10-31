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
  /** Practice mode name (e.g. 'Quiz'), included in a problem report. */
  modeName?: string;
  /** The expected/correct answer for the current word (for a report). */
  correctAnswer?: string | null;
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

  /** Where problem reports are delivered (same address as the card export). */
  private readonly FEEDBACK_EMAIL = 'wizard.night@gmail.com';

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

    // Report a problem with the current word/exercise.
    buttons.push({
      text: t('feedback.report'),
      icon: 'flag-outline',
      handler: () => { this.reportProblem(opts, lang); },
    });

    buttons.push({ text: t('common.cancel'), icon: 'close-outline', role: 'cancel' });

    const sheet = await this.actionSheet.create({ buttons, cssClass: 'mode-menu-sheet' });
    await sheet.present();
  }

  /**
   * Show a short "report a problem" form (checkbox reasons + optional note) and
   * deliver the report to the developer by composing a mailto: — the same
   * channel used by the custom-card export. The current word, mode, language
   * and expected answer are attached so a report is actionable.
   */
  async reportProblem(opts: ModeMenuOptions = {}, langCode?: string): Promise<void> {
    const t = (k: string, p?: Record<string, string | number>) => this.i18n.t(k, p);
    const lang = langCode ?? opts.languageCode ?? this.settings.learningLanguage();

    const reasons: { value: string; labelKey: string }[] = [
      { value: 'translationWrong', labelKey: 'feedback.reason.translationWrong' },
      { value: 'answerShouldCount', labelKey: 'feedback.reason.answerShouldCount' },
      { value: 'audioWrong', labelKey: 'feedback.reason.audioWrong' },
      { value: 'audioMissing', labelKey: 'feedback.reason.audioMissing' },
      { value: 'optionsConfusing', labelKey: 'feedback.reason.optionsConfusing' },
      { value: 'other', labelKey: 'feedback.reason.other' },
    ];

    const alert = await this.alertCtrl.create({
      header: t('feedback.report'),
      message: opts.currentWord
        ? t('feedback.aboutWord', { word: opts.currentWord })
        : t('feedback.intro'),
      inputs: reasons.map(r => ({
        type: 'checkbox' as const,
        label: t(r.labelKey),
        value: r.value,
      })),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        {
          text: t('feedback.submit'),
          handler: (checked: string[]) => {
            this.sendReport(checked, opts, lang);
          },
        },
      ],
    });
    await alert.present();
  }

  /** Compose and open the problem report as an email to the developer. */
  private sendReport(checkedReasons: string[], opts: ModeMenuOptions, lang: string): void {
    const t = (k: string, p?: Record<string, string | number>) => this.i18n.t(k, p);

    // Ionic passes the checked checkbox VALUES as the handler argument.
    const reasonLabels = (checkedReasons ?? []).map(v => t(`feedback.reason.${v}`)).join('; ');

    const subject = `Boostionary feedback: ${opts.currentWord ?? '(no word)'}`;
    const bodyLines = [
      t('feedback.report'),
      '',
      `Word: ${opts.currentWord ?? '-'}`,
      `Expected answer: ${opts.correctAnswer ?? '-'}`,
      `Mode: ${opts.modeName ?? '-'}`,
      `Learning language: ${this.langName(lang)} (${lang})`,
      `Base language: ${this.langName(this.settings.baseLanguage())}`,
      '',
      `Reasons: ${reasonLabels || '-'}`,
      '',
      '---',
      '(Add any extra detail above this line.)',
    ];

    const mailto =
      `mailto:${this.FEEDBACK_EMAIL}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(bodyLines.join('\n'))}`;

    window.location.href = mailto;
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
    // learned, and its translation in the learner's base/origin language
    // (chosen when the study language was added).
    const targetName = this.langName(lang);
    const baseName = this.langName(this.settings.baseLanguage());
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
