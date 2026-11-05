import { finalize } from 'rxjs';
import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, afterNextRender, inject, Injector } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CommercialService, PlanCard } from '../../services/commercial.service';
import { PlanArtComponent } from './plan-art.component';
import { PLAN_DETAILS } from './plan-details';
@Component({
  selector: 'app-plans',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CommonModule, RouterLink, PlanArtComponent],
  styleUrls: ['./commercial.css', './plans-showcase.css'],
  template: ` <div class="commercial-page plans-showcase">
    <nav class="commercial-nav" aria-label="Navegação principal">
      <a routerLink="/plans"><img src="/pingo-chef-logo-principal.webp" alt="PingoChef" /></a
      ><a routerLink="/login">Já tenho uma conta</a>
    </nav>
    <header class="hero">
      <span class="eyebrow"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2 6 7 3-7 2-2 7-2-7-7-2 7-3 2-6Z"/></svg>Seu cardápio, seu próximo passo</span>
      <h1>Mais personalidade.<br/><span>Mais possibilidades.</span></h1>
      <p>
        Do primeiro cardápio à sua próxima fase. Encontre o plano que combina com o momento do seu negócio.
      </p>
      <span class="explore-hint"><span></span>Selecione um plano e descubra o que ele pode fazer pelo seu negócio.</span>
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
        <article class="plan-card" [attr.data-plan]="plan.code" [class.recommended]="plan.code === 'MEDIUM'" [class.is-selected]="selectedCode === plan.code" (click)="explore(plan, true)">
          <span class="plan-particles" aria-hidden="true"></span>
          <div class="plan-topline"><span class="plan-symbol"><app-plan-art [kind]="plan.code" /></span><span class="recommendation">Recomendado</span></div>
          <h2>{{ plan.name }}</h2>
          <p class="profile">{{ plan.profile }}</p>
          <div class="price">{{ price(plan.priceCents) }}</div>
          <span class="period">{{
            plan.code === 'FREE' ? 'Para começar, sem mensalidade' : 'por mês'
          }}</span>
          <div class="plan-capacity"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/></svg><strong>{{ plan.products }}</strong> produtos</span><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg><strong>{{ plan.categories }}</strong> categorias</span></div>
          <ul class="plan-features">
            <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>{{ plan.videos > 0 ? plan.videos + ' vídeos de produtos' : 'Fotos para seus produtos' }}</li>
            @for (feature of plan.features; track feature) {
              <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>{{ feature }}</li>
            }
            @if (plan.code === 'FREE') {
              <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>Editor e publicação do cardápio</li>
              <li class="not-included"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>Vídeos a partir do Basic</li>
            }
          </ul>
          <div class="plan-spotlight"><app-plan-art [kind]="details[plan.code].art" /><span>{{ details[plan.code].label }}</span></div>
          <button type="button" class="explore-plan" [attr.aria-label]="'Explorar plano ' + plan.name" [attr.aria-expanded]="selectedCode === plan.code" aria-controls="plan-detail" (click)="$event.stopPropagation(); explore(plan, true)">{{ selectedCode === plan.code ? 'Explorando este plano' : 'Explorar os recursos' }} <span aria-hidden="true">↗</span></button>
          @if (plan.available) { <button
            class="button"
            [class.primary]="plan.available"
            [disabled]="selecting"
            (click)="$event.stopPropagation(); choose(plan)"
          >
            {{ selecting ? 'Preparando…' : 'Começar no Free' }} <span aria-hidden="true">→</span>
          </button>
          } @else { <a class="button plan-contact" [href]="contact(plan)" (click)="$event.stopPropagation()">Conhecer o {{ plan.name }} <span aria-hidden="true">↗</span></a> }
          <span class="plan-footer-note">{{ plan.code === 'FREE' ? 'Seu primeiro passo começa aqui' : 'Converse com o atendimento' }}</span>
        </article>
      }
    </section>
    <div id="plan-detail" class="detail-anchor" aria-live="polite">
      @if (activePlan; as plan) {
        <section class="plan-detail" [attr.data-plan]="plan.code" aria-labelledby="detail-title">
          <div class="detail-intro">
            <span class="detail-eyebrow">{{ plan.name }} <span> / </span> {{ details[plan.code].tagline }}</span>
            <h2 id="detail-title" tabindex="-1">{{ details[plan.code].title }}</h2>
            <p>{{ details[plan.code].description }}</p>
            <div class="detail-limits"><span>{{ plan.products }} produtos</span><span>{{ plan.categories }} categorias</span><span>{{ plan.videos ? plan.videos + ' vídeos' : 'Sem mensalidade' }}</span></div>
          </div>
          <div class="detail-art" aria-hidden="true"><span class="orbit orbit-one"></span><span class="orbit orbit-two"></span><div class="floating-sculpture"><app-plan-art [kind]="details[plan.code].art" /></div><span class="art-caption">{{ details[plan.code].label }}</span></div>
          <div class="detail-features">
            @for (feature of details[plan.code].highlights; track feature.title) {
              <div class="detail-feature"><app-plan-art [kind]="feature.icon" /><div><h3>{{ feature.title }}</h3><p>{{ feature.description }}</p></div></div>
            }
          </div>
          <div class="detail-bottom"><span>Explore. Compare. Escolha o seu próximo passo.</span><button type="button" (click)="closeDetails()">Fechar detalhes <span aria-hidden="true">×</span></button></div>
        </section>
      }
    </div>
    <p class="price-note">
      Os preços pagos são uma apresentação provisória e podem mudar antes do lançamento. A
      contratação e a cobrança ainda não estão disponíveis. Não há checkout ou pagamento nesta
      etapa.
    </p>
    <p class="price-note">
      <a routerLink="/dashboard">Já tem um plano? Voltar ao painel</a> ·
      <a href="mailto:pingochefcardapio@gmail.com">Fale com o PingoChef</a>
    </p>
  </div>`,
})
export class PlansComponent implements OnInit {
  plans: PlanCard[] = [];
  loading = true;
  selecting = false;
  error = '';
  selectedCode: string | null = null;
  readonly details = PLAN_DETAILS;
  private readonly injector = inject(Injector);
  get activePlan() { return this.plans.find(plan => plan.code === this.selectedCode); }
  explore(plan: PlanCard, reveal = false) {
    this.selectedCode = plan.code;
    if (reveal) afterNextRender(() => {
      document.getElementById('plan-detail')?.scrollIntoView({ block: 'start', behavior: 'instant' });
      document.getElementById('detail-title')?.focus({ preventScroll: true });
    }, { injector: this.injector });
  }
  closeDetails() {
    const code = this.selectedCode;
    this.selectedCode = null;
    afterNextRender(() => document.querySelector<HTMLButtonElement>(`[data-plan="${code}"] .explore-plan`)?.focus(), { injector: this.injector });
  }
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
  contact(plan: PlanCard): string {
    return 'mailto:pingochefcardapio@gmail.com?subject=' + encodeURIComponent('Quero conhecer o plano ' + plan.name + ' do PingoChef');
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
