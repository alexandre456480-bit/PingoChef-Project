# 🖥️ 03 — Painel do Usuário

> **Domínio**: Dashboard, shell do painel, sidebar, módulos, estados e layout responsivo.  
> **Depende de**: [01-ARQUITETURA-GERAL.md](./01-ARQUITETURA-GERAL.md), [02-AUTENTICACAO-CADASTRO.md](./02-AUTENTICACAO-CADASTRO.md)  
> **Referenciado por**: [04-CARDAPIO-CONTEUDO.md](./04-CARDAPIO-CONTEUDO.md), [05-DESIGN-SYSTEM-TEMPLATES.md](./05-DESIGN-SYSTEM-TEMPLATES.md), [10-ROADMAP-FASES.md](./10-ROADMAP-FASES.md)

---

## 1. Visão Geral

O painel é a **experiência privada** do usuário/dono do estabelecimento. É onde ele configura o cardápio, personaliza o design, visualiza o preview e publica.

### Referência Visual Aprovada
- Painel **escuro, premium e organizado**
- Navegação lateral (sidebar)
- Área central de edição
- Preview de celular fixo no desktop
- A referência inspira hierarquia e composição, **não deve ser copiada literalmente**

---

## 2. Shell do Painel — Layout Responsivo

```
┌──────────────────────────────────────────────────────────────────┐
│  HEADER (logo do SaaS, nome do business, status, logout)        │
├──────────┬───────────────────────────────────┬───────────────────┤
│          │                                   │                   │
│ SIDEBAR  │         EDITOR / CONTEÚDO         │     PREVIEW       │
│          │                                   │   (celular fixo)  │
│ • Início │  Formulários, listas, CRUD        │                   │
│ • Menu   │  Cards de re![alt text](image.png)sumo, checklist       │   Atualização     │
│ • Empresa│  Drag & drop para ordenação       │   em tempo real   │
│ • Design │                                   │                   │
│ • Preview│                                   │                   │
│ • Likes  │                                   │                   │
│          │                                   │                   │
├──────────┴───────────────────────────────────┴───────────────────┤
│  PUBLICAR (CTA fixo com estado do rascunho)                      │
└──────────────────────────────────────────────────────────────────┘
```

### Comportamento por Breakpoint

| Região       | Desktop                                    | Tablet                            | Mobile                                       |
|--------------|--------------------------------------------|------------------------------------|----------------------------------------------|
| **Sidebar**  | Persistente, recolhível                    | Drawer acionado por botão          | Drawer com foco controlado (a11y)            |
| **Editor**   | Coluna principal com formulários/listas    | Uma coluna                         | Uma coluna, ações primárias sticky            |
| **Preview**  | Celular fixo ao lado, atualização real-time| Modal ou aba de preview            | Abrir em aba/modal; nunca esmagar editor     |
| **Publicar** | Ação global visível + estado do rascunho   | CTA fixo com confirmação           | CTA fixo com feedback                        |

### Sidebar — Itens de Navegação

| Item         | Rota               | Ícone sugerido | Descrição                            |
|--------------|---------------------|----------------|--------------------------------------|
| Início       | `/painel`           | 🏠             | Dashboard com resumo e checklist     |
| Menu         | `/painel/menu`      | 📋             | Categorias e produtos                |
| Empresa      | `/painel/empresa`   | 🏢             | Nome, logo, descrição                |
| Design       | `/painel/design`    | 🎨             | Templates, cores, fontes, animações  |
| Preview      | `/painel/preview`   | 👁️             | Visualização do rascunho             |
| Likes        | `/painel/likes`     | ❤️             | Ranking geral e por categoria        |

---

## 3. Dashboard (Tela Inicial do Painel)

### Composição Aprovada para a Fase 1

#### Saudação
- Nome do usuário/negócio
- Status da sessão
- Status do plano de teste

#### Checklist de Primeiros Passos
| # | Passo                        | Rota de atalho         | Status possível     |
|---|------------------------------|------------------------|---------------------|
| 1 | Cadastrar empresa            | `/painel/empresa`      | ✅ Feito / ⬜ Pendente |
| 2 | Enviar logo                  | `/painel/empresa`      | ✅ / ⬜              |
| 3 | Criar primeira categoria     | `/painel/menu`         | ✅ / ⬜              |
| 4 | Criar primeiro item          | `/painel/menu`         | ✅ / ⬜              |
| 5 | Personalizar design          | `/painel/design`       | ✅ / ⬜              |
| 6 | Publicar cardápio            | (ação de publicação)   | ✅ / ⬜              |

#### Cards de Informação
| Card                    | Conteúdo                                            |
|-------------------------|-----------------------------------------------------|
| Status do cardápio      | Rascunho / Publicado / Não configurado              |
| Último salvamento       | Data/hora do último save do rascunho                |
| Última publicação       | Data/hora da publicação (se existir)                |
| Total de categorias     | Contagem de categorias ativas                       |
| Total de itens          | Contagem de produtos ativos                         |
| Link público            | URL `/m/:slug` quando existir (clicável/copiável)   |

#### Atalhos Rápidos
- "Configurar empresa" → `/painel/empresa`
- "Criar categoria" → `/painel/menu` (com ação de criar)
- "Abrir design" → `/painel/design`
- "Ver preview" → `/painel/preview`

---

## 4. Módulos do Painel

### 4.1 Main Menu (`/painel/menu`)

> **Detalhamento completo**: [04-CARDAPIO-CONTEUDO.md](./04-CARDAPIO-CONTEUDO.md)

**Responsabilidade do MVP**:
- CRUD completo de categorias e produtos
- Arrastar/reordenar posição (drag & drop)
- Ativar/desativar categorias e itens
- Editar e excluir (soft delete)

**Estados**:
| Estado       | Comportamento                                         |
|--------------|-------------------------------------------------------|
| Loading      | Skeletons nos cards/listas                            |
| Vazio        | Empty state com CTA para criar primeiro item          |
| Erro         | Mensagem recuperável com retry                        |
| Salvando     | Feedback inline (spinner no botão/campo)              |
| Salvo        | Confirmação visual (toast/badge)                      |
| Conflito     | Informar e permitir reload                            |
| Limite       | Alertar proximidade do limite técnico                 |

---

### 4.2 My Business (`/painel/empresa`)

**Campos do MVP**:
| Campo       | Tipo          | Validação                                    |
|-------------|---------------|----------------------------------------------|
| Nome        | Texto         | Obrigatório; max 100 chars; sanitizado       |
| Descrição   | Textarea      | Opcional; max 500 chars; sem HTML arbitrário  |
| Logo        | Upload imagem | JPEG/PNG/WebP; max 8MB; validação server-side |

**Estados**:
- Nome não definido após cadastro → empty state com orientação
- Upload em progresso → progress bar
- Erro de validação → mensagem junto ao campo
- Autosave: **opcional apenas quando seguro** — feedback explícito de "Salvar" preferido

---

### 4.3 Design (`/painel/design`)

> **Detalhamento completo**: [05-DESIGN-SYSTEM-TEMPLATES.md](./05-DESIGN-SYSTEM-TEMPLATES.md)

**Responsabilidade do MVP**:
- Escolher template
- Selecionar paleta (pré-definida ou cor livre)
- Selecionar par de fontes
- Configurar animações
- Estilo de exibição de categorias
- Ativar/ordenar/configurar blocos da Home

**Estados**:
| Estado                | Comportamento                                       |
|-----------------------|-----------------------------------------------------|
| Alteração local       | Preview atualiza em tempo real, sem salvar ainda     |
| Rascunho salvo        | Feedback "Rascunho salvo" no editor                  |
| Restauração           | Opção de reverter para último estado salvo           |
| Preview               | Render fiel do rascunho                              |

---

### 4.4 Preview (`/painel/preview`)

**Responsabilidade**:
- Render fiel do **rascunho atual** em tamanhos mobile/tablet
- **Nunca** consultar snapshot público por engano
- Permitir visualização antes de publicar
- Exibir como o cliente final verá o cardápio

**Atenção**: O preview mostra o draft; o público mostra o snapshot publicado. São dados diferentes.

---

### 4.5 Publicação

**Fluxo**:
1. Validar rascunho (server-side):
   - Nome do business preenchido
   - Slug válido
   - Hero/logo conforme configuração
   - Ao menos 1 categoria ativa
   - Ao menos 1 item publicável
2. Gerar snapshot imutável (`menu_publications`)
3. Atualizar `business.current_publication_id`
4. Endpoint público `/m/:slug` passa a servir o novo snapshot

**Estados**:
| Estado         | Comportamento                                          |
|----------------|--------------------------------------------------------|
| Bloqueada      | Erros de validação listados por campo                  |
| Publicando     | Loading com feedback visual                            |
| Sucesso        | Confirmação + link para o cardápio público             |
| Versão         | Exibir número da versão publicada                      |
| Rollback       | Futuro — reativar versão anterior                      |

---

### 4.6 Likes / Analytics (`/painel/likes`)

> **⚠️ Por enquanto não será implementado** — mas a rota e o item no sidebar devem estar preparados.

**MVP**:
- Ranking geral e por categoria
- Com/sem dados (empty state)
- Toggle: contagem pública ligada/desligada

---

## 5. Estados Globais do Painel

### Estados que Afetam Todo o Painel

| Estado                   | Comportamento                                                    |
|--------------------------|------------------------------------------------------------------|
| **Loading inicial**      | Skeleton no shell inteiro; sidebar visível mas desabilitada      |
| **Business sem dados**   | Dashboard mostra checklist; módulos mostram empty states         |
| **Assinatura de teste**  | Banner informativo no topo; funcionalidades completas            |
| **Assinatura expirada**  | Painel limitado; tela de renovação; cardápio público controlado  |
| **Business suspenso**    | Acesso negado conforme política admin                            |
| **Sessão expirada**      | Redirecionamento para login com mensagem contextual              |
| **Erro de rede**         | Toast com retry; não perder dados não salvos                     |
| **Logout**               | Limpa estado, redireciona para `/login`                          |

---

## 6. Segurança do Painel

### Regras Fundamentais

1. **Não autenticado → redirecionamento para `/login`**
2. **Autenticado → vê somente SEU business** (tenant derivado da sessão)
3. **Nunca aceitar `business_id` da query/body como autoridade**
4. **Todas as ações passam pelo Node.js** — Angular é UX, não proteção
5. **Dados sensíveis** (senha, token, service_role) **nunca no painel**

### Derivação do Tenant

```
JWT/sessão → auth.uid() → businesses.owner_user_id → tenant atual
→ Recurso.business_id DEVE corresponder ao tenant atual
→ Falha → 404 (preferencial, não confirma existência)
```

---

## 7. Acessibilidade do Painel

| Requisito                        | Implementação                                     |
|----------------------------------|----------------------------------------------------|
| Navegação por teclado            | Tab order lógica; sidebar navegável                |
| Foco visível                     | Outline claro em todos os elementos interativos    |
| Leitores de tela                 | `aria-label`, `aria-describedby`, `role`           |
| Contraste                        | Nível AA mínimo para texto e controles             |
| Zoom 200%                        | Layout não quebra em zoom alto                     |
| Reduced motion                   | Respeitar `prefers-reduced-motion`                 |
| Sidebar mobile                   | Drawer com foco preso (focus trap) e Escape fecha  |

---

## 8. Responsividade

### Breakpoints Sugeridos

| Breakpoint | Comportamento                                    |
|------------|--------------------------------------------------|
| ≤ 640px    | Mobile: drawer, 1 coluna, sem preview inline     |
| 641-1024px | Tablet: drawer, 1 coluna, preview em modal       |
| ≥ 1025px   | Desktop: sidebar fixa, 2+ colunas, preview fixo  |

### Ações Sticky no Mobile
- Botão "Publicar" sempre visível
- Botão "Salvar" fixo quando editando
- FAB para criar novo item/categoria

---

## Documentos Relacionados

→ [04-CARDAPIO-CONTEUDO.md](./04-CARDAPIO-CONTEUDO.md) — CRUD de categorias e produtos  
→ [05-DESIGN-SYSTEM-TEMPLATES.md](./05-DESIGN-SYSTEM-TEMPLATES.md) — Personalização visual  
→ [06-EXPERIENCIA-PUBLICA.md](./06-EXPERIENCIA-PUBLICA.md) — O que o cliente final vê  
→ [02-AUTENTICACAO-CADASTRO.md](./02-AUTENTICACAO-CADASTRO.md) — Como o usuário chega ao painel
