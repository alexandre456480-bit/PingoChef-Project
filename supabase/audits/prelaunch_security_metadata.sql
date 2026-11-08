-- Metadata only: no customer rows, passwords, tokens or stored credentials.
-- Run in the SQL editor or via a project-scoped read-only audit connection.
-- One result set: copy/export every section, including sections containing [].
BEGIN READ ONLY;

-- Tables exposed by the Data API must have the intended RLS and grants.
WITH tables AS (
SELECT n.nspname AS schema_name,c.relname AS table_name,c.relrowsecurity AS rls_enabled,
 c.relforcerowsecurity AS rls_forced,
 has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
 has_table_privilege('anon',c.oid,'INSERT') AS anon_insert,
 has_table_privilege('anon',c.oid,'UPDATE') AS anon_update,
 has_table_privilege('anon',c.oid,'DELETE') AS anon_delete,
 has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_select,
 has_table_privilege('authenticated',c.oid,'INSERT') AS authenticated_insert,
 has_table_privilege('authenticated',c.oid,'UPDATE') AS authenticated_update,
 has_table_privilege('authenticated',c.oid,'DELETE') AS authenticated_delete
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','storage') AND c.relkind IN ('r','p')
ORDER BY n.nspname,c.relname
), policies AS (

-- Policies need human review: true is not inherently wrong for public catalogs.
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname IN ('public','storage')
ORDER BY schemaname,tablename,policyname
), functions AS (

-- SECURITY DEFINER ownership, search_path and caller permissions.
SELECT n.nspname AS schema_name,p.proname AS function_name,
 pg_get_function_identity_arguments(p.oid) AS arguments,
 pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS security_definer,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' ORDER BY p.proname,p.oid
), constraints AS (

-- Foreign keys and CHECK constraints, including tenant relationships.
SELECT conrelid::regclass AS table_name,conname,contype,convalidated,
 pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype IN ('f','c','u')
ORDER BY conrelid::regclass::text,conname
), invalid_indexes AS (

-- Interrupted index builds can leave unavailable or inefficient constraints.
SELECT i.indexrelid::regclass AS index_name,i.indrelid::regclass AS table_name,
 i.indisvalid,i.indisready
FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid
WHERE c.relnamespace='public'::regnamespace AND (NOT i.indisvalid OR NOT i.indisready)
), views AS (
-- View grants/options must be reviewed separately from table RLS.
SELECT n.nspname AS schema_name,c.relname AS view_name,c.relkind,c.reloptions,
 pg_get_userbyid(c.relowner) AS owner,
 has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
 has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_select
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','storage') AND c.relkind IN ('v','m')
ORDER BY n.nspname,c.relname
)
SELECT '01_tables_rls_grants' AS section,coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) AS result FROM tables t
UNION ALL SELECT '02_policies',coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM policies t
UNION ALL SELECT '03_functions',coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM functions t
UNION ALL SELECT '04_constraints',coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM constraints t
UNION ALL SELECT '05_invalid_indexes',coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM invalid_indexes t
UNION ALL SELECT '06_views',coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM views t
ORDER BY section;

COMMIT;
