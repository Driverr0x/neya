import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular/lazy';

import { ModePageRoutingModule } from './mode-routing.module';

import { ModePage } from './mode.page';
import { BrandHeaderComponent } from '../../shared/brand-header.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BrandHeaderComponent,
    ModePageRoutingModule
  ],
  declarations: [ModePage]
})
export class ModePageModule {}
