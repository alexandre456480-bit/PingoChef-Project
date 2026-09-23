import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MuxPlayerLoaderService {
  private loading: Promise<unknown> | null = null;

  load(): Promise<unknown> {
    this.loading ??= import('@mux/mux-player');
    return this.loading;
  }
}
