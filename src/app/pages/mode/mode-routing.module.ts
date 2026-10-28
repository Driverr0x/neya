import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ModePage } from './mode.page';

const routes: Routes = [
  {
    path: '',
    component: ModePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ModePageRoutingModule {}
