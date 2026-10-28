import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'info',
        loadChildren: () => import('../infos/infos.module').then((m) => m.InfosPageModule),
      },
      {
        path: 'questionnaire',
        loadChildren: () =>
          import('../questionnaire/questionnaire.module').then((m) => m.QuestionnairePageModule),
      },
      {
        path: 'contact',
        loadChildren: () => import('../contact/contact.module').then((m) => m.ContactPageModule),
      },
      {
        path: 'messages',
        loadChildren: () => import('../message/message.module').then((m) => m.MessagePageModule),
      },
      {
        path: 'structures',
        loadChildren: () =>
          import('../structures/structures.module').then((m) => m.StructuresPageModule),
      },
      {
        path: 'confirmation/:kind',
        loadChildren: () =>
          import('../confirmation/confirmation.module').then((m) => m.ConfirmationPageModule),
      },
      { path: '', redirectTo: 'info', pathMatch: 'full' },
      { path: 'accueil', redirectTo: 'info', pathMatch: 'full' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TabsPageRoutingModule {}
