# Playback Mux e hardening final

## Escopo entregue

Esta etapa fecha o fluxo de upload Mux com playback signed sob demanda, galeria
compartilhada entre preview e cardápio público, controles de abuso, limpeza,
CSP, verificação do bundle e testes E2E. Links externos YouTube/Vimeo continuam
explicitamente fora do escopo.

## Fluxo público

1. A API do cardápio retorna apenas metadados sanitizados de mídia pronta e publicada.
2. Abrir o cardápio ou o modal não carrega o SDK/player nem solicita stream.
3. O clique em Play chama o endpoint público de autorização.
4. O BFF valida slug, business ativo, item disponível e relação item/mídia/tenant.
5. O BFF assina um JWT Mux curto e responde com `Cache-Control: private, no-store`.
6. O Angular importa o Mux Player, monta-o com `preload="none"` e inicia a reprodução.
7. Trocar a mídia ou fechar o detalhe pausa e desmonta o player.

O preview reutiliza o mesmo renderer, mas solicita a autorização autenticada e
aceita mídia `ready` ainda não publicada pertencente ao tenant do owner.

## Variáveis de ambiente

Somente nomes; os valores devem ficar no gerenciador de secrets do ambiente:

- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`
- `MUX_WEBHOOK_SIGNING_SECRET`
- `MUX_SIGNING_KEY_ID`
- `MUX_SIGNING_PRIVATE_KEY`
- `MUX_TEST_MODE`
- `VIDEO_MAX_DURATION_SECONDS`
- `VIDEO_MAX_UPLOAD_BYTES`
- `VIDEO_UPLOAD_URL_TTL_SECONDS`
- `VIDEO_DAILY_UPLOAD_LIMIT`
- `VIDEO_MAX_PENDING_UPLOADS`
- `VIDEO_UPLOAD_RATE_LIMIT`
- `VIDEO_UPLOAD_RATE_WINDOW_SECONDS`
- `VIDEO_UPLOAD_ALLOWED_ORIGINS`
- `VIDEO_IP_HASH_SECRET`
- `VIDEO_RECONCILIATION_SECRET`
- `VIDEO_RECONCILIATION_BATCH_SIZE`
- `VIDEO_WEBHOOK_CLAIM_STALE_SECONDS`
- `VIDEO_PLAYBACK_TOKEN_TTL_SECONDS`
- `VIDEO_PLAYBACK_RATE_LIMIT`
- `VIDEO_PLAYBACK_RATE_WINDOW_SECONDS`
- `ACTIVATION_TOKEN_SECRET`

## Configuração do Mux

1. Criar um access token Mux com o menor conjunto de permissões que permita gerir
   Direct Uploads e assets; guardar ID/secret apenas no backend.
2. Criar uma signing key de Secure Video Playback. Guardar o key ID e a chave privada
   no backend, preservando as quebras de linha do PEM conforme o provedor de secrets.
3. Configurar o webhook para `POST /api/v1/webhooks/mux` no domínio público do BFF.
4. Assinar o endpoint no dashboard Mux e cadastrar o signing secret no backend.
5. Habilitar os eventos `video.upload.asset_created`, `video.asset.ready` e
   `video.asset.errored`.
6. Manter a policy dos playback IDs como `signed`; não alterar para `public`.
7. Definir `VIDEO_UPLOAD_ALLOWED_ORIGINS` com origens exatas HTTPS de painel/staging,
   sem wildcard e sem path.

## Reconciliação e limpeza

Agendar uma chamada server-to-server periódica para:

`POST /api/v1/internal/videos/reconcile`

Enviar `Authorization: Bearer <VIDEO_RECONCILIATION_SECRET>`. Nunca chamar esse
endpoint pelo navegador. A rotina processa lotes limitados, tenta novamente
`pending_deletion`, cancela uploads expirados, sincroniza processamento travado e
remove assets Mux órfãos encontrados na varredura do provedor.

Recomendação operacional inicial: executar a cada 10–15 minutos, monitorar `pending`
e alertar quando o backlog crescer continuamente.

## CSP e deploy

A mesma política está declarada em `src/index.html`, `public/_headers` e
`vercel.json`. `frame-src` permanece `none` porque embeds externos não fazem parte
desta fase. Antes do deploy, confirmar que o host da API de produção está coberto
por `connect-src`; o projeto legado ainda aponta serviços Angular para localhost e
precisa da estratégia de URL/rewrite do ambiente de publicação.

## Comandos de verificação

Backend:

```text
npm test -- --runInBand
npm run build
```

Frontend:

```text
npx tsc --noEmit -p tsconfig.app.json
npm test -- --watch=false
npm run build
npm run security:scan
npm run e2e
```

Banco, com Supabase local iniciado:

```text
npx supabase test db
```

## Limites e riscos aceitos

- A regra comercial de disponibilidade usa `businesses.status = 'ACTIVE'`. Ainda
  não há modelo de subscription/grace period para uma validação mais granular.
- Publicação usa `is_published`; snapshots imutáveis de cardápio não existem.
- O teste E2E usa autorização e stream interceptados. O smoke test com Mux real deve
  ser executado em staging com credenciais reais, sem expô-las em logs ou fixtures.
- `img-src https:` preserva compatibilidade com imagens legadas; demais diretivas
  relacionadas a scripts, frames e vídeo permanecem restritas.

## Evidência da validação de 2026-09-23

- Backend Jest: 8 suítes, 57 testes aprovados.
- Backend TypeScript: build aprovado.
- Frontend Angular/Vitest: 6 arquivos, 17 testes aprovados.
- Frontend TypeScript: typecheck aprovado.
- Build Angular de produção: aprovado; permaneceram avisos não bloqueantes de
  budget CSS no detalhe público e no editor de design.
- Scanner do bundle: 7 arquivos inspecionados, nenhum secret detectado.
- Playwright Chromium desktop e Pixel 7: 2 cenários aprovados.
- pgTAP: a reexecução local ficou indisponível porque o Postgres do Supabase não
  estava ouvindo em `127.0.0.1:54322`. As duas execuções aplicadas anteriormente
  foram homologadas pelo usuário com 25 e 22 asserções aprovadas.
