// Two-stage staging pilot: inventory (default) or upload/readback (--upload).
// Deliberately never rewrites URLs, deletes data URIs or fetches remote URLs.
import { createRequire } from 'node:module';
if(process.env.DEPLOYMENT_ENV!=='staging'||process.env.MEDIA_STORAGE_ENABLED!=='true'
  ||!process.env.EXPECTED_SUPABASE_PROJECT_REF||!process.env.PRODUCTION_SUPABASE_PROJECT_REF
  ||process.env.EXPECTED_SUPABASE_PROJECT_REF===process.env.PRODUCTION_SUPABASE_PROJECT_REF
  ||process.env.SUPABASE_URL!==`https://${process.env.EXPECTED_SUPABASE_PROJECT_REF}.supabase.co`
  ||!process.env.BACKFILL_ACCESS_TOKEN)throw new Error('Explicit isolated staging and temporary owner credential required');
const require=createRequire(import.meta.url);
const {createUserClient,supabaseAdmin}=require('../dist/config/supabase.js');
const {stagePrivateImage}=require('../dist/services/image-storage-pilot.service.js');
const {data:identity,error}=await supabaseAdmin.auth.getUser(process.env.BACKFILL_ACCESS_TOKEN);
if(error||!identity.user)throw new Error('Staging identity unavailable');
const owner=createUserClient(process.env.BACKFILL_ACCESS_TOKEN);
const {data:business,error:businessError}=await owner.from('businesses').select('id,logo_url,cover_image_url,welcome_bg_image').eq('owner_user_id',identity.user.id).single();
if(businessError||!business)throw new Error('Staging tenant unavailable');
const totals={candidates:0,verified:0,skipped_external:0,skipped_format:0,failed:0};
async function processImage(value){
  if(typeof value!=='string'||!value)return;
  if(!value.startsWith('data:')){totals.skipped_external++;return;}
  if(!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)||value.length>5592430){totals.skipped_format++;return;}
  totals.candidates++;
  if(!process.argv.includes('--upload'))return;
  try {await stagePrivateImage({businessId:business.id,userId:identity.user.id,accessToken:process.env.BACKFILL_ACCESS_TOKEN},Buffer.from(value.slice(22),'base64'),'backfill.png','image/png');totals.verified++;}
  catch {totals.failed++;}
}
try {
  for(const key of ['logo_url','cover_image_url','welcome_bg_image'])await processImage(business[key]);
  for(const table of ['menu_items','categories'])for(let offset=0;;offset+=50){
    const {data,error}=await owner.from(table).select('image_url').eq('business_id',business.id).order('id').range(offset,offset+49);
    if(error)throw new Error('Staging inventory failed');
    for(const row of data)await processImage(row.image_url);
    if(data.length<50)break;
  }
  console.log(JSON.stringify({mode:process.argv.includes('--upload')?'upload-readback-only':'inventory',...totals,originals_retained:true}));
  if(totals.failed)process.exitCode=1;
}catch {console.error('Staging backfill stopped; existing images retained');process.exitCode=1;}
