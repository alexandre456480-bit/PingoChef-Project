# 📌 State do Projeto — SaaS Cardápio Digital

> **Status Atual**: Fase 1 (MVP Core Autônomo - Autenticação & Gestão do Cardápio Concluídas)  
> **Última Atualização**: 2026-09-23  
> **Responsável**: Engenheiro Antigravity

---

## 1. Visão Geral do Estado

- [x] **Leitura & Análise da Especificação Mestra** (`Especificacao_Mestra_SaaS_Cardapio_Digital_Antigravity.pdf`).
- [x] **Elaboração da Suíte de Documentação Mestra (`/docs`)**:
  - `00-INDICE-GERAL.md` até `10-ROADMAP-FASES.md`.
- [x] **Inicialização da Stack de Desenvolvimento**:
  - `/frontend` — Projeto Angular 22 Standalone com Signals, RxJS e CSS moderno.
  - `/backend` — API Node.js/TypeScript Express com Zod, Helmet, CORS e cliente Supabase Admin.
  - `/supabase` — Migration SQL inicial com esquema relacional e políticas RLS multi-tenant.
- [x] **Módulo 1: Autenticação, Cadastro & Ativação**:
  - `POST /api/v1/auth/register`, `POST /api/v1/auth/activate`, `POST /api/v1/auth/login`.
  - Telas Angular: `RegisterComponent`, `ActivateComponent`, `LoginComponent` e `authGuard`.
- [x] **Módulo 2: CRUD do Cardápio (Categorias & Produtos)**:
  - Middleware JWT (`authenticateJwt`) com injeção automática de `businessId`.
  - Rotas de Categorias (`GET`, `POST`, `PUT`, `PATCH /reorder`, `DELETE /:id`).
  - Rotas de Produtos (`GET`, `POST`, `PUT`, `PATCH /:id/toggle-availability`, `DELETE /:id`).
  - `MenuService` no Angular com Signals para sincronização reativa.
  - Abas e Modais de Gestão no `DashboardComponent`.
- [ ] **Módulo 3: Experiência Pública do Cliente Final (`/c/:slug`) com Carrinho Local & Likes** (Próximo Passo).
- [x] **Vídeos — Fase 1 (banco homologado pelo usuário: 25/25 pgTAP)**:
  - `product_media` com fontes Storage, Mux e links externos allowlisted;
  - FK composta que impede associação de mídia e produto entre tenants;
  - constraints de estado, publicação e limite Mux de 15 segundos;
  - índices para galeria, status, métricas e reconciliação;
  - RLS de leitura do owner e bloqueio de escrita direta pelo cliente;
  - suíte pgTAP de integridade e isolamento em `supabase/tests`;
  - arquitetura registrada em `docs/11-PRODUCT-MEDIA-ARCHITECTURE.md`.
  - execução reportada com sucesso: `ok 25 - anonymous clients cannot delete media`.
- [x] **Vídeos — Fase 2 (backend Mux homologado: 22/22 pgTAP)**:
  - SDK oficial `@mux/ts`, Direct Upload com playback signed e CORS exato;
  - reserva transacional, quotas e rate limits por user/IP/business;
  - webhook RAW assinado, idempotência e estados do asset;
  - duração real de 15 s, rejeição e exclusão anti-órfão;
  - exclusão idempotente e rotina privada de reconciliação;
  - migration aplicada e 22 asserções pgTAP confirmadas pelo usuário.
- [x] **Vídeos — Fase 3 (upload no painel Angular)**:
  - seleção acessível e drag-and-drop no editor de produto;
  - preflight local de MP4/MOV/WebM, 50 MiB e duração exata de 15 s;
  - `PUT` direto para a URL Mux, sem encaminhar JWT do PingoChef;
  - progresso real, cancelamento, polling e estados de processamento;
  - feedback de ready/rejected/errored e exclusão idempotente;
  - mascote discreto, motion reduzido e nenhum player/stream no painel.
- [x] **Vídeos — Fase 4 (experiência pública e preview)**:
  - galeria compartilhada entre preview e cardápio público;
  - autorização de playback signed somente após clique explícito em Play;
  - Mux Player carregado dinamicamente, `preload="none"`, sem autoplay na listagem/modal;
  - projeção pública sanitizada, sem IDs administrativos, owner ou campos internos;
  - publicação explícita apenas de mídias `ready`.
- [x] **Vídeos — Fase 5 (hardening de aplicação)**:
  - testes de abuso, isolamento A/B, webhook falso, quotas, concorrência, duração e limpeza;
  - CSP restritiva para Mux no HTML, arquivo de headers e configuração Vercel;
  - scanner automatizado do bundle contra secrets de backend;
  - E2E desktop/mobile comprovando zero playback/stream antes do Play;
  - request IDs e logs de segurança sanitizados;
  - tokens locais limitados estritamente a `APP_MODE=demo` fora de produção;
  - guia operacional em `docs/14-VIDEO-PLAYBACK-HARDENING.md`.

---

## 2. Decisões Ativas

- **Stack Confirmada**: Angular (Frontend Admin & Public Web), Node.js (BFF API Rest), Supabase (Auth + PostgreSQL + Storage).
- **Multi-tenancy**: Modelo com coluna discriminator `business_id` protegido via Supabase RLS e middleware no Node.js.
- **Ativação Autônoma**: Ingressante recebe token alfanumérico único para liberação do acesso.
