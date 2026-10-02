import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { take } from 'rxjs';
import { API_BASE_URL } from '../../constants/api';
@Component({
  selector: 'app-qr-entry',
  standalone: true,
  template: `<main>
    <h1>PingoChef</h1>
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    } @else {
      <p role="status">Abrindo o cardápio…</p>
    }
  </main>`,
  styles: [
    `
      :host {
        display: block;
        background: #1d0a18;
        min-height: 100vh;
        color: #fff9f4;
      }
      main {
        padding: 48px 24px;
        text-align: center;
        font-family: Inter, sans-serif;
      }
      h1 {
        font-family: Outfit, sans-serif;
      }
    `,
  ],
})
export class QrEntryComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);
  error = signal('');
  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('identifier') || '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      this.error.set('Este QR Code é inválido.');
      return;
    }
    this.http
      .get<{ data: { slug: string; qrId: string } }>(`${API_BASE_URL}/public/qr/${id}`, {
        withCredentials: false,
        credentials: 'omit',
      })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          if (
            !/^[a-z0-9][a-z0-9-]{0,99}$/.test(r.data?.slug) ||
            !/^[0-9a-f-]{36}$/i.test(r.data?.qrId)
          ) {
            this.error.set('Este QR Code não está disponível.');
            return;
          }
          void this.router.navigate(['/m', r.data.slug], {
            queryParams: { source: 'qr', qr: r.data.qrId },
            replaceUrl: true,
          });
        },
        error: () =>
          this.error.set('Este QR Code não está disponível. Confira com o estabelecimento.'),
      });
  }
}
