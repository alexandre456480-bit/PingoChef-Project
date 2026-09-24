import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../constants/api';

// ── Interfaces de Cores & Paletas ──

export interface PaletteColors {
  primary: string;       // Marca principal, botões e cabeçalhos
  secondary: string;     // Detalhes secundários, bordas suaves, chips
  accent: string;        // Preços, promoções, likes e pontos de foco
  background: string;    // Fundo da página e canvas geral
  surface: string;       // Cartões de produto, modais e barra superior
  textPrimary: string;   // Títulos e nomes com contraste AAA
  textSecondary: string; // Descrições, preços antigos e legendas
}

export interface PaletteConfig {
  key: string;
  name: string;
  isCustom?: boolean;
  colors: PaletteColors;
}

// ── Interfaces de Estrutura de Templates ──

export interface TemplateConfig {
  key: string;
  name: string;
  description: string;
  idealFor: string;
  heroStyle: 'full-width' | 'contained' | 'split' | 'overlay';
  logoPosition: 'top-center' | 'above-hero' | 'hero-center' | 'hero-bottom-center' | 'top-left';
  categoryLayout: 'horizontal-scroll' | 'grid' | 'tabs';
  itemCardStyle: 'minimal' | 'photo-dominant' | 'side-by-side' | 'overlay';
  cardBorderRadius: number;
  surfaceStyle: 'flat' | 'glassmorphism' | 'claymorphism';
  cardShadow: 'none' | 'subtle' | 'layered-deep' | 'clay-3d' | 'neon-glow';
}

// ── Interfaces de Tipografia ──

export interface FontOption {
  key: string;
  name: string;
  family: string;
  category: 'Serifada' | 'Sans-serif' | 'Display / Moderna' | 'Condensada';
  sample: string;
}

export interface FontPairPreset {
  key: string;
  name: string;
  heading: string;
  body: string;
  idealFor: string;
}

export interface HomeBlock {
  id: string;
  type: 'hero' | 'promotion' | 'most_liked' | 'featured_product' | 'categories' | 'combo' | 'best_seller';
  label: string;
  enabled: boolean;
  position: number;
  required?: boolean;
}

export interface IntroCardConfig {
  enabled: boolean;
  title: string;
  description: string;
}

export interface CategoryHeroConfig {
  enabled: boolean;
  banners: string[]; // Até 3 imagens por categoria
}

export interface DesignSettings {
  templateKey: string;
  palette: PaletteConfig;
  fontHeading: string;
  fontBody: string;
  fontPair?: string;
  categoryStyle: 'icon' | 'name' | 'icon_name';
  motion: 'fade' | 'slide' | 'scale' | 'none';
  homeBlocks: HomeBlock[];
  heroBanners: string[]; // Até 5 banners dinâmicos na Hero Section
  heroScope?: 'all' | 'home_only'; // 'all': vale para todas as categorias; 'home_only': vale apenas para o início
  categoryHeroConfigs?: Record<string, CategoryHeroConfig>; // Banners e ativação de hero por categoria
  introCard?: IntroCardConfig;
  customConfig?: Record<string, unknown>;
}

// ── 1. Templates Disponíveis (4 Estruturas Únicas) ──

export const AVAILABLE_TEMPLATES: TemplateConfig[] = [
  {
    key: 'minimal',
    name: 'Minimalist Clean',
    description: 'Design arejado, logo acima da hero section, cards flat e respiro elegante',
    idealFor: 'Cafés autorais, bistrôs, confeitarias artesanais',
    heroStyle: 'contained',
    logoPosition: 'above-hero',
    categoryLayout: 'horizontal-scroll',
    itemCardStyle: 'minimal',
    cardBorderRadius: 14,
    surfaceStyle: 'flat',
    cardShadow: 'subtle'
  },
  {
    key: 'modern',
    name: 'Claymorphism 3D',
    description: 'Sombras 3D táteis e orgânicas, cantos inflados (24px) e botões volumétricos',
    idealFor: 'Hamburguerias, açaí, street food, fast casual',
    heroStyle: 'split',
    logoPosition: 'top-left',
    categoryLayout: 'horizontal-scroll',
    itemCardStyle: 'side-by-side',
    cardBorderRadius: 24,
    surfaceStyle: 'claymorphism',
    cardShadow: 'clay-3d'
  },
  {
    key: 'premium',
    name: 'Premium Dining',
    description: 'Hero full-width cinematográfico, logo flutuante no centro inferior da capa',
    idealFor: 'Restaurantes sofisticados, steakhouses, culinária japonesa',
    heroStyle: 'full-width',
    logoPosition: 'hero-bottom-center',
    categoryLayout: 'tabs',
    itemCardStyle: 'photo-dominant',
    cardBorderRadius: 18,
    surfaceStyle: 'flat',
    cardShadow: 'layered-deep'
  },
  {
    key: 'dark',
    name: 'Dark Glass & Neon',
    description: 'Superfícies translúcidas glassmorphism com blur, iluminação ambiente e neon glow',
    idealFor: 'Bares noturnos, pubs, lounges, hamburguerias artesanais',
    heroStyle: 'overlay',
    logoPosition: 'top-left',
    categoryLayout: 'horizontal-scroll',
    itemCardStyle: 'overlay',
    cardBorderRadius: 20,
    surfaceStyle: 'glassmorphism',
    cardShadow: 'neon-glow'
  }
];

// ── 2. 7 Paletas de Cores Profissionais Curadas com 7 Tokens Cada ──

export const AVAILABLE_PALETTES: PaletteConfig[] = [
  {
    key: 'gourmet_royal',
    name: 'Gourmet Royal',
    colors: {
      primary: '#8B1A3A',     // Vinho Nobre Profundo
      secondary: '#D26E2D',   // Terracota
      accent: '#F47B20',      // Âmbar Radiante (Preço & CTA)
      background: '#FAF5F0',  // Fundo Creme Aveludado
      surface: '#FFFFFF',     // Branco Puro em Cards
      textPrimary: '#2D1822',  // Aubergine Escuro (Contraste AAA)
      textSecondary: '#6E5D65' // Slate Neutro Quente
    }
  },
  {
    key: 'obsidian_luxe',
    name: 'Obsidian Luxe',
    colors: {
      primary: '#D4AF37',     // Ouro Metálico Esculpido
      secondary: '#3B3B4F',   // Ardósia Nobre
      accent: '#FFD700',      // Ouro Cintilante
      background: '#0D0D12',  // Noite Obsidian Profunda
      surface: '#171722',     // Carvão Elevado com Contraste
      textPrimary: '#F8F8FA',  // Branco Puro Nítido
      textSecondary: '#9E9EB2' // Prata Suave
    }
  },
  {
    key: 'emerald_forest',
    name: 'Emerald Forest',
    colors: {
      primary: '#1B4D3E',     // Verde Esmeralda Botânico
      secondary: '#4E8768',   // Oliva Salvia
      accent: '#E67E22',      // Tangerina Destaque
      background: '#F4F8F5',  // Menta Suave
      surface: '#FFFFFF',     // Branco Puro
      textPrimary: '#132E24',  // Floresta Quase Preto
      textSecondary: '#527063' // Menta Seca Muted
    }
  },
  {
    key: 'neon_cyber',
    name: 'Neon Cyber-Bar',
    colors: {
      primary: '#8B5CF6',     // Roxo Ultravioleta
      secondary: '#EC4899',   // Magenta Néon
      accent: '#06B6D4',      // Ciano Elétrico
      background: '#0B0B14',  // Espaço Noturno Profundo
      surface: '#141424',     // Violeta Noturno Elevado
      textPrimary: '#F1F5F9',  // Branco Cristalino
      textSecondary: '#94A3B8' // Ardósia Fria
    }
  },
  {
    key: 'sunset_bistro',
    name: 'Sunset Bistro',
    colors: {
      primary: '#C0392B',     // Carmim Italiano
      secondary: '#E67E22',   // Terracota Quente
      accent: '#F39C12',      // Mel Dourado
      background: '#FDF7F2',  // Trigo Suave
      surface: '#FFFFFF',     // Branco Puro
      textPrimary: '#2C1B18',  // Café Espresso Escuro
      textSecondary: '#735650' // Argila Muted
    }
  },
  {
    key: 'nordic_slate',
    name: 'Nordic Slate',
    colors: {
      primary: '#1E3A5F',     // Azul Petróleo Nórdico
      secondary: '#4A7A96',   // Azul Ardósia
      accent: '#D97706',      // Cobre Âmbar
      background: '#F8FAFC',  // Geada Limpa
      surface: '#FFFFFF',     // Branco Puro
      textPrimary: '#0F172A',  // Midnight Profundo
      textSecondary: '#64748B' // Ardósia Suave
    }
  },
  {
    key: 'midnight_ruby',
    name: 'Midnight Ruby',
    colors: {
      primary: '#E11D48',     // Rubi Carmim Vibrante
      secondary: '#371B24',   // Carvão Berry
      accent: '#FB7185',      // Rosa Glow Aveludado
      background: '#100D11',  // Ameixa Noturna Escura
      surface: '#1B161D',     // Rubi Escurecido Elevado
      textPrimary: '#FAFAFA',  // Off-White Iluminado
      textSecondary: '#A19BA5' // Prata Quente
    }
  }
];

// ── 3. Tipografias Disponíveis para Escolha (Até 2 Fontes) ──

export const AVAILABLE_HEADING_FONTS: FontOption[] = [
  { key: 'outfit', name: 'Outfit', family: 'Outfit', category: 'Display / Moderna', sample: 'Sabor Contemporâneo' },
  { key: 'playfair', name: 'Playfair Display', family: 'Playfair Display', category: 'Serifada', sample: 'Elegância & Alta Gastronomia' },
  { key: 'cinzel', name: 'Cinzel', family: 'Cinzel', category: 'Serifada', sample: 'Imperial & Luxo Absoluto' },
  { key: 'righteous', name: 'Righteous', family: 'Righteous', category: 'Display / Moderna', sample: 'Vibrante & Smash Burger' },
  { key: 'dm_serif', name: 'DM Serif Display', family: 'DM Serif Display', category: 'Serifada', sample: 'Artesanal & Bistrô' },
  { key: 'plus_jakarta', name: 'Plus Jakarta Sans', family: 'Plus Jakarta Sans', category: 'Sans-serif', sample: 'Minimalismo Cosmopolita' },
  { key: 'bebas_neue', name: 'Bebas Neue', family: 'Bebas Neue', category: 'Condensada', sample: 'IMPACTO & FORÇA VISUAL' },
  { key: 'merriweather', name: 'Merriweather', family: 'Merriweather', category: 'Serifada', sample: 'Tradição & Acolhimento' },
  { key: 'syne', name: 'Syne', family: 'Syne', category: 'Display / Moderna', sample: 'Vanguarda & Coquetelaria' }
];

export const AVAILABLE_BODY_FONTS: FontOption[] = [
  { key: 'inter', name: 'Inter', family: 'Inter', category: 'Sans-serif', sample: 'Legibilidade máxima e clareza perfeita para preços e descrições.' },
  { key: 'dm_sans', name: 'DM Sans', family: 'DM Sans', category: 'Sans-serif', sample: 'Linhas contemporâneas, geométricas e suaves aos olhos.' },
  { key: 'lora', name: 'Lora', family: 'Lora', category: 'Serifada', sample: 'Estilo literário refinado para descrições detalhadas dos pratos.' },
  { key: 'nunito', name: 'Nunito', family: 'Nunito', category: 'Sans-serif', sample: 'Curvas amigáveis, acolhedoras e altamente legíveis.' },
  { key: 'plus_jakarta_body', name: 'Plus Jakarta Sans', family: 'Plus Jakarta Sans', category: 'Sans-serif', sample: 'Equilíbrio primoroso entre técnica moderna e ergonomia de leitura.' },
  { key: 'space_grotesk', name: 'Space Grotesk', family: 'Space Grotesk', category: 'Display / Moderna', sample: 'Personalidade marcante e proporções equilibradas.' },
  { key: 'quicksand', name: 'Quicksand', family: 'Quicksand', category: 'Sans-serif', sample: 'Leveza e frescor moderno para ambientes descontraídos.' }
];

export const AVAILABLE_FONT_PAIRS: FontPairPreset[] = [
  { key: 'modern_clean', name: 'Moderna & Clean', heading: 'Outfit', body: 'Inter', idealFor: 'Cafés, açaí, poké e contemporâneo' },
  { key: 'fine_dining', name: 'Fine Dining & Luxo', heading: 'Playfair Display', body: 'Lora', idealFor: 'Restaurantes requintados e cartas de vinho' },
  { key: 'imperial_luxury', name: 'Imperial Steakhouse', heading: 'Cinzel', body: 'DM Sans', idealFor: 'Carnes nobres, churrascarias e adegas' },
  { key: 'artisan_bistro', name: 'Bistrô Artesanal', heading: 'DM Serif Display', body: 'Nunito', idealFor: 'Padarias artesanais e cantinas italianas' },
  { key: 'urban_burger', name: 'Urban Burger & Pub', heading: 'Bebas Neue', body: 'Inter', idealFor: 'Hamburguerias artesanais e chopeiras' },
  { key: 'retro_vibe', name: 'Retrô & Descontraído', heading: 'Righteous', body: 'Quicksand', idealFor: 'Docerias, sorveterias e lanches' },
  { key: 'avant_garde', name: 'Vanguarda & Autoral', heading: 'Syne', body: 'Plus Jakarta Sans', idealFor: 'Lounge bars e gastronomia autoral' }
];

// ── 4. Blocos da Página Inicial ──

export const DEFAULT_HOME_BLOCKS: HomeBlock[] = [
  { id: 'block_hero', type: 'hero', label: 'Hero / Capa', enabled: true, position: 0 },
  { id: 'block_categories', type: 'categories', label: 'Categorias', enabled: true, position: 1 },
  { id: 'block_promotion', type: 'promotion', label: 'Promoções & Ofertas', enabled: true, position: 2 },
  { id: 'block_most_liked', type: 'most_liked', label: 'Mais Curtidos', enabled: true, position: 3 },
  { id: 'block_featured', type: 'featured_product', label: 'Pratos do Chef', enabled: true, position: 4 },
  { id: 'block_combos', type: 'combo', label: 'Combos Especiais', enabled: true, position: 5 },
  { id: 'block_best_sellers', type: 'best_seller', label: 'Mais Vendidos', enabled: true, position: 6 }
];

export const DEFAULT_HERO_BANNERS: string[] = [
  'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80'
];

export const DEFAULT_INTRO_CARD: IntroCardConfig = {
  enabled: true,
  title: 'Gastronomia Autoral & Ingredientes Nobres',
  description: 'Seja muito bem-vindo ao nosso espaço gastronômico! Nossos pratos e burgers são elaborados com carnes nobres grelhadas no fogo e pães artesanais de fermentação natural. Escolha abaixo suas opções favoritas e bom apetite.'
};

// ── 5. Service Principal ──

@Injectable({
  providedIn: 'root'
})
export class DesignService {
  private apiUrl = API_BASE_URL;

  // Estado salvo (do servidor)
  savedDesign = signal<DesignSettings | null>(null);

  // Rascunho local (editável, para preview em tempo real)
  draft = signal<DesignSettings>({
    templateKey: 'modern',
    palette: AVAILABLE_PALETTES[0], // Gourmet Royal
    fontHeading: 'Outfit',
    fontBody: 'Inter',
    fontPair: 'modern_clean',
    categoryStyle: 'icon_name',
    motion: 'fade',
    homeBlocks: [...DEFAULT_HOME_BLOCKS],
    heroBanners: [...DEFAULT_HERO_BANNERS],
    heroScope: 'all',
    introCard: { ...DEFAULT_INTRO_CARD }
  });

  // Flag indicando alterações não salvas
  hasUnsavedChanges = computed(() => {
    const saved = this.savedDesign();
    const current = this.draft();
    if (!saved) return true;
    return JSON.stringify(saved) !== JSON.stringify(current);
  });

  // Computed helpers
  currentTemplate = computed(() =>
    AVAILABLE_TEMPLATES.find(t => t.key === this.draft().templateKey) || AVAILABLE_TEMPLATES[1]
  );

  currentPalette = computed(() => this.draft().palette);

  headingFont = computed(() => this.draft().fontHeading || 'Outfit');
  bodyFont = computed(() => this.draft().fontBody || 'Inter');
  heroBanners = computed(() => this.draft().heroBanners || DEFAULT_HERO_BANNERS);
  heroScope = computed(() => this.draft().heroScope || 'all');
  introCard = computed(() => this.draft().introCard || DEFAULT_INTRO_CARD);
  enableLikes = computed(() => (this.draft().customConfig as any)?.enable_likes !== false);
  enableCart = computed(() => (this.draft().customConfig as any)?.enable_cart !== false);

  // Sincronização em tempo real da categoria visualizada no preview do smartphone
  previewCategory = signal<string | null>(null);

  setPreviewCategory(catId: string | null): void {
    this.previewCategory.set(catId);
  }

  constructor(private http: HttpClient) { }

  private getAuthHeaders(): { headers: HttpHeaders } {
    const token = localStorage.getItem('access_token') || '';
    return {
      headers: new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      })
    };
  }

  // ── MUTAÇÕES DO RASCUNHO ──

  /**
   * Altera exclusivamente a estrutura do template.
   * Paletas de cores e fontes permanecem 100% inalteradas!
   */
  setTemplate(key: string): void {
    const template = AVAILABLE_TEMPLATES.find(t => t.key === key);
    if (template) {
      this.draft.update(d => ({
        ...d,
        templateKey: key
      }));
    }
  }

  setPalette(palette: PaletteConfig): void {
    this.draft.update(d => ({ ...d, palette }));
  }

  setCustomColor(tokenKey: keyof PaletteColors, hexValue: string): void {
    this.draft.update(d => {
      const current = d.palette.colors;
      const updatedColors: PaletteColors = {
        ...current,
        [tokenKey]: hexValue
      };

      return {
        ...d,
        palette: {
          key: 'custom',
          name: 'Personalizada',
          isCustom: true,
          colors: updatedColors
        }
      };
    });
  }

  setHeadingFont(fontFamily: string): void {
    this.draft.update(d => ({
      ...d,
      fontHeading: fontFamily,
      fontPair: 'custom'
    }));
  }

  setBodyFont(fontFamily: string): void {
    this.draft.update(d => ({
      ...d,
      fontBody: fontFamily,
      fontPair: 'custom'
    }));
  }

  setFontPair(presetKey: string): void {
    const preset = AVAILABLE_FONT_PAIRS.find(p => p.key === presetKey);
    if (preset) {
      this.draft.update(d => ({
        ...d,
        fontHeading: preset.heading,
        fontBody: preset.body,
        fontPair: presetKey
      }));
    }
  }

  // Gestão de Banners da Hero Section (Até 5)
  addHeroBanner(url: string): void {
    const current = this.draft().heroBanners || [];
    if (current.length < 5 && url.trim()) {
      this.draft.update(d => ({
        ...d,
        heroBanners: [...current, url.trim()]
      }));
    }
  }

  removeHeroBanner(index: number): void {
    const current = this.draft().heroBanners || [];
    this.draft.update(d => ({
      ...d,
      heroBanners: current.filter((_, i) => i !== index)
    }));
  }

  setHeroBanners(banners: string[]): void {
    this.draft.update(d => ({
      ...d,
      heroBanners: banners.slice(0, 5)
    }));
  }

  setHeroScope(scope: 'all' | 'home_only'): void {
    this.draft.update(d => ({
      ...d,
      heroScope: scope,
      customConfig: {
        ...(d.customConfig || {}),
        hero_scope: scope
      }
    }));
  }

  // ── Gestão de Hero Section por Categoria (Até 3 banners por categoria) ──

  getCategoryHeroConfig(categoryId: string): CategoryHeroConfig {
    const configs = this.draft().categoryHeroConfigs || {};
    return configs[categoryId] || { enabled: true, banners: [] };
  }

  setCategoryHeroEnabled(categoryId: string, enabled: boolean): void {
    this.draft.update(d => {
      const current = d.categoryHeroConfigs || {};
      const catConfig = current[categoryId] || { enabled: true, banners: [] };
      const updatedConfigs = {
        ...current,
        [categoryId]: {
          ...catConfig,
          enabled
        }
      };
      return {
        ...d,
        categoryHeroConfigs: updatedConfigs,
        customConfig: {
          ...(d.customConfig || {}),
          category_hero_configs: updatedConfigs
        }
      };
    });
  }

  addCategoryHeroBanner(categoryId: string, url: string): void {
    const u = url.trim();
    if (!u) return;
    this.draft.update(d => {
      const current = d.categoryHeroConfigs || {};
      const catConfig = current[categoryId] || { enabled: true, banners: [] };
      if (catConfig.banners.length >= 3) return d;
      const updatedConfigs = {
        ...current,
        [categoryId]: {
          ...catConfig,
          banners: [...catConfig.banners, u]
        }
      };
      return {
        ...d,
        categoryHeroConfigs: updatedConfigs,
        customConfig: {
          ...(d.customConfig || {}),
          category_hero_configs: updatedConfigs
        }
      };
    });
  }

  removeCategoryHeroBanner(categoryId: string, index: number): void {
    this.draft.update(d => {
      const current = d.categoryHeroConfigs || {};
      const catConfig = current[categoryId];
      if (!catConfig) return d;
      const updatedConfigs = {
        ...current,
        [categoryId]: {
          ...catConfig,
          banners: catConfig.banners.filter((_, i) => i !== index)
        }
      };
      return {
        ...d,
        categoryHeroConfigs: updatedConfigs,
        customConfig: {
          ...(d.customConfig || {}),
          category_hero_configs: updatedConfigs
        }
      };
    });
  }

  setCategoryStyle(style: DesignSettings['categoryStyle']): void {
    this.draft.update(d => ({ ...d, categoryStyle: style }));
  }

  setMotion(motion: DesignSettings['motion']): void {
    this.draft.update(d => ({ ...d, motion }));
  }

  toggleHomeBlock(blockId: string): void {
    this.draft.update(d => ({
      ...d,
      homeBlocks: d.homeBlocks.map(b =>
        b.id === blockId ? { ...b, enabled: !b.enabled } : b
      )
    }));
  }

  moveBlock(fromIndex: number, toIndex: number): void {
    const blocks = [...this.draft().homeBlocks];
    if (fromIndex < 0 || fromIndex >= blocks.length || toIndex < 0 || toIndex >= blocks.length) return;
    const [moved] = blocks.splice(fromIndex, 1);
    blocks.splice(toIndex, 0, moved);
    this.reorderHomeBlocks(blocks);
  }

  reorderHomeBlocks(blocks: HomeBlock[]): void {
    this.draft.update(d => ({
      ...d,
      homeBlocks: blocks.map((b, i) => ({ ...b, position: i }))
    }));
  }

  setEnableLikes(enabled: boolean): void {
    this.draft.update(d => ({
      ...d,
      customConfig: {
        ...(d.customConfig || {}),
        enable_likes: enabled
      }
    }));
  }

  setEnableCart(enabled: boolean): void {
    this.draft.update(d => ({
      ...d,
      customConfig: {
        ...(d.customConfig || {}),
        enable_cart: enabled
      }
    }));
  }

  setIntroCard(intro: Partial<IntroCardConfig>): void {
    this.draft.update(d => {
      const updated: IntroCardConfig = {
        ...(d.introCard || DEFAULT_INTRO_CARD),
        ...intro
      };
      return {
        ...d,
        introCard: updated,
        customConfig: {
          ...(d.customConfig || {}),
          intro_card: updated
        }
      };
    });
  }

  resetDraft(): void {
    const saved = this.savedDesign();
    if (saved) {
      this.draft.set({
        ...saved,
        homeBlocks: saved.homeBlocks.map(b => ({ ...b })),
        heroBanners: [...(saved.heroBanners || DEFAULT_HERO_BANNERS)],
        heroScope: saved.heroScope || 'all',
        categoryHeroConfigs: { ...(saved.categoryHeroConfigs || {}) },
        introCard: saved.introCard ? { ...saved.introCard } : { ...DEFAULT_INTRO_CARD }
      });
    }
  }

  // ── Chamadas de API ──

  loadDesign(): Observable<any> {
    return this.http.get(`${this.apiUrl}/design`, this.getAuthHeaders()).pipe(
      tap((res: any) => {
        if (res.success && res.data) {
          const rawPal = res.data.palette;
          const matchedPal = AVAILABLE_PALETTES.find(p => p.key === rawPal?.key);
          const palette: PaletteConfig = rawPal?.isCustom || rawPal?.key === 'custom'
            ? rawPal
            : (matchedPal || AVAILABLE_PALETTES[0]);

          const customCfg = res.data.custom_config || {};
          const heroBanners = customCfg.hero_banners || res.data.hero_banners || [...DEFAULT_HERO_BANNERS];
          const categoryHeroConfigs: Record<string, CategoryHeroConfig> = customCfg.category_hero_configs || res.data.category_hero_configs || {};
          const rawIntro = customCfg.intro_card || res.data.intro_card;
          const introCard: IntroCardConfig = rawIntro ? {
            enabled: rawIntro.enabled !== false,
            title: typeof rawIntro.title === 'string' ? rawIntro.title : DEFAULT_INTRO_CARD.title,
            description: typeof rawIntro.description === 'string' ? rawIntro.description : DEFAULT_INTRO_CARD.description
          } : { ...DEFAULT_INTRO_CARD };

          // Merge inteligente garantindo que novos blocos como combo e best_seller estejam sempre disponíveis
          const rawBlocks: HomeBlock[] = Array.isArray(res.data.home_blocks) ? res.data.home_blocks : [];
          const existingTypes = new Set(rawBlocks.map(b => b.type));
          let mergedBlocks = [...rawBlocks];
          DEFAULT_HOME_BLOCKS.forEach(defB => {
            if (!existingTypes.has(defB.type)) {
              mergedBlocks.push({ ...defB, position: mergedBlocks.length });
            }
          });

          const heroScope: 'all' | 'home_only' = customCfg.hero_scope === 'home_only' ? 'home_only' : 'all';

          const settings: DesignSettings = {
            templateKey: res.data.template_key || 'modern',
            palette,
            fontHeading: res.data.font_heading || 'Outfit',
            fontBody: res.data.font_body || 'Inter',
            fontPair: res.data.font_pair || 'modern_clean',
            categoryStyle: res.data.category_style || 'icon_name',
            motion: res.data.motion || 'fade',
            homeBlocks: mergedBlocks,
            heroBanners,
            heroScope,
            categoryHeroConfigs,
            introCard,
            customConfig: customCfg
          };
          this.savedDesign.set(settings);
          this.draft.set({
            ...settings,
            homeBlocks: settings.homeBlocks.map(b => ({ ...b })),
            heroBanners: [...heroBanners],
            heroScope,
            categoryHeroConfigs: { ...categoryHeroConfigs },
            introCard: { ...introCard }
          });
        }
      })
    );
  }

  saveDesign(): Observable<any> {
    const d = this.draft();
    const customConfig = {
      ...(d.customConfig || {}),
      hero_banners: d.heroBanners,
      hero_scope: d.heroScope || 'all',
      category_hero_configs: d.categoryHeroConfigs || {},
      intro_card: d.introCard
    };
    const body = {
      template_key: d.templateKey,
      palette: d.palette,
      font_heading: d.fontHeading,
      font_body: d.fontBody,
      font_pair: d.fontPair || 'custom',
      category_style: d.categoryStyle,
      motion: d.motion,
      home_blocks: d.homeBlocks,
      custom_config: customConfig
    };
    return this.http.put(`${this.apiUrl}/design`, body, this.getAuthHeaders()).pipe(
      tap((res: any) => {
        if (res.success) {
          this.savedDesign.set({
            ...d,
            homeBlocks: d.homeBlocks.map(b => ({ ...b })),
            heroBanners: [...d.heroBanners],
            heroScope: d.heroScope || 'all',
            categoryHeroConfigs: { ...(d.categoryHeroConfigs || {}) },
            introCard: d.introCard ? { ...d.introCard } : { ...DEFAULT_INTRO_CARD }
          });
        }
      })
    );
  }
}
