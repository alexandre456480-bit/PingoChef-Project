import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase';
import type { AdminRequest } from '../middleware/admin.middleware';

const uuid = z.string().uuid();
const paging = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});
const search = z.string().trim().min(2).max(100).regex(/^[\p{L}\p{N} @._-]+$/u).optional();
const date = z.string().datetime({ offset: true });

export function parseMetricsFilter(input: unknown, now = new Date()) {
  const query = z.object({
    from: date.optional(), to: date.optional(),
    timezone: z.string().min(1).max(64).default('UTC'),
    granularity: z.enum(['hour','day','week','month','year']).default('day')
  }).parse(input);
  try { new Intl.DateTimeFormat('en-US', { timeZone: query.timezone }).format(now); }
  catch { throw Object.assign(new Error('Invalid timezone'), { status: 400, code: 'INVALID_TIMEZONE' }); }
  const to = query.to ? new Date(query.to) : now;
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - 30 * 86400000);
  const span = to.getTime() - from.getTime();
  const maxByGranularity: Record<typeof query.granularity, number> = {
    hour: 2, day: 90, week: 730, month: 730, year: 730
  };
  if (span <= 0 || span > maxByGranularity[query.granularity] * 86400000
    || to.getTime() > now.getTime() + 86400000) {
    throw Object.assign(new Error('Invalid metrics interval'), { status: 400, code: 'INVALID_METRICS_INTERVAL' });
  }
  return { from: from.toISOString(), to: to.toISOString(),
    timezone: query.timezone, granularity: query.granularity };
}

export function shiftCalendarYear(value: Date, timezone: string): Date {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
    minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const parts = (date: Date) => {
    const values = formatter.formatToParts(date);
    const get = (name: string) => Number(values.find(part => part.type === name)?.value || 0);
    return { year: get('year'), month: get('month'), day: get('day'),
      hour: get('hour'), minute: get('minute'), second: get('second') };
  };
  const source = parts(value);
  const year = source.year - 1;
  const day = Math.min(source.day, new Date(Date.UTC(year, source.month, 0)).getUTCDate());
  const target = Date.UTC(year, source.month - 1, day, source.hour, source.minute, source.second,
    value.getUTCMilliseconds());
  let candidate = target;
  for (let index = 0; index < 4; index++) {
    const actual = parts(new Date(candidate));
    const local = Date.UTC(actual.year, actual.month - 1, actual.day,
      actual.hour, actual.minute, actual.second, value.getUTCMilliseconds());
    const difference = target - local;
    if (!difference) break;
    candidate += difference;
  }
  return new Date(candidate);
}

export async function getOverview(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const filter = parseMetricsFilter(req.query);
    const { data, error } = await supabaseAdmin.rpc('admin_overview_metrics', {
      p_from: filter.from, p_to: filter.to, p_timezone: filter.timezone,
      p_granularity: filter.granularity
    });
    if (error) throw error;
    res.json({ success: true, data: { filter, ...data } });
  } catch (error) { next(error); }
}

export async function getDashboard(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const filter = parseMetricsFilter(req.query);
    const comparison = z.enum(['none','previous','year']).default('none').parse(req.query.comparison);
    const from = new Date(filter.from);
    const to = new Date(filter.to);
    const span = to.getTime() - from.getTime();
    const compareFrom = comparison === 'previous' ? new Date(from.getTime() - span)
      : comparison === 'year' ? shiftCalendarYear(from, filter.timezone) : null;
    const compareTo = comparison === 'previous' ? from
      : comparison === 'year' ? shiftCalendarYear(to, filter.timezone) : null;
    const { data, error } = await supabaseAdmin.rpc('admin_dashboard_report', {
      p_from: filter.from, p_to: filter.to, p_timezone: filter.timezone,
      p_granularity: filter.granularity,
      p_compare_from: compareFrom?.toISOString() || null,
      p_compare_to: compareTo?.toISOString() || null
    });
    if (error) throw error;
    return res.json({ success: true, data: { filter: { ...filter, comparison,
      compareFrom: compareFrom?.toISOString() || null, compareTo: compareTo?.toISOString() || null }, ...data } });
  } catch (error) { next(error); }
}

export async function listBusinesses(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = paging.parse(req.query);
    const q = search.parse(req.query.search);
    const filters = z.object({
      status: z.enum(['ACTIVE','SUSPENDED','PENDING_DELETION','DELETED']).optional(),
      subscription: z.enum(['pending','trialing','active','past_due','grace','suspended','canceled']).optional(),
      plan: z.string().regex(/^[A-Z][A-Z0-9_]{1,49}$/).optional(),
      published: z.enum(['true','false']).optional(),
      createdFrom: date.optional(), createdTo: date.optional()
    }).parse(req.query);
    if (filters.createdFrom && filters.createdTo && new Date(filters.createdFrom) >= new Date(filters.createdTo))
      throw Object.assign(new Error('Invalid creation interval'), { status: 400, code: 'INVALID_CREATION_INTERVAL' });
    const { data, error } = await supabaseAdmin.rpc('admin_business_list', {
      p_search: q || null, p_lifecycle: filters.status || null,
      p_subscription: filters.subscription || null, p_plan: filters.plan || null,
      p_published: filters.published === undefined ? null : filters.published === 'true',
      p_created_from: filters.createdFrom || null, p_created_to: filters.createdTo || null,
      p_page: page, p_limit: limit
    });
    if (error) throw error;
    return res.json({ success: true, data: data?.rows || [],
      pagination: { page, limit, total: data?.total || 0 } });
  } catch (error) { next(error); }
}

export async function getBusiness(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const id = uuid.parse(req.params.id);
    const { data: business, error } = await supabaseAdmin.from('businesses')
      .select('id,owner_user_id,name,slug,status,phone,whatsapp,created_at,updated_at')
      .eq('id', id).maybeSingle();
    if (error) throw error;
    if (!business) return res.status(404).json({ success: false, error: { code: 'BUSINESS_NOT_FOUND' } });
    const [state, subscription, adjustments, owner, categories, products, media, activity, audit] = await Promise.all([
      supabaseAdmin.from('business_account_state').select('*').eq('business_id', id).single(),
      supabaseAdmin.from('subscriptions').select('*').eq('business_id', id).maybeSingle(),
      supabaseAdmin.from('subscription_adjustments')
        .select('id,type,value,reason,starts_at,ends_at,created_by_admin,created_at')
        .eq('business_id', id).order('created_at', { ascending: false }).limit(20),
      supabaseAdmin.auth.admin.getUserById(business.owner_user_id),
      supabaseAdmin.from('categories').select('id,name,created_at', { count: 'exact' }).eq('business_id', id)
        .order('created_at', { ascending: false }).limit(20),
      supabaseAdmin.from('menu_items').select('id,name,price,is_available,category_id,image_url,created_at', { count: 'exact' }).eq('business_id', id)
        .order('created_at', { ascending: false }).limit(20),
      supabaseAdmin.from('product_media').select('id,media_type,status,created_at', { count: 'exact' })
        .eq('business_id', id).order('created_at', { ascending: false }).limit(30),
      supabaseAdmin.from('platform_events').select('event_name,occurred_at').eq('business_id', id)
        .order('occurred_at', { ascending: false }).limit(30),
      supabaseAdmin.from('admin_audit_log').select('action,details,created_at,actor_user_id')
        .eq('target_type','business').eq('target_id',id).order('created_at', { ascending: false }).limit(20)
    ]);
    const failure = [state,subscription,adjustments,owner,categories,products,media,activity,audit]
      .find(result => result.error)?.error;
    if (failure) throw failure;
    return res.json({ success: true, data: { ...business, accountState: state.data,
      email: owner.data?.user?.email || null,
      subscription: subscription.data, recentAdjustments: adjustments.data,
      categories: { total: categories.count || 0, rows: categories.data || [] },
      products: { total: products.count || 0, rows: products.data || [] },
      media: { total: media.count || 0, rows: media.data || [] },
      activity: activity.data || [], audit: audit.data || [] } });
  } catch (error) { next(error); }
}

export async function listMedia(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = paging.parse(req.query);
    const type = z.enum(['image','video']).parse(req.query.type);
    const status = z.enum(['waiting','uploading','processing','ready','rejected','errored','pending_deletion'])
      .optional().parse(req.query.status);
    const range = z.object({ from: date.optional(), to: date.optional() }).parse(req.query);
    if (range.from && range.to && new Date(range.from) >= new Date(range.to))
      throw Object.assign(new Error('Invalid media interval'), { status: 400, code: 'INVALID_MEDIA_INTERVAL' });
    let request = supabaseAdmin.from('product_media')
      .select('id,business_id,menu_item_id,media_type,status,is_published,created_at,updated_at', { count:'exact' })
      .eq('media_type',type).order('created_at',{ascending:false}).order('id',{ascending:false})
      .range((page-1)*limit,page*limit-1);
    if(status)request=request.eq('status',status);
    if(range.from)request=request.gte('created_at',range.from);
    if(range.to)request=request.lt('created_at',range.to);
    const {data,count,error}=await request;
    if(error)throw error;
    const ids=[...new Set((data||[]).map(item=>item.business_id))];
    const {data:businesses,error:businessError}=ids.length
      ? await supabaseAdmin.from('businesses').select('id,name').in('id',ids)
      : {data:[],error:null};
    if(businessError)throw businessError;
    const names=new Map((businesses||[]).map(item=>[item.id,item.name]));
    return res.json({success:true,data:(data||[]).map(item=>({...item,businessName:names.get(item.business_id)||null})),
      pagination:{page,limit,total:count||0}});
  }catch(error){next(error);}
}

export async function listInvitations(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = paging.parse(req.query);
    const status = z.enum(['ISSUED','RESERVED','CONSUMED','REVOKED','EXPIRED']).optional().parse(req.query.status);
    const q = z.string().trim().min(2).max(100).regex(/^[\p{L}\p{N} @._-]+$/u)
      .optional().parse(req.query.email);
    const now = new Date().toISOString();
    let request = supabaseAdmin.from('customer_invitations')
      .select('id,email,status,expires_at,consumed_at,revoked_at,created_at,created_by', { count: 'exact' })
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (status === 'EXPIRED') request = request.in('status',['ISSUED','RESERVED']).lte('expires_at',now);
    else if (status) request = request.eq('status', status);
    if (q) request = request.ilike('email', `%${q}%`);
    const { data, count, error } = await request;
    if (error) throw error;
    return res.json({ success: true, data: (data || []).map(invite => ({ ...invite,
      effectiveStatus: ['ISSUED','RESERVED'].includes(invite.status) && invite.expires_at <= now
        ? 'EXPIRED' : invite.status })),
      pagination: { page, limit, total: count || 0 } });
  } catch (error) { next(error); }
}

export async function listAuditLogs(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = paging.parse(req.query);
    const filter = z.object({
      action: z.string().trim().regex(/^[A-Za-z0-9_.]{1,80}$/).optional(),
      targetId: z.string().trim().max(100).optional(),
      from: date.optional(), to: date.optional()
    }).parse(req.query);
    if (filter.from && filter.to && new Date(filter.from) >= new Date(filter.to)) {
      throw Object.assign(new Error('Invalid audit interval'), { status: 400, code: 'INVALID_AUDIT_INTERVAL' });
    }
    let request = supabaseAdmin.from('admin_audit_log')
      .select('id,actor_user_id,action,target_type,target_id,details,ip,user_agent,request_id,created_at', { count: 'exact' })
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (filter.action) request = request.eq('action', filter.action);
    if (filter.targetId) request = request.eq('target_id', filter.targetId);
    if (filter.from) request = request.gte('created_at', filter.from);
    if (filter.to) request = request.lt('created_at', filter.to);
    const { data, count, error } = await request;
    if (error) throw error;
    return res.json({ success: true, data, pagination: { page, limit, total: count || 0 } });
  } catch (error) { next(error); }
}
