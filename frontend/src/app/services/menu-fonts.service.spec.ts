import { TestBed } from '@angular/core/testing';
import { fontStylesheet, menuFont, menuFontFamily, MenuFontsService } from './menu-fonts.service';
describe('menu font loading', () => {
  it('uses readable pixel digits only when Pixelify Sans is selected', () => {
    expect(menuFontFamily('Pixelify Sans')).toBe("'Pixel Numerals', 'Pixelify Sans', sans-serif");
    expect(menuFontFamily('Lora')).toBe('Lora, sans-serif');
    expect(menuFontFamily('Silkscreen')).toBe('Silkscreen, sans-serif');
    expect(menuFontFamily('invalid; font-family: bad')).toBe('Inter, sans-serif');
  });
  afterEach(() =>
    document.querySelectorAll('#pc-menu-fonts,#pc-platform-fonts').forEach((node) => node.remove()),
  );
  it('requests only the selected families without blocking initial paint', () => {
    const service = TestBed.inject(MenuFontsService);
    service.platform(true);
    service.selected('Outfit', 'Inter');
    const link = document.querySelector<HTMLLinkElement>('#pc-menu-fonts')!;
    expect(link.href).toBe(fontStylesheet(['Outfit', 'Inter']));
    expect(link.href).not.toContain('Cinzel');
    expect(link.media).toBe('print');
    expect(link.href).toContain('display=swap');
    link.dispatchEvent(new Event('load'));
    expect(link.media).toBe('all');
    service.selected('Outfit', 'Inter');
    expect(document.querySelectorAll('#pc-menu-fonts')).toHaveLength(1);
  });
  it('never interpolates arbitrary saved CSS and deduplicates identical selections', () => {
    expect(menuFont('Inter; background:url(javascript:bad)', 'Inter')).toBe('Inter');
    expect(fontStylesheet(['Inter', 'Inter']).match(/family=/g)).toHaveLength(1);
    expect(fontStylesheet(['Libre Baskerville'])).toContain('wght@400;700');
  });
  it('loads the selected pixel pair with supported weights without falling back to platform fonts', () => {
    const service = TestBed.inject(MenuFontsService);
    service.selected('Silkscreen', 'Pixelify Sans');
    const href = document.querySelector<HTMLLinkElement>('#pc-menu-fonts')!.href;
    expect(menuFont('Silkscreen', 'Outfit')).toBe('Silkscreen');
    expect(menuFont('Pixelify Sans', 'Inter')).toBe('Pixelify Sans');
    expect(href).toContain('family=Silkscreen:wght@400;700');
    expect(href).toContain('family=Pixelify+Sans:wght@400;500;600;700');
    expect(href).not.toContain('Outfit');
    expect(href).not.toContain('Inter');
  });
  it.each(['Cormorant Garamond', 'Fredoka', 'Oswald'])('preserves the existing supported weights for %s', family => {
    expect(fontStylesheet([family])).toContain('wght@400;600;700');
    expect(fontStylesheet([family])).not.toContain(';800');
  });
});
