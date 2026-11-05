import { supabaseAdmin } from '../config/supabase';
import { isDemoMode } from '../config/localDb';
import { DEFAULT_TEMPLATE_KEY, isThematicTemplate, normalizeTemplateKey } from '../constants/menu-template';

/** Saving/importing a design never grants public access to a paid template. */
export async function publicTemplateKey(businessId: string, selected: unknown) {
  const key = normalizeTemplateKey(selected);
  if (!isThematicTemplate(key)) return key;
  if (isDemoMode()) return DEFAULT_TEMPLATE_KEY;
  const { data, error } = await supabaseAdmin.rpc('business_feature_entitlement', {
    p_business_id: businessId, p_feature_key: 'THEMATIC_TEMPLATES'
  });
  return !error && data === true ? key : DEFAULT_TEMPLATE_KEY;
}
