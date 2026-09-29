import { AfterViewInit, Directive, ElementRef, OnDestroy } from '@angular/core';

const targets = new Map<Element, () => void>();
let observer: IntersectionObserver | null = null;

@Directive({
  selector: '[appMenuReveal]',
  standalone: true
})
export class MenuRevealDirective implements AfterViewInit, OnDestroy {
  private observed = false;

  constructor(private element: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window) ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const node = this.element.nativeElement;
    node.classList.add('menu-reveal-pending');
    observer ??= new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        targets.get(entry.target)?.();
        targets.delete(entry.target);
        observer?.unobserve(entry.target);
      }
    }, { threshold: 0, rootMargin: '0px 0px 36px 0px' });

    targets.set(node, () => {
      node.classList.remove('menu-reveal-pending');
      node.classList.add('menu-reveal-visible');
    });
    observer.observe(node);
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
