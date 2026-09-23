-- -------------------------------------------------------------
-- 🗄️ Atualização do Esquema de Design Settings (Supabase)
-- -------------------------------------------------------------

ALTER TABLE IF EXISTS public.design_settings
    ADD COLUMN IF NOT EXISTS template_key TEXT NOT NULL DEFAULT 'modern',
    ADD COLUMN IF NOT EXISTS palette JSONB NOT NULL DEFAULT '{
        "key": "gourmet_royal",
        "name": "Gourmet Royal",
        "colors": {
            "primary": "#8B1A3A",
            "secondary": "#D26E2D",
            "accent": "#F47B20",
            "background": "#FAF5F0",
            "surface": "#FFFFFF",
            "textPrimary": "#2D1822",
            "textSecondary": "#6E5D65"
        }
    }'::jsonb,
    ADD COLUMN IF NOT EXISTS font_heading TEXT NOT NULL DEFAULT 'Outfit',
    ADD COLUMN IF NOT EXISTS font_body TEXT NOT NULL DEFAULT 'Inter',
    ADD COLUMN IF NOT EXISTS font_pair TEXT NOT NULL DEFAULT 'modern_clean',
    ADD COLUMN IF NOT EXISTS category_style TEXT NOT NULL DEFAULT 'icon_name',
    ADD COLUMN IF NOT EXISTS motion TEXT NOT NULL DEFAULT 'fade',
    ADD COLUMN IF NOT EXISTS home_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS custom_config JSONB NOT NULL DEFAULT '{}'::jsonb;
