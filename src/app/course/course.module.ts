import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular/lazy';

import { CoursePageRoutingModule } from './course-routing.module';

import { CoursePage } from './course.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CoursePageRoutingModule
  ],
  declarations: [CoursePage]
})
export class CoursePageModule {}
