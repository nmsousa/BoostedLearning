import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular/lazy';

import { BuilderPlusPageRoutingModule } from './builder-plus-routing.module';
import { SharedModule } from '../../shared/shared.module';

import { BuilderPlusPage } from './builder-plus.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BuilderPlusPageRoutingModule,
    SharedModule,
  ],
  declarations: [BuilderPlusPage],
})
export class BuilderPlusPageModule {}
