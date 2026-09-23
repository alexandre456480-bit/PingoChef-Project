# PingoChef

SaaS de cardápio digital com painel administrativo, experiência pública,
Supabase e processamento seguro de vídeos pelo Mux.

## Estrutura

- `frontend/`: aplicação Angular.
- `backend/`: API Express/TypeScript.
- `supabase/`: migrations e testes de segurança/RLS.
- `docs/`: arquitetura, contratos e decisões técnicas.

## Desenvolvimento local

Requisitos: Node.js 20+ e um projeto Supabase configurado.

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

O frontend utiliza `http://localhost:3000/api/v1` durante o desenvolvimento.
Nunca versione `.env`, chaves privadas, tokens Mux ou a service role do Supabase.

## Verificações

```powershell
cd backend
npm test -- --runInBand
npm run build

cd ../frontend
npm test -- --watch=false
npm run build
npm run security:scan
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
4. Configure o frontend para utilizar a URL publicada da API antes de sua
   implantação. O endereço permanece local enquanto o backend público ainda
   não foi definido.

As migrations em `supabase/migrations` devem ser aplicadas em ordem antes da
primeira implantação do backend.
