import { finalize } from 'rxjs';
import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CommercialService, PlanCard } from '../../services/commercial.service';
@Component({
  selector: 'app-plans',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CommonModule, RouterLink],
  styleUrl: './commercial.css',
  template: ` <div class="commercial-page">
    <nav class="commercial-nav" aria-label="Navegação principal">
      <a routerLink="/plans"><img src="/pingo_chef_logo_principal.webp" alt="PingoChef" /></a
      ><a routerLink="/login">Já tenho uma conta</a>
    </nav>
    <header class="hero">
      <span class="eyebrow">Seu cardápio, seu próximo passo</span>
      <h1>Um plano para cada momento do seu negócio.</h1>
      <p>
        Comece no Free. Conheça as opções para acompanhar seu crescimento, com limites claros e sem
        surpresas.
      </p>
    </header>
    @if (error) {
      <div class="center-card error" role="alert">
        {{ error }} <button class="button" (click)="load()">Tentar novamente</button>
      </div>
    }
    @if (loading) {
      <div class="busy" role="status">Carregando os planos…</div>
    }
    <section class="plan-grid" aria-label="Comparação de planos">
      @for (plan of plans; track plan.code) {
        <article class="plan-card" [class.recommended]="plan.code === 'MEDIUM'">
          <span class="recommendation">Mais recomendado</span>
          <h2>{{ plan.name }}</h2>
          <p class="profile">{{ plan.profile }}</p>
          <div class="price">{{ price(plan.priceCents) }}</div>
          <span class="period">{{
            plan.code === 'FREE' ? 'Grátis' : 'por mês · valor provisório'
          }}</span>
          <ul>
            <li>
              <strong>{{ plan.products }}</strong> produtos
            </li>
            <li>
              <strong>{{ plan.categories }}</strong> categorias
            </li>
            <li>
              <strong>{{ plan.videos }}</strong> {{ plan.videos === 1 ? 'vídeo' : 'vídeos' }}
            </li>
            @for (feature of plan.features; track feature) {
              <li>{{ feature }}</li>
            }
            @if (plan.code === 'FREE') {
              <li>Editor e publicação do cardápio</li>
            }
          </ul>
          <button
            class="button"
            [class.primary]="plan.available"
            [disabled]="!plan.available || selecting"
            (click)="choose(plan)"
          >
            {{ plan.available ? (selecting ? 'Preparando…' : 'Começar no Free') : 'Em breve' }}
          </button>
        </article>
      }
    </section>
    <p class="price-note">
      Os preços pagos são uma apresentação provisória e podem mudar antes do lançamento. A
      contratação e a cobrança ainda não estão disponíveis. Não há checkout ou pagamento nesta
      etapa.
    </p>
    <p class="price-note">
      <a routerLink="/dashboard">Já tem um plano? Voltar ao painel</a> ·
      <a href="mailto:pingochef@gmail.com">Fale com o PingoChef</a>
    </p>
  </div>`,
})
export class PlansComponent implements OnInit {
  plans: PlanCard[] = [];
  loading = true;
  selecting = false;
  error = '';
  constructor(
    private commercial: CommercialService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}
  ngOnInit() {
    this.load();
  }
  price(cents: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
      cents / 100,
    );
  }
  load() {
    this.loading = true;
    this.error = '';
    this.commercial
      .plans()
      .pipe(finalize(() => this.cdr.markForCheck()))
      .subscribe({
        next: (r) => {
          this.plans = r.data.plans;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.error =
            'Não foi possível carregar os planos. Confira sua conexão e tente novamente.';
        },
      });
  }
  choose(plan: PlanCard) {
    if (!plan.available || this.selecting) return;
    this.selecting = true;
    this.commercial
      .select(plan.code)
      .pipe(finalize(() => this.cdr.markForCheck()))
      .subscribe({
        next: (r) => this.router.navigate(['/register'], { queryParams: { intent: r.data.id } }),
        error: () => {
          this.selecting = false;
          this.error = 'Não foi possível preparar o cadastro. Tente novamente em instantes.';
        },
      });
  }
}
