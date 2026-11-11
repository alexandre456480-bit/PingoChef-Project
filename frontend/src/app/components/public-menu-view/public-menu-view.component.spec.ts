import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { PublicMenuService } from '../../services/public-menu.service';
import { PublicMenuViewComponent } from './public-menu-view.component';
import { AuthService } from '../../services/auth.service';
import { vi } from 'vitest';
describe('public menu local navigation', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it.each([false, true])('opens curtains once, cleans up and respects reduced motion=%s', (reduced) => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduced })));
    TestBed.configureTestingModule({ imports: [PublicMenuViewComponent], providers: [provideHttpClient()] });
    const fixture = TestBed.createComponent(PublicMenuViewComponent), view = fixture.componentInstance;
    fixture.detectChanges();
    view.openMenuWithAnimation();
    expect(view.viewState).toBe('menu');
    expect(view.menuOpening).toBe(!reduced);
    expect(fixture.nativeElement.querySelectorAll('.entry-curtain').length).toBe(reduced ? 0 : 2);
    view.openMenuWithAnimation();
    vi.advanceTimersByTime(800);
    expect(view.menuOpening).toBe(false);
    expect(fixture.nativeElement.querySelector('.entry-transition-layer')).toBeNull();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.menu-main-shell'));
    view.resetToWelcome(); fixture.detectChanges();
    view.openMenuWithAnimation(); view.resetToWelcome();
    vi.advanceTimersByTime(800); fixture.detectChanges();
    expect(view.viewState).toBe('welcome');
    expect(view.menuOpening).toBe(false);
  });
  it('uses both welcome colors and a text-only entry button, with legacy fallback', () => {
    TestBed.configureTestingModule({ imports: [PublicMenuViewComponent], providers: [provideHttpClient()] });
    const service = TestBed.inject(PublicMenuService);
    const data = { business: { name: 'Casa Jardim', welcomeBgType: 'color', welcomeBgColor: '#FFFFFF', welcomeBgAccentColor: '#FFB800' }, design: { templateKey: 'default', homeBlocks: [], customConfig: {} }, categories: [], items: [] };
    service.menuData.set(data as any);
    const fixture = TestBed.createComponent(PublicMenuViewComponent), view = fixture.componentInstance;
    view.viewState = 'welcome'; fixture.detectChanges();
    expect(view.welcomeAccentColor).toBe('#FFB800');
    expect(view.welcomeButtonColor).toBe('#FFB800');
    expect(fixture.nativeElement.querySelectorAll('.welcome-shape').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.btn-enter-menu img, .btn-enter-menu svg')).toBeNull();
    service.menuData.set({ ...data, business: { ...data.business, welcomeBgAccentColor: undefined } } as any);
    expect(view.welcomeAccentColor).toBe('#FFB800');
    expect(view.welcomeBgColor).toBe('#FFFFFF');
    service.menuData.set({ ...data, business: { ...data.business, welcomeBgType: 'image', welcomeBgImage: '/cover.webp' } } as any);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.welcome-shape')).toBeNull();
  });
  it('shows the full PingoChef footer only on Free, including preview', () => {
    TestBed.configureTestingModule({ imports: [PublicMenuViewComponent], providers: [provideHttpClient()] });
    const service = TestBed.inject(PublicMenuService);
    const data = { business: { name: 'Bistrô' }, design: { templateKey: 'default', homeBlocks: [], customConfig: {} }, categories: [], items: [], showPingoChefBranding: true };
    service.menuData.set(data as any);
    const fixture = TestBed.createComponent(PublicMenuViewComponent), view = fixture.componentInstance;
    view.viewState = 'menu'; fixture.detectChanges();
    const credit = fixture.nativeElement.querySelector('.pingochef-credit') as HTMLAnchorElement;
    expect(credit.textContent).toContain('Cardápio Digital');
    expect(credit.querySelector('img')?.getAttribute('alt')).toBe('PingoChef');
    expect(credit.querySelector('img')?.getAttribute('src')).toBe('/pingo-chef-logo-principal.webp');
    expect(credit.getAttribute('href')).toBe('/plans');
    service.menuData.set({ ...data, showPingoChefBranding: false } as any); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.pingochef-credit')).toBeNull();
    expect(fixture.nativeElement.querySelector('.public-menu-footer')).toBeNull();
    view.isPhonePreview = true;
    const auth = TestBed.inject(AuthService);
    auth.account.set({ entitlements: { REMOVE_PINGOCHEF_BRANDING: false } });
    expect(view.showPingoChefBranding()).toBe(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.public-menu-footer')).not.toBeNull();
    auth.account.set({ entitlements: { REMOVE_PINGOCHEF_BRANDING: true } });
    expect(view.showPingoChefBranding()).toBe(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.public-menu-footer')).toBeNull();
  });
  it('memoizes catalog sections and finds açaí without accents, with no additional HTTP', () => {
    TestBed.configureTestingModule({
      imports: [PublicMenuViewComponent],
      providers: [provideHttpClient()],
    });
    const service = TestBed.inject(PublicMenuService);
    service.menuData.set({
      business: { name: 'Bistrô' },
      design: { templateKey: 'modern', homeBlocks: [], customConfig: {} },
      categories: [{ id: 'cat', name: 'Pratos' }],
      items: [
        {
          id: 'one',
          categoryId: 'cat',
          name: 'Açaí da casa',
          description: 'Frutas frescas',
          displayOrder: 0,
          price: 20,
        },
        { id: 'two', categoryId: 'other', name: 'Café', price: 12 },
      ],
    } as any);
    const fixture = TestBed.createComponent(PublicMenuViewComponent),
      view = fixture.componentInstance;
    const original = view.displayItems;
    expect(view.displayItems).toBe(original);
    view.searchFilter = 'ACAI';
    expect(view.displayItems.map((item) => item.id)).toEqual(['one']);
    expect(view.displayItems).toBe(view.displayItems);
    view.searchFilter = '';
    view.filterCategory('cat');
    expect(view.displayItems.map((item) => item.id)).toEqual(['one']);
    const item = view.displayItems[0];
    view.openProductDetail(item);
    expect(view.selectedProduct).toBe(item);
    view.closeProductDetail();
    expect(view.selectedProduct).toBeNull();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    view.openMenuWithAnimation();
    expect(view.viewState).toBe('menu');
    expect(view.menuOpening).toBe(false);
  });
  it('keeps composed text intact before filtering without loading the forms runtime', () => {
    TestBed.configureTestingModule({imports:[PublicMenuViewComponent],providers:[provideHttpClient()]});
    const view=TestBed.createComponent(PublicMenuViewComponent).componentInstance;
    const input=document.createElement('input');input.value='a';
    const composing=new InputEvent('input',{isComposing:true});Object.defineProperty(composing,'target',{value:input});
    view.updateSearch(composing);expect(view.searchFilter).toBe('');
    input.value='açaí';const complete=new Event('compositionend');Object.defineProperty(complete,'target',{value:input});
    view.updateSearch(complete);expect(view.searchFilter).toBe('açaí');
  });
});
