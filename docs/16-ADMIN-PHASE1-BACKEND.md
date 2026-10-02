# Admin PingoChef: banco e API desta entrega

Este documento descreve a implementação do backend administrativo após a fundação de segurança. A interface completa do Admin, checkout, cobrança e exclusão definitiva não fazem parte desta entrega.

## Implantação e estado atual

Execute a auditoria `supabase/preflight/20260930_admin_foundation_audit.sql`, resolva qualquer duplicidade de `owner_user_id` e aplique, nesta ordem:

1. `supabase/migrations/20260930000000_admin_foundation.sql`
2. `supabase/migrations/20260930010000_admin_phase1.sql`

Crie uma identidade exclusiva no Supabase Auth e registre seu `user_id` em `admin_identities`. A tabela aceita múltiplos administradores plenos. Configure os segredos do backend e `ADMIN_ORIGINS` por ambiente, incluindo `https://admin.pingochef.com` em produção. A API atual depende das duas migrations; implante as migrations antes do backend.

As migrations **não foram aplicadas ao Supabase remoto neste ambiente**: não há conexão SQL/Management API disponível. O teste SQL `supabase/tests/admin_phase1_security.test.sql` está pronto para um banco descartável, mas ainda não foi executado. O teste de concorrência real `backend/src/__tests__/invitation-concurrency.integration.test.ts` exige `RUN_DISPOSABLE_DB_TESTS=1`, `TEST_SUPABASE_URL`, `TEST_SUPABASE_SERVICE_ROLE_KEY` e `TEST_ADMIN_ACTOR_ID` de um banco isolado; sem essas variáveis, ele é ignorado. Não ative `billing_enforced` antes de cadastrar ou migrar as assinaturas de todos os estabelecimentos que devem permanecer acessíveis.

## Tabelas e isolamento

| Tabela | Função | Acesso pelo cliente |
|---|---|---|
| `admin_identities`, `admin_sessions`, `admin_login_attempts` | Identidades plenas, sessões revogáveis e tentativas de login | Nenhum |
| `admin_audit_log` | Auditoria imutável para o fluxo da aplicação | Nenhum |
| `customer_invitations` | Convites de uso único, com hash e tentativas limitadas | Nenhum |
| `business_account_state` | Suspensão, publicação e exclusão agendada | Nenhum |
| `plans`, `plan_entitlements` | Planos e valores de features sem matriz comercial final | Leitura de planos ativos |
| `commercial_settings` | Chave de ativação da cobrança e carência padrão de 3 dias | Nenhum |
| `subscriptions`, `subscription_adjustments` | Estado comercial e histórico de cortesia | Leitura apenas do próprio business |
| `subscription_events`, `platform_events` | Histórico comercial e eventos internos | Nenhum |

Todas as tabelas novas têm RLS. O backend usa `service_role` exclusivamente no servidor. A leitura do próprio cliente em `subscriptions` e `subscription_adjustments` é limitada a colunas seguras; IDs do provedor e ID interno do administrador não são concedidos. `subscription_events`, `subscription_adjustments`, `platform_events` e `admin_audit_log` não podem ser alterados ou apagados pelo fluxo normal de aplicação. Uma operação SQL privilegiada externa continua fora desse limite e deve ser auditada operacionalmente.

## Autenticação e autorização

`requireAdmin()` exige sessão opaca em cookie HttpOnly, SameSite Strict, host-only e Secure em produção. O token é guardado no banco somente como SHA-256. Toda rota administrativa exige `Origin` exata de `ADMIN_ORIGINS`, inclusive leituras; escritas exigem ainda `X-CSRF-Token`. O backend consulta sessão e identidade ativa a cada pedido. Há expiração absoluta de 8 horas, inatividade de 30 minutos, revogação no logout, limite de login por IP e por hash de email. A reserva de cada tentativa por hash de email usa bloqueio transacional no banco; pedidos simultâneos não ultrapassam o teto de cinco tentativas em 15 minutos. Tentativas bem-sucedidas são retiradas do contador. O endpoint `POST /auth/reauthenticate` verifica novamente a senha e registra auditoria; agendamento, recuperação e cortesia exigem autenticação recente de até 15 minutos. A flag `require_mfa` bloqueia sessões abaixo de AAL2; o fluxo visual de desafio/cadastro de fator ainda precisa ser implementado antes de ativá-la para a primeira identidade.

O frontend do cliente ainda guarda JWT em `localStorage`. Essa dívida de segurança está fora do escopo desta entrega; o Admin não reutiliza esse token nem `requireUser()`.

## Rotas

As rotas funcionam em `/api/admin` e `/api/v1/admin`. A segunda forma preserva o versionamento da API existente. Login exige `Origin`; todas as outras rotas exigem sessão Admin, e toda escrita exige CSRF.

| Método e caminho após o prefixo | Função |
|---|---|
| `POST /auth/login`, `GET /auth/session`, `POST /auth/logout`, `POST /auth/reauthenticate` | Sessão e reautenticação |
| `GET /overview` | Totais atuais e série de eventos agregada no PostgreSQL |
| `GET /businesses`, `GET /businesses/:id` | Lista paginada e detalhe administrativo |
| `POST /invites`, `GET /invites`, `POST /invites/:id/revoke` | Convites; código retornado somente na criação |
| `POST /businesses/:id/suspend`, `POST /businesses/:id/reactivate` | Suspensão e reativação |
| `POST /businesses/:id/schedule-deletion`, `POST /businesses/:id/cancel-deletion` | Agendamento e recuperação |
| `POST /businesses/:id/free-period` | Concessão auditada de 1 a 365 dias |
| `GET /audit-logs` | Auditoria paginada |

`POST /invites` recebe `email` e `expiresInDays` (1 a 30). `POST /suspend` exige `reason`. `POST /schedule-deletion` exige `confirmBusinessId` igual ao ID da rota e aceita `retentionDays` (1 a 365; padrão 30). `POST /free-period` recebe `days` e `reason`. Listas aceitam `page` e `limit` até 100. Não existem endpoints administrativos para modificar cardápio, produtos, preços, categorias ou design.

`GET /overview` aceita `from` e `to` ISO 8601 com offset, `timezone` IANA e `granularity` em `hour`, `day`, `week`, `month`, `year`. O intervalo é `[from,to)`, no máximo 31 dias para hora e 730 dias para demais granularidades. Sem filtro, usa 30 dias até agora, UTC e dia. A consulta restringe `occurred_at` antes de agrupar e utiliza índices. Os buckets são instantes UTC correspondentes ao início do período na zona pedida, inclusive em mudanças de horário de verão. `businesses` e `lifecycle` são fotografias atuais; `events` e `series` são contagens no intervalo. Não representam receita, visitas únicas ou pagamentos.

## Convites, ciclo de vida e auditoria

O código do convite tem 32 bytes aleatórios e somente seu HMAC-SHA-256 é persistido. A reserva e a finalização têm bloqueio de linha; cinco tentativas por código são permitidas, além do limite por IP no endpoint de cadastro. Convite expirado, revogado, consumido ou reservado por outra tentativa é recusado. Criar usuário Supabase Auth ocorre fora da transação PostgreSQL; em falha posterior, o backend tenta compensar excluindo o usuário novo e liberando a reserva. Falha nessa compensação exige reconciliação operacional.

Suspensão administrativa bloqueia acesso público e escrita comum mesmo durante cortesia ou assinatura ativa. Agendamento não apaga mídia, vídeos ou dados. Cancelar o agendamento restaura `ACTIVE` ou `SUSPENDED` conforme o estado anterior. As transições, convites, login, reautenticação e cortesia escrevem `admin_audit_log` na mesma transação SQL da ação. O audit log inclui IP, User-Agent e request ID enviados pelo backend ao PostgREST; registros antigos podem ter esses campos vazios. O endpoint só permite leitura.

## Assinaturas, features e eventos

`commercial_settings.billing_enforced` começa em `false`, preservando o acesso das contas atuais. Quando ativado, a regra comercial central aceita período ativo, carência configurável (padrão 3 dias) ou ajuste `FREE_DAYS` vigente. A decisão pública continua `estado administrativo ativo AND elegibilidade comercial AND publicação`. `business_feature_entitlement(business_id, feature_key)` consulta valores de `plan_entitlements`, sem `if plan === PRO` espalhado na aplicação. Ainda não há planos comerciais, checkout ou integração com provedor.

`platform_events` mantém metadata vazia para não capturar PII. Triggers registram `ACCOUNT_CREATED`, primeiro cadastro de categoria/produto, primeira configuração de design, configuração básica de business, primeira transição de publicação e vídeos que chegam a `ready`. Login bem-sucedido é registrado pelo backend. Eventos anteriores à migration não são inferidos nem retropreenchidos. `MENU_PUBLISHED` depende de futura transição explícita de `is_published: false → true`; o estado inicial preserva os cardápios legados como publicados.

## Riscos residuais

- A aplicação remota e os testes SQL/RLS ainda dependem de acesso SQL. Até aplicar ambas as migrations, o novo backend administrativo não está operacional no Supabase remoto.
- O limite por IP usa memória do processo Express; em produção com várias instâncias é necessário limite distribuído no gateway. Hash de email no banco e contador por convite complementam essa proteção.
- O frontend do Admin e o desafio visual de MFA ainda não existem. A flag MFA já falha de forma fechada.
- Tokens de playback emitidos antes da suspensão permanecem válidos até expirar. Não há rotina de purga definitiva nesta fase.
