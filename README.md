# PingoChef

SaaS de cardápio digital com painel do estabelecimento, experiência pública,
Supabase e processamento seguro de vídeos pelo Mux.

## Estrutura

- `frontend/`: aplicação Angular.
- `backend/`: API Express/TypeScript.
- `supabase/`: migrations e testes de segurança/RLS.
- `docs/`: arquitetura, contratos e decisões técnicas.

A fundação de segurança e a API administrativa estão em
[`docs/15-ADMIN-FOUNDATION.md`](docs/15-ADMIN-FOUNDATION.md) e
[`docs/16-ADMIN-PHASE1-BACKEND.md`](docs/16-ADMIN-PHASE1-BACKEND.md). As duas
migrations correspondentes devem ser aplicadas **antes** de implantar esta API.

O painel Admin e a migration adicional de analytics estão documentados em
[`docs/17-ADMIN-DASHBOARD.md`](docs/17-ADMIN-DASHBOARD.md). Aplique
`20261001000000_admin_dashboard_analytics.sql` após as duas migrations Admin
anteriores, antes de implantar esta versão.

A preparação comercial, observabilidade e purga da fase 3 estão em
[`docs/18-ADMIN-PHASE3-OPERATIONS.md`](docs/18-ADMIN-PHASE3-OPERATIONS.md).
Aplique também, nesta ordem, `20261002000000_admin_phase3_commercial_ops.sql` e
`20261002010000_admin_phase3_purge.sql` antes de publicar o backend atualizado.
Gateway e backup ainda dependem de configuração operacional.

A fundação de autenticação do proprietário e limites
está em [`docs/19-OWNER-PHASE1-FOUNDATION.md`](docs/19-OWNER-PHASE1-FOUNDATION.md).
Aplique as duas migrations `20261003000000` e `20261003010000` após as anteriores,
configure a chave de sessão e o template de recuperação de senha antes de implantar esta versão.
Se o Supabase já recebeu uma versão anterior da função `create_owner_session`,
aplique também `20261004000000_owner_session_rpc_upgrade.sql`. O backend atual
envia `p_auth_issued_at`; a função antiga com sete parâmetros faz o login
retornar `503 SESSION_CREATION_FAILED` mesmo após a senha ser aceita.
O preflight preserva contas e conteúdo existente; o caso atual de 13 produtos no
Free está documentado no relatório.

## Atualização de QR e itens (11/10/2026)

Antes de publicar o backend atualizado, aplique no SQL Editor a migration
[`20261011000000_qr_capacity_and_deletion.sql`](supabase/migrations/20261011000000_qr_capacity_and_deletion.sql), após as migrations anteriores.
Ela limita a criação a três QR por estabelecimento (incluindo pausados), adiciona
exclusão com conferência de revisão e preserva o histórico do Analytics. QR excluído
deixa de resolver, não pode ser reativado e libera uma vaga. Códigos antigos acima
do limite não são apagados automaticamente; novas criações ficam bloqueadas.
O SQL usa transação e limites de espera para não manter bloqueios prolongados.
O painel usa agora a relação explícita `menu_items_category_tenant_fk` para evitar
a ambiguidade entre produtos e categorias, mantendo o escopo do proprietário.

## Desenvolvimento local

O cadastro atual não exige confirmação de e-mail. O backend cria a identidade,
ativa o estabelecimento Free e encaminha o usuário ao login por senha.
Antes de publicar esta versão, aplique em ordem
[`20261012000000_repair_free_registration.sql`](supabase/migrations/20261012000000_repair_free_registration.sql),
[`20261012010000_remove_owner_email_verification.sql`](supabase/migrations/20261012010000_remove_owner_email_verification.sql) e
[`20261012020000_repair_business_subscription_trigger.sql`](supabase/migrations/20261012020000_repair_business_subscription_trigger.sql).
A transição de contas pendentes e a configuração de recuperação estão em
[`docs/23-OWNER-REGISTRATION-WITHOUT-EMAIL-VERIFICATION.md`](docs/23-OWNER-REGISTRATION-WITHOUT-EMAIL-VERIFICATION.md),
que substitui os requisitos de confirmação do relatório da fase 1.

Para corrigir o cadastro Free em bancos com a etapa comercial parcialmente aplicada,
aplique [`20261012000000_repair_free_registration.sql`](supabase/migrations/20261012000000_repair_free_registration.sql)
no SQL Editor do Supabase **antes de atualizar o backend**. A migration restaura as
colunas de consentimento e cria a operação que registra cadastro, aceite e consumo
do plano em uma única transação. Pode ser reaplicada. Rascunhos antigos interrompidos
antes da criação da identidade são liberados quando correspondem a uma escolha
consumida; contas e cadastros aguardando confirmação são preservados.

Requisitos: Node compatível com as dependências instaladas e um projeto Supabase
configurado. Ambiente validado nesta fase: Node.js 24.19.0.

```powershell
cd backend
Copy-Item .env.example .env
npm ci
npm run dev
```

Em outro terminal:

```powershell
cd frontend
npm ci
npm start
```

O frontend utiliza `/api/v1` na própria origem; o proxy local aponta para
`http://localhost:3000`. Configure `OWNER_SESSION_ENCRYPTION_KEY` somente no backend.
Nunca versione `.env`, chaves privadas, tokens Mux ou a service role do Supabase.

Durante o desenvolvimento, mantenha a API com `npm run dev` para recarregar o código.
O `npm start` do backend recompila antes de iniciar, evitando executar um `dist` antigo.
Recompilar arquivos não atualiza um processo `node dist/server.js` que já esteja em execução.

## Verificações

Analytics do cardápio está implementado na [Fase 3](docs/21-OWNER-PHASE3-MENU-ANALYTICS.md):
coleta em todos os planos, consultas por entitlement, agregados SQL, filtros e CSV Pro.
QR PNG/SVG, integração com Analytics e revisão de segurança estão na
[Fase 4](docs/22-OWNER-PHASE4-QR-SECURITY-DELIVERY.md). Free/Basic mantêm a demo;
Medium/Pro geram QR real pelo backend. Aplique as migrations pendentes, configure
`PUBLIC_MENU_ORIGIN`, a fonte/backend nativo e os jobs descritos no relatório antes do deploy.
Para logos PNG maiores, aplique também `20261004010000_qr_logo_limits.sql` antes de usar o painel atualizado.

```powershell
cd backend
npm test -- --runInBand
npm run build
npm run test:database

cd ../frontend
npm test -- --watch=false
npm run build
npm run security:scan
npx playwright test --config playwright.phase4.config.ts
```

## Publicação na Vercel

Este repositório é um monorepo. Crie dois projetos Vercel apontando para o
mesmo repositório:

1. Backend com Root Directory `backend`.
2. Frontend com Root Directory `frontend`.

Cadastre os valores de `backend/.env.example` nas Environment Variables do
projeto backend. Valores sensíveis devem ser marcados como secretos e nunca
copiados para o frontend.

Depois que o backend possuir uma URL HTTPS estável:

1. Configure `FRONTEND_ORIGINS` e `VIDEO_UPLOAD_ALLOWED_ORIGINS` com a origem
   exata do frontend.
2. Crie no Mux um webhook para
   `https://<backend>/api/v1/webhooks/mux`.
3. Salve o signing secret como `MUX_WEBHOOK_SIGNING_SECRET` no backend.
4. Configure o proxy `/api` do frontend para o backend do ambiente e mantenha
   `OWNER_RECOVERY_CALLBACK_URL` sob a origem pública da aplicação, terminando em
   `/api/v1/auth/recover`. Confira allowlists e o template de recuperação conforme
   o relatório de cadastro atual.

As migrations em `supabase/migrations` devem ser aplicadas em ordem antes da
primeira implantação do backend.

O domínio público atual é `https://pingochef-web-drab.vercel.app`; a API é
`https://pingochef-api.vercel.app`. Mantenha `PUBLIC_MENU_ORIGIN`, as allowlists,
o callback de e-mail e os links do painel alinhados ao domínio público.
`backend/vercel.json` inclui a fonte usada para exportar QR PNG/SVG. O endpoint
autenticado `GET /api/v1/internal/operations/ready` verifica banco, Supabase Auth e renderização PNG.

Em produção, configure também `DEPLOYMENT_ENV=production`,
`EXPECTED_SUPABASE_PROJECT_REF`, `ADMIN_ORIGINS`, `INVITATION_HASH_SECRET`,
`ADMIN_LOGIN_HASH_SECRET`, `OWNER_SESSION_ENCRYPTION_KEY`, `INTERNAL_JOBS_SECRET`,
`PURGE_STORAGE_BUCKET` e `API_TELEMETRY_ENABLED=true`, além dos valores Supabase/Mux.
Preserve as chaves já utilizadas pelo banco; uma troca pode invalidar sessões e convites.
`ANALYTICS_HASH_SECRET` é opcional: na ausência dele, a API deriva uma chave da
chave de sessões. Segredos permanecem apenas no backend.

Agende os endpoints de manutenção autenticados descritos nas fases 3 e 4.
Deploys sem configuração de scheduler não executam esses jobs automaticamente.
O bucket `menu-images` está reservado para mídias em Storage; antes de usá-lo,
crie as políticas por estabelecimento. As imagens atuais não dependem desse bucket.
