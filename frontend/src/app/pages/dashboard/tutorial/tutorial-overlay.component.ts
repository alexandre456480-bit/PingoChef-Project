import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, ViewChild, effect, inject, isDevMode, signal, untracked } from '@angular/core';
import { DialogFocusDirective } from '../../../components/dialog-focus.directive';
import { TutorialService } from './tutorial.service';
import { TutorialMascotComponent } from './tutorial-mascot.component';
import { fitDialogWidth, placeDialog, TourRect } from './tutorial-layout';

@Component({
  selector: 'app-tutorial-overlay', standalone: true,
  imports: [DialogFocusDirective, TutorialMascotComponent],
  templateUrl: './tutorial-overlay.component.html', styleUrl: './tutorial-overlay.component.css',
})
export class TutorialOverlayComponent implements AfterViewInit, OnDestroy {
  readonly tour = inject(TutorialService);
  @ViewChild('dialog') dialog?: ElementRef<HTMLElement>;
  readonly rect = signal<TourRect | null>(null);
  readonly position = signal({ left: 12, top: 12 });
  readonly dialogWidth = signal(Math.min(420, window.innerWidth - 24));
  readonly mask = signal('');
  readonly confirming = signal(false);
  readonly preparing = signal(true);
  private target?: HTMLElement;
  private observer?: ResizeObserver;
  private frame = 0;
  private settleUntil = 0;
  private generation = 0;
  private destroyed = false;
  private ready = signal(false);
  private details: Array<[HTMLDetailsElement, boolean]> = [];
  private mode = window.innerWidth <= 1100;
  private navigationMode = window.innerWidth <= 1024;
  private readonly track = () => {
    const mode = window.innerWidth <= 1100, navigation = window.innerWidth <= 1024;
    if (mode !== this.mode || navigation !== this.navigationMode) {
      this.mode = mode; this.navigationMode = navigation; void this.attach();
    } else { this.settleUntil = performance.now() + 300; this.schedule(); }
  };

  constructor() {
    effect(() => {
      const step = this.tour.step();
      if (this.ready() && step) untracked(() => void this.attach());
    });
  }
  ngAfterViewInit() {
    this.observer = new ResizeObserver(this.track);
    if (this.dialog) this.observer.observe(this.dialog.nativeElement);
    window.addEventListener('resize', this.track);
    window.addEventListener('scroll', this.track, true);
    window.visualViewport?.addEventListener('resize', this.track);
    this.ready.set(true);
  }
  private async attach() {
    const generation = ++this.generation;
    this.details.forEach(([detail, open]) => detail.open = open); this.details = [];
    if (this.target) this.observer?.unobserve(this.target);
    this.target = undefined; this.rect.set(null); this.confirming.set(false); this.preparing.set(true);
    this.mask.set(`M0,0H${window.innerWidth}V${window.innerHeight}H0Z`);
    await this.tour.prepare();
    if (this.destroyed || generation !== this.generation) return;
    const step = this.tour.step();
    const key = typeof step.target === 'function' ? step.target(this.tour.context()) : step.target;
    // Angular must commit the new section and mobile navigation before looking up the target.
    const deadline = performance.now() + 1800;
    if (key) {
      while (!this.destroyed && generation === this.generation) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        const node = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`))
          .find(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
        if (node) {
          let ancestor: HTMLElement | null = node.parentElement;
          while (ancestor) {
            if (ancestor instanceof HTMLDetailsElement && !ancestor.open) {
              this.details.push([ancestor, ancestor.open]); ancestor.open = true;
            }
            ancestor = ancestor.parentElement;
          }
          this.target = node; break;
        }
        if (performance.now() >= deadline) {
          if (isDevMode()) console.debug('[PingoChef tutorial] Target unavailable:', step.id);
          break;
        }
      }
    }
    if (this.destroyed || generation !== this.generation) return;
    if (this.target) {
      this.target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center', inline: 'nearest' });
      this.observer?.observe(this.target);
      // ResizeObserver does not report ancestor transforms (e.g. the sliding sidebar).
      // Track the short entrance/scroll animation as well, then return to event-driven work.
      this.settleUntil = performance.now() + 700;
    }
    this.schedule();
    this.dialog?.nativeElement.focus({ preventScroll: true });
  }
  private schedule() {
    if (!this.frame && !this.destroyed) this.frame = requestAnimationFrame(() => { this.frame = 0; this.measure(); });
  }
  private measure() {
    const view = { width: document.documentElement.clientWidth, height: window.visualViewport?.height ?? window.innerHeight };
    const dialog = this.dialog?.nativeElement.getBoundingClientRect();
    if (!dialog) return;
    const size = { width: dialog.width, height: dialog.height };
    const reserve = view.width <= 768 ? Math.ceil(size.height + 36) : 0;
    if (this.tour.bottomReserve() !== reserve) {
      // A short/empty section still needs enough scroll range to reveal its CTA
      // above the mobile sheet. Restore the normal padding when the guide ends.
      this.tour.bottomReserve.set(reserve); this.schedule(); return;
    }
    let rect: TourRect | undefined;
    if (this.target?.isConnected && this.target.getClientRects().length) {
      let bounds = this.target.getBoundingClientRect();
      // Leave room above the mobile sheet, scrolling only an existing scroll container.
      const usableBottom = view.width <= 768 ? view.height - size.height - 32 : view.height - 12;
      if (view.width <= 768 && bounds.bottom > usableBottom && bounds.height < usableBottom - 20) {
        let parent = this.target.parentElement;
        while (parent && parent.scrollHeight <= parent.clientHeight + 1) parent = parent.parentElement;
        if (parent && parent !== document.body && parent !== document.documentElement) {
          const delta = Math.min(bounds.bottom - usableBottom, parent.scrollHeight - parent.clientHeight - parent.scrollTop);
          if (delta > 1) { parent.scrollTop += delta; bounds = this.target.getBoundingClientRect(); }
        }
      }
      // Clip the spotlight to the visible scrollport, never illuminating unrelated UI.
      let left = Math.max(8, bounds.left - 7), top = Math.max(8, bounds.top - 7);
      let right = Math.min(view.width - 8, bounds.right + 7), bottom = Math.min(usableBottom, bounds.bottom + 7);
      let parent = this.target.parentElement;
      while (parent && parent !== document.body) {
        const style = getComputedStyle(parent), box = parent.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom); }
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, box.left); right = Math.min(right, box.right); }
        parent = parent.parentElement;
      }
      if (bottom > top && right > left) rect = { left, top, width: right - left, height: bottom - top };
    }
    const width = fitDialogWidth(view, size.height, rect, this.tour.step().placement);
    if (Math.abs(this.dialogWidth() - width) > 1) {
      this.dialogWidth.set(width); this.schedule(); return;
    }
    if (JSON.stringify(this.rect()) !== JSON.stringify(rect ?? null)) this.rect.set(rect ?? null);
    const next = placeDialog(view, size, rect, this.tour.step().placement), previous = this.position();
    if (next.left !== previous.left || next.top !== previous.top) this.position.set(next);
    const hole = rect ? `M${rect.left},${rect.top}h${rect.width}v${rect.height}h-${rect.width}Z` : '';
    this.mask.set(`M0,0H${view.width}V${view.height}H0Z${hole}`);
    this.preparing.set(false);
    if (performance.now() < this.settleUntil) this.schedule();
  }
  confirmSkip(show: boolean) {
    this.confirming.set(show);
    requestAnimationFrame(() => {
      if (this.destroyed) return;
      const target = show ? this.dialog?.nativeElement.querySelector<HTMLElement>('[data-confirm-cancel]') : this.dialog?.nativeElement;
      target?.focus({ preventScroll: true });
      this.schedule();
    });
  }
  @HostListener('keydown', ['$event']) onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') { this.confirmSkip(true); return; }
    if (this.confirming() || /INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement).tagName)) return;
    if (event.key === 'ArrowRight' && this.tour.index() < this.tour.steps().length - 1) {
      event.preventDefault(); void this.tour.move(1);
    }
    if (event.key === 'ArrowLeft') { event.preventDefault(); void this.tour.move(-1); }
  }
  ngOnDestroy() {
    this.destroyed = true; ++this.generation; cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    this.details.forEach(([detail, open]) => detail.open = open);
    window.removeEventListener('resize', this.track); window.removeEventListener('scroll', this.track, true);
    window.visualViewport?.removeEventListener('resize', this.track);
  }
}
