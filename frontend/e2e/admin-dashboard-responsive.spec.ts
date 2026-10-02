import { test, expect } from '@playwright/test';

const mockReport = {
  filter: { from:'2026-09-01T03:00:00Z',to:'2026-10-01T03:00:00Z',timezone:'America/Sao_Paulo',granularity:'day',comparison:'none',compareFrom:null,compareTo:null },
  overview:{ events:{},series:[] },
  snapshot:{ clientsTotal:18,clientsActive:16,clientsSuspended:2,menusPublished:11,products:92,images:50,videos:7,active7d:8,active30d:12,subscriptionsActive:0,subscriptionsGrace:0,subscriptionsPastDue:0,subscriptionsCanceled:0 },
  period:{ newClients:4,previousNewClients:0,productsCreated:15,imagesAdded:8,videosAdded:2,publications:3 },
  attention:{ grace:0,failedWebhooks:0,rejectedUploads:0,adminLoginAttempts:0 },
  funnel:{ account:4,business:3,category:3,product:2,design:2,published:1 },
  series:[{bucket:'2026-09-15T03:00:00Z',metric:'newClients',value:4}],
  templates:[{template:'tmpl_modern_dark',count:11}],timings:{inviteToSignupSeconds:7200,signupToPublishSeconds:86400}
};

const mockCommercial = {
  statuses:{active:3,grace:1},newSubscriptions:2,cancellations:1,
  planDistribution:[{plan:'BASIC',count:3}],graceDays:3,billingEnforced:false,
  financial:{mrr:null,recognizedRevenue:null,approvedPayments:null,churn:null,
    arpu:null,delinquentAmount:null,revenueByPlan:null,availability:'PROVIDER_NOT_CONFIGURED'}
};
const mockInfrastructure = {
  mux:{status:{ready:4,processing:1},uploads:7,declaredUploadBytes:35000000,
    deliveryBytes:null,providerStorageBytes:null},
  storage:{trackedImages:12,newTrackedImages:3,storageBytes:null},
  database:{businesses:5,products:20,media:16,databaseBytes:null},
  api:{requests:130,errors5xx:2,rateLimits:4,averageLatencyMs:95,maxLatencyMs:500},
  byBusiness:[{businessId:'92000000-0000-0000-0000-000000000001',uploads:4}],
  byBusinessStorage:[{businessId:'92000000-0000-0000-0000-000000000001',
    trackedImages:12,newTrackedImages:3}],
  alerts:[{code:'IMAGE_SURGE',businessId:'92000000-0000-0000-0000-000000000001',
    count:30,threshold:30}],
  measurement:{api:'BEST_EFFORT_PERSISTED',mux:'DATABASE_EVENTS',
    storageBytes:'UNAVAILABLE',costs:'UNAVAILABLE'}
};

test('Admin renders desktop, tablet and mobile without horizontal page overflow', async ({ page }) => {
  await page.route('**/api/v1/admin/auth/session', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:{userId:'00000000-0000-0000-0000-000000000001',csrfToken:'test-csrf'}})}));
  await page.route('**/api/v1/admin/dashboard**', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:mockReport})}));
  for (const viewport of [{width:1440,height:900},{width:768,height:1024},{width:390,height:844}]) {
    await page.setViewportSize(viewport);
    await page.goto('/admin/overview');
    await expect(page.getByRole('heading',{name:'Como está o PingoChef?'})).toBeVisible();
    await expect(page.getByText('18',{exact:true}).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow, `horizontal overflow at ${viewport.width}px`).toBe(false);
    if(viewport.width<900){
      await page.getByRole('button',{name:'Abrir navegação'}).click();
      await expect(page.locator('.admin-sidebar').getByRole('link',{name:/Clientes/})).toBeVisible();
      await page.getByRole('button',{name:'Fechar navegação'}).click({position:{x:viewport.width-12,y:viewport.height/2}});
    }
  }
});

test('analytics filters stay visible and survive a refresh in the URL', async ({ page }) => {
  await page.route('**/api/v1/admin/auth/session', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:{userId:'00000000-0000-0000-0000-000000000001',csrfToken:'test-csrf'}})}));
  await page.route('**/api/v1/admin/dashboard**', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:mockReport})}));
  await page.goto('/admin/analytics');
  await page.getByLabel('Selecionar período').selectOption('last7');
  await page.getByLabel('Comparar com').selectOption('previous');
  await expect(page).toHaveURL(/preset=last7/);
  await expect(page).toHaveURL(/comparison=previous/);
  await page.reload();
  await expect(page.getByLabel('Selecionar período')).toHaveValue('last7');
  await expect(page.getByLabel('Comparar com')).toHaveValue('previous');
  await expect(page.getByText('Período analisado')).toBeVisible();
});

test('commercial and infrastructure pages show measured values and unavailable finance', async ({ page }) => {
  await page.route('**/api/v1/admin/auth/session', route => route.fulfill({status:200,
    contentType:'application/json',body:JSON.stringify({success:true,data:{
      userId:'00000000-0000-0000-0000-000000000001',csrfToken:'test-csrf'}})}));
  await page.route('**/api/v1/admin/dashboard**', route => route.fulfill({status:200,
    contentType:'application/json',body:JSON.stringify({success:true,data:mockReport})}));
  await page.route('**/api/v1/admin/commercial**', route => route.fulfill({status:200,
    contentType:'application/json',body:JSON.stringify({success:true,data:mockCommercial})}));
  await page.route('**/api/v1/admin/infrastructure**', route => route.fulfill({status:200,
    contentType:'application/json',body:JSON.stringify({success:true,data:mockInfrastructure})}));
  await page.goto('/admin/subscriptions');
  await expect(page.getByRole('heading',{name:'Painel financeiro preparado'})).toBeVisible();
  await expect(page.getByText('Valores indisponíveis até existir provedor de cobrança')).toBeVisible();
  await expect(page.getByText('Grace configurado')).toBeVisible();
  await page.goto('/admin/usage');
  await expect(page.getByRole('heading',{name:'Imagens Storage por cliente'})).toBeVisible();
  await expect(page.getByText('Muitas imagens Storage')).toBeVisible();
  await expect(page.getByText('Não medidos',{exact:true})).toBeVisible();
});
