-- ============================================================================
-- Product video replacement and display aspect ratio
-- Keeps one active video per product and makes replacements server-owned.
-- ============================================================================

ALTER TABLE public.product_media
    ADD COLUMN aspect_ratio TEXT,
    ADD COLUMN replaces_media_id UUID;

UPDATE public.product_media
SET aspect_ratio = '16:9'
WHERE media_type = 'video';

ALTER TABLE public.product_media
    ADD CONSTRAINT product_media_aspect_ratio_check
        CHECK (
            (media_type = 'video' AND aspect_ratio IN ('16:9', '9:16'))
            OR (media_type = 'image' AND aspect_ratio IS NULL)
        ),
    ADD CONSTRAINT product_media_replaces_not_self_check
        CHECK (replaces_media_id IS NULL OR replaces_media_id <> id),
    ADD CONSTRAINT product_media_replaces_media_fk
        FOREIGN KEY (replaces_media_id)
        REFERENCES public.product_media(id)
        ON DELETE SET NULL;

COMMENT ON COLUMN public.product_media.aspect_ratio IS
    'Owner-selected presentation ratio. Only the allowlisted 16:9 and 9:16 layouts are accepted.';
COMMENT ON COLUMN public.product_media.replaces_media_id IS
    'Ready video retained during processing and atomically retired when this replacement becomes ready.';

ALTER TABLE public.video_upload_attempts
    ADD COLUMN aspect_ratio TEXT NOT NULL DEFAULT '16:9',
    ADD COLUMN replaces_media_id UUID REFERENCES public.product_media(id) ON DELETE SET NULL,
    ADD CONSTRAINT video_upload_attempts_aspect_ratio_check
        CHECK (aspect_ratio IN ('16:9', '9:16'));

-- Repair legacy duplicates before installing the database-level barriers. The
-- reconciliation worker removes their provider resources and then their rows.
WITH ranked_ready AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY business_id, menu_item_id
               ORDER BY is_published DESC, updated_at DESC, created_at DESC, id DESC
           ) AS row_number
    FROM public.product_media
    WHERE media_type = 'video'
      AND source = 'mux'
      AND status = 'ready'
)
UPDATE public.product_media AS media
SET status = 'pending_deletion',
    is_published = FALSE,
    deletion_requested_at = NOW(),
    updated_at = NOW()
FROM ranked_ready
WHERE ranked_ready.id = media.id
  AND ranked_ready.row_number > 1;

WITH ranked_pending AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY business_id, menu_item_id
               ORDER BY updated_at DESC, created_at DESC, id DESC
           ) AS row_number
    FROM public.product_media
    WHERE media_type = 'video'
      AND source = 'mux'
      AND status IN ('waiting', 'uploading', 'processing')
)
UPDATE public.product_media AS media
SET status = 'pending_deletion',
    is_published = FALSE,
    deletion_requested_at = NOW(),
    updated_at = NOW()
FROM ranked_pending
WHERE ranked_pending.id = media.id
  AND ranked_pending.row_number > 1;

CREATE UNIQUE INDEX product_media_one_ready_video_per_item_uidx
    ON public.product_media (business_id, menu_item_id)
    WHERE media_type = 'video'
      AND source = 'mux'
      AND status = 'ready';

CREATE UNIQUE INDEX product_media_one_pending_video_per_item_uidx
    ON public.product_media (business_id, menu_item_id)
    WHERE media_type = 'video'
      AND source = 'mux'
      AND status IN ('waiting', 'uploading', 'processing');

DROP FUNCTION public.reserve_video_upload(
    UUID, UUID, UUID, TEXT, BIGINT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER
);

CREATE FUNCTION public.reserve_video_upload(
    p_business_id UUID,
    p_user_id UUID,
    p_menu_item_id UUID,
    p_ip_hash TEXT,
    p_declared_file_size_bytes BIGINT,
    p_declared_mime_type TEXT,
    p_daily_limit INTEGER,
    p_pending_limit INTEGER,
    p_rate_limit INTEGER,
    p_rate_window_seconds INTEGER,
    p_aspect_ratio TEXT DEFAULT '16:9',
    p_replaces_media_id UUID DEFAULT NULL
)
RETURNS TABLE (reserved_media_id UUID, denial_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_media_id UUID;
    v_next_position INTEGER;
    v_daily_start TIMESTAMPTZ;
    v_window_start TIMESTAMPTZ;
BEGIN
    IF p_daily_limit IS NULL
       OR p_pending_limit IS NULL
       OR p_rate_limit IS NULL
       OR p_rate_window_seconds IS NULL
       OR p_daily_limit < 1
       OR p_pending_limit < 1
       OR p_rate_limit < 1
       OR p_rate_window_seconds < 1 THEN
        RAISE EXCEPTION 'Invalid video quota configuration'
            USING ERRCODE = '22023';
    END IF;

    IF p_declared_file_size_bytes IS NULL
       OR p_declared_mime_type IS NULL
       OR p_aspect_ratio IS NULL
       OR p_ip_hash IS NULL
       OR p_declared_file_size_bytes < 1
       OR p_declared_file_size_bytes > 52428800
       OR p_declared_mime_type NOT IN ('video/mp4', 'video/quicktime', 'video/webm')
       OR p_aspect_ratio NOT IN ('16:9', '9:16')
       OR p_ip_hash !~ '^[a-f0-9]{64}$' THEN
        reserved_media_id := NULL;
        denial_code := 'INVALID_UPLOAD_METADATA';
        RETURN NEXT;
        RETURN;
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended('product-video:' || p_business_id::TEXT || ':' || p_menu_item_id::TEXT, 0)
    );

    IF NOT EXISTS (
        SELECT 1
        FROM public.businesses AS business
        WHERE business.id = p_business_id
          AND business.owner_user_id = p_user_id
          AND business.status = 'ACTIVE'
    ) THEN
        reserved_media_id := NULL;
        denial_code := 'BUSINESS_NOT_AUTHORIZED';
        RETURN NEXT;
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.menu_items AS item
        WHERE item.id = p_menu_item_id
          AND item.business_id = p_business_id
    ) THEN
        reserved_media_id := NULL;
        denial_code := 'PRODUCT_NOT_FOUND';
        RETURN NEXT;
        RETURN;
    END IF;

    v_daily_start := date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
    v_window_start := NOW() - make_interval(secs => p_rate_window_seconds);

    IF (
        SELECT COUNT(*)
        FROM public.video_upload_attempts AS attempt
        WHERE attempt.business_id = p_business_id
          AND attempt.created_at >= v_daily_start
    ) >= p_daily_limit THEN
        reserved_media_id := NULL;
        denial_code := 'DAILY_UPLOAD_LIMIT_REACHED';
        RETURN NEXT;
        RETURN;
    END IF;

    IF (
        SELECT COUNT(*)
        FROM public.product_media AS media
        WHERE media.business_id = p_business_id
          AND media.source = 'mux'
          AND media.status IN ('waiting', 'uploading', 'processing')
    ) >= p_pending_limit THEN
        reserved_media_id := NULL;
        denial_code := 'PENDING_UPLOAD_LIMIT_REACHED';
        RETURN NEXT;
        RETURN;
    END IF;

    IF (
        SELECT COUNT(*)
        FROM public.video_upload_attempts AS attempt
        WHERE attempt.requested_by = p_user_id
          AND attempt.created_at >= v_window_start
    ) >= p_rate_limit THEN
        reserved_media_id := NULL;
        denial_code := 'USER_UPLOAD_RATE_LIMITED';
        RETURN NEXT;
        RETURN;
    END IF;

    IF (
        SELECT COUNT(*)
        FROM public.video_upload_attempts AS attempt
        WHERE attempt.business_id = p_business_id
          AND attempt.created_at >= v_window_start
    ) >= p_rate_limit THEN
        reserved_media_id := NULL;
        denial_code := 'BUSINESS_UPLOAD_RATE_LIMITED';
        RETURN NEXT;
        RETURN;
    END IF;

    IF (
        SELECT COUNT(*)
        FROM public.video_upload_attempts AS attempt
        WHERE attempt.ip_hash = p_ip_hash
          AND attempt.created_at >= v_window_start
    ) >= p_rate_limit THEN
        reserved_media_id := NULL;
        denial_code := 'IP_UPLOAD_RATE_LIMITED';
        RETURN NEXT;
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.product_media AS media
        WHERE media.business_id = p_business_id
          AND media.menu_item_id = p_menu_item_id
          AND media.media_type = 'video'
          AND media.source = 'mux'
          AND media.status IN ('waiting', 'uploading', 'processing')
    ) THEN
        reserved_media_id := NULL;
        denial_code := 'VIDEO_UPLOAD_IN_PROGRESS';
        RETURN NEXT;
        RETURN;
    END IF;

    IF p_replaces_media_id IS NULL AND EXISTS (
        SELECT 1
        FROM public.product_media AS media
        WHERE media.business_id = p_business_id
          AND media.menu_item_id = p_menu_item_id
          AND media.media_type = 'video'
          AND media.source = 'mux'
          AND media.status = 'ready'
    ) THEN
        reserved_media_id := NULL;
        denial_code := 'VIDEO_ALREADY_EXISTS';
        RETURN NEXT;
        RETURN;
    END IF;

    IF p_replaces_media_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.product_media AS media
        WHERE media.id = p_replaces_media_id
          AND media.business_id = p_business_id
          AND media.menu_item_id = p_menu_item_id
          AND media.media_type = 'video'
          AND media.source = 'mux'
          AND media.status = 'ready'
    ) THEN
        reserved_media_id := NULL;
        denial_code := 'VIDEO_REPLACEMENT_NOT_FOUND';
        RETURN NEXT;
        RETURN;
    END IF;

    SELECT COALESCE(MAX(media.position), -1) + 1
    INTO v_next_position
    FROM public.product_media AS media
    WHERE media.business_id = p_business_id
      AND media.menu_item_id = p_menu_item_id;

    INSERT INTO public.product_media (
        business_id,
        menu_item_id,
        media_type,
        source,
        provider,
        position,
        status,
        is_published,
        declared_file_size_bytes,
        declared_mime_type,
        aspect_ratio,
        replaces_media_id
    )
    VALUES (
        p_business_id,
        p_menu_item_id,
        'video',
        'mux',
        'mux',
        v_next_position,
        'waiting',
        FALSE,
        p_declared_file_size_bytes,
        p_declared_mime_type,
        p_aspect_ratio,
        p_replaces_media_id
    )
    RETURNING id INTO v_media_id;

    INSERT INTO public.video_upload_attempts (
        business_id,
        requested_by,
        menu_item_id,
        media_id,
        ip_hash,
        declared_file_size_bytes,
        declared_mime_type,
        aspect_ratio,
        replaces_media_id
    )
    VALUES (
        p_business_id,
        p_user_id,
        p_menu_item_id,
        v_media_id,
        p_ip_hash,
        p_declared_file_size_bytes,
        p_declared_mime_type,
        p_aspect_ratio,
        p_replaces_media_id
    );

    reserved_media_id := v_media_id;
    denial_code := NULL;
    RETURN NEXT;
END;
$$;

-- The readiness transition and retirement of the old video are a single
-- transaction. Provider deletion intentionally happens after commit and is
-- retried by reconciliation if Mux is temporarily unavailable.
CREATE FUNCTION public.finalize_product_video_ready(
    p_media_id UUID,
    p_mux_asset_id TEXT,
    p_duration_seconds NUMERIC,
    p_mux_playback_id TEXT
)
RETURNS TABLE (replaced_media_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_business_id UUID;
    v_menu_item_id UUID;
    v_updated_id UUID;
    v_keep_published BOOLEAN := FALSE;
BEGIN
    SELECT media.business_id, media.menu_item_id
    INTO v_business_id, v_menu_item_id
    FROM public.product_media AS media
    WHERE media.id = p_media_id
      AND media.media_type = 'video'
      AND media.source = 'mux'
      AND media.status IN ('uploading', 'processing');

    IF v_business_id IS NULL THEN
        RAISE EXCEPTION 'Video media is not in a finalizable state'
            USING ERRCODE = '55000';
    END IF;

    IF p_duration_seconds IS NULL
       OR p_duration_seconds < 0 OR p_duration_seconds > 15
       OR NULLIF(BTRIM(p_mux_asset_id), '') IS NULL
       OR NULLIF(BTRIM(p_mux_playback_id), '') IS NULL THEN
        RAISE EXCEPTION 'Invalid ready video metadata'
            USING ERRCODE = '22023';
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended('product-video:' || v_business_id::TEXT || ':' || v_menu_item_id::TEXT, 0)
    );

    PERFORM 1
    FROM public.product_media AS media
    WHERE media.id = p_media_id
      AND media.business_id = v_business_id
      AND media.menu_item_id = v_menu_item_id
      AND media.media_type = 'video'
      AND media.source = 'mux'
      AND media.status IN ('uploading', 'processing')
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Video media is not in a finalizable state'
            USING ERRCODE = '55000';
    END IF;

    SELECT COALESCE(BOOL_OR(previous.is_published), FALSE)
    INTO v_keep_published
    FROM public.product_media AS previous
    WHERE previous.business_id = v_business_id
      AND previous.menu_item_id = v_menu_item_id
      AND previous.id <> p_media_id
      AND previous.media_type = 'video'
      AND previous.source = 'mux'
      AND previous.status = 'ready';

    RETURN QUERY
    UPDATE public.product_media AS previous
    SET status = 'pending_deletion',
        is_published = FALSE,
        deletion_requested_at = NOW(),
        updated_at = NOW()
    WHERE previous.business_id = v_business_id
      AND previous.menu_item_id = v_menu_item_id
      AND previous.id <> p_media_id
      AND previous.media_type = 'video'
      AND previous.source = 'mux'
      AND previous.status = 'ready'
    RETURNING previous.id;

    UPDATE public.product_media
    SET status = 'ready',
        is_published = v_keep_published,
        mux_asset_id = p_mux_asset_id,
        mux_playback_id = p_mux_playback_id,
        duration_seconds = p_duration_seconds,
        last_error_code = NULL,
        last_provider_sync_at = NOW(),
        updated_at = NOW()
    WHERE id = p_media_id
      AND status IN ('uploading', 'processing')
    RETURNING id INTO v_updated_id;

    IF v_updated_id IS NULL THEN
        RAISE EXCEPTION 'Video readiness transition lost a concurrent update'
            USING ERRCODE = '40001';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_video_upload(
    UUID, UUID, UUID, TEXT, BIGINT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, UUID
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_video_upload(
    UUID, UUID, UUID, TEXT, BIGINT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, UUID
) TO service_role;

REVOKE ALL ON FUNCTION public.finalize_product_video_ready(
    UUID, TEXT, NUMERIC, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_product_video_ready(
    UUID, TEXT, NUMERIC, TEXT
) TO service_role;
