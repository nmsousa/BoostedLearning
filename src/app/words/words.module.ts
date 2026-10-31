import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular/lazy';

import { WordsPageRoutingModule } from './words-routing.module';

import { WordsPage } from './words.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    WordsPageRoutingModule,
    SharedModule,
  ],
  declarations: [WordsPage],
})
export class WordsPageModule {}
