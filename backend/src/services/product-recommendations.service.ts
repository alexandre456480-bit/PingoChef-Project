import { supabaseAdmin } from '../config/supabase';
import { isDemoMode } from '../config/localDb';
import { ownerError } from './owner-session.service';

export interface ProductRecommendation { triggerProductId: string; recommendedProductIds: string[] }
export const demoRecommendations = new Map<string, ProductRecommendation[]>();
export async function listProductRecommendations(businessId: string): Promise<ProductRecommendation[]> {
  if (isDemoMode()) return demoRecommendations.get(businessId) || [];
  const { data, error } = await supabaseAdmin.rpc('product_recommendation_list', { p_business_id: businessId });
  if (error) throw ownerError(503, 'RECOMMENDATIONS_UNAVAILABLE');
  return data || [];
}
export function publicProductRecommendations(relations: ProductRecommendation[], items: any[], categories: any[]): ProductRecommendation[] {
  const active = new Set(categories.filter(row => row.isActive !== false).map(row => row.id));
  const eligible = new Set(items.filter(item => {
    const price = item.promotionalPrice != null && item.promotionalPrice >= 0 && item.promotionalPrice < item.price ? item.promotionalPrice : item.price;
    return active.has(item.categoryId) && item.isAvailable !== false && item.showPrice !== false
      && Number.isFinite(item.price) && item.price > 0 && Number.isFinite(price) && price > 0;
  }).map(item => item.id));
  return relations.filter(row => eligible.has(row.triggerProductId)).map(row => ({
    triggerProductId: row.triggerProductId, recommendedProductIds: row.recommendedProductIds.filter(id => eligible.has(id)).slice(0, 3)
  })).filter(row => row.recommendedProductIds.length);
}
