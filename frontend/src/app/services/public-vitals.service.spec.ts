import { TestBed } from '@angular/core/testing';
import { PublicVitalsService } from './public-vitals.service';
import * as webVitals from 'web-vitals';
vi.mock('web-vitals', () => ({
  onCLS: vi.fn(),
  onFCP: vi.fn(),
  onINP: vi.fn(),
  onLCP: vi.fn(),
  onTTFB: vi.fn(),
}));
describe('anonymous public Web Vitals', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });
  it('sends a bounded batch without credentials, visitor identifiers, URLs or selectors', async () => {
    const send = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const service = TestBed.inject(PublicVitalsService);
    await service.start('bistro', 'modern');
    const report = (webVitals.onLCP as any).mock.calls[0][0];
    report({
      name: 'LCP',
      value: 1200,
      attribution: { url: 'private', selector: '#email' },
      id: 'visitor-private',
    });
    service.end();
    service.end();
    expect(send).toHaveBeenCalledTimes(1);
    const [url, options] = send.mock.calls[0];
    expect(url).toBe('/api/v1/public/menu/bistro/vitals');
    expect(options?.credentials).toBe('omit');
    expect(JSON.parse(options?.body as string)).toEqual({
      templateCode: 'modern',
      deviceClass: expect.stringMatching(/^(mobile|tablet|desktop)$/),
      metrics: [{ name: 'LCP', value: 1200 }],
    });
    expect(options?.body).not.toMatch(/private|selector|visitor|pageId|attribution/);
  });
  it('ignores unknown templates without creating a high-cardinality telemetry channel', async () => {
    const service = TestBed.inject(PublicVitalsService);
    await service.start('bistro', 'arbitrary-template');
    expect(webVitals.onLCP).not.toHaveBeenCalled();
  });
  it('does not attribute a preceding admin document to a menu opened through SPA navigation', async () => {
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{ name:'https://example.test/dashboard' }] as any);
    const service = TestBed.inject(PublicVitalsService);
    await service.start('bistro', 'modern');
    expect(webVitals.onLCP).not.toHaveBeenCalled();
  });
});
