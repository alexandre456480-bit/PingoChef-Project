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

A fundação de autenticação do proprietário, cadastro público confirmado e limites
está em [`docs/19-OWNER-PHASE1-FOUNDATION.md`](docs/19-OWNER-PHASE1-FOUNDATION.md).
Aplique as duas migrations `20261003000000` e `20261003010000` após as anteriores,
configure a chave de sessão e os templates Auth antes de implantar esta versão.
O preflight preserva contas e conteúdo existente; o caso atual de 13 produtos no
Free está documentado no relatório.

## Desenvolvimento local

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

## Verificações

Analytics do cardápio está implementado na [Fase 3](docs/21-OWNER-PHASE3-MENU-ANALYTICS.md):
coleta em todos os planos, consultas por entitlement, agregados SQL, filtros e CSV Pro.
QR PNG/SVG, integração com Analytics e revisão de segurança estão na
[Fase 4](docs/22-OWNER-PHASE4-QR-SECURITY-DELIVERY.md). Free/Basic mantêm a demo;
Medium/Pro geram QR real pelo backend. Aplique as migrations pendentes, configure
`PUBLIC_MENU_ORIGIN`, a fonte/backend nativo e os jobs descritos no relatório antes do deploy.

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
   `OWNER_AUTH_CALLBACK_URL` sob a origem pública da aplicação. Confira allowlists
   e templates de confirmação/recuperação conforme o relatório da fase 1.

As migrations em `supabase/migrations` devem ser aplicadas em ordem antes da
primeira implantação do backend.
