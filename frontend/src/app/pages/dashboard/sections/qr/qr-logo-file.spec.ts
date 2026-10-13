import { logoPlacement, QR_LOGO_MAX_BYTES, validateQrLogoFile } from './qr-logo-file';

describe('QR logo limits and square placement', () => {
  it('accepts exactly 4 MiB regardless of the declared MIME type or original aspect ratio', () => {
    const file = new File([new Uint8Array(QR_LOGO_MAX_BYTES)], 'logo.pdf', { type: 'application/pdf' });
    expect(() => validateQrLogoFile(file)).not.toThrow();
    expect(() => validateQrLogoFile(new File([new Uint8Array(QR_LOGO_MAX_BYTES + 1)], 'logo.png'))).toThrow('4 MB');
    expect(() => validateQrLogoFile(new File([], 'logo.jpg'))).toThrow('vazio');
  });

  it('fits a rectangular logo without distorting or cutting it', () => {
    expect(logoPlacement(512, 256, 128, 1, 0, 0, false)).toEqual({ width: 128, height: 64, left: 0, top: 32 });
  });

  it.each([[512, 256], [256, 512], [10000, 8000]])('covers the square and bounds dragging for %s × %s', (width, height) => {
    for (const x of [-100, 0, 100]) for (const y of [-100, 0, 100]) {
      const p = logoPlacement(width, height, 128, 2, x, y, true);
      expect(p.left).toBeLessThanOrEqual(0);
      expect(p.top).toBeLessThanOrEqual(0);
      expect(p.left + p.width).toBeGreaterThanOrEqual(128);
      expect(p.top + p.height).toBeGreaterThanOrEqual(128);
      expect(p.width / p.height).toBeCloseTo(width / height);
    }
  });

  it('positions smaller logos entirely inside the square', () => {
    expect(logoPlacement(512, 256, 128, 1, 0, -100, false).top).toBe(0);
    expect(logoPlacement(512, 256, 128, 1, 0, 100, false).top).toBe(64);
  });
});
