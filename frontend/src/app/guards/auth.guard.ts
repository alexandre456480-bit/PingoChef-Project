import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { catchError, map, of } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.restore().pipe(
    map(response => response.data?.provisioningRequired ? router.createUrlTree(['/complete-registration'])
      : response.data?.accountActive ? true : router.createUrlTree(['/login'], { queryParams: { account: 'unavailable' } })),
    catchError(error => of(router.createUrlTree(['/login'],{queryParams:{session:error.status===401?'expired':'unavailable'}})))
  );
};
