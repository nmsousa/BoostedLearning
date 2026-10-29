import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { FlashcardsPage } from './flashcards.page';

const routes: Routes = [
  {
    path: '',
    component: FlashcardsPage
  },
  {
    // Write mode (type-the-translation). Kept at both 'write' and the legacy
    // 'study' path so existing links keep working.
    path: 'write/:id',
    loadChildren: () => import('./study/study.module').then(m => m.StudyPageModule)
  },
  {
    path: 'study/:id',
    loadChildren: () => import('./study/study.module').then(m => m.StudyPageModule)
  },
  {
    // Flashcards mode (flip + self-rating).
    path: 'flip/:id',
    loadChildren: () => import('./flip/flip.module').then(m => m.FlipPageModule)
  },
  {
    // Match mode (connect the pairs).
    path: 'match/:id',
    loadChildren: () => import('./match/match.module').then(m => m.MatchPageModule)
  },
  {
    // Quiz mode (multiple choice).
    path: 'quiz/:id',
    loadChildren: () => import('./quiz/quiz.module').then(m => m.QuizPageModule)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FlashcardsPageRoutingModule {}
