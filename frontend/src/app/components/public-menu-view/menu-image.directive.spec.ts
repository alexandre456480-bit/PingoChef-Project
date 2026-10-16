import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MenuImageDirective, responsiveMenuImage, safeMenuImage } from './menu-image.directive';
@Component({
  imports: [MenuImageDirective],
  template: '<img [appMenuImage]="source" alt="Prato da casa">',
})
class Host {
  source = 'https://images.unsplash.com/photo-test?w=1600';
}
describe('public image pipeline', () => {
  it('selects appropriately sized known CDN images and preserves other/signed URLs', () => {
    expect(responsiveMenuImage('https://images.unsplash.com/photo-test?w=1600', 160)).toContain(
      'w=160',
    );
    expect(
      responsiveMenuImage('https://p.supabase.co/storage/v1/render/image/public/b/a.jpg', 320),
    ).toContain('width=320');
    const signed = 'https://p.supabase.co/storage/v1/object/sign/private/a.jpg?token=signed';
    expect(responsiveMenuImage(signed, 320)).toBe(signed);
    expect(responsiveMenuImage('https://other.example/picture.jpg', 320)).toBe(
      'https://other.example/picture.jpg',
    );
  });
  it.each([
    'javascript:alert(1)',
    'data:image/svg+xml;base64,AAAA',
    '//other.example/photo.jpg',
    'https://user:password@other.example/photo.jpg',
  ])('rejects unsafe saved image %s', (source) => {
    expect(safeMenuImage(source)).toBe('');
  });
  it('reserves dimensions, builds responsive candidates and replaces a broken source once', () => {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const image: HTMLImageElement = fixture.nativeElement.querySelector('img');
    expect(image.width).toBe(640);
    expect(image.height).toBe(400);
    expect(image.loading).toBe('lazy');
    expect(image.decoding).toBe('async');
    expect(image.srcset).toContain('320w');
    image.dispatchEvent(new Event('error'));
    expect(image.getAttribute('src')).toBe('/assets/menu/image-placeholder.svg');
    expect(image.srcset).toBe('');
    image.dispatchEvent(new Event('load'));
    expect(image.classList.contains('menu-image-ready')).toBe(true);
    image.dispatchEvent(new Event('error'));
    expect(image.style.visibility).toBe('hidden');
  });
});
