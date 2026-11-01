import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular/lazy';

import { JourneyPageRoutingModule } from './journey-routing.module';
import { SharedModule } from '../../shared/shared.module';

import { JourneyPage } from './journey.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    JourneyPageRoutingModule,
    SharedModule,
  ],
  declarations: [JourneyPage],
})
export class JourneyPageModule {}
