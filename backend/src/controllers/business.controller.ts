import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { supabaseAdmin, createUserClient, isSupabaseConfigured } from '../config/supabase';
import { localDb, isDemoMode } from '../config/localDb';

const hexColorSchema = z
  .string()
  .trim()
  .refine(val => !val || /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3}|[A-Fa-f0-9]{8})$/.test(val), 'Cor hexadecimal inválida')
  .optional()
  .nullable();

// Validação estrita contra XSS e sobrecarga de payload
const sanitizeText = (str?: string | null): string => {
  if (!str) return '';
  return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').trim();
};

const updateBusinessSchema = z.object({
  name: z.string().trim().min(1, 'O nome do estabelecimento é obrigatório.').max(100, 'Nome deve ter no máximo 100 caracteres.'),
  slug: z
    .string()
    .trim()
    .min(2, 'Slug deve conter ao menos 2 caracteres.')
    .max(50, 'Slug deve conter no máximo 50 caracteres.')
    .regex(/^[a-z0-9-]+$/, 'Slug inválido. Utilize apenas letras minúsculas, números e hífens.'),
  description: z.string().trim().max(500, 'Descrição não pode ultrapassar 500 caracteres.').optional().nullable(),
  logo_url: z.string().trim().optional().nullable(),
  welcome_bg_type: z.enum(['image', 'color']).default('image'),
  welcome_bg_image: z.string().trim().optional().nullable(),
  welcome_bg_color: hexColorSchema.optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  whatsapp: z.string().trim().max(30).optional().nullable()
});

/**
 * Consulta os dados do estabelecimento do usuário autenticado
 */
export const getBusinessController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Estabelecimento não identificado.',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (isSupabaseConfigured) {
      const client = req.accessToken ? createUserClient(req.accessToken) : supabaseAdmin;
      const { data, error } = await client
        .from('businesses')
        .select('id, owner_user_id, name, slug, description, logo_url, cover_image_url, welcome_bg_type, welcome_bg_image, welcome_bg_color, status, phone, whatsapp, created_at, updated_at')
        .eq('id', businessId)
        .maybeSingle();

      if (error) {
        console.error('[Business Audit]', { event: 'business_query_failed' });
        return res.status(500).json({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Erro ao consultar dados do estabelecimento.',
            timestamp: new Date().toISOString()
          }
        });
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Estabelecimento não encontrado.',
            timestamp: new Date().toISOString()
          }
        });
      }

      return res.status(200).json({
        success: true,
        data
      });
    }

    // Modo Demonstração (localDb)
    if (!isDemoMode()) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Banco de dados não disponível.',
          timestamp: new Date().toISOString()
        }
      });
    }

    const localBiz = localDb.businesses.find(b => b.id === businessId);
    if (!localBiz) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Estabelecimento não encontrado no modo demonstração.',
          timestamp: new Date().toISOString()
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: localBiz
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Atualiza os dados do estabelecimento, incluindo logo, nome, descrição e background da welcome page
 */
export const updateBusinessController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessId;
    const userId = req.userId;

    if (!businessId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Sessão inválida ou estabelecimento não identificado.',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Validação de schema com Zod
    const validated = updateBusinessSchema.parse(req.body);

    const sanitizedName = sanitizeText(validated.name);
    const sanitizedDesc = sanitizeText(validated.description);
    const sanitizedSlug = validated.slug.toLowerCase();

    if (isSupabaseConfigured) {
      const client = req.accessToken ? createUserClient(req.accessToken) : supabaseAdmin;

      // 1. Verificar se o slug já está em uso por outro estabelecimento
      const { data: existingSlug, error: slugErr } = await client
        .from('businesses')
        .select('id')
        .eq('slug', sanitizedSlug)
        .neq('id', businessId)
        .maybeSingle();

      if (slugErr) {
        console.error('[Business Audit]', { event: 'business_slug_check_failed' });
      }

      if (existingSlug) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'SLUG_ALREADY_EXISTS',
            message: 'Este slug de URL pública já está sendo utilizado por outro estabelecimento.',
            timestamp: new Date().toISOString()
          }
        });
      }

      // 2. Atualizar dados no Supabase
      const updatePayload: any = {
        name: sanitizedName,
        slug: sanitizedSlug,
        description: sanitizedDesc || null,
        logo_url: validated.logo_url || null,
        cover_image_url: validated.welcome_bg_type === 'image' && validated.welcome_bg_image ? validated.welcome_bg_image : undefined,
        welcome_bg_type: validated.welcome_bg_type,
        welcome_bg_image: validated.welcome_bg_image || null,
        welcome_bg_color: validated.welcome_bg_color || '#0F0F12',
        phone: validated.phone || null,
        whatsapp: validated.whatsapp || null,
        updated_at: new Date().toISOString()
      };

      let query = client
        .from('businesses')
        .update(updatePayload)
        .eq('id', businessId);

      // Controle de integridade anti-IDOR adicional se houver userId identificado
      if (userId) {
        query = query.eq('owner_user_id', userId);
      }

      const { data: updated, error: updateErr } = await query.select().maybeSingle();

      if (updateErr) {
        console.error('[Business Audit]', { event: 'business_update_failed' });
        return res.status(500).json({
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: 'Falha ao salvar as informações da empresa.',
            timestamp: new Date().toISOString()
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: updated || { id: businessId, ...updatePayload }
      });
    }

    // Modo Demonstração (localDb)
    if (!isDemoMode()) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Banco de dados não configurado.',
          timestamp: new Date().toISOString()
        }
      });
    }

    const bizIndex = localDb.businesses.findIndex(b => b.id === businessId);
    if (bizIndex === -1) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Estabelecimento não encontrado no banco local.',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Verificar slug em memória
    const slugConflict = localDb.businesses.find(b => b.slug === sanitizedSlug && b.id !== businessId);
    if (slugConflict) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'SLUG_ALREADY_EXISTS',
          message: 'Este slug de URL pública já está sendo utilizado por outro estabelecimento.',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Atualiza o objeto no banco local
    const current = localDb.businesses[bizIndex];
    const updatedBiz = {
      ...current,
      name: sanitizedName,
      slug: sanitizedSlug,
      description: sanitizedDesc || null,
      logo_url: validated.logo_url ?? current.logo_url,
      cover_image_url: validated.welcome_bg_type === 'image' && validated.welcome_bg_image ? validated.welcome_bg_image : current.cover_image_url,
      welcome_bg_type: validated.welcome_bg_type,
      welcome_bg_image: validated.welcome_bg_image ?? current.welcome_bg_image,
      welcome_bg_color: validated.welcome_bg_color ?? current.welcome_bg_color ?? '#0F0F12',
      phone: validated.phone ?? current.phone,
      whatsapp: validated.whatsapp ?? current.whatsapp
    };

    localDb.businesses[bizIndex] = updatedBiz;

    return res.status(200).json({
      success: true,
      data: updatedBiz
    });
  } catch (error) {
    next(error);
  }
};
