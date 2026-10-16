import { Directive, ElementRef, Input, NgZone, OnChanges, OnDestroy, inject } from '@angular/core';

export function safeMenuImage(value: string | null | undefined): string {
  if (!value || value.length > 6_000_000) return '';
  const trimmed = value.trim();
  // Legacy raster uploads remain supported; SVG/HTML data and active schemes do not.
  if (/^data:image\/(png|jpe?g|webp|avif|gif);base64,[a-z\d+/=\s]+$/i.test(trimmed)) return trimmed;
  if (/^\/(?!\/)[^\s\\]*$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.username || url.password) return '';
    if (
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
    )
      return url.href;
  } catch {
    /* Invalid saved image: use the local fallback. */
  }
  return '';
}
export function responsiveMenuImage(value: string, width: number): string {
  const source = safeMenuImage(value);
  if (!source.startsWith('https://')) return source;
  const url = new URL(source);
  if (url.hostname === 'images.unsplash.com') {
    url.searchParams.set('w', String(width));
    url.searchParams.set('q', '75');
    url.searchParams.set('auto', 'format');
    url.searchParams.set('fit', 'max');
    return url.href;
  }
  // Only resize an already opted-in Supabase render URL. Do not assume the
  // project has paid transformations, or alter private/signed object URLs.
  if (
    url.hostname.endsWith('.supabase.co') &&
    url.pathname.startsWith('/storage/v1/render/image/public/')
  ) {
    url.searchParams.set('width', String(width));
    url.searchParams.set('quality', '75');
    return url.href;
  }
  return source;
}
const FALLBACK = '/assets/menu/image-placeholder.svg';
@Directive({ selector: 'img[appMenuImage]', standalone: true })
export class MenuImageDirective implements OnChanges, OnDestroy {
  @Input({ required: true }) appMenuImage: string | null | undefined;
  @Input() menuImageKind: 'card' | 'hero' | 'logo' | 'detail' = 'card';
  @Input() menuImagePriority: 'high' | 'auto' | 'low' = 'auto';
  private image = inject<ElementRef<HTMLImageElement>>(ElementRef).nativeElement;
  private failed = false;
  private readonly loaded = () => this.onLoad();
  private readonly errored = () => this.onError();
  constructor() {
    // These callbacks only change DOM classes. A burst of image loads must not
    // mark the entire OnPush catalog dirty or start application change detection.
    inject(NgZone).runOutsideAngular(() => {
      this.image.addEventListener('load', this.loaded);
      this.image.addEventListener('error', this.errored);
    });
  }
  ngOnDestroy(): void {
    this.image.removeEventListener('load', this.loaded);
    this.image.removeEventListener('error', this.errored);
  }
  ngOnChanges(): void {
    const image = this.image,
      source = safeMenuImage(this.appMenuImage);
    this.failed = false;
    image.style.visibility = '';
    image.classList.remove('menu-image-ready', 'menu-image-failed');
    image.classList.add('menu-image-loading');
    image.decoding = 'async';
    image.loading = this.menuImageKind === 'card' ? 'lazy' : 'eager';
    image.fetchPriority = this.menuImagePriority;
    image.classList.toggle('menu-image-priority', this.menuImagePriority === 'high');
    if (!image.hasAttribute('width')) image.width = this.menuImageKind === 'logo' ? 160 : 640;
    if (!image.hasAttribute('height')) image.height = this.menuImageKind === 'logo' ? 160 : 400;
    image.removeAttribute('srcset');
    image.removeAttribute('sizes');
    if (!source) {
      this.onError();
      return;
    }
    const width = this.menuImageKind === 'logo' ? 160 : this.menuImageKind === 'card' ? 320 : 960;
    const optimized = responsiveMenuImage(source, width);
    if (optimized !== source || /images\.unsplash\.com|\/render\/image\/public\//.test(source)) {
      const widths = this.menuImageKind === 'logo' ? [80, 160, 320] : [160, 320, 640, 960, 1280];
      image.srcset = widths.map((w) => `${responsiveMenuImage(source, w)} ${w}w`).join(', ');
      image.sizes =
        this.menuImageKind === 'logo'
          ? '160px'
          : this.menuImageKind === 'card'
            ? 'auto, (max-width: 480px) 40vw, 220px'
            : '(max-width: 480px) 100vw, 480px';
    }
    image.src = optimized;
    if (image.complete && image.naturalWidth) this.onLoad();
  }
  onLoad(): void {
    this.image.classList.remove('menu-image-loading');
    this.image.classList.add('menu-image-ready');
  }
  onError(): void {
    if (this.failed) {
      this.image.style.visibility = 'hidden';
      return;
    }
    this.failed = true;
    this.image.classList.add('menu-image-failed');
    this.image.removeAttribute('srcset');
    this.image.src = FALLBACK;
  }
}
