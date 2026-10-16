import { test, expect } from '@playwright/test';

const business = { name:'Vídeo Segurança',slug:'video-security',description:'Menu continua disponível',logoUrl:'/logo_img.webp',coverImageUrl:'/logo_img.webp',welcomeBgType:'color',welcomeBgColor:'#2D1822' };
const response = { success:true,data:{ business,design:{templateKey:'modern',palette:{key:'gourmet_royal',name:'Gourmet Royal',colors:{primary:'#8B1A3A',secondary:'#D26E2D',accent:'#F47B20',background:'#FAF5F0',surface:'#FFFFFF',textPrimary:'#2D1822',textSecondary:'#6E5D65'}},fontHeading:'Outfit',fontBody:'Inter',fontPair:'modern_clean',categoryStyle:'icon_name',homeBlocks:[{id:'best',type:'best_seller',label:'Mais vendidos',enabled:true,position:0}],heroBanners:[],customConfig:{enable_likes:false,enable_cart:false}},categories:[{id:'category',name:'Pratos',displayOrder:0,isActive:true}],subcategories:[],items:[{id:'item',categoryId:'category',name:'Produto preservado',description:'Com foto',price:29.9,promotionalPrice:null,imageUrl:'/logo_img.webp',isAvailable:true,isHighlighted:true,highlightType:'best_seller',showPrice:true,likesCount:0,displayOrder:0,media:[{id:'media',mediaType:'video',source:'mux',position:0,durationSeconds:10,aspectRatio:'16:9'}]}] } };

test('a video hard block leaves products/posters usable and coalesces Play while pending',async({page})=>{
  test.setTimeout(60000);
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//,route=>route.fulfill({body:''}));
  await page.route('**/api/v1/public/menu/video-security',route=>route.fulfill({json:response}));
  await page.route('**/api/v1/public/menu/video-security/events',route=>route.fulfill({status:202,json:{success:true}}));
  await page.route('**/api/v1/public/menu/video-security/vitals',route=>route.fulfill({status:202,json:{success:true}}));
  let requested=0,release:()=>void=()=>{};
  const pending=new Promise<void>(resolve=>release=resolve);
  await page.route('**/api/v1/public/menus/**/playback',async route=>{
    requested++; await pending; await route.fulfill({status:503,json:{success:false,error:{code:'VIDEO_TEMPORARILY_UNAVAILABLE',message:'Vídeo temporariamente indisponível.'}}});
  });
  await page.goto('/m/video-security');
  await page.getByRole('button',{name:/ver o cardápio/i}).click();
  await page.locator('.best-seller-card').click();
  const play=page.getByRole('button',{name:/reproduzir vídeo/i});
  await expect(play).toBeVisible();
  expect(requested).toBe(0);
  await play.click();
  await expect.poll(()=>requested).toBe(1);
  await expect(page.getByRole('button',{name:'Preparando vídeo'})).toBeDisabled();
  expect(requested).toBe(1);release();
  await expect(page.locator('.playback-error')).toBeVisible();
  await expect(page.locator('.product-modal-sheet')).toContainText('Produto preservado');
  await expect(page.locator('mux-player')).toHaveCount(0);
  await expect(page.locator('.playback-error')).not.toContainText(/Mux|JWT|HARD_BLOCK|segurança/i);
  await page.getByRole('tab',{name:/foto 2/i}).click();
  await expect(page.locator('.media-stage img').first()).toBeVisible();
});
