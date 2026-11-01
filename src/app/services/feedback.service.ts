/**
 * Feedback Service
 *
 * Collects a "report a problem" payload (reasons + the word/mode/language in
 * context + device diagnostics) and delivers it to the developer.
 *
 * Primary delivery is an HTTP POST to a small Cloudflare Worker, which holds a
 * GitHub token server-side and opens a GitHub Issue. The app never contains the
 * token — it only knows the public Worker URL.
 *
 * If the Worker URL isn't configured, or the POST fails (offline / server
 * down), we fall back to opening a pre-filled `mailto:` so the report is never
 * silently lost.
 *
 * @module app/services
 */

import { Injectable, inject } from '@angular/core';
import { Device } from '@capacitor/device';
import { SettingsService } from './settings.service';
import { BUILD_INFO } from '../../build-info';
import { environment } from '../../environments/environment';

/** A problem report composed on a practice screen. */
export interface FeedbackReport {
  /** Machine reason codes the user ticked (e.g. 'audioWrong'). */
  reasons: string[];
  /** The word being practised when the report was made. */
  word?: string | null;
  /** The expected/correct answer for that word. */
  correctAnswer?: string | null;
  /** Practice mode name (e.g. 'Quiz'). */
  modeName?: string | null;
  /** Target (learning) language code. */
  learningLanguage?: string | null;
  /** Optional free-text detail typed by the user. */
  note?: string | null;
}

/** Device + app diagnostics attached automatically to every report. */
export interface Diagnostics {
  appVersion: string;
  buildDate: string;
  platform: string;
  osVersion?: string;
  androidSdk?: number;
  model?: string;
  manufacturer?: string;
  webViewVersion?: string;
  screen: string;
  dpr: number;
  baseLanguage: string;
  learningLanguage: string;
  theme: string;
  colorTheme: string;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private settings = inject(SettingsService);

  /** Fallback email (same address used by the custom-card export). */
  private readonly FALLBACK_EMAIL = 'wizard.night@gmail.com';

  /** Collect device + app diagnostics. Best-effort: never throws. */
  async collectDiagnostics(): Promise<Diagnostics> {
    let info: Partial<Awaited<ReturnType<typeof Device.getInfo>>> = {};
    try {
      info = await Device.getInfo();
    } catch {
      // Web/no-plugin: leave device fields undefined.
    }

    return {
      appVersion: BUILD_INFO.version,
      buildDate: BUILD_INFO.buildDate,
      platform: info.platform ?? 'web',
      osVersion: info.osVersion,
      androidSdk: info.androidSDKVersion,
      model: info.model,
      manufacturer: info.manufacturer,
      webViewVersion: info.webViewVersion,
      screen: `${window.screen.width}x${window.screen.height}`,
      dpr: window.devicePixelRatio || 1,
      baseLanguage: this.settings.baseLanguage(),
      learningLanguage: this.settings.learningLanguage(),
      theme: this.settings.effectiveTheme(),
      colorTheme: this.settings.colorTheme(),
    };
  }

  /**
   * Submit a report. Tries the Worker endpoint first; on any failure (or when
   * no endpoint is configured) falls back to a pre-filled mailto so the report
   * still reaches the developer. Returns true if the POST succeeded.
   */
  async submit(report: FeedbackReport): Promise<boolean> {
    const diagnostics = await this.collectDiagnostics();
    const payload = { ...report, diagnostics };

    const url = environment.feedbackEndpoint?.trim();
    if (url) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) return true;
      } catch {
        // Network/CORS/offline — fall through to the mailto fallback.
      }
    }

    this.openMailtoFallback(report, diagnostics);
    return false;
  }

  /** Build a readable plain-text body for both the issue and the mailto. */
  private composeBody(report: FeedbackReport, d: Diagnostics): string {
    return [
      `Word: ${report.word ?? '-'}`,
      `Expected answer: ${report.correctAnswer ?? '-'}`,
      `Mode: ${report.modeName ?? '-'}`,
      `Reasons: ${report.reasons.join('; ') || '-'}`,
      `Note: ${report.note?.trim() || '-'}`,
      '',
      '--- diagnostics ---',
      `App: ${d.appVersion} (${d.buildDate})`,
      `Platform: ${d.platform}${d.osVersion ? ' ' + d.osVersion : ''}${d.androidSdk ? ' / SDK ' + d.androidSdk : ''}`,
      `Device: ${d.manufacturer ?? '-'} ${d.model ?? ''}`.trim(),
      `WebView: ${d.webViewVersion ?? '-'}`,
      `Screen: ${d.screen} @${d.dpr}x`,
      `Languages: learning ${d.learningLanguage}, base ${d.baseLanguage}`,
      `Theme: ${d.theme} / ${d.colorTheme}`,
    ].join('\n');
  }

  private openMailtoFallback(report: FeedbackReport, d: Diagnostics): void {
    const subject = `Boostionary feedback: ${report.word ?? '(no word)'}`;
    const mailto =
      `mailto:${this.FALLBACK_EMAIL}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(this.composeBody(report, d))}`;
    window.location.href = mailto;
  }
}
