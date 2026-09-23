# 🎨 Guia de Design System, UI & UX Profissional
> **Plataforma de Cardápio Digital SAAS**

Este documento serve como o **Guia de Design System e UI/UX** do projeto. O objetivo principal é orientar e padronizar visualmente todas as áreas onde o usuário final não tem poder de edição customizada (como as telas de Autenticação, Painel Administrativo/Dashboard, Modais de Gestão, Configurações do Sistema e Estados da Aplicação).

Lembrando que este arquivo serve apenas de dicas, pense sempre como um designer profissional, se tiver uma ideia melhor pode aplica-la.
---

## 🎯 1. Filosofia de Design & Diretrizes de UX

1. **Foco Total na Experiência do Usuário (UX)**:
   - Interfaces limpas, intuitivas e livres de poluição cognitiva.
   - Respostas visuais imediatas para todas as ações do usuário (hover, foco, carregamento, erros e confirmações).
   - Layouts com alta hierarquia visual, guiando o olhar do usuário naturalmente para as ações principais.

2. **Proibição Estrita de Emojis em UIs Administrativas**:
   - **Zero Emojis**: Emojis transmitem um aspecto informal e inconsistente entre diferentes sistemas operacionais.
   - **Uso Exclusivo de Ícones Profissionais**: Utilize bibliotecas de ícones vetoriais como **Lucide Icons** (`lucide-angular`) ou SVGs inline otimizados.

3. **Independência de Marca Genérica**:
   - Evite nomes de marca genéricos ou inconsistentes com a proposta do cliente.
   - O título institucional deve focar no produto: **Cardápio Digital SAAS**.

---

## 🎨 2. Identidade Visual & Paleta de Cores

A paleta de cores foi estruturada com base na identidade visual do projeto, combinando tons quentes sofisticados com um tema claro (*Light Theme*) de alto contraste e descanso visual.

| Papel no Design | Nome do Tom | Código HEX | Aplicação Recomendada |
| :--- | :--- | :--- | :--- |
| **Primária (Branding)** | Deep Burgundy | `#690A1A` / `#8B1A3A` | Painel hero de login, marca institucional, cabeçalhos de destaque. |
| **Ação / CTA** | Amber Orange | `#D26E2D` / `#F47B20` | Botões primários, links ativos, badges de destaque e estados em foco. |
| **Ação Hover** | Deep Amber | `#E06A10` | Estado de passe do mouse em botões e elementos interativos. |
| **Fundo Light (Base)** | Soft Cream | `#F8EDE5` / `#FBF7EF` | Fundo geral da aplicação, proporcionando conforto visual. |
| **Cards & Superfícies** | Pure White | `#FFFFFF` | Cartões de formulário, modais, listas de produtos e tabelas. |
| **Texto Principal** | Dark Aubergine | `#2D1B2E` | Títulos, rótulos e textos principais com contraste AAA. |
| **Texto Secundário** | Muted Slate | `#616161` / `#757575` | Textos de apoio, placeholders e descrições secundárias. |
| **Accent / Destaque** | Soft Peach & Rose | `#E7BB9B` / `#C86F70` | Bordas suaves, tags secundárias e sombras sutilmente coloridas. |

---

## 🖼️ 3. Uso da Logo do Projeto

- **Arquivo Oficial**: `frontend/public/logo_img.webp`.
- **Diretrizes de Aplicação**:
  - **Telas de Autenticação**: Exibir no topo do painel lateral *Hero*, com dimensão proporcional (ex: `120px` a `140px`) e animação suave de flutuação (*float*).
  - **Header do Painel**: Exibir em versão reduzida (`36px` a `44px`) acompanhada do nome do estabelecimento ou título do painel.
  - **Favicon**: Versão simplificada no cabeçalho da página.

---

## ✍️ 4. Tipografia & Escala Hierárquica

Para um visual moderno, elegante e altamente legível, utilize a combinação de duas fontes Google Fonts:

1. **`Outfit` (Display & Títulos)**:
   - Utilizada para títulos (`h1`, `h2`, `h3`), números de métricas, nome da marca e botões principais.
   - Transmite modernidade, personalidade e estrutura geométrica limpa.

2. **`Inter` (Corpo & Interface)**:
   - Utilizada para textos corridos, rótulos de campos (`labels`), descrições, tabelas e dados de entrada.
   - Fonte referência mundial em UI design para máxima legibilidade em telas.

---

## 💎 5. Táticas & Estilos de Design Avançados

### 🔹 Glassmorphism (Efeito Vidro Frosted)
Utilizado em modais, barras de navegação flutuantes e cards sobrepostos.
```css
.glass-card {
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 8px 32px rgba(45, 27, 46, 0.08);
}
```

### 🔹 Claymorphism (Sombras 3D Suaves & Orgânicas)
Ideal para cards interativos, badges de destaque e botões especiais de ação.
```css
.clay-button {
  background: linear-gradient(135deg, #F47B20 0%, #D26E2D 100%);
  border-radius: 16px;
  box-shadow: 
    8px 8px 16px rgba(210, 110, 45, 0.25),
    -4px -4px 12px rgba(255, 255, 255, 0.4),
    inset 2px 2px 4px rgba(255, 255, 255, 0.3);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 🔹 Bento Grid Layout
Estruturação assimétrica dos módulos do painel administrativo em blocos independentes com cantos bem arredondados (`border-radius: 16px` a `24px`) e espaçamentos generosos (`20px` a `32px`).

---

## 💫 6. Animações & Micro-interações

As animações devem ser **funcionais, rápidas (150ms a 350ms) e refinadas**:
1. **Entrada de Elementos (`Fade & Slide`)**: `translateY(16px)` -> `translateY(0)`.
2. **Hover nos Botões (`Shimmer & Elevation`)**: Leve elevação de `-2px` com iluminação sutil.
3. **Indicadores de Carregamento**: Spinners limpos e skeleton loaders suaves.

---

## 🎯 7. Ícones (Substituição de Emojis)
Substituição completa de emojis por componentes ou SVGs de ícones limpos (Lucide Icons).
