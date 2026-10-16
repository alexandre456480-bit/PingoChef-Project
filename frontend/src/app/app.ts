import { Component, inject, signal, DestroyRef } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MenuFontsService } from './services/menu-fonts.service';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('frontend');
  constructor() {
    const fonts = inject(MenuFontsService);
    const isPublic = (url: string) => /^\/(m|c|q)\//.test(url);
    fonts.platform(isPublic(inject(DOCUMENT).location.pathname));
    inject(Router).events.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(event => {
      if (event instanceof NavigationEnd) fonts.platform(isPublic(event.urlAfterRedirects));
    });
  }
}
