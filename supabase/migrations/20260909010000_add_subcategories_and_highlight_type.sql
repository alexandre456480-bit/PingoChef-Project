-- -------------------------------------------------------------
-- 🗄️ Migration: Adicionar Subcategorias e Tipo de Destaque
-- -------------------------------------------------------------

-- 1. Criar Tabela de Subcategorias
CREATE TABLE IF NOT EXISTS public.subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_subcategories_biz_cat ON public.subcategories(business_id, category_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_order ON public.subcategories(display_order);

-- 2. Atualizar Tabela de Itens (menu_items)
ALTER TABLE public.menu_items
    ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS highlight_type TEXT NOT NULL DEFAULT 'none' CHECK (highlight_type IN ('none', 'promotion', 'most_liked', 'chef'));

CREATE INDEX IF NOT EXISTS idx_menu_items_subcat ON public.menu_items(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_highlight ON public.menu_items(highlight_type);

-- 3. Habilitar RLS para Subcategorias
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

-- Politica RLS: Dono pode gerenciar suas subcategorias
CREATE POLICY "Dono pode gerenciar suas subcategorias"
ON public.subcategories FOR ALL
USING (
    business_id IN (
        SELECT id FROM public.businesses WHERE owner_user_id = auth.uid()
    )
);

-- Politica RLS: Leitura pública de subcategorias de estabelecimentos ativos
CREATE POLICY "Leitura pública de subcategorias"
ON public.subcategories FOR SELECT
USING (
    business_id IN (
        SELECT id FROM public.businesses WHERE status = 'ACTIVE'
    )
);
