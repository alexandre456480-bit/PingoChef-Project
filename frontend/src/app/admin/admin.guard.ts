import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AdminApiService } from './admin-api.service';

export const adminGuard: CanActivateFn = () => {
  const api = inject(AdminApiService);
  const router = inject(Router);
  return api.session().pipe(map(allowed => allowed ? true : router.createUrlTree(['/admin/login'])));
};
