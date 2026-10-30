import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { WordsPageModule } from './words.module';
import { WordsPage } from './words.page';

describe('WordsPage', () => {
  let component: WordsPage;
  let fixture: ComponentFixture<WordsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WordsPageModule, RouterModule.forRoot([])]
    }).compileComponents();

    fixture = TestBed.createComponent(WordsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
