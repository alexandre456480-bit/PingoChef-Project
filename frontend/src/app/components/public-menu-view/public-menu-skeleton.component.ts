import { resolveMenuTemplate } from '../../constants/menu-templates';
import { Component, Input } from '@angular/core';
import type { DesignSettings } from '../../services/design.service';

export interface MenuLayoutHint {
  templateKey: string;
  background: string;
  surface: string;
  primary: string;
}
export function menuLayoutHint(design?: Partial<DesignSettings> | null): MenuLayoutHint {
  const colors = design?.palette?.colors;
  const safeColor = (value: string | undefined, fallback: string) =>
    /^#(?:[a-f\d]{3}|[a-f\d]{6}|[a-f\d]{8})$/i.test(value || '') ? value! : fallback;
  const templateKey = resolveMenuTemplate(design).key;
  return {
    templateKey,
    background: safeColor(colors?.background, '#faf5f0'),
    surface: safeColor(colors?.surface, '#ffffff'),
    primary: safeColor(colors?.primary, '#8b1a3a'),
  };
}
@Component({
  selector: 'app-public-menu-skeleton',
  standalone: true,
  template: `<section
    class="menu-skeleton"
    [class.is-visible]="visible"
    [attr.data-template]="layout.templateKey"
    [style.--skeleton-bg]="layout.background"
    [style.--skeleton-surface]="layout.surface"
    role="status"
    aria-label="Preparando seu cardápio"
    [attr.aria-hidden]="visible ? null : 'true'"
  >
    <div class="welcome-placeholder" aria-hidden="true">
      <span class="skeleton-logo skeleton-surface"></span>
      <span class="skeleton-kicker skeleton-surface"></span>
      <span class="skeleton-title skeleton-surface"></span>
      <span class="skeleton-line skeleton-surface"></span>
      <span class="skeleton-action skeleton-surface"></span>
    </div>
  </section>`,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        min-height: 100%;
      }
      .menu-skeleton {
        display: grid;
        place-items: center;
        height: 100%;
        min-height: 100%;
        background: var(--skeleton-bg);
        overflow: hidden;
      }
      .welcome-placeholder {
        display: grid;
        justify-items: center;
        align-content: center;
        gap: 18px;
        width: 100%;
        padding: 24px;
        opacity: 0;
        transition: opacity 160ms ease;
      }
      .is-visible .welcome-placeholder {
        opacity: 1;
      }
      .skeleton-surface {
        display: block;
        background: color-mix(in srgb, var(--skeleton-surface) 70%, #8a8075 30%);
        border-radius: 14px;
        animation: skeleton-breathe 1.8s ease-in-out infinite alternate;
      }
      .skeleton-logo {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        margin-bottom: 6px;
      }
      .skeleton-kicker {
        width: 100px;
        height: 12px;
        border-radius: 6px;
      }
      .skeleton-title {
        width: 78%;
        max-width: 300px;
        height: 42px;
      }
      .skeleton-line {
        width: 66%;
        max-width: 260px;
        height: 18px;
      }
      .skeleton-action {
        width: 78%;
        max-width: 300px;
        height: 56px;
        margin-top: 28px;
      }
      @keyframes skeleton-breathe {
        from {
          opacity: 0.45;
        }
        to {
          opacity: 0.8;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .skeleton-surface {
          animation: none;
        }
        .welcome-placeholder {
          transition: none;
        }
      }
    `,
  ],
})
export class PublicMenuSkeletonComponent {
  @Input() layout: MenuLayoutHint = menuLayoutHint();
  @Input() visible = false;
}
