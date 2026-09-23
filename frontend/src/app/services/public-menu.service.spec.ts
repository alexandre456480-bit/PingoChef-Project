import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PublicMenuService } from './public-menu.service';

describe('PublicMenuService hardening', () => {
  let service: PublicMenuService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PublicMenuService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(PublicMenuService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('does not replace an inactive or missing tenant with demo public data', () => {
    service.loadPublicMenu('inactive-tenant').subscribe();
    const req = http.expectOne('http://localhost:3000/api/v1/public/menu/inactive-tenant');
    req.flush({ success: false }, { status: 404, statusText: 'Not Found' });

    expect(service.menuData()).toBeNull();
    expect(service.error()).toContain('inativo');
    expect(service.loading()).toBe(false);
  });
});
