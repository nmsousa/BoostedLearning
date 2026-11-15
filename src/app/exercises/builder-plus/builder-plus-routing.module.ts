import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BuilderPlusPage } from './builder-plus.page';

const routes: Routes = [{ path: '', component: BuilderPlusPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BuilderPlusPageRoutingModule {}
