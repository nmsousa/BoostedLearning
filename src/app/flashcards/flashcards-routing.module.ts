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
    // EXPERIMENTAL: Journey+ — redesigned map. Same journey-* progress.
    // (The classic "Journey" map was removed; Journey+/++ remain.)
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
    // Explore (formerly "Tree+") — the Tree engine/data in a vertical,
    // card-based layout. Route kept as 'tree-plus' for stability. Shares deck.
    path: 'tree-plus',
    loadChildren: () => import('../maps/tree-plus/tree-plus.module').then(m => m.TreePlusPageModule)
  },
  {
    // Explore+ — a stacked vertical variant of Explore: Core 1, Themes 1,
    // Core 2, Themes 2, … all laid out top-to-bottom. Shares the Tree deck.
    path: 'explore-plus',
    loadChildren: () => import('../maps/explore-plus/explore-plus.module').then(m => m.ExplorePlusPageModule)
  },
  {
    // Mix — a single session mixing several exercise types for a level.
    path: 'mix/:id',
    loadChildren: () => import('../exercises/mix/mix.module').then(m => m.MixPageModule)
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
    // EXPERIMENTAL: Builder+ — self-checking Builder (correct order only,
    // dashed underline slots, no Check button; wrong taps blink red).
    path: 'builder-plus',
    loadChildren: () => import('../exercises/builder-plus/builder-plus.module').then(m => m.BuilderPlusPageModule)
  },
  {
    // Journey BUILDER node: the Builder page in journey-phrase mode, scored
    // under 'journey-builder' (via ?mode=journey-builder&level=N).
    path: 'journey-builder/:id',
    loadChildren: () => import('../exercises/builder/builder.module').then(m => m.BuilderPageModule)
  },
  {
    // Journey BUILDER+ node: the self-checking Builder page in journey-phrase
    // mode (via ?mode=journey-builder-plus&level=N). Shares 'journey-builder'
    // progress-saving is NOT reused — it saves its own node below.
    path: 'journey-builder-plus/:id',
    loadChildren: () => import('../exercises/builder-plus/builder-plus.module').then(m => m.BuilderPlusPageModule)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FlashcardsPageRoutingModule {}
