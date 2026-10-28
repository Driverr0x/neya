import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular/lazy';

import { MessagePageRoutingModule } from './message-routing.module';

import { MessagePage } from './message.page';
import { BrandHeaderComponent } from '../../shared/brand-header.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BrandHeaderComponent,
    MessagePageRoutingModule
  ],
  declarations: [MessagePage]
})
export class MessagePageModule {}
