-- ============================================================================
-- 🛡️ MIGRATION: SECURITY HARDENING, RLS ENFORCEMENT & ATOMIC OPERATIONS
-- Arquivo: 20260912000000_security_hardening.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. QUERIES DIAGNÓSTICAS (Auditoria de inconsistências e Cross-Tenant data)
-- ----------------------------------------------------------------------------
-- Observação: Estas queries são diagnósticas para identificar inconsistências antes da aplicação.
-- SELECT mi.id, mi.business_id AS item_biz, c.business_id AS cat_biz
-- FROM public.menu_items mi
-- JOIN public.categories c ON c.id = mi.category_id
-- WHERE mi.business_id <> c.business_id;

-- ----------------------------------------------------------------------------
-- 2. INTEGRIDADE DE DADOS E CONSTRAINTS DE SEGURANÇA
-- ----------------------------------------------------------------------------

-- Garantir que likes_count nunca seja negativo
DO $$
BEGIN
    -- Corrigir eventuais valores negativos pré-existentes
    UPDATE public.menu_items SET likes_count = 0 WHERE likes_count < 0;

    -- Adicionar restrição check se não existir
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'menu_items_likes_count_check'
    ) THEN
        ALTER TABLE public.menu_items
            ADD CONSTRAINT menu_items_likes_count_check CHECK (likes_count >= 0);
    END IF;
END $$;

-- Garantir índice de performance e integridade para tokens de ativação
CREATE INDEX IF NOT EXISTS idx_activation_tokens_lookup 
ON public.activation_tokens(token, is_used, expires_at);

-- ----------------------------------------------------------------------------
-- 3. TABELA DE AUDITORIA DE LIKES ANÔNIMOS (Anti-Abuso / Rate-Limit no Banco)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.anonymous_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    ip_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anonymous_likes_anti_abuse 
ON public.anonymous_likes(item_id, ip_hash, created_at);

ALTER TABLE public.anonymous_likes ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 4. FUNÇÃO RPC ATÔMICA: INCREMENT_LIKES
-- Previne Race Conditions e manipulações concorrentes de curtidas
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_likes(
    p_item_id UUID,
    p_business_id UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_likes INT;
BEGIN
    UPDATE public.menu_items
    SET likes_count = GREATEST(COALESCE(likes_count, 0) + 1, 0),
        updated_at = NOW()
    WHERE id = p_item_id
      AND business_id = p_business_id
      AND is_available = TRUE
    RETURNING likes_count INTO v_new_likes;

    IF v_new_likes IS NULL THEN
        RAISE EXCEPTION 'Item not found or unavailable for liking';
    END IF;

    RETURN v_new_likes;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. BLINDAGEM DE POLÍTICAS RLS COM "WITH CHECK"
-- Evita que usuários autenticados criem/atualizem registros pertencentes a outros tenants
-- ----------------------------------------------------------------------------

-- A) CATEGORIES
DROP POLICY IF EXISTS "Dono pode gerenciar suas categorias" ON public.categories;
CREATE POLICY "Dono pode gerenciar suas categorias"
ON public.categories FOR ALL
USING (
    business_id IN (
        SELECT id FROM public.businesses WHERE owner_user_id = auth.uid()
    )
)
WITH CHECK (
    business_id IN (
        SELECT id FROM public.businesses WHERE owner_user_id = auth.uid()
    )
);

-- B) SUBCATEGORIES
DROP POLICY IF EXISTS "Dono pode gerenciar suas subcategorias" ON public.subcategories;
CREATE POLICY "Dono pode gerenciar suas subcategorias"
ON public.subcategories FOR ALL
USING (
    business_id IN (
        SELECT id FROM public.businesses WHERE owner_user_id = auth.uid()
    )
)
WITH CHECK (
    business_id IN (
        SELECT id FROM public.businesses WHERE owner_user_id = auth.uid()
    )
);

-- C) MENU ITEMS
DROP POLICY IF EXISTS "Dono pode gerenciar seus itens" ON public.menu_items;
CREATE POLICY "Dono pode gerenciar seus itens"
ON public.menu_items FOR ALL
USING (
    business_id IN (
        SELECT id FROM public.businesses WHERE owner_user_id = auth.uid()
    )
)
WITH CHECK (
    business_id IN (
        SELECT id FROM public.businesses WHERE owner_user_id = auth.uid()
    )
);

-- D) DESIGN SETTINGS
DROP POLICY IF EXISTS "Dono pode gerenciar seu design" ON public.design_settings;
CREATE POLICY "Dono pode gerenciar seu design"
ON public.design_settings FOR ALL
USING (
    business_id IN (
        SELECT id FROM public.businesses WHERE owner_user_id = auth.uid()
    )
)
WITH CHECK (
    business_id IN (
        SELECT id FROM public.businesses WHERE owner_user_id = auth.uid()
    )
);

-- E) ACTIVATION TOKENS
-- Restringir para que tokens nunca sejam lidos publicamente por clientes anônimos
DROP POLICY IF EXISTS "Apenas admins podem gerenciar tokens" ON public.activation_tokens;
CREATE POLICY "Apenas donos do estabelecimento podem visualizar seus tokens"
ON public.activation_tokens FOR SELECT
USING (
    business_id IN (
        SELECT id FROM public.businesses WHERE owner_user_id = auth.uid()
    )
);

-- ============================================================================
-- FIM DA MIGRATION DE HARDENING
-- ============================================================================
