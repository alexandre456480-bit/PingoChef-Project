import { expect, Page, test } from '@playwright/test';
test.setTimeout(180_000);
const types=['hero','categories','promotion','most_liked','featured_product','combo','best_seller'];
const palette={key:'custom',name:'Minha paleta',colors:{primary:'#652738',secondary:'#a67944',accent:'#ca571e',background:'#fff9f2',surface:'#ffffff',textPrimary:'#31202a',textSecondary:'#75616b'}};
const products=['promotion','chef','combo','best_seller'].map((highlightType,i)=>({id:`p${i}`,name:`Produto ${i}`,categoryId:'food',price:15,isAvailable:true,showPrice:true,isHighlighted:true,highlightType,likesCount:10,imageUrl:'/logo_img.webp'}));
async function mock(page:Page){
  const state={template:'default',first:'hero',enabled:true,emptyOffers:false,likes:true};
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('https://fonts.googleapis.com/**',r=>r.abort());
  await page.route('**/api/v1/**',r=>r.fulfill({json:{success:true,data:{business:{name:'Casa Jardim',slug:'side-image',logoUrl:'/logo_img.webp'},design:{templateKey:state.template,palette,heroBanners:['/logo_img.webp'],homeBlocks:[state.first,...types.filter(type=>type!==state.first)].map((type,position)=>({id:type,type,label:type,enabled:true,position})),customConfig:{enable_likes:state.likes,enable_cart:true,intro_card:{enabled:false},first_block_image:{enabled:state.enabled,imageUrl:'/logo_img.webp'}}},categories:[{id:'food',name:'Pratos',iconType:'none',isActive:true}],subcategories:[],items:state.emptyOffers?products.filter(p=>p.highlightType!=='promotion'):products}}}));
  const open=async()=>{await page.goto('/m/side-image');await page.getByRole('button',{name:'Ver o Card\u00e1pio',exact:true}).click();await expect(page.locator('.showcase-scrollable')).toBeVisible();};
  return {state,open};
}
async function geometry(page:Page,first:string){
  const wrapper=page.locator('.home-first-block-layout');await expect(wrapper).toHaveCount(1);await expect(wrapper).toHaveAttribute('data-first-block',first);
  const box=await wrapper.evaluate(el=>{const w=el.getBoundingClientRect(),c=el.querySelector('.home-first-block-content')!.getBoundingClientRect(),i=el.querySelector('.home-first-block-image')!.getBoundingClientRect();return {gap:i.left-c.right,ratio:i.width/i.height,right:i.right-w.right,radius:getComputedStyle(el.querySelector('.home-first-block-image')!).borderRadius,overflow:document.documentElement.scrollWidth>innerWidth};});
  await expect(wrapper.locator('.block-header')).toHaveCount(0);
  expect(box.gap).toBeGreaterThan(0);expect(box.ratio).toBeCloseTo(.75,2);expect(box.right).toBeLessThan(1);expect(box.radius).not.toBe('0px');expect(box.overflow).toBe(false);
}
test('side image follows the first rendered product section and disappears outside Home or when disabled',async({page})=>{
  const {state,open}=await mock(page);
  for(const first of types){state.first=first;await open();await geometry(page,['hero','categories'].includes(first)?'promotion':first);}
  state.first='promotion';state.emptyOffers=true;await open();await geometry(page,'most_liked');
  state.emptyOffers=false;state.first='most_liked';state.likes=false;await open();await geometry(page,'promotion');
  state.likes=true;state.enabled=false;await open();await expect(page.locator('.home-first-block-layout')).toHaveCount(0);
  state.enabled=true;await open();await page.getByRole('button',{name:'Pratos',exact:true}).click();await expect(page.locator('.home-first-block-layout')).toHaveCount(0);
});
test('all template layouts reserve a separate 3:4 image column',async({page})=>{
  const {state,open}=await mock(page);
  for(const template of ['default','centered-cover','arched-cover','brand-hero','signature-cover','pixel','retro-diner','circuit-tech','soft-wave','immersive-cover','nordic-tavern','japanese-izakaya','neon-arcade','tropical-bamboo','mexican-fiesta','editorial-menu','product-gallery','compact-menu','sweet-boutique','royal-palace','liquid-glass','rounded-showcase','soft-showcase','double-showcase']){
    state.template=template;state.first='hero';await open();await geometry(page,'promotion');
    state.first='featured_product';await open();await geometry(page,'featured_product');
  }
});

test('owner crops, saves, reloads, hides and removes the image in Page Blocks',async({page})=>{
  let design:any={template_key:'default',palette,home_blocks:types.map((type,position)=>({id:type,type,label:type,enabled:type==='categories',position})),custom_config:{hero_banners:[],intro_card:{enabled:false}}};
  let saves=0;
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('https://fonts.googleapis.com/**',r=>r.abort());
  await page.route('**/api/v1/**',r=>{
    const req=r.request(),path=new URL(req.url()).pathname.replace('/api/v1/','');
    const ok=(data:unknown)=>r.fulfill({json:{success:true,data}});
    if(path==='auth/me')return ok({user:{id:'owner'},business:{id:'tenant',name:'Casa Jardim',slug:'side-image'},accountActive:true,csrfToken:'a'.repeat(64),plan:{code:'PRO'},entitlements:{MAX_PRODUCTS:150,MAX_CATEGORIES:40},usage:{products:4,categories:1,videos:0},onboarding:{designConfigured:true}});
    if(path==='business/tutorial')return ok({tutorial_status:'COMPLETED'});
    if(path==='design'){if(req.method()==='PUT'){design=req.postDataJSON();saves++;}return ok(design);}
    if(path==='categories')return ok([{id:'food',name:'Pratos',iconType:'none',isActive:true}]);
    if(path==='items')return ok(products);
    return ok([]);
  });
  const open=async()=>{await page.goto('/dashboard');await expect(page.locator('.dashboard-shell')).toBeVisible({timeout:20000});const menu=page.getByRole('button',{name:'Abrir menu',exact:true});if(await menu.isVisible())await menu.click();await page.locator('[data-tour="nav-design"]').click();await page.locator('details.design-section').filter({has:page.getByRole('heading',{name:'Blocos da Página',exact:true})}).locator('summary').click();};
  await open();const editor=page.locator('app-home-side-image-editor');
  const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=400;c.height=300;const ctx=c.getContext('2d')!;ctx.fillStyle='#cb612a';ctx.fillRect(0,0,400,300);return c.toDataURL('image/png');});
  const file={name:'photo.png',mimeType:'image/png',buffer:Buffer.from(data.split(',')[1],'base64')};
  await editor.locator('input[type=file]').setInputFiles(file);
  let dialog=page.getByRole('dialog',{name:'Imagem lateral do Início'});
  await expect(dialog).toBeVisible();
  expect(await dialog.locator('.crop-frame').evaluate(el=>getComputedStyle(el).aspectRatio)).toBe('0.75 / 1');
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
  await expect(editor.locator('.side-image-preview')).toHaveCount(0);
  await editor.locator('input[type=file]').setInputFiles(file);
  dialog=page.getByRole('dialog',{name:'Imagem lateral do Início'});
  await dialog.getByRole('button',{name:'Usar imagem',exact:true}).click();
  await expect(editor.locator('.side-image-preview')).toBeVisible();
  expect(saves).toBe(0);
  await page.locator('[data-tour="design-save"]').click();
  await expect.poll(()=>saves).toBe(1);
  expect(design.custom_config.first_block_image.enabled).toBe(true);
  expect(design.custom_config.first_block_image.imageUrl).toMatch(/^data:image/);
  expect(Buffer.byteLength(JSON.stringify(design))).toBeLessThan(3500000);
  await open();await expect(editor.locator('.side-image-preview')).toBeVisible();
  await editor.getByRole('checkbox',{name:'Exibir imagem no Início'}).uncheck();
  await page.locator('[data-tour="design-save"]').click();
  await expect.poll(()=>design.custom_config.first_block_image.enabled).toBe(false);
  expect(design.custom_config.first_block_image.imageUrl).toMatch(/^data:image/);
  await editor.getByRole('button',{name:'Remover',exact:true}).click();
  await expect(editor.locator('.side-image-preview')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
