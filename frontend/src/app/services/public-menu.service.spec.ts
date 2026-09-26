import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PublicMenuService } from './public-menu.service';

describe('PublicMenuService hardening', () => {
  let service: PublicMenuService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [PublicMenuService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(PublicMenuService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('does not replace an inactive or missing tenant with demo public data', () => {
    service.loadPublicMenu('inactive-tenant').subscribe();
    const req = http.expectOne('/api/v1/public/menu/inactive-tenant');
    req.flush({ success: false }, { status: 404, statusText: 'Not Found' });

    expect(service.menuData()).toBeNull();
    expect(service.error()).toContain('inativo');
    expect(service.loading()).toBe(false);
  });

  it('prevents duplicate likes locally and reconciles with the server count', () => {
    service.menuData.set({ items: [{ id: 'item-1', likesCount: 4 }] } as any);

    service.likeItem('tenant', 'item-1').subscribe();
    expect(service.menuData()?.items[0].likesCount).toBe(5);
    const req = http.expectOne('/api/v1/public/menu/tenant/like/item-1');
    req.flush({ success: true, data: { itemId: 'item-1', likesCount: 5, created: true } });

    service.likeItem('tenant', 'item-1').subscribe();
    http.expectNone('/api/v1/public/menu/tenant/like/item-1');
    expect(service.menuData()?.items[0].likesCount).toBe(5);
  });

  it('rolls back the optimistic like when the server rejects it', () => {
    service.menuData.set({ items: [{ id: 'item-2', likesCount: 8 }] } as any);

    service.likeItem('tenant', 'item-2').subscribe();
    const req = http.expectOne('/api/v1/public/menu/tenant/like/item-2');
    req.flush({}, { status: 503, statusText: 'Unavailable' });

    expect(service.isItemLiked('item-2')).toBe(false);
    expect(service.isLikePending('item-2')).toBe(false);
    expect(service.menuData()?.items[0].likesCount).toBe(8);
  });
});
