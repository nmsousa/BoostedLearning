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
 * Reports are NEVER sent by email. If the POST fails (offline / server down) the
 * report is saved on the device and sent automatically the next time the app
 * starts or the phone comes back online, so it is never lost.
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
  /** 'bug' (default) or 'suggestion'. */
  kind?: 'bug' | 'suggestion';
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

/** Where reports wait until they can be sent. */
const QUEUE_KEY = 'boostionary.feedbackQueue';
/** Keep the queue small: the oldest reports are dropped past this. */
const MAX_QUEUED = 20;

/** The body POSTed to the Worker. */
type FeedbackPayload = FeedbackReport & { kind: 'bug' | 'suggestion'; testerName: string | null; diagnostics: Diagnostics };

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private settings = inject(SettingsService);

  constructor() {
    // Send anything saved while offline, as soon as the phone is back online.
    if (typeof window !== 'undefined') window.addEventListener('online', () => { void this.flushQueue(); });
  }

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
   * Submit a report to the Worker. Returns 'sent' on success. On any failure
   * (offline, server down, no endpoint) the report is saved locally and
   * 'queued' is returned: it is retried automatically (see flushQueue). Nothing
   * is ever emailed.
   */
  async submit(report: FeedbackReport): Promise<'sent' | 'queued'> {
    const diagnostics = await this.collectDiagnostics();
    // Attach the tester's name (set in Settings) so GitHub issues show WHO
    // reported them — the Worker opens issues under one token, so without this
    // every report looks like it came from the repo owner.
    const testerName = this.settings.testerName()?.trim() || null;
    const payload: FeedbackPayload = { ...report, kind: report.kind ?? 'bug', testerName, diagnostics };

    if (await this.post(payload)) return 'sent';
    this.enqueue(payload);
    return 'queued';
  }

  /** Try to send every saved report (oldest first); keeps the ones that still fail. */
  async flushQueue(): Promise<void> {
    const queue = this.readQueue();
    if (!queue.length) return;
    const left: FeedbackPayload[] = [];
    for (const p of queue) {
      if (!(await this.post(p))) left.push(p);
    }
    this.writeQueue(left);
  }

  /** Number of reports waiting to be sent. */
  get pending(): number { return this.readQueue().length; }

  private async post(payload: FeedbackPayload): Promise<boolean> {
    const url = environment.feedbackEndpoint?.trim();
    if (!url) return false;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch {
      return false; // Network/CORS/offline
    }
  }

  private enqueue(payload: FeedbackPayload): void {
    this.writeQueue([...this.readQueue(), payload].slice(-MAX_QUEUED));
  }

  private readQueue(): FeedbackPayload[] {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeQueue(queue: FeedbackPayload[]): void {
    try {
      if (queue.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      else localStorage.removeItem(QUEUE_KEY);
    } catch { /* storage full or unavailable: nothing more we can do */ }
  }
}
