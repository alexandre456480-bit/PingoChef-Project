import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  LucideDynamicIcon,
  LucidePackage,
  LucideList,
  LucideLink,
  LucideHeart,
  LucideRocket,
  LucideChartNoAxesCombined,
  LucideCheck,
  LucideArrowRight,
  LucideEye,
  LucidePlay,
  LucideQrCode,
  LucidePlus,
  LucidePalette,
  LucideExternalLink,
  LucideChevronRight,
  LucideClipboardCheck,
  LucideZap,
} from '@lucide/angular';
import { AuthService } from '../../../../services/auth.service';
import { MenuService } from '../../../../services/menu.service';
import { AnalyticsReport, AnalyticsService } from '../../../../services/analytics.service';
import { CommercialService } from '../../../../services/commercial.service';
import { PlanUsageComponent } from '../../../../components/plan-usage/plan-usage.component';
import { ActiveSection } from '../../components/sidebar/sidebar.component';
import { buildPublicMenuUrl } from '../../../../constants/public-menu';

interface Step {
  label: string;
  route: ActiveSection;
  done: boolean;
}
interface NextAction {
  title: string;
  description: string;
  cta: string;
  route: ActiveSection;
}

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [CommonModule, RouterLink, PlanUsageComponent, LucideDynamicIcon],
  templateUrl: './dashboard-home.component.html',
  styleUrl: './dashboard-home.component.css',
})
export class DashboardHomeComponent implements OnInit, OnChanges {
  @Input() loading = false;
  @Input() dataError = '';
  @Output() navigateTo = new EventEmitter<ActiveSection>();
  @Output() onToast = new EventEmitter<string>();
  readonly auth = inject(AuthService);
  readonly menu = inject(MenuService);
  readonly commercial = inject(CommercialService);
  private readonly analytics = inject(AnalyticsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  readonly icons = {
    product: LucidePackage,
    categories: LucideList,
    link: LucideLink,
    heart: LucideHeart,
    rocket: LucideRocket,
    chart: LucideChartNoAxesCombined,
    check: LucideCheck,
    arrow: LucideArrowRight,
    eye: LucideEye,
    play: LucidePlay,
    qr: LucideQrCode,
    plus: LucidePlus,
    design: LucidePalette,
    external: LucideExternalLink,
    chevron: LucideChevronRight,
    steps: LucideClipboardCheck,
    quick: LucideZap,
  };
  readonly report = signal<AnalyticsReport | null>(null);
  readonly performanceLoading = signal(false);
  readonly performanceError = signal('');
  readonly expandedSteps = signal(false);
  readonly businessName = computed(
    () => this.auth.currentBusiness()?.name?.trim() || 'Pingo Chefinho',
  );
  readonly totalItems = computed(() => this.menu.items().length);
  readonly totalCategories = computed(() => this.menu.categories().length);
  readonly published = computed(() => this.auth.account()?.isPublished === true);
  readonly publicLink = computed(() => {
    const slug = this.auth.currentBusiness()?.slug;
    return slug ? buildPublicMenuUrl(slug) : null;
  });
  readonly photoCount = computed(
    () =>
      this.menu
        .items()
        .filter(
          (item) =>
            !!item.imageUrl?.trim() || item.media?.some((media) => media.mediaType === 'image'),
        ).length,
  );
  readonly descriptionCount = computed(
    () => this.menu.items().filter((item) => !!item.description?.trim()).length,
  );
  readonly videoProductCount = computed(
    () =>
      this.menu.items().filter((item) => item.media?.some((media) => media.mediaType === 'video'))
        .length,
  );
  readonly missingPhotos = computed(() => this.totalItems() - this.photoCount());
  readonly productPhotos = computed(() =>
    this.menu
      .items()
      .filter((item) => !!item.imageUrl)
      .slice(0, 3),
  );
  readonly checklist = computed<Step[]>(() => [
    {
      label: 'Cadastrar dados da empresa',
      route: 'empresa',
      done: !!this.auth.currentBusiness()?.name?.trim(),
    },
    {
      label: 'Enviar logo da empresa',
      route: 'empresa',
      done: !!this.auth.currentBusiness()?.logo_url,
    },
    { label: 'Criar primeira categoria', route: 'menu', done: this.totalCategories() > 0 },
    { label: 'Adicionar produtos', route: 'menu', done: this.totalItems() > 0 },
    {
      label: 'Personalizar design',
      route: 'design',
      done: this.auth.account()?.onboarding?.designConfigured === true,
    },
    { label: 'Publicar cardápio online', route: 'preview', done: this.published() },
  ]);
  readonly completedSteps = computed(() => this.checklist().filter((item) => item.done).length);
  readonly visibleSteps = computed(() =>
    this.expandedSteps()
      ? this.checklist()
      : this.checklist()
          .filter((item) => !item.done)
          .slice(0, 4),
  );

  // Eight equally weighted checks: the six onboarding checks above plus photo and
  // description coverage (0..1 each). Empty catalogs receive zero coverage.
  // Videos are optional enrichment and never penalize plans without video access.
  readonly healthScore = computed(() => {
    const count = this.totalItems();
    const coverage = count > 0 ? (this.photoCount() + this.descriptionCount()) / count : 0;
    return Math.round(((this.completedSteps() + coverage) / 8) * 100);
  });
  readonly healthChecks = computed(() => [
    {
      label: 'Fotos dos produtos',
      value: this.coverageLabel(this.photoCount()),
      done: this.totalItems() > 0 && this.photoCount() === this.totalItems(),
      optional: false,
    },
    {
      label: 'Descrições completas',
      value: this.coverageLabel(this.descriptionCount()),
      done: this.totalItems() > 0 && this.descriptionCount() === this.totalItems(),
      optional: false,
    },
    {
      label: 'Produtos com vídeo',
      value: `${this.videoProductCount()} · opcional`,
      done: this.videoProductCount() > 0,
      optional: true,
    },
    {
      label: 'Cardápio publicado',
      value: this.published() ? 'Online' : 'Rascunho',
      done: this.published(),
      optional: false,
    },
  ]);
  readonly nextAction = computed<NextAction>(() => {
    const business = this.auth.currentBusiness();
    if (!business?.name?.trim() || !business?.slug || !business?.logo_url)
      return {
        title: 'Dê a sua cara ao cardápio.',
        description: 'Complete os dados da empresa e adicione sua logo.',
        cta: 'Completar empresa',
        route: 'empresa',
      };
    if (!this.totalCategories())
      return {
        title: 'Tudo começa com uma categoria.',
        description: 'Organize os produtos para seus clientes encontrarem o que procuram.',
        cta: 'Criar categoria',
        route: 'menu',
      };
    if (!this.totalItems())
      return {
        title: 'Seu primeiro produto merece estar aqui.',
        description: 'Adicione nome, preço e uma boa foto para começar.',
        cta: 'Criar produto',
        route: 'menu',
      };
    if (this.missingPhotos()) {
      const n = this.missingPhotos();
      return {
        title: `${n} ${n === 1 ? 'produto ainda está sem foto.' : 'produtos ainda estão sem foto.'}`,
        description: 'Uma boa imagem ajuda seus clientes a escolher.',
        cta: 'Corrigir agora',
        route: 'menu',
      };
    }
    if (this.descriptionCount() < this.totalItems())
      return {
        title: 'Conte o que torna seus produtos especiais.',
        description: 'Complete as descrições que ainda estão em branco.',
        cta: 'Completar descrições',
        route: 'menu',
      };
    if (!this.published())
      return {
        title: 'Seu cardápio está pronto para ser visto.',
        description: 'Revise o preview e publique para receber seus clientes.',
        cta: 'Revisar e publicar',
        route: 'preview',
      };
    if (this.auth.account()?.onboarding?.designConfigured !== true)
      return {
        title: 'Deixe sua marca em cada detalhe.',
        description: 'Personalize o visual do cardápio com a identidade do seu negócio.',
        cta: 'Personalizar design',
        route: 'design',
      };
    return this.commercial.qr()
      ? {
          title: 'Leve seu cardápio a cada mesa.',
          description: 'Crie seu QR Code e facilite o acesso dos seus clientes.',
          cta: 'Ver QR Code',
          route: 'qr',
        }
      : {
          title: 'Seu cardápio está bem cuidado.',
          description: 'Continue acompanhando os detalhes e mantendo seus produtos atualizados.',
          cta: 'Revisar cardápio',
          route: 'menu',
        };
  });
  readonly performanceMetrics = computed(() => {
    const summary = this.report()?.summary;
    if (!summary) return [];
    return [
      { label: 'Visualizações', value: summary.menuViews, tone: 'brand' },
      typeof summary.qrEntries === 'number'
        ? { label: 'Acessos via QR', value: summary.qrEntries, tone: 'orange' }
        : { label: 'Visitantes', value: summary.visitors, tone: 'orange' },
      { label: 'Reproduções de vídeo', value: summary.videoPlays, tone: 'video' },
    ];
  });
  readonly performanceBars = computed(() => {
    const points = this.report()?.series ?? [];
    const max = Math.max(1, ...points.map((point) => point.menuViews));
    return points.map((point) => ({
      label: `${this.formatDate(point.date)}${point.hour == null ? '' : ` · ${point.hour}h`}`,
      value: point.menuViews,
      height: (Math.max(0, point.menuViews) / max) * 100,
    }));
  });

  ngOnInit(): void {
    if (!this.loading) this.loadPerformance();
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['loading'] && !changes['loading'].firstChange && !this.loading)
      this.loadPerformance();
  }

  loadPerformance(): void {
    if (!this.commercial.analytics() || this.performanceLoading() || this.dataError) return;
    this.performanceLoading.set(true);
    this.performanceError.set('');
    // The existing endpoint defaults to seven days in the configured timezone.
    // Use its returned range, never the browser's local date; no options request.
    this.analytics
      .report({})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (report) => {
          this.report.set(report);
          this.performanceLoading.set(false);
        },
        error: () => {
          this.performanceError.set('Não foi possível carregar o desempenho.');
          this.performanceLoading.set(false);
        },
      });
  }

  private coverageLabel(count: number): string {
    return this.totalItems() > 0 ? `${count}/${this.totalItems()}` : 'Sem produtos';
  }
  formatDate(date: string): string {
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date.slice(8, 10)}/${date.slice(5, 7)}` : date;
  }
  reload(): void {
    window.location.reload();
  }
  comparePlans(): void {
    void this.router.navigate(['/plans']);
  }
  async copyLink(): Promise<void> {
    const link = this.publicLink();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      this.onToast.emit('Link copiado para a área de transferência!');
    } catch {
      this.onToast.emit('Não foi possível copiar. Use Abrir cardápio para acessar o link.');
    }
  }
}
