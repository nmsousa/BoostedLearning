import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular/lazy';

import { StudyPageRoutingModule } from './study-routing.module';
import { SharedModule } from '../../shared/shared.module';

import { StudyPage } from './study.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    StudyPageRoutingModule,
    SharedModule,
  ],
  declarations: [StudyPage],
})
export class StudyPageModule {}
