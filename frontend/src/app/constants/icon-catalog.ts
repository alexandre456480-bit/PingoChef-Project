export interface CatalogIcon {
  id: string;
  name: string;
  type: '2d' | '3d';
  group: 'Lanches' | 'Bebidas' | 'Pratos & Carnes' | 'Pizzas & Massas' | 'Sobremesas' | 'Saudável & Veg' | 'Especiais' | 'Japonês & Oriental' | 'Padaria & Café';
  tags: string[];
  svg: string;
}

export const ICON_GROUPS: Array<CatalogIcon['group']> = [
  'Lanches',
  'Bebidas',
  'Pratos & Carnes',
  'Pizzas & Massas',
  'Sobremesas',
  'Saudável & Veg',
  'Japonês & Oriental',
  'Padaria & Café',
  'Especiais'
];

export const ICON_CATALOG: CatalogIcon[] = [
  // ══════════════════════════════════════════════════
  // ── LANCHES & FAST FOOD ──
  // ══════════════════════════════════════════════════
  {
    id: '2d-burger',
    name: 'Hambúrguer Clássico',
    type: '2d',
    group: 'Lanches',
    tags: ['hamburguer', 'burger', 'artesanal', 'lanche', 'carne', 'cheddar', 'sanduiche'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 11h16a1 1 0 0 0 1-1A7 7 0 0 0 3 10a1 1 0 0 0 1 1Z"/>
      <path d="M6 14h12"/>
      <path d="M4 17h16a2 2 0 0 1 2 2v1H2v-1a2 2 0 0 1 2-2Z"/>
      <circle cx="9" cy="7" r=".7" fill="currentColor"/>
      <circle cx="12" cy="6" r=".7" fill="currentColor"/>
      <circle cx="15" cy="7" r=".7" fill="currentColor"/>
    </svg>`
  },
  {
    id: '3d-burger',
    name: 'Burger 3D Artesanal',
    type: '3d',
    group: 'Lanches',
    tags: ['hamburguer', 'burger', '3d', 'artesanal', 'lanche', 'smash', 'bacon'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="bgBunTop" cx="40%" cy="30%" r="60%">
          <stop offset="0%" stop-color="#FFC875"/>
          <stop offset="60%" stop-color="#E88B2E"/>
          <stop offset="100%" stop-color="#B25510"/>
        </radialGradient>
        <linearGradient id="bgPatty" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#733924"/>
          <stop offset="100%" stop-color="#451C0F"/>
        </linearGradient>
        <linearGradient id="bgCheese" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#FFE169"/>
          <stop offset="100%" stop-color="#F59E0B"/>
        </linearGradient>
        <linearGradient id="bgSalad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#4ADE80"/>
          <stop offset="100%" stop-color="#15803D"/>
        </linearGradient>
      </defs>
      <!-- Top Bun -->
      <path d="M10 26C10 14 20 8 32 8C44 8 54 14 54 26C54 27 53 28 51 28H13C11 28 10 27 10 26Z" fill="url(#bgBunTop)"/>
      <ellipse cx="22" cy="16" rx="1.5" ry="2" fill="#FFE5B4" opacity="0.9" transform="rotate(-15 22 16)"/>
      <ellipse cx="32" cy="14" rx="1.5" ry="2" fill="#FFE5B4" opacity="0.9"/>
      <ellipse cx="42" cy="17" rx="1.5" ry="2" fill="#FFE5B4" opacity="0.9" transform="rotate(20 42 17)"/>
      <!-- Salad -->
      <path d="M8 29C11 27 13 31 17 29C21 27 23 31 27 29C31 27 33 31 37 29C41 27 43 31 47 29C51 27 53 31 56 29C57 30 57 32 55 33C52 34 50 31 46 32C42 33 40 30 36 32C32 34 30 31 26 32C22 33 20 30 16 32C12 34 9 31 7 32C6 31 7 29 8 29Z" fill="url(#bgSalad)"/>
      <!-- Cheese Melt -->
      <path d="M9 34H55L52 42L45 37L38 43L31 37L24 43L17 37L12 42L9 34Z" fill="url(#bgCheese)"/>
      <!-- Patty -->
      <rect x="10" y="38" width="44" height="10" rx="5" fill="url(#bgPatty)"/>
      <!-- Bottom Bun -->
      <path d="M12 48H52C53 48 54 49 54 50C54 56 44 60 32 60C20 60 10 56 10 50C10 49 11 48 12 48Z" fill="url(#bgBunTop)"/>
    </svg>`
  },
  {
    id: '2d-hotdog',
    name: 'Hot Dog & Lanches',
    type: '2d',
    group: 'Lanches',
    tags: ['hotdog', 'cachorro-quente', 'salsicha', 'lanche', 'mostarda'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 14c0 3.5 3 6 7 6s11-3 11-8-3-6-7-6-11 4.5-11 8Z"/>
      <path d="M6 12c2-1 4-1 6 0s4 1 6 0"/>
      <path d="M7 16c2-1 4-1 6 0s3 1 5 0"/>
    </svg>`
  },
  {
    id: '3d-hotdog',
    name: 'Hot Dog 3D Especial',
    type: '3d',
    group: 'Lanches',
    tags: ['hotdog', 'cachorro-quente', '3d', 'salsicha', 'artesanal'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="hdBun" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#FFD68A"/>
          <stop offset="100%" stop-color="#C9751A"/>
        </radialGradient>
        <linearGradient id="hdSausage" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#E11D48"/>
          <stop offset="100%" stop-color="#881337"/>
        </linearGradient>
      </defs>
      <!-- Bun Back -->
      <ellipse cx="32" cy="38" rx="26" ry="14" fill="url(#hdBun)"/>
      <!-- Sausage -->
      <rect x="10" y="24" width="44" height="14" rx="7" transform="rotate(-6 32 31)" fill="url(#hdSausage)"/>
      <!-- Mustard Wave -->
      <path d="M14 30Q20 23 26 31T38 31T50 28" stroke="#FBBF24" stroke-width="4" stroke-linecap="round" fill="none"/>
      <!-- Bun Front Highlights -->
      <ellipse cx="32" cy="44" rx="24" ry="10" fill="url(#hdBun)" opacity="0.95"/>
    </svg>`
  },
  {
    id: '2d-fries',
    name: 'Batata Frita',
    type: '2d',
    group: 'Lanches',
    tags: ['batata', 'frita', 'fritas', 'crocante', 'porcao', 'acompanhamento'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 11l2 10h10l2-10H5Z"/>
      <path d="M8 11V4h2v7"/>
      <path d="M11 11V2h2v9"/>
      <path d="M14 11V5h2v6"/>
    </svg>`
  },
  {
    id: '3d-fries',
    name: 'Batata Frita 3D',
    type: '3d',
    group: 'Lanches',
    tags: ['batata', 'frita', '3d', 'porcao', 'crocante', 'rustica'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="boxGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#EF4444"/>
          <stop offset="100%" stop-color="#991B1B"/>
        </linearGradient>
        <linearGradient id="fryGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#FDE047"/>
          <stop offset="100%" stop-color="#CA8A04"/>
        </linearGradient>
      </defs>
      <!-- Fries Sticks -->
      <rect x="18" y="10" width="6" height="26" rx="2" fill="url(#fryGrad)" transform="rotate(-10 21 23)"/>
      <rect x="25" y="6" width="6.5" height="30" rx="2" fill="url(#fryGrad)" transform="rotate(-3 28 21)"/>
      <rect x="33" y="8" width="6" height="28" rx="2" fill="url(#fryGrad)" transform="rotate(8 36 22)"/>
      <rect x="40" y="12" width="6" height="24" rx="2" fill="url(#fryGrad)" transform="rotate(15 43 24)"/>
      <!-- Box -->
      <path d="M14 26L18 56C18 58 20 60 22 60H42C44 60 46 58 46 56L50 26C50 24 48 24 46 25C42 27 37 28 32 28C27 28 22 27 18 25C16 24 14 24 14 26Z" fill="url(#boxGrad)"/>
      <path d="M26 36C26 32 30 30 32 30C34 30 38 32 38 36V44C38 45 37 46 36 46H28C27 46 26 45 26 44V36Z" fill="#FBBF24" opacity="0.9"/>
    </svg>`
  },
  {
    id: '2d-sandwich',
    name: 'Sanduíche & Tostex',
    type: '2d',
    group: 'Lanches',
    tags: ['sanduiche', 'misto', 'tostex', 'sub', 'baguete', 'lanche'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 11l17-7 1 3-17 7-1-3Z"/>
      <path d="M4 14l16-6"/>
      <path d="M5 17l16-6"/>
      <path d="M3 19l17-7 1 3-17 7-1-3Z"/>
    </svg>`
  },

  // ══════════════════════════════════════════════════
  // ── BEBIDAS & BAR ──
  // ══════════════════════════════════════════════════
  {
    id: '2d-beer',
    name: 'Chopp & Cerveja',
    type: '2d',
    group: 'Bebidas',
    tags: ['chopp', 'cerveja', 'beer', 'artesanal', 'ipa', 'pilsen', 'caneca', 'alcool'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 11h1a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-1"/>
      <path d="M5 8v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/>
      <path d="M5 8c0-1.5 1-3 3-3 1.5 0 2 .8 3 1 1-.2 1.5-1 3-1 2 0 3 1.5 3 3"/>
      <line x1="8" y1="12" x2="8" y2="17"/>
      <line x1="11" y1="12" x2="11" y2="17"/>
      <line x1="14" y1="12" x2="14" y2="17"/>
    </svg>`
  },
  {
    id: '3d-beer',
    name: 'Caneca Chopp 3D',
    type: '3d',
    group: 'Bebidas',
    tags: ['chopp', 'cerveja', '3d', 'beer', 'gelada', 'espuma', 'caneca'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="beerLiquid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FCD34D"/>
          <stop offset="100%" stop-color="#D97706"/>
        </linearGradient>
        <linearGradient id="mugGlass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="white" stop-opacity="0.6"/>
          <stop offset="50%" stop-color="white" stop-opacity="0.1"/>
          <stop offset="100%" stop-color="white" stop-opacity="0.4"/>
        </linearGradient>
      </defs>
      <!-- Handle -->
      <path d="M42 24C49 24 54 28 54 36C54 44 49 48 42 48" stroke="#E2E8F0" stroke-width="6" stroke-linecap="round"/>
      <!-- Beer Body -->
      <rect x="16" y="20" width="28" height="36" rx="4" fill="url(#beerLiquid)"/>
      <!-- Bubbles -->
      <circle cx="22" cy="46" r="1.5" fill="white" opacity="0.6"/>
      <circle cx="34" cy="40" r="2" fill="white" opacity="0.5"/>
      <circle cx="26" cy="30" r="1.5" fill="white" opacity="0.7"/>
      <!-- Glass reflection -->
      <rect x="16" y="20" width="28" height="36" rx="4" fill="url(#mugGlass)"/>
      <!-- Foam Top -->
      <ellipse cx="30" cy="18" rx="16" ry="7" fill="#FFFFFF"/>
      <circle cx="18" cy="19" r="6" fill="#FFFFFF"/>
      <circle cx="28" cy="15" r="7" fill="#FFFFFF"/>
      <circle cx="38" cy="18" r="6.5" fill="#FFFFFF"/>
      <path d="M19 22C19 26 21 28 21 30C21 32 19 32 19 30" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: '2d-cocktail',
    name: 'Drinks & Coquetéis',
    type: '2d',
    group: 'Bebidas',
    tags: ['drink', 'coquetel', 'cocktail', 'gin', 'tacas', 'bar', 'alcool'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="m8 22 4-11 4 11"/>
      <path d="M5 22h14"/>
      <path d="M12 11V3"/>
      <path d="M4 3h16l-8 8Z"/>
    </svg>`
  },
  {
    id: '3d-cocktail',
    name: 'Drink Tropical 3D',
    type: '3d',
    group: 'Bebidas',
    tags: ['drink', 'coquetel', '3d', 'tropical', 'martini', 'gin', 'balada'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="cocktailGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#F43F5E"/>
          <stop offset="60%" stop-color="#FB923C"/>
          <stop offset="100%" stop-color="#FBBF24"/>
        </linearGradient>
      </defs>
      <!-- Glass base & stem -->
      <ellipse cx="32" cy="58" rx="14" ry="3" fill="#94A3B8"/>
      <line x1="32" y1="58" x2="32" y2="34" stroke="#CBD5E1" stroke-width="3.5" stroke-linecap="round"/>
      <!-- Glass Cup -->
      <path d="M12 14L32 36L52 14Z" fill="url(#cocktailGrad)"/>
      <path d="M10 12L32 36L54 12H10Z" stroke="#E2E8F0" stroke-width="2" fill="none"/>
      <!-- Orange Slice -->
      <circle cx="46" cy="12" r="7" fill="#F97316"/>
      <circle cx="46" cy="12" r="5" fill="#FDBA74"/>
      <!-- Straw -->
      <line x1="24" y1="6" x2="33" y2="30" stroke="#06B6D4" stroke-width="3" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: '2d-coffee',
    name: 'Cafés & Quentes',
    type: '2d',
    group: 'Bebidas',
    tags: ['cafe', 'espresso', 'cappuccino', 'cha', 'quente', 'cafeteria'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 8h1a4 4 0 0 1 0 8h-1"/>
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
      <line x1="6" y1="2" x2="6" y2="4"/>
      <line x1="10" y1="2" x2="10" y2="4"/>
      <line x1="14" y1="2" x2="14" y2="4"/>
    </svg>`
  },
  {
    id: '3d-coffee',
    name: 'Café Espresso 3D',
    type: '3d',
    group: 'Bebidas',
    tags: ['cafe', 'coffee', '3d', 'cappuccino', 'mocha', 'quente', 'grao'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="cupGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#FFFFFF"/>
          <stop offset="100%" stop-color="#E2E8F0"/>
        </linearGradient>
        <radialGradient id="coffeeLiquid" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#673926"/>
          <stop offset="80%" stop-color="#3C1A0C"/>
        </radialGradient>
      </defs>
      <!-- Saucer -->
      <ellipse cx="32" cy="54" rx="24" ry="6" fill="#CBD5E1"/>
      <ellipse cx="32" cy="52" rx="22" ry="5" fill="#F8FAFC"/>
      <!-- Cup Handle -->
      <path d="M42 30C49 30 52 34 52 39C52 44 48 47 42 47" stroke="#E2E8F0" stroke-width="5" stroke-linecap="round"/>
      <!-- Cup Body -->
      <path d="M16 26C16 42 22 48 32 48C42 48 48 42 48 26H16Z" fill="url(#cupGrad)"/>
      <!-- Cup Top Rim -->
      <ellipse cx="32" cy="26" rx="16" ry="6" fill="#E2E8F0"/>
      <!-- Coffee Surface -->
      <ellipse cx="32" cy="26" rx="14" ry="5" fill="url(#coffeeLiquid)"/>
      <!-- Steam -->
      <path d="M26 18Q24 14 27 10" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.6"/>
      <path d="M32 16Q30 12 33 8" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.7"/>
      <path d="M38 18Q36 14 39 10" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.6"/>
    </svg>`
  },
  {
    id: '2d-soda',
    name: 'Refrigerantes & Sucos',
    type: '2d',
    group: 'Bebidas',
    tags: ['refrigerante', 'suco', 'lata', 'gas', 'refri', 'gelado'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect width="10" height="18" x="7" y="3" rx="2"/>
      <line x1="9" y1="7" x2="15" y2="7"/>
      <line x1="9" y1="17" x2="15" y2="17"/>
      <circle cx="12" cy="12" r="1.5"/>
    </svg>`
  },

  // ══════════════════════════════════════════════════
  // ── PRATOS & CARNES ──
  // ══════════════════════════════════════════════════
  {
    id: '2d-dish',
    name: 'Pratos Executivos',
    type: '2d',
    group: 'Pratos & Carnes',
    tags: ['prato', 'almoco', 'jantar', 'executivo', 'refeicao', 'gourmet', 'culinaria'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <circle cx="12" cy="12" r="5"/>
      <path d="M3 2v6c0 1.1.9 2 2 2h1v12"/>
      <path d="M21 2v10c0 1.1-.9 2-2 2h-1v8"/>
    </svg>`
  },
  {
    id: '3d-steak',
    name: 'Steak & Carnes 3D',
    type: '3d',
    group: 'Pratos & Carnes',
    tags: ['carne', 'steak', 'picanha', 'churrasco', 'grelhado', '3d', 'alcatra'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="steakGrad" cx="40%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#DC2626"/>
          <stop offset="50%" stop-color="#991B1B"/>
          <stop offset="100%" stop-color="#450A0A"/>
        </radialGradient>
      </defs>
      <!-- Skillet Plate -->
      <ellipse cx="32" cy="46" rx="28" ry="12" fill="#1E293B"/>
      <ellipse cx="32" cy="44" rx="24" ry="10" fill="#334155"/>
      <!-- Steak cut -->
      <path d="M18 36C18 30 24 24 34 24C44 24 50 30 50 36C50 42 42 48 30 46C20 44 18 40 18 36Z" fill="url(#steakGrad)"/>
      <!-- Grill marks -->
      <line x1="24" y1="28" x2="38" y2="42" stroke="#1C1917" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="32" y1="26" x2="44" y2="38" stroke="#1C1917" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="22" y1="36" x2="32" y2="46" stroke="#1C1917" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Rosemary Herb -->
      <path d="M42 22Q36 26 34 32" stroke="#22C55E" stroke-width="2" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: '2d-chicken',
    name: 'Aves & Frango',
    type: '2d',
    group: 'Pratos & Carnes',
    tags: ['frango', 'ave', 'frango-frito', 'coxa', 'crocante', 'empanado'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 4a5 5 0 0 0-5 5c0 1.5.6 2.8 1.6 3.7L5 20.3a2.1 2.1 0 0 0 0 3 2.1 2.1 0 0 0 3 0L15.6 15A5 5 0 0 0 20 9a5 5 0 0 0-4-5Z"/>
      <path d="m9.5 14.5 2 2"/>
    </svg>`
  },
  {
    id: '3d-chicken',
    name: 'Frango Crocante 3D',
    type: '3d',
    group: 'Pratos & Carnes',
    tags: ['frango', 'coxa', 'frito', '3d', 'crocante', 'empanado'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="chkGrad" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#FBBF24"/>
          <stop offset="60%" stop-color="#D97706"/>
          <stop offset="100%" stop-color="#78350F"/>
        </radialGradient>
      </defs>
      <!-- Bone -->
      <rect x="12" y="44" width="16" height="7" rx="3.5" transform="rotate(-35 20 47)" fill="#F1F5F9"/>
      <circle cx="12" cy="52" r="4.5" fill="#E2E8F0"/>
      <circle cx="18" cy="56" r="4.5" fill="#CBD5E1"/>
      <!-- Drumstick meat -->
      <ellipse cx="38" cy="28" rx="18" ry="16" fill="url(#chkGrad)"/>
      <circle cx="48" cy="22" r="8" fill="url(#chkGrad)"/>
    </svg>`
  },
  {
    id: '2d-fish',
    name: 'Peixes & Frutos do Mar',
    type: '2d',
    group: 'Pratos & Carnes',
    tags: ['peixe', 'frutos-do-mar', 'salmao', 'camarao', 'sushi', 'tilapia', 'pescado'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z"/>
      <path d="M18 12v.5"/>
      <path d="M16 17.93a10.97 10.97 0 0 1-5.5 0"/>
      <path d="m2 16 4.5-4L2 8"/>
    </svg>`
  },

  // ══════════════════════════════════════════════════
  // ── PIZZAS & MASSAS ──
  // ══════════════════════════════════════════════════
  {
    id: '2d-pizza',
    name: 'Pizzas & Calzones',
    type: '2d',
    group: 'Pizzas & Massas',
    tags: ['pizza', 'calzone', 'fatia', 'mussarela', 'queijo', 'italiana', 'massas'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 11h.01"/>
      <path d="M11 15h.01"/>
      <path d="M16 16h.01"/>
      <path d="m2 16 18 5L15 3a16.8 16.8 0 0 0-13 13Z"/>
      <path d="M4.5 15.5c3-1 6.5-.5 9.5 1.5"/>
    </svg>`
  },
  {
    id: '3d-pizza',
    name: 'Fatia de Pizza 3D',
    type: '3d',
    group: 'Pizzas & Massas',
    tags: ['pizza', '3d', 'fatia', 'calabresa', 'artesanal', 'queijo', 'derretido'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="crustGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#FCD34D"/>
          <stop offset="100%" stop-color="#B45309"/>
        </linearGradient>
        <radialGradient id="cheeseGrad" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#FEF08A"/>
          <stop offset="80%" stop-color="#F59E0B"/>
        </radialGradient>
      </defs>
      <!-- Crust Top Arc -->
      <path d="M10 20Q32 8 54 20" stroke="url(#crustGrad)" stroke-width="9" stroke-linecap="round"/>
      <!-- Slice Body -->
      <path d="M12 21L32 58L52 21Q32 12 12 21Z" fill="url(#cheeseGrad)"/>
      <!-- Pepperoni slices -->
      <circle cx="26" cy="30" r="4.5" fill="#DC2626"/>
      <circle cx="38" cy="32" r="5" fill="#B91C1C"/>
      <circle cx="32" cy="44" r="4" fill="#DC2626"/>
      <!-- Basil leaf -->
      <ellipse cx="32" cy="24" rx="3.5" ry="2" fill="#22C55E" transform="rotate(25 32 24)"/>
    </svg>`
  },
  {
    id: '2d-pasta',
    name: 'Massas & Macarrão',
    type: '2d',
    group: 'Pizzas & Massas',
    tags: ['massa', 'macarrao', 'spaghetti', 'penne', 'lasanha', 'italiana'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2v20"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>`
  },

  // ══════════════════════════════════════════════════
  // ── SOBREMESAS & DOCES ──
  // ══════════════════════════════════════════════════
  {
    id: '2d-dessert',
    name: 'Sobremesas & Doces',
    type: '2d',
    group: 'Sobremesas',
    tags: ['sobremesa', 'doce', 'bolo', 'torta', 'pudim', 'chocolate'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/>
      <path d="M4 16s2-1 4-1 4 1 4 1 2-1 4-1 4 1 4 1"/>
      <path d="M2 21h20"/>
      <path d="M12 7V4"/>
      <circle cx="12" cy="3" r="1"/>
    </svg>`
  },
  {
    id: '3d-dessert',
    name: 'Sorvete Sundae 3D',
    type: '3d',
    group: 'Sobremesas',
    tags: ['sorvete', 'sobremesa', '3d', 'sundae', 'acai', 'doces', 'taca'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="iceVanilla" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stop-color="#FFFBEB"/>
          <stop offset="100%" stop-color="#FDE68A"/>
        </radialGradient>
        <radialGradient id="iceBerry" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stop-color="#FDA4AF"/>
          <stop offset="100%" stop-color="#E11D48"/>
        </radialGradient>
      </defs>
      <!-- Glass Cup -->
      <path d="M20 34L26 52H38L44 34H20Z" fill="#E2E8F0" opacity="0.8"/>
      <ellipse cx="32" cy="54" rx="10" ry="3" fill="#94A3B8"/>
      <rect x="30" y="48" width="4" height="6" fill="#CBD5E1"/>
      <!-- Scoop 1 Berry -->
      <circle cx="26" cy="30" r="11" fill="url(#iceBerry)"/>
      <!-- Scoop 2 Vanilla -->
      <circle cx="38" cy="30" r="11" fill="url(#iceVanilla)"/>
      <!-- Cherry on Top -->
      <circle cx="32" cy="18" r="5" fill="#BE123C"/>
      <path d="M34 14Q40 8 44 10" stroke="#047857" stroke-width="2" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: '2d-icecream',
    name: 'Sorvetes & Gelatos',
    type: '2d',
    group: 'Sobremesas',
    tags: ['sorvete', 'casquinha', 'gelato', 'picole', 'gelado', 'acai'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="m7 11 5 11 5-11Z"/>
      <path d="M12 3a5 5 0 0 0-5 5c0 1.1.4 2.1 1 3h8a5 5 0 0 0 1-3 5 5 0 0 0-5-5Z"/>
    </svg>`
  },

  // ══════════════════════════════════════════════════
  // ── SAUDÁVEL & VEGANO ──
  // ══════════════════════════════════════════════════
  {
    id: '2d-salad',
    name: 'Saladas & Bowls',
    type: '2d',
    group: 'Saudável & Veg',
    tags: ['salada', 'bowl', 'fitness', 'fit', 'saudavel', 'verdura', 'legumes'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7 11h10a6 6 0 0 1-12 0Z"/>
      <path d="M6 11c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
      <path d="m11 5 2 6"/>
      <path d="m13 5-2 6"/>
    </svg>`
  },
  {
    id: '3d-salad',
    name: 'Salada Fresh 3D',
    type: '3d',
    group: 'Saudável & Veg',
    tags: ['salada', '3d', 'bowl', 'fitness', 'vegano', 'fresco', 'saudavel'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="leafGrad" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#86EFAC"/>
          <stop offset="100%" stop-color="#15803D"/>
        </radialGradient>
      </defs>
      <!-- Bowl -->
      <path d="M12 30C12 46 20 54 32 54C44 54 52 46 52 30H12Z" fill="#F8FAFC"/>
      <ellipse cx="32" cy="30" rx="20" ry="6" fill="#E2E8F0"/>
      <!-- Leaves -->
      <ellipse cx="26" cy="24" rx="8" ry="6" fill="url(#leafGrad)" transform="rotate(-20 26 24)"/>
      <ellipse cx="38" cy="22" rx="9" ry="6" fill="url(#leafGrad)" transform="rotate(25 38 22)"/>
      <!-- Tomato & Corn -->
      <circle cx="32" cy="24" r="4.5" fill="#EF4444"/>
      <circle cx="23" cy="28" r="2.5" fill="#FBBF24"/>
      <circle cx="41" cy="27" r="2.5" fill="#FBBF24"/>
    </svg>`
  },
  {
    id: '2d-vegan',
    name: 'Vegano & Vegetariano',
    type: '2d',
    group: 'Saudável & Veg',
    tags: ['vegano', 'vegetariano', 'planta', 'folha', 'organico', 'eco'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 20A7 7 0 0 1 4 13C4 6 11 3 20 3c0 9-3 16-9 17Z"/>
      <path d="M4 13c7 0 11-4 12-8"/>
    </svg>`
  },

  // ══════════════════════════════════════════════════
  // ── ESPECIAIS & DESTAQUES ──
  // ══════════════════════════════════════════════════
  {
    id: '2d-fire',
    name: 'Promoção & Especial',
    type: '2d',
    group: 'Especiais',
    tags: ['fogo', 'promocao', 'especial', 'picante', 'quente', 'destaque'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
    </svg>`
  },
  {
    id: '3d-fire',
    name: 'Chama Hot 3D',
    type: '3d',
    group: 'Especiais',
    tags: ['fogo', '3d', 'chama', 'promocao', 'destaque', 'hot', 'especial'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="fireOuter" cx="50%" cy="80%" r="80%">
          <stop offset="0%" stop-color="#FBBF24"/>
          <stop offset="40%" stop-color="#F97316"/>
          <stop offset="100%" stop-color="#DC2626"/>
        </radialGradient>
      </defs>
      <!-- Main Flame -->
      <path d="M32 6C32 6 46 22 46 38C46 50 38 58 32 58C26 58 18 50 18 38C18 24 32 6 32 6Z" fill="url(#fireOuter)"/>
      <!-- Inner Flame -->
      <path d="M32 26C32 26 40 36 40 44C40 50 36 54 32 54C28 54 24 50 24 44C24 36 32 26 32 26Z" fill="#FEF08A"/>
    </svg>`
  },
  {
    id: '2d-star',
    name: 'Sugestão do Chef',
    type: '2d',
    group: 'Especiais',
    tags: ['estrela', 'chef', 'sugestao', 'premium', 'favorito', 'top'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>`
  },
  {
    id: '3d-crown',
    name: 'Premium / Coroa 3D',
    type: '3d',
    group: 'Especiais',
    tags: ['coroa', 'crown', '3d', 'premium', 'luxo', 'vip', 'especial'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="crownGrad" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#FDE047"/>
          <stop offset="60%" stop-color="#EAB308"/>
          <stop offset="100%" stop-color="#A16207"/>
        </radialGradient>
      </defs>
      <!-- Crown Base -->
      <path d="M12 48L18 22L28 36L32 16L36 36L46 22L52 48H12Z" fill="url(#crownGrad)"/>
      <!-- Jewels -->
      <circle cx="18" cy="20" r="3" fill="#EF4444"/>
      <circle cx="32" cy="14" r="3.5" fill="#3B82F6"/>
      <circle cx="46" cy="20" r="3" fill="#10B981"/>
      <rect x="14" y="46" width="36" height="6" rx="2" fill="#CA8A04"/>
    </svg>`
  },
  {
    id: '3d-combo',
    name: 'Combo 3D Artesanal',
    type: '3d',
    group: 'Lanches',
    tags: ['combo', 'lanche', 'refrigerante', 'bebida', 'burger', '3d', 'especial'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="cbBunTop" cx="40%" cy="30%" r="60%">
          <stop offset="0%" stop-color="#FFD188"/>
          <stop offset="60%" stop-color="#EA8B2C"/>
          <stop offset="100%" stop-color="#A84C0B"/>
        </radialGradient>
        <linearGradient id="cbCup" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#A78BFA"/>
          <stop offset="60%" stop-color="#7C3AED"/>
          <stop offset="100%" stop-color="#5B21B6"/>
        </linearGradient>
        <linearGradient id="cbPatty" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#6B341F"/>
          <stop offset="100%" stop-color="#3D1A0E"/>
        </linearGradient>
      </defs>
      <!-- Drink Cup (Back Right) -->
      <path d="M38 18L42 54C42 56 44 58 47 58H53C56 58 58 56 58 54L62 18H38Z" fill="url(#cbCup)"/>
      <ellipse cx="50" cy="18" rx="12" ry="3" fill="#C4B5FD"/>
      <!-- Cup Lid & Straw -->
      <path d="M41 18C41 14 45 12 50 12C55 12 59 14 59 18H41Z" fill="#EDE9FE"/>
      <path d="M52 12L56 4H53L49 12" fill="#F43F5E"/>
      <!-- Burger Shadow -->
      <ellipse cx="26" cy="56" rx="22" ry="5" fill="#000" opacity="0.2"/>
      <!-- Bottom Bun -->
      <path d="M8 46H42C43 46 44 47 44 48C44 53 36 56 25 56C14 56 6 53 6 48C6 47 7 46 8 46Z" fill="url(#cbBunTop)"/>
      <!-- Patty -->
      <rect x="6" y="38" width="38" height="8" rx="4" fill="url(#cbPatty)"/>
      <!-- Melted Cheese -->
      <path d="M7 36H43L40 42L34 38L28 43L22 38L16 42L10 38L7 41V36Z" fill="#FBBF24"/>
      <!-- Lettuce -->
      <path d="M5 33C8 31 10 35 13 33C16 31 18 35 21 33C24 31 27 35 30 33C33 31 36 35 39 33C42 31 44 34 45 33L44 36H5V33Z" fill="#22C55E"/>
      <!-- Top Bun -->
      <path d="M6 31C6 19 14 14 25 14C36 14 44 19 44 31C44 32 43 33 41 33H9C7 33 6 32 6 31Z" fill="url(#cbBunTop)"/>
      <!-- Sesame seeds -->
      <ellipse cx="17" cy="22" rx="1.2" ry="1.8" fill="#FFFBEB" transform="rotate(-15 17 22)"/>
      <ellipse cx="25" cy="19" rx="1.2" ry="1.8" fill="#FFFBEB"/>
      <ellipse cx="33" cy="22" rx="1.2" ry="1.8" fill="#FFFBEB" transform="rotate(20 33 22)"/>
    </svg>`
  },
  {
    id: '3d-bestseller',
    name: 'Mais Vendidos 3D Ouro',
    type: '3d',
    group: 'Especiais',
    tags: ['mais-vendido', 'top', 'campeao', 'ouro', '3d', 'destaque', 'trofeu', 'estrela'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="bsGold" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#FFFBEB"/>
          <stop offset="25%" stop-color="#FDE047"/>
          <stop offset="65%" stop-color="#F59E0B"/>
          <stop offset="100%" stop-color="#B45309"/>
        </radialGradient>
        <linearGradient id="bsBase" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#451A03"/>
          <stop offset="50%" stop-color="#78350F"/>
          <stop offset="100%" stop-color="#271103"/>
        </linearGradient>
      </defs>
      <!-- Trophy Shadow -->
      <ellipse cx="32" cy="59" rx="18" ry="4" fill="#000" opacity="0.25"/>
      <!-- Trophy Base -->
      <path d="M20 54H44L46 58H18L20 54Z" fill="url(#bsBase)"/>
      <rect x="22" y="48" width="20" height="6" rx="2" fill="url(#bsGold)"/>
      <path d="M28 42H36L34 48H30L28 42Z" fill="url(#bsGold)"/>
      <!-- Trophy Handles -->
      <path d="M12 18C12 28 20 32 26 34V30C22 28 16 26 16 18H12Z" fill="url(#bsGold)"/>
      <path d="M52 18C52 28 44 32 38 34V30C42 28 48 26 48 18H52Z" fill="url(#bsGold)"/>
      <!-- Cup Body -->
      <path d="M16 12H48C48 28 42 38 32 40C22 38 16 28 16 12Z" fill="url(#bsGold)"/>
      <!-- Star Medallion #1 inside Cup -->
      <circle cx="32" cy="24" r="9" fill="#FFFBEB" opacity="0.3"/>
      <polygon points="32 17 34.5 22 40 22.8 36 26.7 37 32 32 29.4 27 32 28 26.7 24 22.8 29.5 22" fill="#FEF08A"/>
      <!-- Rim highlight -->
      <ellipse cx="32" cy="12" rx="16" ry="3" fill="#FEF08A"/>
    </svg>`
  },
  {
    id: '3d-bistro',
    name: 'Bistrô & Início 3D',
    type: '3d',
    group: 'Especiais',
    tags: ['inicio', 'restaurante', 'bistro', 'loja', 'store', '3d', 'fachada'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="btWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#F1F5F9"/>
          <stop offset="100%" stop-color="#CBD5E1"/>
        </linearGradient>
        <linearGradient id="btAwningRed" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FB7185"/>
          <stop offset="60%" stop-color="#E11D48"/>
          <stop offset="100%" stop-color="#9F1239"/>
        </linearGradient>
        <linearGradient id="btAwningWhite" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FFFFFF"/>
          <stop offset="100%" stop-color="#E2E8F0"/>
        </linearGradient>
        <linearGradient id="btDoor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#38BDF8"/>
          <stop offset="100%" stop-color="#0284C7"/>
        </linearGradient>
      </defs>
      <!-- Base Shadow -->
      <ellipse cx="32" cy="60" rx="26" ry="4" fill="#000" opacity="0.2"/>
      <!-- Store Building Wall -->
      <rect x="10" y="24" width="44" height="34" rx="3" fill="url(#btWall)"/>
      <!-- Glass Door & Windows -->
      <rect x="25" y="34" width="14" height="24" rx="2" fill="url(#btDoor)"/>
      <line x1="32" y1="34" x2="32" y2="58" stroke="#FFFFFF" stroke-width="1" opacity="0.6"/>
      <circle cx="30" cy="46" r="1.2" fill="#F59E0B"/>
      <!-- Side Windows -->
      <rect x="13" y="34" width="9" height="15" rx="2" fill="#93C5FD" opacity="0.85"/>
      <rect x="42" y="34" width="9" height="15" rx="2" fill="#93C5FD" opacity="0.85"/>
      <!-- Awning Valance (Toldo 3D listrado) -->
      <path d="M6 16L10 28H54L58 16H6Z" fill="#E11D48"/>
      <!-- Awning Stripes -->
      <path d="M6 16L9 28H15L13 16H6Z" fill="url(#btAwningRed)"/>
      <path d="M13 16L15 28H21L20 16H13Z" fill="url(#btAwningWhite)"/>
      <path d="M20 16L21 28H28L27 16H20Z" fill="url(#btAwningRed)"/>
      <path d="M27 16L28 28H36L35 16H27Z" fill="url(#btAwningWhite)"/>
      <path d="M35 16L36 28H43L42 16H35Z" fill="url(#btAwningRed)"/>
      <path d="M42 16L43 28H49L47 16H42Z" fill="url(#btAwningWhite)"/>
      <path d="M47 16L49 28H54L58 16H47Z" fill="url(#btAwningRed)"/>
      <!-- Awning Scallops at bottom -->
      <circle cx="12" cy="28" r="3" fill="#E11D48"/>
      <circle cx="18" cy="28" r="3" fill="#F8FAFC"/>
      <circle cx="24" cy="28" r="3" fill="#E11D48"/>
      <circle cx="32" cy="28" r="3" fill="#F8FAFC"/>
      <circle cx="40" cy="28" r="3" fill="#E11D48"/>
      <circle cx="46" cy="28" r="3" fill="#F8FAFC"/>
      <circle cx="51" cy="28" r="3" fill="#E11D48"/>
      <!-- Gourmet Signboard on Roof -->
      <rect x="20" y="8" width="24" height="8" rx="2" fill="#1E293B"/>
      <rect x="22" y="10" width="20" height="4" rx="1" fill="#F59E0B"/>
    </svg>`
  },

  // ══════════════════════════════════════════════════
  // ── JAPONÊS & ORIENTAL ──
  // ══════════════════════════════════════════════════
  {
    id: '2d-sushi',
    name: 'Sushi & Japonês',
    type: '2d',
    group: 'Japonês & Oriental',
    tags: ['sushi', 'japones', 'japa', 'sashimi', 'temaki', 'niguiri', 'oriental'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <ellipse cx="12" cy="14" rx="9" ry="5"/>
      <path d="M3 14v-1c0-2.76 4.03-5 9-5s9 2.24 9 5v1"/>
      <circle cx="9" cy="11" r="1.5" fill="currentColor"/>
      <circle cx="15" cy="11" r="1.5" fill="currentColor"/>
      <path d="M6 6l4-3M18 6l-4-3"/>
    </svg>`
  },
  {
    id: '3d-sushi',
    name: 'Sushi Roll 3D',
    type: '3d',
    group: 'Japonês & Oriental',
    tags: ['sushi', 'roll', '3d', 'niguiri', 'japones', 'salmao', 'maki'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="sushiRice" cx="40%" cy="30%" r="65%">
          <stop offset="0%" stop-color="#FFFFFF"/>
          <stop offset="100%" stop-color="#E2E8F0"/>
        </radialGradient>
        <linearGradient id="sushiNori" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1A3A2A"/>
          <stop offset="100%" stop-color="#0F1F15"/>
        </linearGradient>
        <radialGradient id="sushiFish" cx="35%" cy="35%" r="60%">
          <stop offset="0%" stop-color="#FB923C"/>
          <stop offset="100%" stop-color="#EA580C"/>
        </radialGradient>
      </defs>
      <!-- Nori Wrap -->
      <ellipse cx="32" cy="38" rx="22" ry="16" fill="url(#sushiNori)"/>
      <!-- Rice interior -->
      <ellipse cx="32" cy="36" rx="18" ry="13" fill="url(#sushiRice)"/>
      <!-- Salmon/Fish center -->
      <ellipse cx="32" cy="34" rx="10" ry="7" fill="url(#sushiFish)"/>
      <!-- Avocado bits -->
      <ellipse cx="26" cy="38" rx="4" ry="3" fill="#4ADE80" opacity="0.85"/>
      <ellipse cx="38" cy="38" rx="4" ry="3" fill="#22C55E" opacity="0.85"/>
      <!-- Chopsticks -->
      <line x1="48" y1="8" x2="36" y2="48" stroke="#A16207" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="54" y1="10" x2="42" y2="50" stroke="#CA8A04" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: '2d-ramen',
    name: 'Ramen & Sopas',
    type: '2d',
    group: 'Japonês & Oriental',
    tags: ['ramen', 'sopa', 'lamen', 'caldo', 'oriental', 'noodle', 'macarrao'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 11h18v1a9 9 0 0 1-18 0v-1Z"/>
      <path d="M6 8c1-2 2-3 3-3s2 1 3 3 2 3 3 3 2-1 3-3"/>
      <line x1="8" y1="4" x2="7" y2="7"/>
      <line x1="16" y1="4" x2="17" y2="7"/>
    </svg>`
  },
  {
    id: '3d-ramen',
    name: 'Ramen Bowl 3D',
    type: '3d',
    group: 'Japonês & Oriental',
    tags: ['ramen', '3d', 'bowl', 'noodle', 'japones', 'tonkotsu', 'caldo'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="ramenBowl" cx="35%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#FFFFFF"/>
          <stop offset="100%" stop-color="#CBD5E1"/>
        </radialGradient>
        <linearGradient id="ramenBroth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FBBF24"/>
          <stop offset="100%" stop-color="#D97706"/>
        </linearGradient>
      </defs>
      <!-- Bowl -->
      <path d="M8 28C8 46 18 56 32 56C46 56 56 46 56 28H8Z" fill="url(#ramenBowl)"/>
      <ellipse cx="32" cy="28" rx="24" ry="8" fill="#E2E8F0"/>
      <!-- Broth -->
      <ellipse cx="32" cy="28" rx="22" ry="7" fill="url(#ramenBroth)"/>
      <!-- Noodles -->
      <path d="M20 30Q24 24 28 32T36 28T44 32" stroke="#FDE68A" stroke-width="3" stroke-linecap="round" fill="none"/>
      <!-- Egg half -->
      <ellipse cx="38" cy="26" rx="6" ry="4" fill="#FFFFFF"/>
      <ellipse cx="38" cy="26" rx="3.5" ry="2.5" fill="#F59E0B"/>
      <!-- Nori strip -->
      <rect x="18" y="22" width="8" height="12" rx="1" fill="#1A3A2A" opacity="0.85"/>
      <!-- Steam -->
      <path d="M26 18Q24 14 27 10" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.5"/>
      <path d="M38 16Q36 12 39 8" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.5"/>
    </svg>`
  },
  {
    id: '2d-wok',
    name: 'Wok & Stir-Fry',
    type: '2d',
    group: 'Japonês & Oriental',
    tags: ['wok', 'stir-fry', 'chines', 'oriental', 'yakissoba', 'frigideira'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 12c0 4.4 3.6 8 8 8s8-3.6 8-8H4Z"/>
      <path d="M20 12h2.5"/>
      <path d="M8 8l1-4M12 7V3M16 8l-1-4"/>
    </svg>`
  },

  // ══════════════════════════════════════════════════
  // ── PADARIA & CAFÉ ──
  // ══════════════════════════════════════════════════
  {
    id: '2d-bread',
    name: 'Padaria & Pães',
    type: '2d',
    group: 'Padaria & Café',
    tags: ['pao', 'padaria', 'baguete', 'integral', 'artesanal', 'torrada'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 12c0-4 3-7 7-7s7 3 7 7c0 2-1 4-3 5H8c-2-1-3-3-3-5Z"/>
      <path d="M9 12c0-2 1.3-3 3-3s3 1 3 3"/>
      <path d="M8 17v3h8v-3"/>
    </svg>`
  },
  {
    id: '3d-bread',
    name: 'Pão Artesanal 3D',
    type: '3d',
    group: 'Padaria & Café',
    tags: ['pao', 'artesanal', '3d', 'fermentacao', 'croissant', 'massa-madre'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="breadCrust" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stop-color="#FBBF24"/>
          <stop offset="50%" stop-color="#D97706"/>
          <stop offset="100%" stop-color="#92400E"/>
        </radialGradient>
      </defs>
      <!-- Shadow -->
      <ellipse cx="32" cy="56" rx="22" ry="5" fill="#000" opacity="0.15"/>
      <!-- Bread loaf body -->
      <path d="M10 40C10 28 18 16 32 16C46 16 54 28 54 40C54 48 44 52 32 52C20 52 10 48 10 40Z" fill="url(#breadCrust)"/>
      <!-- Score marks -->
      <path d="M22 24Q28 30 34 24" stroke="#92400E" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.6"/>
      <path d="M30 22Q36 28 42 22" stroke="#92400E" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.6"/>
      <!-- Flour dust highlights -->
      <ellipse cx="26" cy="28" rx="4" ry="2" fill="#FFFBEB" opacity="0.5" transform="rotate(-20 26 28)"/>
      <ellipse cx="38" cy="26" rx="5" ry="2" fill="#FFFBEB" opacity="0.4" transform="rotate(15 38 26)"/>
      <!-- Steam -->
      <path d="M28 12Q26 8 29 4" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.45"/>
      <path d="M36 10Q34 6 37 2" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.45"/>
    </svg>`
  },
  {
    id: '2d-croissant',
    name: 'Croissant & Folhados',
    type: '2d',
    group: 'Padaria & Café',
    tags: ['croissant', 'folhado', 'padaria', 'frances', 'manteiga', 'cafe'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 16c2-6 5-9 8-9s6 3 8 9"/>
      <path d="M4 16c0 2 4 3 8 3s8-1 8-3"/>
      <path d="M8 12c2-1 4-1 6 0"/>
    </svg>`
  },

  // ══════════════════════════════════════════════════
  // ── NOVOS ÍCONES EXTRAS PARA GRUPOS EXISTENTES ──
  // ══════════════════════════════════════════════════

  // Saudável & Veg
  {
    id: '2d-acai',
    name: 'Açaí & Bowls',
    type: '2d',
    group: 'Saudável & Veg',
    tags: ['acai', 'bowl', 'tropical', 'frozen', 'fruta', 'banana', 'granola'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 11h16c0 5-3.6 9-8 9s-8-4-8-9Z"/>
      <circle cx="9" cy="13" r="1" fill="currentColor"/>
      <circle cx="12" cy="14" r="1" fill="currentColor"/>
      <circle cx="15" cy="13" r="1" fill="currentColor"/>
      <path d="M8 11c1-4 3-6 4-7"/>
      <path d="M16 11c-1-3-2-5-4-7"/>
    </svg>`
  },
  {
    id: '3d-acai',
    name: 'Açaí Bowl 3D',
    type: '3d',
    group: 'Saudável & Veg',
    tags: ['acai', 'bowl', '3d', 'banana', 'granola', 'morango', 'tropical'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="acaiBowlG" cx="35%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#F8FAFC"/>
          <stop offset="100%" stop-color="#CBD5E1"/>
        </radialGradient>
        <radialGradient id="acaiPurple" cx="40%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#7C3AED"/>
          <stop offset="100%" stop-color="#3B0764"/>
        </radialGradient>
      </defs>
      <!-- Bowl -->
      <path d="M10 28C10 46 20 54 32 54C44 54 54 46 54 28H10Z" fill="url(#acaiBowlG)"/>
      <ellipse cx="32" cy="28" rx="22" ry="7" fill="#E2E8F0"/>
      <!-- Açaí surface -->
      <ellipse cx="32" cy="28" rx="20" ry="6" fill="url(#acaiPurple)"/>
      <!-- Banana slices -->
      <ellipse cx="24" cy="26" rx="4" ry="2.5" fill="#FDE68A" transform="rotate(-10 24 26)"/>
      <ellipse cx="32" cy="24" rx="4" ry="2.5" fill="#FDE68A"/>
      <ellipse cx="40" cy="26" rx="4" ry="2.5" fill="#FDE68A" transform="rotate(10 40 26)"/>
      <!-- Strawberry -->
      <circle cx="28" cy="28" r="3" fill="#EF4444"/>
      <circle cx="36" cy="28" r="3" fill="#DC2626"/>
      <!-- Granola sprinkle -->
      <circle cx="22" cy="30" r="1.5" fill="#D97706" opacity="0.7"/>
      <circle cx="42" cy="30" r="1.5" fill="#D97706" opacity="0.7"/>
      <circle cx="32" cy="32" r="1.5" fill="#CA8A04" opacity="0.7"/>
    </svg>`
  },
  {
    id: '2d-poke',
    name: 'Poke & Hawaiian',
    type: '2d',
    group: 'Saudável & Veg',
    tags: ['poke', 'hawaiano', 'bowl', 'salmao', 'fit', 'saudavel', 'abacate'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 11h16c0 5-3.6 9-8 9s-8-4-8-9Z"/>
      <rect x="7" y="9" width="4" height="4" rx="0.5" fill="none"/>
      <rect x="13" y="9" width="4" height="4" rx="0.5" fill="none"/>
      <path d="M10 7l2-4 2 4"/>
    </svg>`
  },

  // Bebidas extras
  {
    id: '2d-wine',
    name: 'Vinhos & Espumantes',
    type: '2d',
    group: 'Bebidas',
    tags: ['vinho', 'espumante', 'tinto', 'branco', 'taca', 'sommelier', 'uva'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 2h8l-1.5 8a4.5 4.5 0 0 1-5 0L8 2Z"/>
      <line x1="12" y1="10" x2="12" y2="18"/>
      <path d="M8 22h8"/>
      <path d="M9 18h6"/>
    </svg>`
  },
  {
    id: '3d-wine',
    name: 'Taça de Vinho 3D',
    type: '3d',
    group: 'Bebidas',
    tags: ['vinho', '3d', 'taca', 'sommelier', 'degustacao', 'tinto', 'premium'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="wineRed" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#991B1B"/>
          <stop offset="100%" stop-color="#450A0A"/>
        </linearGradient>
        <linearGradient id="wineGlass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="white" stop-opacity="0.5"/>
          <stop offset="50%" stop-color="white" stop-opacity="0.1"/>
          <stop offset="100%" stop-color="white" stop-opacity="0.35"/>
        </linearGradient>
      </defs>
      <!-- Base -->
      <ellipse cx="32" cy="58" rx="12" ry="3" fill="#94A3B8"/>
      <!-- Stem -->
      <rect x="30" y="38" width="4" height="20" fill="#CBD5E1"/>
      <!-- Cup bowl -->
      <path d="M16 10C16 10 18 32 32 34C46 32 48 10 48 10H16Z" fill="url(#wineGlass)" opacity="0.6"/>
      <!-- Wine liquid -->
      <path d="M18 20C18 20 20 32 32 34C44 32 46 20 46 20H18Z" fill="url(#wineRed)"/>
      <!-- Glass rim -->
      <ellipse cx="32" cy="10" rx="16" ry="4" fill="none" stroke="#E2E8F0" stroke-width="2"/>
      <!-- Shine -->
      <path d="M22 14C22 14 24 26 28 28" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
    </svg>`
  },
  {
    id: '2d-juice',
    name: 'Sucos Naturais',
    type: '2d',
    group: 'Bebidas',
    tags: ['suco', 'natural', 'vitamina', 'frutas', 'detox', 'laranja', 'smoothie'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 6l1.5 14a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2L18 6"/>
      <path d="M5 6h14"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
      <circle cx="12" cy="14" r="2"/>
      <path d="M10 10h4"/>
    </svg>`
  },
  {
    id: '2d-milkshake',
    name: 'Milkshake & Shakes',
    type: '2d',
    group: 'Bebidas',
    tags: ['milkshake', 'shake', 'batido', 'creme', 'chocolate', 'morango', 'gelado'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7 10l1.5 11a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1L17 10"/>
      <path d="M6 10h12a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1Z"/>
      <circle cx="12" cy="5" r="2"/>
      <line x1="14" y1="4" x2="16" y2="2"/>
    </svg>`
  },

  // Pratos & Carnes extras
  {
    id: '2d-bbq',
    name: 'Churrasco & BBQ',
    type: '2d',
    group: 'Pratos & Carnes',
    tags: ['churrasco', 'bbq', 'espeto', 'brasa', 'carvao', 'grelhado', 'picanha'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="2" x2="12" y2="22"/>
      <rect x="9" y="5" width="6" height="4" rx="1"/>
      <rect x="9" y="11" width="6" height="4" rx="1"/>
      <circle cx="12" cy="19" r="1.5"/>
      <path d="M7 3c1 1 1 3 0 4M17 3c-1 1-1 3 0 4"/>
    </svg>`
  },
  {
    id: '3d-bbq',
    name: 'Espeto Churrasco 3D',
    type: '3d',
    group: 'Pratos & Carnes',
    tags: ['churrasco', 'bbq', '3d', 'espeto', 'picanha', 'brasa', 'carvao'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="bbqMeat" cx="40%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#DC2626"/>
          <stop offset="60%" stop-color="#991B1B"/>
          <stop offset="100%" stop-color="#450A0A"/>
        </radialGradient>
        <linearGradient id="bbqOnion" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FDE68A"/>
          <stop offset="100%" stop-color="#D97706"/>
        </linearGradient>
      </defs>
      <!-- Skewer stick -->
      <line x1="32" y1="4" x2="32" y2="60" stroke="#78350F" stroke-width="3.5" stroke-linecap="round"/>
      <!-- Meat chunk 1 -->
      <rect x="22" y="12" width="20" height="12" rx="4" fill="url(#bbqMeat)"/>
      <!-- Onion ring -->
      <ellipse cx="32" cy="30" rx="8" ry="5" fill="url(#bbqOnion)"/>
      <!-- Meat chunk 2 -->
      <rect x="22" y="38" width="20" height="12" rx="4" fill="url(#bbqMeat)"/>
      <!-- Grill marks -->
      <line x1="26" y1="14" x2="26" y2="22" stroke="#1C1917" stroke-width="1.5" opacity="0.5"/>
      <line x1="32" y1="14" x2="32" y2="22" stroke="#1C1917" stroke-width="1.5" opacity="0.5"/>
      <line x1="38" y1="14" x2="38" y2="22" stroke="#1C1917" stroke-width="1.5" opacity="0.5"/>
      <line x1="26" y1="40" x2="26" y2="48" stroke="#1C1917" stroke-width="1.5" opacity="0.5"/>
      <line x1="32" y1="40" x2="32" y2="48" stroke="#1C1917" stroke-width="1.5" opacity="0.5"/>
      <line x1="38" y1="40" x2="38" y2="48" stroke="#1C1917" stroke-width="1.5" opacity="0.5"/>
      <!-- Pepper -->
      <circle cx="24" cy="30" r="3" fill="#22C55E"/>
      <circle cx="40" cy="30" r="3" fill="#EF4444"/>
    </svg>`
  },

  // Lanches extras
  {
    id: '2d-petisco',
    name: 'Petiscos & Porções',
    type: '2d',
    group: 'Lanches',
    tags: ['petisco', 'porcao', 'tira-gosto', 'bar', 'aperitivo', 'entrada', 'porcionado'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <ellipse cx="12" cy="16" rx="9" ry="5"/>
      <path d="M3 16v-2c0-2 4-4 9-4s9 2 9 4v2"/>
      <circle cx="8" cy="13" r="1.5" fill="currentColor"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
      <circle cx="16" cy="13" r="1.5" fill="currentColor"/>
    </svg>`
  },
  {
    id: '2d-wrap',
    name: 'Wrap & Burrito',
    type: '2d',
    group: 'Lanches',
    tags: ['wrap', 'burrito', 'tortilla', 'enrolado', 'lanche', 'mexicano'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 18L12 4l9 14c0 2-4 4-9 4s-9-2-9-4Z"/>
      <path d="M7 14c2-1 4-1 5 0s3 1 5 0"/>
      <path d="M8 18c2-1 3-1 4 0s3 1 4 0"/>
    </svg>`
  },

  // Sobremesas extras
  {
    id: '2d-cake',
    name: 'Bolo & Confeitaria',
    type: '2d',
    group: 'Sobremesas',
    tags: ['bolo', 'confeitaria', 'aniversario', 'fatia', 'layer', 'festa'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 21H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2Z"/>
      <path d="M6 13v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/>
      <path d="M12 9V6"/>
      <path d="M10 6c0-1 .9-2 2-2s2 1 2 2"/>
      <path d="M2 17h20"/>
    </svg>`
  },
  {
    id: '3d-cake',
    name: 'Bolo Confeitado 3D',
    type: '3d',
    group: 'Sobremesas',
    tags: ['bolo', '3d', 'confeitaria', 'decorado', 'festa', 'aniversario', 'layer'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="cakePink" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FDA4AF"/>
          <stop offset="100%" stop-color="#E11D48"/>
        </linearGradient>
        <linearGradient id="cakeFrosting" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FFFFFF"/>
          <stop offset="100%" stop-color="#FDE68A"/>
        </linearGradient>
      </defs>
      <!-- Shadow -->
      <ellipse cx="32" cy="58" rx="20" ry="4" fill="#000" opacity="0.15"/>
      <!-- Bottom tier -->
      <rect x="12" y="38" width="40" height="18" rx="4" fill="url(#cakePink)"/>
      <ellipse cx="32" cy="38" rx="20" ry="5" fill="#FB7185"/>
      <!-- Top tier -->
      <rect x="18" y="22" width="28" height="16" rx="4" fill="url(#cakePink)"/>
      <ellipse cx="32" cy="22" rx="14" ry="4" fill="#FDA4AF"/>
      <!-- Frosting drip -->
      <path d="M18 24C20 28 22 26 24 30C26 26 28 28 30 24C32 28 34 26 36 30C38 26 40 28 42 24C44 28 46 26 46 24" stroke="url(#cakeFrosting)" stroke-width="3" stroke-linecap="round" fill="none"/>
      <!-- Candle -->
      <rect x="30" y="12" width="4" height="10" rx="1" fill="#FBBF24"/>
      <!-- Flame -->
      <path d="M32 8C32 8 34 10 34 12C34 13 33 14 32 14C31 14 30 13 30 12C30 10 32 8 32 8Z" fill="#F97316"/>
      <ellipse cx="32" cy="11" rx="1" ry="1.5" fill="#FEF08A"/>
    </svg>`
  },
  {
    id: '2d-cupcake',
    name: 'Cupcake & Docinhos',
    type: '2d',
    group: 'Sobremesas',
    tags: ['cupcake', 'docinho', 'muffin', 'brigadeiro', 'doce', 'mini-bolo'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7 13l1.5 8a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1L17 13"/>
      <path d="M6 13c0-3 2.7-5 6-5s6 2 6 5"/>
      <circle cx="12" cy="6" r="1"/>
      <path d="M12 7v1"/>
      <path d="M9 10c1-.5 2-.5 3 0s2 .5 3 0"/>
    </svg>`
  },
  {
    id: '3d-cupcake',
    name: 'Cupcake 3D Premium',
    type: '3d',
    group: 'Sobremesas',
    tags: ['cupcake', '3d', 'premium', 'confeitaria', 'sprinkles', 'chantilly'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="cupWrap" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#F472B6"/>
          <stop offset="100%" stop-color="#BE185D"/>
        </linearGradient>
        <radialGradient id="cupFrost" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stop-color="#FDF2F8"/>
          <stop offset="100%" stop-color="#FBCFE8"/>
        </radialGradient>
      </defs>
      <!-- Shadow -->
      <ellipse cx="32" cy="58" rx="16" ry="3" fill="#000" opacity="0.15"/>
      <!-- Wrapper (cup) -->
      <path d="M18 34L22 56H42L46 34H18Z" fill="url(#cupWrap)"/>
      <!-- Wrapper ridges -->
      <path d="M20 38L22 54" stroke="#EC4899" stroke-width="1" opacity="0.4"/>
      <path d="M28 36L29 54" stroke="#EC4899" stroke-width="1" opacity="0.4"/>
      <path d="M36 36L35 54" stroke="#EC4899" stroke-width="1" opacity="0.4"/>
      <path d="M44 38L42 54" stroke="#EC4899" stroke-width="1" opacity="0.4"/>
      <!-- Frosting swirl -->
      <circle cx="32" cy="26" r="14" fill="url(#cupFrost)"/>
      <circle cx="26" cy="30" r="8" fill="url(#cupFrost)"/>
      <circle cx="38" cy="30" r="8" fill="url(#cupFrost)"/>
      <circle cx="32" cy="18" r="8" fill="#FDF2F8"/>
      <!-- Cherry on top -->
      <circle cx="32" cy="12" r="4.5" fill="#EF4444"/>
      <path d="M34 8Q38 4 42 6" stroke="#15803D" stroke-width="2" stroke-linecap="round"/>
      <!-- Sprinkles -->
      <rect x="24" y="22" width="3" height="1.5" rx="0.5" fill="#FBBF24" transform="rotate(-30 24 22)"/>
      <rect x="38" y="20" width="3" height="1.5" rx="0.5" fill="#3B82F6" transform="rotate(20 38 20)"/>
      <rect x="28" y="16" width="3" height="1.5" rx="0.5" fill="#22C55E" transform="rotate(-15 28 16)"/>
      <rect x="36" y="28" width="3" height="1.5" rx="0.5" fill="#F97316" transform="rotate(35 36 28)"/>
    </svg>`
  },

  // Especiais extras
  {
    id: '2d-taco',
    name: 'Taco & Mexicano',
    type: '2d',
    group: 'Especiais',
    tags: ['taco', 'mexicano', 'burrito', 'nachos', 'tortilla', 'tex-mex'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 16c0-5 3.6-12 8-12s8 7 8 12c0 2-3.6 4-8 4s-8-2-8-4Z"/>
      <path d="M7 12c2 0 3 2 5 2s3-2 5-2"/>
      <path d="M8 16c2-1 3-1 4 0s3 1 4 0"/>
    </svg>`
  },
  {
    id: '3d-taco',
    name: 'Taco Mexicano 3D',
    type: '3d',
    group: 'Especiais',
    tags: ['taco', '3d', 'mexicano', 'guacamole', 'tex-mex', 'carne', 'quente'],
    svg: `<svg viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="tacoShell" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#FCD34D"/>
          <stop offset="100%" stop-color="#B45309"/>
        </linearGradient>
        <linearGradient id="tacoMeat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#92400E"/>
          <stop offset="100%" stop-color="#451A03"/>
        </linearGradient>
      </defs>
      <!-- Shadow -->
      <ellipse cx="32" cy="56" rx="22" ry="4" fill="#000" opacity="0.15"/>
      <!-- Taco Shell -->
      <path d="M8 44C8 26 18 12 32 12C46 12 56 26 56 44C56 48 46 52 32 52C18 52 8 48 8 44Z" fill="url(#tacoShell)"/>
      <!-- Meat fill -->
      <path d="M16 40C16 30 22 20 32 20C42 20 48 30 48 40C48 42 42 44 32 44C22 44 16 42 16 40Z" fill="url(#tacoMeat)"/>
      <!-- Lettuce -->
      <path d="M14 36C18 34 20 38 24 36C28 34 30 38 34 36C38 34 40 38 44 36C48 34 50 38 50 36" stroke="#22C55E" stroke-width="4" stroke-linecap="round" fill="none"/>
      <!-- Tomato chunks -->
      <circle cx="24" cy="32" r="3" fill="#EF4444"/>
      <circle cx="32" cy="30" r="3" fill="#DC2626"/>
      <circle cx="40" cy="32" r="3" fill="#EF4444"/>
      <!-- Cheese shred -->
      <path d="M20 38Q24 34 28 38T36 38T44 36" stroke="#FBBF24" stroke-width="2" stroke-linecap="round" fill="none"/>
    </svg>`
  },
  {
    id: '2d-delivery',
    name: 'Delivery & Entrega',
    type: '2d',
    group: 'Especiais',
    tags: ['delivery', 'entrega', 'motoboy', 'pedido', 'rapido', 'lanche'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="1" y="3" width="15" height="10" rx="2"/>
      <path d="M16 8h4l3 4v5h-3"/>
      <circle cx="5.5" cy="18" r="2.5"/>
      <circle cx="18.5" cy="18" r="2.5"/>
      <path d="M8 18h8"/>
    </svg>`
  },
  {
    id: '2d-clock',
    name: 'Horários & Turnos',
    type: '2d',
    group: 'Especiais',
    tags: ['horario', 'turno', 'almoco', 'jantar', 'brunch', 'relogio', 'tempo'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>`
  },

  // ══════════════════════════════════════════════════
  // ── JAPONÊS & ORIENTAL ──
  // ══════════════════════════════════════════════════
  {
    id: '2d-sushi',
    name: 'Sushi & Japonês',
    type: '2d',
    group: 'Japonês & Oriental',
    tags: ['sushi', 'japones', 'japa', 'sashimi', 'temaki', 'oriental', 'roll', 'niguiri'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <ellipse cx="12" cy="7" rx="9" ry="4"/>
      <path d="M3 7v10c0 2.21 4.03 4 9 4s9-1.79 9-4V7"/>
      <ellipse cx="12" cy="7" rx="5" ry="2"/>
      <circle cx="12" cy="7" r="1.5" fill="currentColor"/>
    </svg>`
  },
  {
    id: '3d-sushi',
    name: 'Sushi Roll 3D',
    type: '3d',
    group: 'Japonês & Oriental',
    tags: ['sushi', 'roll', '3d', 'niguiri', 'japones', 'salmao', 'peixe', 'oriental'],
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sushiNori" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1E293B"/>
          <stop offset="100%" stop-color="#0F172A"/>
        </linearGradient>
        <radialGradient id="sushiRice" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stop-color="#FFFFFF"/>
          <stop offset="70%" stop-color="#F1F5F9"/>
          <stop offset="100%" stop-color="#E2E8F0"/>
        </radialGradient>
        <linearGradient id="sushiSalmon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#FF6B6B"/>
          <stop offset="50%" stop-color="#FA5252"/>
          <stop offset="100%" stop-color="#E03131"/>
        </linearGradient>
        <linearGradient id="sushiAvocado" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#A9E34B"/>
          <stop offset="100%" stop-color="#74B816"/>
        </linearGradient>
        <filter id="sushiShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#000000" flood-opacity="0.3"/>
        </filter>
      </defs>
      <ellipse cx="32" cy="54" rx="22" ry="5" fill="#000000" fill-opacity="0.2"/>
      <path d="M10 22 C10 22 10 46 10 46 C10 54 20 58 32 58 C44 58 54 54 54 46 C54 46 54 22 54 22 Z" fill="url(#sushiNori)" filter="url(#sushiShadow)"/>
      <ellipse cx="32" cy="22" rx="22" ry="11" fill="#1E293B"/>
      <ellipse cx="32" cy="21" rx="19" ry="9.5" fill="url(#sushiRice)"/>
      <ellipse cx="26" cy="18" rx="2" ry="1" fill="#FFFFFF" opacity="0.8"/>
      <ellipse cx="38" cy="24" rx="2" ry="1" fill="#FFFFFF" opacity="0.8"/>
      <rect x="25" y="17" width="14" height="8" rx="4" fill="url(#sushiSalmon)"/>
      <line x1="28" y1="18" x2="26" y2="23" stroke="#FFE3E3" stroke-width="0.8" opacity="0.7"/>
      <line x1="34" y1="18" x2="32" y2="23" stroke="#FFE3E3" stroke-width="0.8" opacity="0.7"/>
      <circle cx="23" cy="23" r="3" fill="url(#sushiAvocado)"/>
      <circle cx="41" cy="21" r="2.5" fill="#FFA94D"/>
    </svg>`
  },
  {
    id: '2d-ramen',
    name: 'Ramen & Sopas',
    type: '2d',
    group: 'Japonês & Oriental',
    tags: ['ramen', 'sopa', 'lamen', 'caldo', 'oriental', 'noodles', 'macarrao'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9h18z"/>
      <path d="M6 12C6 8 8 7 12 7c4 0 6 1 6 5"/>
      <path d="M7 4l14 3"/>
      <path d="M10 2l11 3"/>
    </svg>`
  },

  // ══════════════════════════════════════════════════
  // ── PADARIA & CAFÉ ──
  // ══════════════════════════════════════════════════
  {
    id: '2d-bread',
    name: 'Padaria & Pães',
    type: '2d',
    group: 'Padaria & Café',
    tags: ['pao', 'padaria', 'baguete', 'integral', 'artesanal', 'cafe', 'torrada'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 11c0-4 3.5-7 8-7s8 3 8 7c0 3-1.5 5-3 6H7c-1.5-1-3-3-3-6z"/>
      <line x1="8" y1="10" x2="8" y2="12"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="16" y1="10" x2="16" y2="12"/>
      <path d="M5 17h14"/>
    </svg>`
  },
  {
    id: '3d-bread',
    name: 'Pão Artesanal 3D',
    type: '3d',
    group: 'Padaria & Café',
    tags: ['pao', 'artesanal', '3d', 'fermentacao', 'croissant', 'padaria', 'baguete'],
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="breadCrust" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#F59E0B"/>
          <stop offset="50%" stop-color="#D97706"/>
          <stop offset="100%" stop-color="#78350F"/>
        </radialGradient>
        <linearGradient id="breadCut" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FEF3C7"/>
          <stop offset="100%" stop-color="#FDE68A"/>
        </linearGradient>
        <filter id="breadShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="3.5" flood-color="#000000" flood-opacity="0.3"/>
        </filter>
      </defs>
      <ellipse cx="32" cy="52" rx="22" ry="5" fill="#000000" fill-opacity="0.2"/>
      <path d="M12 36 C12 20 20 16 32 16 C44 16 52 20 52 36 C52 46 44 48 32 48 C20 48 12 46 12 36 Z" fill="url(#breadCrust)" filter="url(#breadShadow)"/>
      <path d="M22 24 C24 28 24 34 22 38" stroke="url(#breadCut)" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M32 22 C34 27 34 35 32 40" stroke="url(#breadCut)" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M42 24 C44 28 44 34 42 38" stroke="url(#breadCut)" stroke-width="2.5" stroke-linecap="round"/>
      <ellipse cx="27" cy="20" rx="4" ry="1.5" fill="#FDE68A" opacity="0.6"/>
    </svg>`
  },

  // ══════════════════════════════════════════════════
  // ── SAUDÁVEL & VEG EXPANDIDO ──
  // ══════════════════════════════════════════════════
  {
    id: '2d-acai',
    name: 'Açaí & Bowls',
    type: '2d',
    group: 'Saudável & Veg',
    tags: ['acai', 'açaí', 'bowl', 'tropical', 'frozen', 'fruta', 'banana', 'granola', 'sorvete'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 11c0 5 4.03 8 9 8s9-3 9-8H3z"/>
      <circle cx="9" cy="8" r="2.5"/>
      <circle cx="15" cy="8" r="2.5"/>
      <circle cx="12" cy="6" r="2"/>
      <path d="M7 21h10"/>
    </svg>`
  },
  {
    id: '3d-acai',
    name: 'Açaí Bowl 3D',
    type: '3d',
    group: 'Saudável & Veg',
    tags: ['acai', 'açaí', 'bowl', '3d', 'banana', 'granola', 'tropical', 'roxo', 'fit'],
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="acaiBowl" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stop-color="#4A0E4E"/>
          <stop offset="60%" stop-color="#2D0830"/>
          <stop offset="100%" stop-color="#19031B"/>
        </radialGradient>
        <linearGradient id="acaiBowlRim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#E2E8F0"/>
          <stop offset="50%" stop-color="#94A3B8"/>
          <stop offset="100%" stop-color="#64748B"/>
        </linearGradient>
        <linearGradient id="acaiBanana" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FFF9DB"/>
          <stop offset="100%" stop-color="#FFE066"/>
        </linearGradient>
        <filter id="acaiShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="3.5" flood-color="#000000" flood-opacity="0.3"/>
        </filter>
      </defs>
      <ellipse cx="32" cy="56" rx="20" ry="4" fill="#000000" fill-opacity="0.25"/>
      <path d="M8 26 C8 44 18 54 32 54 C46 54 56 44 56 26 Z" fill="url(#acaiBowlRim)" filter="url(#acaiShadow)"/>
      <ellipse cx="32" cy="26" rx="24" ry="11" fill="#475569"/>
      <ellipse cx="32" cy="26" rx="22" ry="9.5" fill="url(#acaiBowl)"/>
      <ellipse cx="22" cy="24" rx="4" ry="2.5" fill="url(#acaiBanana)"/>
      <circle cx="22" cy="24" r="0.8" fill="#D97706"/>
      <ellipse cx="29" cy="22" rx="4" ry="2.5" fill="url(#acaiBanana)"/>
      <circle cx="29" cy="22" r="0.8" fill="#D97706"/>
      <ellipse cx="36" cy="24" rx="4" ry="2.5" fill="url(#acaiBanana)"/>
      <circle cx="36" cy="24" r="0.8" fill="#D97706"/>
      <circle cx="43" cy="27" r="3" fill="#EF4444"/>
      <circle cx="45" cy="28" r="2" fill="#DC2626"/>
      <circle cx="25" cy="29" r="1.5" fill="#F59E0B"/>
      <circle cx="33" cy="29" r="1.5" fill="#F59E0B"/>
    </svg>`
  },
  {
    id: '2d-poke',
    name: 'Poke & Bowls',
    type: '2d',
    group: 'Saudável & Veg',
    tags: ['poke', 'hawaiano', 'bowl', 'salmao', 'fit', 'saudavel', 'arroz', 'peixe'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 11c0 5 4 9 9 9s9-4 9-9H3z"/>
      <path d="M7 11c0-2 2-3 5-3s5 1 5 3"/>
      <circle cx="9" cy="7" r="1.5" fill="currentColor"/>
      <circle cx="15" cy="7" r="1.5" fill="currentColor"/>
      <circle cx="12" cy="5" r="1.2" fill="currentColor"/>
    </svg>`
  },

  // ══════════════════════════════════════════════════
  // ── SOBREMESAS EXPANDIDO ──
  // ══════════════════════════════════════════════════
  {
    id: '2d-cake',
    name: 'Bolo & Confeitaria',
    type: '2d',
    group: 'Sobremesas',
    tags: ['bolo', 'confeitaria', 'aniversario', 'fatia', 'layer', 'doce', 'torta'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/>
      <path d="M4 16s2-1 4-1 4 1 4 1 2-1 4-1 4 1 4 1"/>
      <path d="M2 21h20"/>
      <line x1="12" y1="7" x2="12" y2="11"/>
      <circle cx="12" cy="4" r="1.5" fill="currentColor"/>
    </svg>`
  },
  {
    id: '3d-cake',
    name: 'Bolo Confeitado 3D',
    type: '3d',
    group: 'Sobremesas',
    tags: ['bolo', '3d', 'confeitaria', 'decorado', 'festa', 'torta', 'morango', 'creme'],
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cakeBase" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FBCFE8"/>
          <stop offset="50%" stop-color="#F472B6"/>
          <stop offset="100%" stop-color="#DB2777"/>
        </linearGradient>
        <radialGradient id="cakeCream" cx="50%" cy="30%" r="60%">
          <stop offset="0%" stop-color="#FFFFFF"/>
          <stop offset="70%" stop-color="#FFF1F2"/>
          <stop offset="100%" stop-color="#FCE7F3"/>
        </radialGradient>
        <filter id="cakeShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="3.5" flood-color="#000000" flood-opacity="0.25"/>
        </filter>
      </defs>
      <ellipse cx="32" cy="54" rx="22" ry="5" fill="#000000" fill-opacity="0.2"/>
      <path d="M12 28 C12 28 12 44 12 44 C12 52 20 56 32 56 C44 56 52 52 52 44 C52 44 52 28 52 28 Z" fill="url(#cakeBase)" filter="url(#cakeShadow)"/>
      <ellipse cx="32" cy="28" rx="20" ry="9" fill="url(#cakeCream)"/>
      <path d="M12 29 C14 36 17 37 19 33 C21 39 25 39 27 32 C30 38 34 38 37 32 C40 39 44 37 46 32 C48 36 50 35 52 29" fill="url(#cakeCream)"/>
      <path d="M32 14 C27 18 27 24 32 25 C37 24 37 18 32 14 Z" fill="#EF4444"/>
      <path d="M30 13 C32 15 32 15 34 13" stroke="#22C55E" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="24" cy="26" r="1.5" fill="#3B82F6"/>
      <circle cx="40" cy="26" r="1.5" fill="#FBBF24"/>
    </svg>`
  },
  {
    id: '2d-cupcake',
    name: 'Cupcake & Docinhos',
    type: '2d',
    group: 'Sobremesas',
    tags: ['cupcake', 'docinho', 'muffin', 'brigadeiro', 'doce', 'confeitaria'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 10l1.5 9.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5L18 10"/>
      <path d="M4.5 10c0-3 3-5 7.5-5s7.5 2 7.5 5H4.5z"/>
      <circle cx="12" cy="3.5" r="1.5" fill="currentColor"/>
    </svg>`
  },
  {
    id: '3d-cupcake',
    name: 'Cupcake 3D Premium',
    type: '3d',
    group: 'Sobremesas',
    tags: ['cupcake', '3d', 'premium', 'confeitaria', 'sprinkles', 'muffin', 'doce'],
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cupcakeWrapper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FCD34D"/>
          <stop offset="100%" stop-color="#D97706"/>
        </linearGradient>
        <radialGradient id="cupcakeCream" cx="40%" cy="30%" r="65%">
          <stop offset="0%" stop-color="#F472B6"/>
          <stop offset="60%" stop-color="#EC4899"/>
          <stop offset="100%" stop-color="#BE185D"/>
        </radialGradient>
        <filter id="cupcakeShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="3.5" flood-color="#000000" flood-opacity="0.25"/>
        </filter>
      </defs>
      <ellipse cx="32" cy="54" rx="18" ry="4" fill="#000000" fill-opacity="0.2"/>
      <path d="M16 32 L20 52 C20.5 53 22 54 24 54 L40 54 C42 54 43.5 53 44 52 L48 32 Z" fill="url(#cupcakeWrapper)" filter="url(#cupcakeShadow)"/>
      <line x1="24" y1="34" x2="26" y2="52" stroke="#92400E" stroke-width="1" opacity="0.4"/>
      <line x1="32" y1="34" x2="32" y2="53" stroke="#92400E" stroke-width="1" opacity="0.4"/>
      <line x1="40" y1="34" x2="38" y2="52" stroke="#92400E" stroke-width="1" opacity="0.4"/>
      <path d="M14 32 C14 22 22 18 32 18 C42 18 50 22 50 32 C50 36 44 38 32 38 C20 38 14 36 14 32 Z" fill="url(#cupcakeCream)"/>
      <path d="M20 22 C22 14 27 12 32 12 C37 12 42 14 44 22 Z" fill="url(#cupcakeCream)"/>
      <circle cx="32" cy="11" r="3.5" fill="#DC2626"/>
      <path d="M33 8 C35 5 38 4 41 5" stroke="#15803D" stroke-width="1.2" stroke-linecap="round"/>
      <circle cx="26" cy="26" r="1" fill="#3B82F6"/>
      <circle cx="38" cy="25" r="1" fill="#10B981"/>
      <circle cx="32" cy="30" r="1" fill="#FBBF24"/>
    </svg>`
  },

  // ══════════════════════════════════════════════════
  // ── PRATOS & CARNES EXPANDIDO ──
  // ══════════════════════════════════════════════════
  {
    id: '2d-bbq',
    name: 'Churrasco & BBQ',
    type: '2d',
    group: 'Pratos & Carnes',
    tags: ['churrasco', 'bbq', 'espeto', 'brasa', 'carvao', 'picanha', 'carne'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <line x1="3" y1="21" x2="21" y2="3"/>
      <rect x="6" y="10" width="4" height="6" rx="1" transform="rotate(-45 8 13)"/>
      <rect x="11" y="5" width="4" height="6" rx="1" transform="rotate(-45 13 8)"/>
      <path d="M19 5l-2 2"/>
    </svg>`
  },
  {
    id: '3d-bbq',
    name: 'Espeto Churrasco 3D',
    type: '3d',
    group: 'Pratos & Carnes',
    tags: ['churrasco', 'bbq', '3d', 'espeto', 'picanha', 'carne', 'grelhados', 'brasa'],
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bbqSkewer" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#E2E8F0"/>
          <stop offset="100%" stop-color="#64748B"/>
        </linearGradient>
        <radialGradient id="bbqMeat" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#B91C1C"/>
          <stop offset="50%" stop-color="#7F1D1D"/>
          <stop offset="100%" stop-color="#450A0A"/>
        </radialGradient>
        <filter id="bbqShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="3.5" flood-color="#000000" flood-opacity="0.3"/>
        </filter>
      </defs>
      <line x1="8" y1="56" x2="56" y2="8" stroke="url(#bbqSkewer)" stroke-width="3.5" stroke-linecap="round" filter="url(#bbqShadow)"/>
      <rect x="16" y="34" width="13" height="13" rx="4" transform="rotate(-45 22.5 40.5)" fill="url(#bbqMeat)"/>
      <line x1="18" y1="38" x2="26" y2="44" stroke="#1C1917" stroke-width="1.5" stroke-linecap="round"/>
      <rect x="27" y="27" width="6" height="10" rx="2" transform="rotate(-45 30 32)" fill="#F59E0B"/>
      <rect x="31" y="19" width="13" height="13" rx="4" transform="rotate(-45 37.5 25.5)" fill="url(#bbqMeat)"/>
      <line x1="33" y1="23" x2="41" y2="29" stroke="#1C1917" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="8" y1="56" x2="15" y2="49" stroke="#78350F" stroke-width="5.5" stroke-linecap="round"/>
    </svg>`
  },

  // ══════════════════════════════════════════════════
  // ── BEBIDAS EXPANDIDO ──
  // ══════════════════════════════════════════════════
  {
    id: '2d-wine',
    name: 'Vinhos & Espumantes',
    type: '2d',
    group: 'Bebidas',
    tags: ['vinho', 'espumante', 'tinto', 'branco', 'taca', 'sommelier', 'adega', 'bar'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 2h8l1 7a5 5 0 0 1-5 5 5 5 0 0 1-5-5L8 2z"/>
      <line x1="12" y1="14" x2="12" y2="21"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="8" y1="6" x2="16" y2="6"/>
    </svg>`
  },
  {
    id: '3d-wine',
    name: 'Taça de Vinho 3D',
    type: '3d',
    group: 'Bebidas',
    tags: ['vinho', '3d', 'taca', 'sommelier', 'degustacao', 'tinto', 'adega'],
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="wineLiquid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#BE185D"/>
          <stop offset="60%" stop-color="#831843"/>
          <stop offset="100%" stop-color="#500724"/>
        </linearGradient>
        <linearGradient id="wineGlass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.6"/>
          <stop offset="100%" stop-color="#94A3B8" stop-opacity="0.2"/>
        </linearGradient>
        <filter id="wineShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="3.5" flood-color="#000000" flood-opacity="0.25"/>
        </filter>
      </defs>
      <ellipse cx="32" cy="56" rx="14" ry="3.5" fill="#000000" fill-opacity="0.2"/>
      <path d="M20 12 C20 12 16 32 32 36 C48 32 44 12 44 12 Z" fill="url(#wineGlass)" stroke="#E2E8F0" stroke-width="1.2" filter="url(#wineShadow)"/>
      <path d="M22 22 C22 22 19 32 32 35 C45 32 42 22 42 22 Z" fill="url(#wineLiquid)"/>
      <ellipse cx="32" cy="22" rx="10" ry="3" fill="#BE185D"/>
      <rect x="30.5" y="36" width="3" height="17" rx="1.5" fill="#CBD5E1"/>
      <ellipse cx="32" cy="53" rx="12" ry="3" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1"/>
      <path d="M23 16 C23 20 22 26 25 30" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>
    </svg>`
  },
  {
    id: '2d-juice',
    name: 'Sucos Naturais',
    type: '2d',
    group: 'Bebidas',
    tags: ['suco', 'natural', 'vitamina', 'frutas', 'detox', 'gelo', 'laranja', 'limonada'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 8h14l-1.5 12a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2L5 8z"/>
      <line x1="4" y1="8" x2="20" y2="8"/>
      <path d="M10 8V3l4 2"/>
      <line x1="7" y1="13" x2="17" y2="13"/>
    </svg>`
  },

  // ══════════════════════════════════════════════════
  // ── LANCHES EXPANDIDO ──
  // ══════════════════════════════════════════════════
  {
    id: '2d-petisco',
    name: 'Petiscos & Porções',
    type: '2d',
    group: 'Lanches',
    tags: ['petisco', 'porcao', 'tira-gosto', 'bar', 'aperitivo', 'fritas', 'boteco'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 14c0 3.3 2.7 6 6 6h4c3.3 0 6-2.7 6-6V9H4v5z"/>
      <line x1="7" y1="9" x2="9" y2="4"/>
      <line x1="12" y1="9" x2="12" y2="3"/>
      <line x1="17" y1="9" x2="15" y2="4"/>
      <path d="M3 9h18"/>
    </svg>`
  },

  // ══════════════════════════════════════════════════
  // ── ESPECIAIS EXPANDIDO ──
  // ══════════════════════════════════════════════════
  {
    id: '2d-taco',
    name: 'Taco & Mexicano',
    type: '2d',
    group: 'Especiais',
    tags: ['taco', 'mexicano', 'burrito', 'nachos', 'tortilla', 'texmex', 'pimenta'],
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 15C3 8.37 8.37 3 15 3c2.76 0 5.3 1 7.27 2.73a1 1 0 0 1 .18 1.34L18 13.5l-4 4.5-9 1A4 4 0 0 1 3 15z"/>
      <circle cx="10" cy="11" r="1.5" fill="currentColor"/>
      <circle cx="14" cy="10" r="1.5" fill="currentColor"/>
      <path d="M7 16l3-1 2 2"/>
    </svg>`
  },
  {
    id: '3d-taco',
    name: 'Taco Mexicano 3D',
    type: '3d',
    group: 'Especiais',
    tags: ['taco', '3d', 'mexicano', 'guacamole', 'texmex', 'tortilla', 'nachos'],
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="tacoShell" cx="30%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#FCD34D"/>
          <stop offset="70%" stop-color="#F59E0B"/>
          <stop offset="100%" stop-color="#D97706"/>
        </radialGradient>
        <linearGradient id="tacoBeef" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#991B1B"/>
          <stop offset="100%" stop-color="#450A0A"/>
        </linearGradient>
        <filter id="tacoShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="3.5" flood-color="#000000" flood-opacity="0.25"/>
        </filter>
      </defs>
      <ellipse cx="32" cy="52" rx="22" ry="5" fill="#000000" fill-opacity="0.2"/>
      <path d="M10 42 C10 20 22 14 36 14 C48 14 54 22 54 36 C54 46 44 48 32 48 C20 48 10 46 10 42 Z" fill="url(#tacoShell)" filter="url(#tacoShadow)"/>
      <path d="M18 36 C22 28 36 24 48 30 C50 36 44 44 32 44 C24 44 18 40 18 36 Z" fill="url(#tacoBeef)"/>
      <circle cx="28" cy="30" r="3" fill="#22C55E"/>
      <circle cx="38" cy="31" r="3.5" fill="#EF4444"/>
      <circle cx="33" cy="28" r="2.5" fill="#84CC16"/>
      <circle cx="44" cy="33" r="2" fill="#FBBF24"/>
      <path d="M10 42 C18 48 38 48 54 36" stroke="#FEF3C7" stroke-width="2" stroke-linecap="round" fill="none"/>
    </svg>`
  }
];

export function findCatalogIcon(keyOrId?: string | null): CatalogIcon | undefined {
  if (!keyOrId) return undefined;
  return ICON_CATALOG.find(i => i.id === keyOrId || i.id === `2d-${keyOrId}` || i.id === `3d-${keyOrId}`);
}
