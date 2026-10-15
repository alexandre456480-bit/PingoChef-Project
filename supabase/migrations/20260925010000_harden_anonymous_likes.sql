-- ============================================================================
-- PingoChef - Anonymous likes hardening
-- One like per browser identity and item, with an additional IP velocity cap.
-- Raw visitor identifiers and IP addresses never reach the database.
-- ============================================================================

ALTER TABLE public.anonymous_likes
    ADD COLUMN IF NOT EXISTS visitor_hash TEXT;

-- Preserve legacy audit rows without making their IP hash a reusable identity.
UPDATE public.anonymous_likes
SET visitor_hash = md5(id::TEXT) || md5('legacy-like:' || id::TEXT)
WHERE visitor_hash IS NULL;

DELETE FROM public.anonymous_likes AS anonymous_like
WHERE NOT EXISTS (
    SELECT 1
    FROM public.menu_items AS item
    WHERE item.id = anonymous_like.item_id
      AND item.business_id = anonymous_like.business_id
);

-- Keep only the oldest record if this migration is reapplied after partial work.
DELETE FROM public.anonymous_likes AS duplicate
USING public.anonymous_likes AS original
WHERE duplicate.business_id = original.business_id
  AND duplicate.item_id = original.item_id
  AND duplicate.visitor_hash = original.visitor_hash
  AND (duplicate.created_at, duplicate.id) > (original.created_at, original.id);

ALTER TABLE public.anonymous_likes
    ALTER COLUMN visitor_hash SET NOT NULL;

ALTER TABLE public.anonymous_likes
    DROP CONSTRAINT IF EXISTS anonymous_likes_item_id_fkey,
    DROP CONSTRAINT IF EXISTS anonymous_likes_item_business_fk,
    DROP CONSTRAINT IF EXISTS anonymous_likes_ip_hash_check,
    DROP CONSTRAINT IF EXISTS anonymous_likes_visitor_hash_check;

ALTER TABLE public.anonymous_likes
    ADD CONSTRAINT anonymous_likes_item_business_fk
        FOREIGN KEY (business_id, item_id)
        REFERENCES public.menu_items(business_id, id)
        ON DELETE CASCADE,
    ADD CONSTRAINT anonymous_likes_ip_hash_check
        CHECK (ip_hash ~ '^[a-f0-9]{64}$'),
    ADD CONSTRAINT anonymous_likes_visitor_hash_check
        CHECK (visitor_hash ~ '^[a-f0-9]{64}$');

CREATE UNIQUE INDEX IF NOT EXISTS anonymous_likes_visitor_item_uidx
    ON public.anonymous_likes (business_id, item_id, visitor_hash);

CREATE INDEX IF NOT EXISTS anonymous_likes_ip_velocity_idx
    ON public.anonymous_likes (business_id, ip_hash, created_at DESC);

ALTER TABLE public.anonymous_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_likes FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.anonymous_likes FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.anonymous_likes TO service_role;

CREATE OR REPLACE FUNCTION public.register_anonymous_like(
    p_item_id UUID,
    p_business_id UUID,
    p_visitor_hash TEXT,
    p_ip_hash TEXT,
    p_ip_limit INTEGER DEFAULT 30,
    p_window_seconds INTEGER DEFAULT 3600
)
RETURNS TABLE (
    likes_count INTEGER,
    created BOOLEAN,
    denial_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_current_likes INTEGER;
    v_inserted_id UUID;
BEGIN
    IF p_visitor_hash !~ '^[a-f0-9]{64}$'
       OR p_ip_hash !~ '^[a-f0-9]{64}$'
       OR p_ip_limit NOT BETWEEN 1 AND 500
       OR p_window_seconds NOT BETWEEN 60 AND 86400 THEN
        RAISE EXCEPTION 'Invalid anonymous like parameters';
    END IF;

    -- Serializes the velocity check for this tenant/IP without exposing the IP.
    PERFORM pg_advisory_xact_lock(
        hashtextextended('anonymous-like:' || p_business_id::TEXT || ':' || p_ip_hash, 0)
    );

    SELECT COALESCE(item.likes_count, 0)
    INTO v_current_likes
    FROM public.menu_items AS item
    WHERE item.id = p_item_id
      AND item.business_id = p_business_id
      AND item.is_available = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 0, FALSE, 'ITEM_NOT_FOUND'::TEXT;
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.anonymous_likes AS anonymous_like
        WHERE anonymous_like.business_id = p_business_id
          AND anonymous_like.item_id = p_item_id
          AND anonymous_like.visitor_hash = p_visitor_hash
    ) THEN
        RETURN QUERY SELECT v_current_likes, FALSE, NULL::TEXT;
        RETURN;
    END IF;

    IF (
        SELECT COUNT(*)
        FROM public.anonymous_likes AS anonymous_like
        WHERE anonymous_like.business_id = p_business_id
          AND anonymous_like.ip_hash = p_ip_hash
          AND anonymous_like.created_at >= NOW() - make_interval(secs => p_window_seconds)
    ) >= p_ip_limit THEN
        RETURN QUERY SELECT v_current_likes, FALSE, 'LIKE_RATE_LIMITED'::TEXT;
        RETURN;
    END IF;

    INSERT INTO public.anonymous_likes (
        item_id,
        business_id,
        visitor_hash,
        ip_hash
    )
    VALUES (
        p_item_id,
        p_business_id,
        p_visitor_hash,
        p_ip_hash
    )
    ON CONFLICT (business_id, item_id, visitor_hash) DO NOTHING
    RETURNING id INTO v_inserted_id;

    IF v_inserted_id IS NULL THEN
        RETURN QUERY SELECT v_current_likes, FALSE, NULL::TEXT;
        RETURN;
    END IF;

    UPDATE public.menu_items AS item
    SET likes_count = GREATEST(COALESCE(item.likes_count, 0) + 1, 0),
        updated_at = NOW()
    WHERE item.id = p_item_id
      AND item.business_id = p_business_id
    RETURNING item.likes_count INTO v_current_likes;

    RETURN QUERY SELECT v_current_likes, TRUE, NULL::TEXT;
END;
$$;

-- The legacy function allowed an unauthenticated caller to increment forever.
REVOKE ALL ON FUNCTION public.increment_likes(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_anonymous_like(UUID, UUID, TEXT, TEXT, INTEGER, INTEGER)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_anonymous_like(UUID, UUID, TEXT, TEXT, INTEGER, INTEGER)
    TO service_role;
