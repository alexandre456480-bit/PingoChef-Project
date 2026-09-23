-- -------------------------------------------------------------
-- 🗄️ Atualização do Esquema de Estabelecimentos (Supabase)
-- Adiciona suporte a Descrição, Background do Welcome (Imagem ou Cor)
-- -------------------------------------------------------------

ALTER TABLE IF EXISTS public.businesses
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS welcome_bg_type TEXT NOT NULL DEFAULT 'image' CHECK (welcome_bg_type IN ('image', 'color')),
    ADD COLUMN IF NOT EXISTS welcome_bg_image TEXT,
    ADD COLUMN IF NOT EXISTS welcome_bg_color TEXT DEFAULT '#0F0F12';

-- Comentários explicativos para documentação de schema
COMMENT ON COLUMN public.businesses.description IS 'Descrição opcional do estabelecimento exibida na tela de Welcome e apresentação';
COMMENT ON COLUMN public.businesses.welcome_bg_type IS 'Define o tipo de background da página de boas-vindas: "image" para imagem ou "color" para cor sólida';
COMMENT ON COLUMN public.businesses.welcome_bg_image IS 'URL ou base64 da imagem de fundo da tela de boas-vindas';
COMMENT ON COLUMN public.businesses.welcome_bg_color IS 'Código hexadecimal da cor sólida de fundo da tela de boas-vindas quando welcome_bg_type for "color"';
