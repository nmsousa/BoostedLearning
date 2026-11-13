import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular/lazy';

import { BlanksPageRoutingModule } from './blanks-routing.module';
import { SharedModule } from '../../shared/shared.module';

import { BlanksPage } from './blanks.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BlanksPageRoutingModule,
    SharedModule,
  ],
  declarations: [BlanksPage],
})
export class BlanksPageModule {}
