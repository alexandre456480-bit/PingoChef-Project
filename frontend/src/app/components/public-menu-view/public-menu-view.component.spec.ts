import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { PublicMenuService } from '../../services/public-menu.service';
import { PublicMenuViewComponent } from './public-menu-view.component';
describe('public menu local navigation', () => {
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
