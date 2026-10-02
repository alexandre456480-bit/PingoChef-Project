# Fundação do Admin PingoChef — implementação de 30/09/2026

> Esta é a base histórica. O estado atual após a fase seguinte, incluindo a segunda migration, assinaturas preparadas e rotas de leitura, está em [16-ADMIN-PHASE1-BACKEND.md](./16-ADMIN-PHASE1-BACKEND.md).

Este documento descreve a fundação implementada antes da segunda migration. O estado atual está no documento 16. Os documentos 01–10 incluem ideias de produto e contratos ainda não implementados. A interface do Admin e o checkout ficam para fases posteriores.

## Ordem obrigatória de implantação

1. Auditar o banco com `supabase/preflight/20260930_admin_foundation_audit.sql`. Na auditoria somente leitura realizada em 30/09/2026, o Supabase configurado tinha **1 business, 0 donos duplicados, 1 ACTIVE e 0 tokens legados**. Repetir antes de aplicar, pois os dados podem mudar.
2. Resolver manualmente qualquer `owner_user_id` duplicado. A migration interrompe a transação se ainda houver duplicatas; não escolhe um business para remover.
3. Aplicar `supabase/migrations/20260930000000_admin_foundation.sql` e depois `supabase/migrations/20260930010000_admin_phase1.sql` em ordem. Verificar a nova constraint UNIQUE, backfill de `business_account_state`, políticas RLS e funções.
4. Criar uma identidade própria no Supabase Auth e inserir seu `user_id` em `public.admin_identities` usando acesso administrativo ao banco. Nunca usar o login de um cliente como identidade administrativa compartilhada.
5. Configurar no backend `SUPABASE_ANON_KEY`, `INVITATION_HASH_SECRET` e `ADMIN_LOGIN_HASH_SECRET`; os dois segredos de hash devem ser valores aleatórios independentes de pelo menos 32 caracteres. Configurar `ADMIN_ORIGINS` com origens exatas, por exemplo `https://admin.pingochef.com`; staging e desenvolvimento usam variáveis próprias. Não usar `*`. Confirmar HTTPS e `TRUST_PROXY` correto no deploy.
6. Implantar a API e o frontend do cliente juntos. A API nova falha fechada sem a migration; o cadastro novo não aceita o endpoint legado de ativação.

Não há credencial SQL/Management API no ambiente local; a migration foi criada no repositório, mas **não foi aplicada ao Supabase remoto** por esta mudança.

## Autenticação real

- Cliente: Supabase Auth via `POST /api/v1/auth/login`, JWT no cabeçalho `Authorization` e `access_token` em `localStorage` no Angular. O guard do Angular é apenas UX; o Node revalida o JWT. Migrar o cliente para sessão mais protegida é dívida técnica separada desta fase.
- Admin: `POST /api/v1/admin/auth/login` autentica via cliente Supabase isolado, confirma identidade ativa em `admin_identities` e emite sessão opaca persistida apenas como SHA-256 em `admin_sessions`. O navegador recebe cookie host-only, HttpOnly, SameSite=Strict e Secure em produção. A sessão expira após 8 horas absolutas ou 30 minutos sem atividade. `POST /api/v1/admin/auth/logout` revoga a sessão. Login e logout são auditados. A desativação da identidade invalida todas as suas sessões no próximo pedido.
- Escritas administrativas exigem Origin da allowlist e `X-CSRF-Token`. O token CSRF vem do login ou de `GET /api/v1/admin/auth/session`; deve ficar apenas em memória no futuro frontend. `requireAdmin` consulta o banco a cada requisição. Login tem limites por IP e por hash de email em janela de 15 minutos.
- `require_mfa` está preparado na identidade e o login recusa sessão que não tenha AAL2 quando a flag está ativa. Fluxos de desafio/cadastro de fator e UI de MFA ainda precisam ser implementados antes de ativar essa flag para a identidade principal.

## Convites e migração do cadastro

`POST /api/v1/admin/invitations` gera 32 bytes aleatórios, retorna o código **uma única vez** e grava apenas HMAC-SHA-256, email, expiração e estado. `POST /api/v1/admin/invitations/:id/revoke` revoga. Ambas as operações gravam `admin_audit_log` na mesma transação SQL.

O cliente envia email, senha, código e dados do estabelecimento em `POST /api/v1/auth/register`. A função `reserve_customer_invitation` serializa a reserva; o Node cria o usuário Auth; `complete_customer_registration` cria perfil, business, account state e consome o convite em uma transação. Se finalizar falhar, o Node tenta excluir o usuário Auth recém-criado e liberar a reserva. Falhas de compensação geram evento sem segredo em log e exigem reconciliação manual. Reserva abandonada pode ser retomada após 10 minutos. Cadastro tem limite de 5 solicitações por IP a cada 15 minutos, além do limite geral de Auth.

`POST /api/v1/auth/activate` e a tela `/activate` foram removidos. `activation_tokens` permanece apenas para reconciliação histórica, sem acesso de usuários comuns. Clientes já `ACTIVE` são preservados pelo backfill. Contas legadas `PENDING_ACTIVATION` entram em estado administrativo `SUSPENDED` e precisam de revisão manual antes de qualquer ativação. Uma conta legada `SUSPENDED` pode ser reativada pelo fluxo administrativo, que também normaliza seu status antigo. Não há conversão automática de token antigo em convite.

## Estado da conta e acesso público

`business_account_state` é privado ao backend privilegiado. `ACTIVE → SUSPENDED → PENDING_DELETION` é o caminho administrativo. É possível reativar `SUSPENDED` ou recuperar `PENDING_DELETION`. `DELETED` está reservado à futura rotina de purga; nenhuma rota atual executa exclusão definitiva. Ao apagar o business depois da purga, o estado será removido por cascata e o histórico administrativo permanecerá no audit log. O prazo padrão ao agendar exclusão é 30 dias, ajustável entre 1 e 365 dias. O agendamento exige `confirmBusinessId` igual ao ID da rota. Mudanças permitidas passam por `PATCH /api/v1/admin/businesses/:id/lifecycle` e são auditadas na mesma transação.

O proprietário não pode inserir/apagar `businesses` nem alterar `owner_user_id` ou o `status` legado: trigger do banco bloqueia. A constraint `businesses_owner_user_id_unique` garante um business por dono. RLS de conteúdo exige conta ativa para escritas comuns. Acesso público no banco e na API usa `business_is_publicly_eligible`, que combina estado administrativo, elegibilidade comercial e publicação. Por enquanto a elegibilidade comercial retorna verdadeiro porque não há assinaturas; não inventa vencimentos. O `is_published` é inicializado como verdadeiro para preservar os cardápios atuais. Menu, curtidas e playback consultam a mesma regra. Tokens Mux já emitidos têm validade curta e podem continuar válidos até expirar; a suspensão impede emissão de novos tokens.

## Subscriptions e analytics

Não foram criadas tabelas de pagamentos ou checkout. Ao introduzir assinatura, a função `business_is_commercially_eligible` será substituída por regra baseada em dados de assinatura e grace period, com timestamps UTC e limites temporais claros. A suspensão administrativa continuará sendo condição obrigatória independente da assinatura. Métricas comerciais e de uso exigirão eventos e fontes verificáveis; os contadores atuais não equivalem a visitas ou receita.
