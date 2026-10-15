-- Execute como leitura antes da migration. Resolva duplicatas manualmente.
SELECT owner_user_id, count(*) AS business_count, array_agg(id ORDER BY created_at, id) AS business_ids
FROM public.businesses
GROUP BY owner_user_id HAVING count(*) > 1;

SELECT status, count(*) AS businesses FROM public.businesses GROUP BY status ORDER BY status;

SELECT count(*) AS unused_unexpired_legacy_tokens
FROM public.activation_tokens WHERE NOT is_used AND expires_at > now();

SELECT b.id, b.owner_user_id, b.status
FROM public.businesses b LEFT JOIN public.profiles p ON p.id = b.owner_user_id
WHERE p.id IS NULL;
