import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { SessionPageModule } from './session.module';
import { SessionPage } from './session.page';

describe('SessionPage', () => {
  let component: SessionPage;
  let fixture: ComponentFixture<SessionPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // The page navigates to /home and /progress during its lifecycle, so the
      // test router needs routes for those paths to avoid unhandled rejections.
      imports: [
        SessionPageModule,
        RouterModule.forRoot([
          { path: 'home', children: [] },
          { path: 'progress', children: [] }
        ])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SessionPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
