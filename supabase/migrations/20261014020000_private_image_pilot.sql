BEGIN;
-- Private, staging-only pilot. No existing base64 columns or URLs are rewritten.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('pingo-images-private','pingo-images-private',false,4194304,ARRAY['image/png'])
ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='pingo-images-private' AND NOT public
   AND file_size_limit=4194304 AND allowed_mime_types=ARRAY['image/png']) THEN
   RAISE EXCEPTION 'Private image bucket configuration mismatch';
 END IF;
END $$;
-- Restrictive policy also defeats a pre-existing permissive policy for browser roles.
-- Owner operations go through backend authorization; no client Storage credentials.
CREATE POLICY private_image_backend_only ON storage.objects AS RESTRICTIVE FOR ALL
TO anon,authenticated USING(bucket_id<>'pingo-images-private') WITH CHECK(bucket_id<>'pingo-images-private');

CREATE TABLE public.image_assets (
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 object_path text NOT NULL UNIQUE,
 mime_type text NOT NULL DEFAULT 'image/png' CHECK(mime_type='image/png'),
 size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 4194304),
 width integer NOT NULL CHECK(width BETWEEN 1 AND 2048),
 height integer NOT NULL CHECK(height BETWEEN 1 AND 2048),
 created_at timestamptz NOT NULL DEFAULT now(),
 verified_at timestamptz,
 PRIMARY KEY(business_id,sha256),
 CHECK(width::bigint*height<=4194304),
 CHECK(object_path='businesses/'||business_id::text||'/images/'||sha256||'.png')
);
ALTER TABLE public.image_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_assets FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.image_assets FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.image_assets TO authenticated;
GRANT ALL ON public.image_assets TO service_role;
CREATE POLICY image_asset_owner_read ON public.image_assets FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.businesses b WHERE b.id=business_id AND b.owner_user_id=auth.uid())
 AND public.business_is_account_active(business_id) AND public.business_is_commercially_eligible(business_id));
COMMENT ON TABLE public.image_assets IS 'Private staging pilot only. Old images retained. Publication, purge integration and backfill cutover required before production.';
COMMIT;
