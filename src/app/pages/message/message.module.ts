import { NgModule } from '@angular/core';

import { MessagePageRoutingModule } from './message-routing.module';
import { MessagePage } from './message.page';

@NgModule({
  imports: [MessagePageRoutingModule, MessagePage],
})
export class MessagePageModule {}
