# 🏗️ 01 — Arquitetura Geral

> **Domínio**: Visão macro do sistema, estrutura do repositório, separação de camadas e princípios de design.  
> **Depende de**: Nenhum (base para todos os outros documentos).  
> **Referenciado por**: Todos os demais documentos.

---

## 1. Visão do Produto

O produto é um **SaaS de cardápio digital autônomo** para restaurantes, bares e estabelecimentos similares. Não é um PDF hospedado nem um catálogo genérico — é uma **vitrine visual, rápida, personalizável e orientada à descoberta**.

### Proposta de Valor
> Permitir que o estabelecimento apresente sua marca e seus itens de forma mais bonita, clara e persuasiva, favorecendo descoberta, confiança e aumento do ticket, **sem introduzir no MVP a complexidade de um sistema operacional de pedidos**.

### O que NÃO é o produto (agora)
- ❌ Sistema de cozinha, PDV, delivery ou pagamento
- ❌ Gestão de mesas ou login de consumidor
- ❌ Integração com caixa ou plataforma de pedidos
- ❌ Sistema operacional de pedidos enviados

---

## 2. Princípios Fundamentais

| Princípio                     | Significado Prático                                                                 |
|-------------------------------|--------------------------------------------------------------------------------------|
| Experiência antes do catálogo | Welcome → transição → Home-vitrine → categorias → detalhes bem encadeados           |
| Marca do estabelecimento      | Logo, capa, cores, fontes e template preservam identidade sem destruir hierarquia    |
| Mobile first                  | Jornada pública nasce para celular, funciona em tablet e desktop                     |
| Configuração guiada           | Templates, paletas e opções controladas; liberdade com limites de qualidade          |
| Segurança por arquitetura     | Navegador sem autoridade; Node valida regras; RLS isola dados; segredos no servidor  |
| Evolução sem retrabalho       | Business separado de user, draft/publicação, blocos modulares, tabelas preparadas    |

---

## 3. Arquitetura de Três Camadas

```
┌─────────────────────────────────────────────────────────────────────┐
│                          ANGULAR (Frontend)                         │
│  UI, estado local, formulários, preview, acessibilidade             │
│  ⚠️ SEM AUTORIDADE — não confiar em IDs, validação visual ou guards │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTP (cookies HttpOnly)
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         NODE.JS API (Backend)                       │
│  Autenticação, tenant, regras de negócio, validação, rate limit     │
│  Publicação, integrações, CSRF/Origin                               │
│  ✅ AUTORIDADE REAL — toda decisão de negócio passa aqui            │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ SDK / SQL
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     SUPABASE (Auth + PostgreSQL + Storage)           │
│  Auth: usuário, credenciais, sessão                                 │
│  PostgreSQL: dados, constraints, transações, RLS (defesa profunda)  │
│  Storage: logo e mídia, caminhos por tenant, políticas isoladas     │
│  🛡️ ÚLTIMA BARREIRA — RLS impede acesso cross-tenant no banco      │
└─────────────────────────────────────────────────────────────────────┘
```

### Regras de Confiança por Camada

| Camada          | Responsabilidade                                              | Nunca confiar em                                      |
|-----------------|---------------------------------------------------------------|-------------------------------------------------------|
| **Angular**     | UI, estado local, formulários, preview, acessibilidade        | IDs enviados pelo browser, validação visual, guards    |
| **Node.js API** | Autenticação, tenant, regras, validação, rate limit, publicação | business_id informado pelo navegador, MIME declarado  |
| **Supabase Auth** | Usuário, credenciais e sessão                               | Claims sem validação de assinatura/expiração          |
| **PostgreSQL**  | Dados, constraints, transações, índices, RLS, snapshots       | Aplicação como única barreira de autorização           |
| **Storage**     | Logo e mídia por tenant, políticas isoladas                   | Extensão, nome original ou Content-Type do cliente    |

---

## 4. Estrutura do Repositório

```
cardapio-digital-saas/
├── apps/
│   ├── web/                    # Angular (frontend)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── core/       # Guards, interceptors, services globais
│   │   │   │   ├── shared/     # Componentes reutilizáveis, pipes, directives
│   │   │   │   ├── features/   # Módulos por feature (auth, painel, design, etc.)
│   │   │   │   └── app.routes.ts
│   │   │   ├── assets/
│   │   │   ├── environments/
│   │   │   └── styles/         # Design tokens e estilos globais
│   │   └── angular.json
│   │
│   └── api/                    # Node.js (backend)
│       ├── src/
│       │   ├── middleware/     # Auth, CSRF, rate-limit, tenant, error handler
│       │   ├── routes/        # auth/, private/, public/, admin/
│       │   ├── services/      # Lógica de negócio
│       │   ├── validators/    # Schemas de entrada (Zod/Joi)
│       │   ├── database/      # Conexão, queries tipadas
│       │   └── config/        # Variáveis de ambiente, constantes
│       └── package.json
│
├── packages/
│   └── contracts/              # DTOs/schemas compartilhados (sem regras secretas)
│
├── supabase/
│   ├── migrations/             # Migrations versionadas e reproduzíveis
│   └── tests/                  # Testes RLS
│
├── docs/
│   ├── 00-INDICE-GERAL.md
│   ├── 01-ARQUITETURA-GERAL.md     # ← Este arquivo
│   ├── 02-AUTENTICACAO-CADASTRO.md
│   ├── ... (demais docs)
│   ├── PROJECT_STATE.md
│   ├── DECISIONS.md
│   └── SECURITY.md
│
├── .env.example                # Placeholders sem valores reais
├── .env.local                  # ⚠️ Não versionado — segredos locais
├── .gitignore
├── TASK.md                     # Objetivo da tarefa atual
└── package.json                # Monorepo root
```

---

## 5. Separação de Rotas (Frontend e API)

### Rotas do Angular (Frontend)

| Área           | Rota             | Acesso         | Responsabilidade                              |
|----------------|------------------|----------------|-----------------------------------------------|
| Autenticação   | `/login`         | Público         | Entrar; não revela se e-mail existe           |
| Ativação       | `/cadastro`      | Público + token | Criar conta consumindo token válido           |
| Painel         | `/painel`        | Autenticado     | Resumo e próximos passos                      |
| Menu           | `/painel/menu`   | Autenticado     | Categorias, itens, ordenação e edição         |
| Empresa        | `/painel/empresa`| Autenticado     | Nome, logo e descrição                        |
| Design         | `/painel/design` | Autenticado     | Template, paleta, fonte, animações e blocos   |
| Preview        | `/painel/preview`| Autenticado     | Render do rascunho; nunca confundir com publicado |
| Público        | `/m/:slug`       | Público         | Somente snapshot publicado e business apto    |
| Admin          | `/admin`         | Admin forte     | Contas, status, assinatura, token, suspensão  |

### Rotas da API (Backend)

```
/api/auth/...          # Autenticação (register, login, logout, session)
/api/private/...       # Requer sessão + tenant (CRUD do painel)
/api/public/menus/...  # Somente dados publicados (slug → snapshot)
/api/admin/...         # Autenticação forte + autorização server-side
```

> **Regra de privacidade**: O endpoint público **nunca** devolve ownerEmail, userId, token, assinatura detalhada, caminhos internos, dados administrativos ou rascunho.

---

## 6. Identificadores e Conceitos-Chave

| Conceito           | O que é                                        | Regra                                                         |
|--------------------|------------------------------------------------|---------------------------------------------------------------|
| **Usuário**        | Dono/assinante que administra o cardápio        | Um por business no MVP; não compartilhar senha                |
| **Cliente**        | Consumidor que lê o QR Code                     | Não cria conta; acessa somente experiência pública            |
| **Business**       | Identidade interna do estabelecimento           | UUID; nunca usar slug ou token como chave de autorização      |
| **Token de ativação** | Segredo temporário e de uso único            | Ativa onboarding; não renova mensalidade nem entra na URL     |
| **Slug**           | Endereço público legível                        | Ex.: `/m/pizzaria-bella`; único e não secreto                 |
| **Subscription**   | Direito de uso                                  | `active`, `expired`, `suspended`, `cancelled`; separado do token |
| **Tenant**         | Fronteira de dados de um business               | Toda leitura/escrita privada limitada ao tenant autenticado   |

> **⚠️ Decisão substituída**: A URL antiga com código tipo `/QR56TA/Painel` **não deve ser usada**. Token não identifica o negócio e nunca aparece em rota.

---

## 7. Decisões Consolidadas Relevantes

| ID  | Decisão                                                                          |
|-----|----------------------------------------------------------------------------------|
| D01 | Angular + Node.js + Supabase; Node é a camada de negócio                        |
| D02 | Um usuário por business no MVP; arquitetura mantém user e business separados     |
| D03 | Token, business ID, slug, subscription e sessão são conceitos diferentes         |
| D05 | URL pública oficial `/m/:slug`; painel em `/painel`                              |
| D06 | Tenant vem da sessão; RLS é defesa em profundidade                              |
| D13 | Draft → preview → publicar; snapshots permitem rollback futuro                  |

---

## 8. Performance e Qualidade

### Orçamentos da Rota Pública

| Indicador       | Meta                                                    |
|-----------------|----------------------------------------------------------|
| LCP mobile      | ≤ 2,5s em condição representativa                        |
| CLS             | ≤ 0,1 reservando espaço de imagens/cards                 |
| Interação       | CTA sem bloqueios longos; animação ≤ 700ms               |
| Payload inicial | Somente snapshot + assets da primeira dobra               |

### Angular
- Lazy routes para painel/admin
- Componentes pequenos e estado previsível
- Detecção de mudanças eficiente (OnPush preferido)

### API
- Paginação no painel
- Limites de query
- Índices em `business_id/position`
- Timeouts configuráveis

---

## 9. Ambientes

| Ambiente   | Dados                           | Segredos                        | Regra                                        |
|------------|----------------------------------|---------------------------------|----------------------------------------------|
| **Local**  | Seed fictício e conta de teste  | `.env.local` (não versionado)   | Nunca apontar para produção                  |
| **Staging**| Dados sintéticos                | Secret manager da plataforma    | Mesmo schema/policies de produção            |
| **Produção**| Dados reais mínimos            | Segredos próprios e rotacionáveis | Acesso restrito, backup e monitoramento    |

---

## Próximos Documentos

→ [02-AUTENTICACAO-CADASTRO.md](./02-AUTENTICACAO-CADASTRO.md) — Fluxo completo de autenticação  
→ [07-CYBERSECURITY.md](./07-CYBERSECURITY.md) — Modelo de ameaças e controles  
→ [08-BANCO-DADOS-RLS.md](./08-BANCO-DADOS-RLS.md) — Modelo de dados e multi-tenant
