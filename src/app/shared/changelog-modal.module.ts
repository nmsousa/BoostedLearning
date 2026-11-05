/**
 * Module for the reusable "What's new" history modal, so both Home and Settings
 * can present it via ModalController. Non-standalone to match the app's lazy
 * IonicModule setup.
 *
 * @module app/shared
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular/lazy';
import { ChangelogModalComponent } from './changelog-modal.component';

@NgModule({
  imports: [CommonModule, IonicModule],
  declarations: [ChangelogModalComponent],
  exports: [ChangelogModalComponent],
})
export class ChangelogModalModule {}
