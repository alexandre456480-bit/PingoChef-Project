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
    if(path==='auth/me')return ok({user:{id:'owner',name:'Ana'},business:{id:'tenant',name:'Teste',slug:'test'},accountActive:true,csrfToken:'a'.repeat(64),plan:{code:'PRO'},entitlements:{MAX_PRODUCTS:150,MAX_CATEGORIES:40},usage:{products:6,categories:2,videos:0},onboarding:{designConfigured:true}});
    if(path==='business/tutorial')return ok({tutorial_status:'COMPLETED'});
    if(path==='design')return ok({template_key:'default',home_blocks:[],custom_config:{}});
    if(path==='categories')return ok([{id:'a',name:'Pratos',isActive:true},{id:'b',name:'Bebidas',isActive:true}]);
    if(path==='items/reorder'){
      const {orders}=req.postDataJSON();writes.push(orders);
      if(fail){fail=false;return route.fulfill({status:503,json:{success:false}});}
      items=items.map(row=>({...row,displayOrder:orders.find((o:any)=>o.id===row.id).displayOrder}));return ok({});
    }
    if(path==='items')return ok(items);
    return ok([]);
  });
  const open=async()=>{await page.goto('/dashboard');await expect(page.locator('.dashboard-shell')).toBeVisible({timeout:20000});const menu=page.getByRole('button',{name:'Abrir menu',exact:true});if(await menu.isVisible())await menu.click();await page.locator('[data-tour="nav-menu"]').click();await expect(page.locator('.products-grid > .product-card')).toHaveCount(6);};
  await open();return {writes,open,fail:()=>fail=true};
}
const names=(page:Page)=>page.locator('.products-grid > .product-card .product-name');
test('drag handle rearranges cards live, persists on drop and works with touch',async({page},info)=>{
  const state=await setup(page);
  const handle=page.getByRole('button',{name:'Reordenar Produto 0',exact:true});
  await handle.scrollIntoViewIfNeeded();
  const from=(await handle.boundingBox())!, target=(await page.locator('.products-grid > .product-card').nth(1).boundingBox())!;
  const start={x:from.x+from.width/2,y:from.y+from.height/2};
  const end={x:target.x+target.width/2,y:Math.max(target.y+20,Math.min(start.y,target.y+target.height-20))};
  const mobile=info.project.name.includes('mobile');
  const session=mobile?await page.context().newCDPSession(page):null;
  if(session){await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});await page.waitForTimeout(240);}
  else{await page.mouse.move(start.x,start.y);await page.mouse.down();}
  for(let i=1;i<=15;i++){
    const point={x:start.x+(end.x-start.x)*i/15,y:start.y+(end.y-start.y)*i/15};
    if(session)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point]});else await page.mouse.move(point.x,point.y);
    await page.waitForTimeout(20);
  }
  await expect(page.locator('.cdk-drag-preview')).toHaveCount(1);
  // A new slot is occupied while still held; saving happens only on release.
  expect(state.writes).toHaveLength(0);
  await expect(page.locator('.products-grid > .product-card:not(.cdk-drag-placeholder)').first().locator('.product-name')).toHaveText('Produto 1');
  const displayedOrder = await names(page).allTextContents();
  expect(displayedOrder).not.toEqual(['Produto 0','Produto 1','Produto 2','Produto 3','Produto 4','Produto 5']);
  if(session)await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();
  await expect(page.locator('.product-order-status')).toHaveText('Ordem dos produtos salva.');
  await expect(names(page)).toHaveText(displayedOrder);
  expect(state.writes).toHaveLength(1);await state.open();
  await expect(names(page)).toHaveText(displayedOrder);
});
test('keyboard ordering rolls back on failure and preserves other-category slots',async({page})=>{
  const state=await setup(page);state.fail();
  await page.getByRole('button',{name:'Reordenar Produto 0',exact:true}).press('ArrowRight');
  await expect(page.locator('.product-order-status')).toContainText('ordem anterior foi mantida');
  await expect(names(page)).toHaveText(['Produto 0','Produto 1','Produto 2','Produto 3','Produto 4','Produto 5']);
  await page.getByRole('button',{name:'Pratos',exact:true}).click();
  await page.getByRole('button',{name:'Reordenar Produto 0',exact:true}).press('ArrowDown');
  await expect(page.locator('.product-order-status')).toHaveText('Ordem dos produtos salva.');
  await expect(names(page)).toHaveText(['Produto 2','Produto 0','Produto 4']);
  const saved=state.writes.at(-1);expect(saved.map((row:any)=>row.id)).toEqual(['p2','p1','p0','p3','p4','p5']);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
