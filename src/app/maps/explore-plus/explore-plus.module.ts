import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular/lazy';

import { SharedModule } from '../../shared/shared.module';
import { ExplorePlusPage } from './explore-plus.page';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    SharedModule,
    RouterModule.forChild([{ path: '', component: ExplorePlusPage }]),
  ],
  declarations: [ExplorePlusPage],
})
export class ExplorePlusPageModule {}
