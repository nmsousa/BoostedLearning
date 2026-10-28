import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular/lazy';

import { FlipPageRoutingModule } from './flip-routing.module';

import { FlipPage } from './flip.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    FlipPageRoutingModule,
  ],
  declarations: [FlipPage],
})
export class FlipPageModule {}
