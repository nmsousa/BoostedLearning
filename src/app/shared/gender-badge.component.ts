/**
 * Small gender badge for a French noun, e.g. "Masculine · un" / "Feminine · une".
 * Replaces the old "(m.)" / "(f.)" note in the English text (article rule,
 * docs/LEVEL-ALGORITHM.md). Shows the indefinite article so the gender is
 * visible even when the shown article is elided (l’hôtel → "Masculine · un").
 */
import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { I18nAngularService } from '../services/i18n.service';

@Component({
  selector: 'app-gender-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (label(); as l) {<span class="gender-badge" [class.f]="g() === 'f'">{{ l }}</span>}`,
  styles: [`
    :host { display: inline-flex; }
    .gender-badge {
      display: inline-flex; align-items: center;
      padding: 3px 10px; border-radius: 999px;
      font-size: 0.78rem; font-weight: 600; letter-spacing: 0.01em;
      color: #8fb8ff; background: rgba(96, 150, 255, 0.14);
      border: 1px solid rgba(96, 150, 255, 0.35);
    }
    .gender-badge.f { color: #ff9ec7; background: rgba(255, 120, 180, 0.14); border-color: rgba(255, 120, 180, 0.35); }
  `],
})
export class GenderBadgeComponent {
  private i18n = inject(I18nAngularService);
  protected g = signal<'m' | 'f' | null>(null);

  @Input() set gender(v: 'm' | 'f' | null | undefined) { this.g.set(v ?? null); }

  protected label = computed(() => {
    this.i18n.lang();
    const g = this.g();
    if (!g) return '';
    return `${this.i18n.t(g === 'm' ? 'gender.masculine' : 'gender.feminine')} · ${g === 'm' ? 'un' : 'une'}`;
  });
}
