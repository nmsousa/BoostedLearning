import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular/lazy';

import { PracticePageRoutingModule } from './practice-routing.module';
import { SharedModule } from '../shared/shared.module';

import { PracticePage } from './practice.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PracticePageRoutingModule,
    SharedModule,
  ],
  declarations: [PracticePage],
})
export class PracticePageModule {}
