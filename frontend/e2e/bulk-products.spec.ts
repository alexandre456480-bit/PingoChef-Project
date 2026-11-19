import { expect, Page, test } from '@playwright/test';
test.setTimeout(90_000);
async function setup(page: Page) {
  let items = Array.from({length:6},(_,i)=>({id:`p${i}`,name:`Produto ${i}`,categoryId:i%2?'b':'a',categoryName:i%2?'Bebidas':'Pratos',price:10,isAvailable:true,showPrice:true,displayOrder:i}));
  let fail = false; const writes: any[] = [];
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route(/^https:\/\/(fonts\.|images\.unsplash)/, route => route.abort());
  await page.route('**/api/v1/**', route => {
    const req=route.request(), path=new URL(req.url()).pathname.replace('/api/v1/','');
    const ok=(data:unknown)=>route.fulfill({json:{success:true,data}});
    if(path==='auth/me')return ok({user:{id:'owner',name:'Ana'},business:{id:'tenant',name:'Teste',slug:'test'},accountActive:true,csrfToken:'a'.repeat(64),plan:{code:'PRO'},entitlements:{MAX_PRODUCTS:150,MAX_CATEGORIES:40},usage:{products:items.length,categories:2,videos:0},onboarding:{designConfigured:true}});
    if(path==='business/tutorial')return ok({tutorial_status:'COMPLETED'});
    if(path==='design')return ok({template_key:'default',home_blocks:[],custom_config:{}});
    if(path==='categories')return ok([{id:'a',name:'Pratos',isActive:true},{id:'b',name:'Bebidas',isActive:true}]);
    if(path==='items/bulk-delete') {
      const {ids}=req.postDataJSON();writes.push(ids);
      if(fail){fail=false;return route.fulfill({status:503,json:{success:false,error:{message:'Falha temporaria'}}});}
      items=items.filter(row=>!ids.includes(row.id));return ok({deletedIds:ids});
    }
    if(path==='items')return ok(items);
    return ok([]);
  });
  const open=async()=>{await page.goto('/dashboard');await expect(page.locator('.dashboard-shell')).toBeVisible({timeout:20000});const menu=page.getByRole('button',{name:'Abrir menu',exact:true});if(await menu.isVisible())await menu.click();await page.locator('[data-tour="nav-menu"]').click();await expect(page.locator('.products-grid > .product-card')).toHaveCount(items.length);};
  await open();return {writes,open,fail:()=>fail=true};
}

test('bulk selection preserves filters, confirms deletion and retains selection on failure',async({page})=>{
  const state=await setup(page);
  await page.getByRole('button',{name:'Excluir vários',exact:true}).click();
  await page.getByRole('checkbox',{name:'Selecionar Produto 0',exact:true}).check();
  await page.getByRole('checkbox',{name:'Selecionar Produto 2',exact:true}).check();
  await page.getByRole('button',{name:'Bebidas',exact:true}).click();
  await page.getByRole('checkbox',{name:'Selecionar Produto 1',exact:true}).check();
  const action=page.getByRole('button',{name:'Excluir selecionados (3)',exact:true});
  await expect(action).toBeEnabled();
  page.once('dialog',dialog=>dialog.dismiss());await action.click();expect(state.writes).toHaveLength(0);
  state.fail();page.once('dialog',dialog=>dialog.accept());await action.click();
  await expect(action).toBeEnabled();expect(state.writes).toHaveLength(1);
  await expect(page.getByRole('checkbox',{name:'Selecionar Produto 1',exact:true})).toBeChecked();
  page.once('dialog',dialog=>dialog.accept());await action.click();
  await expect(page.getByRole('button',{name:'Excluir vários',exact:true})).toBeVisible();
  expect(state.writes[1].sort()).toEqual(['p0','p1','p2']);
  await state.open();await expect(page.locator('.products-grid > .product-card')).toHaveCount(3);
  await page.getByRole('button',{name:'Excluir vários',exact:true}).click();
  await page.getByRole('button',{name:'Selecionar exibidos',exact:true}).click();
  await expect(page.getByRole('button',{name:'Excluir selecionados (3)',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Cancelar seleção',exact:true}).click();
  await expect(page.locator('.bulk-selection-bar')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
