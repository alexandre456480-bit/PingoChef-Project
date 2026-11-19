import { afterNextRender, DestroyRef, Directive, ElementRef, inject, Injectable, NgZone } from '@angular/core';

const entrances = {
  title: {
    frames: [
      { opacity: 0, translate: '0 24px', clipPath: 'inset(0 -8% 100%)' },
      { opacity: 1, translate: '0 0', clipPath: 'inset(-8%)' },
    ],
    duration: 510,
  },
  copy: {
    frames: [{ opacity: 0, translate: '0 12px' }, { opacity: 1, translate: '0 0' }],
    duration: 380,
  },
  stamp: {
    frames: [
      { opacity: 0, translate: '0 17px', scale: '.92 .86' },
      { opacity: 1, translate: '0 -3px', scale: '1.025 1.035', offset: .74 },
      { opacity: 1, translate: '0 0', scale: '1' },
    ],
    duration: 450,
  },
  phone: {
    frames: [
      { opacity: 0, transform: 'translate3d(6px, 28px, 0) rotate(4deg) scale(.93)' },
      { opacity: 1, transform: 'translate3d(0, -3px, 0) rotate(-1deg) scale(1.01)', offset: .78 },
      { opacity: 1, transform: 'none' },
    ],
    duration: 600,
  },
  deck: {
    frames: [
      { opacity: 0, transform: 'perspective(900px) translateY(24px) rotateX(8deg) scale(.96)' },
      { opacity: 1, transform: 'none' },
    ],
    duration: 630,
  },
  piece: {
    frames: [
      { opacity: 0, scale: '.68' },
      { opacity: 1, scale: '1.06', offset: .76 },
      { opacity: 1, scale: '1' },
    ],
    duration: 470,
  },
} satisfies Record<string, { frames: Keyframe[]; duration: number }>;

@Injectable()
export class LandingReveal {
  private readonly destroyRef = inject(DestroyRef);
  private observer?: IntersectionObserver;
  private motion?: MediaQueryList;
  private readonly pending = new Map<HTMLElement | SVGElement, () => void>();
  private readonly running = new Set<Animation>();

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.observer?.disconnect();
      this.motion?.removeEventListener('change', this.motionChanged);
      for (const show of this.pending.values()) show();
      for (const animation of this.running) animation.cancel();
    });
  }

  observe(element: HTMLElement | SVGElement): () => void {
    if (typeof IntersectionObserver === 'undefined' || typeof element.animate !== 'function') return () => {};
    if (!this.motion) {
      this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.motion.addEventListener('change', this.motionChanged);
    }
    if (this.motion.matches || element.matches(':focus-within')) return () => {};

    const show = () => {
      element.style.removeProperty('opacity');
      element.removeEventListener('focusin', show);
      this.pending.delete(element);
      this.observer?.unobserve(element);
    };
    this.pending.set(element, show);
    element.style.opacity = '0';
    element.addEventListener('focusin', show);
    this.observer ??= new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const target = entry.target as HTMLElement | SVGElement;
        const restore = this.pending.get(target);
        if (!restore) continue;
        restore();
        const pieces = target.hasAttribute('data-enter') ? [target]
          : Array.from(target.querySelectorAll<HTMLElement | SVGElement>('[data-enter]'));
        for (const piece of pieces) {
          const entrance = entrances[piece.dataset['enter'] as keyof typeof entrances];
          if (!entrance || piece.matches(':focus-within')) continue;
          const animation = piece.animate(entrance.frames, {
            duration: entrance.duration,
            delay: Number(piece.dataset['enterDelay'] || 0),
            easing: 'cubic-bezier(.22, .78, .25, 1)',
            fill: 'backwards',
          });
          this.running.add(animation);
          const onFocus = () => animation.cancel();
          const cleanup = () => {
            piece.removeEventListener('focusin', onFocus);
            this.running.delete(animation);
          };
          piece.addEventListener('focusin', onFocus, { once: true });
          void animation.finished.then(cleanup, cleanup);
        }
      }
    }, { rootMargin: '0px 0px -42px' });
    this.observer.observe(element);
    return show;
  }

  private readonly motionChanged = () => {
    if (!this.motion?.matches) return;
    for (const show of this.pending.values()) show();
    for (const animation of this.running) animation.cancel();
  };
}

@Directive({ selector: '[landingReveal]' })
export class LandingRevealDirective {
  private readonly reveal = inject(LandingReveal, { optional: true });
  private readonly host = inject<ElementRef<HTMLElement | SVGElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    if (!this.reveal) return;
    afterNextRender(() => this.zone.runOutsideAngular(() => {
      const stop = this.reveal?.observe(this.host.nativeElement);
      if (stop) this.destroyRef.onDestroy(stop);
    }));
  }
}
