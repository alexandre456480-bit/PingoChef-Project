import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { PublicMenuService } from '../../services/public-menu.service';
import { PublicMenuViewComponent } from './public-menu-view.component';
import { AuthService } from '../../services/auth.service';
describe('public menu local navigation', () => {
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
