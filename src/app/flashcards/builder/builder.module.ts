import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular/lazy';

import { BuilderPageRoutingModule } from './builder-routing.module';
import { SharedModule } from '../../shared/shared.module';

import { BuilderPage } from './builder.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BuilderPageRoutingModule,
    SharedModule,
  ],
  declarations: [BuilderPage],
})
export class BuilderPageModule {}
