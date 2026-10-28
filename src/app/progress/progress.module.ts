import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular/lazy';

import { ProgressPageRoutingModule } from './progress-routing.module';

import { ProgressPage } from './progress.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ProgressPageRoutingModule
  ],
  declarations: [ProgressPage]
})
export class ProgressPageModule {}
