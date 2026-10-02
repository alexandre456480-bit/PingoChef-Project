export function validateDeploymentEnvironment(env:NodeJS.ProcessEnv):void{
  if(env.NODE_ENV!=='production')return;
  if(!['production','staging'].includes(env.DEPLOYMENT_ENV||''))
    throw new Error('DEPLOYMENT_ENV must be production or staging');
  const url=env.SUPABASE_URL;
  const expected=env.EXPECTED_SUPABASE_PROJECT_REF;
  if(!url||!expected||!(/^[a-z0-9]{10,30}$/.test(expected)))
    throw new Error('Expected Supabase project is not configured');
  let hostname='';
  try{hostname=new URL(url).hostname;}catch{throw new Error('Invalid Supabase URL');}
  if(!url.startsWith('https://')||hostname!==`${expected}.supabase.co`)
    throw new Error('Supabase project does not match deployment');
  if(env.DEPLOYMENT_ENV==='staging'){
    const production=env.PRODUCTION_SUPABASE_PROJECT_REF;
    if(!production||production===expected)
      throw new Error('Staging cannot use the production Supabase project');
  }
  for(const name of ['FRONTEND_ORIGINS','ADMIN_ORIGINS']){
    const origins=(env[name]||'').split(',').map(value=>value.trim()).filter(Boolean);
    if(!origins.length||origins.some(origin=>{
      try{const parsed=new URL(origin);return parsed.protocol!=='https:'||parsed.origin!==origin;}
      catch{return true;}
    }))throw new Error(`${name} requires explicit HTTPS origins`);
  }
  if(!env.INTERNAL_JOBS_SECRET||env.INTERNAL_JOBS_SECRET.length<32)
    throw new Error('INTERNAL_JOBS_SECRET is not configured');
  for(const name of ['SUPABASE_SERVICE_ROLE_KEY','SUPABASE_ANON_KEY',
    'INVITATION_HASH_SECRET','ADMIN_LOGIN_HASH_SECRET']){
    if(!env[name]||env[name]!.length<32)throw new Error(`${name} is not configured`);
  }
  if(!env.PURGE_STORAGE_BUCKET||!/^[a-zA-Z0-9_-]{2,100}$/.test(env.PURGE_STORAGE_BUCKET))
    throw new Error('PURGE_STORAGE_BUCKET is not configured');
  if(env.API_TELEMETRY_ENABLED!=='true')
    throw new Error('API_TELEMETRY_ENABLED must be true for deployment');
}
