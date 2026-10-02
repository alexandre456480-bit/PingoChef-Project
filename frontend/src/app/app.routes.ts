import { Routes } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { LoginComponent } from './pages/login/login.component';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './admin/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: () => inject(DOCUMENT).location.hostname === 'admin.pingochef.com'
    ? 'admin/login' : 'plans', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'plans', loadComponent: () => import('./pages/plans/plans.component').then(m=>m.PlansComponent) },
  { path: 'terms', loadComponent:()=>import('./pages/plans/legal-information.component').then(m=>m.LegalInformationComponent) },
  { path: 'privacy', loadComponent:()=>import('./pages/plans/legal-information.component').then(m=>m.LegalInformationComponent),data:{privacy:true} },
  { path: 'register', loadComponent:()=>import('./pages/register/selected-register.component').then(m=>m.SelectedRegisterComponent) },
  { path: 'confirm-email', loadComponent:()=>import('./pages/login/confirm-email.component').then(m=>m.ConfirmEmailComponent) },
  { path: 'forgot-password', loadComponent: () => import('./pages/login/account-access.component').then(m => m.AccountAccessComponent), data: { mode: 'forgot' } },
  { path: 'reset-password', loadComponent: () => import('./pages/login/account-access.component').then(m => m.AccountAccessComponent), data: { mode: 'reset' } },
  { path: 'complete-registration', loadComponent: () => import('./pages/login/account-access.component').then(m => m.AccountAccessComponent), data: { mode: 'complete' } },
  { path: 'dashboard', loadComponent:()=>import('./pages/dashboard/dashboard.component').then(m=>m.DashboardComponent), canActivate: [authGuard] },
  { path: 'admin', redirectTo: 'admin/overview', pathMatch: 'full' },
  { path: 'admin/login', loadComponent: () => import('./admin/admin-login.component').then(m => m.AdminLoginComponent) },
  { path: 'admin/clients/:id', canActivate: [adminGuard], loadComponent: () => import('./admin/admin-workspace.component').then(m => m.AdminWorkspaceComponent), data: { section: 'clients' } },
  { path: 'admin/:section', canActivate: [adminGuard], loadComponent: () => import('./admin/admin-workspace.component').then(m => m.AdminWorkspaceComponent) },
  { path: 'm/:slug', loadComponent:()=>import('./pages/public-menu/public-menu.component').then(m=>m.PublicMenuComponent) },
  { path: 'q/:identifier', loadComponent:()=>import('./pages/public-menu/qr-entry.component').then(m=>m.QrEntryComponent) },
  { path: 'c/:slug', redirectTo: 'm/:slug', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];
