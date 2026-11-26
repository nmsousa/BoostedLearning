/**
 * Shared module: reusable declarables (pipes) for feature page modules.
 *
 * @module app/shared
 */
import { NgModule } from '@angular/core';
import { TranslatePipe } from '../pipes/translate.pipe';
import { WaveformComponent } from './waveform.component';
import { AudioPlayIconComponent } from './audio-play-icon.component';
import { GenderBadgeComponent } from './gender-badge.component';
import { TapWordComponent, TapWordsComponent } from './tap-word.component';
@NgModule({
  declarations: [TranslatePipe],
  imports: [WaveformComponent, AudioPlayIconComponent, GenderBadgeComponent, TapWordComponent, TapWordsComponent], // standalone components
  exports: [TranslatePipe, WaveformComponent, AudioPlayIconComponent, GenderBadgeComponent, TapWordComponent, TapWordsComponent],
})
export class SharedModule {}
