/**
 * Game rules pop-ups shared by every game page:
 *  - `stopEarly`: the encouraging message shown when a round is stopped because
 *    more than half of the answers were wrong (see shared/star-rules.ts);
 *  - `showRules`: ADMIN ONLY — how stars are earned in the current round.
 *
 * @module app/services
 */
import { Injectable, inject } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { I18nAngularService } from './i18n.service';

@Injectable({ providedIn: 'root' })
export class GameRulesService {
  private alerts = inject(AlertController);
  private i18n = inject(I18nAngularService);
  private stopping = false;

  /**
   * Stop the round: an encouraging message, then `leave()` (back to the level
   * page so the learner can try again). Nothing is saved for a stopped round.
   * Safe to call more than once (only one message is shown).
   */
  async stopEarly(leave: () => void): Promise<void> {
    if (this.stopping) return;
    this.stopping = true;
    try {
      const alert = await this.alerts.create({
        header: this.i18n.t('mode.stopEarlyTitle'),
        message: this.i18n.t('mode.stopEarlyBody'),
        backdropDismiss: false,
        buttons: [{ text: this.i18n.t('mode.stopEarlyButton'), role: 'confirm' }],
        cssClass: 'stop-early-alert',
      });
      await alert.present();
      await alert.onDidDismiss();
    } finally {
      this.stopping = false;
    }
    leave();
  }

  /** ADMIN: show how stars are earned in this round (pre-formatted text). */
  async showRules(text: string): Promise<void> {
    const alert = await this.alerts.create({
      header: this.i18n.t('admin.rulesTitle'),
      message: text,
      buttons: [{ text: this.i18n.t('common.close'), role: 'cancel' }],
      cssClass: ['admin-alert', 'rules-alert'],
    });
    await alert.present();
  }
}
