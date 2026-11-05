/**
 * Changelog ("What's new") modal.
 *
 * A full-page modal that lists the ENTIRE recorded version history (newest
 * first), each version with its user-facing bullet points — so if several OTA
 * updates landed between app opens, none of the notes are missed. The running
 * version is highlighted and, right after an update, labelled as just applied.
 *
 * Declared in ChangelogModalModule (imported by Home and Settings) so it can be
 * presented via ModalController from both the post-update flow and Settings.
 *
 * @module app/shared
 */

import { Component, Input, inject } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { I18nAngularService } from '../services/i18n.service';
import { CHANGELOG, type ChangelogEntry } from '../services/changelog';

@Component({
  selector: 'app-changelog-modal',
  standalone: false,
  templateUrl: './changelog-modal.component.html',
  styleUrls: ['./changelog-modal.component.scss'],
})
export class ChangelogModalComponent {
  private modalCtrl = inject(ModalController);
  private i18n = inject(I18nAngularService);

  /** The currently-running app version (highlighted in the list). */
  @Input() currentVersion = '';
  /** True when opened right after an OTA update applied (tweaks the header). */
  @Input() afterUpdate = false;

  /** Full history, newest first. */
  readonly entries: ChangelogEntry[] = CHANGELOG;

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  get headerTitle(): string {
    return this.afterUpdate
      ? this.t('settings.updatedTo', { v: this.currentVersion })
      : this.t('settings.whatsNew');
  }

  isCurrent(entry: ChangelogEntry): boolean {
    return !!this.currentVersion && entry.version === this.currentVersion;
  }

  close(): void {
    void this.modalCtrl.dismiss();
  }
}
