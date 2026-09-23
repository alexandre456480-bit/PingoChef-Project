import crypto from 'crypto';

/**
 * Retorna true somente quando APP_MODE=demo E NODE_ENV !== production.
 * Em produção, localDb NUNCA deve ser utilizado.
 */
export function isDemoMode(): boolean {
  return (
    process.env.APP_MODE === 'demo' &&
    process.env.NODE_ENV !== 'production'
  );
}

export interface LocalUser {
  id: string;
  email: string;
  /** Hash da senha — NUNCA armazena texto puro */
  passwordHash: string;
  fullName: string;
}

export interface LocalBusiness {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  status: 'PENDING_ACTIVATION' | 'ACTIVE' | 'SUSPENDED';
  phone?: string | null;
  whatsapp?: string | null;
  logo_url?: string | null;
  cover_image_url?: string | null;
  description?: string | null;
  welcome_bg_type?: 'image' | 'color';
  welcome_bg_image?: string | null;
  welcome_bg_color?: string | null;
}

export interface LocalActivationToken {
  id: string;
  /** Armazena HMAC do token, não o token em si */
  tokenHash: string;
  business_id: string;
  is_used: boolean;
  expires_at: string;
}

export interface LocalCategory {
  id: string;
  business_id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  icon_type: '2d' | '3d' | 'image' | 'none';
  icon_key?: string | null;
  image_url?: string | null;
  display_order: number;
  display_mode?: 'icon_only' | 'icon_text_side' | 'icon_text_stacked';
  is_active: boolean;
  created_at: string;
}

export interface LocalSubcategory {
  id: string;
  business_id: string;
  category_id: string;
  name: string;
  display_order: number;
  created_at: string;
}

export interface LocalItem {
  id: string;
  business_id: string;
  category_id: string;
  subcategory_id?: string | null;
  name: string;
  description?: string | null;
  price: number;
  promotional_price?: number | null;
  image_url?: string | null;
  is_available: boolean;
  is_highlighted: boolean;
  highlight_type?: 'none' | 'promotion' | 'most_liked' | 'chef' | 'combo' | 'best_seller';
  likes_count?: number;
  display_order: number;
  show_price?: boolean;
  created_at: string;
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

class LocalDatabase {
  users: LocalUser[] = [];
  businesses: LocalBusiness[] = [];
  activationTokens: LocalActivationToken[] = [];
  categories: LocalCategory[] = [];
  subcategories: LocalSubcategory[] = [];
  items: LocalItem[] = [];
  designSettings: Record<string, any> = {};

  constructor() {
    // Só faz seed se estiver em modo demo
    if (isDemoMode()) {
      this.seedDefaultAccount();
    }
  }

  /**
   * Hasheia senha para armazenamento
   */
  hashPassword(password: string): string {
    return hashPassword(password);
  }

  /**
   * Verifica senha do usuário demo (compara hash, nunca texto puro)
   */
  verifyPassword(plainPassword: string, storedHash: string): boolean {
    return hashPassword(plainPassword) === storedHash;
  }

  seedDefaultAccount() {
    const defaultUserId = 'usr_alexandre_01';
    const defaultBizId = 'biz_sapatolandia_01';

    this.users.push({
      id: defaultUserId,
      email: 'alexandre45648@gmail.com',
      passwordHash: hashPassword('demo_password_placeholder'),
      fullName: 'Alexandre'
    });

    this.businesses.push({
      id: defaultBizId,
      owner_user_id: defaultUserId,
      name: 'Sapatolândia Gourmet',
      slug: 'sapatolandia-gourmet',
      status: 'ACTIVE',
      phone: '11999999999',
      whatsapp: '11999999999',
      logo_url: '/logo_img.webp',
      cover_image_url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80',
      description: 'Hamburgueria artesanal & gastronomia autoral com carnes nobres grelhadas no fogo.',
      welcome_bg_type: 'image',
      welcome_bg_image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80',
      welcome_bg_color: '#0F0F12'
    });

    // Token de ativação (hash HMAC, não texto puro)
    this.activationTokens.push({
      id: 'tok_01',
      tokenHash: crypto.createHmac('sha256', 'demo-secret').update('ACT-DEMO-001').digest('hex'),
      business_id: defaultBizId,
      is_used: true,
      expires_at: new Date(Date.now() + 86400000).toISOString()
    });

    this.seedBusinessMenu(defaultBizId);
  }

  seedBusinessMenu(businessId: string) {
    if (this.categories.some(c => c.business_id === businessId)) {
      return; // Já semeado para este negócio
    }

    // Configuração de design padrão
    this.designSettings[businessId] = {
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
        { id: 'block_featured', type: 'featured_product', label: 'Especial da Casa', enabled: true, position: 4 },
        { id: 'block_combos', type: 'combo', label: 'Combos Especiais', enabled: true, position: 5 },
        { id: 'block_best_sellers', type: 'best_seller', label: 'Mais Vendidos', enabled: true, position: 6 }
      ],
      custom_config: {
        welcome_tagline: 'Experiência gastronômica artesanal e inesquecível',
        enable_likes: true,
        enable_cart: true,
        hero_banners: [
          'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80'
        ],
        intro_card: {
          enabled: true,
          title: 'Gastronomia Autoral & Ingredientes Nobres',
          description: 'Seja muito bem-vindo ao nosso espaço gastronômico! Nossos pratos e burgers são elaborados com carnes nobres grelhadas no fogo e pães artesanais de fermentação natural. Escolha abaixo suas opções favoritas e bom apetite.'
        }
      }
    };

    const prefix = businessId === 'biz_sapatolandia_01' ? '' : `${businessId}_`;
    const catBurgers = `${prefix}cat_01`;
    const catBebidas = `${prefix}cat_02`;
    const catSobremesas = `${prefix}cat_03`;
    const catPorcoes = `${prefix}cat_04`;

    this.categories.push(
      {
        id: catBurgers,
        business_id: businessId,
        name: 'Hambúrgueres Artesanais',
        description: 'Blends especiais 100% bovinos grelhados no fogo',
        icon: '3d-burger',
        icon_type: '3d',
        icon_key: '3d-burger',
        image_url: null,
        display_order: 1,
        is_active: true,
        created_at: new Date().toISOString()
      },
      {
        id: catPorcoes,
        business_id: businessId,
        name: 'Porções & Acompanhamentos',
        description: 'Batatas rústicas e petiscos crocantes',
        icon: '3d-fries',
        icon_type: '3d',
        icon_key: '3d-fries',
        image_url: null,
        display_order: 2,
        is_active: true,
        created_at: new Date().toISOString()
      },
      {
        id: catBebidas,
        business_id: businessId,
        name: 'Bebidas & Chopp',
        description: 'Refrigerantes, sucos naturais e cervejas geladas',
        icon: '3d-beer',
        icon_type: '3d',
        icon_key: '3d-beer',
        image_url: null,
        display_order: 3,
        is_active: true,
        created_at: new Date().toISOString()
      },
      {
        id: catSobremesas,
        business_id: businessId,
        name: 'Sobremesas',
        description: 'Doces artesanais irresistíveis',
        icon: '3d-dessert',
        icon_type: '3d',
        icon_key: '3d-dessert',
        image_url: null,
        display_order: 4,
        is_active: true,
        created_at: new Date().toISOString()
      }
    );

    // Subcategorias de exemplo
    const subcatClassicos = `${prefix}subcat_01`;
    const subcatSmash = `${prefix}subcat_02`;
    const subcatFrango = `${prefix}subcat_03`;
    const subcatChopp = `${prefix}subcat_04`;
    const subcatSucos = `${prefix}subcat_05`;

    this.subcategories.push(
      {
        id: subcatClassicos,
        business_id: businessId,
        category_id: catBurgers,
        name: 'Artesanais Clássicos',
        display_order: 0,
        created_at: new Date().toISOString()
      },
      {
        id: subcatSmash,
        business_id: businessId,
        category_id: catBurgers,
        name: 'Smash Burgers',
        display_order: 1,
        created_at: new Date().toISOString()
      },
      {
        id: subcatFrango,
        business_id: businessId,
        category_id: catBurgers,
        name: 'Hambúrguer de Frango',
        display_order: 2,
        created_at: new Date().toISOString()
      },
      {
        id: subcatChopp,
        business_id: businessId,
        category_id: catBebidas,
        name: 'Chopps & Cervejas',
        display_order: 0,
        created_at: new Date().toISOString()
      },
      {
        id: subcatSucos,
        business_id: businessId,
        category_id: catBebidas,
        name: 'Sucos & Refrigerantes',
        display_order: 1,
        created_at: new Date().toISOString()
      }
    );

    // Itens de exemplo com fotos reais de alta resolução
    this.items.push(
      {
        id: `${prefix}item_01`,
        business_id: businessId,
        category_id: catBurgers,
        subcategory_id: subcatClassicos,
        name: 'Bacon Supreme Burger',
        description: 'Pão brioche tostado na manteiga, burger 180g, fatias crocantes de bacon e muito cheddar cremoso.',
        price: 34.90,
        promotional_price: 29.90,
        image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
        is_available: true,
        is_highlighted: true,
        highlight_type: 'promotion',
        likes_count: 52,
        display_order: 0,
        created_at: new Date().toISOString()
      },
      {
        id: `${prefix}item_02`,
        business_id: businessId,
        category_id: catBurgers,
        subcategory_id: subcatSmash,
        name: 'Smash Cheese Duplo',
        description: '2x smash burgers de 90g com crostinha caramelizada perfeita, dobro de queijo prato e molho especial da casa.',
        price: 28.50,
        promotional_price: null,
        image_url: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=800&q=80',
        is_available: true,
        is_highlighted: true,
        highlight_type: 'most_liked',
        likes_count: 84,
        display_order: 1,
        created_at: new Date().toISOString()
      },
      {
        id: `${prefix}item_03`,
        business_id: businessId,
        category_id: catBurgers,
        subcategory_id: subcatFrango,
        name: 'Crispy Chicken Supreme',
        description: 'Filé de sobrecoxa ultra crocante empanado no panko, picles artesanal, alface americana e maionese defumada.',
        price: 32.00,
        promotional_price: 27.90,
        image_url: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=800&q=80',
        is_available: true,
        is_highlighted: true,
        highlight_type: 'chef',
        likes_count: 41,
        display_order: 2,
        created_at: new Date().toISOString()
      },
      {
        id: `${prefix}item_04`,
        business_id: businessId,
        category_id: catBurgers,
        subcategory_id: subcatClassicos,
        name: 'Monster Cheddar BBQ',
        description: 'Hambúrguer 200g angus grelhado na brasa, cebola crispy caramelizada, molho barbecue artesanal e piscina de cheddar.',
        price: 38.90,
        promotional_price: null,
        image_url: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=800&q=80',
        is_available: true,
        is_highlighted: true,
        highlight_type: 'best_seller',
        likes_count: 98,
        display_order: 3,
        created_at: new Date().toISOString()
      },
      {
        id: `${prefix}item_05`,
        business_id: businessId,
        category_id: catPorcoes,
        subcategory_id: null,
        name: 'Batata Rústica com Alecrim & Páprica',
        description: 'Batatas selecionadas crocantes por fora e macias por dentro, salpicadas com sal marinho, páprica e alecrim fresco.',
        price: 26.00,
        promotional_price: 21.90,
        image_url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80',
        is_available: true,
        is_highlighted: true,
        highlight_type: 'promotion',
        likes_count: 63,
        display_order: 0,
        created_at: new Date().toISOString()
      },
      {
        id: `${prefix}item_06`,
        business_id: businessId,
        category_id: catPorcoes,
        subcategory_id: null,
        name: 'Onion Rings Crocantes com BBQ',
        description: 'Anéis de cebola gigantes empanados com tempero secreto, fritos na hora e servidos com molho barbecue defumado.',
        price: 24.00,
        promotional_price: null,
        image_url: 'https://images.unsplash.com/photo-1639024471287-032f66af4d6e?auto=format&fit=crop&w=800&q=80',
        is_available: true,
        is_highlighted: false,
        highlight_type: 'none',
        likes_count: 18,
        display_order: 1,
        created_at: new Date().toISOString()
      },
      {
        id: `${prefix}item_07`,
        business_id: businessId,
        category_id: catPorcoes,
        subcategory_id: null,
        name: 'Super Combo Artesanal (Burger + Batata + Chopp)',
        description: '1 Bacon Supreme Burger, 1 porção de batata rústica crocante e 1 Chopp artesanal IPA 500ml gelado.',
        price: 58.00,
        promotional_price: 49.90,
        image_url: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=800&q=80',
        is_available: true,
        is_highlighted: true,
        highlight_type: 'combo',
        likes_count: 73,
        display_order: 2,
        created_at: new Date().toISOString()
      },
      {
        id: `${prefix}item_08`,
        business_id: businessId,
        category_id: catBebidas,
        subcategory_id: subcatChopp,
        name: 'Chopp Artesanal IPA 500ml',
        description: 'Chopp artesanal aromático com lúpulos selecionados, notas cítricas e espuma cremosa bem tirada.',
        price: 18.00,
        promotional_price: 15.00,
        image_url: 'https://images.unsplash.com/photo-1608270119864-1628d7522d05?auto=format&fit=crop&w=800&q=80',
        is_available: true,
        is_highlighted: true,
        highlight_type: 'most_liked',
        likes_count: 73,
        display_order: 0,
        created_at: new Date().toISOString()
      },
      {
        id: `${prefix}item_09`,
        business_id: businessId,
        category_id: catBebidas,
        subcategory_id: subcatSucos,
        name: 'Soda Italiana de Maçã Verde 450ml',
        description: 'Refrescante água gaseificada com xarope francês de maçã verde, gelo e rodelas de limão siciliano.',
        price: 14.50,
        promotional_price: null,
        image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
        is_available: true,
        is_highlighted: false,
        highlight_type: 'none',
        likes_count: 14,
        display_order: 1,
        created_at: new Date().toISOString()
      },
      {
        id: `${prefix}item_10`,
        business_id: businessId,
        category_id: catBebidas,
        subcategory_id: subcatSucos,
        name: 'Suco Natural Frutas Vermelhas 500ml',
        description: 'Amora, morango e framboesa batidos na hora com água de coco ou água mineral bem gelada.',
        price: 16.00,
        promotional_price: null,
        image_url: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=800&q=80',
        is_available: true,
        is_highlighted: false,
        highlight_type: 'none',
        likes_count: 22,
        display_order: 2,
        created_at: new Date().toISOString()
      },
      {
        id: `${prefix}item_11`,
        business_id: businessId,
        category_id: catSobremesas,
        subcategory_id: null,
        name: 'Brownie com Sorvete e Calda Fudge',
        description: 'Brownie quentinho de chocolate meio amargo 70%, castanhas nobres, acompanhado de sorvete de baunilha de Madagascar.',
        price: 24.00,
        promotional_price: 19.90,
        image_url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80',
        is_available: true,
        is_highlighted: true,
        highlight_type: 'promotion',
        likes_count: 91,
        display_order: 0,
        created_at: new Date().toISOString()
      },
      {
        id: `${prefix}item_12`,
        business_id: businessId,
        category_id: catSobremesas,
        subcategory_id: null,
        name: 'Petit Gâteau com Gelato de Pistache',
        description: 'Bolo fofo de chocolate com recheio cremoso e fumegante de chocolate derretido, servido com gelato artesanal de pistache.',
        price: 28.00,
        promotional_price: null,
        image_url: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=800&q=80',
        is_available: true,
        is_highlighted: true,
        highlight_type: 'chef',
        likes_count: 67,
        display_order: 1,
        created_at: new Date().toISOString()
      }
    );
  }
}

export const localDb = new LocalDatabase();
