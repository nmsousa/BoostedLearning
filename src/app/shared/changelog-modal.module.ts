/**
 * Module for the reusable "What's new" history modal, so both Home and Settings
 * can present it via ModalController. Non-standalone to match the app's lazy
 * IonicModule setup.
 *
 * @module app/shared
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular/lazy';
import { AngularDelegate } from '@ionic/angular/common';
import { ChangelogModalComponent } from './changelog-modal.component';

@NgModule({
  imports: [CommonModule, IonicModule],
  declarations: [ChangelogModalComponent],
  exports: [ChangelogModalComponent],
  // The lazy ModalController is @Injectable() WITHOUT providedIn:'root' (unlike
  // AlertController/ToastController), so it is NOT auto-available — resolving it
  // from a lazy page injector threw NG0201. Provide it (and the AngularDelegate
  // it depends on) here so Home/Settings — which import this module — can open
  // the modal.
  providers: [ModalController, AngularDelegate],
})
export class ChangelogModalModule {}
