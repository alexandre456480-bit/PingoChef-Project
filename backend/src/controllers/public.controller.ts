import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { localDb, isDemoMode } from '../config/localDb';
import { SupabaseProductMediaRepository } from '../repositories/product-media.repository';

const slugParamSchema = z.string().trim().regex(/^[a-z0-9-]+$/, 'Slug inválido');

export const getPublicMenuController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = slugParamSchema.parse(req.params.slug);

    let business: any = null;
    let design: any = null;
    let categories: any[] = [];
    let subcategories: any[] = [];
    let items: any[] = [];

    if (isSupabaseConfigured) {
      try {
        // 1. Obter estabelecimento no Supabase
        const { data: bData, error: bError } = await supabaseAdmin
          .from('businesses')
          .select('id, name, slug, description, logo_url, cover_image_url, welcome_bg_type, welcome_bg_image, welcome_bg_color, status, phone, whatsapp')
          .eq('slug', slug)
          .eq('status', 'ACTIVE')
          .maybeSingle();

        if (bError) {
          console.error('[Data Audit]', { event: 'public_menu_business_query_failed' });
          return res.status(503).json({
            success: false,
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Serviço temporariamente indisponível. Tente novamente mais tarde.',
              timestamp: new Date().toISOString()
            }
          });
        }

        if (!bData) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'BUSINESS_NOT_FOUND',
              message: 'Estabelecimento não encontrado ou temporariamente inativo.',
              timestamp: new Date().toISOString()
            }
          });
        }

        business = bData;
        const businessId = business.id;

        // 2. Obter configurações de design
        const { data: dData } = await supabaseAdmin
          .from('design_settings')
          .select('*')
          .eq('business_id', businessId)
          .maybeSingle();

        design = dData || {
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
          home_blocks: [],
          custom_config: {}
        };

        // 3. Obter categorias ativas
        const { data: cData } = await supabaseAdmin
          .from('categories')
          .select('id, name, description, icon, icon_key, icon_type, image_url, display_order, display_mode')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        categories = (cData || []).map(c => ({
          id: c.id,
          name: c.name,
          description: c.description,
          icon: c.icon_key || c.icon,
          iconType: c.icon_type || '2d',
          iconKey: c.icon_key || c.icon || null,
          imageUrl: c.image_url || null,
          displayMode: c.display_mode || 'icon_text_side',
          displayOrder: c.display_order
        }));

        // 4. Obter subcategorias
        const { data: sData } = await supabaseAdmin
          .from('subcategories')
          .select('id, category_id, name, display_order')
          .eq('business_id', businessId)
          .order('display_order', { ascending: true });

        subcategories = (sData || []).map(s => ({
          id: s.id,
          categoryId: s.category_id,
          name: s.name,
          displayOrder: s.display_order
        }));

        // 5. Obter itens disponíveis
        const { data: iData } = await supabaseAdmin
          .from('menu_items')
          .select('id, category_id, subcategory_id, name, description, price, promotional_price, image_url, is_highlighted, highlight_type, likes_count, display_order, show_price')
          .eq('business_id', businessId)
          .eq('is_available', true)
          .order('display_order', { ascending: true });

        items = (iData || []).map(i => ({
          id: i.id,
          categoryId: i.category_id,
          subcategoryId: i.subcategory_id || null,
          name: i.name,
          description: i.description,
          price: Number(i.price),
          promotionalPrice: i.promotional_price ? Number(i.promotional_price) : null,
          imageUrl: i.image_url || null,
          isHighlighted: (i.highlight_type && i.highlight_type !== 'none') || Boolean(i.is_highlighted),
          highlightType: i.highlight_type || (i.is_highlighted ? 'chef' : 'none'),
          showPrice: i.show_price !== false,
          likesCount: Number(i.likes_count || 0),
          displayOrder: i.display_order ?? 0
        }));

        const mediaRows = await new SupabaseProductMediaRepository().listGalleryMedia(
          businessId,
          items.map(item => item.id),
          true
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
        items = items.map(item => ({ ...item, media: mediaByItem.get(item.id) ?? [] }));

      } catch (err) {
        console.error('[Data Audit]', { event: 'public_menu_query_failed' });
        return res.status(503).json({
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Serviço temporariamente indisponível.',
            timestamp: new Date().toISOString()
          }
        });
      }
    } else {
      // Supabase não configurado: somente aceitar se APP_MODE === 'demo'
      if (!isDemoMode()) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Banco de dados do sistema não está disponível.',
            timestamp: new Date().toISOString()
          }
        });
      }

      business = localDb.businesses.find(b => b.slug === slug && b.status === 'ACTIVE');
      if (!business) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'BUSINESS_NOT_FOUND',
            message: 'Estabelecimento não encontrado ou temporariamente inativo.',
            timestamp: new Date().toISOString()
          }
        });
      }

      const businessId = business.id;
      design = localDb.designSettings[businessId] || {
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
        home_blocks: [],
        custom_config: {}
      };

      categories = localDb.categories
        .filter(c => c.business_id === businessId && c.is_active)
        .sort((a, b) => a.display_order - b.display_order)
        .map(c => ({
          id: c.id,
          name: c.name,
          description: c.description,
          icon: c.icon_key || c.icon,
          iconType: c.icon_type || '2d',
          iconKey: c.icon_key || c.icon || null,
          imageUrl: c.image_url || null,
          displayMode: c.display_mode || 'icon_text_side',
          displayOrder: c.display_order
        }));

      subcategories = localDb.subcategories
        .filter(s => s.business_id === businessId)
        .sort((a, b) => a.display_order - b.display_order)
        .map(s => ({
          id: s.id,
          categoryId: s.category_id,
          name: s.name,
          displayOrder: s.display_order
        }));

      items = localDb.items
        .filter(i => i.business_id === businessId && i.is_available)
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map(i => ({
          id: i.id,
          categoryId: i.category_id,
          subcategoryId: i.subcategory_id || null,
          name: i.name,
          description: i.description,
          price: Number(i.price),
          promotionalPrice: i.promotional_price ? Number(i.promotional_price) : null,
          imageUrl: i.image_url || null,
          isHighlighted: (i.highlight_type && i.highlight_type !== 'none') || Boolean(i.is_highlighted),
          highlightType: i.highlight_type || (i.is_highlighted ? 'chef' : 'none'),
          showPrice: i.show_price !== false,
          likesCount: Number(i.likes_count || 0),
          displayOrder: i.display_order ?? 0
        }));
    }

    // Headers de segurança e anti-cache
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Garantir blocos padrão caso ausentes
    const existingBlocks: any[] = Array.isArray(design.home_blocks) ? design.home_blocks : [];
    const existingTypes = new Set(existingBlocks.map(b => b.type));
    const defaultBlocks = [
      { id: 'block_hero', type: 'hero', label: 'Hero / Capa', enabled: true, position: 0 },
      { id: 'block_categories', type: 'categories', label: 'Categorias', enabled: true, position: 1 },
      { id: 'block_promotion', type: 'promotion', label: 'Promoções', enabled: true, position: 2 },
      { id: 'block_most_liked', type: 'most_liked', label: 'Mais Curtidos', enabled: true, position: 3 },
      { id: 'block_featured', type: 'featured_product', label: 'Especial da Casa', enabled: true, position: 4 },
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
        business: {
          name: business.name,
          slug: business.slug,
          description: business.description || '',
          logoUrl: business.logo_url || '/logo_img.webp',
          coverImageUrl: business.cover_image_url || business.welcome_bg_image || 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80',
          welcomeBgType: business.welcome_bg_type || 'image',
          welcomeBgImage: business.welcome_bg_image || business.cover_image_url || 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80',
          welcomeBgColor: business.welcome_bg_color || '#0F0F12',
          phone: business.phone || null,
          whatsapp: business.whatsapp || null
        },
        design: {
          templateKey: design.template_key || 'modern',
          palette: design.palette,
          fontPair: design.font_pair || 'modern_clean',
          fontHeading: design.font_heading || 'Outfit',
          fontBody: design.font_body || 'Inter',
          categoryStyle: design.category_style || 'icon_name',
          motion: design.motion || 'fade',
          homeBlocks: mergedBlocks,
          heroBanners: design.custom_config?.hero_banners || design.hero_banners || [],
          heroScope: design.custom_config?.hero_scope || 'all',
          categoryHeroConfigs: design.custom_config?.category_hero_configs || design.category_hero_configs || {},
          customConfig: design.custom_config || {}
        },
        categories,
        items
      }
    });
  } catch (error) {
    next(error);
  }
};

export const likeItemController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = slugParamSchema.parse(req.params.slug);
    const itemId = z.string().trim().min(1).parse(req.params.itemId);

    let businessId: string | null = null;

    if (isSupabaseConfigured) {
      const { data, error } = await supabaseAdmin
        .from('businesses')
        .select('id')
        .eq('slug', slug)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      if (error) {
        return res.status(503).json({
          success: false,
          error: { code: 'SERVICE_UNAVAILABLE', message: 'Serviço temporariamente indisponível.', timestamp: new Date().toISOString() }
        });
      }

      if (data) {
        businessId = data.id;
      }
    } else {
      if (!isDemoMode()) {
        return res.status(503).json({
          success: false,
          error: { code: 'SERVICE_UNAVAILABLE', message: 'Banco de dados principal não está configurado.', timestamp: new Date().toISOString() }
        });
      }
      const localBiz = localDb.businesses.find(b => b.slug === slug && b.status === 'ACTIVE');
      if (localBiz) {
        businessId = localBiz.id;
      }
    }

    if (!businessId) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'BUSINESS_NOT_FOUND',
          message: 'Estabelecimento não encontrado.',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Verificar se likes estão habilitados no design
    let enableLikes = true;
    if (isSupabaseConfigured) {
      const { data: dData } = await supabaseAdmin
        .from('design_settings')
        .select('custom_config')
        .eq('business_id', businessId)
        .maybeSingle();

      if (dData?.custom_config?.enable_likes === false) {
        enableLikes = false;
      }
    } else {
      const localDesign = localDb.designSettings[businessId];
      if (localDesign?.custom_config?.enable_likes === false) {
        enableLikes = false;
      }
    }

    if (!enableLikes) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FEATURE_DISABLED',
          message: 'O sistema de curtidas foi desativado por este estabelecimento.',
          timestamp: new Date().toISOString()
        }
      });
    }

    let newLikes = 1;

    if (isSupabaseConfigured) {
      // 1. Tentar RPC atômica caso instalada no Supabase
      const { data: rpcLikes, error: rpcErr } = await supabaseAdmin.rpc('increment_likes', {
        p_item_id: itemId,
        p_business_id: businessId
      });

      if (!rpcErr && typeof rpcLikes === 'number') {
        newLikes = rpcLikes;
      } else {
        // 2. Fallback de persistência segura com filtro por business_id
        const { data: item, error: itemErr } = await supabaseAdmin
          .from('menu_items')
          .select('likes_count')
          .eq('id', itemId)
          .eq('business_id', businessId)
          .maybeSingle();

        if (itemErr || !item) {
          return res.status(404).json({
            success: false,
            error: { code: 'ITEM_NOT_FOUND', message: 'Item não encontrado.', timestamp: new Date().toISOString() }
          });
        }

        newLikes = Math.max((item.likes_count || 0) + 1, 0);
        await supabaseAdmin
          .from('menu_items')
          .update({ likes_count: newLikes })
          .eq('id', itemId)
          .eq('business_id', businessId);
      }
    } else {
      // Modo local/demo
      const localItem = localDb.items.find(i => i.id === itemId && i.business_id === businessId);
      if (!localItem) {
        return res.status(404).json({
          success: false,
          error: { code: 'ITEM_NOT_FOUND', message: 'Item não encontrado no catálogo.', timestamp: new Date().toISOString() }
        });
      }
      localItem.likes_count = (localItem.likes_count || 0) + 1;
      newLikes = localItem.likes_count;
    }

    return res.status(200).json({
      success: true,
      data: {
        itemId,
        likesCount: newLikes
      }
    });
  } catch (error) {
    next(error);
  }
};
