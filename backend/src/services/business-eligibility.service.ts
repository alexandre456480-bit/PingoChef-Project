import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { localDb, isDemoMode } from '../config/localDb';

/** One decision boundary for menu, likes and public playback. Billing is not live yet. */
export class BusinessEligibilityService {
  async isAccountActive(businessId: string): Promise<boolean> {
    if (isSupabaseConfigured && !isDemoMode()) {
      const { data, error } = await supabaseAdmin.rpc('business_is_account_active', { p_business_id: businessId });
      if (error) throw new Error('BUSINESS_ELIGIBILITY_UNAVAILABLE');
      return data === true;
    }
    if (!isDemoMode()) throw new Error('BUSINESS_ELIGIBILITY_UNAVAILABLE');
    return localDb.businesses.some(b => b.id === businessId && b.status === 'ACTIVE');
  }

  async isPublicEligible(businessId: string): Promise<boolean> {
    if (isSupabaseConfigured && !isDemoMode()) {
      const { data, error } = await supabaseAdmin.rpc('business_is_publicly_eligible', { p_business_id: businessId });
      if (error) throw new Error('BUSINESS_ELIGIBILITY_UNAVAILABLE');
      return data === true;
    }
    if (!isDemoMode()) throw new Error('BUSINESS_ELIGIBILITY_UNAVAILABLE');
    return localDb.businesses.some(b => b.id === businessId && b.status === 'ACTIVE');
  }

  async findPublicBusinessBySlug<T extends { id: string }>(slug: string, columns: string): Promise<T | null> {
    if (isSupabaseConfigured && !isDemoMode()) {
      const { data, error } = await supabaseAdmin.from('businesses').select(columns).eq('slug', slug).maybeSingle();
      if (error) throw new Error('BUSINESS_ELIGIBILITY_UNAVAILABLE');
      const business = data as unknown as T | null;
      if (!business || !(await this.isPublicEligible(business.id))) return null;
      return business;
    }
    if (!isDemoMode()) throw new Error('BUSINESS_ELIGIBILITY_UNAVAILABLE');
    const business = localDb.businesses.find(b => b.slug === slug);
    return business && await this.isPublicEligible(business.id) ? business as unknown as T : null;
  }
}

export const businessEligibility = new BusinessEligibilityService();
