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
  if(env.ANALYTICS_HASH_SECRET && env.ANALYTICS_HASH_SECRET.length<32)
    throw new Error('ANALYTICS_HASH_SECRET requires at least 32 random characters');
  for(const name of ['SUPABASE_SERVICE_ROLE_KEY','SUPABASE_ANON_KEY',
    'INVITATION_HASH_SECRET','ADMIN_LOGIN_HASH_SECRET']){
    if(!env[name]||env[name]!.length<32)throw new Error(`${name} is not configured`);
  }
  if(!env.PURGE_STORAGE_BUCKET||!/^[a-zA-Z0-9_-]{2,100}$/.test(env.PURGE_STORAGE_BUCKET))
    throw new Error('PURGE_STORAGE_BUCKET is not configured');
  if(env.API_TELEMETRY_ENABLED!=='true')
    throw new Error('API_TELEMETRY_ENABLED must be true for deployment');
  if(!/^[A-Za-z0-9+/]{43}=$/.test(env.OWNER_SESSION_ENCRYPTION_KEY||'')
    ||Buffer.from(env.OWNER_SESSION_ENCRYPTION_KEY||'','base64').length!==32)
    throw new Error('OWNER_SESSION_ENCRYPTION_KEY must encode 32 random bytes');
  let callback:URL;
  try{callback=new URL(env.OWNER_AUTH_CALLBACK_URL||'');}catch{throw new Error('OWNER_AUTH_CALLBACK_URL is not configured');}
  if(callback.protocol!=='https:'||callback.search||callback.hash||callback.username||callback.password
    ||!callback.pathname.endsWith('/api/v1/auth/confirm-email'))
    throw new Error('OWNER_AUTH_CALLBACK_URL requires the HTTPS email callback');
  let menuOrigin:URL;
  try{menuOrigin=new URL(env.PUBLIC_MENU_ORIGIN||'');}catch{throw new Error('PUBLIC_MENU_ORIGIN is not configured');}
  if(menuOrigin.protocol!=='https:' || menuOrigin.href!==`${menuOrigin.origin}/` || menuOrigin.origin.length>140
    || !(env.FRONTEND_ORIGINS||'').split(',').map(value=>value.trim()).includes(menuOrigin.origin))
    throw new Error('PUBLIC_MENU_ORIGIN must be an allowed HTTPS owner application origin');
  if(!(env.FRONTEND_ORIGINS||'').split(',').map(value=>value.trim()).includes(callback.origin))
    throw new Error('OWNER_AUTH_CALLBACK_URL must use an allowed owner application origin');
  if(env.OWNER_LEGACY_TOKEN_ACCEPT_UNTIL){
    const cutoff=Date.parse(env.OWNER_LEGACY_TOKEN_ACCEPT_UNTIL);
    if(!Number.isFinite(cutoff)||cutoff>Date.now()+14*86400000)
      throw new Error('Legacy migration must close within 14 days');
  }
}
