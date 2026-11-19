import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AdminApiService, AdminSuggestion } from './admin-api.service';

@Component({
  selector: 'app-admin-suggestions',
  standalone: true,
  imports: [DatePipe],
  template: `
    <section class="admin-card admin-table-card" aria-label="Sugestões anônimas">
      @if (loading()) {
        <p role="status">Carregando sugestões…</p>
      } @else if (error()) {
        <p class="admin-inline-error" role="alert">Não foi possível carregar as sugestões.</p>
        <button type="button" class="admin-button" (click)="load(page)">Tentar novamente</button>
      } @else if (rows().length === 0 && page === 1) {
        <div class="admin-state"><p>Nenhuma sugestão recebida.</p></div>
      } @else {
        <ul class="suggestions-list">
          @for (row of rows(); track row.id) {
            <li>
              <time [attr.datetime]="row.created_on">{{ row.created_on | date:'dd/MM/yyyy' }}</time>
              <p>{{ row.message }}</p>
            </li>
          }
        </ul>
        <div class="admin-pagination">
          <span>Página {{ page }}</span>
          <div>
            <button type="button" [disabled]="page === 1" (click)="load(page - 1)">Anterior</button>
            <button type="button" [disabled]="!hasNext()" (click)="load(page + 1)">Próxima</button>
          </div>
        </div>
      }
    </section>
  `,
  styles: [`
    .suggestions-list { list-style: none; padding: 0; margin: 0; }
    li { padding: 16px 0; }
    li + li { border-top: 1px solid var(--ad-line); }
    time { color: var(--ad-muted); font-size: 12px; }
    li p { margin: 6px 0 0; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
    .admin-pagination { flex-wrap: wrap; }
  `],
})
export class AdminSuggestionsComponent {
  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly rows = signal<AdminSuggestion[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly hasNext = signal(false);
  page = 1;

  constructor() {
    this.load(1);
  }

  load(page: number): void {
    if (this.loading()) return;
    this.page = page;
    this.loading.set(true);
    this.error.set(false);
    this.api.suggestions(page).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: ({ data, pagination }) => {
        this.rows.set(data);
        this.hasNext.set(Boolean(pagination && page < 10000 && page * pagination.limit < pagination.total));
      },
      error: () => this.error.set(true),
    });
  }
}
