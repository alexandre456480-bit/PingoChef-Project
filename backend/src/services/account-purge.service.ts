import { supabaseAdmin } from '../config/supabase';
import { getMuxVideoProvider, type MuxVideoProvider } from './mux-video.service';

export type PurgeResource = { kind:'MUX_ASSET'|'MUX_UPLOAD'|'STORAGE_OBJECT'; reference:string };
type PurgeClaim = { jobId:string; businessId:string; ownerUserId:string|null;
  phase:'EXTERNAL'|'AUTH'; resources:PurgeResource[] };

class PurgeFailure extends Error {
  constructor(readonly code:string){super(code);}
}
async function rpc<T>(name:string,args:Record<string,unknown>):Promise<T>{
  const {data,error}=await supabaseAdmin.rpc(name,args);
  if(error)throw error;
  return data as T;
}
async function deleteMuxAsset(mux:MuxVideoProvider,id:string):Promise<void>{
  try{await mux.deleteAsset(id);}catch(error){if(!mux.isNotFoundError(error))throw error;}
}
export async function removeMuxPurgeResource(resource:PurgeResource,mux:MuxVideoProvider):Promise<void>{
  if(resource.kind==='MUX_ASSET'){await deleteMuxAsset(mux,resource.reference);return;}
  if(resource.kind!=='MUX_UPLOAD')throw new PurgeFailure('INVALID_RESOURCE');
  let upload;
  try{upload=await mux.retrieveUpload(resource.reference);}
  catch(error){if(mux.isNotFoundError(error))return;throw error;}
  if(upload.asset_id){await deleteMuxAsset(mux,upload.asset_id);return;}
  if(['cancelled','timed_out','errored'].includes(upload.status))return;
  try{await mux.cancelUpload(resource.reference);}
  catch(error){
    if(!mux.isUploadNotCancellableError(error))throw error;
    const refreshed=await mux.retrieveUpload(resource.reference);
    if(refreshed.asset_id){await deleteMuxAsset(mux,refreshed.asset_id);return;}
    if(!['cancelled','timed_out','errored'].includes(refreshed.status))throw error;
  }
}

async function inventoryStorage(bucket:string,businessId:string):Promise<{paths:string[];more:boolean}>{
  const paths:string[]=[];let more=false;
  const walk=async (prefix:string,depth:number):Promise<void>=>{
    if(depth>5){more=true;return;}
    const {data,error}=await supabaseAdmin.storage.from(bucket).list(prefix,{limit:100,offset:0});
    if(error)throw error;
    for(const entry of data||[]){
      if(paths.length>=100){more=true;break;}
      const path=`${prefix}/${entry.name}`;
      if(entry.id){paths.push(path);}else{await walk(path,depth+1);}
    }
    if((data||[]).length>=100)more=true;
  };
  await walk(businessId,0);
  return {paths,more};
}

async function removeStorageResource(resource:PurgeResource,businessId:string,bucket:string):Promise<void>{
  if(!resource.reference.startsWith(`${businessId}/`)||resource.reference.includes('..'))
    throw new PurgeFailure('STORAGE_PATH_UNSAFE');
  const {error}=await supabaseAdmin.storage.from(bucket).remove([resource.reference]);
  if(error && Number(error.statusCode)!==404)throw error;
}

export async function runAccountPurgeOnce():Promise<{status:'idle'|'partial'|'complete';jobId?:string}>{
  const claim=await rpc<PurgeClaim|null>('claim_due_account_purge',{p_lease_seconds:900});
  if(!claim)return {status:'idle'};
  let phase=claim.phase;
  try{
    if(phase==='EXTERNAL'){
      const bucket=process.env.PURGE_STORAGE_BUCKET?.trim();
      if(!bucket||!/^[a-zA-Z0-9_-]{2,100}$/.test(bucket))
        throw new PurgeFailure('STORAGE_BUCKET_UNCONFIGURED');
      const inventory=await inventoryStorage(bucket,claim.businessId);
      if(inventory.paths.length)await rpc('add_account_purge_storage_resources',{
        p_job_id:claim.jobId,p_references:inventory.paths
      });
      const {data:pending,error}=await supabaseAdmin.from('account_purge_resources')
        .select('kind,reference').eq('job_id',claim.jobId).eq('status','PENDING')
        .order('kind').order('reference').limit(51);
      if(error)throw error;
      for(const resource of (pending||[]).slice(0,50) as PurgeResource[]){
        if(resource.kind==='STORAGE_OBJECT')await removeStorageResource(resource,claim.businessId,bucket);
        else await removeMuxPurgeResource(resource,getMuxVideoProvider());
        const marked=await rpc<boolean>('mark_account_purge_resource',{
          p_job_id:claim.jobId,p_kind:resource.kind,p_reference:resource.reference
        });
        if(!marked)throw new PurgeFailure('RESOURCE_CHECKPOINT_FAILED');
      }
      if(inventory.more||(pending||[]).length>50){
        await rpc('release_account_purge_lease',{p_job_id:claim.jobId});
        return {status:'partial',jobId:claim.jobId};
      }
      const removed=await rpc<boolean>('remove_account_data_after_external_purge',{
        p_job_id:claim.jobId
      });
      if(!removed){
        await rpc('release_account_purge_lease',{p_job_id:claim.jobId});
        return {status:'partial',jobId:claim.jobId};
      }
      phase='AUTH';
    }
    if(!claim.ownerUserId)throw new PurgeFailure('OWNER_ID_MISSING');
    const {error:deleteError}=await supabaseAdmin.auth.admin.deleteUser(claim.ownerUserId);
    if(deleteError && deleteError.status!==404)throw deleteError;
    const complete=await rpc<boolean>('complete_account_purge',{p_job_id:claim.jobId});
    if(!complete)throw new PurgeFailure('PURGE_FINALIZATION_FAILED');
    return {status:'complete',jobId:claim.jobId};
  }catch(error){
    const code=error instanceof PurgeFailure?error.code:
      phase==='AUTH'?'AUTH_PROVIDER_FAILED':'EXTERNAL_PROVIDER_FAILED';
    await rpc('fail_account_purge',{p_job_id:claim.jobId,p_phase:phase,p_code:code});
    throw new PurgeFailure(code);
  }
}
