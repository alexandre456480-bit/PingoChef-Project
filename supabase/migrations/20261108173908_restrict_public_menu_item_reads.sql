-- Public catalogue reads must not reveal unavailable products or hidden categories.
-- Preserve owner access and all rows/selections; owner management requires authentication.
BEGIN;
-- An anonymous SELECT must not evaluate the private active-account helper in
-- owner-only policies (including the category lookup below).
ALTER POLICY "Dono pode gerenciar itens de conta ativa" ON public.menu_items TO authenticated;
ALTER POLICY "Dono pode gerenciar categorias de conta ativa" ON public.categories TO authenticated;
ALTER POLICY "Leitura pública de itens elegíveis" ON public.menu_items
 USING (
  is_available AND public.business_is_publicly_eligible(business_id)
  AND EXISTS (
   SELECT 1 FROM public.categories c
   WHERE c.id=menu_items.category_id AND c.business_id=menu_items.business_id AND c.is_active
  )
 );
NOTIFY pgrst,'reload schema';
COMMIT;
