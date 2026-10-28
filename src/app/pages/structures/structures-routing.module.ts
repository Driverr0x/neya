import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { StructuresPage } from './structures.page';

const routes: Routes = [
  {
    path: '',
    component: StructuresPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class StructuresPageRoutingModule {}
