import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { InfosPage } from './infos.page';

const routes: Routes = [
  {
    path: ':id',
    component: InfosPage
  },
  {
    path: '',
    component: InfosPage
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class InfosPageRoutingModule {}
