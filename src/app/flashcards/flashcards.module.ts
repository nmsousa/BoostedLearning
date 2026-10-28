import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { IonicModule } from '@ionic/angular/lazy';

import { FlashcardsPageRoutingModule } from './flashcards-routing.module';

import { FlashcardsPage } from './flashcards.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    IonicModule,
    FlashcardsPageRoutingModule
  ],
  declarations: [FlashcardsPage]
})
export class FlashcardsPageModule {}
