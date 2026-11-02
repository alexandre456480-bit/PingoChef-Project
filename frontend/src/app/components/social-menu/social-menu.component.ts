import { Component, ElementRef, HostListener, Input, ViewChild } from '@angular/core';
import { SocialLink, safeSocialLinks, socialLabel } from '../../models/social-links';
import { SocialIconComponent } from '../social-icon/social-icon.component';

let menuId = 0;
@Component({
  selector: 'app-social-menu',
  standalone: true,
  imports: [SocialIconComponent],
  host: { '[class.pixel]': 'pixel' },
  template: `
    @if (safeLinks.length) {
      <button
        #trigger
        type="button"
        class="trigger"
        aria-label="Redes sociais e canais de pedido"
        [attr.aria-expanded]="open"
        [attr.aria-controls]="id"
        (click)="open = !open"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      @if (open) {
        <nav [id]="id" aria-label="Redes sociais e canais de pedido">
          <span class="title">Encontre-nos também</span>
          @for (link of safeLinks; track $index) {
            <a
              [href]="link.url"
              target="_blank"
              rel="noopener noreferrer"
              [attr.aria-label]="labelFor(link) + ' (abre em nova aba)'"
            >
              <app-social-icon [platform]="link.platform" />
              <span>{{ labelFor(link) }}</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                aria-hidden="true"
              >
                <path d="M7 17 17 7M7 7h10v10" />
              </svg>
            </a>
          }
        </nav>
      }
    }
  `,
  styles: [
    `
      :host {
        position: absolute;
        top: 14px;
        left: 14px;
        z-index: 55;
        color: var(--text-primary);
        font-family: var(--body-font, inherit);
      }
      .trigger {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        padding: 0;
        box-sizing: border-box;
        border: 1px solid color-mix(in srgb, var(--text-primary) 24%, transparent);
        border-radius: 50%;
        background: var(--surface-color);
        color: inherit;
        box-shadow: 0 4px 18px #0002;
        backdrop-filter: blur(16px);
        cursor: pointer;
      }
      nav {
        position: absolute;
        top: 54px;
        left: 0;
        box-sizing: border-box;
        width: 280px;
        max-height: min(480px, calc(100dvh - 100px));
        overflow-y: auto;
        overscroll-behavior: contain;
        max-width: min(calc(100vw - 28px), calc(100cqi - 28px));
        padding: 10px;
        border-radius: 18px;
        border: 1px solid color-mix(in srgb, var(--text-primary) 24%, transparent);
        background: var(--surface-color);
        box-shadow: 0 12px 36px #0003;
        backdrop-filter: blur(20px);
      }
      .title {
        display: block;
        font-size: 12px;
        padding: 5px 10px 9px;
      }
      a {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 7px 9px;
        min-height: 48px;
        box-sizing: border-box;
        border-radius: 10px;
        color: inherit;
        text-decoration: none;
        font-size: 14px;
        line-height: 1.4;
      }
      a span {
        flex: 1;
        overflow-wrap: anywhere;
      }
      a > svg {
        flex-shrink: 0;
        opacity: 0.85;
      }
      a:hover {
        background: color-mix(in srgb, var(--primary-color) 12%, transparent);
      }
      .trigger:hover,
      .trigger[aria-expanded='true'] {
        border-color: var(--primary-color);
      }
      button:focus-visible,
      a:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 3px;
      }
      :host(.pixel) .trigger,
      :host(.pixel) nav,
      :host(.pixel) a {
        border-radius: 0;
      }
      :host(.pixel) .trigger,
      :host(.pixel) nav {
        border: 2px solid var(--pixel-ink, var(--text-primary));
        box-shadow: 3px 3px 0 color-mix(in srgb, var(--primary-color) 45%, transparent);
        clip-path: polygon(
          4px 0,
          calc(100% - 4px) 0,
          calc(100% - 4px) 2px,
          100% 2px,
          100% calc(100% - 2px),
          calc(100% - 4px) calc(100% - 2px),
          calc(100% - 4px) 100%,
          4px 100%,
          4px calc(100% - 2px),
          0 calc(100% - 2px),
          0 2px,
          4px 2px
        );
      }
    `,
  ],
})
export class SocialMenuComponent {
  @Input() links: SocialLink[] = [];
  @Input() pixel = false;
  @ViewChild('trigger') trigger?: ElementRef<HTMLButtonElement>;
  readonly id = `public-social-links-${++menuId}`;
  readonly labelFor = socialLabel;
  open = false;
  get safeLinks(): SocialLink[] {
    return safeSocialLinks(this.links);
  }
  constructor(private element: ElementRef<HTMLElement>) {}
  @HostListener('document:click', ['$event']) closeOutside(event: Event): void {
    if (this.open && !this.element.nativeElement.contains(event.target as Node)) this.open = false;
  }
  @HostListener('keydown.escape', ['$event']) closeWithEscape(event: Event): void {
    if (!this.open) return;
    event.stopPropagation();
    this.open = false;
    this.trigger?.nativeElement.focus();
  }
}
