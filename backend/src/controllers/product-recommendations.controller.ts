import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../config/supabase';
import { isDemoMode, localDb } from '../config/localDb';
import { ownerError } from '../services/owner-session.service';
import { listProductRecommendations, demoRecommendations } from '../services/product-recommendations.service';

const bodySchema = z.object({ recommendedProductIds: z.array(z.string().uuid()).max(3) }).strict();
export async function productRecommendationsController(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const trigger = z.string().uuid().parse(req.params.id), businessId = req.businessId!, ownerId = req.userId!;
    if (req.method === 'GET') {
      const exists = isDemoMode() ? localDb.items.some(row => row.id === trigger && row.business_id === businessId)
        : await supabaseAdmin.from('menu_items').select('id').eq('business_id', businessId).eq('id', trigger).maybeSingle().then(({ data, error }) => {
          if (error) throw ownerError(503, 'RECOMMENDATIONS_UNAVAILABLE'); return !!data;
        });
      if (!exists) throw ownerError(404, 'PRODUCT_NOT_FOUND');
      const rows = await listProductRecommendations(businessId);
      res.json({ success: true, data: rows.find(row => row.triggerProductId === trigger) || { triggerProductId: trigger, recommendedProductIds: [] } }); return;
    }
    const { recommendedProductIds: ids } = bodySchema.parse(req.body);
    if (ids.includes(trigger) || new Set(ids).size !== ids.length) throw ownerError(400, 'INVALID_RECOMMENDATIONS');
    if (isDemoMode()) {
      if (![trigger, ...ids].every(id => localDb.items.some(row => row.id === id && row.business_id === businessId))) throw ownerError(400, 'INVALID_RESOURCE_RELATIONSHIP');
      const relation = { triggerProductId: trigger, recommendedProductIds: ids };
      demoRecommendations.set(businessId, [...(demoRecommendations.get(businessId) || []).filter(row => row.triggerProductId !== trigger), relation]);
      res.json({ success: true, data: relation }); return;
    }
    const { data, error } = await supabaseAdmin.rpc('replace_product_recommendations', {
      p_business_id: businessId, p_owner_id: ownerId, p_trigger: trigger, p_recommended: ids
    });
    if (error) {
      if (error.message === 'PRODUCT_NOT_FOUND') throw ownerError(404, 'PRODUCT_NOT_FOUND');
      if (['INVALID_RECOMMENDATIONS', 'INVALID_RESOURCE_RELATIONSHIP'].includes(error.message)) throw ownerError(400, error.message);
      if (error.message === 'ACCOUNT_NOT_ACTIVE') throw ownerError(403, 'ACCOUNT_NOT_ACTIVE');
      throw ownerError(503, 'RECOMMENDATIONS_UNAVAILABLE');
    }
    res.json({ success: true, data });
  } catch (error) { next(error); }
}
