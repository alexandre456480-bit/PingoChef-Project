import type { createUserClient } from '../config/supabase';
import { ownerError } from './owner-session.service';

export async function reorderMenu(client: ReturnType<typeof createUserClient>, business: string,
  resource: 'products' | 'categories' | 'subcategories', orders: { id: string; displayOrder: number }[]) {
  if (!orders.length) return;
  if (process.env.PERFORMANCE_REORDER_RPC_ENABLED === 'true') {
    const { data, error } = await client.rpc('reorder_business_menu', { p_business: business, p_resource: resource, p_orders: orders });
    if (error?.message === 'REORDER_RESOURCE_NOT_FOUND') throw ownerError(404, 'REORDER_RESOURCE_NOT_FOUND');
    if (error?.message === 'INVALID_MENU_ORDER') throw ownerError(400, 'INVALID_MENU_ORDER');
    if (error) throw error;
    if (data !== orders.length) throw ownerError(503, 'MENU_ORDER_UNCONFIRMED');
    return;
  }
  // Until migration activation, preserve the existing JWT/RLS client and writes.
  // Propagate errors instead of silently returning success on a partial failure.
  const table = { products: 'menu_items', categories: 'categories', subcategories: 'subcategories' }[resource];
  for (const order of orders) {
    const { error } = await client.from(table).update({ display_order: order.displayOrder,
      ...(resource === 'products' ? { updated_at: new Date().toISOString() } : {}) })
      .eq('id', order.id).eq('business_id', business);
    if (error) throw error;
  }
}
