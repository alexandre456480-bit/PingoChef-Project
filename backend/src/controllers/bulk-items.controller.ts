import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { createUserClient, supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { localDb, isDemoMode } from '../config/localDb';
import { ownerError } from '../services/owner-session.service';

const itemId = !isSupabaseConfigured && isDemoMode()
  ? z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/) : z.uuid();
const selection = z.object({ ids: z.array(itemId).min(1).max(300)
  .refine(ids => new Set(ids).size === ids.length, 'IDs duplicados') }).strict();

export async function deleteItemsController(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.businessId) throw ownerError(401, 'UNAUTHORIZED');
    const { ids } = selection.parse(req.body);
    let deletedIds: string[];
    if (isSupabaseConfigured) {
      const client = req.accessToken ? createUserClient(req.accessToken) : supabaseAdmin;
      // Reject a stale or cross-tenant selection before issuing any deletion.
      const owned = await client.from('menu_items').select('id').eq('business_id', req.businessId).in('id', ids);
      if (owned.error) throw ownerError(503, 'BULK_DELETE_UNAVAILABLE');
      if (owned.data?.length !== ids.length) throw ownerError(409, 'ITEM_SELECTION_CHANGED', 'A seleção mudou. Atualize a lista de produtos e tente novamente.');
      // One SQL DELETE: existing foreign keys/cascades and RLS remain authoritative.
      const result = await client.from('menu_items').delete().eq('business_id', req.businessId).in('id', ids).select('id');
      if (result.error || !result.data) throw ownerError(503, 'BULK_DELETE_UNAVAILABLE');
      deletedIds = result.data.map(row => row.id);
    } else {
      if (!isDemoMode()) throw ownerError(503, 'SERVICE_UNAVAILABLE');
      const owned = localDb.items.filter(item => item.business_id === req.businessId && ids.includes(item.id));
      if (owned.length !== ids.length) throw ownerError(409, 'ITEM_SELECTION_CHANGED');
      deletedIds = owned.map(item => item.id);
      localDb.items = localDb.items.filter(item => !(item.business_id === req.businessId && ids.includes(item.id)));
    }
    return res.json({ success: true, data: { deletedIds } });
  } catch (error) { next(error); }
}
