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
    loadChildren: () => import('../exercises/study/study.module').then(m => m.StudyPageModule)
  },
  {
    path: 'study/:id',
    loadChildren: () => import('../exercises/study/study.module').then(m => m.StudyPageModule)
  },
  {
    // Flashcards mode (flip + self-rating).
    path: 'flip/:id',
    loadChildren: () => import('../exercises/flip/flip.module').then(m => m.FlipPageModule)
  },
  {
    // Match mode (connect the pairs).
    path: 'match/:id',
    loadChildren: () => import('../exercises/match/match.module').then(m => m.MatchPageModule)
  },
  {
    // Quiz mode (multiple choice).
    path: 'quiz/:id',
    loadChildren: () => import('../exercises/quiz/quiz.module').then(m => m.QuizPageModule)
  },
  {
    // Blanks mode (fill-in-the-blank: pick the missing word in a sentence).
    // Also serves the Journey 'blanks' node via ?mode=journey-blanks.
    path: 'blanks/:id',
    loadChildren: () => import('../exercises/blanks/blanks.module').then(m => m.BlanksPageModule)
  },
  {
    // EXPERIMENTAL: Journey map (game-style level map). Its own page.
    path: 'journey',
    loadChildren: () => import('../maps/journey/journey.module').then(m => m.JourneyPageModule)
  },
  {
    // EXPERIMENTAL: Journey+ — redesigned map, kept alongside the classic
    // Journey for comparison. Same journey-* progress.
    path: 'journey-plus',
    loadChildren: () => import('../maps/journey-plus/journey-plus.module').then(m => m.JourneyPlusPageModule)
  },
  {
    // EXPERIMENTAL: Journey++ — high-fidelity pass of Journey+ (mockup match).
    path: 'journey-plus-plus',
    loadChildren: () => import('../maps/journey-plus-plus/journey-plus-plus.module').then(m => m.JourneyPlusPlusPageModule)
  },
  {
    // EXPERIMENTAL: Tree — a radial "learning network" map. Central Core
    // Vocabulary hub with thematic unit branches. Shares journey-* progress.
    path: 'tree',
    loadChildren: () => import('../maps/tree/tree.module').then(m => m.TreePageModule)
  },
  {
    // EXPERIMENTAL: Tree+ — the same Tree engine/data in a vertical, card-based
    // layout (top-to-bottom) instead of the radial star. Shares the Tree deck.
    path: 'tree-plus',
    loadChildren: () => import('../maps/tree-plus/tree-plus.module').then(m => m.TreePlusPageModule)
  },
  {
    // EXPERIMENTAL: a Journey level reuses the Write exercise, scored under
    // the 'journey' mode (via ?mode=journey).
    path: 'journey-play/:id',
    loadChildren: () => import('../exercises/study/study.module').then(m => m.StudyPageModule)
  },
  {
    // Learn: the intro step (meaning + grammar/emoji) before the Tree drills.
    path: 'learn/:id',
    loadChildren: () => import('../exercises/learn/learn.module').then(m => m.LearnPageModule)
  },
  {
    // EXPERIMENTAL: Builder mode (grammar groups -> phrases). Its own page.
    path: 'builder',
    loadChildren: () => import('../exercises/builder/builder.module').then(m => m.BuilderPageModule)
  },
  {
    // Journey BUILDER node: the Builder page in journey-phrase mode, scored
    // under 'journey-builder' (via ?mode=journey-builder&level=N).
    path: 'journey-builder/:id',
    loadChildren: () => import('../exercises/builder/builder.module').then(m => m.BuilderPageModule)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FlashcardsPageRoutingModule {}
