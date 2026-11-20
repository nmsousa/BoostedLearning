/**
 * Shared module: reusable declarables (pipes) for feature page modules.
 *
 * @module app/shared
 */
import { NgModule } from '@angular/core';
import { TranslatePipe } from '../pipes/translate.pipe';
import { WaveformComponent } from './waveform.component';
import { AudioPlayIconComponent } from './audio-play-icon.component';
@NgModule({
  declarations: [TranslatePipe],
  imports: [WaveformComponent, AudioPlayIconComponent], // standalone components
  exports: [TranslatePipe, WaveformComponent, AudioPlayIconComponent],
})
export class SharedModule {}
