import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PublicMenuViewComponent } from '../../components/public-menu-view/public-menu-view.component';
import {
  MenuLayoutHint,
  PublicMenuSkeletonComponent,
  menuLayoutHint,
} from '../../components/public-menu-view/public-menu-skeleton.component';
import { PublicMenuService } from '../../services/public-menu.service';
import { PublicAnalyticsService } from '../../services/public-analytics.service';
import { PublicVitalsService } from '../../services/public-vitals.service';
import { safeMenuImage } from '../../components/public-menu-view/menu-image.directive';
import { Subject, combineLatest, map, startWith, switchMap, takeUntil, tap, timer } from 'rxjs';

@Component({
  selector: 'app-public-menu',
  standalone: true,
  imports: [PublicMenuViewComponent, PublicMenuSkeletonComponent],
  template: ` <div class="public-page-shell">
    @if (!loading() && error) {
      <section class="public-error-screen" role="alert">
        <svg
          width="44"
          height="44"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v6m0 3h.01" />
        </svg>
        <h1>Não conseguimos abrir este cardápio.</h1>
        <p>{{ error }}</p>
        <button type="button" (click)="retry()">Tentar novamente</button>
        <span>Se o problema continuar, avise o estabelecimento.</span>
      </section>
    } @else {
      <main class="public-app-container" [attr.aria-busy]="loading()">
        @defer (when !loading(); prefetch on immediate) {
          @if (loading()) {
            <app-public-menu-skeleton
              [layout]="layout"
              [visible]="skeletonVisible()"
            ></app-public-menu-skeleton>
          } @else {
            <app-public-menu-view
              [isPhonePreview]="false"
              [publicSlug]="slug"
            ></app-public-menu-view>
          }
        } @placeholder {
          <app-public-menu-skeleton
            [layout]="layout"
            [visible]="skeletonVisible()"
          ></app-public-menu-skeleton>
        } @loading (after 120ms; minimum 120ms) {
          <app-public-menu-skeleton [layout]="layout" [visible]="true"></app-public-menu-skeleton>
        }
      </main>
    }
  </div>`,
  styles: [
    `
      :host {
        display: block;
        min-height: 100dvh;
        background: #09090b;
      }
      .public-page-shell {
        min-height: 100dvh;
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: stretch;
        background: #09090b;
        color: #f4f4f5;
        font-family: Inter, system-ui, sans-serif;
      }
      .public-app-container {
        width: 100%;
        max-width: 480px;
        height: 100vh;
        height: 100dvh;
        display: flex;
        flex-direction: column;
        background: #faf5f0;
        position: relative;
      }
      .public-app-container > app-public-menu-skeleton {
        flex: 1;
      }
      .public-error-screen {
        display: grid;
        align-content: center;
        justify-items: center;
        gap: 18px;
        min-height: 100dvh;
        max-width: 400px;
        padding: 32px 24px;
        text-align: center;
      }
      .public-error-screen > svg {
        color: #f47b20;
      }
      h1 {
        margin: 0;
        font-size: 24px;
        line-height: 1.3;
      }
      p {
        margin: 0;
        color: #d4d4d8;
        font-size: 15px;
        line-height: 1.6;
      }
      button {
        min-height: 48px;
        padding: 12px 24px;
        border: 0;
        border-radius: 12px;
        background: #f47b20;
        color: #20110a;
        font:
          600 15px Inter,
          system-ui,
          sans-serif;
        cursor: pointer;
      }
      button:focus-visible {
        outline: 3px solid #fff;
        outline-offset: 4px;
      }
      .public-error-screen > span {
        font-size: 13px;
        color: #b2abb3;
        line-height: 1.5;
      }
    `,
  ],
})
export class PublicMenuComponent implements OnInit, OnDestroy {
  slug = '';
  readonly loading = signal(true);
  readonly skeletonVisible = signal(false);
  layout: MenuLayoutHint = menuLayoutHint();
  private readonly destroyed = new Subject<void>();
  private readonly retries = new Subject<void>();
  private skeletonTimer?: ReturnType<typeof setTimeout>;
  private skeletonStarted = 0;
  private readonly previousTitle = document.title;
  constructor(
    private route: ActivatedRoute,
    public publicMenuService: PublicMenuService,
    private analytics: PublicAnalyticsService,
    private vitals: PublicVitalsService,
  ) {}
  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.retries.pipe(startWith(undefined))])
      .pipe(
        takeUntil(this.destroyed),
        tap(([params]) => {
          this.analytics.endPage();
          this.slug = params.get('slug') || '';
          this.loading.set(true);
          this.skeletonVisible.set(false);
          this.skeletonStarted = 0;
          clearTimeout(this.skeletonTimer);
          this.restoreLayoutHint();
          this.skeletonTimer = setTimeout(() => {
            this.skeletonStarted = performance.now();
            this.skeletonVisible.set(true);
          }, 120);
          performance.mark('pc:menu:request-start');
        }),
        switchMap(() =>
          this.publicMenuService.loadPublicMenu(this.slug).pipe(
            switchMap((data) => {
              performance.mark('pc:menu:response');
              performance.measure('pc:menu:api', 'pc:menu:request-start', 'pc:menu:response');
              clearTimeout(this.skeletonTimer);
              const remaining = this.skeletonStarted
                ? Math.max(0, 120 - (performance.now() - this.skeletonStarted))
                : 0;
              return timer(remaining).pipe(map(() => data));
            }),
          ),
        ),
      )
      .subscribe((data) => {
        this.loading.set(false);
        if (!data || this.error) {
          try {
            sessionStorage.removeItem('pc-menu-layout:' + this.slug);
          } catch {}
          return;
        }
        const menu = this.publicMenuService.menuData()!;
        this.layout = menuLayoutHint(menu.design);
        // Presentation hint only: never cache products, business identity or access.
        try {
          sessionStorage.setItem('pc-menu-layout:' + this.slug, JSON.stringify(this.layout));
        } catch {}
        document.title = menu.business.name + ' · Cardápio';
        const logo = safeMenuImage(menu.business.logoUrl);
        if (logo) this.setFavicon(logo);
        void this.vitals.start(this.slug, menu.design.templateKey);
        this.analytics.startPage(this.slug, {
          source: this.route.snapshot.queryParamMap.get('source'),
          utm_source: this.route.snapshot.queryParamMap.get('utm_source'),
          qr: this.route.snapshot.queryParamMap.get('qr'),
        });
        performance.mark('pc:menu:data-ready');
        performance.measure('pc:menu:ready', 'pc:menu:request-start', 'pc:menu:data-ready');
      });
  }
  retry(): void {
    if (!this.loading()) this.retries.next();
  }
  private restoreLayoutHint(): void {
    this.layout = menuLayoutHint();
    try {
      const value = JSON.parse(sessionStorage.getItem('pc-menu-layout:' + this.slug) || 'null');
      if (value)
        this.layout = menuLayoutHint({
          templateKey: value.templateKey,
          palette: {
            colors: {
              background: value.background,
              surface: value.surface,
              primary: value.primary,
            },
          },
        } as any);
    } catch {
      /* Storage is optional and cannot authorize a menu. */
    }
  }
  ngOnDestroy(): void {
    clearTimeout(this.skeletonTimer);
    this.destroyed.next();
    this.destroyed.complete();
    this.analytics.endPage();
    document.title = this.previousTitle;
    this.vitals.end();
    this.setFavicon('/icon_pinguim.webp', 'image/webp');
  }
  private setFavicon(href: string, type = ''): void {
    const favicon = document.querySelector<HTMLLinkElement>('#app-favicon');
    if (favicon) {
      favicon.href = href;
      favicon.type = type;
    }
  }
  get error(): string | null {
    return this.publicMenuService.error();
  }
}
