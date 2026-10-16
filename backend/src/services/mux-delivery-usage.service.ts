import { supabaseAdmin } from '../config/supabase';
import type { MuxVideoProvider } from './mux-video.service';

// Runs under the reconciliation lease, one bounded provider page per invocation.
// Official delivery API has a >=12h delay: use a complete UTC day ending >=24h ago.
export async function syncMuxDeliveryUsage(mux: MuxVideoProvider, day: string, page: number) {
  if (!mux.listDeliveryUsage) throw new Error('MUX_DELIVERY_USAGE_UNAVAILABLE');
  const start = Date.parse(`${day}T00:00:00Z`) / 1000;
  if (!Number.isFinite(start) || start + 86400 > Date.now() / 1000 - 12 * 3600) throw new Error('INVALID_DELIVERY_USAGE_DAY');
  const records = await mux.listDeliveryUsage(start, start + 86400, page);
  if (records.some(row => !Number.isFinite(row.deliveredSeconds) || row.deliveredSeconds < 0)) throw new Error('INVALID_DELIVERY_USAGE');
  if (records.length) {
    const { data: media, error } = await supabaseAdmin.from('product_media').select('id,business_id,mux_asset_id')
      .eq('source', 'mux').in('mux_asset_id', records.map(row => row.assetId));
    if (error) throw new Error('DELIVERY_USAGE_DATABASE_UNAVAILABLE');
    const rows = (media || []).map(row => ({ business_id: row.business_id, media_id: row.id, day,
      delivered_seconds: records.find(record => record.assetId === row.mux_asset_id)!.deliveredSeconds,
      synced_at: new Date().toISOString() }));
    if (rows.length) {
      const { error: writeError } = await supabaseAdmin.from('video_provider_usage_daily')
        .upsert(rows, { onConflict: 'business_id,media_id,day' });
      if (writeError) throw new Error('DELIVERY_USAGE_DATABASE_UNAVAILABLE');
    }
  }
  const latest = new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10);
  return { day: records.length < 100 ? (day < latest ? new Date((start + 86400) * 1000).toISOString().slice(0, 10) : day) : day,
    page: records.length < 100 ? 1 : page + 1 };
}
