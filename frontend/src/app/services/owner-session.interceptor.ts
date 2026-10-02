import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { catchError, throwError, tap } from 'rxjs';
import { API_BASE_URL } from '../constants/api';
import { OwnerSessionState } from './owner-session-state.service';

export const ownerSessionInterceptor: HttpInterceptorFn = (request, next) => {
  const document = inject(DOCUMENT);
  const state = inject(OwnerSessionState);
  const base = new URL(API_BASE_URL + '/', document.baseURI);
  const url = new URL(request.url, document.baseURI);
  const path = url.pathname.slice(base.pathname.length);
  const ownerRequest = url.origin === base.origin && url.pathname.startsWith(base.pathname)
    && !/^(admin|public|webhooks|internal|health)(\/|$)/.test(path);
  if (!ownerRequest) return next(request);
  const csrf = state.csrfToken();
  const hadSession=Boolean(state.currentUser());
  let headers = request.headers;
  if (csrf && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) headers = headers.set('X-CSRF-Token', csrf);
  return next(request.clone({ withCredentials: true, headers })).pipe(tap(event=>{
    if(event instanceof HttpResponse && !['GET','HEAD','OPTIONS'].includes(request.method) && /^(items|categories|business|design)(\/|$)/.test(path))state.usageVersion.update(v=>v+1);
  }),catchError(error => {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      state.clear();
      if(!path.startsWith('auth/')||(path==='auth/me'&&hadSession))state.sessionExpired.set(true);
    }
    return throwError(() => error);
  }));
};
