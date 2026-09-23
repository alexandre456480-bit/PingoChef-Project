# 🎨 05 — Design System e Templates

> **Domínio**: Templates de cardápio, paletas, fontes, animações, estilos de categorias, blocos da Home e direção visual.  
> **Depende de**: [01-ARQUITETURA-GERAL.md](./01-ARQUITETURA-GERAL.md), [03-PAINEL-USUARIO.md](./03-PAINEL-USUARIO.md), [04-CARDAPIO-CONTEUDO.md](./04-CARDAPIO-CONTEUDO.md)  
> **Referenciado por**: [06-EXPERIENCIA-PUBLICA.md](./06-EXPERIENCIA-PUBLICA.md), [08-BANCO-DADOS-RLS.md](./08-BANCO-DADOS-RLS.md)

---

## 1. Filosofia de Design

> O design deve preservar qualidade mesmo com personalização. A liberdade é oferecida dentro de **sistemas controlados**: templates, tokens de cor, pares tipográficos e opções de componente.

### Princípios

| Princípio                         | Significado                                                         |
|-----------------------------------|---------------------------------------------------------------------|
| **Qualidade com personalização**  | O usuário personaliza, mas o sistema garante que fica bonito        |
| **Liberdade com guardrails**      | Opções controladas, nunca controle pixel a pixel                    |
| **Mobile first**                  | Templates são projetados para celular primeiro                      |
| **Marca preservada**              | Logo, capa, cores e fontes mantêm identidade do estabelecimento    |
| **Performance é design**          | Animações performáticas; fontes com peso mínimo; imagens otimizadas |

---

## 2. Templates de Cardápio

### Templates Disponíveis no MVP

Cada template define: posição dos itens, posição da logo, hero section, layout das categorias, estilo dos cards e comportamento geral.

| Template       | Estilo Visual                                     | Ideal para                          | Detalhes de Design                                                                  |
|----------------|---------------------------------------------------|-------------------------------------|--------------------------------------------------------------------------------------|
| **Minimal**    | Limpo, espaçoso, tipografia protagonista          | Cafés, bistrôs, casas artesanais    | Cores neutras, muito whitespace, cards simples com borda sutil, transições suaves de fade |
| **Premium**    | Sofisticado, fotografia dominante, contraste alto | Restaurantes fine dining, steakhouses | Fotos full-width, overlay escuro elegante, fontes serifadas, sombras profundas       |
| **Dark**       | Fundo escuro, neon sutil, atmosfera noturna       | Bares, pubs, casas noturnas         | Glassmorphism nos cards, glow sutil nos destaques, bordas luminosas, gradientes escuros |
| **Elegant**    | Clássico, serifado, tons quentes                  | Vinícolas, restaurantes italianos   | Ornamentos sutis, tipografia clássica, tons dourados/burgundy, cards com bordas arredondadas |
| **Modern**     | Geométrico, cores vibrantes, flat design          | Fast food, poké, açaí              | Cards arredondados grandes, cores pop, ícones bold, claymorphism nos cards           |
| **Bar**        | Industrial, texturas, tipografia bold             | Bares, breweries, gastropubs        | Texturas de madeira/metal, tipografia condensada, ícones de drinks, mood escuro      |
| **Restaurant** | Balanceado, fotografia com texto, versátil        | Restaurantes familiares, buffets    | Layout equilibrado foto/texto, cards médios, paleta quente, hierarquia clara         |

### Estrutura Técnica de um Template

Cada template é definido por um **schema de configuração comum** — template **não duplica regras de negócio**, apenas define como renderizar.

```typescript
interface TemplateConfig {
  key: string;                    // 'minimal' | 'premium' | 'dark' | ...
  name: string;                   // Nome de exibição
  
  // Layout
  heroStyle: 'full-width' | 'contained' | 'split' | 'overlay';
  logoPosition: 'top-left' | 'top-center' | 'hero-center' | 'hero-bottom';
  categoryLayout: 'horizontal-scroll' | 'grid' | 'vertical-list' | 'tabs';
  itemCardStyle: 'minimal' | 'photo-dominant' | 'side-by-side' | 'overlay';
  
  // Componentes
  cardBorderRadius: number;       // 0, 8, 16, 24
  cardShadow: 'none' | 'subtle' | 'medium' | 'deep';
  cardDensity: 'compact' | 'normal' | 'spacious';
  
  // Efeitos
  surfaceStyle: 'flat' | 'glassmorphism' | 'claymorphism' | 'neumorphism';
  
  // Defaults
  defaultPalette: string;         // Paleta padrão do template
  defaultFontPair: string;        // Par tipográfico padrão
  defaultMotion: string;          // Animação padrão
}
```

### O que Cada Template Muda

```
┌─────────────────────────────────────────────────────────────┐
│                        TEMPLATE                              │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Hero     │ │ Logo     │ │ Cards    │ │ Categorias│       │
│  │ Position │ │ Position │ │ Style    │ │ Layout    │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │ Surface  │ │ Density  │ │ Shadows  │                    │
│  │ Effects  │ │ Spacing  │ │ Borders  │                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
│                                                              │
│  ❌ NÃO MUDA: regras de negócio, dados, auth, validação    │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Estilos Visuais Avançados

### Glassmorphism
- **Uso**: Template Dark, elementos de destaque
- **Implementação**: `backdrop-filter: blur(10-20px)`, background semi-transparente, bordas sutis
- **Performance**: Usar com moderação; `will-change: transform` em elementos animados
- **Fallback**: Background sólido semi-transparente para browsers sem suporte

### Claymorphism
- **Uso**: Template Modern, cards de produto
- **Implementação**: Sombras duplas (interna e externa), bordas arredondadas grandes, cores suaves
- **Efeito**: Cards parecem "moldados em argila" — 3D sutil

### Neumorphism (sutil)
- **Uso**: Template Elegant, botões e controles
- **Implementação**: Sombra clara + sombra escura, fundo homogêneo
- **Cuidado**: Manter contraste acessível — neumorphism puro pode violar WCAG

### Temas de Cor

| Tema         | Características                                              |
|--------------|--------------------------------------------------------------|
| **Dark**     | Fundo #0D0D0D a #1A1A2E, texto claro, acentos vibrantes    |
| **Light**    | Fundo #FAFAFA a #FFF, texto escuro, acentos suaves          |
| **Suave**    | Pastéis, gradientes sutis, sensação aconchegante            |
| **Vibrante** | Cores saturadas, contraste alto, energia visual              |
| **Quente**   | Tons terrosos, madeira, dourado, burgundy                    |
| **Frio**     | Azuis, cinzas, prateados, minimalismo                        |

---

## 4. Sistema de Paletas

### Paletas Pré-definidas

Cada paleta é um conjunto harmonioso de cores projetado por designer:

| Paleta              | Primary      | Secondary    | Accent       | Background   | Surface      | Text         |
|---------------------|--------------|--------------|--------------|--------------|--------------|--------------|
| **Midnight Gold**   | `#C8A961`    | `#1A1A2E`    | `#E6B422`    | `#0D0D1A`    | `#16162A`    | `#F0E6D3`    |
| **Forest Fresh**    | `#2D5F2D`    | `#8FBC8F`    | `#D4A574`    | `#F5F0EB`    | `#FFFFFF`    | `#1A3A1A`    |
| **Ocean Breeze**    | `#1E3A5F`    | `#6B9DC2`    | `#FF6B35`    | `#F7F9FC`    | `#FFFFFF`    | `#1A2940`    |
| **Warm Sunset**     | `#C84B31`    | `#ECDBBA`    | `#2D4059`    | `#FFF8F0`    | `#FFFFFF`    | `#2D2D2D`    |
| **Berry Luxe**      | `#6B2D5B`    | `#D4A5C2`    | `#F2C94C`    | `#FAF5F8`    | `#FFFFFF`    | `#3D1A33`    |
| **Urban Slate**     | `#2C3E50`    | `#7F8C8D`    | `#E74C3C`    | `#ECF0F1`    | `#FFFFFF`    | `#2C3E50`    |
| **Neon Night**      | `#00F5FF`    | `#FF00E4`    | `#FFEA00`    | `#0A0A1A`    | `#141428`    | `#E0E0FF`    |
| **Terra Cotta**     | `#C4704B`    | `#D4A574`    | `#5B7B5B`    | `#FDF6F0`    | `#FFFFFF`    | `#3D2B1F`    |
| **Classic Cream**   | `#8B4513`    | `#D2B48C`    | `#B22222`    | `#FFFDD0`    | `#FFF8E7`    | `#3E2723`    |
| **Arctic Blue**     | `#1B4D6E`    | `#5BA4CF`    | `#FF8C42`    | `#F0F7FA`    | `#FFFFFF`    | `#1B2A3E`    |

### Seletor de Cor Livre

Além das paletas, o usuário pode escolher cores personalizadas **com guardrails**:

- **Verificação de contraste**: Sistema avalia se a combinação atende WCAG AA
- **Sugestão de correção**: Se contraste insuficiente, sugerir ajuste automático
- **Fallback seguro**: Se o usuário insistir em contraste ruim, manter funcional
- **Tokens gerados**: A partir da cor primária, gerar derivadas (hover, active, disabled)

```typescript
interface PaletteConfig {
  preset: string | null;          // Nome da paleta ou null se custom
  colors: {
    primary: string;              // Cor principal da marca
    secondary: string;            // Cor complementar
    accent: string;               // Cor de destaque/CTA
    background: string;           // Fundo da página
    surface: string;              // Fundo de cards/modais
    textPrimary: string;          // Texto principal
    textSecondary: string;        // Texto secundário
    error: string;                // Mensagens de erro
    success: string;              // Confirmações
  };
  contrastValid: boolean;         // Calculado pelo sistema
}
```

---

## 5. Tipografia — Pares de Fontes Curados

Cada par é escolhido para funcionar em conjunto (título + corpo):

| Par                    | Categoria    | Título (Heading)     | Corpo (Body)          | Ideal para                    |
|------------------------|-------------|----------------------|-----------------------|-------------------------------|
| **Elegante**           | Serifada    | Playfair Display     | Lora                  | Fine dining, vinícola          |
| **Moderna**            | Sans-serif  | Inter                | Inter                 | Minimalismo, tech             |
| **Casual**             | Arredondada | Nunito                | Nunito Sans           | Cafés, lanches, açaí          |
| **Premium**            | Contraste   | Cormorant Garamond   | Raleway               | Restaurantes sofisticados     |
| **Clássica**           | Serifada    | Merriweather         | Source Sans 3         | Bistrôs, padarias             |
| **Minimalista**        | Geométrica  | Outfit               | DM Sans               | Poké, food truck, moderno     |
| **Bold**               | Condensada  | Oswald               | Roboto                | Bares, pubs, hamburguerias    |
| **Suave**              | Humanista   | Quicksand            | Poppins               | Confeitarias, sorveterias     |

### Regras de Tipografia

- **Carregar somente pesos usados** — não importar a família inteira
- **Impedir fontes externas arbitrárias** — somente da biblioteca curada
- **Fallback seguro**: `system-ui, -apple-system, sans-serif`
- **Tamanhos responsivos**: Escala tipográfica definida por design tokens
- **Pesos recomendados**: Regular (400) e Bold (700); Semibold (600) quando disponível

---

## 6. Animações e Transições

### Tipos Disponíveis

| Tipo       | Uso                                | Duração       | Propriedade                      |
|------------|------------------------------------|---------------|----------------------------------|
| **Fade**   | Transição entre páginas/estados    | 300-500ms     | `opacity`                        |
| **Slide**  | Entrada de elementos, categorias   | 300-500ms     | `transform: translateX/Y`        |
| **Scale**  | Hover em cards, entrada de modais  | 200-300ms     | `transform: scale`               |
| **None**   | Sem animação (acessibilidade)      | 0ms           | —                                |

### Regras de Performance

- **Duração máxima**: 700ms para qualquer animação
- **GPU-friendly**: Usar `transform` e `opacity` (não `width`, `height`, `top`, `left`)
- **`will-change`**: Declarar apenas quando necessário
- **`prefers-reduced-motion`**: Reduzir ou eliminar animações
- **Não bloquear interação**: Usuário pode clicar durante animação

### Transição Welcome → Home

- Zoom, fade ou slide entre estados
- Duração: 300-700ms
- Respeitar `prefers-reduced-motion`
- Não carregar toda a galeria antes do CTA "Ver cardápio"

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 7. Estilo de Categorias

O usuário configura como as categorias aparecem no cardápio público:

| Modo            | Visual                                         |
|-----------------|-------------------------------------------------|
| `icon`          | Somente ícone da categoria                      |
| `name`          | Somente nome da categoria                       |
| `icon_name`     | Ícone + nome juntos                             |

### Layout de Categorias por Template

| Layout                 | Comportamento                                          |
|------------------------|--------------------------------------------------------|
| `horizontal-scroll`    | Barra horizontal com scroll (mobile-friendly)          |
| `grid`                 | Grid de cards de categoria                              |
| `vertical-list`        | Lista vertical com separadores                          |
| `tabs`                 | Tabs fixas no topo com scroll do conteúdo               |

---

## 8. Blocos da Home — Modular

### Estrutura

A Home é composta por blocos que o usuário pode **ativar, desativar, configurar e reordenar**.

```typescript
interface HomeBlock {
  id: string;
  business_id: string;
  type: HomeBlockType;
  position: number;
  enabled: boolean;
  config_json: Record<string, unknown>;
}

type HomeBlockType = 
  | 'hero'              // Obrigatório — capa + logo
  | 'promotion'         // Promoções ativas
  | 'most_liked'        // Mais curtidos (não "mais pedidos")
  | 'featured_product'  // Especial da Casa
  | 'categories';       // A```
┌─────────────────────────────────────────────────────────────┐
│ 🎨 DESIGN DO ESTABELECIMENTO                                │
│                                                             │
│ ┌───────────────────────────┬─────────────────────────────┐ │
│ │ 📱 Tela Inicial (Welcome) │ 📖 Tela Cardápio (Vitrine)  │ │
│ └───────────────────────────┴─────────────────────────────┘ │
│                                                             │
│ ── NA ABA TELA INICIAL (WELCOME) ──                         │
│ [Modelos Prontos] vs [Personalizar do Zero]                │
│                                                             │
│ 1. 🖼️ Background:                                          │
│    • Imagem: Guia de Proporção 9:16 (1080x1920px, até 2MB)  │
│    • Cor Única: Seletor livre + presets escuros elegantes    │
│    • Gradiente: Direções (↓, →, ↘, ◎) + Cores 1 e 2         │
│    • Overlay: Slider de opacidade para contraste WCAG       │
│ 2. 🛡️ Logo & Formato:                                       │
│    • Formatos: Círculo, Quadrado, Arredondado, Squircle,    │
│      Hexágono, Escudo                                       │
│    • Borda: Ativa/Inativa, cor e espessura customizadas     │
│    • Exibir apenas a logo: Oculta títulos para minimalismo  │
│ 3. ⚡ Animações de Entrada:                                  │
│    • Com Animação: Portal Reveal, anel orbital e float      │
│    • Sem Animação: Abertura direta instantânea (0ms)        │
│                                                             │
│ ── NA ABA TELA CARDÁPIO (VITRINE) ──                        │
│ 1. 📱 Template do Cardápio (Minimal, Premium, Dark, Modern) │
│ 2. 🎨 Paleta de Cores da Vitrine                            │
│ 3. 🔤 Tipografia e Pares de Fontes                          │
│ 4. ✨ Animações dos Cards (Fade, Slide, Scale, Nenhuma)     │
│ 5. 📐 Estilo de Categorias (Ícone, Nome, Ícone + Nome)      │
│ 6. 🧱 Blocos da Home (Hero, Promoções, Mais Curtidos, etc.) │
│                                                             │
│ [🔄 Restaurar]  [💾 Salvar Alterações de Design]            │
└─────────────────────────────────────────────────────────────┘
```

### Comportamento

- **Alterações são locais** até clicar "Salvar Alterações de Design"
- **Preview atualiza em tempo real (1:1)** com as alterações locais no smartphone do dashboard
- **Salvar** persiste no backend (`PUT /api/v1/design`) e no banco (`design_settings`)
- **Restaurar** reverte para o último estado salvo

---

## 10. Schema de Design no Banco

```typescript
interface WelcomeScreenConfig {
  mode: 'template' | 'custom';
  template_id?: string;
  background_type: 'image' | 'color' | 'gradient';
  background_image_url?: string | null;
  background_color: string;
  gradient: {
    direction: 'to-bottom' | 'to-right' | 'to-bottom-right' | 'radial';
    color_start: string;
    color_end: string;
  };
  overlay_opacity: number; // 0 a 1 (ex: 0.7)
  logo_style: {
    show_only_logo: boolean;
    shape: 'circle' | 'square' | 'rounded' | 'squircle' | 'hexagon' | 'shield';
    has_border: boolean;
    border_color?: string;
    border_width?: number;
  };
  animations_enabled: boolean;
}

interface DesignSettings {
  business_id: string;
  template_key: string;          // 'minimal' | 'premium' | 'dark' | ...
  palette: PaletteConfig;        // Preset ou custom
  font_pair: string;             // 'elegant' | 'modern' | 'casual' | ...
  category_style: string;        // 'icon' | 'name' | 'icon_name'
  motion: string;                // 'fade' | 'slide' | 'scale' | 'none'
  welcome_screen: WelcomeScreenConfig; // Configuração completa da Tela Inicial
  home_blocks: HomeBlock[];      // Blocos configurados da vitrine
  custom_config?: Record<string, unknown>; // Configs extras por template
}
```�──────────────┐ │
│ │ ✨ ANIMAÇÕES                          │ │
│ │ Fade / Slide / Scale / Nenhuma       │ │
│ │ Preview da animação escolhida        │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ 📐 CATEGORIAS                        │ │
│ │ Ícone / Nome / Ícone + Nome          │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ 🧱 BLOCOS DA HOME                    │ │
│ │ Ativar/desativar, configurar,        │ │
│ │ arrastar para reordenar              │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ [💾 Salvar Rascunho]  [👁️ Preview]      │
└─────────────────────────────────────────┘
```

### Comportamento

- **Alterações são locais** até clicar "Salvar Rascunho"
- **Preview atualiza em tempo real** com as alterações locais
- **Salvar** persiste como rascunho no banco (`design_settings`)
- **Publicar** (ação global) inclui as configurações de design no snapshot
- **Restaurar** reverte para o último estado salvo

---

## 10. Schema de Design no Banco

```typescript
interface DesignSettings {
  business_id: string;
  template_key: string;          // 'minimal' | 'premium' | 'dark' | ...
  palette: PaletteConfig;        // Preset ou custom
  font_pair: string;             // 'elegant' | 'modern' | 'casual' | ...
  category_style: string;        // 'icon' | 'name' | 'icon_name'
  motion: string;                // 'fade' | 'slide' | 'scale' | 'none'
  custom_config?: Record<string, unknown>; // Configs extras por template
}
```

> Schema JSON **validado e versionado** — alterações no formato devem ser migradas.

---

## 11. Cards de Produto — Variações por Template

| Estilo            | Composição                                                    |
|-------------------|---------------------------------------------------------------|
| **Minimal**       | Nome + preço + descrição curta; imagem discreta ou ausente    |
| **Photo-dominant**| Foto grande, nome sobreposto, preço em badge                  |
| **Side-by-side**  | Foto à esquerda, texto à direita (ou vice-versa)              |
| **Overlay**       | Foto full, informações em overlay com gradiente               |

### Propriedades Controladas pelo Sistema (não pelo usuário)

- **Raio de borda**: Definido pelo template
- **Sombra**: Definida pelo template
- **Densidade**: Compacta, normal ou espaçosa (conforme template)
- **Disposição**: Definida pelo template

> **Não liberar controle pixel a pixel** ao usuário — isso destruiria a consistência visual.

---

## 12. Verificação de Contraste (Acessibilidade)

### Regras WCAG AA

| Elemento              | Ratio mínimo | Notas                                    |
|-----------------------|--------------|------------------------------------------|
| Texto normal          | 4.5:1        | Sobre qualquer background                |
| Texto grande (≥ 24px) | 3:1          | Títulos e headings                       |
| Componentes UI        | 3:1          | Bordas, ícones, botões                   |

### Fluxo de Verificação

1. Usuário seleciona paleta ou cor customizada
2. Sistema calcula contraste com `calcContrastRatio(foreground, background)`
3. Se contraste insuficiente: exibir alerta visual ⚠️
4. Sugerir correção automática (clarear/escurecer)
5. Se usuário insistir: aplicar mas manter alerta no preview

---

## Documentos Relacionados

→ [06-EXPERIENCIA-PUBLICA.md](./06-EXPERIENCIA-PUBLICA.md) — Como os templates são renderizados para o cliente  
→ [04-CARDAPIO-CONTEUDO.md](./04-CARDAPIO-CONTEUDO.md) — O conteúdo que os templates exibem  
→ [08-BANCO-DADOS-RLS.md](./08-BANCO-DADOS-RLS.md) — Tabelas `design_settings` e `home_blocks`  
→ [03-PAINEL-USUARIO.md](./03-PAINEL-USUARIO.md) — Editor de design no painel
