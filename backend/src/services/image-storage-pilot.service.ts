import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { createUserClient, supabaseAdmin } from '../config/supabase';
import { businessEligibility } from './business-eligibility.service';
import { entitlements } from './entitlement.service';
import { ownerError } from './owner-session.service';

export const imagePilotBucket = 'pingo-images-private';
const maxBytes=4*1024*1024;

/** Deliberately narrow pilot allowlist. Existing browser editors already normalize to PNG. */
export function normalizePilotImage(bytes:Buffer, filename:string, mime:string) {
  const invalid=()=>ownerError(400,'IMAGE_INVALID');
  if (mime!=='image/png' || !/^[a-zA-Z0-9_-]{1,100}\.png$/i.test(filename)
    || bytes.length<45 || bytes.length>maxBytes
    || !bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))
    || bytes.readUInt32BE(8)!==13 || bytes.toString('ascii',12,16)!=='IHDR') throw invalid();
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if (!width||!height||width>2048||height>2048||width*height>4194304
    ||bytes[24]!==8||![2,6].includes(bytes[25])||bytes[26]!==0||bytes[27]!==0||bytes[28]!==0) throw invalid();
  // Exact chunk structure, no APNG, metadata payloads or bytes after IEND.
  let end=false,idat=false,offset=8;
  const ancillary:Record<string,number>={sRGB:1,gAMA:4,cHRM:32,pHYs:9};
  while(offset+12<=bytes.length) {
    const length=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8);
    if(length>maxBytes || offset+length+12>bytes.length || (!['IHDR','IDAT','IEND'].includes(type)
        && (!Object.hasOwn(ancillary,type)||length!==ancillary[type]))
      || (type==='IHDR'&&offset!==8) || (type==='IDAT'&&end)) throw invalid();
    if(type==='IDAT')idat=true;
    offset+=length+12;
    if(type==='IEND'){if(length||!idat||offset!==bytes.length)throw invalid();end=true;break;}
  }
  if(!end||offset!==bytes.length)throw invalid();
  try {
    const decoded=PNG.sync.read(bytes,{checkCRC:true});
    const normalized=PNG.sync.write(decoded,{colorType:6});
    if(normalized.length>maxBytes)throw invalid();
    return {bytes:normalized,width,height,sizeBytes:normalized.length,sha256:createHash('sha256').update(normalized).digest('hex')};
  } catch {throw invalid();}
}

// Intentionally NOT mounted as an HTTP route or connected to public menu fields.
// A controlled staging backfill can exercise upload/readback without changing old data.
export async function stagePrivateImage(context:{businessId:string;userId:string;accessToken:string},bytes:Buffer,filename:string,mime:string) {
  if(process.env.DEPLOYMENT_ENV!=='staging'||process.env.MEDIA_STORAGE_ENABLED!=='true'
    ||!process.env.EXPECTED_SUPABASE_PROJECT_REF||!process.env.PRODUCTION_SUPABASE_PROJECT_REF
    ||process.env.EXPECTED_SUPABASE_PROJECT_REF===process.env.PRODUCTION_SUPABASE_PROJECT_REF
    ||process.env.SUPABASE_URL!==`https://${process.env.EXPECTED_SUPABASE_PROJECT_REF}.supabase.co`) throw ownerError(503,'IMAGE_PILOT_DISABLED');
  const {data:identity,error:authError}=await supabaseAdmin.auth.getUser(context.accessToken);
  if(authError||identity.user?.id!==context.userId)throw ownerError(401,'IMAGE_UNAUTHORIZED');
  const owner=createUserClient(context.accessToken);
  const {data:business,error:ownerErrorResult}=await owner.from('businesses').select('id')
    .eq('id',context.businessId).eq('owner_user_id',context.userId).maybeSingle();
  if(ownerErrorResult||!business||!await businessEligibility.isAccountActive(business.id))throw ownerError(403,'IMAGE_FORBIDDEN');
  const snapshot=await entitlements.getEntitlements(business.id);
  if(typeof snapshot.entitlements.MAX_PRODUCTS!=='number'||snapshot.entitlements.MAX_PRODUCTS<=0)throw ownerError(403,'IMAGE_FORBIDDEN');
  const image=normalizePilotImage(bytes,filename,mime);
  const path=`businesses/${business.id}/images/${image.sha256}.png`;
  const record={business_id:business.id,sha256:image.sha256,object_path:path,mime_type:'image/png',size_bytes:image.sizeBytes,width:image.width,height:image.height};
  // Reserve first so interrupted uploads can be inventoried and resumed. No overwrite.
  const {error:metadataError}=await supabaseAdmin.from('image_assets').upsert(record,{onConflict:'business_id,sha256',ignoreDuplicates:true});
  if(metadataError)throw ownerError(503,'IMAGE_METADATA_UNAVAILABLE');
  const storage=supabaseAdmin.storage.from(imagePilotBucket);
  const {error:uploadError}=await storage.upload(path,image.bytes,{contentType:'image/png',upsert:false,cacheControl:'0'});
  if(uploadError&&String((uploadError as any).statusCode)!=='409')throw ownerError(503,'IMAGE_UPLOAD_UNAVAILABLE');
  const {data:download,error:downloadError}=await storage.download(path);
  if(downloadError||!download||download.size!==image.sizeBytes
    ||createHash('sha256').update(Buffer.from(await download.arrayBuffer())).digest('hex')!==image.sha256)throw ownerError(503,'IMAGE_VERIFICATION_FAILED');
  const {error:verifyError}=await supabaseAdmin.from('image_assets').update({verified_at:new Date().toISOString()})
    .eq('business_id',business.id).eq('sha256',image.sha256);
  if(verifyError)throw ownerError(503,'IMAGE_METADATA_UNAVAILABLE');
  return record; // Never returns a private signed URL or removes the original data URI.
}
