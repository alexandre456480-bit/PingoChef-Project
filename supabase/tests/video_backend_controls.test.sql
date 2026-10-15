-- Run with `supabase test db` against a disposable database after all
-- migrations have been applied. The whole fixture is rolled back.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(27);

SELECT has_table('public', 'video_upload_attempts', 'upload attempts table exists');
SELECT has_table('public', 'mux_webhook_events', 'webhook idempotency table exists');
SELECT has_column('public', 'product_media', 'declared_file_size_bytes', 'declared size exists');
SELECT has_column('public', 'product_media', 'upload_expires_at', 'upload expiry exists');
SELECT has_column('public', 'product_media', 'aspect_ratio', 'video aspect ratio exists');
SELECT has_column('public', 'product_media', 'replaces_media_id', 'replacement relation exists');
SELECT has_index('public', 'product_media', 'product_media_one_ready_video_per_item_uidx', 'one ready video index exists');
SELECT has_index('public', 'product_media', 'product_media_one_pending_video_per_item_uidx', 'one pending video index exists');

INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
)
VALUES
    (
        '31000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'video-owner-a@example.test', '', NOW(),
        '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), '', '', '', ''
    ),
    (
        '32000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'video-owner-b@example.test', '', NOW(),
        '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), '', '', '', ''
    );

INSERT INTO public.profiles (id, full_name)
VALUES
    ('31000000-0000-0000-0000-000000000001', 'Video Owner A'),
    ('32000000-0000-0000-0000-000000000002', 'Video Owner B');

INSERT INTO public.businesses (id, owner_user_id, name, slug, status)
VALUES
    (
        'c1000000-0000-0000-0000-000000000001',
        '31000000-0000-0000-0000-000000000001',
        'Video Business A', 'video-business-a-test', 'ACTIVE'
    ),
    (
        'c2000000-0000-0000-0000-000000000002',
        '32000000-0000-0000-0000-000000000002',
        'Video Business B', 'video-business-b-test', 'ACTIVE'
    );

INSERT INTO public.categories (id, business_id, name)
VALUES
    (
        'c1100000-0000-0000-0000-000000000001',
        'c1000000-0000-0000-0000-000000000001',
        'Video Category A'
    ),
    (
        'c2200000-0000-0000-0000-000000000002',
        'c2000000-0000-0000-0000-000000000002',
        'Video Category B'
    );

INSERT INTO public.menu_items (id, business_id, category_id, name, price)
VALUES
    (
        'c1110000-0000-0000-0000-000000000001',
        'c1000000-0000-0000-0000-000000000001',
        'c1100000-0000-0000-0000-000000000001',
        'Video Item A', 10
    ),
    (
        'c2220000-0000-0000-0000-000000000002',
        'c2000000-0000-0000-0000-000000000002',
        'c2200000-0000-0000-0000-000000000002',
        'Video Item B', 10
    );

SELECT results_eq(
    $$
        SELECT denial_code
        FROM public.reserve_video_upload(
            'c1000000-0000-0000-0000-000000000001',
            '31000000-0000-0000-0000-000000000001',
            'c1110000-0000-0000-0000-000000000001',
            repeat('a', 64),
            52428800,
            'video/mp4',
            20, 3, 5, 900
        )
    $$,
    $$ VALUES (NULL::text) $$,
    'a valid 50 MB reservation is accepted'
);

SELECT results_eq(
    $$ SELECT COUNT(*) FROM public.video_upload_attempts $$,
    $$ VALUES (1::bigint) $$,
    'a successful reservation writes one audit attempt'
);

SELECT results_eq(
    $$ SELECT MAX(declared_file_size_bytes) FROM public.product_media $$,
    $$ VALUES (52428800::bigint) $$,
    'the declared byte size is retained'
);

SELECT results_eq(
    $$ SELECT aspect_ratio FROM public.product_media LIMIT 1 $$,
    $$ VALUES ('16:9'::text) $$,
    'legacy RPC callers receive the safe horizontal default'
);

SELECT ok(
    public.attach_mux_upload_to_media(
        'c1000000-0000-0000-0000-000000000001',
        (SELECT media_id FROM public.video_upload_attempts LIMIT 1),
        'mux-upload-test-1',
        NOW() + INTERVAL '15 minutes'
    ),
    'the Mux upload id attaches atomically'
);

SELECT results_eq(
    $$ SELECT outcome FROM public.video_upload_attempts $$,
    $$ VALUES ('provider_created'::text) $$,
    'the attached reservation becomes provider_created'
);

SELECT results_eq(
    $$
        SELECT denial_code
        FROM public.reserve_video_upload(
            'c1000000-0000-0000-0000-000000000001',
            '31000000-0000-0000-0000-000000000001',
            'c1110000-0000-0000-0000-000000000001',
            repeat('b', 64),
            52428801,
            'video/mp4',
            20, 3, 5, 900
        )
    $$,
    $$ VALUES ('INVALID_UPLOAD_METADATA'::text) $$,
    'a declaration above 50 MB is rejected in the database'
);

SELECT results_eq(
    $$
        SELECT denial_code
        FROM public.reserve_video_upload(
            'c1000000-0000-0000-0000-000000000001',
            '31000000-0000-0000-0000-000000000001',
            'c2220000-0000-0000-0000-000000000002',
            repeat('c', 64),
            1024,
            'video/mp4',
            20, 3, 5, 900
        )
    $$,
    $$ VALUES ('PRODUCT_NOT_FOUND'::text) $$,
    'cross-tenant product reservation is rejected'
);

SELECT results_eq(
    $$
        SELECT denial_code
        FROM public.reserve_video_upload(
            'c1000000-0000-0000-0000-000000000001',
            '31000000-0000-0000-0000-000000000001',
            'c1110000-0000-0000-0000-000000000001',
            repeat('a', 64),
            1024,
            'video/mp4',
            20, 10, 1, 900
        )
    $$,
    $$ VALUES ('USER_UPLOAD_RATE_LIMITED'::text) $$,
    'the database rate limit cannot be raced around by the same user'
);

SELECT ok(
    public.claim_mux_webhook_event(
        'event-test-1', 'video.asset.ready', 'asset-test-1', 300
    ),
    'the first webhook delivery is claimed'
);

SELECT is(
    public.claim_mux_webhook_event(
        'event-test-1', 'video.asset.ready', 'asset-test-1', 300
    ),
    FALSE,
    'a concurrent or repeated delivery is not claimed twice'
);

SELECT lives_ok(
    $$ SELECT public.finish_mux_webhook_event('event-test-1', 'processed', NULL) $$,
    'a claimed webhook can be completed'
);

SELECT results_eq(
    $$ SELECT status FROM public.mux_webhook_events WHERE event_id = 'event-test-1' $$,
    $$ VALUES ('processed'::text) $$,
    'the terminal webhook state is durable'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
    'request.jwt.claims',
    '{"sub":"31000000-0000-0000-0000-000000000001","role":"authenticated"}',
    TRUE
);

SELECT throws_ok(
    $$ SELECT COUNT(*) FROM public.video_upload_attempts $$,
    '42501', NULL,
    'authenticated clients cannot read upload attempt controls'
);

SELECT throws_ok(
    $$ SELECT COUNT(*) FROM public.mux_webhook_events $$,
    '42501', NULL,
    'authenticated clients cannot read webhook idempotency controls'
);

SELECT throws_ok(
    $$
        SELECT * FROM public.reserve_video_upload(
            'c1000000-0000-0000-0000-000000000001',
            '31000000-0000-0000-0000-000000000001',
            'c1110000-0000-0000-0000-000000000001',
            repeat('d', 64), 1024, 'video/mp4', 20, 3, 5, 900
        )
    $$,
    '42501', NULL,
    'authenticated clients cannot invoke the privileged reservation RPC'
);

RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', TRUE);

SELECT throws_ok(
    $$ SELECT COUNT(*) FROM public.video_upload_attempts $$,
    '42501', NULL,
    'anonymous clients cannot read upload attempt controls'
);

SELECT throws_ok(
    $$ SELECT COUNT(*) FROM public.mux_webhook_events $$,
    '42501', NULL,
    'anonymous clients cannot read webhook idempotency controls'
);

SELECT throws_ok(
    $$ SELECT public.claim_mux_webhook_event('forbidden', 'video.asset.ready', NULL, 300) $$,
    '42501', NULL,
    'anonymous clients cannot invoke webhook control RPCs'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
