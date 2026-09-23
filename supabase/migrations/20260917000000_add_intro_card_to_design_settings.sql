-- -------------------------------------------------------------
-- 🗄️ Suporte a Card de Apresentação / Descrição Inicial no Design
-- -------------------------------------------------------------

-- O objeto intro_card é armazenado dentro do campo custom_config (JSONB),
-- contendo:
--   "intro_card": {
--     "enabled": true,
--     "title": "Texto do Título",
--     "description": "Texto da Descrição"
--   }

COMMENT ON COLUMN public.design_settings.custom_config IS 'Configurações adicionais de customização visual (intro_card, hero_banners, welcome_tagline, enable_likes, enable_cart)';
