import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  NgZone
} from '@angular/core';
import { LandingRevealDirective } from './landing-reveal.directive';

@Component({
  selector: 'app-landing-menu-motion',
  imports: [LandingRevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing-menu-motion.component.html',
  styleUrl: './landing-menu-motion.component.css'
})
export class LandingMenuMotionComponent {
  constructor() {
    const host = inject(ElementRef<HTMLElement>).nativeElement;
    const destroyRef = inject(DestroyRef);
    const zone = inject(NgZone);

    afterNextRender(() => zone.runOutsideAngular(() => {
      const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
      let visible = false;
      let frame = 0;

      const update = () => {
        frame = 0;
        const bounds = host.getBoundingClientRect();
        const progress = (window.innerHeight - bounds.top) / (window.innerHeight + bounds.height);
        const position = Math.max(-1, Math.min(1, progress * 2 - 1));
        host.style.setProperty('--menu-scroll', position.toFixed(4));
      };

      const schedule = () => {
        if (visible && !motion.matches && !frame) frame = window.requestAnimationFrame(update);
      };

      const updateMotion = () => {
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
        if (motion.matches) host.style.removeProperty('--menu-scroll');
        else schedule();
      };

      const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) schedule();
      });
      observer.observe(host);
      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule, { passive: true });
      motion.addEventListener('change', updateMotion);

      destroyRef.onDestroy(() => {
        observer.disconnect();
        window.removeEventListener('scroll', schedule);
        window.removeEventListener('resize', schedule);
        motion.removeEventListener('change', updateMotion);
        if (frame) window.cancelAnimationFrame(frame);
      });
    }));
  }
}
