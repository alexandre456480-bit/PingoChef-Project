import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { supabaseAdmin, createUserClient, isSupabaseConfigured } from '../config/supabase';
import { localDb, isDemoMode } from '../config/localDb';
import { SupabaseProductMediaRepository } from '../repositories/product-media.repository';

// Validação segura de imagem: bloqueia SVG para evitar Stored XSS e valida mime types e tamanho Base64
const safeImageString = z.string().trim().refine(val => {
  if (!val) return true;
  if (val.startsWith('http://') || val.startsWith('https://')) {
    return true;
  }
  if (val.startsWith('data:image/')) {
    // Rejeição estrita de SVG contra Stored XSS
    if (val.includes('image/svg') || val.toLowerCase().includes('<svg')) {
      return false;
    }
    const allowedPrefixes = ['data:image/jpeg;', 'data:image/jpg;', 'data:image/png;', 'data:image/webp;', 'data:image/gif;'];
    const hasValidPrefix = allowedPrefixes.some(p => val.startsWith(p));
    // Limite máximo de ~8MB em Base64 (~11 milhões de caracteres)
    const isWithinSize = val.length <= 11000000;
    return hasValidPrefix && isWithinSize;
  }
  return false;
}, { message: 'Formato de imagem inválido ou tipo não suportado (SVGs não são permitidos por segurança).' }).optional().nullable();

const itemSchema = z.object({
  categoryId: z.string().min(1, 'Categoria obrigatória'),
  subcategoryId: z.string().optional().nullable(),
  name: z.string().trim().min(2, 'Nome do produto deve ter no mínimo 2 caracteres').max(100),
  description: z.string().trim().max(1000).optional().nullable(),
  price: z.number().min(0, 'Preço deve ser maior ou igual a zero').default(0),
  promotionalPrice: z.number().positive('Preço promocional deve ser maior que zero').nullable().optional(),
  imageUrl: safeImageString,
  isAvailable: z.boolean().default(true),
  isHighlighted: z.boolean().default(false),
  highlightType: z.enum(['none', 'promotion', 'most_liked', 'chef', 'combo', 'best_seller']).default('none'),
  showPrice: z.boolean().default(true),
  displayOrder: z.number().int().optional()
}).refine(data => {
  if (data.showPrice !== false) {
    return data.price > 0;
  }
  return true;
}, {
  message: 'Preço deve ser maior que zero quando ativado.',
  path: ['price']
}).refine(data => {
  if (data.showPrice !== false && data.promotionalPrice !== undefined && data.promotionalPrice !== null) {
    return data.promotionalPrice < data.price;
  }
  return true;
}, {
  message: 'Preço promocional deve ser menor que o preço original.',
  path: ['promotionalPrice']
});

const reorderItemsSchema = z.object({
  orders: z.array(z.object({
    id: z.string(),
    displayOrder: z.number().int()
  })).max(300, 'Máximo de 300 itens por reordenação')
});

export const getItemsController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Estabelecimento não identificado.', timestamp: new Date().toISOString() }
      });
    }

    const { categoryId, subcategoryId } = req.query;

    if (isSupabaseConfigured) {
      const client = req.accessToken ? createUserClient(req.accessToken) : supabaseAdmin;
      let query = client
        .from('menu_items')
        .select('*, categories(name)')
        .eq('business_id', businessId)
        .order('display_order', { ascending: true });

      if (categoryId && typeof categoryId === 'string') {
        query = query.eq('category_id', categoryId);
      }
      if (subcategoryId && typeof subcategoryId === 'string') {
        query = query.eq('subcategory_id', subcategoryId);
      }

      const { data, error } = await query;

      if (error) {
        return res.status(500).json({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Erro ao buscar itens do cardápio.', timestamp: new Date().toISOString() }
        });
      }

      let projectedItems = (data || []).map(item => ({
          id: item.id,
          categoryId: item.category_id,
          subcategoryId: item.subcategory_id || null,
          categoryName: item.categories?.name || null,
          name: item.name,
          description: item.description,
          price: Number(item.price),
          promotionalPrice: item.promotional_price ? Number(item.promotional_price) : null,
          imageUrl: item.image_url,
          isAvailable: item.is_available,
          isHighlighted: item.highlight_type ? item.highlight_type !== 'none' : Boolean(item.is_highlighted),
          highlightType: item.highlight_type || (item.is_highlighted ? 'chef' : 'none'),
          showPrice: item.show_price !== false,
          likesCount: item.likes_count,
          displayOrder: item.display_order ?? 0,
          createdAt: item.created_at
      }));

      const mediaRows = await new SupabaseProductMediaRepository().listGalleryMedia(
        businessId,
        projectedItems.map(item => item.id),
        false
      );
      const mediaByItem = new Map<string, any[]>();
      for (const media of mediaRows) {
        const list = mediaByItem.get(media.menu_item_id) ?? [];
        list.push({
          id: media.id,
          mediaType: media.media_type,
          source: media.source,
          position: media.position,
          durationSeconds: media.duration_seconds === null ? null : Number(media.duration_seconds)
        });
        mediaByItem.set(media.menu_item_id, list);
      }
      projectedItems = projectedItems.map(item => ({
        ...item,
        media: mediaByItem.get(item.id) ?? []
      }));

      return res.status(200).json({
        success: true,
        data: projectedItems
      });
    }

    if (!isDemoMode()) {
      return res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Banco de dados não configurado.', timestamp: new Date().toISOString() }
      });
    }

    // Local DB (Demo)
    let list = localDb.items.filter(i => i.business_id === businessId);
    if (categoryId && typeof categoryId === 'string') {
      list = list.filter(i => i.category_id === categoryId);
    }
    if (subcategoryId && typeof subcategoryId === 'string') {
      list = list.filter(i => i.subcategory_id === subcategoryId);
    }
    list = list.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

    return res.status(200).json({
      success: true,
      data: list.map(item => {
        const cat = localDb.categories.find(c => c.id === item.category_id);
        const subcat = localDb.subcategories.find(s => s.id === item.subcategory_id);
        const effectiveHighlight = item.highlight_type || (item.is_highlighted ? 'chef' : 'none');
        return {
          id: item.id,
          categoryId: item.category_id,
          subcategoryId: item.subcategory_id || null,
          categoryName: cat?.name || null,
          subcategoryName: subcat?.name || null,
          name: item.name,
          description: item.description,
          price: item.price,
          promotionalPrice: item.promotional_price,
          imageUrl: item.image_url,
          isAvailable: item.is_available,
          isHighlighted: effectiveHighlight !== 'none',
          highlightType: effectiveHighlight,
          showPrice: item.show_price !== false,
          likesCount: item.likes_count || 0,
          displayOrder: item.display_order ?? 0,
          createdAt: item.created_at
        };
      })
    });
  } catch (error) {
    next(error);
  }
};

export const createItemController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Estabelecimento não identificado.', timestamp: new Date().toISOString() }
      });
    }

    const data = itemSchema.parse(req.body);
    const effectiveHighlight = data.highlightType || (data.isHighlighted ? 'chef' : 'none');
    const isHigh = effectiveHighlight !== 'none';

    if (isSupabaseConfigured) {
      const client = req.accessToken ? createUserClient(req.accessToken) : supabaseAdmin;
      const { data: maxRow } = await client
        .from('menu_items')
        .select('display_order')
        .eq('business_id', businessId)
        .eq('category_id', data.categoryId)
        .order('display_order', { ascending: false })
        .limit(1);

      const nextOrder = data.displayOrder !== undefined ? data.displayOrder : (maxRow && maxRow.length > 0 ? (maxRow[0].display_order + 1) : 0);

      const { data: newItem, error } = await client
        .from('menu_items')
        .insert({
          business_id: businessId,
          category_id: data.categoryId,
          subcategory_id: data.subcategoryId || null,
          name: data.name,
          description: data.description || null,
          price: data.price,
          promotional_price: data.promotionalPrice || null,
          image_url: data.imageUrl || null,
          is_available: data.isAvailable,
          is_highlighted: isHigh,
          highlight_type: effectiveHighlight,
          show_price: data.showPrice !== false,
          display_order: nextOrder
        })
        .select()
        .single();

      if (error || !newItem) {
        return res.status(500).json({
          success: false,
          error: { code: 'INSERT_FAILED', message: 'Falha ao criar item no cardápio.', timestamp: new Date().toISOString() }
        });
      }

      return res.status(201).json({
        success: true,
        data: newItem
      });
    }

    if (!isDemoMode()) {
      return res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Banco de dados não configurado.', timestamp: new Date().toISOString() }
      });
    }

    // Local DB (Demo)
    const existingInCat = localDb.items.filter(i => i.business_id === businessId && i.category_id === data.categoryId);
    const nextOrder = data.displayOrder !== undefined ? data.displayOrder : (existingInCat.length > 0 ? Math.max(...existingInCat.map(i => i.display_order ?? 0)) + 1 : 0);

    const newItem: any = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      business_id: businessId,
      category_id: data.categoryId,
      subcategory_id: data.subcategoryId || null,
      name: data.name,
      description: data.description || null,
      price: data.price,
      promotional_price: data.promotionalPrice || null,
      image_url: data.imageUrl || null,
      is_available: data.isAvailable,
      is_highlighted: isHigh,
      highlight_type: effectiveHighlight,
      show_price: data.showPrice !== false,
      likes_count: 0,
      display_order: nextOrder,
      created_at: new Date().toISOString()
    };

    localDb.items.push(newItem);

    return res.status(201).json({
      success: true,
      data: newItem
    });
  } catch (error) {
    next(error);
  }
};

export const updateItemController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Estabelecimento não identificado.', timestamp: new Date().toISOString() }
      });
    }

    const { id } = req.params;
    const data = itemSchema.parse(req.body);
    const effectiveHighlight = data.highlightType || (data.isHighlighted ? 'chef' : 'none');
    const isHigh = effectiveHighlight !== 'none';

    if (isSupabaseConfigured) {
      const client = req.accessToken ? createUserClient(req.accessToken) : supabaseAdmin;
      const { data: updatedItem, error } = await client
        .from('menu_items')
        .update({
          category_id: data.categoryId,
          subcategory_id: data.subcategoryId || null,
          name: data.name,
          description: data.description || null,
          price: data.price,
          promotional_price: data.promotionalPrice || null,
          image_url: data.imageUrl || null,
          is_available: data.isAvailable,
          is_highlighted: isHigh,
          highlight_type: effectiveHighlight,
          show_price: data.showPrice !== false,
          display_order: data.displayOrder !== undefined ? data.displayOrder : undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('business_id', businessId)
        .select()
        .maybeSingle();

      if (error) {
        return res.status(500).json({
          success: false,
          error: { code: 'UPDATE_FAILED', message: 'Falha ao atualizar produto.', timestamp: new Date().toISOString() }
        });
      }

      if (!updatedItem) {
        return res.status(404).json({
          success: false,
          error: { code: 'ITEM_NOT_FOUND', message: 'Produto não encontrado ou permissão negada.', timestamp: new Date().toISOString() }
        });
      }

      return res.status(200).json({
        success: true,
        data: updatedItem
      });
    }

    if (!isDemoMode()) {
      return res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Banco de dados não configurado.', timestamp: new Date().toISOString() }
      });
    }

    // Local DB (Demo)
    const item = localDb.items.find(i => i.id === id && i.business_id === businessId);
    if (!item) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ITEM_NOT_FOUND',
          message: 'Produto não encontrado ou você não tem permissão.',
          timestamp: new Date().toISOString()
        }
      });
    }

    item.category_id = data.categoryId;
    item.subcategory_id = data.subcategoryId !== undefined ? data.subcategoryId : item.subcategory_id;
    item.name = data.name;
    item.description = data.description || null;
    item.price = data.price;
    item.promotional_price = data.promotionalPrice || null;
    item.image_url = data.imageUrl !== undefined ? data.imageUrl : item.image_url;
    item.is_available = data.isAvailable;
    item.is_highlighted = isHigh;
    item.highlight_type = effectiveHighlight;
    item.show_price = data.showPrice !== false;
    if (data.displayOrder !== undefined) {
      item.display_order = data.displayOrder;
    }

    return res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    next(error);
  }
};

export const reorderItemsController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Estabelecimento não identificado.', timestamp: new Date().toISOString() }
      });
    }

    const { orders } = reorderItemsSchema.parse(req.body);

    if (isSupabaseConfigured) {
      const client = req.accessToken ? createUserClient(req.accessToken) : supabaseAdmin;
      for (const o of orders) {
        await client
          .from('menu_items')
          .update({ display_order: o.displayOrder, updated_at: new Date().toISOString() })
          .eq('id', o.id)
          .eq('business_id', businessId);
      }

      return res.status(200).json({
        success: true,
        data: { message: 'Ordem dos produtos atualizada com sucesso.' }
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
      const item = localDb.items.find(i => i.id === o.id && i.business_id === businessId);
      if (item) {
        item.display_order = o.displayOrder;
      }
    }

    return res.status(200).json({
      success: true,
      data: { message: 'Ordem dos produtos atualizada com sucesso.' }
    });
  } catch (error) {
    next(error);
  }
};

export const toggleItemAvailabilityController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
      const { data: currentItem, error: fetchErr } = await client
        .from('menu_items')
        .select('is_available')
        .eq('id', id)
        .eq('business_id', businessId)
        .maybeSingle();

      if (fetchErr) {
        return res.status(500).json({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Erro ao consultar produto.', timestamp: new Date().toISOString() }
        });
      }

      if (!currentItem) {
        return res.status(404).json({
          success: false,
          error: { code: 'ITEM_NOT_FOUND', message: 'Produto não encontrado.', timestamp: new Date().toISOString() }
        });
      }

      const { data: updated, error: updateErr } = await client
        .from('menu_items')
        .update({
          is_available: !currentItem.is_available,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('business_id', businessId)
        .select('id, is_available')
        .single();

      if (updateErr || !updated) {
        return res.status(500).json({
          success: false,
          error: { code: 'UPDATE_FAILED', message: 'Falha ao alterar disponibilidade.', timestamp: new Date().toISOString() }
        });
      }

      return res.status(200).json({
        success: true,
        data: updated
      });
    }

    if (!isDemoMode()) {
      return res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Banco de dados não configurado.', timestamp: new Date().toISOString() }
      });
    }

    // Local DB (Demo)
    const item = localDb.items.find(i => i.id === id && i.business_id === businessId);
    if (!item) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ITEM_NOT_FOUND',
          message: 'Produto não encontrado.',
          timestamp: new Date().toISOString()
        }
      });
    }

    item.is_available = !item.is_available;

    return res.status(200).json({
      success: true,
      data: { id: item.id, isAvailable: item.is_available }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteItemController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
        .from('menu_items')
        .delete()
        .eq('id', id)
        .eq('business_id', businessId);

      if (error) {
        return res.status(500).json({
          success: false,
          error: { code: 'DELETE_FAILED', message: 'Falha ao excluir produto.', timestamp: new Date().toISOString() }
        });
      }

      return res.status(200).json({
        success: true,
        data: { message: 'Produto excluído com sucesso.' }
      });
    }

    if (!isDemoMode()) {
      return res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Banco de dados não configurado.', timestamp: new Date().toISOString() }
      });
    }

    localDb.items = localDb.items.filter(i => !(i.id === id && i.business_id === businessId));

    return res.status(200).json({
      success: true,
      data: { message: 'Produto excluído com sucesso.' }
    });
  } catch (error) {
    next(error);
  }
};
