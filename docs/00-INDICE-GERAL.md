# 📋 Índice Geral — SaaS Cardápio Digital

> **Fonte de verdade estrutural do projeto.**  
> Cada documento abaixo cobre um domínio específico. Quando um domínio depende de outro, a dependência está explicitamente referenciada dentro do arquivo.

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

---

## Regras de Uso

1. **Cada documento é autocontido** no seu domínio, mas referencia explicitamente outros docs quando há dependência.
2. **O PDF** (`Especificacao_Mestra_SaaS_Cardapio_Digital_Antigravity.pdf`) permanece como fonte de verdade original.
3. **Decisões que alteram o PDF** devem ser registradas em `DECISIONS.md` com motivo e data.
4. **Ordem de autoridade**: Pedido atual > PDF > DECISIONS.md > Código existente.
5. **Não implementar** itens marcados como "futuro" ou "fora do escopo" sem solicitação explícita.
