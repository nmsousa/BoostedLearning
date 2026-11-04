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
import { AlertController, ToastController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { SettingsService, Theme, ColorTheme, AppLanguage, TextSize, AudioSpeed, AppSettings, FlashcardDirection } from '../services/settings.service';
import { I18nAngularService } from '../services/i18n.service';
import { FlashcardService, DuolingoResponse, DuolingoLexeme } from '../services/flashcard.service';
import { AppUpdateService } from '../services/app-update.service';
import { DUOME_COURSES } from '../services/duome-courses';
import { changelogFor } from '../services/changelog';
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
  private toast = inject(ToastController);
  private settingsService = inject(SettingsService);
  private i18n = inject(I18nAngularService);
  private flashcardService = inject(FlashcardService);
  private appUpdate = inject(AppUpdateService);
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
  duomeBase: AppLanguage = 'en';  // the learner's base/origin language
  duomeUrl = '';      // auto-built, editable
  duomeError = '';
  duomeBusy = false;

  private readonly EXPORT_EMAIL = 'wizard.night@gmail.com';

  // App version + build date for the About section (helps with debugging).
  readonly appVersion = BUILD_INFO.version;
  readonly buildDate = new Date(BUILD_INFO.buildDate).toLocaleString();

  /** True while a manual OTA update check / download is running. */
  isCheckingUpdate = false;
  /** True once a passive check found a newer version (drives the red badge). */
  updateAvailable = false;
  /** The newer version + its download info, when available. */
  private pendingUpdate: { version: string; url: string; checksum?: string } | null = null;

  /**
   * Passively check for a newer version when the Settings page opens, WITHOUT
   * downloading. If one exists, `updateAvailable` lights up the "new version"
   * badge; the user taps "Check for updates" to download it.
   */
  async ionViewWillEnter(): Promise<void> {
    try {
      const s = await this.appUpdate.getUpdateStatus();
      if (s.available && s.url && s.version) {
        this.pendingUpdate = { version: s.version, url: s.url, checksum: s.checksum };
        this.updateAvailable = true;
      } else {
        this.pendingUpdate = null;
        this.updateAvailable = false;
      }
    } catch {
      this.updateAvailable = false;
    }
    this.cdr.detectChanges();
  }

  /**
   * Tap handler for the update row. Downloads + applies the pending update when
   * one was found; otherwise does a fresh check. Toasts each outcome.
   */
  async checkForUpdate(): Promise<void> {
    if (this.isCheckingUpdate) return;
    this.isCheckingUpdate = true;
    this.cdr.detectChanges();

    const showToast = async (msg: string) => {
      const t = await this.toast.create({ message: msg, duration: 2500, position: 'bottom' });
      await t.present();
    };

    try {
      const res = this.pendingUpdate
        ? await this.appUpdate.downloadAndApply(this.pendingUpdate.version, this.pendingUpdate.url, this.pendingUpdate.checksum)
        : await this.appUpdate.checkForUpdateNow();
      switch (res.status) {
        case 'updated':
          await showToast(this.i18n.t('settings.updateApplying', { v: res.version }));
          break;
        case 'uptodate':
          this.updateAvailable = false;
          this.pendingUpdate = null;
          await showToast(this.i18n.t('settings.updateNone'));
          break;
        case 'unsupported':
          await showToast(this.i18n.t('settings.updateUnsupported'));
          break;
        case 'error':
          await showToast(this.i18n.t('settings.updateError') + (res.error ? ` (${res.error})` : ''));
          break;
      }
    } finally {
      this.isCheckingUpdate = false;
      this.cdr.detectChanges();
    }
  }

  // Settings accessors
  get theme() { return this.settingsService.theme(); }
  get colorTheme() { return this.settingsService.colorTheme(); }
  get textSize() { return this.settingsService.textSize(); }
  get audioSpeed() { return this.settingsService.audioSpeed(); }
  get reducedMotion() { return this.settingsService.reducedMotion(); }
  get explanationLanguage() { return this.settingsService.explanationLanguage(); }
  get sessionLength() { return this.settingsService.sessionLength(); }
  get dailyGoal() { return this.settingsService.dailyGoal(); }
  get notificationsEnabled() { return this.settingsService.notificationsEnabled(); }
  get reducedDistraction() { return this.settingsService.reducedDistraction(); }
  get flashcardDirection() { return this.settingsService.flashcardDirection(); }
  get adminMode() { return this.settingsService.adminMode(); }
  get testerName() { return this.settingsService.testerName(); }

  /**
   * Whether the Admin group is shown. Kept visible in production too (it's a
   * single discreet toggle, OFF by default) so on-device testing can enable
   * the admin shortcuts; normal users simply never turn it on.
   */
  get showAdminGroup() { return true; }

  // Options
  themeOptions: { value: Theme; label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  // Short names so the selected value fits the row on small screens (the
  // collapsed ion-select value was truncating to "Ocean (dark na…").
  colorThemeOptions: { value: ColorTheme; label: string }[] = [
    { value: 'ocean', label: 'Ocean' },
    { value: 'slate', label: 'Slate' },
    { value: 'forest', label: 'Forest' },
    { value: 'default', label: 'Midnight' },
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

  /** Base/origin languages the learner can translate FROM. These are the UI
   *  languages we have catalogs for; the chosen one also becomes the app UI
   *  language. Offered when adding a study language. */
  baseLanguageOptions: { value: AppLanguage; label: string }[] = [
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

  onAdminModeChange(event: CustomEvent): void {
    this.settingsService.updateSetting('adminMode', event.detail.checked);
  }

  onTesterNameChange(event: CustomEvent): void {
    const value = String((event.detail as { value?: unknown }).value ?? '').slice(0, 40);
    this.settingsService.updateSetting('testerName', value);
  }

  /** Show the patch notes for the currently-running version. */
  async showWhatsNew(): Promise<void> {
    const v = this.appVersion;
    const entry = changelogFor(v);
    const bullets = (entry?.notes ?? []).map(n => `• ${n}`).join('<br><br>');
    const alert = await this.alertController.create({
      header: this.i18n.t('settings.whatsNewTitle', { v }),
      message: bullets || this.i18n.t('settings.whatsNewNone'),
      buttons: [{ text: this.i18n.t('common.close') }],
    });
    await alert.present();
  }

  /** Open the in-app Admin / debug info page. */
  openAdminPage(): void {
    this.router.navigate(['/admin']);
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
    // Pre-select the learner's current base language.
    this.duomeBase = this.settingsService.baseLanguage() as AppLanguage;
    this.duomeUrl = '';
    this.duomeError = '';
    this.duomeBusy = false;
    this.showDuomeModal = true;
  }

  closeDuomeModal() {
    this.showDuomeModal = false;
  }

  /** The base (origin) language changed — rebuild the URL with the new base. */
  onDuomeBaseChange(event: CustomEvent) {
    this.duomeBase = event.detail.value as AppLanguage;
    this.buildDuomeUrl();
  }

  /** When a course is picked from the dropdown, build the skills URL. */
  onDuomeCourseChange() {
    this.buildDuomeUrl();
  }

  /** Build the duome skills URL from the chosen base + target languages. */
  private buildDuomeUrl() {
    if (this.duomeTarget) {
      this.duomeUrl = `https://duome.eu/vocabulary/${this.duomeBase}/${this.duomeTarget}/skills`;
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
      // Switch to the newly-imported language so it shows immediately, and
      // adopt the chosen base language (also sets the app UI language).
      this.settingsService.updateSetting('learningLanguage', target);
      this.settingsService.setBaseLanguage(this.duomeBase);
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

  /** Localized display name of the currently selected learning language. */
  private currentLanguageName(): string {
    const code = this.settingsService.learningLanguage();
    const key = `langName.${code}`;
    const name = this.i18n.t(key);
    return name === key ? code.toUpperCase() : name;
  }

  /**
   * Delete all learning progress + custom/imported words for the CURRENT
   * language only, after a confirmation prompt. Other languages and the app
   * settings are untouched.
   */
  async deleteLanguageData(): Promise<void> {
    const code = this.settingsService.learningLanguage();
    const langName = this.currentLanguageName();

    const alert = await this.alertController.create({
      header: this.t('settings.deleteDataTitle'),
      message: this.t('settings.deleteDataConfirm', { lang: langName }),
      buttons: [
        { text: this.t('common.cancel'), role: 'cancel' },
        {
          text: this.t('settings.deleteDataConfirmBtn'),
          role: 'destructive',
          handler: () => { void this.confirmDeleteLanguageData(code, langName); },
        },
      ],
    });
    await alert.present();
  }

  /** Perform the deletion and toast the outcome. */
  private async confirmDeleteLanguageData(code: string, langName: string): Promise<void> {
    try {
      await this.flashcardService.resetLanguageData(code);
      const t = await this.toast.create({
        message: this.t('settings.deleteDataDone', { lang: langName }),
        duration: 2500,
        position: 'bottom',
      });
      await t.present();
    } catch {
      const t = await this.toast.create({
        message: this.t('settings.deleteDataError'),
        duration: 2500,
        position: 'bottom',
      });
      await t.present();
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
