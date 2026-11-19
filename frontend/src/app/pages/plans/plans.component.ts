import { finalize } from 'rxjs';
import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, afterNextRender, inject, Injector, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CommercialService, PlanCard } from '../../services/commercial.service';
import { PlanArtComponent } from './plan-art.component';
import { PLAN_DETAILS } from './plan-details';
import { LandingRevealDirective } from '../landing/landing-reveal.directive';
@Component({
  selector: 'app-plans',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CommonModule, RouterLink, PlanArtComponent, LandingRevealDirective],
  styleUrls: ['./commercial.css', './plans-showcase.css', './plans-carousel.css'],
  template: ` <div class="commercial-page plans-showcase" [class.plans-embedded]="embedded()">
    @if (embedded() && plans.length) {
      <div class="carousel-atmosphere" [attr.data-plan]="plans[carouselIndex].code" aria-hidden="true">
        @for (particle of particles; track $index) {
          <span class="carousel-particle" [attr.data-shape]="particle.shape"
            [style.--x.%]="particle.x" [style.--y.%]="particle.y" [style.--size.px]="particle.size"
            [style.--delay.s]="particle.delay" [style.--duration.s]="particle.duration"></span>
        }
      </div>
    }
    @if (!embedded()) {
    <nav class="commercial-nav" aria-label="Navegação principal">
      <a routerLink="/plans"><img src="/pingo-chef-logo-principal.webp" alt="PingoChef" /></a
      ><a routerLink="/login">Já tenho uma conta</a>
    </nav>
    }
    <header class="hero" landingReveal>
      @if (embedded()) {
        <h2 class="embedded-title" data-enter="title">Encontre seu plano.<br/><span>Faça seu cardápio crescer.</span></h2>
        <p data-enter="copy" data-enter-delay="155">Compare os recursos e escolha o plano que combina com o seu negócio.</p>
      } @else {
      <span class="eyebrow"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2 6 7 3-7 2-2 7-2-7-7-2 7-3 2-6Z"/></svg>Seu cardápio, seu próximo passo</span>
      <h1>Mais personalidade.<br/><span>Mais possibilidades.</span></h1>
      <p>
        Do primeiro cardápio à sua próxima fase. Encontre o plano que combina com o momento do seu negócio.
      </p>
      }
    </header>
    @if (error) {
      <div class="center-card error" role="alert">
        {{ error }} <button class="button" (click)="load()">Tentar novamente</button>
      </div>
    }
    @if (loading) {
      <div class="busy" role="status">Carregando os planos…</div>
    }
    @if (plans.length) {
    <div class="plan-stage" landingReveal data-enter="deck" data-enter-delay="90"
      [attr.data-plan]="embedded() ? plans[carouselIndex].code : null">
    <section class="plan-grid" aria-label="Comparação de planos" [class.plan-carousel]="embedded()"
      (keydown)="onCarouselKey($event)" (touchstart)="onCarouselTouchStart($event)" (touchend)="onCarouselTouchEnd($event)"
      (touchmove)="onCarouselTouchMove($event)" (touchcancel)="onCarouselTouchCancel()"
      [class.is-dragging]="carouselDrag !== 0" [style.--swipe-offset.px]="carouselDrag">
      @for (plan of plans; track plan.code) {
        <article class="plan-card" [attr.data-plan]="plan.code"
          [attr.data-slot]="embedded() ? carouselSlot($index) : null"
          [inert]="embedded() && $index !== carouselIndex"
          [class.recommended]="plan.code === 'MEDIUM'" [class.is-selected]="selectedCode === plan.code" (click)="explore(plan, true)">
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
          <button type="button" class="explore-plan" [attr.aria-label]="'Explorar plano ' + plan.name" [attr.aria-expanded]="selectedCode === plan.code" aria-controls="plan-detail" (click)="$event.stopPropagation(); explore(plan, true)">{{ selectedCode === plan.code ? 'Explorando este plano' : 'Explorar os recursos' }}
            @if (!embedded()) { <span aria-hidden="true">↗</span> }
          </button>
          @if (plan.available) { <button
            class="button"
            [class.primary]="plan.available"
            [disabled]="selecting"
            (click)="$event.stopPropagation(); choose(plan)"
          >
            {{ selecting ? 'Preparando…' : 'Começar no Free' }}
            @if (!embedded()) { <span aria-hidden="true">→</span> }
          </button>
          } @else {
            <a class="button plan-contact" [href]="contact(plan)" (click)="$event.stopPropagation()">Conhecer o {{ plan.name }}
              @if (!embedded()) { <span aria-hidden="true">↗</span> }
            </a>
          }
          <span class="plan-footer-note">{{ plan.code === 'FREE' ? 'Seu primeiro passo começa aqui' : 'Converse com o atendimento' }}</span>
        </article>
      }
    </section>
    @if (embedded() && plans.length > 1) {
      <button type="button" class="carousel-arrow" aria-label="Próximo plano" (click)="movePlan(1)" (keydown)="onCarouselKey($event)">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
      </button>
      <span class="carousel-announcement" role="status">{{ plans[carouselIndex].name }}</span>
    }
    </div>
    }
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
    @if (!embedded()) {
    <p class="price-note">
      <a routerLink="/dashboard">Já tem um plano? Voltar ao painel</a> ·
      <a href="mailto:pingochefcardapio@gmail.com">Fale com o PingoChef</a>
    </p>
    }
  </div>`,
})
export class PlansComponent implements OnInit {
  readonly embedded = input(false);
  readonly particles = Array.from({ length: 30 }, (_, index) => ({
    x: 3 + (index * 37) % 94,
    y: 6 + (index * 29) % 87,
    size: index % 5 === 0 ? 14 : 3 + (index % 6),
    shape: index % 5 === 0 ? 'spark' : index % 3 === 0 ? 'diamond' : 'dot',
    delay: -(index * 1.31 % 9),
    duration: 6 + index % 5
  }));
  carouselIndex = 0;
  carouselDrag = 0;
  private touchStart?: { x: number; y: number };
  plans: PlanCard[] = [];
  loading = true;
  selecting = false;
  error = '';
  selectedCode: string | null = null;
  readonly details = PLAN_DETAILS;
  private readonly injector = inject(Injector);
  carouselSlot(index: number): 'current' | 'previous' | 'next' | 'hidden' {
    const count = this.plans.length;
    if (index === this.carouselIndex) return 'current';
    if (index === (this.carouselIndex + 1) % count) return 'next';
    if (index === (this.carouselIndex - 1 + count) % count) return 'previous';
    return 'hidden';
  }

  showPlan(index: number): void {
    if (index === this.carouselIndex) return;
    this.carouselIndex = index;
    this.selectedCode = null;
  }

  movePlan(step: number): void {
    const count = this.plans.length;
    if (count > 1) this.showPlan((this.carouselIndex + step + count) % count);
  }

  onCarouselKey(event: KeyboardEvent): void {
    if (!this.embedded() || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    this.movePlan(event.key === 'ArrowLeft' ? -1 : 1);
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.closest('.plans-embedded')?.querySelector<HTMLButtonElement>('.carousel-arrow')?.focus({ preventScroll: true });
    }
  }

  onCarouselTouchStart(event: TouchEvent): void {
    const touch = event.touches[0];
    this.touchStart = this.embedded() && event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : undefined;
  }

  onCarouselTouchMove(event: TouchEvent): void {
    const start = this.touchStart;
    const touch = event.touches[0];
    if (!start || event.touches.length !== 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const delta = touch.clientX - start.x;
    const vertical = touch.clientY - start.y;
    this.carouselDrag = Math.abs(delta) > Math.max(8, Math.abs(vertical) * 1.35)
      ? Math.max(-35, Math.min(35, delta * .35)) : 0;
  }

  onCarouselTouchCancel(): void {
    this.touchStart = undefined;
    this.carouselDrag = 0;
  }

  onCarouselTouchEnd(event: TouchEvent): void {
    const start = this.touchStart;
    this.onCarouselTouchCancel();
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const delta = touch.clientX - start.x;
    if (Math.abs(delta) > 45 && Math.abs(delta) > Math.abs(touch.clientY - start.y) * 1.35) {
      this.movePlan(delta < 0 ? 1 : -1);
    }
  }
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
          this.carouselIndex = 0;
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
      .startRegistration(plan.code)
      .pipe(finalize(() => {
        this.selecting = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        error: () => {
          this.error = 'Não foi possível preparar o cadastro. Tente novamente em instantes.';
        },
      });
  }
}
