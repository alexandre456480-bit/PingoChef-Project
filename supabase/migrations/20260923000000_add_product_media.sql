-- ============================================================================
-- PingoChef - Product media foundation
-- Phase 1: relational model, integrity, indexes, grants and tenant isolation
-- ============================================================================

-- A composite candidate key is required so product_media can prove, with a
-- foreign key (and not only application code), that the item belongs to the
-- same business stored on the media row.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.menu_items'::regclass
          AND conname = 'menu_items_business_id_id_key'
    ) THEN
        ALTER TABLE public.menu_items
            ADD CONSTRAINT menu_items_business_id_id_key
            UNIQUE (business_id, id);
    END IF;
END
$$;

CREATE TABLE public.product_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    menu_item_id UUID NOT NULL,

    media_type TEXT NOT NULL,
    source TEXT NOT NULL,
    provider TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'waiting',
    is_published BOOLEAN NOT NULL DEFAULT FALSE,

    -- Supabase Storage object key. Existing menu_items.image_url remains the
    -- compatibility source until the image migration is designed separately.
    storage_object_path TEXT,

    -- Provider-controlled values. They are never video bytes or Base64 data.
    mux_upload_id TEXT,
    mux_asset_id TEXT,
    mux_playback_id TEXT,
    external_provider TEXT,
    external_video_id TEXT,
    duration_seconds NUMERIC(8, 3),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT product_media_business_fk
        FOREIGN KEY (business_id)
        REFERENCES public.businesses(id)
        ON DELETE CASCADE,
    CONSTRAINT product_media_item_business_fk
        FOREIGN KEY (business_id, menu_item_id)
        REFERENCES public.menu_items(business_id, id)
        ON DELETE CASCADE,

    CONSTRAINT product_media_media_type_check
        CHECK (media_type IN ('image', 'video')),
    CONSTRAINT product_media_source_check
        CHECK (source IN ('storage', 'mux', 'external')),
    CONSTRAINT product_media_provider_check
        CHECK (provider IS NULL OR provider IN ('supabase', 'mux', 'youtube', 'vimeo')),
    CONSTRAINT product_media_external_provider_check
        CHECK (external_provider IS NULL OR external_provider IN ('youtube', 'vimeo')),
    CONSTRAINT product_media_status_check
        CHECK (status IN (
            'waiting',
            'uploading',
            'processing',
            'ready',
            'rejected',
            'errored',
            'pending_deletion'
        )),
    CONSTRAINT product_media_position_nonnegative_check
        CHECK (position >= 0),
    CONSTRAINT product_media_duration_nonnegative_check
        CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    CONSTRAINT product_media_nonempty_identifiers_check
        CHECK (
            (NULLIF(BTRIM(storage_object_path), '') IS NOT NULL OR storage_object_path IS NULL)
            AND (NULLIF(BTRIM(mux_upload_id), '') IS NOT NULL OR mux_upload_id IS NULL)
            AND (NULLIF(BTRIM(mux_asset_id), '') IS NOT NULL OR mux_asset_id IS NULL)
            AND (NULLIF(BTRIM(mux_playback_id), '') IS NOT NULL OR mux_playback_id IS NULL)
            AND (NULLIF(BTRIM(external_video_id), '') IS NOT NULL OR external_video_id IS NULL)
        ),

    -- The three supported sources have deliberately disjoint data shapes.
    -- This prevents ambiguous rows and arbitrary external URLs in the table.
    CONSTRAINT product_media_source_shape_check
        CHECK (
            (
                source = 'storage'
                AND media_type = 'image'
                AND provider = 'supabase'
                AND storage_object_path IS NOT NULL
                AND mux_upload_id IS NULL
                AND mux_asset_id IS NULL
                AND mux_playback_id IS NULL
                AND external_provider IS NULL
                AND external_video_id IS NULL
            )
            OR
            (
                source = 'mux'
                AND media_type = 'video'
                AND provider = 'mux'
                AND storage_object_path IS NULL
                AND external_provider IS NULL
                AND external_video_id IS NULL
            )
            OR
            (
                source = 'external'
                AND media_type = 'video'
                AND provider IN ('youtube', 'vimeo')
                AND external_provider = provider
                AND external_video_id IS NOT NULL
                AND storage_object_path IS NULL
                AND mux_upload_id IS NULL
                AND mux_asset_id IS NULL
                AND mux_playback_id IS NULL
            )
        ),

    -- State invariants are a final database barrier. In particular, a Mux
    -- video can never become ready/published without real duration metadata,
    -- required provider IDs, and compliance with the 15-second product rule.
    CONSTRAINT product_media_uploading_state_check
        CHECK (status <> 'uploading' OR (source = 'mux' AND mux_upload_id IS NOT NULL)),
    CONSTRAINT product_media_processing_state_check
        CHECK (status <> 'processing' OR (source = 'mux' AND mux_asset_id IS NOT NULL)),
    CONSTRAINT product_media_ready_state_check
        CHECK (
            status <> 'ready'
            OR (source = 'storage' AND storage_object_path IS NOT NULL)
            OR (
                source = 'mux'
                AND mux_asset_id IS NOT NULL
                AND mux_playback_id IS NOT NULL
                AND duration_seconds IS NOT NULL
                AND duration_seconds <= 15
            )
            OR (
                source = 'external'
                AND external_provider IN ('youtube', 'vimeo')
                AND external_video_id IS NOT NULL
            )
        ),
    CONSTRAINT product_media_published_state_check
        CHECK (NOT is_published OR status = 'ready')
);

COMMENT ON TABLE public.product_media IS
    'Ordered product media. Administrative provider IDs stay private; public responses must be projected by the BFF.';
COMMENT ON COLUMN public.product_media.is_published IS
    'Publication gate for media. It does not replace a future immutable menu publication snapshot.';
COMMENT ON COLUMN public.product_media.storage_object_path IS
    'Storage object key only; never video bytes, Base64 content, or an arbitrary embed URL.';
COMMENT ON COLUMN public.product_media.duration_seconds IS
    'Provider-observed duration. Mux media cannot be ready above the 15-second product limit.';

-- Provider identifiers are globally unique when present. Partial indexes keep
-- multiple NULLs legal during waiting/error states.
CREATE UNIQUE INDEX product_media_mux_upload_id_uidx
    ON public.product_media (mux_upload_id)
    WHERE mux_upload_id IS NOT NULL;

CREATE UNIQUE INDEX product_media_mux_asset_id_uidx
    ON public.product_media (mux_asset_id)
    WHERE mux_asset_id IS NOT NULL;

CREATE UNIQUE INDEX product_media_mux_playback_id_uidx
    ON public.product_media (mux_playback_id)
    WHERE mux_playback_id IS NOT NULL;

CREATE UNIQUE INDEX product_media_storage_object_path_uidx
    ON public.product_media (storage_object_path)
    WHERE storage_object_path IS NOT NULL;

CREATE UNIQUE INDEX product_media_external_item_uidx
    ON public.product_media (menu_item_id, provider, external_video_id)
    WHERE source = 'external';

-- Read paths, ordered gallery reads, observability and later cleanup/retry jobs.
CREATE INDEX product_media_business_idx
    ON public.product_media (business_id);

CREATE INDEX product_media_item_position_idx
    ON public.product_media (business_id, menu_item_id, position, created_at, id);

CREATE INDEX product_media_business_status_idx
    ON public.product_media (business_id, status);

CREATE INDEX product_media_public_ready_idx
    ON public.product_media (business_id, menu_item_id, position)
    WHERE is_published = TRUE AND status = 'ready';

CREATE INDEX product_media_pending_work_idx
    ON public.product_media (status, created_at)
    WHERE status IN ('waiting', 'uploading', 'processing', 'pending_deletion');

CREATE OR REPLACE FUNCTION public.set_product_media_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_product_media_updated_at
BEFORE UPDATE ON public.product_media
FOR EACH ROW
EXECUTE FUNCTION public.set_product_media_updated_at();

ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_media FORCE ROW LEVEL SECURITY;

-- An authenticated owner may inspect only media from their own business.
-- Mutations intentionally have no client policy and no table grant: upload,
-- provider state, publication and deletion must pass through the BFF, which
-- derives the tenant and performs quota/provider lifecycle checks first.
CREATE POLICY product_media_owner_select
ON public.product_media
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.businesses AS business
        WHERE business.id = product_media.business_id
          AND business.owner_user_id = auth.uid()
    )
);

REVOKE ALL ON TABLE public.product_media FROM PUBLIC;
REVOKE ALL ON TABLE public.product_media FROM anon;
REVOKE ALL ON TABLE public.product_media FROM authenticated;
GRANT SELECT ON TABLE public.product_media TO authenticated;

-- The BFF's service role is the only application role allowed to mutate this
-- table. It still must validate session -> business -> item before every write.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_media TO service_role;

REVOKE ALL ON FUNCTION public.set_product_media_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_product_media_updated_at() TO service_role;
