-- ============================================================================
-- PingoChef - Mux backend controls
-- Phase 2: atomic reservations, quotas, webhook idempotency and reconciliation
-- ============================================================================

ALTER TABLE public.product_media
    ADD COLUMN declared_file_size_bytes BIGINT,
    ADD COLUMN declared_mime_type TEXT,
    ADD COLUMN upload_expires_at TIMESTAMPTZ,
    ADD COLUMN last_error_code TEXT,
    ADD COLUMN deletion_requested_at TIMESTAMPTZ,
    ADD COLUMN deletion_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN last_provider_sync_at TIMESTAMPTZ,
    ADD COLUMN mux_asset_deleted_at TIMESTAMPTZ;

ALTER TABLE public.product_media
    ADD CONSTRAINT product_media_declared_file_size_check
        CHECK (
            declared_file_size_bytes IS NULL
            OR declared_file_size_bytes BETWEEN 1 AND 52428800
        ),
    ADD CONSTRAINT product_media_declared_mime_type_check
        CHECK (
            declared_mime_type IS NULL
            OR declared_mime_type IN ('video/mp4', 'video/quicktime', 'video/webm')
        ),
    ADD CONSTRAINT product_media_deletion_attempts_check
        CHECK (deletion_attempts >= 0),
    ADD CONSTRAINT product_media_last_error_code_check
        CHECK (
            last_error_code IS NULL
            OR last_error_code ~ '^[A-Z0-9_]{1,64}$'
        );

CREATE INDEX product_media_expired_upload_idx
    ON public.product_media (upload_expires_at, created_at)
    WHERE source = 'mux'
      AND status IN ('waiting', 'uploading');

CREATE INDEX product_media_reconciliation_idx
    ON public.product_media (status, updated_at)
    WHERE source = 'mux'
      AND status IN ('processing', 'pending_deletion');

-- One row is written only after an upload reservation passes every atomic
-- quota check. Raw IP addresses are never stored; the BFF supplies an HMAC.
CREATE TABLE public.video_upload_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL,
    media_id UUID UNIQUE REFERENCES public.product_media(id) ON DELETE SET NULL,
    ip_hash TEXT NOT NULL,
    declared_file_size_bytes BIGINT NOT NULL,
    declared_mime_type TEXT NOT NULL,
    outcome TEXT NOT NULL DEFAULT 'reserved',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT video_upload_attempts_item_business_fk
        FOREIGN KEY (business_id, menu_item_id)
        REFERENCES public.menu_items(business_id, id)
        ON DELETE CASCADE,
    CONSTRAINT video_upload_attempts_ip_hash_check
        CHECK (ip_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT video_upload_attempts_size_check
        CHECK (declared_file_size_bytes BETWEEN 1 AND 52428800),
    CONSTRAINT video_upload_attempts_mime_check
        CHECK (declared_mime_type IN ('video/mp4', 'video/quicktime', 'video/webm')),
    CONSTRAINT video_upload_attempts_outcome_check
        CHECK (outcome IN (
            'reserved',
            'provider_created',
            'provider_failed',
            'cancelled',
            'timed_out'
        ))
);

CREATE INDEX video_upload_attempts_business_time_idx
    ON public.video_upload_attempts (business_id, created_at DESC);

CREATE INDEX video_upload_attempts_user_time_idx
    ON public.video_upload_attempts (requested_by, created_at DESC);

CREATE INDEX video_upload_attempts_ip_time_idx
    ON public.video_upload_attempts (ip_hash, created_at DESC);

ALTER TABLE public.video_upload_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_upload_attempts FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.video_upload_attempts FROM PUBLIC;
REVOKE ALL ON TABLE public.video_upload_attempts FROM anon;
REVOKE ALL ON TABLE public.video_upload_attempts FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.video_upload_attempts TO service_role;

-- Webhook bodies are intentionally not persisted. This table stores only the
-- minimum metadata needed for idempotency, retries and operational metrics.
CREATE TABLE public.mux_webhook_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    object_id TEXT,
    status TEXT NOT NULL DEFAULT 'processing',
    attempts INTEGER NOT NULL DEFAULT 1,
    last_error_code TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT mux_webhook_events_event_id_check
        CHECK (BTRIM(event_id) <> '' AND LENGTH(event_id) <= 255),
    CONSTRAINT mux_webhook_events_event_type_check
        CHECK (BTRIM(event_type) <> '' AND LENGTH(event_type) <= 128),
    CONSTRAINT mux_webhook_events_object_id_check
        CHECK (object_id IS NULL OR (BTRIM(object_id) <> '' AND LENGTH(object_id) <= 255)),
    CONSTRAINT mux_webhook_events_status_check
        CHECK (status IN ('processing', 'processed', 'failed', 'ignored')),
    CONSTRAINT mux_webhook_events_attempts_check
        CHECK (attempts >= 1),
    CONSTRAINT mux_webhook_events_error_code_check
        CHECK (
            last_error_code IS NULL
            OR last_error_code ~ '^[A-Z0-9_]{1,64}$'
        )
);

CREATE INDEX mux_webhook_events_status_time_idx
    ON public.mux_webhook_events (status, updated_at);

ALTER TABLE public.mux_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mux_webhook_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.mux_webhook_events FROM PUBLIC;
REVOKE ALL ON TABLE public.mux_webhook_events FROM anon;
REVOKE ALL ON TABLE public.mux_webhook_events FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mux_webhook_events TO service_role;

-- Atomically validates ownership and all database-backed limits before it
-- creates a media row. The advisory transaction lock serializes concurrent
-- reservations for the same business, preventing quota races.
CREATE OR REPLACE FUNCTION public.reserve_video_upload(
    p_business_id UUID,
    p_user_id UUID,
    p_menu_item_id UUID,
    p_ip_hash TEXT,
    p_declared_file_size_bytes BIGINT,
    p_declared_mime_type TEXT,
    p_daily_limit INTEGER,
    p_pending_limit INTEGER,
    p_rate_limit INTEGER,
    p_rate_window_seconds INTEGER
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
    IF p_daily_limit < 1
       OR p_pending_limit < 1
       OR p_rate_limit < 1
       OR p_rate_window_seconds < 1 THEN
        RAISE EXCEPTION 'Invalid video quota configuration'
            USING ERRCODE = '22023';
    END IF;

    IF p_declared_file_size_bytes < 1
       OR p_declared_file_size_bytes > 52428800
       OR p_declared_mime_type NOT IN ('video/mp4', 'video/quicktime', 'video/webm')
       OR p_ip_hash !~ '^[a-f0-9]{64}$' THEN
        reserved_media_id := NULL;
        denial_code := 'INVALID_UPLOAD_METADATA';
        RETURN NEXT;
        RETURN;
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended('pingo-video-upload:' || p_business_id::TEXT, 0)
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
        declared_mime_type
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
        p_declared_mime_type
    )
    RETURNING id INTO v_media_id;

    INSERT INTO public.video_upload_attempts (
        business_id,
        requested_by,
        menu_item_id,
        media_id,
        ip_hash,
        declared_file_size_bytes,
        declared_mime_type
    )
    VALUES (
        p_business_id,
        p_user_id,
        p_menu_item_id,
        v_media_id,
        p_ip_hash,
        p_declared_file_size_bytes,
        p_declared_mime_type
    );

    reserved_media_id := v_media_id;
    denial_code := NULL;
    RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_mux_upload_to_media(
    p_business_id UUID,
    p_media_id UUID,
    p_mux_upload_id TEXT,
    p_upload_expires_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_updated_id UUID;
BEGIN
    UPDATE public.product_media
    SET status = 'uploading',
        mux_upload_id = p_mux_upload_id,
        upload_expires_at = p_upload_expires_at,
        last_provider_sync_at = NOW(),
        last_error_code = NULL
    WHERE id = p_media_id
      AND business_id = p_business_id
      AND source = 'mux'
      AND status = 'waiting'
      AND mux_upload_id IS NULL
    RETURNING id INTO v_updated_id;

    IF v_updated_id IS NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE public.video_upload_attempts
    SET outcome = 'provider_created',
        updated_at = NOW()
    WHERE media_id = p_media_id;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_video_upload_reservation(
    p_business_id UUID,
    p_media_id UUID,
    p_error_code TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    UPDATE public.product_media
    SET status = 'errored',
        is_published = FALSE,
        last_error_code = p_error_code,
        last_provider_sync_at = NOW()
    WHERE id = p_media_id
      AND business_id = p_business_id
      AND source = 'mux'
      AND status = 'waiting';

    UPDATE public.video_upload_attempts
    SET outcome = 'provider_failed',
        updated_at = NOW()
    WHERE media_id = p_media_id;
END;
$$;

-- Returns TRUE only when this request owns the right to process the event.
-- Concurrent duplicates and already completed events return FALSE. Failed or
-- stale processing rows can be claimed again for safe retry.
CREATE OR REPLACE FUNCTION public.claim_mux_webhook_event(
    p_event_id TEXT,
    p_event_type TEXT,
    p_object_id TEXT,
    p_stale_after_seconds INTEGER DEFAULT 300
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_status TEXT;
    v_updated_at TIMESTAMPTZ;
BEGIN
    IF p_event_id IS NULL OR BTRIM(p_event_id) = ''
       OR p_event_type IS NULL OR BTRIM(p_event_type) = ''
       OR p_stale_after_seconds < 30 THEN
        RETURN FALSE;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('mux-event:' || p_event_id, 0));

    INSERT INTO public.mux_webhook_events (
        event_id,
        event_type,
        object_id,
        status,
        attempts
    )
    VALUES (
        p_event_id,
        p_event_type,
        p_object_id,
        'processing',
        1
    )
    ON CONFLICT (event_id) DO NOTHING;

    IF FOUND THEN
        RETURN TRUE;
    END IF;

    SELECT event.status, event.updated_at
    INTO v_status, v_updated_at
    FROM public.mux_webhook_events AS event
    WHERE event.event_id = p_event_id
    FOR UPDATE;

    IF v_status IN ('processed', 'ignored') THEN
        RETURN FALSE;
    END IF;

    IF v_status = 'processing'
       AND v_updated_at > NOW() - make_interval(secs => p_stale_after_seconds) THEN
        RETURN FALSE;
    END IF;

    UPDATE public.mux_webhook_events
    SET status = 'processing',
        attempts = attempts + 1,
        last_error_code = NULL,
        updated_at = NOW()
    WHERE event_id = p_event_id;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_mux_webhook_event(
    p_event_id TEXT,
    p_status TEXT,
    p_error_code TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF p_status NOT IN ('processed', 'failed', 'ignored') THEN
        RAISE EXCEPTION 'Invalid webhook terminal status'
            USING ERRCODE = '22023';
    END IF;

    UPDATE public.mux_webhook_events
    SET status = p_status,
        last_error_code = p_error_code,
        processed_at = CASE
            WHEN p_status IN ('processed', 'ignored') THEN NOW()
            ELSE NULL
        END,
        updated_at = NOW()
    WHERE event_id = p_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_video_upload(
    UUID, UUID, UUID, TEXT, BIGINT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_video_upload(
    UUID, UUID, UUID, TEXT, BIGINT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER
) TO service_role;

REVOKE ALL ON FUNCTION public.attach_mux_upload_to_media(
    UUID, UUID, TEXT, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attach_mux_upload_to_media(
    UUID, UUID, TEXT, TIMESTAMPTZ
) TO service_role;

REVOKE ALL ON FUNCTION public.fail_video_upload_reservation(
    UUID, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_video_upload_reservation(
    UUID, UUID, TEXT
) TO service_role;

REVOKE ALL ON FUNCTION public.claim_mux_webhook_event(
    TEXT, TEXT, TEXT, INTEGER
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mux_webhook_event(
    TEXT, TEXT, TEXT, INTEGER
) TO service_role;

REVOKE ALL ON FUNCTION public.finish_mux_webhook_event(
    TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_mux_webhook_event(
    TEXT, TEXT, TEXT
) TO service_role;
