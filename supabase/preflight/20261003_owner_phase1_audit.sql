-- Read-only preflight. Run before the two owner phase 1 migrations.
-- Counts only: no emails, credentials or tenant identifiers in the output.
SELECT 'duplicate_business_owners' check_name,count(*) count FROM
 (SELECT owner_user_id FROM public.businesses GROUP BY owner_user_id HAVING count(*)>1) x
UNION ALL
SELECT 'owners_without_auth_identity',count(*) FROM public.businesses b LEFT JOIN auth.users u ON u.id=b.owner_user_id WHERE u.id IS NULL
UNION ALL
SELECT 'business_owners_with_unconfirmed_email',count(*) FROM public.businesses b JOIN auth.users u ON u.id=b.owner_user_id WHERE u.email_confirmed_at IS NULL
UNION ALL
SELECT 'businesses_without_subscription',count(*) FROM public.businesses b WHERE NOT EXISTS(SELECT 1 FROM public.subscriptions WHERE business_id=b.id)
UNION ALL
SELECT 'provider_subscriptions_without_plan',count(*) FROM public.subscriptions WHERE provider IS NOT NULL AND plan_id IS NULL
UNION ALL
SELECT 'cross_tenant_products_categories',count(*) FROM public.menu_items i JOIN public.categories c ON c.id=i.category_id WHERE i.business_id<>c.business_id
UNION ALL
SELECT 'cross_tenant_subcategories_categories',count(*) FROM public.subcategories s JOIN public.categories c ON c.id=s.category_id WHERE s.business_id<>c.business_id
UNION ALL
SELECT 'inconsistent_product_subcategories',count(*) FROM public.menu_items i JOIN public.subcategories s ON s.id=i.subcategory_id WHERE i.business_id<>s.business_id OR i.category_id<>s.category_id
UNION ALL
SELECT 'businesses_above_free_product_limit',count(*) FROM
 (SELECT business_id FROM public.menu_items GROUP BY business_id HAVING count(*)>10) x
UNION ALL
SELECT 'businesses_above_free_category_limit',count(*) FROM
 (SELECT business_id FROM public.categories GROUP BY business_id HAVING count(*)>4) x
UNION ALL
SELECT 'businesses_above_free_video_limit',count(*) FROM
 (SELECT business_id FROM public.product_media WHERE media_type='video' AND status IN ('waiting','uploading','processing','ready')
  GROUP BY business_id HAVING count(DISTINCT menu_item_id)>1) x;
