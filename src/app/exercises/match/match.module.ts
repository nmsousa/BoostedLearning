import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular/lazy';

import { MatchPageRoutingModule } from './match-routing.module';
import { SharedModule } from '../../shared/shared.module';

import { MatchPage } from './match.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MatchPageRoutingModule,
    SharedModule,
  ],
  declarations: [MatchPage],
})
export class MatchPageModule {}
