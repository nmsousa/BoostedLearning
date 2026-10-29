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

import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { SettingsService, Theme, TextSize, AudioSpeed, AppSettings, FlashcardDirection } from '../services/settings.service';
import { I18nAngularService } from '../services/i18n.service';
import { ExplanationLanguage } from '../../services/i18n';
import { FlashcardService, DuolingoResponse } from '../services/flashcard.service';
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

  // --- Vocabulary management (import / manual add / export) ---
  showImportModal = false;
  importJson = '';
  importDeckName = 'Duolingo Import';
  importError = '';

  showManualModal = false;
  manualText = '';
  manualTranslations = '';
  manualError = '';

  // --- Add a language from duome.eu ---
  showDuomeModal = false;
  duomeUrl = '';
  duomeLang = '';
  duomeName = '';
  duomeError = '';
  duomeBusy = false;

  private readonly EXPORT_EMAIL = 'wizard.night@gmail.com';

  // App version + build date for the About section (helps with debugging).
  readonly appVersion = BUILD_INFO.version;
  readonly buildDate = new Date(BUILD_INFO.buildDate).toLocaleString();

  // Settings accessors
  get theme() { return this.settingsService.theme(); }
  get textSize() { return this.settingsService.textSize(); }
  get audioSpeed() { return this.settingsService.audioSpeed(); }
  get reducedMotion() { return this.settingsService.reducedMotion(); }
  get explanationLanguage() { return this.settingsService.explanationLanguage(); }
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
    { value: 'pt', label: 'Português' },
    { value: 'fr', label: 'Français' },
    { value: 'en', label: 'English' },
  ];

  sessionLengthOptions: number[] = [5, 10, 15, 20, 30];
  dailyGoalOptions: number[] = [10, 15, 20, 30, 50];

  flashcardDirectionOptions: { value: FlashcardDirection; label: string }[] = [
    { value: 'target-only', label: 'Dutch only' },
    { value: 'mixed', label: 'Mixed (Dutch & English)' },
  ];

  goBack(): void {
    this.router.navigate(['/home']);
  }

  onThemeChange(event: CustomEvent): void {
    // The SettingsService applies the palette reactively via an effect.
    this.settingsService.updateSetting('theme', event.detail.value);
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

  onLanguageChange(event: CustomEvent): void {
    this.settingsService.updateSetting('explanationLanguage', event.detail.value);
    this.i18n.setLanguage(event.detail.value);
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
    this.showImportModal = true;
  }

  closeImportModal() {
    this.showImportModal = false;
  }

  // --- Add a language from duome.eu ---
  openDuomeModal() {
    this.duomeUrl = '';
    this.duomeLang = '';
    this.duomeName = '';
    this.duomeError = '';
    this.duomeBusy = false;
    this.showDuomeModal = true;
  }

  closeDuomeModal() {
    this.showDuomeModal = false;
  }

  async importFromDuome() {
    const url = this.duomeUrl.trim();
    const lang = this.duomeLang.trim().toLowerCase();
    const name = this.duomeName.trim();

    if (!/^https?:\/\/duome\.eu\/vocabulary\/.+\/skills\/?$/.test(url)) {
      this.duomeError = 'Enter a duome skills URL, e.g. https://duome.eu/vocabulary/en/it/skills';
      return;
    }
    if (!/^[a-z]{2}$/.test(lang)) {
      this.duomeError = 'Enter a 2-letter language code (e.g. it, de, es).';
      return;
    }
    if (!name) {
      this.duomeError = 'Enter a name for the language.';
      return;
    }

    this.duomeError = '';
    this.duomeBusy = true;
    try {
      const result = await this.flashcardService.importFromDuomeUrl(url, lang, name);
      this.closeDuomeModal();
      const alert = await this.alertController.create({
        header: 'Language added',
        message: `Imported ${result.imported} words across ${result.skills} skills for ${name}. Select it from the language menu on the home screen.`,
        buttons: ['OK'],
      });
      await alert.present();
    } catch (e) {
      this.duomeError = e instanceof Error ? e.message : 'Import failed. Check the URL and your connection.';
    } finally {
      this.duomeBusy = false;
    }
  }

  async importFromJson() {
    if (!this.importJson.trim()) {
      this.importError = 'Please paste the JSON data';
      return;
    }
    try {
      const data = JSON.parse(this.importJson) as DuolingoResponse;
      if (!data.learnedLexemes && !Array.isArray(data)) {
        this.importError = 'Invalid format. Expected Duolingo API response with learnedLexemes.';
        return;
      }
      const result = await this.flashcardService.importFromDuolingo(data, this.importDeckName, 'nl');
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
