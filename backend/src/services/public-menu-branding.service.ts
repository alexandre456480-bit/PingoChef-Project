import { supabaseAdmin } from '../config/supabase';
import { isDemoMode } from '../config/localDb';

export async function showPingoChefBranding(businessId: string): Promise<boolean> {
  if (isDemoMode()) return true;
  try {
    const { data, error } = await supabaseAdmin.rpc('business_feature_entitlement', {
      p_business_id: businessId, p_feature_key: 'REMOVE_PINGOCHEF_BRANDING'
    });
    return Boolean(error) || data !== true;
  } catch { return true; }
}
