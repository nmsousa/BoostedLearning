import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { CoursePageModule } from './course.module';
import { CoursePage } from './course.page';

describe('CoursePage', () => {
  let component: CoursePage;
  let fixture: ComponentFixture<CoursePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoursePageModule, RouterModule.forRoot([])]
    }).compileComponents();

    fixture = TestBed.createComponent(CoursePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
