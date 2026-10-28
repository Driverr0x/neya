import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: 'logo', pathMatch: 'full' },
  { path: 'accueil', redirectTo: 'tabs/info', pathMatch: 'full' },
  { path: 'evaluer', redirectTo: 'questionnaire', pathMatch: 'full' },
  { path: 'infos', redirectTo: 'info', pathMatch: 'full' },
  { path: 'home', redirectTo: 'tabs/info', pathMatch: 'full' },
  {
    path: 'info',
    loadChildren: () => import('./pages/infos/infos.module').then((m) => m.InfosPageModule),
  },
  {
    path: 'questionnaire',
    loadChildren: () =>
      import('./pages/questionnaire/questionnaire.module').then((m) => m.QuestionnairePageModule),
  },
  {
    path: 'contact/confirmation/:kind',
    loadChildren: () =>
      import('./pages/confirmation/confirmation.module').then((m) => m.ConfirmationPageModule),
  },
  {
    path: 'contact',
    loadChildren: () => import('./pages/contact/contact.module').then((m) => m.ContactPageModule),
  },
  {
    path: 'confirmation',
    loadChildren: () =>
      import('./pages/confirmation/confirmation.module').then((m) => m.ConfirmationPageModule),
  },
  {
    path: 'structures',
    loadChildren: () =>
      import('./pages/structures/structures.module').then((m) => m.StructuresPageModule),
  },
  {
    path: 'mode',
    loadChildren: () => import('./pages/mode/mode.module').then((m) => m.ModePageModule),
  },
  {
    path: 'message',
    loadChildren: () => import('./pages/message/message.module').then((m) => m.MessagePageModule),
  },
  {
    path: 'tabs',
    loadChildren: () => import('./pages/tabs/tabs.module').then((m) => m.TabsPageModule),
  },
  {
    path: 'logo',
    loadChildren: () => import('./pages/logo/logo.module').then((m) => m.LogoPageModule),
  },
  {
    path: 'professional-access',
    loadComponent: () =>
      import('./pages/professional-access/professional-access.page').then((m) => m.ProfessionalAccessPage),
  },
  {
    path: 'professional-dashboard',
    loadComponent: () =>
      import('./pages/professional-dashboard/professional-dashboard.page').then((m) => m.ProfessionalDashboardPage),
  },
  { path: '**', redirectTo: 'tabs/info' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
