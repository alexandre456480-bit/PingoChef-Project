-- -------------------------------------------------------------
-- 🗄️ Migration: Adicionar Destaques 'combo' e 'best_seller'
-- -------------------------------------------------------------

-- Atualizar restrição check na coluna highlight_type da tabela menu_items
ALTER TABLE public.menu_items
    DROP CONSTRAINT IF EXISTS menu_items_highlight_type_check;

ALTER TABLE public.menu_items
    ADD CONSTRAINT menu_items_highlight_type_check
    CHECK (highlight_type IN ('none', 'promotion', 'most_liked', 'chef', 'combo', 'best_seller'));

-- Garantir que a coluna custom_config exista e suporte enable_likes e enable_cart
ALTER TABLE public.design_settings
    ADD COLUMN IF NOT EXISTS custom_config JSONB NOT NULL DEFAULT '{"welcome_tagline":"Experiência gastronômica artesanal e inesquecível","enable_likes":true,"enable_cart":true}'::jsonb;

