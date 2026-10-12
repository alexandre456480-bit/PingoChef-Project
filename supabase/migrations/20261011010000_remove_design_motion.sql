-- As animações do cardápio são próprias da interface, sem preferência editável.
-- Publicar a API que ignora o campo legado antes de aplicar esta migração.
ALTER TABLE public.design_settings DROP COLUMN IF EXISTS motion;
