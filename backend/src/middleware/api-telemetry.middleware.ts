import type { Request, Response, NextFunction } from 'express';
import { isSupabaseConfigured, supabaseAdmin } from '../config/supabase';

/** Fixed route groups prevent user IDs, slugs and query strings entering telemetry. */
export function apiRouteGroup(path?: string): string {
  const parts = (path || '').split('?')[0].split('/').filter(Boolean);
  if (parts[0] !== 'api' || parts[1] !== 'v1') return '/api/v1/other';
  const area = parts[2] || 'other';
  return /^[a-z-]{1,40}$/.test(area) ? `/api/v1/${area}` : '/api/v1/other';
}

export function apiTelemetry(req: Request,res: Response,next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    if (!isSupabaseConfigured || process.env.API_TELEMETRY_ENABLED !== 'true') return;
    const duration = Number((process.hrtime.bigint()-start)/1000000n);
    // Best effort: a serverless platform may stop after response completion.
    void Promise.resolve(supabaseAdmin.rpc('record_api_request_metric', {
      p_route:apiRouteGroup(req.originalUrl),p_method:req.method,
      p_status:res.statusCode,p_duration_ms:Math.min(duration,3600000)
    })).then(({error})=>{
      if(error)console.error('[API Telemetry]',{requestId:res.locals.requestId,code:'METRIC_WRITE_FAILED'});
    }).catch(()=>console.error('[API Telemetry]',{requestId:res.locals.requestId,code:'METRIC_WRITE_FAILED'}));
  });
  next();
}
