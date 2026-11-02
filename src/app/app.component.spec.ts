import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  ModalController,
  PopoverController,
  ActionSheetController,
  AlertController,
} from '@ionic/angular';

import { AppComponent } from './app.component';
import { AppModule } from './app.module';

describe('AppComponent', () => {

  beforeEach(async () => {
    // The component injects the Ionic overlay controllers (for the hardware
    // back-button "close the top popup first" logic). Provide light stubs so
    // the component can be created under test.
    const overlayStub = { getTop: async () => undefined };

    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [
        { provide: ModalController, useValue: overlayStub },
        { provide: PopoverController, useValue: overlayStub },
        { provide: ActionSheetController, useValue: overlayStub },
        { provide: AlertController, useValue: overlayStub },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

});
