import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { StudyPageModule } from './study.module';
import { StudyPage } from './study.page';

describe('StudyPage', () => {
  let component: StudyPage;
  let fixture: ComponentFixture<StudyPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudyPageModule, RouterModule.forRoot([])]
    }).compileComponents();

    fixture = TestBed.createComponent(StudyPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
