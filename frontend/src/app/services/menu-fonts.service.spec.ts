import { TestBed } from '@angular/core/testing';
import { fontStylesheet, menuFont, MenuFontsService } from './menu-fonts.service';
describe('menu font loading', () => {
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
  it.each(['Cormorant Garamond', 'Fredoka', 'Oswald'])('preserves the existing supported weights for %s', family => {
    expect(fontStylesheet([family])).toContain('wght@400;600;700');
    expect(fontStylesheet([family])).not.toContain(';800');
  });
});
