import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../../constants/api';
import { AuthService } from '../../../services/auth.service';
import { CommercialService } from '../../../services/commercial.service';
import { MenuService } from '../../../services/menu.service';
import { TUTORIAL_STEPS, TutorialContext, TutorialStep } from './tutorial.steps';

export interface TutorialProgress {
  tutorial_status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  tutorial_version: number; tutorial_step: string;
}
export interface TutorialHost {
  prepare(step: TutorialStep): void | Promise<void>;
  restore(): void;
}
@Injectable()
export class TutorialService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private commercial = inject(CommercialService);
  private menu = inject(MenuService);
  private destroyRef = inject(DestroyRef);
  private url = `${API_BASE_URL}/business/tutorial`;
  private host?: TutorialHost;
  private pending: Promise<unknown> = Promise.resolve();
  private destroyed = false;
  readonly active = signal(false);
  readonly bottomReserve = signal(0);
  readonly busy = signal(false);
  readonly index = signal(0);
  readonly error = signal('');
  readonly steps = signal<readonly TutorialStep[]>([]);
  readonly step = computed(() => this.steps()[this.index()]);
  readonly restored = signal(false);
  private attempted = false;

  constructor() { this.destroyRef.onDestroy(() => { this.destroyed = true; this.host?.restore(); }); }
  context(): TutorialContext {
    const permissions = this.auth.account()?.entitlements;
    return { qr: this.commercial.qr(), analytics: this.commercial.analytics(),
      video: permissions?.VIDEO_UPLOAD === true && Number(permissions?.MAX_VIDEOS ?? 0) > 0,
      categories: this.menu.categories().length > 0, mobile: window.innerWidth <= 1100 };
  }
  connect(host: TutorialHost) { this.host = host; }
  private request(action: string, step: string): Promise<TutorialProgress> {
    // Serialize writes so rapid navigation cannot persist an older step last.
    const result = this.pending.catch(() => undefined).then(async () => {
      if (this.destroyed) throw new Error('Tutorial destroyed');
      const response = await firstValueFrom(this.http.patch<{ data: TutorialProgress }>(this.url,
        { action, step, version: 1 }).pipe(takeUntilDestroyed(this.destroyRef)));
      return response.data;
    });
    this.pending = result;
    return result;
  }
  async autoStart() {
    if (this.attempted) return;
    this.attempted = true;
    try {
      const response = await firstValueFrom(this.http.get<{ data: TutorialProgress }>(this.url)
        .pipe(takeUntilDestroyed(this.destroyRef)));
      if (!response.data || !['NOT_STARTED', 'IN_PROGRESS'].includes(response.data.tutorial_status)) return;
      await this.start(false);
    } catch { /* Optional guide must never block the dashboard. Manual restart remains available. */ }
  }
  async start(restart = true) {
    if (this.busy() || this.destroyed || this.active()) return;
    this.busy.set(true); this.error.set('');
    try {
      const progress = await this.request(restart ? 'restart' : 'start', 'welcome');
      if (this.destroyed || progress.tutorial_status !== 'IN_PROGRESS') return;
      const steps = TUTORIAL_STEPS.filter(step => !step.condition || step.condition(this.context()));
      this.steps.set(steps);
      this.index.set(restart ? 0 : Math.max(0, steps.findIndex(step => step.id === progress.tutorial_step)));
      this.restored.set(!restart && progress.tutorial_step !== 'welcome');
      this.active.set(true);
    } catch { this.error.set('Não foi possível abrir o tutorial. Tente novamente.'); }
    finally { if (!this.destroyed) this.busy.set(false); }
  }
  prepare() { const step = this.step(); if (step) return this.host?.prepare(step); }
  async move(delta: number) {
    const index = this.index() + delta;
    if (this.busy() || index < 0 || index >= this.steps().length) return;
    this.busy.set(true); this.error.set('');
    try {
      const state = await this.request('progress', this.steps()[index].id);
      if (state.tutorial_status !== 'IN_PROGRESS') { this.end(); return; }
      this.index.set(index); this.restored.set(false);
    } catch { this.error.set('Não foi possível salvar seu progresso. Tente novamente.'); }
    finally { if (!this.destroyed) this.busy.set(false); }
  }
  async finish(skip: boolean) {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    try { await this.request(skip ? 'skip' : 'complete', this.step().id); this.end(); }
    catch { this.error.set('Não foi possível salvar seu progresso. Tente novamente.'); }
    finally { if (!this.destroyed) this.busy.set(false); }
  }
  private end() { this.active.set(false); this.bottomReserve.set(0); this.host?.restore(); }
  closeForNow() { this.end(); }
}
