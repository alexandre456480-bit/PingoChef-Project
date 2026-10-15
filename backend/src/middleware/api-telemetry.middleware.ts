import type { Request, Response, NextFunction } from 'express';
import { isSupabaseConfigured, supabaseAdmin } from '../config/supabase';
import { requestPerformance } from '../services/request-performance.service';

const areas = new Set(['auth', 'admin', 'categories', 'subcategories', 'items', 'design', 'public', 'business', 'analytics', 'qr', 'internal', 'webhooks', 'health']);

/** Fixed route groups prevent user IDs, slugs and query strings entering telemetry. */
export function apiRouteGroup(path?: string): string {
  const parts = (path || '').split('?')[0].split('/').filter(Boolean);
  if (parts[0] !== 'api' || parts[1] !== 'v1') return '/api/v1/other';
  const area = parts[2] || 'other';
  return areas.has(area) ? `/api/v1/${area}` : '/api/v1/other';
}

export function performanceEndpoint(path?: string): string {
  const group = apiRouteGroup(path), parts = (path || '').split('?')[0].split('/').filter(Boolean);
  const fixed: Record<string, string[]> = { auth: ['me', 'login', 'logout', 'logout-all', 'register', 'recover', 'reset-password'], business: ['publish'], items: ['reorder'], analytics: ['options', 'rankings', 'product-trends', 'qr', 'export.csv'] };
  if (Object.hasOwn(fixed, parts[2]) && fixed[parts[2]].includes(parts[3])) return `${group}/${parts[3]}`;
  if (parts[2] === 'public') return parts[3] === 'menu' ? '/api/v1/public/menu/:slug' : '/api/v1/public/other';
  return group;
}

export function apiTelemetry(req: Request,res: Response,next: NextFunction): void {
  const context = { started: performance.now(), finished: false, authMs: 0, authDepth: 0,
    databaseMs: 0, databaseCalls: 0, externalMs: 0, externalCalls: 0 };
  requestPerformance.run(context, () => {
  res.on('finish', () => {
    context.finished = true;
    if (!isSupabaseConfigured || process.env.API_TELEMETRY_ENABLED !== 'true') return;
    const bounded = (value: number) => Math.round(Math.min(Math.max(0, value), 3600000) * 100) / 100;
    const duration = bounded(performance.now() - context.started);
    if (process.env.API_PERFORMANCE_LOG_ENABLED !== 'false') console.info(JSON.stringify({
      event: 'request_performance', request_id: res.locals.requestId,
      endpoint: performanceEndpoint(req.originalUrl), method: req.method, status: res.statusCode,
      duration_ms: duration, auth_ms: bounded(context.authMs), database_ms: bounded(context.databaseMs),
      database_calls: context.databaseCalls, external_ms: bounded(context.externalMs), external_calls: context.externalCalls
    }));
    // Best effort: a serverless platform may stop after response completion.
    void Promise.resolve(supabaseAdmin.rpc('record_api_request_metric', {
      p_route:apiRouteGroup(req.originalUrl),p_method:req.method,
      p_status:res.statusCode,p_duration_ms:Math.floor(duration)
    })).then(({error})=>{
      if(error)console.error('[API Telemetry]',{requestId:res.locals.requestId,code:'METRIC_WRITE_FAILED'});
    }).catch(()=>console.error('[API Telemetry]',{requestId:res.locals.requestId,code:'METRIC_WRITE_FAILED'}));
  });
  next();
  });
}
