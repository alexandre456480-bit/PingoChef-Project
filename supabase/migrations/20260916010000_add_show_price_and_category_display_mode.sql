-- ============================================================================
-- 🛡️ MIGRATION: ADD SHOW_PRICE & CATEGORY DISPLAY_MODE
-- Arquivo: 20260916010000_add_show_price_and_category_display_mode.sql
-- ============================================================================

-- 1. Adicionar show_price na tabela menu_items
ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS show_price BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Adicionar display_mode na tabela categories
-- Valores permitidos: 'icon_only', 'icon_text_side', 'icon_text_stacked'
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS display_mode TEXT NOT NULL DEFAULT 'icon_text_side';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'categories_display_mode_check'
    ) THEN
        ALTER TABLE public.categories
            ADD CONSTRAINT categories_display_mode_check 
            CHECK (display_mode IN ('icon_only', 'icon_text_side', 'icon_text_stacked'));
    END IF;
END $$;

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_menu_items_show_price ON public.menu_items(business_id, show_price);
CREATE INDEX IF NOT EXISTS idx_categories_display_mode ON public.categories(business_id, display_mode);
