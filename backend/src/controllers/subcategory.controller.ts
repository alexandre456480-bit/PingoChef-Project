import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { supabaseAdmin, createUserClient, isSupabaseConfigured } from '../config/supabase';
import { localDb, isDemoMode } from '../config/localDb';

const createSubcategorySchema = z.object({
  categoryId: z.string().min(1, 'Categoria obrigatória'),
  name: z.string().trim().min(2, 'Nome da subcategoria deve ter no mínimo 2 caracteres').max(100, 'Nome muito longo')
});

const updateSubcategorySchema = z.object({
  name: z.string().trim().min(2, 'Nome da subcategoria deve ter no mínimo 2 caracteres').max(100, 'Nome muito longo')
});

const reorderSubcategoriesSchema = z.object({
  orders: z.array(z.object({
    id: z.string(),
    displayOrder: z.number().int()
  })).max(200, 'Máximo de 200 itens por reordenação')
});

export const getSubcategoriesController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Estabelecimento não identificado.', timestamp: new Date().toISOString() }
      });
    }

    const { categoryId } = req.query;

    if (isSupabaseConfigured) {
      const client = req.accessToken ? createUserClient(req.accessToken) : supabaseAdmin;
      let query = client
        .from('subcategories')
        .select('*')
        .eq('business_id', businessId)
        .order('display_order', { ascending: true });

      if (categoryId && typeof categoryId === 'string') {
        query = query.eq('category_id', categoryId);
      }

      const { data, error } = await query;

      if (error) {
        return res.status(500).json({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Erro ao buscar subcategorias.', timestamp: new Date().toISOString() }
        });
      }

      return res.status(200).json({
        success: true,
        data: (data || []).map(s => ({
          id: s.id,
          categoryId: s.category_id,
          name: s.name,
          displayOrder: s.display_order,
          createdAt: s.created_at
        }))
      });
    }

    if (!isDemoMode()) {
      return res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Banco de dados não configurado.', timestamp: new Date().toISOString() }
      });
    }

    // Local DB (Demo)
    let list = localDb.subcategories.filter(s => s.business_id === businessId);
    if (categoryId && typeof categoryId === 'string') {
      list = list.filter(s => s.category_id === categoryId);
    }
    list = list.sort((a, b) => a.display_order - b.display_order);

    return res.status(200).json({
      success: true,
      data: list.map(s => ({
        id: s.id,
        categoryId: s.category_id,
        name: s.name,
        displayOrder: s.display_order,
        createdAt: s.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
};

export const createSubcategoryController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Estabelecimento não identificado.', timestamp: new Date().toISOString() }
      });
    }

    const data = createSubcategorySchema.parse(req.body);

    if (isSupabaseConfigured) {
      const client = req.accessToken ? createUserClient(req.accessToken) : supabaseAdmin;
      const { data: maxRow } = await client
        .from('subcategories')
        .select('display_order')
        .eq('business_id', businessId)
        .eq('category_id', data.categoryId)
        .order('display_order', { ascending: false })
        .limit(1);

      const nextOrder = maxRow && maxRow.length > 0 ? (maxRow[0].display_order + 1) : 0;

      const { data: created, error } = await client
        .from('subcategories')
        .insert({
          business_id: businessId,
          category_id: data.categoryId,
          name: data.name,
          display_order: nextOrder
        })
        .select()
        .single();

      if (error || !created) {
        return res.status(500).json({
          success: false,
          error: { code: 'INSERT_FAILED', message: 'Falha ao criar subcategoria.', timestamp: new Date().toISOString() }
        });
      }

      return res.status(201).json({
        success: true,
        data: {
          id: created.id,
          categoryId: created.category_id,
          name: created.name,
          displayOrder: created.display_order,
          createdAt: created.created_at
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
    const existing = localDb.subcategories.filter(s => s.business_id === businessId && s.category_id === data.categoryId);
    const nextOrder = existing.length > 0 ? Math.max(...existing.map(s => s.display_order)) + 1 : 0;

    const newSubcat: any = {
      id: `subcat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      business_id: businessId,
      category_id: data.categoryId,
      name: data.name,
      display_order: nextOrder,
      created_at: new Date().toISOString()
    };

    localDb.subcategories.push(newSubcat);

    return res.status(201).json({
      success: true,
      data: {
        id: newSubcat.id,
        categoryId: newSubcat.category_id,
        name: newSubcat.name,
        displayOrder: newSubcat.display_order,
        createdAt: newSubcat.created_at
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateSubcategoryController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Estabelecimento não identificado.', timestamp: new Date().toISOString() }
      });
    }

    const { id } = req.params;
    const data = updateSubcategorySchema.parse(req.body);

    if (isSupabaseConfigured) {
      const client = req.accessToken ? createUserClient(req.accessToken) : supabaseAdmin;
      const { data: updated, error } = await client
        .from('subcategories')
        .update({
          name: data.name,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('business_id', businessId)
        .select()
        .maybeSingle();

      if (error) {
        return res.status(500).json({
          success: false,
          error: { code: 'UPDATE_FAILED', message: 'Falha ao atualizar subcategoria.', timestamp: new Date().toISOString() }
        });
      }

      if (!updated) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Subcategoria não encontrada ou permissão negada.', timestamp: new Date().toISOString() }
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          id: updated.id,
          categoryId: updated.category_id,
          name: updated.name,
          displayOrder: updated.display_order,
          createdAt: updated.created_at
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
    const subcat = localDb.subcategories.find(s => s.id === id && s.business_id === businessId);
    if (!subcat) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Subcategoria não encontrada.' }
      });
    }

    subcat.name = data.name;

    return res.status(200).json({
      success: true,
      data: {
        id: subcat.id,
        categoryId: subcat.category_id,
        name: subcat.name,
        displayOrder: subcat.display_order,
        createdAt: subcat.created_at
      }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSubcategoryController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
      // Itens com essa subcategoria passam para null
      await client
        .from('menu_items')
        .update({ subcategory_id: null })
        .eq('subcategory_id', id)
        .eq('business_id', businessId);

      const { error } = await client
        .from('subcategories')
        .delete()
        .eq('id', id)
        .eq('business_id', businessId);

      if (error) {
        return res.status(500).json({
          success: false,
          error: { code: 'DELETE_FAILED', message: 'Falha ao excluir subcategoria.', timestamp: new Date().toISOString() }
        });
      }

      return res.status(200).json({
        success: true,
        data: { id, deleted: true }
      });
    }

    if (!isDemoMode()) {
      return res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Banco de dados não configurado.', timestamp: new Date().toISOString() }
      });
    }

    // Local DB (Demo)
    localDb.subcategories = localDb.subcategories.filter(s => !(s.id === id && s.business_id === businessId));
    localDb.items.forEach(item => {
      if (item.business_id === businessId && item.subcategory_id === id) {
        item.subcategory_id = null;
      }
    });

    return res.status(200).json({
      success: true,
      data: { id, deleted: true }
    });
  } catch (error) {
    next(error);
  }
};

export const reorderSubcategoriesController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Estabelecimento não identificado.', timestamp: new Date().toISOString() }
      });
    }

    const { orders } = reorderSubcategoriesSchema.parse(req.body);

    if (isSupabaseConfigured) {
      const client = req.accessToken ? createUserClient(req.accessToken) : supabaseAdmin;
      for (const o of orders) {
        await client
          .from('subcategories')
          .update({ display_order: o.displayOrder })
          .eq('id', o.id)
          .eq('business_id', businessId);
      }

      return res.status(200).json({
        success: true,
        data: { message: 'Ordem das subcategorias atualizada com sucesso.' }
      });
    }

    if (!isDemoMode()) {
      return res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Banco de dados não configurado.', timestamp: new Date().toISOString() }
      });
    }

    // Local DB (Demo)
    for (const o of orders) {
      const subcat = localDb.subcategories.find(s => s.id === o.id && s.business_id === businessId);
      if (subcat) {
        subcat.display_order = o.displayOrder;
      }
    }

    return res.status(200).json({
      success: true,
      data: { message: 'Ordem das subcategorias atualizada com sucesso.' }
    });
  } catch (error) {
    next(error);
  }
};

