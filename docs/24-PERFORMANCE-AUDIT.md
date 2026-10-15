# PingoChef — auditoria e otimização de performance

Data: 14/10/2026. Escopo: backend Express/Node, contratos consumidos pelo Angular, migrations locais, RLS, quotas, Mux, publicação e deploy configurado. As alterações visuais de Analytics já existentes foram preservadas.

## Estado da entrega e critérios

**Atualização posterior:** o [runbook de consolidação](25-HARDENING-CONSOLIDATION.md) substitui as instruções antigas de migrations/flags deste relatório histórico. Toda a cadeia está em `supabase/migrations`, incluindo as duas migrations de performance. A flag antiga foi aposentada; use as duas flags independentes descritas no runbook. Os números abaixo continuam documentando o experimento anterior.

**Atualização posterior:** o [runbook de consolidação](25-HARDENING-CONSOLIDATION.md) substitui as instruções antigas de migrations/flags deste relatório histórico. Toda a cadeia está em `supabase/migrations`, incluindo as duas migrations de performance. A flag antiga foi aposentada; use as duas flags independentes descritas no runbook. Os números abaixo continuam documentando o experimento anterior.

- **Implementado, sem migration:** uma autenticação por rota de produtos, leituras independentes em paralelo, projeções explícitas, tratamento de erros e telemetria sem dados sensíveis.
- **Implementado, com ativação controlada:** RPCs de reordenação e relatório. Compatibilidade antiga permanece enquanto `PERFORMANCE_BATCH_RPC_ENABLED` não for `true`.
- **Implementado em migration:** índice parcial de tendência por produto, com criação concorrente.
- **Medido:** HTTP local com providers simulados e EXPLAIN/BUFFERS em PostgreSQL 16 local com dados sintéticos. Nenhum resultado abaixo representa latência real de produção.
- **Não aplicado em produção:** migrations, flags, região, plano de infraestrutura e configuração de banco.

## Gargalos, causas e soluções

| Impacto | Fluxo | Causa confirmada | Implementação |
|---|---|---|---|
| ALTO | GET/POST/PUT/PATCH/DELETE `/items` | Dois routers montados no mesmo prefixo executavam autenticação completa e quotas de escrita duas vezes para CRUD comum | O router de mídia autentica cada uma das suas cinco rotas correspondentes; o router de produtos mantém seu middleware. Nenhum resultado de autorização é cacheado. |
| ALTO, após ativação | PATCH `/items/reorder`, `/categories/reorder`, `/subcategories/reorder` | Uma atualização HTTP por registro, sequencial, sem propagar erro | RPC transacional com RLS do JWT proprietário, tenant explícito, validação de IDs duplicados/campos, rollback do lote e advisory lock da reordenação. Sem upsert ou alteração de tenant. Caminho de compatibilidade agora propaga erros. |
| ALTO, em histórico volumoso | Analytics de tendência de produto | PK por tenant/data examina outros produtos antes de filtrar `dimension_key` | Índice `(business_id,dimension_key,day)` parcial para `dimension='product' AND event_name='PRODUCT_VIEW'`. Não foi criado índice UNIQUE nem removido índice existente. |
| MÉDIO | GET `/auth/me`, login e resolução de sessão | Leituras independentes serializadas | Auth e identidade Admin são lidos em paralelo; ambos precisam passar antes da verificação final de revogação. Após localizar o business, snapshot comercial, atividade, publicação, marcos e perfil são lidos em paralelo, com erros propagados. |
| ALTO por frequência potencial | GET `/public/menu/:slug` | Quatro leituras independentes de conteúdo eram sequenciais | Design, categorias, subcategorias e produtos em paralelo, após elegibilidade pública fresca. Mídias seguem em lote pelos IDs de produtos. Falhas de qualquer leitura retornam indisponibilidade, sem cardápio parcial. |
| MÉDIO, após ativação | GET `/analytics` | Até 8 RPCs na primeira página Pro, 9 com comparação | Uma RPC agrupa as consultas existentes e preserva suas validações SQL. Rankings/páginas, CSV e tendências continuam limitados. Isso reduz transações HTTP; **não elimina** as agregações nem a revalidação interna das funções existentes. |
| MÉDIO | GET `/qr` | A elegibilidade pública era buscada após a lista e configurações | Três leituras independentes em paralelo, depois da autorização. As duas barreiras de entitlements existentes foram mantidas. |
| BAIXO, ganho não quantificado | Listas de produtos/categorias/subcategorias, design e público | `SELECT *` lia campos que o DTO não usa | Projeções explícitas, mantendo os campos visíveis e o relacionamento pelo FK composto de tenant. Não se atribui redução medida de JSON HTTP a esta mudança: os DTOs já projetavam a resposta. |
| MÉDIO operacional | Todos os endpoints | Apenas tempo total agrupado; pouca separação de causa | Contexto isolado por requisição, tempos de auth/DB/provedores, contagens, status, endpoint fixo e request ID; resumo offline p50/p95/p99. |

## Medições HTTP antes/depois

Baseline de backend: `7cd6325f027f106cfe59ae01098971917ec45779` (antes das alterações desta auditoria). O benchmark executa handlers/routers reais via Supertest, sem Supabase remoto. Cada operação de banco/Auth recebe atraso configurado de 10 ms; timers e escalonamento do Windows acrescentam variação. São 30 amostras por endpoint, cache de relatório frio, sem refresh de token. p99 de 30 amostras é o máximo observado, não uma estimativa confiável de cauda em produção.

| Endpoint | DB antes | DB atual | DB com RPC | Auth antes/depois | p50 antes/atual/RPC (ms) | p95 antes/atual/RPC (ms) | p99 antes/atual/RPC (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/api/v1/auth/me` | 9 | 9 | 9 | 1/1 | 172.29 / 92.92 / 93.89 | 239.60 / 96.99 / 112.65 | 257.76 / 184.94 / 180.47 |
| `/api/v1/items` | 12 | 7 | 7 | 2/1 | 234.16 / 125.22 / 124.24 | 236.39 / 131.18 / 135.07 | 237.27 / 140.16 / 135.35 |
| `/api/v1/categories` | 6 | 6 | 6 | 1/1 | 124.24 / 109.14 / 108.28 | 127.42 / 169.86 / 120.83 | 128.78 / 189.51 / 182.85 |
| `/api/v1/design` | 6 | 6 | 6 | 1/1 | 124.72 / 109.42 / 109.28 | 126.58 / 117.66 / 123.57 | 126.99 / 118.61 / 123.75 |
| `/api/v1/public/menu/:slug` | 7 | 7 | 7 | 0/0 | 125.25 / 77.88 / 77.85 | 127.64 / 79.48 / 85.38 | 127.75 / 92.52 / 91.67 |
| `/api/v1/analytics` | 16 | 16 | 9 | 1/1 | 171.74 / 155.06 / 154.66 | 174.97 / 160.31 / 186.86 | 278.96 / 402.67 / 309.94 |
| `/api/v1/qr` | 11 | 11 | 11 | 1/1 | 186.52 / 155.99 / 155.88 | 262.39 / 167.45 / 213.86 | 277.81 / 220.60 / 237.46 |
| `/api/v1/items/reorder` | 34 | 27 | 8 | 2/1 | 580.49 / 437.26 / 141.96 | 618.04 / 484.42 / 183.45 | 693.18 / 507.28 / 221.44 |

O p95 de categorias no cenário compatível piorou nesta amostra; não se oculta esse resultado nem se promete melhora de cauda para todos os endpoints. Variação local e rede simulada limitam conclusões causais sobre latência real.

Contagem de round-trips vem das operações simuladas efetivamente aguardadas. Não inclui a gravação opcional de telemetria depois da resposta, o refresh de sessão nem as queries SQL internas de cada RPC. `/auth/me`/`dashboard` não são a mesma coisa: o dashboard inicial faz várias requisições independentes; não se reivindica aqui p95 de uma navegação Angular completa.

## Medição PostgreSQL e índice

Tabela real `analytics_dimensions_daily`, tenant descartável, 150 produtos × 730 dias = 109.500 linhas. Query de tendência usa o filtro do código real; 2 aquecimentos e 10 medições por cenário, buffers aquecidos. Tenant, linhas e índice de ensaio são revertidos por rollback antes dos testes de aplicação.

| PostgreSQL local | Antes | Depois |
|---|---:|---:|
| p50 (ms) | 105.247 | 2.616 |
| p95 (ms) | 124.211 | 3.576 |
| p99 (ms) | 124.211 | 3.576 |
| Shared hit blocks | 1602 | 19 |
| Shared read blocks | 0 | 0 |

O plano anterior usou varredura sequencial/agregação paralela; o novo usou `analytics_product_trend_idx`. Nenhuma medida foi colhida com dados de clientes. O custo de manter o índice em INSERT/UPDATE existe e deve ser acompanhado após deploy; não foram adicionados índices às coleções limitadas a 40 categorias/150 produtos sem evidência de benefício.

## Revisão dos outros fluxos

| Área auditada | Situação e decisão |
|---|---|
| Autenticação/sessões | Sessão opaca server-side; consulta de revogação por request, Auth getUser, exclusão de identidade Admin e touch condicional continuam. Refresh com lease e rechecagem permanece. Sem JWT/refresh token novo no browser, alteração de lifetime ou cache compartilhado de sessão. |
| Dashboard inicial | Angular já deduplica chamadas simultâneas de restore com shareReplay. Chamadas HTTP distintas precisam de autenticação própria. Um bootstrap BFF único é uma próxima opção, exigindo medição de navegação e revisão dos consumidores. |
| Produtos/mídias | Galeria já usa uma consulta `IN` para todos os produtos e Map em memória, sem N+1. Não se trocaram FKs compostos por joins sem tenant. |
| Categorias/design | Listas pequenas por limite comercial, RLS por owner JWT. Projeções enxutas foram suficientes; não se adicionou paginação que quebraria ordenação/preview. |
| Publicação | `publish_business_menu` é RPC com gates/locks existentes. O modelo observado usa sinalizador de publicação, não um snapshot imutável versionado do conteúdo. Não se mudou silenciosamente a semântica draft/live nem se cacheou conteúdo público com autorização antiga. |
| Entitlements/subscriptions | Já resolvidos por `business_entitlement_snapshot`, incluindo uso. Limites transacionais e locks de capacidade permanecem, inclusive em downgrade. Sem cache compartilhado de plano comercial, past_due, grace, suspensão ou lifecycle. |
| Analytics | Relatórios já leem daily/hourly/dimensions/presença, sem varrer raw events para histórico. Retenção e coleta deduplicada/quota persistente permanecem. Consulta horária de presença e exportações longas são candidatos a medição futura, não alterados sem perfil real. |
| Admin/audit/usuários | Listas têm limites/range, ordenação estável e filtros; mídia busca nomes de empresas em lote. OFFSET profundo e count exact podem encarecer em escala; migração para cursor exigirá contrato/UI próprios. Detalhe de empresa já paraleliza leituras, sem nova paralelização indiscriminada. |
| Mux | Provider/service singletons já existentes; SDK não é criado por request. Direct Upload mantém reserva SQL, cotas, vínculo e compensação; playback permanece assinado e sem cache; webhook verifica bytes brutos e assinatura antes de escrever. |
| Purge/jobs | Lotes limitados e checkpoints/leases existentes; chamadas externas de exclusão continuam sequenciais por segurança de idempotência. Não se paralelizou purge destrutivo por conveniência. |
| Clientes Supabase | Admin global reutilizado. Clientes com JWT e login por senha permanecem isolados para não trocar Authorization de outro tenant. O custo de recriá-los não justifica misturar identidades. |
| Pooling | Aplicação usa supabase-js/PostgREST por HTTP; não cria conexão PostgreSQL direta por requisição. `pg.Pool` aparece em tooling/testes locais. Não se adicionou outro pool ao runtime. |
| Cold start | QR importa o renderizador nativo; Mux provider e serviços já são lazy/singleton. Nenhuma redução de cold start foi medida; não se mudou carregamento ou validação de configuração alegando ganho hipotético. |
| Imagens/payload | Campos aceitam data URI/base64, inclusive logo/capa e imagens de produto. Isso pode dominar memória, banco e rede. A auditoria não baixou imagens nem migrou dados de clientes. Próxima etapa: upload validado para Storage/CDN, URLs persistidas e backfill auditável; QR tem exceção pequena de PNG normalizado. |

## Cache, segurança e observabilidade

Cache de Analytics já existente: settings por 10 s; resultados por tenant, filtros, entitlements e configurações, 10 s, até 256 entradas de 64 KiB. O relatório em lote usa os mesmos limites. Toda consulta HTTP continua autenticando e resolvendo entitlements antes de reutilizar resultados. Não há cache de suspensão, revogação, autorização Admin, grace ou sessão. Cache pode refletir eventos com atraso de até 10 s, como antes.

A revisão automática rejeitou a remoção do middleware duplicado de QR e uma proposta de contexto de autorização. A alternativa final mantém ambas as verificações de QR e não implementa cache de autorização. A duplicação de autenticação de produtos foi corrigida pelo roteamento correspondente, com teste 401 para cada endpoint de mídia.

Telemetria: `API_TELEMETRY_ENABLED=true` mantém a métrica SQL já existente e emite `request_performance` em JSON, salvo `API_PERFORMANCE_LOG_ENABLED=false`. Campos: endpoint fixo, método/status, request_id, duration_ms, auth_ms, database_ms/database_calls, external_ms/external_calls. Slugs, IDs de clientes, query strings, cookies, credenciais, bodies e resultados de provedores não entram no evento.

- Tempos DB/provedores medem fetch até cabeçalhos; tempo total inclui transferência/serialização. Durações de chamadas paralelas são somadas e podem exceder o total. Não significam tempo exclusivo de CPU do PostgreSQL.
- AsyncLocalStorage separa requisições concorrentes. O contexto termina na resposta; a escrita de telemetria fica fora da medição.
- A escrita SQL pós-resposta continua best effort em serverless; não a trate como entrega garantida. Logs devem ser exportados pela infraestrutura para observabilidade durável.
- `Get-Content logs.jsonl | node backend/scripts/summarize-performance.mjs` resume logs exportados, agrupados por método/endpoint/status, sem rede. Limites: 300 grupos e 100.000 amostras por grupo; descartes são informados.

## Migrations, ativação e rollback

1. Em ambiente de revisão/staging, aplicar `backend/migrations/20261014000000_performance_read_paths.sql` após a cadeia Supabase até `20261012020000`.
2. Aplicar `backend/migrations/20261014010000_analytics_product_trend_index.sql` **como operação independente, fora de transaction/BEGIN**, pois usa CREATE INDEX CONCURRENTLY.
3. Conferir `pg_index.indisvalid`. Falha de criação concorrente pode deixar índice inválido; não repetir IF NOT EXISTS presumindo que ele está pronto. Revisar com DBA.
4. Validar os testes e endpoints; só então definir `PERFORMANCE_BATCH_RPC_ENABLED=true` no backend e publicar a configuração. Nenhuma flag do ambiente real foi alterada por esta entrega.
5. Rollback funcional: definir a flag como false e retornar à versão anterior. Funções aditivas não removem tabelas/dados. O índice pode permanecer; remoção, se necessária, deve ser outra migration revisada.

As migrations antigas em `supabase/` foram removidas do GitHub por um commit anterior e foram conservadas apenas localmente, fora do versionamento. Por isso, as novas migrations estão em `backend/migrations/`, que é versionável. O runner local precisa da cadeia antiga completa; não se deve reconstruir um banco novo só com estas duas migrations nem republicar credenciais para contornar a ausência desse histórico.

## Validação e limites

- Backend build: passou.
- Angular typecheck e build de produção: passaram. Permanecem dois avisos preexistentes de tamanho de CSS em design-editor/public-menu-view.
- Backend: 20 suítes, 193 testes passaram; 2 casos opt-in ficaram skipped. A primeira rodada detectou uma asserção antiga sobre SELECT * e um teste dependente de rede; ambos foram corrigidos e a suíte completa voltou a passar.
- Checagem final adicional: 9 testes de performance/segurança e 1 benchmark passaram, incluindo confirmação do número de linhas reordenadas.
- Frontend unitário: 14 arquivos, 57 testes passaram.
- PostgreSQL 16: cadeia antiga + 2 migrations novas reaplicadas, 59 cenários existentes (32 owner, 14 analytics, 13 QR) e 2 grupos novos de validações adversariais passaram. Criação concorrente do índice e reaplicação também passaram.
- Benchmark HTTP: 30 amostras por endpoint em cada cenário; baseline, compatibilidade e batch medidos separadamente. Microbenchmark SQL: 10 amostras após 2 aquecimentos em cada plano.
- Varredura do build: 23 arquivos, 12 valores privados conhecidos, nenhum encontrado. Varredura de fontes: 272 arquivos, 15 valores privados conhecidos, nenhum encontrado; valores não foram revelados.
- Resumidor offline: rejeitou rótulo de endpoint com query string e ignorou evento alheio sem expor seus campos.

RLS/tenant isolation reais foram executados no PostgreSQL 16 local usando SET ROLE authenticated/anon/service_role, não apenas mocks de TypeScript. Preservados RLS/FORCE RLS, FKs, locks de capacidade, quotas persistentes, sessão, CSRF/Origin/cookies e regras dos quatro planos. Os testes tentam tenant forjado, plano insuficiente, QR de outro tenant, suspensão, lotes mistos, revogação e concorrência. Isso não equivale a uma garantia de segurança absoluta.

Não executados: pgTAP/Supabase CLI (CLI ausente e extensão pgTAP não preparada neste ambiente embarcado), integração que exige TEST_SUPABASE_* em projeto descartável remoto, p50/p95/p99 sob tráfego real, profiling real de pg_stat_statements e cold starts. O benchmark opt-in fica skipped na suíte comum. Os testes de concorrência/RLS disponíveis no runner local foram executados. Não houve deploy, aplicação de migrations ou mudança de configuração em produção. A rodada inicial revelou um teste legado dependente do .env; um timeout não demonstra ausência de chamadas ao provider. O teste foi isolado e a validação final usa falha simulada, sem rede.

## Infraestrutura e próximas medições

- **Verificado:** frontend reescreve `/api` para `pingochef-api.vercel.app`; backend é Express em Vercel. HEAD público do health retornou 200, Server Vercel e Cache-Control no-store, sem Content-Encoding. Uma resposta pequena de health não demonstra compressão ausente em payloads grandes.
- **Desconhecido:** região efetiva da Function e região do Supabase; não constam como autoridade no repositório. Não se alterou `regions` às cegas. Confirmar no painel e aproximar backend do banco. [Vercel: regiões de Functions](https://vercel.com/docs/functions/configuring-functions/region).
- **Recomendado:** medir compressão de JSON grande/estático no domínio publicado antes de inserir middleware adicional. Preservar no-store em rotas privadas e não comprimir respostas com dados secretos refletidos sem análise específica.
- **Recomendado:** coletar ao menos um ciclo representativo de logs por endpoint e comparar p50/p95/p99 e frequência × custo, não apenas um máximo isolado.
- **Preparado:** `backend/scripts/performance-diagnostics.sql` consulta pg_stat_statements por queryid/calls/tempo/buffers, sem exportar texto de queries ou parâmetros. Usar em console DBA, com extensão e permissões disponíveis; não habilitar extensões ou zerar estatísticas automaticamente. [PostgreSQL 16: pg_stat_statements](https://www.postgresql.org/docs/16/pgstatstatements.html).
- **Recomendado:** se futuramente houver conexão PG direta serverless, usar pooler transacional apropriado, tamanho limitado, TLS e compatibilidade de prepared statements. Hoje PostgREST já gerencia esse lado. [Supabase: conexões](https://supabase.com/docs/guides/database/connecting-to-postgres), [drivers serverless](https://supabase.com/docs/guides/database/connecting-to-postgres/serverless-drivers).
- **Próximos candidatos:** Storage/CDN para data URIs grandes; bootstrap BFF do dashboard; snapshots publicados versionados com elegibilidade fresca; cursor no Admin quando OFFSET/count exact aparecerem em perfil real; retirar verificações repetidas dentro do SQL de Analytics apenas com prova de equivalência e medição, sem flags de autorização fornecidas pelo cliente.

## Arquivos desta entrega

- Runtime: `backend/src/routes/product-video.routes.ts`; middlewares auth/admin/api-telemetry; config Supabase; controllers owner-auth/public/item/category/subcategory/design; services menu-analytics/menu-order/qr/mux-video/request-performance.
- Configuração: `backend/.env.example` (somente nomes/valores de exemplo, sem segredos).
- Banco: as duas migrations em `backend/migrations/`.
- Medição: `performance-read-paths.test.ts`, `benchmark-analytics-index.mjs`, `summarize-performance.mjs`, `performance-diagnostics.sql`.
- Testes: `performance-security.test.ts`, atualização do contrato owner-items-category, isolamento de security.test.ts; runner test-owner-database e verify-performance-database.
- Evidências sanitizadas: `docs/performance-evidence.json`; relatório atual. Artefatos brutos de execução ficam em `.tools/`, ignorados pelo Git.

## Reproduzir as medições locais (PowerShell)

Executar a partir da raiz do projeto, com dependências instaladas. Os valores de flags abaixo existem somente no processo do terminal; não editar .env de produção para executar benchmarks. A linha de base anterior não é recriada pelo código otimizado; suas evidências foram preservadas no JSON.

```powershell
Set-Location backend
$env:PERF_BENCHMARK_OUTPUT = '.tools/performance-compatible-local.json'
$env:PERFORMANCE_REORDER_RPC_ENABLED = 'false'
$env:PERFORMANCE_ANALYTICS_BATCH_RPC_ENABLED = 'false'
npm test -- --runInBand src/__tests__/performance-read-paths.test.ts
$env:PERF_BENCHMARK_OUTPUT = '.tools/performance-batch-local.json'
$env:PERFORMANCE_REORDER_RPC_ENABLED = 'true'
$env:PERFORMANCE_ANALYTICS_BATCH_RPC_ENABLED = 'true'
npm test -- --runInBand src/__tests__/performance-read-paths.test.ts
Remove-Item Env:PERF_BENCHMARK_OUTPUT, Env:PERFORMANCE_REORDER_RPC_ENABLED, Env:PERFORMANCE_ANALYTICS_BATCH_RPC_ENABLED
$env:PERF_DB_OUTPUT = '.tools/performance-postgres-local.json'
npm run test:database
Remove-Item Env:PERF_DB_OUTPUT
```

O runner de PostgreSQL cria instância em loopback, verifica o caminho de descarte e remove somente seu diretório temporário. Não utiliza DATABASE_URL/Supabase remoto. O benchmark HTTP importa os routers reais com Supabase/Auth substituídos; reordenação não altera produtos reais.

### Lista exata de fontes/artefatos da auditoria

- `backend/.env.example`
- `backend/migrations/20261014000000_performance_read_paths.sql`
- `backend/migrations/20261014010000_analytics_product_trend_index.sql`
- `backend/scripts/benchmark-analytics-index.mjs`
- `backend/scripts/performance-diagnostics.sql`
- `backend/scripts/summarize-performance.mjs`
- `backend/scripts/test-owner-database.mjs`
- `backend/scripts/verify-performance-database.mjs`
- `backend/src/__tests__/owner-items-category.test.ts`
- `backend/src/__tests__/performance-read-paths.test.ts`
- `backend/src/__tests__/performance-security.test.ts`
- `backend/src/__tests__/security.test.ts`
- `backend/src/config/supabase.ts`
- `backend/src/controllers/category.controller.ts`
- `backend/src/controllers/design.controller.ts`
- `backend/src/controllers/item.controller.ts`
- `backend/src/controllers/owner-auth.controller.ts`
- `backend/src/controllers/public.controller.ts`
- `backend/src/controllers/subcategory.controller.ts`
- `backend/src/middleware/admin.middleware.ts`
- `backend/src/middleware/api-telemetry.middleware.ts`
- `backend/src/middleware/auth.middleware.ts`
- `backend/src/routes/product-video.routes.ts`
- `backend/src/services/menu-analytics.service.ts`
- `backend/src/services/menu-order.service.ts`
- `backend/src/services/mux-video.service.ts`
- `backend/src/services/owner-session.service.ts`
- `backend/src/services/qr.service.ts`
- `backend/src/services/request-performance.service.ts`
- `docs/24-PERFORMANCE-AUDIT.md`
- `docs/performance-evidence.json`
