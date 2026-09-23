-- -------------------------------------------------------------
-- 🗄️ Esquema Inicial PostgreSQL e Políticas RLS (Supabase)
-- -------------------------------------------------------------

-- Habilitar extensão pgcrypto para geração de UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabela de Perfil do Usuário Gestor (Vincular com auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela de Estabelecimentos (Tenants)
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    phone TEXT,
    whatsapp TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING_ACTIVATION' CHECK (status IN ('PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED', 'CANCELLED')),
    logo_url TEXT,
    banner_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela de Tokens de Ativação Autônoma
CREATE TABLE IF NOT EXISTS public.activation_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabela de Categorias do Cardápio
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Tabela de Produtos (Itens do Cardápio)
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    promotional_price NUMERIC(10,2) CHECK (promotional_price IS NULL OR promotional_price < price),
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    is_highlighted BOOLEAN NOT NULL DEFAULT FALSE,
    likes_count INT NOT NULL DEFAULT 0,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Tabela de Configurações Visuais e Design
CREATE TABLE IF NOT EXISTS public.design_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
    template_id TEXT NOT NULL DEFAULT 'tmpl_modern_dark',
    primary_color TEXT NOT NULL DEFAULT '#FF5722',
    secondary_color TEXT NOT NULL DEFAULT '#1A1A1A',
    background_color TEXT NOT NULL DEFAULT '#0F0F0F',
    font_family TEXT NOT NULL DEFAULT 'Inter',
    border_radius TEXT NOT NULL DEFAULT 'MD',
    show_welcome_modal BOOLEAN NOT NULL DEFAULT TRUE,
    welcome_title TEXT DEFAULT 'Seja bem-vindo!',
    welcome_message TEXT DEFAULT 'Escolha seus produtos favoritos.',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------
-- 🛡️ ATIVAÇÃO E CONFIGURAÇÃO DE ROW LEVEL SECURITY (RLS)
-- -------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_settings ENABLE ROW LEVEL SECURITY;

-- Politicas RLS para Profiles
CREATE POLICY "Usuários podem ver e editar seu próprio perfil"
ON public.profiles FOR ALL
USING (auth.uid() = id);

-- Politicas RLS para Businesses
CREATE POLICY "Dono pode gerenciar seu estabelecimento"
ON public.businesses FOR ALL
USING (auth.uid() = owner_user_id);

CREATE POLICY "Leitura pública de estabelecimentos ativos"
ON public.businesses FOR SELECT
USING (status = 'ACTIVE');

-- Politicas RLS para Categories
CREATE POLICY "Dono pode gerenciar suas categorias"
ON public.categories FOR ALL
USING (
    business_id IN (
        SELECT id FROM public.businesses WHERE owner_user_id = auth.uid()
    )
);

CREATE POLICY "Leitura pública de categorias ativas"
ON public.categories FOR SELECT
USING (
    is_active = TRUE AND
    business_id IN (
        SELECT id FROM public.businesses WHERE status = 'ACTIVE'
    )
);

-- Politicas RLS para Menu Items
CREATE POLICY "Dono pode gerenciar seus itens"
ON public.menu_items FOR ALL
USING (
    business_id IN (
        SELECT id FROM public.businesses WHERE owner_user_id = auth.uid()
    )
);

CREATE POLICY "Leitura pública de itens de estabelecimentos ativos"
ON public.menu_items FOR SELECT
USING (
    business_id IN (
        SELECT id FROM public.businesses WHERE status = 'ACTIVE'
    )
);

-- Politicas RLS para Design Settings
CREATE POLICY "Dono pode gerenciar seu design"
ON public.design_settings FOR ALL
USING (
    business_id IN (
        SELECT id FROM public.businesses WHERE owner_user_id = auth.uid()
    )
);

CREATE POLICY "Leitura pública de design settings"
ON public.design_settings FOR SELECT
USING (
    business_id IN (
        SELECT id FROM public.businesses WHERE status = 'ACTIVE'
    )
);
