import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { supabaseAdmin, createUserClient, isSupabaseConfigured } from '../config/supabase';
import { localDb, isDemoMode } from '../config/localDb';

const hexColorSchema = z.string().trim().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3}|[A-Fa-f0-9]{8})$/, 'Cor hexadecimal inválida');
const fontNameSchema = z.string().trim().regex(/^[a-zA-Z0-9\s-]+$/, 'Nome de fonte inválido').max(50);

const introCardSchema = z.object({
  enabled: z.boolean().default(true),
  title: z.string().trim().max(150).default(''),
  description: z.string().trim().max(1200).default('')
}).optional();

const designSchema = z.object({
  template_key: z.enum(['minimal', 'modern', 'premium', 'dark']).default('modern'),
  palette: z.object({
    key: z.string().trim().regex(/^[a-zA-Z0-9_-]+$/),
    name: z.string().trim().max(50),
    isCustom: z.boolean().optional(),
    colors: z.object({
      primary: hexColorSchema,
      secondary: hexColorSchema,
      accent: hexColorSchema,
      background: hexColorSchema,
      surface: hexColorSchema,
      textPrimary: hexColorSchema,
      textSecondary: hexColorSchema
    })
  }),
  font_heading: fontNameSchema.default('Outfit'),
  font_body: fontNameSchema.default('Inter'),
  font_pair: z.string().trim().regex(/^[a-zA-Z0-9_-]+$/).default('modern_clean'),
  category_style: z.enum(['icon', 'name', 'icon_name']).default('icon_name'),
  motion: z.enum(['fade', 'slide', 'scale', 'none']).default('fade'),
  home_blocks: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      label: z.string(),
      enabled: z.boolean(),
      position: z.number(),
      required: z.boolean().optional()
    })
  ).default([]),
  custom_config: z.record(z.unknown()).optional()
});

export const getDesignController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Estabelecimento não identificado.', timestamp: new Date().toISOString() }
      });
    }

    if (isSupabaseConfigured) {
      const client = req.accessToken ? createUserClient(req.accessToken) : supabaseAdmin;
      const { data, error } = await client
        .from('design_settings')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();

      if (error) {
        return res.status(500).json({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Erro ao consultar configurações de design.', timestamp: new Date().toISOString() }
        });
      }

      if (data) {
        const existingBlocks: any[] = Array.isArray(data.home_blocks) ? data.home_blocks : [];
        const existingTypes = new Set(existingBlocks.map(b => b.type));
        
        const defaultBlocks = [
          { id: 'block_hero', type: 'hero', label: 'Hero / Capa', enabled: true, position: 0 },
          { id: 'block_categories', type: 'categories', label: 'Categorias', enabled: true, position: 1 },
          { id: 'block_promotion', type: 'promotion', label: 'Promoções', enabled: true, position: 2 },
          { id: 'block_most_liked', type: 'most_liked', label: 'Mais Curtidos', enabled: true, position: 3 },
          { id: 'block_featured', type: 'featured_product', label: 'Pratos do Chef', enabled: true, position: 4 },
          { id: 'block_combos', type: 'combo', label: 'Combos Especiais', enabled: true, position: 5 },
          { id: 'block_best_sellers', type: 'best_seller', label: 'Mais Vendidos', enabled: true, position: 6 }
        ];

        let mergedBlocks = [...existingBlocks];
        defaultBlocks.forEach(defB => {
          if (!existingTypes.has(defB.type)) {
            mergedBlocks.push({ ...defB, position: mergedBlocks.length });
          }
        });

        return res.status(200).json({
          success: true,
          data: {
            template_key: data.template_key || 'modern',
            palette: data.palette,
            font_heading: data.font_heading || 'Outfit',
            font_body: data.font_body || 'Inter',
            font_pair: data.font_pair || 'modern_clean',
            category_style: data.category_style || 'icon_name',
            motion: data.motion || 'fade',
            home_blocks: mergedBlocks,
            custom_config: data.custom_config || {}
          }
        });
      }
    }

    if (!isDemoMode()) {
      return res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Banco de dados não configurado.', timestamp: new Date().toISOString() }
      });
    }

    const localSettings = localDb.designSettings[businessId] || {
      template_key: 'modern',
      palette: {
        key: 'gourmet_royal',
        name: 'Gourmet Royal',
        colors: {
          primary: '#8B1A3A',
          secondary: '#D26E2D',
          accent: '#F47B20',
          background: '#FAF5F0',
          surface: '#FFFFFF',
          textPrimary: '#2D1822',
          textSecondary: '#6E5D65'
        }
      },
      font_heading: 'Outfit',
      font_body: 'Inter',
      font_pair: 'modern_clean',
      category_style: 'icon_name',
      motion: 'fade',
      home_blocks: [
        { id: 'block_hero', type: 'hero', label: 'Hero / Capa', enabled: true, position: 0 },
        { id: 'block_categories', type: 'categories', label: 'Categorias', enabled: true, position: 1 },
        { id: 'block_promotion', type: 'promotion', label: 'Promoções', enabled: true, position: 2 },
        { id: 'block_most_liked', type: 'most_liked', label: 'Mais Curtidos', enabled: true, position: 3 },
        { id: 'block_featured', type: 'featured_product', label: 'Pratos do Chef', enabled: true, position: 4 },
        { id: 'block_combos', type: 'combo', label: 'Combos Especiais', enabled: true, position: 5 },
        { id: 'block_best_sellers', type: 'best_seller', label: 'Mais Vendidos', enabled: true, position: 6 }
      ],
      custom_config: {
        welcome_tagline: 'Experiência gastronômica artesanal e inesquecível',
        enable_likes: true,
        enable_cart: true,
        intro_card: {
          enabled: true,
          title: 'Gastronomia Autoral & Ingredientes Nobres',
          description: 'Seja muito bem-vindo ao nosso espaço gastronômico! Nossos pratos e burgers são elaborados com carnes nobres grelhadas no fogo e pães artesanais de fermentação natural. Escolha abaixo suas opções favoritas e bom apetite.'
        }
      }
    };

    return res.status(200).json({
      success: true,
      data: localSettings
    });
  } catch (error) {
    next(error);
  }
};

export const saveDesignController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Estabelecimento não identificado.', timestamp: new Date().toISOString() }
      });
    }

    const validatedData = designSchema.parse(req.body);

    // Sanitização e validação de segurança para o bloco de apresentação
    if (validatedData.custom_config && validatedData.custom_config.intro_card) {
      const parsedIntro = introCardSchema.safeParse(validatedData.custom_config.intro_card);
      if (parsedIntro.success && parsedIntro.data) {
        validatedData.custom_config.intro_card = parsedIntro.data;
      }
    }

    if (isSupabaseConfigured) {
      const client = req.accessToken ? createUserClient(req.accessToken) : supabaseAdmin;
      const { error } = await client
        .from('design_settings')
        .upsert({
          business_id: businessId,
          template_key: validatedData.template_key,
          palette: validatedData.palette,
          font_heading: validatedData.font_heading,
          font_body: validatedData.font_body,
          font_pair: validatedData.font_pair,
          category_style: validatedData.category_style,
          motion: validatedData.motion,
          home_blocks: validatedData.home_blocks,
          custom_config: validatedData.custom_config || {},
          updated_at: new Date().toISOString()
        }, { onConflict: 'business_id' });

      if (error) {
        return res.status(500).json({
          success: false,
          error: { code: 'UPSERT_FAILED', message: 'Falha ao salvar configurações de design.', timestamp: new Date().toISOString() }
        });
      }

      return res.status(200).json({
        success: true,
        data: validatedData
      });
    }

    if (!isDemoMode()) {
      return res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Banco de dados não configurado.', timestamp: new Date().toISOString() }
      });
    }

    // Apenas em modo demo atualiza memória
    localDb.designSettings[businessId] = validatedData;

    return res.status(200).json({
      success: true,
      data: validatedData
    });
  } catch (error) {
    next(error);
  }
};

