# 📋 Índice Geral — SaaS Cardápio Digital

> **Fonte de verdade estrutural do projeto.**  
> Cada documento abaixo cobre um domínio específico. Quando um domínio depende de outro, a dependência está explicitamente referenciada dentro do arquivo.

> **Estado implementado em 30/09/2026:** consulte [15 — Fundação do Admin](./15-ADMIN-FOUNDATION.md) antes dos contratos conceituais abaixo. Alguns fluxos de autenticação, publicação e banco descritos aqui ainda são propostas.

> **Fundação do proprietário implementada em 02/10/2026:** os contratos atuais de sessão por cookie, confirmação, cadastro público, planos e limites estão em [19 — Fase 1 do proprietário](./19-OWNER-PHASE1-FOUNDATION.md).
>
> **Jornada comercial e painel do proprietário:** planos, cadastro por intenção, confirmação, configurações, uso e feature gates estão em [20 — Fase 2 do proprietário](./20-OWNER-PHASE2-COMMERCIAL-UI.md).
>
> **Analytics real do cardápio:** coleta em todos os planos, relatórios por entitlement, privacidade, agregação, retenção e testes em [21 — Fase 3 do proprietário](./21-OWNER-PHASE3-MENU-ANALYTICS.md).
>
> **QR e entrega consolidada:** PNG/SVG Medium/Pro, deduplicação, quotas compartilhadas, revisão adversarial e configurações de produção em [22 — Fase 4 do proprietário](./22-OWNER-PHASE4-QR-SECURITY-DELIVERY.md).

---

## Stack Tecnológica

| Camada      | Tecnologia                        | Papel                                             |
|-------------|-----------------------------------|----------------------------------------------------|
| Frontend    | **Angular** (última estável)      | UI, estado local, formulários, preview, acessibilidade |
| Backend API | **Node.js** (Express ou Fastify)  | Regras de negócio, autorização real, rate limit    |
| Auth        | **Supabase Auth**                 | Usuário, credenciais e sessão                      |
| Banco       | **PostgreSQL** (Supabase)         | Dados, constraints, RLS, transações, snapshots     |
| Storage     | **Supabase Storage**              | Logo, mídia, caminhos por tenant                   |

---

## Documentos de Especificação

| #  | Documento                                                                 | Domínio                          |
|----|---------------------------------------------------------------------------|----------------------------------|
| 01 | [Arquitetura Geral](./01-ARQUITETURA-GERAL.md)                           | Visão macro, estrutura do repo, camadas |
| 02 | [Autenticação e Cadastro](./02-AUTENTICACAO-CADASTRO.md)                  | Login, registro, token, sessão BFF |
| 03 | [Painel do Usuário](./03-PAINEL-USUARIO.md)                               | Dashboard, shell, sidebar, módulos |
| 04 | [Cardápio e Conteúdo](./04-CARDAPIO-CONTEUDO.md)                          | Categorias, produtos, promoções, ordenação |
| 05 | [Design System e Templates](./05-DESIGN-SYSTEM-TEMPLATES.md)              | Templates, paletas, fontes, animações, UX |
| 06 | [Experiência Pública](./06-EXPERIENCIA-PUBLICA.md)                        | Welcome, Home, jornada do cliente, carrinho |
| 07 | [Cybersecurity](./07-CYBERSECURITY.md)                                    | Threat model, controles, testes de ataque |
| 08 | [Banco de Dados e RLS](./08-BANCO-DADOS-RLS.md)                          | Modelo de dados, migrations, multi-tenant |
| 09 | [API e Contratos](./09-API-CONTRATOS.md)                                  | Endpoints, DTOs, validação, envelope de erro |
| 10 | [Roadmap e Fases](./10-ROADMAP-FASES.md)                                 | Plano de execução, Definition of Done |

---

## Documentos Operacionais (criados durante o desenvolvimento)

| Documento              | Propósito                                                    |
|------------------------|--------------------------------------------------------------|
| `PROJECT_STATE.md`     | O que existe, comandos, fase atual, bloqueios e próxima tarefa |
| `DECISIONS.md`         | ADRs compactas: decisão, motivo, consequências e data        |
| `SECURITY.md`          | Modelo de ameaça vivo, segredos, auth, tenant e uploads      |
| `TASK.md` (raiz)       | Objetivo da tarefa atual, escopo, aceite e arquivos candidatos |
| [`14-VIDEO-PLAYBACK-HARDENING.md`](./14-VIDEO-PLAYBACK-HARDENING.md) | Playback signed, Mux, CSP, limpeza e runbook de validação |
| [`15-ADMIN-FOUNDATION.md`](./15-ADMIN-FOUNDATION.md) | Base de segurança, convites e ciclo de vida |
| [`16-ADMIN-PHASE1-BACKEND.md`](./16-ADMIN-PHASE1-BACKEND.md) | API Admin, assinaturas preparadas, analytics, RLS e implantação |
| [`17-ADMIN-DASHBOARD.md`](./17-ADMIN-DASHBOARD.md) | Painel Admin, métricas, filtros, endpoints e implantação desta fase |
| [`18-ADMIN-PHASE3-OPERATIONS.md`](./18-ADMIN-PHASE3-OPERATIONS.md) | Comércio preparado, observabilidade, purga, recuperação e riscos residuais |
| [`19-OWNER-PHASE1-FOUNDATION.md`](./19-OWNER-PHASE1-FOUNDATION.md) | Sessão BFF do proprietário, cadastro confirmado, planos, quotas, migração e testes reais |
| [`20-OWNER-PHASE2-COMMERCIAL-UI.md`](./20-OWNER-PHASE2-COMMERCIAL-UI.md) | Jornada comercial, configurações, uso e demonstrações |
| [`21-OWNER-PHASE3-MENU-ANALYTICS.md`](./21-OWNER-PHASE3-MENU-ANALYTICS.md) | Eventos públicos, Analytics por plano, agregação, retenção, filtros, CSV e validação |

---

## Regras de Uso

1. **Cada documento é autocontido** no seu domínio, mas referencia explicitamente outros docs quando há dependência.
2. **O PDF** (`Especificacao_Mestra_SaaS_Cardapio_Digital_Antigravity.pdf`) permanece como fonte de verdade original.
3. **Decisões que alteram o PDF** devem ser registradas em `DECISIONS.md` com motivo e data.
4. **Ordem de autoridade**: Pedido atual > PDF > DECISIONS.md > Código existente.
5. **Não implementar** itens marcados como "futuro" ou "fora do escopo" sem solicitação explícita.
