/**
 * Settings Page
 * 
 * Light/dark themes, text-size control, audio-speed control, reduced-motion,
 * keyboard navigation, accessibility controls.
 * 
 * Requirements: 21.3, 21.4, 21.5, 21.6, 21.7, 21.10, 21.11
 * 
 * @module app/settings
 */

import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { SettingsService, Theme, ColorTheme, AppLanguage, TextSize, AudioSpeed, AppSettings, FlashcardDirection } from '../services/settings.service';
import { I18nAngularService } from '../services/i18n.service';
import { ExplanationLanguage } from '../../services/i18n';
import { FlashcardService, DuolingoResponse, DuolingoLexeme } from '../services/flashcard.service';
import { DUOME_COURSES } from '../services/duome-courses';
import { BUILD_INFO } from '../../build-info';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false,
})
export class SettingsPage {
  private router = inject(Router);
  private alertController = inject(AlertController);
  private settingsService = inject(SettingsService);
  private i18n = inject(I18nAngularService);
  private flashcardService = inject(FlashcardService);
  private cdr = inject(ChangeDetectorRef);

  // --- Vocabulary management (import / manual add / export) ---
  showImportModal = false;
  importJson = '';
  importDeckName = 'Duolingo Import';
  importLanguage = 'nl';
  importError = '';

  /** Languages offered in the import picker (built from the duome course list). */
  importLanguageOptions = DUOME_COURSES.map(c => ({ code: c.code, name: c.name }));

  showManualModal = false;
  manualText = '';
  manualTranslations = '';
  manualError = '';

  // --- Add a language from duome.eu ---
  showDuomeModal = false;
  readonly duomeCourses = DUOME_COURSES;
  duomeTarget = '';   // selected target language code (from dropdown)
  duomeUrl = '';      // auto-built, editable
  duomeError = '';
  duomeBusy = false;

  private readonly EXPORT_EMAIL = 'wizard.night@gmail.com';

  // App version + build date for the About section (helps with debugging).
  readonly appVersion = BUILD_INFO.version;
  readonly buildDate = new Date(BUILD_INFO.buildDate).toLocaleString();

  // Settings accessors
  get theme() { return this.settingsService.theme(); }
  get colorTheme() { return this.settingsService.colorTheme(); }
  get textSize() { return this.settingsService.textSize(); }
  get audioSpeed() { return this.settingsService.audioSpeed(); }
  get reducedMotion() { return this.settingsService.reducedMotion(); }
  get explanationLanguage() { return this.settingsService.explanationLanguage(); }
  get appLanguage() { return this.settingsService.appLanguage(); }
  get sessionLength() { return this.settingsService.sessionLength(); }
  get dailyGoal() { return this.settingsService.dailyGoal(); }
  get notificationsEnabled() { return this.settingsService.notificationsEnabled(); }
  get reducedDistraction() { return this.settingsService.reducedDistraction(); }
  get flashcardDirection() { return this.settingsService.flashcardDirection(); }

  // Options
  themeOptions: { value: Theme; label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  colorThemeOptions: { value: ColorTheme; label: string }[] = [
    { value: 'ocean', label: 'Ocean (dark navy)' },
    { value: 'slate', label: 'Slate (dark grey)' },
    { value: 'forest', label: 'Forest (dark green)' },
    { value: 'default', label: 'Midnight (dark black)' },
    { value: 'light', label: 'Light' },
  ];

  textSizeOptions: { value: TextSize; label: string }[] = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
  ];

  audioSpeedOptions: { value: AudioSpeed; label: string }[] = [
    { value: 0.5, label: '0.5x (Slow)' },
    { value: 0.75, label: '0.75x' },
    { value: 1.0, label: '1.0x (Normal)' },
    { value: 1.25, label: '1.25x (Fast)' },
  ];

  languageOptions: { value: ExplanationLanguage; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'pt', label: 'Português' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
  ];

  appLanguageOptions: { value: AppLanguage; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'pt', label: 'Português' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
  ];

  sessionLengthOptions: number[] = [5, 10, 15, 20, 30];
  dailyGoalOptions: number[] = [10, 15, 20, 30, 50];

  flashcardDirectionOptions: { value: FlashcardDirection; label: string }[] = [
    // Short labels so the selected value fits the settings row.
    { value: 'target-only', label: 'Learning only' },
    { value: 'mixed', label: 'Mixed' },
  ];

  goBack(): void {
    this.router.navigate(['/home']);
  }

  onThemeChange(event: CustomEvent): void {
    // The SettingsService applies the palette reactively via an effect.
    this.settingsService.updateSetting('theme', event.detail.value);
  }

  onColorThemeChange(event: CustomEvent): void {
    this.settingsService.updateSetting('colorTheme', event.detail.value as ColorTheme);
  }

  onTextSizeChange(event: CustomEvent): void {
    this.settingsService.updateSetting('textSize', event.detail.value);
  }

  onAudioSpeedChange(event: CustomEvent): void {
    this.settingsService.updateSetting('audioSpeed', event.detail.value);
  }

  onReducedMotionChange(event: CustomEvent): void {
    this.settingsService.updateSetting('reducedMotion', event.detail.checked);
  }

  onAppLanguageChange(event: CustomEvent): void {
    // Keep both the app UI language and the explanation language in sync.
    // appLanguage is the single source of truth the i18n service reads from.
    this.settingsService.updateSetting('appLanguage', event.detail.value as AppLanguage);
    this.settingsService.updateSetting('explanationLanguage', event.detail.value);
  }

  onSessionLengthChange(event: CustomEvent): void {
    this.settingsService.updateSetting('sessionLength', event.detail.value);
  }

  onDailyGoalChange(event: CustomEvent): void {
    this.settingsService.updateSetting('dailyGoal', event.detail.value);
  }

  onNotificationsChange(event: CustomEvent): void {
    this.settingsService.updateSetting('notificationsEnabled', event.detail.checked);
  }

  onReducedDistractionChange(event: CustomEvent): void {
    this.settingsService.updateSetting('reducedDistraction', event.detail.checked);
  }

  onFlashcardDirectionChange(event: CustomEvent): void {
    this.settingsService.updateSetting('flashcardDirection', event.detail.value);
  }

  // ============================================
  // Vocabulary management
  // ============================================

  get customCardCount(): number {
    return this.flashcardService.getCustomCards().length;
  }

  // --- Import from Duolingo ---
  openImportModal() {
    this.importJson = '';
    this.importError = '';
    // Default to the language the user is currently learning, so the imported
    // deck shows up for that language.
    this.importLanguage = this.settingsService.learningLanguage();
    this.showImportModal = true;
  }

  onImportLanguageChange(event: CustomEvent) {
    this.importLanguage = event.detail.value;
  }

  closeImportModal() {
    this.showImportModal = false;
  }

  // --- Add a language from duome.eu ---
  openDuomeModal() {
    this.duomeTarget = '';
    this.duomeUrl = '';
    this.duomeError = '';
    this.duomeBusy = false;
    this.showDuomeModal = true;
  }

  closeDuomeModal() {
    this.showDuomeModal = false;
  }

  /** When a course is picked from the dropdown, build the skills URL. */
  onDuomeCourseChange() {
    const course = this.duomeCourses.find(c => c.code === this.duomeTarget);
    if (course) {
      this.duomeUrl = `https://duome.eu/vocabulary/${course.base}/${course.code}/skills`;
    }
  }

  async importFromDuome() {
    const url = this.duomeUrl.trim();
    const target = this.duomeTarget.trim().toLowerCase();

    if (!target) {
      this.duomeError = 'Pick a language to learn.';
      return;
    }
    if (!/^https?:\/\/duome\.eu\/vocabulary\/.+\/skills\/?$/.test(url)) {
      this.duomeError = 'The URL looks wrong. It should be like https://duome.eu/vocabulary/en/it/skills';
      return;
    }

    // In a web browser, cross-origin requests to duome are blocked by CORS, so
    // the import only works in the installed app. Warn instead of hanging.
    if (!Capacitor.isNativePlatform()) {
      this.duomeError =
        'Importing a language only works in the installed app (the browser blocks the download). Please try it on your phone.';
      return;
    }

    this.duomeError = '';
    this.duomeBusy = true;
    try {
      // The language name is deduced from the page automatically. Guard with a
      // timeout so a stuck request fails with a clear message.
      const result = await this.withTimeout(
        this.flashcardService.importFromDuomeUrl(url, target),
        30000
      );
      // Switch to the newly-imported language so it shows immediately.
      this.settingsService.updateSetting('learningLanguage', target);
      this.closeDuomeModal();
      const alert = await this.alertController.create({
        header: 'Language added',
        message: `Imported ${result.imported} words across ${result.skills} skills for ${result.name}. It's now your selected language.`,
        buttons: ['OK'],
      });
      await alert.present();
    } catch (e) {
      this.duomeError =
        e instanceof Error ? e.message : 'Import failed. Check the codes and your connection.';
    } finally {
      this.duomeBusy = false;
      this.cdr.detectChanges();
    }
  }

  /** Reject if a promise doesn't settle within `ms`. */
  private withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Timed out. Check your connection and try again.')), ms)
      ),
    ]);
  }

  async importFromJson() {
    if (!this.importJson.trim()) {
      this.importError = 'Please paste the JSON data';
      return;
    }
    try {
      // Accept one OR several pasted "learned-lexemes" responses (Duolingo
      // paginates ~50 words per request). Merge all their lexemes.
      const lexemes = this.parseLearnedLexemes(this.importJson);
      if (lexemes.length === 0) {
        this.importError = 'Invalid format. Expected Duolingo "learned-lexemes" response(s) with a learnedLexemes list.';
        return;
      }
      const result = await this.flashcardService.importFromDuolingo(
        lexemes,
        this.importDeckName,
        this.importLanguage
      );
      this.closeImportModal();
      const alert = await this.alertController.create({
        header: 'Import Complete',
        message: `Imported ${result.imported} cards${result.duplicates > 0 ? ` (${result.duplicates} duplicates skipped)` : ''}.`,
        buttons: ['OK'],
      });
      await alert.present();
    } catch (e) {
      this.importError = 'Invalid JSON. Please check the format and try again.';
      console.error('Import error:', e);
    }
  }

  /**
   * Parse the pasted text into a flat list of lexemes. Accepts:
   *  - a single Duolingo response object with `learnedLexemes`,
   *  - a bare array of lexemes,
   *  - OR several of the above pasted one after another (Duolingo paginates
   *    ~50 words per "learned-lexemes" request, so users collect multiple).
   * Multiple top-level JSON values are split and parsed individually.
   */
  private parseLearnedLexemes(raw: string): DuolingoLexeme[] {
    const text = raw.trim();
    const out: DuolingoLexeme[] = [];

    const collect = (parsed: unknown) => {
      if (Array.isArray(parsed)) {
        out.push(...(parsed as DuolingoLexeme[]));
      } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as DuolingoResponse).learnedLexemes)) {
        out.push(...(parsed as DuolingoResponse).learnedLexemes);
      }
    };

    // Fast path: the whole paste is one valid JSON value.
    try {
      collect(JSON.parse(text));
      if (out.length > 0) return out;
    } catch {
      // Fall through to multi-block parsing.
    }

    // Multi-block: split on the boundary between a closing and the next opening
    // brace/bracket ("}{", "}[", "][", "]{"), tolerating whitespace/commas.
    const blocks = text
      .replace(/}\s*,?\s*{/g, '}\u0000{')
      .replace(/]\s*,?\s*\[/g, ']\u0000[')
      .replace(/}\s*,?\s*\[/g, '}\u0000[')
      .replace(/]\s*,?\s*{/g, ']\u0000{')
      .split('\u0000');

    for (const block of blocks) {
      const b = block.trim();
      if (!b) continue;
      try {
        collect(JSON.parse(b));
      } catch {
        // Skip unparseable fragments; other blocks may still be valid.
      }
    }

    return out;
  }

  // --- Add a card manually ---
  openManualModal() {
    this.manualText = '';
    this.manualTranslations = '';
    this.manualError = '';
    this.showManualModal = true;
  }

  closeManualModal() {
    this.showManualModal = false;
  }

  async saveManualCard() {
    const text = this.manualText.trim();
    const translations = this.manualTranslations
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (!text) {
      this.manualError = 'Please enter the word.';
      return;
    }
    if (translations.length === 0) {
      this.manualError = 'Please enter at least one translation.';
      return;
    }

    const result = await this.flashcardService.addManualCard(text, translations);
    if (!result) {
      this.manualError = 'Could not create the card. Check your input.';
      return;
    }
    if (result.isDuplicate) {
      this.manualError = `"${text}" already exists in your cards.`;
      return;
    }

    this.closeManualModal();
    const alert = await this.alertController.create({
      header: 'Card Added',
      message: `"${text}" was added to your custom cards.`,
      buttons: ['OK'],
    });
    await alert.present();
  }

  // --- Export custom cards ---
  async exportCustomCards() {
    const result = this.flashcardService.exportCustomCards();
    if (!result) {
      const alert = await this.alertController.create({
        header: 'Nothing to Export',
        message: 'You have not added any custom cards yet.',
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }

    const subject = `BoostedLearning - ${result.count} custom card(s)`;
    const body = `Here are my custom flashcards to add in a future version:\n\n${result.json}`;

    const alert = await this.alertController.create({
      header: 'Export Custom Cards',
      message: `You have ${result.count} custom card(s). Send them by email or copy the data.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Copy', handler: () => { this.copyToClipboard(result.json); } },
        { text: 'Email', handler: () => { this.openEmail(subject, body); } },
      ],
    });
    await alert.present();
  }

  private openEmail(subject: string, body: string) {
    const mailto =
      `mailto:${this.EXPORT_EMAIL}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }

  private async copyToClipboard(text: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      const alert = await this.alertController.create({
        header: 'Copied',
        message: `Card data copied. Paste it in an email to ${this.EXPORT_EMAIL}.`,
        buttons: ['OK'],
      });
      await alert.present();
    } catch {
      const alert = await this.alertController.create({
        header: 'Copy Failed',
        message: 'Could not copy automatically. Please use the Email option.',
        buttons: ['OK'],
      });
      await alert.present();
    }
  }

  async resetSettings(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Reset Settings',
      message: 'Are you sure you want to reset all settings to defaults?',
      buttons: [
        {
          text: this.t('common.cancel'),
          role: 'cancel',
        },
        {
          text: 'Reset',
          role: 'destructive',
          handler: () => {
            // Resetting the setting triggers the service's theme effect.
            this.settingsService.resetSettings();
          },
        },
      ],
    });
    
    await alert.present();
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
