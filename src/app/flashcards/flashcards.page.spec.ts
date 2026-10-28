import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { FlashcardsPageModule } from './flashcards.module';
import { FlashcardsPage } from './flashcards.page';

describe('FlashcardsPage', () => {
  let component: FlashcardsPage;
  let fixture: ComponentFixture<FlashcardsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlashcardsPageModule, RouterModule.forRoot([])]
    }).compileComponents();

    fixture = TestBed.createComponent(FlashcardsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
