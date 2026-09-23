import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { supabaseAdmin, createUserClient, isSupabaseConfigured } from '../config/supabase';
import { localDb, isDemoMode } from '../config/localDb';

const categorySchema = z.object({
  name: z.string().trim().min(2, 'Nome da categoria deve ter no mínimo 2 caracteres').max(100, 'Nome muito longo'),
  description: z.string().trim().max(500).optional().nullable(),
  icon: z.string().optional().nullable(),
  iconType: z.enum(['2d', '3d', 'image', 'none']).default('2d'),
  iconKey: z.string().trim().max(100).optional().nullable(),
  imageUrl: z.string().trim().optional().nullable(),
  displayMode: z.enum(['icon_only', 'icon_text_side', 'icon_text_stacked']).default('icon_text_side'),
  isActive: z.boolean().default(true)
});

const reorderSchema = z.object({
  orders: z.array(z.object({
    id: z.string(),
    displayOrder: z.number().int()
  })).max(200, 'Máximo de 200 itens por reordenação')
});

export const getCategoriesController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
        .from('categories')
        .select('*')
        .eq('business_id', businessId)
        .order('display_order', { ascending: true });

      if (error) {
        return res.status(500).json({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Erro ao buscar categorias.', timestamp: new Date().toISOString() }
        });
      }

      return res.status(200).json({
        success: true,
        data: (data || []).map(cat => ({
          id: cat.id,
          name: cat.name,
          description: cat.description,
          icon: cat.icon_key || cat.icon,
          iconType: cat.icon_type || (cat.icon ? '2d' : 'none'),
          iconKey: cat.icon_key || cat.icon || null,
          imageUrl: cat.image_url || null,
          displayMode: cat.display_mode || 'icon_text_side',
          displayOrder: cat.display_order,
          isActive: cat.is_active,
          createdAt: cat.created_at
        }))
      });
    }

    if (!isDemoMode()) {
      return res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Banco de dados não configurado.', timestamp: new Date().toISOString() }
      });
    }

    // Local DB (apenas em modo demo)
    const list = localDb.categories
      .filter(c => c.business_id === businessId)
      .sort((a, b) => a.display_order - b.display_order);

    return res.status(200).json({
      success: true,
      data: list.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        icon: c.icon_key || c.icon,
        iconType: c.icon_type || '2d',
        iconKey: c.icon_key || c.icon || null,
        imageUrl: c.image_url || null,
        displayMode: c.display_mode || 'icon_text_side',
        displayOrder: c.display_order,
        isActive: c.is_active,
        createdAt: c.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
};

export const createCategoryController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Estabelecimento não identificado.', timestamp: new Date().toISOString() }
      });
    }

    const data = categorySchema.parse(req.body);
    const finalIconKey = data.iconKey || data.icon || null;

    if (isSupabaseConfigured) {
      const client = req.accessToken ? createUserClient(req.accessToken) : supabaseAdmin;
      const { data: maxCat } = await client
        .from('categories')
        .select('display_order')
        .eq('business_id', businessId)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextOrder = maxCat ? maxCat.display_order + 1 : 1;

      const { data: newCat, error } = await client
        .from('categories')
        .insert({
          business_id: businessId,
          name: data.name,
          description: data.description || null,
          icon: finalIconKey || '2d-dish',
          icon_key: finalIconKey,
          icon_type: data.iconType,
          image_url: data.imageUrl || null,
          display_mode: data.displayMode,
          display_order: nextOrder,
          is_active: data.isActive
        })
        .select()
        .single();

      if (error || !newCat) {
        return res.status(500).json({
          success: false,
          error: { code: 'INSERT_FAILED', message: 'Falha ao criar categoria.', timestamp: new Date().toISOString() }
        });
      }

      return res.status(201).json({
        success: true,
        data: {
          id: newCat.id,
          name: newCat.name,
          description: newCat.description,
          icon: newCat.icon_key || newCat.icon,
          iconType: newCat.icon_type || data.iconType,
          iconKey: newCat.icon_key || finalIconKey,
          imageUrl: newCat.image_url || null,
          displayOrder: newCat.display_order,
          isActive: newCat.is_active
        }
      });
    }

    if (!isDemoMode()) {
      return res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Banco de dados não configurado.', timestamp: new Date().toISOString() }
      });
    }

    // Local DB (Demo)
    const nextOrder = localDb.categories.length + 1;
    const newCategory = {
      id: `cat_${Date.now()}`,
      business_id: businessId,
      name: data.name,
      description: data.description || null,
      icon: finalIconKey || '2d-dish',
      icon_type: data.iconType,
      icon_key: finalIconKey,
      image_url: data.imageUrl || null,
      display_mode: data.displayMode,
      display_order: nextOrder,
      is_active: data.isActive,
      created_at: new Date().toISOString()
    };

    localDb.categories.push(newCategory);

    return res.status(201).json({
      success: true,
      data: {
        id: newCategory.id,
        name: newCategory.name,
        description: newCategory.description,
        icon: newCategory.icon_key || newCategory.icon,
        iconType: newCategory.icon_type,
        iconKey: newCategory.icon_key,
        imageUrl: newCategory.image_url,
        displayMode: newCategory.display_mode || 'icon_text_side',
        displayOrder: newCategory.display_order,
        isActive: newCategory.is_active
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateCategoryController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Estabelecimento não identificado.', timestamp: new Date().toISOString() }
      });
    }

    const { id } = req.params;
    const data = categorySchema.parse(req.body);
    const finalIconKey = data.iconKey || data.icon || null;

    if (isSupabaseConfigured) {
      const client = req.accessToken ? createUserClient(req.accessToken) : supabaseAdmin;
      const { data: updatedCat, error } = await client
        .from('categories')
        .update({
          name: data.name,
          description: data.description || null,
          icon: finalIconKey,
          icon_key: finalIconKey,
          icon_type: data.iconType,
          image_url: data.imageUrl || null,
          display_mode: data.displayMode,
          is_active: data.isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('business_id', businessId)
        .select()
        .maybeSingle();

      if (error) {
        return res.status(500).json({
          success: false,
          error: { code: 'UPDATE_FAILED', message: 'Falha ao atualizar categoria.', timestamp: new Date().toISOString() }
        });
      }

      if (!updatedCat) {
        return res.status(404).json({
          success: false,
          error: { code: 'CATEGORY_NOT_FOUND', message: 'Categoria não encontrada ou você não tem permissão.', timestamp: new Date().toISOString() }
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          id: updatedCat.id,
          name: updatedCat.name,
          description: updatedCat.description,
          icon: updatedCat.icon_key || updatedCat.icon,
          iconType: updatedCat.icon_type || data.iconType,
          iconKey: updatedCat.icon_key || finalIconKey,
          imageUrl: updatedCat.image_url || null,
          displayMode: updatedCat.display_mode || data.displayMode,
          displayOrder: updatedCat.display_order,
          isActive: updatedCat.is_active
        }
      });
    }

    if (!isDemoMode()) {
      return res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Banco de dados não configurado.', timestamp: new Date().toISOString() }
      });
    }

    // Local DB
    const cat = localDb.categories.find(c => c.id === id && c.business_id === businessId);
    if (!cat) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CATEGORY_NOT_FOUND',
          message: 'Categoria não encontrada ou você não tem permissão.',
          timestamp: new Date().toISOString()
        }
      });
    }

    cat.name = data.name;
    cat.description = data.description || null;
    cat.icon_type = data.iconType;
    cat.icon_key = finalIconKey;
    cat.icon = finalIconKey;
    cat.image_url = data.imageUrl || null;
    cat.display_mode = data.displayMode;
    cat.is_active = data.isActive;

    return res.status(200).json({
      success: true,
      data: {
        id: cat.id,
        name: cat.name,
        description: cat.description,
        icon: cat.icon_key || cat.icon,
        iconType: cat.icon_type,
        iconKey: cat.icon_key,
        imageUrl: cat.image_url,
        displayMode: cat.display_mode || 'icon_text_side',
        displayOrder: cat.display_order,
        isActive: cat.is_active
      }
    });
  } catch (error) {
    next(error);
  }
};

export const reorderCategoriesController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Estabelecimento não identificado.', timestamp: new Date().toISOString() }
      });
    }

    const { orders } = reorderSchema.parse(req.body);

    if (isSupabaseConfigured) {
      const client = req.accessToken ? createUserClient(req.accessToken) : supabaseAdmin;
      for (const item of orders) {
        await client
          .from('categories')
          .update({ display_order: item.displayOrder })
          .eq('id', item.id)
          .eq('business_id', businessId);
      }

      return res.status(200).json({
        success: true,
        data: { message: 'Ordem de categorias atualizada com sucesso.' }
      });
    }

    if (!isDemoMode()) {
      return res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Banco de dados não configurado.', timestamp: new Date().toISOString() }
      });
    }

    // Local DB
    for (const item of orders) {
      const cat = localDb.categories.find(c => c.id === item.id && c.business_id === businessId);
      if (cat) cat.display_order = item.displayOrder;
    }

    return res.status(200).json({
      success: true,
      data: { message: 'Ordem de categorias atualizada com sucesso.' }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCategoryController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Estabelecimento não identificado.', timestamp: new Date().toISOString() }
      });
    }

    const { id } = req.params;

    if (isSupabaseConfigured) {
      const client = req.accessToken ? createUserClient(req.accessToken) : supabaseAdmin;
      const { error } = await client
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('business_id', businessId);

      if (error) {
        return res.status(500).json({
          success: false,
          error: { code: 'DELETE_FAILED', message: 'Falha ao excluir categoria.', timestamp: new Date().toISOString() }
        });
      }

      return res.status(200).json({
        success: true,
        data: { message: 'Categoria excluída com sucesso.' }
      });
    }

    if (!isDemoMode()) {
      return res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Banco de dados não configurado.', timestamp: new Date().toISOString() }
      });
    }

    localDb.categories = localDb.categories.filter(c => !(c.id === id && c.business_id === businessId));
    localDb.items = localDb.items.filter(i => !(i.category_id === id && i.business_id === businessId));

    return res.status(200).json({
      success: true,
      data: { message: 'Categoria excluída com sucesso.' }
    });
  } catch (error) {
    next(error);
  }
};

