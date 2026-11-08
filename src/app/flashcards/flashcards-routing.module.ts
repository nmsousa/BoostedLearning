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
  },
  {
    // Blanks mode (fill-in-the-blank: pick the missing word in a sentence).
    // Also serves the Journey 'blanks' node via ?mode=journey-blanks.
    path: 'blanks/:id',
    loadChildren: () => import('./blanks/blanks.module').then(m => m.BlanksPageModule)
  },
  {
    // EXPERIMENTAL: Journey map (game-style level map). Its own page.
    path: 'journey',
    loadChildren: () => import('./journey/journey.module').then(m => m.JourneyPageModule)
  },
  {
    // EXPERIMENTAL: Journey+ — redesigned map, kept alongside the classic
    // Journey for comparison. Same journey-* progress.
    path: 'journey-plus',
    loadChildren: () => import('./journey-plus/journey-plus.module').then(m => m.JourneyPlusPageModule)
  },
  {
    // EXPERIMENTAL: Journey++ — high-fidelity pass of Journey+ (mockup match).
    path: 'journey-plus-plus',
    loadChildren: () => import('./journey-plus-plus/journey-plus-plus.module').then(m => m.JourneyPlusPlusPageModule)
  },
  {
    // EXPERIMENTAL: Tree — a radial "learning network" map. Central Core
    // Vocabulary hub with thematic unit branches. Shares journey-* progress.
    path: 'tree',
    loadChildren: () => import('./tree/tree.module').then(m => m.TreePageModule)
  },
  {
    // EXPERIMENTAL: a Journey level reuses the Write exercise, scored under
    // the 'journey' mode (via ?mode=journey).
    path: 'journey-play/:id',
    loadChildren: () => import('./study/study.module').then(m => m.StudyPageModule)
  },
  {
    // EXPERIMENTAL: Builder mode (grammar groups -> phrases). Its own page.
    path: 'builder',
    loadChildren: () => import('./builder/builder.module').then(m => m.BuilderPageModule)
  },
  {
    // Journey BUILDER node: the Builder page in journey-phrase mode, scored
    // under 'journey-builder' (via ?mode=journey-builder&level=N).
    path: 'journey-builder/:id',
    loadChildren: () => import('./builder/builder.module').then(m => m.BuilderPageModule)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FlashcardsPageRoutingModule {}
