import { Component, inject } from '@angular/core';
import { SettingsService } from './services/settings.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  // Inject the settings service so it is created at app startup and its
  // theme effect runs, applying the saved light/dark palette immediately.
  private settings = inject(SettingsService);

  constructor() {}
}
