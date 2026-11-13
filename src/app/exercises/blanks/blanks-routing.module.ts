import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { BlanksPage } from './blanks.page';

const routes: Routes = [
  {
    path: '',
    component: BlanksPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BlanksPageRoutingModule {}
