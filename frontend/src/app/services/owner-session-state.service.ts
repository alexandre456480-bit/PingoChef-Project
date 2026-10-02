import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class OwnerSessionState {
  usageVersion=signal(0);
  sessionExpired=signal(false);
  csrfToken = signal<string | null>(null);
  currentUser = signal<any>(null);
  currentBusiness = signal<any>(null);
  account = signal<any>(null);
  accept(data: any): void {
    this.sessionExpired.set(false);
    this.csrfToken.set(data.csrfToken || null);
    this.currentUser.set(data.user || null);
    this.currentBusiness.set(data.business || null);
    this.account.set(data);
  }
  clear(): void {
    this.csrfToken.set(null); this.currentUser.set(null); this.currentBusiness.set(null); this.account.set(null);
  }
}
