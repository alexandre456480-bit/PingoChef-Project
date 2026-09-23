# 📱 06 — Experiência Pública

> **Domínio**: Welcome, Home modular, jornada do cliente, categorias, detalhes, likes, carrinho local e interações públicas.  
> **Depende de**: [04-CARDAPIO-CONTEUDO.md](./04-CARDAPIO-CONTEUDO.md), [05-DESIGN-SYSTEM-TEMPLATES.md](./05-DESIGN-SYSTEM-TEMPLATES.md), [08-BANCO-DADOS-RLS.md](./08-BANCO-DADOS-RLS.md)  
> **Referenciado por**: [07-CYBERSECURITY.md](./07-CYBERSECURITY.md), [09-API-CONTRATOS.md](./09-API-CONTRATOS.md)

---

## 1. Visão Geral da Jornada

O cliente chega pelo **QR Code** e deve alcançar os produtos com **baixa fricção**. Toda a jornada acontece na mesma aplicação Angular, sem reload completo.

```
QR Code → Welcome → Transição → Home → Categorias → Produto → Like/Carrinho
```

```
┌──────────┐     ┌───────────┐     ┌──────────┐     ┌───────────┐
│ QR CODE  │────▶│  WELCOME  │────▶│   HOME   │────▶│ CATEGORIAS│
│          │     │  (splash) │     │ (vitrine)│     │  (itens)  │
└──────────┘     └───────────┘     └──────────┘     └─────┬─────┘
                                                          │
                                                          ▼
                                   ┌───────────┐     ┌───────────┐
                                   │  CARRINHO  │◀───│  PRODUTO  │
                                   │  (local)   │     │ (detalhe) │
                                   └───────────┘     └───────────┘
```

### Rota Pública e Mockup do Painel

- **URL Pública**: `/m/:slug` (ex.: `/m/sapatolandia-gourmet` com alias `/c/:slug`)
- **Acesso**: Totalmente público, sem necessidade de login ou credenciais
- **Fidelidade Visual 1:1**: O mockup de smartphone no Painel do Administrador (`PhonePreviewComponent`) executa **exatamente o mesmo componente** (`PublicMenuViewComponent`), renderizando a tela inicial, a animação de entrada e toda a navegação em tempo real conforme as alterações feitas pelo usuário.
- **CyberSecurity & Projeção Segura**: A API pública (`/api/v1/public/menu/:slug`) nunca retorna dados sensíveis (owner_user_id, emails, senhas, tokens de ativação, dados de faturamento).

---

## 2. Welcome Screen (Tela de Entrada)

### Composição

| Elemento              | Obrigatório | Detalhes                                            |
|-----------------------|-------------|-----------------------------------------------------|
| Background/imagem     | ✅           | Imagem gastronômica apetitosa escolhida pelo usuário com fallback para wallpaper temático |
| Overlay               | ✅           | Gradiente escuro radial e linear com contraste alto (AAA) e descanso visual |
| Logo Flutuante        | ✅           | Logo centralizada com anel luminoso dinâmico na cor de destaque e animação de flutuação suave |
| Nome do Estabelecimento| ✅         | Tipografia display do par de fontes ativo (ex.: `Outfit`) com sombra de leitura |
| Tagline de Acolhimento| ✅          | Frase calorosa personalizável de boas-vindas       |
| CTA "Ver o Cardápio"  | ✅           | Botão Claymorphic com gradiente de ação, shimmer sweep contínuo e micro-interação tátil |

### Critérios de UX & Performance

- **Simples, Imersiva e Impactante**: Apresentação de alto nível que gera desejo imediato no cliente.
- **Carregamento Otimizado**: Preload das imagens de capa e logo críticos para LCP ultra-rápido.
- **Micro-interações**: Hover com leve elevação e pulso de luz suave no botão CTA.

---

## 3. Transição Welcome → Vitrine (Animação Cinematográfica)

Ao clicar no botão **"Ver o Cardápio"**, o sistema executa uma transição cinematográfica fluida e de alto impacto visual:

| Propriedade         | Especificação                                |
|---------------------|----------------------------------------------|
| Nome do Efeito      | **Portal Reveal & Hero Cascade**             |
| Mecanismo           | Desfoque progressivo (`blur(14px)`), expansão suave (`scale(1.15)`) e desvanecimento da tela inicial |
| Entrada da Vitrine  | Emerge com elevação suave (`translateY(30px) -> translateY(0)`) e escala (`scale(0.96) -> scale(1)`) |
| Física de Movimento | `cubic-bezier(0.16, 1, 0.3, 1)` (resposta elástica suave nativa) |
| Duração             | ~650ms (equilíbrio perfeito entre espetáculo visual e agilidade) |
| Cascata de Elementos| Blocos da vitrine, promoções e categorias entram com atraso escalonado (*stagger delay*) |
| Acessibilidade      | Respeita `@media (prefers-reduced-motion: reduce)` com transição instantânea sem transformações físicas |

---

## 4. Home — Vitrine Modular

A Home é a **vitrine** do estabelecimento, não uma lista gigante de todos os itens.

### Blocos Obrigatórios

| Bloco   | Conteúdo                           | Regra                                  |
|---------|------------------------------------|----------------------------------------|
| **Hero**| Imagem de capa + logo              | Sempre presente; posição varia por template |
| **Logo**| Logo do estabelecimento            | Obrigatória; posição conforme template  |

### Blocos Opcionais (ativáveis e ordenáveis)

| Bloco                 | Conteúdo                                          | Config                                      |
|-----------------------|---------------------------------------------------|----------------------------------------------|
| **Promoções**         | Itens com `promo_price_cents` + período ativo      | Preço anterior/atual, contador opcional      |
| **Mais Curtidos**     | Itens com mais likes (ranking)                    | Quantidade visível; ⚠️ nunca "mais pedidos"  |
| **Especial da Casa**  | Um produto específico escolhido pelo usuário       | Seleção do produto via painel                |
| **Categorias**        | Atalhos de navegação para as categorias            | Estilo: ícone, nome, ou ícone+nome           |
| **Novidades/Destaques**| Itens marcados manualmente como destaque          | Seleção manual pelo usuário                  |

### Renderização

- Blocos sob demanda (lazy loading abaixo da dobra)
- Skeletons discretos durante carregamento
- Evitar carrosséis pesados — preferir listas compactas
- Cada bloco renderiza conforme o template ativo

---

## 5. Categorias — Navegação

### Layout (definido pelo template)

| Layout               | Comportamento                                      |
|-----------------------|----------------------------------------------------|
| Scroll horizontal     | Barra deslizável, mobile-friendly, swipe            |
| Grid                  | Cards de categoria em grid responsivo              |
| Lista vertical        | Categorias com separadores e contagem de itens     |
| Tabs                  | Abas fixas no topo, conteúdo com scroll             |

### Apresentação

- **Ícone**: Ícone da biblioteca do sistema, tamanho consistente
- **Nome**: Texto da categoria
- **Ícone + Nome**: Ambos lado a lado
- Conforme `display_mode` configurado pelo usuário

### Comportamento

- Somente categorias **ativas** com itens **ativos** aparecem
- Navegação suave (scroll-behavior: smooth)
- Indicador de categoria selecionada
- Deep link possível (scroll to section ou filtro)

---

## 6. Lista de Produtos

### Cards de Produto

| Informação          | Obrigatória | Detalhes                                    |
|---------------------|-------------|----------------------------------------------|
| Nome                | ✅          | Tipografia do par de fontes escolhido        |
| Foto                | ❌          | Se disponível; otimizada e responsiva        |
| Preço               | Condicional | Exibir se preenchido; "Consulte" se null     |
| Preço promo         | Condicional | Exibir ~~anterior~~ atual se promoção ativa  |
| Descrição curta     | ❌          | Truncada no card; completa no detalhe        |
| Ícone de like       | ✅          | Coração; estado visual do like               |

### Regras de Exibição

- Itens **inativos** ou **ausentes**: **não aparecem** na lista
- Imagens: `srcset/sizes`, lazy loading abaixo da dobra, dimensão reservada
- Thumbnails para cards; imagem full no detalhe
- Formato moderno: WebP/AVIF quando suportado

---

## 7. Detalhe do Produto

### Abertura

| Dispositivo | Componente                | Comportamento                              |
|-------------|---------------------------|--------------------------------------------|
| **Mobile**  | Bottom sheet              | Gesto para fechar (swipe down), botão X    |
| **Desktop** | Modal lateral             | Botão fechar, clique fora fecha             |

### Conteúdo do Detalhe

| Elemento        | Conteúdo                                          |
|-----------------|---------------------------------------------------|
| Foto            | Imagem grande, otimizada                          |
| Nome            | Título do produto                                  |
| Descrição       | Texto completo                                     |
| Preço           | Normal ou promocional                              |
| Atributos       | Serve X, volume, peso, tempo de preparo            |
| Like            | Botão de curtir (toggle)                           |
| Carrinho        | Botão "Adicionar ao carrinho" com seletor de qtd   |

### Acessibilidade do Modal

| Requisito                   | Implementação                              |
|-----------------------------|--------------------------------------------|
| Focus trap                  | Foco preso dentro do modal/sheet           |
| Escape fecha                | `keydown` listener para Escape             |
| Restaurar foco              | Retornar foco ao card que abriu o detalhe  |
| Body scroll lock            | Impedir scroll do fundo                    |
| `aria-modal="true"`         | Declarar ao leitor de tela                 |
| `role="dialog"`             | Semântica correta                          |
| Label acessível             | `aria-labelledby` com o nome do produto    |

---

## 8. Sistema de Likes

### Arquitetura

```
[Usuário clica ❤️]
      │
      ▼
[Estado local otimista] ────────▶ [Coração preenchido imediatamente]
      │
      ▼
[POST /api/public/menus/:slug/items/:id/like]
      │
      ├── Sucesso: reconcilia estado
      └── Falha: reverte visual + toast discreto
```

### Regras

| Aspecto              | Implementação                                          |
|----------------------|--------------------------------------------------------|
| **visitor_id**       | UUID aleatório gerado no navegador, persistido em localStorage |
| **like_key**         | `HMAC(server_secret, business_id + visitor_id)`        |
| **Constraint**       | `UNIQUE(menu_item_id, like_key)` — 1 like por visitante por item |
| **Like**             | `POST` = like idempotente                               |
| **Unlike**           | `DELETE` = unlike idempotente                            |
| **UX**               | Clique alterna like/unlike; coração preenchido/vazio    |
| **Reconciliação**    | Se servidor retorna diferente do otimista, ajustar sem travar |
| **Visibilidade**     | Configurável pelo business: mostrar contagem ou apenas ranking |

### Proteções

- Rate limit por IP/visitor
- Validação que o item pertence ao business do slug
- Detecção de anomalia (muitos likes em pouco tempo)
- `visitor_id` pode ser regenerado pelo usuário (DevTools), mas impacto é limitado

---

## 9. Carrinho Local

### Arquitetura

O carrinho **fica inteiramente no navegador**. Não envia pedido ao estabelecimento.

```typescript
interface CartItem {
  itemId: string;       // UUID do produto
  quantity: number;     // Quantidade selecionada
  addedAt: number;      // Timestamp para expiração
}

interface Cart {
  businessSlug: string; // Slug do cardápio
  items: CartItem[];
  createdAt: number;    // Timestamp de criação
  expiresAt: number;    // Timestamp de expiração
}
```

### Regras

| Aspecto            | Implementação                                                |
|--------------------|--------------------------------------------------------------|
| **Persistência**   | `localStorage` com expiração configurável (recomendação: 12h)|
| **Total**          | Somente derivado em memória; recalcular com cardápio carregado|
| **Exibição**       | "Total estimado" — nunca "Total final"                       |
| **Segurança**      | Alterações no DevTools não afetam banco, pagamento ou restaurante |
| **Se virar pedido**| Backend deverá recalcular tudo (futuro)                       |

### Texto Obrigatório

> ⚠️ **Obrigatório no MVP**: "Esta lista ajuda você a acompanhar os itens desejados e **não envia o pedido** ao estabelecimento."

### O que NÃO fazer

- ❌ CTA "Finalizar pedido" no MVP
- ❌ Enviar dados do carrinho ao servidor
- ❌ Mostrar "Pedido enviado" ou similar
- ❌ Solicitar dados pessoais do cliente

### UI do Carrinho

| Elemento             | Comportamento                                     |
|----------------------|---------------------------------------------------|
| Badge no ícone       | Número de itens no carrinho                       |
| Lista de itens       | Nome, quantidade, preço estimado                  |
| Alterar quantidade   | Botões +/- ou input                               |
| Remover item         | Botão de remover com confirmação                   |
| Total estimado       | Soma calculada localmente                         |
| Limpar carrinho      | Botão de limpar tudo                               |
| Texto informativo    | Aviso de que não envia pedido                      |

---

## 10. Performance da Rota Pública

### Orçamentos

| Indicador       | Meta                                                    |
|-----------------|----------------------------------------------------------|
| LCP mobile      | ≤ 2,5s em condição representativa                        |
| CLS             | ≤ 0,1 reservando espaço de imagens/cards                 |
| Interação       | CTA sem bloqueios longos; animação ≤ 700ms               |
| Payload inicial | Somente snapshot + assets da primeira dobra               |

### Estratégias

- **Welcome**: Preload do asset crítico (capa + logo)
- **Home**: Blocos abaixo da dobra com lazy loading
- **Imagens**: `srcset/sizes`, `loading="lazy"` (exceto hero), thumbnails
- **Snapshot**: Uma leitura, sem joins complexos na rota pública
- **Cache**: `ETag/Cache-Control` no snapshot; invalidação na publicação
- **Fontes**: Carregar somente pesos usados; `font-display: swap`

---

## 11. Responsividade da Experiência Pública

| Breakpoint   | Adaptação                                              |
|--------------|--------------------------------------------------------|
| **Mobile**   | 1 coluna de cards; categorias em scroll horizontal; bottom sheet para detalhe |
| **Tablet**   | 2 colunas de cards; categorias adaptadas; modal para detalhe |
| **Desktop**  | 3-4 colunas de cards; sidebar de categorias; modal lateral para detalhe |

### Acessibilidade

| Requisito                  | Implementação                                   |
|----------------------------|-------------------------------------------------|
| HTML semântico             | `<nav>`, `<main>`, `<article>`, `<section>`     |
| Foco visível               | Outline em cards, botões, links                 |
| Targets de toque           | Mínimo 44x44px em mobile                        |
| Contraste AA               | Verificado por template/paleta                  |
| `prefers-reduced-motion`   | Animações reduzidas/eliminadas                  |
| Leitores de tela           | `alt` em imagens, `aria-label` em ações          |
| Zoom 200%                  | Layout não quebra                               |

---

## 12. Fluxo de Dados Público

```
[Cliente] ──GET /m/:slug──▶ [Angular]
                                │
                                ▼
              [GET /api/public/menus/:slug] ──▶ [Node.js]
                                                    │
                                                    ▼
                              [PostgreSQL: menu_publications.snapshot_json]
                                                    │
                                                    ▼
              [Retorna snapshot cacheável] ◀─────────┘
                                │
                                ▼
              [Angular renderiza com template ativo]
```

### Dados do Snapshot Público

O snapshot contém **tudo** necessário para renderizar sem queries adicionais:

```json
{
  "version": 3,
  "publishedAt": "2026-09-07T10:00:00Z",
  "business": {
    "name": "Pizzaria Bella",
    "description": "...",
    "logoUrl": "..."
  },
  "design": {
    "template": "premium",
    "palette": { ... },
    "fontPair": "elegant",
    "motion": "fade",
    "categoryStyle": "icon_name"
  },
  "homeBlocks": [ ... ],
  "categories": [
    {
      "id": "...",
      "name": "Pizzas",
      "iconKey": "pizza",
      "items": [
        {
          "id": "...",
          "name": "Margherita",
          "description": "...",
          "priceCents": 3500,
          "promoPriceCents": null,
          "mediaUrl": "...",
          "attributes": [ ... ],
          "likeCount": 42
        }
      ]
    }
  ]
}
```

---

## Documentos Relacionados

→ [05-DESIGN-SYSTEM-TEMPLATES.md](./05-DESIGN-SYSTEM-TEMPLATES.md) — Templates que renderizam a experiência  
→ [04-CARDAPIO-CONTEUDO.md](./04-CARDAPIO-CONTEUDO.md) — Dados de categorias e produtos  
→ [07-CYBERSECURITY.md](./07-CYBERSECURITY.md) — Proteção de likes contra bots, XSS  
→ [09-API-CONTRATOS.md](./09-API-CONTRATOS.md) — Endpoint público `/api/public/menus/:slug`
