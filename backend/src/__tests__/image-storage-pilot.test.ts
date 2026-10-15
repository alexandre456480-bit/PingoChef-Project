import { PNG } from 'pngjs';
import { normalizePilotImage, stagePrivateImage } from '../services/image-storage-pilot.service';
import { supabaseAdmin,createUserClient } from '../config/supabase';
import { businessEligibility } from '../services/business-eligibility.service';
import { entitlements } from '../services/entitlement.service';

jest.mock('../config/supabase',()=>({supabaseAdmin:{auth:{getUser:jest.fn()},from:jest.fn(),storage:{from:jest.fn()}},createUserClient:jest.fn()}));
const environment={...process.env};
const png=()=>PNG.sync.write(new PNG({width:32,height:32}),{colorType:6});
afterEach(()=>{process.env={...environment};jest.restoreAllMocks();});

test('normalization is deterministic, bounded and preserves decoded pixels',()=>{
  const a=normalizePilotImage(png(),'image.png','image/png'),b=normalizePilotImage(png(),'image.png','image/png');
  expect(a.sha256).toBe(b.sha256);expect(a.width).toBe(32);expect(a.height).toBe(32);
  expect(PNG.sync.read(a.bytes).data).toEqual(PNG.sync.read(png()).data);
});
test.each([
  ['../image.png','image/png',()=>png()],['image.svg','image/png',()=>png()],
  ['image.png','image/jpeg',()=>png()],['image.png','image/png',()=>Buffer.from('<svg onload="bad()"/>')],
  ['image.png','image/png',()=>Buffer.concat([png(),Buffer.from('<script>bad</script>')])],
  ['image.png','image/png',()=>Buffer.alloc(4194305)],
  ['image.png','image/png',()=>{const b=png();b.writeUInt32BE(0xffffffff,16);return b;}],
  ['image.png','image/png',()=>{const b=png();b[25]=3;return b;}],
  ['image.png','image/png',()=>{const b=png();b[28]=1;return b;}],
  ['image.png','image/png',()=>{const b=png();b[40]^=255;return b;}],
  ['image.png','image/png',()=>png().subarray(0,40)],
])('rejects malicious/mismatched upload %#',(name,mime,bytes)=>{
  expect(()=>normalizePilotImage(bytes(),name,mime)).toThrow(expect.objectContaining({status:400,code:'IMAGE_INVALID'}));
});
function staging(){Object.assign(process.env,{DEPLOYMENT_ENV:'staging',MEDIA_STORAGE_ENABLED:'true',EXPECTED_SUPABASE_PROJECT_REF:'stagingref123',PRODUCTION_SUPABASE_PROJECT_REF:'productionref123',SUPABASE_URL:'https://stagingref123.supabase.co'});}
const context={businessId:'trusted-business',userId:'trusted-owner',accessToken:'staging-only-token'};
test('production and identical project cannot upload',async()=>{
  staging();process.env.DEPLOYMENT_ENV='production';
  await expect(stagePrivateImage(context,png(),'image.png','image/png')).rejects.toMatchObject({code:'IMAGE_PILOT_DISABLED'});
  staging();process.env.PRODUCTION_SUPABASE_PROJECT_REF='stagingref123';
  await expect(stagePrivateImage(context,png(),'image.png','image/png')).rejects.toMatchObject({code:'IMAGE_PILOT_DISABLED'});
  expect(supabaseAdmin.auth.getUser).not.toHaveBeenCalled();
});
test('foreign owner cannot reach privileged Storage even with forged business context',async()=>{
  staging();(supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({data:{user:{id:context.userId}},error:null});
  const query={select:jest.fn().mockReturnThis(),eq:jest.fn().mockReturnThis(),maybeSingle:jest.fn().mockResolvedValue({data:null,error:null})};
  (createUserClient as jest.Mock).mockReturnValue({from:jest.fn().mockReturnValue(query)});
  await expect(stagePrivateImage({...context,businessId:'foreign'},png(),'image.png','image/png')).rejects.toMatchObject({status:403});
  expect(query.eq).toHaveBeenCalledWith('owner_user_id',context.userId);
  expect(supabaseAdmin.storage.from).not.toHaveBeenCalled();
});
test.each(['suspended','subscription'])('fresh %s denial cannot be bypassed',async reason=>{
  staging();(supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({data:{user:{id:context.userId}},error:null});
  const query:any={select:jest.fn().mockReturnThis(),eq:jest.fn().mockReturnThis(),maybeSingle:jest.fn().mockResolvedValue({data:{id:context.businessId},error:null})};
  (createUserClient as jest.Mock).mockReturnValue({from:jest.fn().mockReturnValue(query)});
  jest.spyOn(businessEligibility,'isAccountActive').mockResolvedValue(reason!=='suspended');
  jest.spyOn(entitlements,'getEntitlements').mockResolvedValue({entitlements:{}} as any);
  await expect(stagePrivateImage(context,png(),'image.png','image/png')).rejects.toMatchObject({status:403});
  expect(supabaseAdmin.storage.from).not.toHaveBeenCalled();
});
test.each([false,true])('staging upload/readback is idempotent, never overwrites, keeps old data; existing=%s',async existing=>{
  staging();(supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({data:{user:{id:context.userId}},error:null});
  const q:any={select:jest.fn().mockReturnThis(),eq:jest.fn().mockReturnThis(),maybeSingle:jest.fn().mockResolvedValue({data:{id:context.businessId},error:null}),
    upsert:jest.fn().mockResolvedValue({error:null}),update:jest.fn().mockReturnThis(),then:(done:any)=>done({error:null})};
  (createUserClient as jest.Mock).mockReturnValue({from:jest.fn().mockReturnValue(q)});
  (supabaseAdmin.from as jest.Mock).mockReturnValue(q);
  jest.spyOn(businessEligibility,'isAccountActive').mockResolvedValue(true);
  jest.spyOn(entitlements,'getEntitlements').mockResolvedValue({entitlements:{MAX_PRODUCTS:10}} as any);
  const bytes=normalizePilotImage(png(),'image.png','image/png').bytes;
  const storage={upload:jest.fn().mockResolvedValue({error:existing?{statusCode:'409'}:null}),download:jest.fn().mockResolvedValue({data:new Blob([new Uint8Array(bytes)]),error:null})};
  (supabaseAdmin.storage.from as jest.Mock).mockReturnValue(storage);
  const result=await stagePrivateImage(context,png(),'image.png','image/png');
  expect(result.object_path).toMatch(/^businesses\/trusted-business\/images\/[a-f0-9]{64}\.png$/);
  expect(storage.upload).toHaveBeenCalledWith(result.object_path,bytes,{contentType:'image/png',upsert:false,cacheControl:'0'});
  expect(supabaseAdmin.from).toHaveBeenCalledWith('image_assets');
  expect(q.update).toHaveBeenCalledWith({verified_at:expect.any(String)});
});
