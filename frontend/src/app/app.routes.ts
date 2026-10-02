import { Routes } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { PublicMenuComponent } from './pages/public-menu/public-menu.component';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './admin/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: () => inject(DOCUMENT).location.hostname === 'admin.pingochef.com'
    ? 'admin/login' : 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'admin', redirectTo: 'admin/overview', pathMatch: 'full' },
  { path: 'admin/login', loadComponent: () => import('./admin/admin-login.component').then(m => m.AdminLoginComponent) },
  { path: 'admin/clients/:id', canActivate: [adminGuard], loadComponent: () => import('./admin/admin-workspace.component').then(m => m.AdminWorkspaceComponent), data: { section: 'clients' } },
  { path: 'admin/:section', canActivate: [adminGuard], loadComponent: () => import('./admin/admin-workspace.component').then(m => m.AdminWorkspaceComponent) },
  { path: 'm/:slug', component: PublicMenuComponent },
  { path: 'c/:slug', redirectTo: 'm/:slug', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];
