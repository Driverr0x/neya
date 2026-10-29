import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: 'logo', pathMatch: 'full' },
  { path: 'accueil', redirectTo: 'tabs/info', pathMatch: 'full' },
  { path: 'evaluer', redirectTo: 'tabs/questionnaire', pathMatch: 'full' },
  { path: 'infos', redirectTo: 'tabs/info', pathMatch: 'full' },
  { path: 'home', redirectTo: 'tabs/info', pathMatch: 'full' },
  // Anciennes adresses hors onglets : redirigées vers les onglets pour n'avoir qu'une seule pile de pages.
  { path: 'info', redirectTo: 'tabs/info', pathMatch: 'full' },
  { path: 'info/:id', redirectTo: 'tabs/info/:id' },
  { path: 'questionnaire', redirectTo: 'tabs/questionnaire', pathMatch: 'full' },
  { path: 'contact/confirmation/:kind', redirectTo: 'tabs/confirmation/:kind' },
  { path: 'contact', redirectTo: 'tabs/contact', pathMatch: 'full' },
  { path: 'contact/:id', redirectTo: 'tabs/contact/:id' },
  { path: 'confirmation', redirectTo: 'tabs/confirmation/rdv', pathMatch: 'full' },
  { path: 'structures', redirectTo: 'tabs/structures', pathMatch: 'full' },
  { path: 'message', redirectTo: 'tabs/messages', pathMatch: 'full' },
  { path: 'message/:id', redirectTo: 'tabs/messages/:id' },
  {
    path: 'mode',
    loadChildren: () => import('./pages/mode/mode.module').then((m) => m.ModePageModule),
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
  {
    path: 'neya-admin',
    loadComponent: () => import('./pages/neya-admin/neya-admin.page').then((m) => m.NeyaAdminPage),
  },
  { path: '**', redirectTo: 'tabs/info' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
