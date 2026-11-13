import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { FlipPage } from './flip.page';

const routes: Routes = [
  {
    path: '',
    component: FlipPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FlipPageRoutingModule {}
