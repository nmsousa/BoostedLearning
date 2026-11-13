import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular/lazy';

import { QuizPageRoutingModule } from './quiz-routing.module';
import { SharedModule } from '../../shared/shared.module';

import { QuizPage } from './quiz.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    QuizPageRoutingModule,
    SharedModule,
  ],
  declarations: [QuizPage],
})
export class QuizPageModule {}
