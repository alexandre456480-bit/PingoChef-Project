import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ImagePayloadService, MAX_SAVE_BYTES, payloadBytes, imageSaveError } from './image-payload.service';

describe('Published image payload budget', () => {
  let service: ImagePayloadService;
  beforeEach(() => { service = TestBed.inject(ImagePayloadService); });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('leaves small saves, external URLs, alpha images and customer settings untouched', async () => {
    const input = { color: '#ABCDEF', logo_url: 'data:image/png;base64,AAAA', banners: ['https://example.test/banner.png'], enabled: false, image: null };
    const optimize = vi.spyOn(service, 'optimizeImage');
    expect(await firstValueFrom(service.prepare(input))).toBe(input);
    expect(optimize).not.toHaveBeenCalled();
  });

  it('counts repeated images toward the JSON limit but processes each source only once', async () => {
    const source = 'data:image/png;base64,' + 'A'.repeat(900_000);
    const optimize = vi.spyOn(service, 'optimizeImage').mockResolvedValue('data:image/webp;base64,BBBB');
    const input = { color: '#123456', home: [source, source], categories: { a: [source, source, source] }, text: 'Descrição' };
    const output = await firstValueFrom(service.prepare(input));
    expect(payloadBytes(output)).toBeLessThan(MAX_SAVE_BYTES);
    expect(optimize).toHaveBeenCalledTimes(1);
    expect(output.home[0]).toBe(output.categories.a[0]);
    expect(output.color).toBe(input.color);
    expect(input.home[0]).toBe(source);
  });

  it('counts UTF-8 metadata and refuses an unsendable body before any network request', async () => {
    await expect(firstValueFrom(service.prepare({ text: '🍔'.repeat(900_000) }))).rejects.toThrow('tamanho permitido');
  });

  it('refuses output that still exceeds the budget, including animated/unsupported inline data', async () => {
    const source = 'data:image/gif;base64,' + 'A'.repeat(4_000_000);
    await expect(firstValueFrom(service.prepare({ logo_url: source }))).rejects.toThrow('tamanho permitido');
  });

  it('encodes a large image with the same aspect ratio, no upscaling and WebP transparency', async () => {
    vi.stubGlobal('Image', class {
      naturalWidth = 3200; naturalHeight = 1800;
      onload?: () => void;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    });
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as any);
    const encode = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/webp;base64,AAAA');
    const result = await service.optimizeImage('data:image/png;base64,AAAA', 1000);
    expect(result).toBe('data:image/webp;base64,AAAA');
    expect(drawImage.mock.calls[0].slice(1)).toEqual([0, 0, 1600, 900]);
    expect(encode).toHaveBeenCalledWith('image/webp', .9);
  });

  it('reports an invalid image and a hosting 413 with actionable messages', async () => {
    vi.stubGlobal('Image', class {
      onerror?: () => void;
      set src(_value: string) { queueMicrotask(() => this.onerror?.()); }
    });
    await expect(service.optimizeImage('data:image/png;base64,bad', 1000)).rejects.toThrow('Selecione novamente');
    expect(imageSaveError({ status: 413 }, 'fallback')).toContain('imagens');
  });
});
