import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BuilderPage } from './builder.page';

const routes: Routes = [{ path: '', component: BuilderPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BuilderPageRoutingModule {}
