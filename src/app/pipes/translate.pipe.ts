/**
 * Translate pipe
 *
 * Pure pipe wrapper around the i18n service so templates can use
 * `{{ 'key' | translate }}` (or with params `{{ 'key' | translate:params }}`)
 * instead of calling a `t()` method on every change-detection cycle.
 *
 * Because it is a PURE pipe, Angular memoizes the result and only re-runs it
 * when the key/params change — or when the active language changes (we read
 * the language signal so a language switch invalidates the memoized value).
 *
 * @module app/pipes
 */

import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nAngularService } from '../services/i18n.service';

@Pipe({
  name: 'translate',
  standalone: false,
  pure: true,
})
export class TranslatePipe implements PipeTransform {
  private i18n = inject(I18nAngularService);

  transform(key: string, params?: Record<string, string | number>): string {
    // Read the language signal so the pipe's memoized value is invalidated
    // when the app language changes (the signal read makes this reactive).
    this.i18n.lang();
    return this.i18n.t(key, params);
  }
}
