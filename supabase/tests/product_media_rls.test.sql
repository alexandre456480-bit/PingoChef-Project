-- Run with `supabase test db` against a disposable database after all
-- migrations have been applied. The whole fixture is rolled back.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(25);

SELECT has_table('public', 'product_media', 'product_media exists');
SELECT has_column('public', 'product_media', 'business_id', 'business_id exists');
SELECT has_column('public', 'product_media', 'menu_item_id', 'menu_item_id exists');
SELECT has_column('public', 'product_media', 'is_published', 'publication gate exists');
SELECT has_column('public', 'product_media', 'duration_seconds', 'duration metadata exists');

-- Stable UUIDs make failed-test output easy to interpret.
INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change,
    email_change_token_new
)
VALUES
    (
        '10000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'media-owner-a@example.test',
        '',
        NOW(),
        '{"provider":"email","providers":["email"]}',
        '{}',
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    ),
    (
        '20000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'media-owner-b@example.test',
        '',
        NOW(),
        '{"provider":"email","providers":["email"]}',
        '{}',
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    );

INSERT INTO public.profiles (id, full_name)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'Media Owner A'),
    ('20000000-0000-0000-0000-000000000002', 'Media Owner B');

INSERT INTO public.businesses (id, owner_user_id, name, slug, status)
VALUES
    (
        'a0000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        'Media Business A',
        'media-business-a-test',
        'ACTIVE'
    ),
    (
        'b0000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000002',
        'Media Business B',
        'media-business-b-test',
        'ACTIVE'
    );

INSERT INTO public.categories (id, business_id, name)
VALUES
    (
        'aa000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001',
        'Category A'
    ),
    (
        'bb000000-0000-0000-0000-000000000002',
        'b0000000-0000-0000-0000-000000000002',
        'Category B'
    );

INSERT INTO public.menu_items (id, business_id, category_id, name, price)
VALUES
    (
        'aa100000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001',
        'aa000000-0000-0000-0000-000000000001',
        'Item A',
        10
    ),
    (
        'bb200000-0000-0000-0000-000000000002',
        'b0000000-0000-0000-0000-000000000002',
        'bb000000-0000-0000-0000-000000000002',
        'Item B',
        10
    );

INSERT INTO public.product_media (
    id,
    business_id,
    menu_item_id,
    media_type,
    source,
    provider,
    position,
    status,
    is_published,
    storage_object_path
)
VALUES (
    'a1100000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'aa100000-0000-0000-0000-000000000001',
    'image',
    'storage',
    'supabase',
    0,
    'ready',
    TRUE,
    'businesses/a/items/a/image-1.webp'
);

INSERT INTO public.product_media (
    id,
    business_id,
    menu_item_id,
    media_type,
    source,
    provider,
    position,
    status,
    is_published,
    external_provider,
    external_video_id
)
VALUES (
    'b2200000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000002',
    'bb200000-0000-0000-0000-000000000002',
    'video',
    'external',
    'youtube',
    0,
    'ready',
    FALSE,
    'youtube',
    'video-b-1'
);

INSERT INTO public.product_media (
    id,
    business_id,
    menu_item_id,
    media_type,
    source,
    provider,
    position,
    status,
    is_published,
    mux_upload_id,
    mux_asset_id,
    mux_playback_id,
    duration_seconds
)
VALUES (
    'a1300000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'aa100000-0000-0000-0000-000000000001',
    'video',
    'mux',
    'mux',
    1,
    'ready',
    TRUE,
    'upload-a-1',
    'asset-a-1',
    'playback-a-1',
    15.000
);

SELECT lives_ok(
    $$
        INSERT INTO public.product_media (
            business_id,
            menu_item_id,
            media_type,
            source,
            provider,
            position,
            status,
            external_provider,
            external_video_id
        )
        VALUES (
            'a0000000-0000-0000-0000-000000000001',
            'aa100000-0000-0000-0000-000000000001',
            'video',
            'external',
            'vimeo',
            2,
            'ready',
            'vimeo',
            'video-a-2'
        )
    $$,
    'a valid supported external video is accepted'
);

SELECT throws_ok(
    $$
        INSERT INTO public.product_media (
            business_id,
            menu_item_id,
            media_type,
            source,
            provider,
            storage_object_path
        )
        VALUES (
            'a0000000-0000-0000-0000-000000000001',
            'bb200000-0000-0000-0000-000000000002',
            'image',
            'storage',
            'supabase',
            'cross-tenant.webp'
        )
    $$,
    '23503',
    NULL,
    'the composite foreign key rejects a cross-tenant item association'
);

SELECT throws_ok(
    $$
        INSERT INTO public.product_media (
            business_id,
            menu_item_id,
            media_type,
            source,
            provider,
            status,
            external_provider,
            external_video_id
        )
        VALUES (
            'a0000000-0000-0000-0000-000000000001',
            'aa100000-0000-0000-0000-000000000001',
            'video',
            'external',
            'youtube',
            'ready',
            'vimeo',
            'provider-mismatch'
        )
    $$,
    '23514',
    NULL,
    'external provider columns cannot disagree'
);

SELECT throws_ok(
    $$
        INSERT INTO public.product_media (
            business_id,
            menu_item_id,
            media_type,
            source,
            provider,
            status,
            mux_asset_id,
            mux_playback_id,
            duration_seconds
        )
        VALUES (
            'a0000000-0000-0000-0000-000000000001',
            'aa100000-0000-0000-0000-000000000001',
            'video',
            'mux',
            'mux',
            'ready',
            'asset-too-long',
            'playback-too-long',
            15.001
        )
    $$,
    '23514',
    NULL,
    'a Mux video over 15 seconds cannot become ready'
);

SELECT throws_ok(
    $$
        INSERT INTO public.product_media (
            business_id,
            menu_item_id,
            media_type,
            source,
            provider,
            status,
            is_published
        )
        VALUES (
            'a0000000-0000-0000-0000-000000000001',
            'aa100000-0000-0000-0000-000000000001',
            'video',
            'mux',
            'mux',
            'waiting',
            TRUE
        )
    $$,
    '23514',
    NULL,
    'non-ready media cannot be published'
);

SELECT throws_ok(
    $$
        INSERT INTO public.product_media (
            business_id,
            menu_item_id,
            media_type,
            source,
            provider,
            status,
            mux_asset_id,
            mux_playback_id,
            duration_seconds
        )
        VALUES (
            'a0000000-0000-0000-0000-000000000001',
            'aa100000-0000-0000-0000-000000000001',
            'video',
            'mux',
            'mux',
            'ready',
            'asset-a-1',
            'another-playback-id',
            5
        )
    $$,
    '23505',
    NULL,
    'Mux asset IDs are unique'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
    'request.jwt.claims',
    '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
    TRUE
);

SELECT results_eq(
    $$ SELECT COUNT(*) FROM public.product_media $$,
    $$ VALUES (3::bigint) $$,
    'owner A can select only its own media'
);

SELECT results_eq(
    $$
        SELECT COUNT(*)
        FROM public.product_media
        WHERE id = 'b2200000-0000-0000-0000-000000000002'
    $$,
    $$ VALUES (0::bigint) $$,
    'owner A cannot discover owner B media'
);

SELECT throws_ok(
    $$
        INSERT INTO public.product_media (
            business_id,
            menu_item_id,
            media_type,
            source,
            provider,
            storage_object_path
        )
        VALUES (
            'a0000000-0000-0000-0000-000000000001',
            'aa100000-0000-0000-0000-000000000001',
            'image',
            'storage',
            'supabase',
            'client-write-must-fail.webp'
        )
    $$,
    '42501',
    NULL,
    'authenticated owners cannot bypass the BFF to insert media'
);

SELECT throws_ok(
    $$
        INSERT INTO public.product_media (
            business_id,
            menu_item_id,
            media_type,
            source,
            provider,
            storage_object_path
        )
        VALUES (
            'b0000000-0000-0000-0000-000000000002',
            'bb200000-0000-0000-0000-000000000002',
            'image',
            'storage',
            'supabase',
            'owner-a-writing-business-b.webp'
        )
    $$,
    '42501',
    NULL,
    'owner A cannot insert media for owner B'
);

SELECT throws_ok(
    $$
        UPDATE public.product_media
        SET position = 50
        WHERE id = 'a1100000-0000-0000-0000-000000000001'
    $$,
    '42501',
    NULL,
    'authenticated owners cannot bypass the BFF to update media'
);

SELECT throws_ok(
    $$
        UPDATE public.product_media
        SET position = 50
        WHERE id = 'b2200000-0000-0000-0000-000000000002'
    $$,
    '42501',
    NULL,
    'owner A cannot update owner B media'
);

SELECT throws_ok(
    $$
        DELETE FROM public.product_media
        WHERE id = 'a1100000-0000-0000-0000-000000000001'
    $$,
    '42501',
    NULL,
    'authenticated owners cannot bypass provider-aware deletion in the BFF'
);

SELECT throws_ok(
    $$
        DELETE FROM public.product_media
        WHERE id = 'b2200000-0000-0000-0000-000000000002'
    $$,
    '42501',
    NULL,
    'owner A cannot delete owner B media'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config(
    'request.jwt.claims',
    '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}',
    TRUE
);

SELECT results_eq(
    $$ SELECT COUNT(*) FROM public.product_media $$,
    $$ VALUES (1::bigint) $$,
    'owner B can select only its own media'
);

SELECT results_eq(
    $$
        SELECT COUNT(*)
        FROM public.product_media
        WHERE id = 'a1100000-0000-0000-0000-000000000001'
    $$,
    $$ VALUES (0::bigint) $$,
    'owner B cannot discover owner A media'
);

RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', TRUE);

SELECT throws_ok(
    $$ SELECT COUNT(*) FROM public.product_media $$,
    '42501',
    NULL,
    'anonymous clients have no direct table access'
);

SELECT throws_ok(
    $$
        INSERT INTO public.product_media (
            business_id,
            menu_item_id,
            media_type,
            source,
            provider,
            storage_object_path
        )
        VALUES (
            'a0000000-0000-0000-0000-000000000001',
            'aa100000-0000-0000-0000-000000000001',
            'image',
            'storage',
            'supabase',
            'anonymous-write.webp'
        )
    $$,
    '42501',
    NULL,
    'anonymous clients cannot insert media'
);

SELECT throws_ok(
    $$
        UPDATE public.product_media
        SET position = 99
        WHERE id = 'a1100000-0000-0000-0000-000000000001'
    $$,
    '42501',
    NULL,
    'anonymous clients cannot update media'
);

SELECT throws_ok(
    $$
        DELETE FROM public.product_media
        WHERE id = 'a1100000-0000-0000-0000-000000000001'
    $$,
    '42501',
    NULL,
    'anonymous clients cannot delete media'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
