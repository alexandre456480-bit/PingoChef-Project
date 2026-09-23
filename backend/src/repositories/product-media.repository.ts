import { supabaseAdmin } from '../config/supabase';

export type ProductMediaStatus =
  | 'waiting'
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'rejected'
  | 'errored'
  | 'pending_deletion';

export interface ProductMediaRecord {
  id: string;
  business_id: string;
  menu_item_id: string;
  status: ProductMediaStatus;
  is_published: boolean;
  mux_upload_id: string | null;
  mux_asset_id: string | null;
  mux_playback_id: string | null;
  duration_seconds: number | null;
  upload_expires_at: string | null;
  deletion_attempts: number;
  updated_at: string;
}

export interface ReserveUploadInput {
  businessId: string;
  userId: string;
  menuItemId: string;
  ipHash: string;
  declaredFileSizeBytes: number;
  declaredMimeType: string;
  dailyLimit: number;
  pendingLimit: number;
  rateLimit: number;
  rateWindowSeconds: number;
}

export interface UploadReservation {
  mediaId: string | null;
  denialCode: string | null;
}

export interface OwnerMediaView {
  id: string;
  media_type: 'image' | 'video';
  source: 'storage' | 'mux' | 'external';
  position: number;
  status: ProductMediaStatus;
  is_published: boolean;
  duration_seconds: number | null;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface GalleryMediaView {
  id: string;
  menu_item_id: string;
  media_type: 'image' | 'video';
  source: 'storage' | 'mux' | 'external';
  position: number;
  duration_seconds: number | null;
}

export interface WebhookClaim {
  eventId: string;
  eventType: string;
  objectId: string | null;
  staleAfterSeconds: number;
}

export interface ProductMediaRepository {
  reserveUpload(input: ReserveUploadInput): Promise<UploadReservation>;
  attachMuxUpload(businessId: string, mediaId: string, uploadId: string, expiresAt: string): Promise<boolean>;
  failReservation(businessId: string, mediaId: string, errorCode: string): Promise<void>;
  claimWebhook(input: WebhookClaim): Promise<boolean>;
  finishWebhook(eventId: string, status: 'processed' | 'failed' | 'ignored', errorCode?: string): Promise<void>;
  findByUploadId(uploadId: string): Promise<ProductMediaRecord | null>;
  findByAssetId(assetId: string): Promise<ProductMediaRecord | null>;
  findById(mediaId: string): Promise<ProductMediaRecord | null>;
  findOwned(businessId: string, menuItemId: string, mediaId: string): Promise<ProductMediaRecord | null>;
  listOwnedForItem(businessId: string, menuItemId: string): Promise<OwnerMediaView[]>;
  listGalleryMedia(businessId: string, itemIds: string[], publishedOnly: boolean): Promise<GalleryMediaView[]>;
  publishReadyForBusiness(businessId: string): Promise<number>;
  markProcessing(mediaId: string, uploadId: string, assetId: string): Promise<ProductMediaRecord | null>;
  markReady(mediaId: string, assetId: string, durationSeconds: number, playbackId: string): Promise<void>;
  markRejected(mediaId: string, assetId: string, durationSeconds: number, errorCode: string): Promise<void>;
  markErrored(mediaId: string, errorCode: string, assetId?: string | null): Promise<void>;
  markAssetDeleted(mediaId: string): Promise<void>;
  markPendingDeletion(media: ProductMediaRecord): Promise<ProductMediaRecord>;
  recordDeletionFailure(media: ProductMediaRecord, errorCode: string): Promise<void>;
  deleteMedia(mediaId: string): Promise<void>;
  listReconciliationCandidates(limit: number): Promise<ProductMediaRecord[]>;
}

const MEDIA_SELECT = [
  'id',
  'business_id',
  'menu_item_id',
  'status',
  'is_published',
  'mux_upload_id',
  'mux_asset_id',
  'mux_playback_id',
  'duration_seconds',
  'upload_expires_at',
  'deletion_attempts',
  'updated_at'
].join(',');

function databaseError(operation: string): Error {
  return Object.assign(new Error(`Falha ao ${operation} os dados de vídeo.`), {
    code: 'VIDEO_DATABASE_ERROR',
    status: 503
  });
}

export class SupabaseProductMediaRepository implements ProductMediaRepository {
  async reserveUpload(input: ReserveUploadInput): Promise<UploadReservation> {
    const { data, error } = await supabaseAdmin.rpc('reserve_video_upload', {
      p_business_id: input.businessId,
      p_user_id: input.userId,
      p_menu_item_id: input.menuItemId,
      p_ip_hash: input.ipHash,
      p_declared_file_size_bytes: input.declaredFileSizeBytes,
      p_declared_mime_type: input.declaredMimeType,
      p_daily_limit: input.dailyLimit,
      p_pending_limit: input.pendingLimit,
      p_rate_limit: input.rateLimit,
      p_rate_window_seconds: input.rateWindowSeconds
    });

    if (error) throw databaseError('reservar');
    const row = Array.isArray(data) ? data[0] : data;
    return {
      mediaId: row?.reserved_media_id ?? null,
      denialCode: row?.denial_code ?? null
    };
  }

  async attachMuxUpload(businessId: string, mediaId: string, uploadId: string, expiresAt: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin.rpc('attach_mux_upload_to_media', {
      p_business_id: businessId,
      p_media_id: mediaId,
      p_mux_upload_id: uploadId,
      p_upload_expires_at: expiresAt
    });
    if (error) throw databaseError('vincular');
    return data === true;
  }

  async failReservation(businessId: string, mediaId: string, errorCode: string): Promise<void> {
    const { error } = await supabaseAdmin.rpc('fail_video_upload_reservation', {
      p_business_id: businessId,
      p_media_id: mediaId,
      p_error_code: errorCode
    });
    if (error) throw databaseError('finalizar');
  }

  async claimWebhook(input: WebhookClaim): Promise<boolean> {
    const { data, error } = await supabaseAdmin.rpc('claim_mux_webhook_event', {
      p_event_id: input.eventId,
      p_event_type: input.eventType,
      p_object_id: input.objectId,
      p_stale_after_seconds: input.staleAfterSeconds
    });
    if (error) throw databaseError('registrar');
    return data === true;
  }

  async finishWebhook(
    eventId: string,
    status: 'processed' | 'failed' | 'ignored',
    errorCode?: string
  ): Promise<void> {
    const { error } = await supabaseAdmin.rpc('finish_mux_webhook_event', {
      p_event_id: eventId,
      p_status: status,
      p_error_code: errorCode ?? null
    });
    if (error) throw databaseError('finalizar');
  }

  findByUploadId(uploadId: string): Promise<ProductMediaRecord | null> {
    return this.findOne('mux_upload_id', uploadId);
  }

  findByAssetId(assetId: string): Promise<ProductMediaRecord | null> {
    return this.findOne('mux_asset_id', assetId);
  }

  async findById(mediaId: string): Promise<ProductMediaRecord | null> {
    const { data, error } = await supabaseAdmin
      .from('product_media')
      .select(MEDIA_SELECT)
      .eq('id', mediaId)
      .eq('source', 'mux')
      .maybeSingle();
    if (error) throw databaseError('consultar');
    return data as ProductMediaRecord | null;
  }

  async findOwned(businessId: string, menuItemId: string, mediaId: string): Promise<ProductMediaRecord | null> {
    const { data, error } = await supabaseAdmin
      .from('product_media')
      .select(MEDIA_SELECT)
      .eq('id', mediaId)
      .eq('business_id', businessId)
      .eq('menu_item_id', menuItemId)
      .eq('source', 'mux')
      .maybeSingle();
    if (error) throw databaseError('consultar');
    return data as ProductMediaRecord | null;
  }

  async listOwnedForItem(businessId: string, menuItemId: string): Promise<OwnerMediaView[]> {
    const { data, error } = await supabaseAdmin
      .from('product_media')
      .select('id,media_type,source,position,status,is_published,duration_seconds,last_error_code,created_at,updated_at')
      .eq('business_id', businessId)
      .eq('menu_item_id', menuItemId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw databaseError('consultar');
    return (data ?? []) as OwnerMediaView[];
  }

  async listGalleryMedia(
    businessId: string,
    itemIds: string[],
    publishedOnly: boolean
  ): Promise<GalleryMediaView[]> {
    if (itemIds.length === 0) return [];

    let query = supabaseAdmin
      .from('product_media')
      .select('id,menu_item_id,media_type,source,position,duration_seconds')
      .eq('business_id', businessId)
      .eq('source', 'mux')
      .eq('status', 'ready')
      .in('menu_item_id', itemIds)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });

    if (publishedOnly) query = query.eq('is_published', true);

    const { data, error } = await query;
    if (error) throw databaseError('consultar galeria');
    return (data ?? []) as GalleryMediaView[];
  }

  async publishReadyForBusiness(businessId: string): Promise<number> {
    const { data, error } = await supabaseAdmin
      .from('product_media')
      .update({ is_published: true, updated_at: new Date().toISOString() })
      .eq('business_id', businessId)
      .eq('status', 'ready')
      .eq('is_published', false)
      .select('id');
    if (error) throw databaseError('publicar');
    return data?.length ?? 0;
  }

  async markProcessing(mediaId: string, uploadId: string, assetId: string): Promise<ProductMediaRecord | null> {
    const { data, error } = await supabaseAdmin
      .from('product_media')
      .update({
        status: 'processing',
        mux_asset_id: assetId,
        last_error_code: null,
        last_provider_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', mediaId)
      .eq('mux_upload_id', uploadId)
      .in('status', ['waiting', 'uploading', 'processing'])
      .select(MEDIA_SELECT)
      .maybeSingle();
    if (error) throw databaseError('atualizar');
    return data as ProductMediaRecord | null;
  }

  async markReady(mediaId: string, assetId: string, durationSeconds: number, playbackId: string): Promise<void> {
    await this.updateOne(mediaId, {
      status: 'ready',
      is_published: false,
      mux_asset_id: assetId,
      mux_playback_id: playbackId,
      duration_seconds: durationSeconds,
      last_error_code: null,
      last_provider_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  async markRejected(mediaId: string, assetId: string, durationSeconds: number, errorCode: string): Promise<void> {
    await this.updateOne(mediaId, {
      status: 'rejected',
      is_published: false,
      mux_asset_id: assetId,
      mux_playback_id: null,
      duration_seconds: durationSeconds,
      last_error_code: errorCode,
      last_provider_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  async markErrored(mediaId: string, errorCode: string, assetId?: string | null): Promise<void> {
    await this.updateOne(mediaId, {
      status: 'errored',
      is_published: false,
      ...(assetId ? { mux_asset_id: assetId } : {}),
      mux_playback_id: null,
      last_error_code: errorCode,
      last_provider_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  async markAssetDeleted(mediaId: string): Promise<void> {
    await this.updateOne(mediaId, {
      mux_asset_deleted_at: new Date().toISOString(),
      last_provider_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  async markPendingDeletion(media: ProductMediaRecord): Promise<ProductMediaRecord> {
    const { data, error } = await supabaseAdmin
      .from('product_media')
      .update({
        status: 'pending_deletion',
        is_published: false,
        deletion_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', media.id)
      .eq('business_id', media.business_id)
      .select(MEDIA_SELECT)
      .single();
    if (error || !data) throw databaseError('marcar para exclusão');
    return data as unknown as ProductMediaRecord;
  }

  async recordDeletionFailure(media: ProductMediaRecord, errorCode: string): Promise<void> {
    await this.updateOne(media.id, {
      deletion_attempts: media.deletion_attempts + 1,
      last_error_code: errorCode,
      last_provider_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  async deleteMedia(mediaId: string): Promise<void> {
    const { error } = await supabaseAdmin.from('product_media').delete().eq('id', mediaId);
    if (error) throw databaseError('excluir');
  }

  async listReconciliationCandidates(limit: number): Promise<ProductMediaRecord[]> {
    const now = new Date().toISOString();
    const staleProcessing = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from('product_media')
      .select(MEDIA_SELECT)
      .eq('source', 'mux')
      .or(`status.eq.pending_deletion,and(status.in.(waiting,uploading),upload_expires_at.lt.${now}),and(status.eq.processing,updated_at.lt.${staleProcessing})`)
      .order('updated_at', { ascending: true })
      .limit(limit);
    if (error) throw databaseError('conciliar');
    return (data ?? []) as unknown as ProductMediaRecord[];
  }

  private async findOne(column: 'mux_upload_id' | 'mux_asset_id', value: string): Promise<ProductMediaRecord | null> {
    const { data, error } = await supabaseAdmin
      .from('product_media')
      .select(MEDIA_SELECT)
      .eq(column, value)
      .eq('source', 'mux')
      .maybeSingle();
    if (error) throw databaseError('consultar');
    return data as ProductMediaRecord | null;
  }

  private async updateOne(mediaId: string, values: Record<string, unknown>): Promise<void> {
    const { data, error } = await supabaseAdmin
      .from('product_media')
      .update(values)
      .eq('id', mediaId)
      .select('id')
      .maybeSingle();
    if (error || !data) throw databaseError('atualizar');
  }
}
