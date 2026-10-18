import { Component, Input, OnChanges, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { findCatalogIcon } from '../../constants/icon-catalog';
import { HomeIconChoice, HomeIconSection } from '../../constants/home-icons';

let iconInstance = 0;
@Component({
  selector: 'app-menu-home-icon', standalone: true,
  template: `@if (choice !== null) {
    @if (svg) { <span class="symbol" [innerHTML]="svg"></span> }
    @else if (section === 'featured_product') { <img src="/icons_chef_hat.webp" alt="" /> }
    @else { <span class="emoji">{{ section === 'promotion' ? '🔥' : '❤️' }}</span> }
  }`,
  host: { 'aria-hidden': 'true', '[class.no-icon]': 'choice === null' },
  styles: [`:host{display:inline-flex;width:28px;height:28px;flex-shrink:0;align-items:center;justify-content:center;color:inherit;vertical-align:middle}:host.no-icon{display:none}.symbol{display:flex;width:100%;height:100%}.symbol :is(svg){width:100%;height:100%}img{display:block;width:100%;height:100%;object-fit:contain}.emoji{font:24px/1 'Segoe UI Emoji','Apple Color Emoji',sans-serif}`],
})
export class MenuHomeIconComponent implements OnChanges {
  @Input() section: HomeIconSection = 'home';
  @Input() choice: HomeIconChoice;
  svg: SafeHtml | null = null;
  private sanitizer = inject(DomSanitizer);
  private prefix = `pc-home-icon-${++iconInstance}-`;
  ngOnChanges() {
    const defaults: Partial<Record<HomeIconSection, string>> = { home: '3d-bistro', combo: '3d-combo', best_seller: '3d-bestseller' };
    const icon = findCatalogIcon(this.choice ?? defaults[this.section]);
    // Only repository-owned SVG is trusted. Stored values never contain markup.
    const source = icon?.svg.replace(/<svg\b/, '<svg style="width:100%;height:100%;display:block"')
      .replace(/id="([^"]+)"/g, (_, id) => `id="${this.prefix}${id}"`)
      .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${this.prefix}${id})`)
      .replace(/((?:xlink:)?href=")#([^"]+)"/g, (_, attr, id) => `${attr}#${this.prefix}${id}"`);
    this.svg = source ? this.sanitizer.bypassSecurityTrustHtml(source) : null;
  }
}
