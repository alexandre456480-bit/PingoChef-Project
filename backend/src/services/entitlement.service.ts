import { supabaseAdmin } from '../config/supabase';
import { isDemoMode, localDb } from '../config/localDb';
import { ownerError } from './owner-session.service';

export type CapacityResource = 'products' | 'categories' | 'videos';
export interface EntitlementSnapshot {
  plan: { code: string; name: string }; subscription: Record<string, unknown>;
  entitlements: Record<string, boolean | number>; usage: Record<CapacityResource, number>;
}
export function mapEntitlementDatabaseError(error: { message?: string; details?: string; code?: string } | null): Error | null {
  if (!error) return null;
  if (error.message === 'LIMIT_EXCEEDED') {
    try {
      const data = JSON.parse(error.details || '{}');
      if (!['products', 'categories', 'videos'].includes(data.resource) || !Number.isSafeInteger(data.used)
        || !Number.isSafeInteger(data.limit) || data.used < 0 || data.limit < 0) throw new Error();
      return Object.assign(ownerError(409, 'LIMIT_EXCEEDED', 'Limite do plano atingido.'), {
        metadata: { resource: data.resource, used: data.used, limit: data.limit }
      });
    } catch { return ownerError(409, 'LIMIT_EXCEEDED', 'Limite do plano atingido.'); }
  }
  if (error.code === '23503') return ownerError(400, 'INVALID_RESOURCE_RELATIONSHIP', 'Categoria ou subcategoria inválida.');
  if (error.message === 'ACCOUNT_NOT_ACTIVE') return ownerError(403, 'ACCOUNT_NOT_ACTIVE');
  return null;
}
export class EntitlementService {
  async getEntitlements(businessId: string): Promise<EntitlementSnapshot> {
    if (isDemoMode()) return {
      plan: { code: 'FREE', name: 'Free' }, subscription: { status: 'active', provider: null },
      entitlements: { MAX_PRODUCTS: 10, MAX_CATEGORIES: 4, MAX_VIDEOS: 1, VIDEO_UPLOAD: true,
        ANALYTICS_BASIC: false, ANALYTICS_ADVANCED: false, ANALYTICS_EXPORT: false, QR_GENERATOR: false, QR_CUSTOMIZATION: false },
      usage: { products: localDb.items.filter(row => row.business_id === businessId).length,
        categories: localDb.categories.filter(row => row.business_id === businessId).length, videos: 0 }
    };
    const { data, error } = await supabaseAdmin.rpc('business_entitlement_snapshot', { p_business_id: businessId });
    if (error || !data) throw ownerError(503, 'ENTITLEMENTS_UNAVAILABLE');
    return data;
  }
  async canUse(businessId: string, feature: string) { return (await this.getEntitlements(businessId)).entitlements[feature] === true; }
  async getLimit(businessId: string, limit: string) {
    const value = (await this.getEntitlements(businessId)).entitlements[limit];
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
  }
  async assertCapacity(businessId: string, resource: CapacityResource) {
    const snapshot = await this.getEntitlements(businessId);
    const key = { products: 'MAX_PRODUCTS', categories: 'MAX_CATEGORIES', videos: 'MAX_VIDEOS' }[resource];
    const value = snapshot.entitlements[key];
    const limit = typeof value === 'number' && Number.isSafeInteger(value) ? value : 0;
    const used = snapshot.usage[resource];
    if (used >= limit) throw Object.assign(ownerError(409, 'LIMIT_EXCEEDED', 'Limite do plano atingido.'), { metadata: { resource, used, limit } });
    // Diagnostic check only. The database trigger checks again under a transaction lock.
  }
  assertCanCreateProduct(businessId: string) { return this.assertCapacity(businessId, 'products'); }
  assertCanCreateCategory(businessId: string) { return this.assertCapacity(businessId, 'categories'); }
  assertCanUploadVideo(businessId: string) { return this.assertCapacity(businessId, 'videos'); }
}
export const entitlements = new EntitlementService();
