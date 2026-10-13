-- Read-only: identifies shared trigger functions that can block business creation.
SELECT c.relname AS table_name,t.tgname AS trigger_name,p.proname AS function_name,
 pg_get_functiondef(p.oid) AS function_definition
FROM pg_trigger t
JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_proc p ON p.oid=t.tgfoid
WHERE NOT t.tgisinternal AND n.nspname='public'
 AND c.relname IN ('businesses','subscriptions')
 AND pg_get_functiondef(p.oid) ILIKE '%OLD.business_id%'
ORDER BY c.relname,t.tgname;
