/**
 * Shared module: reusable declarables (pipes) for feature page modules.
 *
 * @module app/shared
 */

import { NgModule } from '@angular/core';
import { TranslatePipe } from '../pipes/translate.pipe';

@NgModule({
  declarations: [TranslatePipe],
  exports: [TranslatePipe],
})
export class SharedModule {}
