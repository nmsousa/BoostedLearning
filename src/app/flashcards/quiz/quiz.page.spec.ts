import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { QuizPageModule } from './quiz.module';
import { QuizPage } from './quiz.page';

describe('QuizPage', () => {
  let component: QuizPage;
  let fixture: ComponentFixture<QuizPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuizPageModule, RouterModule.forRoot([])]
    }).compileComponents();

    fixture = TestBed.createComponent(QuizPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
