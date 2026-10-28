import { NgModule } from '@angular/core';
import { TabsPageRoutingModule } from './tabs-routing.module';
import { TabsPage } from './tabs.page';

@NgModule({
  imports: [TabsPage, TabsPageRoutingModule],
})
export class TabsPageModule {}
