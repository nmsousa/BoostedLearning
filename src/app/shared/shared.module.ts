/**
 * Shared module: reusable declarables (pipes) for feature page modules.
 *
 * @module app/shared
 */

import { NgModule } from '@angular/core';
import { TranslatePipe } from '../pipes/translate.pipe';
import { WaveformComponent } from './waveform.component';
import { SlowAudioIconComponent } from './slow-audio-icon.component';

@NgModule({
  declarations: [TranslatePipe],
  imports: [WaveformComponent, SlowAudioIconComponent], // standalone components
  exports: [TranslatePipe, WaveformComponent, SlowAudioIconComponent],
})
export class SharedModule {}
