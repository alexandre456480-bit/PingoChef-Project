import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, NgZone, signal, viewChild, viewChildren } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { PlansComponent } from '../plans/plans.component';
import { LandingMenuMotionComponent } from './landing-menu-motion.component';
import { CommercialService } from '../../services/commercial.service';
import { LandingReveal, LandingRevealDirective } from './landing-reveal.directive';

type FreeRegistrationSource = 'trial' | 'closing';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, PlansComponent, LandingMenuMotionComponent, LandingRevealDirective],
  providers: [LandingReveal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent {
  readonly showVideo = signal(false);
  readonly showBlink = signal(false);
  readonly blinkReady = signal(false);
  readonly navCtaVisible = signal(false);
  readonly navHidden = signal(false);
  readonly registeringFree = signal<FreeRegistrationSource | null>(null);
  readonly registrationError = signal<{ source: FreeRegistrationSource; message: string } | null>(null);
  private readonly commercial = inject(CommercialService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly header = viewChild.required<ElementRef<HTMLElement>>('siteHeader');
  private readonly menuMotion = viewChild.required('menuMotion', { read: ElementRef<HTMLElement> });
  private readonly heroCta = viewChild.required<ElementRef<HTMLElement>>('heroCta');
  private readonly inViewVideos = viewChildren<ElementRef<HTMLVideoElement>>('inViewVideo');
  private readonly trialVideo = viewChild.required<ElementRef<HTMLVideoElement>>('trialVideo');
  private blinkDelay?: ReturnType<typeof setTimeout>;
  readonly segments = [
    { icon: 'meal', label: 'Restaurantes' },
    { icon: 'cake', label: 'Confeitarias' },
    { icon: 'snack', label: 'Botecos' },
    { icon: 'drink', label: 'Bares' },
    { icon: 'pizza', label: 'Pizzarias' },
    { icon: 'burger', label: 'Hamburguerias' },
    { icon: 'coffee', label: 'Cafeterias' },
    { icon: 'icecream', label: 'Sorveterias' },
    { icon: 'bread', label: 'Padarias' }
  ];

  constructor() {
    const destroyRef = this.destroyRef;
    const zone = inject(NgZone);
    destroyRef.onDestroy(() => clearTimeout(this.blinkDelay));
    afterNextRender(() => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.showVideo.set(!reducedMotion);
      if (!reducedMotion) zone.runOutsideAngular(() => this.playVisibleVideos());
      const header = this.header().nativeElement;
      const heroCta = this.heroCta().nativeElement;
      zone.runOutsideAngular(() => this.trackNavScroll(header, destroyRef));
      let observer: IntersectionObserver | undefined;
      const observe = () => {
        observer?.disconnect();
        observer = new IntersectionObserver(([entry]) => {
          const navbarBottom = entry.rootBounds?.top ?? header.getBoundingClientRect().bottom;
          this.navCtaVisible.set(!entry.isIntersecting && entry.boundingClientRect.bottom <= navbarBottom);
        }, { rootMargin: `-${header.offsetHeight}px 0px 0px` });
        observer.observe(heroCta);
      };
      const resize = new ResizeObserver(observe);
      resize.observe(header);
      destroyRef.onDestroy(() => {
        resize.disconnect();
        observer?.disconnect();
      });
    });
  }

  private playVisibleVideos(): void {
    const trial = this.trialVideo().nativeElement;
    let trialVisible = false;
    let replayTimer: ReturnType<typeof setTimeout> | undefined;
    const play = (video: HTMLVideoElement) => {
      video.muted = true;
      void video.play().catch(() => {});
    };
    const cancelReplay = () => {
      clearTimeout(replayTimer);
      replayTimer = undefined;
    };
    const scheduleReplay = () => {
      if (!trialVisible || replayTimer !== undefined) return;
      replayTimer = setTimeout(() => {
        replayTimer = undefined;
        trial.currentTime = 0;
        play(trial);
      }, 2000);
    };
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const video = entry.target as HTMLVideoElement;
        const visible = entry.intersectionRatio >= 0.35;
        if (video === trial) trialVisible = visible;
        if (!visible) {
          video.pause();
          if (video === trial) cancelReplay();
        } else if (!video.ended) {
          play(video);
        } else if (video === trial) {
          scheduleReplay();
        } else {
          observer.unobserve(video);
        }
      }
    }, { threshold: 0.35 });
    trial.addEventListener('ended', scheduleReplay);
    for (const video of this.inViewVideos()) observer.observe(video.nativeElement);
    this.destroyRef.onDestroy(() => {
      observer.disconnect();
      trial.removeEventListener('ended', scheduleReplay);
      cancelReplay();
    });
  }

  private trackNavScroll(header: HTMLElement, destroyRef: DestroyRef): void {
    const section = this.menuMotion().nativeElement;
    const root = document.documentElement;
    const scrollPosition = () => Math.max(0, Math.min(window.scrollY, root.scrollHeight - root.clientHeight));
    const reachedSection = () => section.getBoundingClientRect().top <= header.offsetHeight;
    let previous = scrollPosition();
    let frame = 0;
    this.navHidden.set(reachedSection());
    const update = () => {
      frame = 0;
      const current = scrollPosition();
      if (current !== previous) this.navHidden.set(current > previous && reachedSection());
      previous = current;
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    destroyRef.onDestroy(() => {
      window.removeEventListener('scroll', schedule);
      window.cancelAnimationFrame(frame);
    });
  }

  startFreeRegistration(source: FreeRegistrationSource): void {
    if (this.registeringFree()) return;
    this.registeringFree.set(source);
    this.registrationError.set(null);
    this.commercial.startRegistration('FREE').pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.registeringFree.set(null)),
    ).subscribe({
      error: () => this.registrationError.set({
        source,
        message: 'Não foi possível preparar o cadastro. Tente novamente em instantes.',
      }),
    });
  }

  startBlinkAfterOutro(): void {
    this.blinkDelay = setTimeout(() => {
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.showBlink.set(true);
      }
    }, 5000);
  }
}
