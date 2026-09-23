import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { ActivateComponent } from './pages/activate/activate.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { PublicMenuComponent } from './pages/public-menu/public-menu.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'activate', component: ActivateComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'm/:slug', component: PublicMenuComponent },
  { path: 'c/:slug', redirectTo: 'm/:slug', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];
