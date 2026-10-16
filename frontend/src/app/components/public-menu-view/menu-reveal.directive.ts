import { AfterViewInit, Directive, ElementRef, NgZone, OnDestroy } from '@angular/core';

const targets = new Map<Element, (visible: boolean) => void>();
let observer: IntersectionObserver | null = null;

@Directive({
  selector: '[appMenuReveal]',
  standalone: true
})
export class MenuRevealDirective implements AfterViewInit, OnDestroy {
  private observed = false;

  constructor(private element: ElementRef<HTMLElement>, private zone: NgZone) {}

  ngAfterViewInit(): void {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window) ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const node = this.element.nativeElement;
    // Let the browser batch visibility/layout. Synchronous rectangle reads in
    // every AfterViewInit forced repeated full layouts during category changes.
    // First-viewport content starts visible and never waits for this observer.
    this.zone.runOutsideAngular(() => {
      observer ??= new IntersectionObserver(entries => {
        for (const entry of entries) {
          targets.get(entry.target)?.(entry.isIntersecting);
          if (!entry.isIntersecting) continue;
          targets.delete(entry.target);
          observer?.unobserve(entry.target);
        }
      }, { threshold: 0, rootMargin: '0px 0px 36px 0px' });
      targets.set(node, visible => {
        if (!visible) { node.classList.add('menu-reveal-pending'); return; }
        const pending = node.classList.contains('menu-reveal-pending');
        node.classList.remove('menu-reveal-pending');
        if (pending) node.classList.add('menu-reveal-visible');
      });
      observer.observe(node);
    });
    this.observed = true;
  }

  ngOnDestroy(): void {
    if (!this.observed) return;
    const node = this.element.nativeElement;
    observer?.unobserve(node);
    targets.delete(node);
    if (targets.size === 0) {
      observer?.disconnect();
      observer = null;
    }
  }
}
