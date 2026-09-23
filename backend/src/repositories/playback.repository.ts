import { supabaseAdmin } from '../config/supabase';

export interface PlaybackAccessRecord {
  playbackId: string;
  itemName: string;
}

export interface PlaybackRepository {
  findPublicPlayback(slug: string, itemId: string, mediaId: string): Promise<PlaybackAccessRecord | null>;
  findOwnerPlayback(businessId: string, itemId: string, mediaId: string): Promise<PlaybackAccessRecord | null>;
}

export class SupabasePlaybackRepository implements PlaybackRepository {
  async findPublicPlayback(
    slug: string,
    itemId: string,
    mediaId: string
  ): Promise<PlaybackAccessRecord | null> {
    const { data: business, error: businessError } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('slug', slug)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (businessError) throw new Error('PLAYBACK_DATABASE_UNAVAILABLE');
    if (!business) return null;

    const { data: item, error: itemError } = await supabaseAdmin
      .from('menu_items')
      .select('id,name')
      .eq('id', itemId)
      .eq('business_id', business.id)
      .eq('is_available', true)
      .maybeSingle();

    if (itemError) throw new Error('PLAYBACK_DATABASE_UNAVAILABLE');
    if (!item) return null;

    const { data: media, error: mediaError } = await supabaseAdmin
      .from('product_media')
      .select('mux_playback_id')
      .eq('id', mediaId)
      .eq('business_id', business.id)
      .eq('menu_item_id', itemId)
      .eq('media_type', 'video')
      .eq('source', 'mux')
      .eq('status', 'ready')
      .eq('is_published', true)
      .maybeSingle();

    if (mediaError) throw new Error('PLAYBACK_DATABASE_UNAVAILABLE');
    if (!media?.mux_playback_id) return null;

    return { playbackId: media.mux_playback_id, itemName: item.name };
  }

  async findOwnerPlayback(
    businessId: string,
    itemId: string,
    mediaId: string
  ): Promise<PlaybackAccessRecord | null> {
    const { data: item, error: itemError } = await supabaseAdmin
      .from('menu_items')
      .select('id,name')
      .eq('id', itemId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (itemError) throw new Error('PLAYBACK_DATABASE_UNAVAILABLE');
    if (!item) return null;

    const { data: media, error: mediaError } = await supabaseAdmin
      .from('product_media')
      .select('mux_playback_id')
      .eq('id', mediaId)
      .eq('business_id', businessId)
      .eq('menu_item_id', itemId)
      .eq('media_type', 'video')
      .eq('source', 'mux')
      .eq('status', 'ready')
      .maybeSingle();

    if (mediaError) throw new Error('PLAYBACK_DATABASE_UNAVAILABLE');
    if (!media?.mux_playback_id) return null;

    return { playbackId: media.mux_playback_id, itemName: item.name };
  }
}
