/**
 * Exit Confirm
 *
 * Shared "lose progress?" confirmation used by every mid-session exercise
 * (Write, Quiz, Match, Builder) when the user tries to leave via the header X
 * or the Android hardware/gesture back.
 *
 * The flow (matches what the user asked for):
 *   - back/X with progress to lose → show the confirm ON the exercise;
 *   - back again → close the confirm AND leave (run the page's `onLeave`);
 *   - a single predictive-back swipe (which fires several back ticks) can't
 *     flash the confirm open-and-closed in one gesture, nor re-open it right
 *     after it closes — short time guards absorb the trailing ticks.
 *
 * Centralised here (rather than copied into each page) so all four modes behave
 * identically and the fiddly gesture timing lives in one place.
 *
 * The confirm overlay carries the `exit-confirm` class so the global back
 * handler (app.component.dismissTopOverlay) SKIPS it — a back press on the open
 * confirm must flow to this service (close + leave), not be silently dismissed.
 *
 * @module app/services
 */

import { Injectable, inject } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { I18nAngularService } from './i18n.service';

@Injectable({ providedIn: 'root' })
export class ExitConfirmService {
  private alertController = inject(AlertController);
  private i18n = inject(I18nAngularService);

  /** Marker class the global back handler looks for to skip auto-dismiss. */
  static readonly MARKER_CLASS = 'exit-confirm';

  private alert: HTMLIonAlertElement | null = null;
  private open = false;
  /** Before this, back won't act on the open confirm (absorbs the opening
   *  swipe's trailing ticks so one gesture doesn't open+close it). */
  private interactableAt = 0;
  /** After the confirm closes, back is swallowed until this, so trailing ticks
   *  of the same swipe don't immediately re-open it. */
  private suppressedUntil = 0;

  /** True while the confirm is on screen (pages can suspend focus/keyboard). */
  get isOpen(): boolean { return this.open; }

  /**
   * Handle a back/close request for a mode.
   *
   * @param hasProgress whether there is unsaved progress worth confirming.
   * @param onLeave     navigates away (the page's close()). Called immediately
   *                    when there's nothing to lose, or on the SECOND back.
   * @returns true when the press was handled (caller must NOT also navigate).
   */
  async request(hasProgress: boolean, onLeave: () => void): Promise<boolean> {
    // Confirm already up → "yes, leave": close it and run onLeave. Ignore the
    // trailing ticks of the swipe that just opened it (same gesture).
    if (this.open) {
      if (Date.now() < this.interactableAt) return true;
      this.suppressedUntil = Date.now() + 700;
      await this.dismiss();
      onLeave();
      return true;
    }
    // Swallow trailing ticks of a swipe that just closed the confirm.
    if (Date.now() < this.suppressedUntil) return true;
    // Nothing to lose → leave straight away.
    if (!hasProgress) { onLeave(); return true; }
    // Otherwise present the confirm and claim the press.
    await this.present(onLeave);
    return true;
  }

  /** Present the confirm. Cancel stays; End leaves (runs onLeave). */
  private async present(onLeave: () => void): Promise<void> {
    if (this.open) return;
    this.open = true;
    this.interactableAt = Date.now() + 500;

    const alert = await this.alertController.create({
      header: this.i18n.t('mode.endStudyHeader'),
      message: this.i18n.t('mode.endStudyMessage'),
      backdropDismiss: false,
      cssClass: ExitConfirmService.MARKER_CLASS,
      buttons: [
        { text: this.i18n.t('common.cancel'), role: 'cancel' },
        {
          text: this.i18n.t('mode.end'),
          role: 'confirm',
          handler: () => { this.cleanup(); onLeave(); },
        },
      ],
    });
    this.alert = alert;
    void alert.onDidDismiss().then(() => {
      this.suppressedUntil = Date.now() + 700;
      this.open = false;
      this.alert = null;
    });
    await alert.present();
  }

  /** Dismiss the confirm overlay if it's showing. */
  async dismiss(): Promise<void> {
    const a = this.alert;
    this.cleanup();
    try { await a?.dismiss(); } catch { /* ignore */ }
  }

  private cleanup(): void {
    this.open = false;
    this.alert = null;
  }

  /** Clear state when a page leaves, so a stale confirm ref can't linger. */
  reset(): void {
    this.cleanup();
    this.interactableAt = 0;
    this.suppressedUntil = 0;
  }
}
