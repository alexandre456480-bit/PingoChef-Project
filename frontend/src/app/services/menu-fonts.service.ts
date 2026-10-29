import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

// Same curated families already offered by the editor. Never interpolate arbitrary
// saved CSS/URLs into a stylesheet, and never request this whole catalog publicly.
export const MENU_FONTS = [
  'Outfit',
  'Inter',
  'Playfair Display',
  'Cinzel',
  'Righteous',
  'DM Serif Display',
  'Plus Jakarta Sans',
  'Bebas Neue',
  'Merriweather',
  'Syne',
  'Montserrat',
  'Oswald',
  'Cormorant Garamond',
  'Fraunces',
  'Fredoka',
  'DM Sans',
  'Lora',
  'Nunito',
  'Space Grotesk',
  'Quicksand',
  'Manrope',
  'Source Sans 3',
  'Open Sans',
  'Libre Baskerville',
  'Silkscreen',
  'Pixelify Sans',
] as const;
const SINGLE_WEIGHT = new Set(['Bebas Neue', 'Righteous', 'DM Serif Display']);
const WEIGHTS: Record<string, string> = {
  Silkscreen: '400;700',
  'Pixelify Sans': '400;500;600;700',
  Cinzel: '500;700;900',
  Merriweather: '400;700;900',
  Lora: '400;600',
  'Libre Baskerville': '400;700',
  'DM Sans': '400;500;700',
  Inter: '400;500;600;700',
  'Space Grotesk': '400;500;600;700',
  Quicksand: '400;500;600;700',
  'Source Sans 3': '400;500;600;700',
  'Cormorant Garamond': '400;600;700',
  Fredoka: '400;600;700',
  Oswald: '400;600;700',
  Syne: '500;700;800',
  Manrope: '400;500;600;700;800',
  'Open Sans': '400;500;600;700',
};
export function menuFont(value: string | undefined, fallback: string): string {
  return MENU_FONTS.some((font) => font === value) ? value! : fallback;
}
export function menuFontFamily(family: string): string {
  const font = menuFont(family, 'Inter');
  return font === 'Pixelify Sans' ? "'Pixel Numerals', 'Pixelify Sans', sans-serif" : font + ', sans-serif';
}
export function fontStylesheet(families: string[]): string {
  return (
    'https://fonts.googleapis.com/css2?' +
    [...new Set(families)]
      .map(
        (family) =>
          'family=' +
          encodeURIComponent(family).replace(/%20/g, '+') +
          (SINGLE_WEIGHT.has(family) ? '' : ':wght@' + (WEIGHTS[family] || '400;600;700;800')),
      )
      .join('&') +
    '&display=swap'
  );
}
@Injectable({ providedIn: 'root' })
export class MenuFontsService {
  private document = inject(DOCUMENT);
  platform(publicRoute: boolean): void {
    if (publicRoute) this.document.getElementById('pc-platform-fonts')?.remove();
    else this.load('pc-platform-fonts', [...MENU_FONTS]);
  }
  selected(heading: string, body: string): void {
    this.load('pc-menu-fonts', [menuFont(heading, 'Outfit'), menuFont(body, 'Inter')]);
  }
  private load(id: string, families: string[]): void {
    const href = fontStylesheet(families);
    const current = this.document.getElementById(id) as HTMLLinkElement | null;
    if (current?.href === href) return;
    const link = this.document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    // CSS may load in parallel; first paint and the menu API never wait for it.
    link.media = 'print';
    link.addEventListener(
      'load',
      () => {
        link.media = 'all';
      },
      { once: true },
    );
    current?.remove();
    this.document.head.appendChild(link);
  }
}
