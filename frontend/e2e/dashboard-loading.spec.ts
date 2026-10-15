import {expect,test} from '@playwright/test';

test('audits initial dashboard requests without loading Analytics or a second bootstrap',async({page},info)=>{
  const requests:{endpoint:string;started:number;finished:number;bytes:number}[]=[];
  const start=performance.now();
  await page.route('**/api/v1/**',async route=>{
    const endpoint=new URL(route.request().url()).pathname;
    const record={endpoint,started:performance.now()-start,finished:0,bytes:0};requests.push(record);
    let data:any=[];
    if(endpoint==='/api/v1/auth/me')data={user:{id:'owner',name:'Owner'},business:{id:'tenant',name:'Staging fixture',slug:'fixture'},
      accountActive:true,plan:{code:'FREE',name:'Free'},entitlements:{MAX_PRODUCTS:10,MAX_CATEGORIES:4,MAX_VIDEOS:1},usage:{products:0,categories:0,videos:0},onboarding:{},csrfToken:'a'.repeat(64)};
    else if(endpoint==='/api/v1/design')data={};
    else expect(['/api/v1/categories','/api/v1/items']).toContain(endpoint);
    const body=JSON.stringify({success:true,data});record.bytes=Buffer.byteLength(body);
    await new Promise(resolve=>setTimeout(resolve,30)); // controlled provider latency, not staging evidence
    record.finished=performance.now()-start;
    await route.fulfill({contentType:'application/json',body});
  });
  await page.goto('/dashboard');
  await expect(page.locator('app-dashboard-home')).toBeVisible();
  await expect(page.locator('app-dashboard app-pingo-loader').first().locator('[aria-busy]')).toHaveAttribute('aria-busy','false');
  const navigationMs=performance.now()-start;
  console.info(JSON.stringify({event:'dashboard_loading_audit',device:info.project.name,navigation_ms:Math.round(navigationMs),requests:requests.length,
    api_payload_bytes:requests.reduce((n,r)=>n+r.bytes,0),scenario:'mocked API 30ms; not staging'}));
  expect(requests.map(r=>r.endpoint).sort()).toEqual(['/api/v1/auth/me','/api/v1/categories','/api/v1/design','/api/v1/items']);
  const auth=requests.find(r=>r.endpoint.endsWith('/me'))!;
  expect(requests.filter(r=>!r.endpoint.endsWith('/me')).every(r=>r.started>=auth.finished)).toBe(true);
  const independent=requests.filter(r=>!r.endpoint.endsWith('/me'));
  expect(Math.max(...independent.map(r=>r.started))).toBeLessThan(Math.min(...independent.map(r=>r.finished)));
  await info.attach('dashboard-request-audit',{body:JSON.stringify({scenario:'local browser, mocked API 30ms, empty tenant; NOT staging latency',navigation_ms:navigationMs,requests},null,2),contentType:'application/json'});
});
