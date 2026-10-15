# Consolidação de performance e hardening

Entrega local em 14/10/2026. Continuação da [auditoria anterior](24-PERFORMANCE-AUDIT.md); os benchmarks anteriores continuam sendo simulações, não medições de staging. Nenhuma migration, flag, upload, extensão, região, billing ou configuração foi alterada em produção.

## Estado de cada frente

| Frente | Estado | Resultado / limite |
|---|---|---|
| Histórico SQL | IMPLEMENTADO / VALIDADO | 29 migrations históricas restauradas, 2 de performance consolidadas e 1 migration aditiva do piloto privado. Local oficial: `supabase/migrations`. Nenhuma histórica apagada ou substituída. |
| Ordem / integridade | IMPLEMENTADO / VALIDADO | Manifesto com 32 nomes cronológicos e SHA-256 normalizado para LF; rejeita arquivo ausente, ordem, duplicação de versão/conteúdo e alteração de checksum. |
| Reconstrução | VALIDADO | PostgreSQL 16 vazio, roles Auth/Storage locais, cadeia completa, RLS/FORCE RLS, owner, planos, concorrência, QR, Analytics e performance. O catálogo mínimo de Storage não emula a API HTTP real do Supabase. |
| Flags | IMPLEMENTADO / VALIDADO | `PERFORMANCE_REORDER_RPC_ENABLED=false` e `PERFORMANCE_ANALYTICS_BATCH_RPC_ENABLED=false`, independentes; variável antiga ignorada. |
| Reorder | IMPLEMENTADO / VALIDADO | RPC disponível após migration, owner JWT/RLS, tenant, IDs, duplicatas, advisory lock, transação e rollback preservados; habilitada não faz fallback silencioso. Caminho sequencial continua disponível com flag desligada. |
| Analytics batch | IMPLEMENTADO / VALIDADO | Implementação e cache limitado preservados; autorização atual antes do cache; desativado até evidência real de p95/p99. |
| Índice concorrente | IMPLEMENTADO / VALIDADO | Criação fora de transação, `indisvalid`/`indisready`, falha real por cancelamento e recuperação testadas. Definição inesperada exige revisão. |
| Staging | PREPARADO | Guardas de banco separado preservados, gerador de proxy separado, checklist abaixo. Deploy remoto não executado. |
| Regiões / runtime efetivo | AÇÃO MANUAL | Repositório identifica Express/TypeScript em Vercel, mas não fixa região nem versão Node efetiva; projeto Supabase não revela região no código. Não foram presumidas regiões. |
| Telemetria real | PREPARADO | Resumidor offline de todas as seis métricas, p50/p95/p99 por método/endpoint/status; logs existentes continuam sanitizados. |
| Medidas reais de staging/prod | NÃO EXECUTADO | Não foi fornecido ambiente staging identificado nem exportação de logs reais. Nenhum ganho real adicional é afirmado. |
| Dashboard | VALIDADO | 4 requests iniciais sem duplicação; Auth precede 3 leituras paralelas. Cenário de navegador local com API simulada, desktop/mobile. |
| Novo bootstrap | RECOMENDADO: não criar agora | `/auth/me` já fornece user/business/subscription/plan/entitlements/usage/publicação/onboarding. Não foi criado endpoint novo nem cache de autorização. |
| Storage | IMPLEMENTADO / PREPARADO | Bucket privado, catálogo com FORCE RLS, política restritiva e normalização PNG. Piloto operacional exclusivo de staging, sem rota HTTP e sem conexão com o menu público. |
| Backfill Base64 | PREPARADO | Inventário por owner, upload opcional, hash determinístico, sem overwrite, download e hash antes de marcar verificado. Originais e URLs permanecem. Cutover de referências não executado. |
| Snapshots | PREPARADO | Proposta abaixo; nenhuma mudança no comportamento de publicação atual. |
| Cache | VALIDADO por revisão | Sem novos caches de sessão, revogação, suspensão, lifecycle ou Admin; cache curto/limitado de Analytics preservado. |
| pg_stat_statements | PREPARADO | Diagnóstico somente leitura preservado. Não habilitado, resetado nem consultado em produção. |
| CI | PREPARADO | Workflow com install/build/typecheck/unit/scan/migrations/PG descartável/security; passos equivalentes executados localmente. GitHub Actions remoto não executado. |
| Git / publicação | IMPLEMENTADO / NÃO EXECUTADO | Consolidação e histórico SQL versionados em commit local. Push e deploy não executados nesta fase. |

## Fonte oficial e reconstrução

`supabase/migrations/` é a única cadeia executável. `backend/migrations/` deixou de conter SQL. `supabase/preflight/` contém inspeções, não migrations. `supabase/tests/` conserva testes SQL históricos. Os runners equivalentes de segurança estão em `backend/scripts/verify-*.mjs`.

A ordem preserva criação do schema/RLS, design, subcategorias, vídeos, likes, Admin/comercial/purge, planos/limites, sessões/cadastro, Analytics/QR e reparos de cadastro/subscription. As migrations de performance vêm depois dos reparos. Seeds necessários são definições comerciais e configurações singleton; não foram acrescentados clientes reais. Foram revisados inserts, funções substituídas, grants, triggers e policies; a reconstrução verifica suas dependências efetivas. Varredura de padrões de secrets passou, sem exibir valores. `.env`, credenciais, banco local e backups permanecem ignorados.

Em clone novo, com Node 24.15+ e npm:

```sh
cd backend
npm ci
node scripts/check-migrations.mjs
npm run build
npm test -- --runInBand
npm run test:database
cd ../frontend
npm ci
npx tsc --noEmit -p tsconfig.app.json
npm run build
npm test -- --watch=false
```

O runner inicia PostgreSQL 16 vazio em loopback com senha aleatória, cria contratos mínimos de Auth/Storage, aplica cada arquivo ordenado e descarta o diretório temporário ao terminar. Ignora `.env`, `DATABASE_URL` e bancos remotos. As roles de teste não substituem um teste de integração com Supabase Auth/Storage reais.

VALIDADO também com `MIGRATIONS_FROM_GIT_INDEX=true`: manifesto, lista e SQL foram lidos por `git ls-files`/`git show :...`, inclusive os reparos reaplicados, e todos os testes do banco passaram. A CI usa os arquivos do checkout do commit. Não edite migrations já aplicadas; adicione uma nova e atualize o manifesto com SHA-256 do conteúdo normalizado para LF.

### Índice concorrente e recuperação

Nunca encapsular `20261014010000_analytics_product_trend_index.sql` em `BEGIN`, `psql -1` ou ferramenta que envolva a migration em transação. Não enviar toda a cadeia concatenada em uma única chamada/transação. Aplicar cada migration separadamente com interrupção em erro. No psql: `psql -X -v ON_ERROR_STOP=1 -f <arquivo>`, com credencial por configuração segura, nunca na linha de comando.

Confira nome, tabela, definição, `indisvalid` **e** `indisready`. `IF NOT EXISTS` não repara índice inválido. `backend/scripts/recover-performance-index.mjs` verifica definição exata, obtém lock de manutenção, recusa índice divergente e, somente com `--repair-invalid`, remove o inválido com `DROP INDEX CONCURRENTLY`, recria e verifica. Índices válidos não são removidos. Cada comando usa conexão dedicada sem transação externa. Se cair entre drop/create, executar novamente continua a recuperação.

CLI limitado a staging: exige `DEPLOYMENT_ENV=staging`, `STAGING_DATABASE_URL`, `EXPECTED_SUPABASE_PROJECT_REF` e `PRODUCTION_SUPABASE_PROJECT_REF` diferentes, e confere host/usuário do projeto esperado. Use conexão direta ou pooler em **session mode**, nunca transaction pooler para esse lock. TLS verificado; não desabilitar validação do certificado para contornar erro. Não há execução automática em produção. Em produção um DBA deve revisar a mesma definição/estado, janela operacional, locks e carga antes de executar os comandos individualmente. Histórico Supabase existente deve ser conciliado antes de aplicar arquivos; não reaplicar cegamente a cadeia histórica em banco existente.

O teste local interrompe `CREATE INDEX CONCURRENTLY` enquanto aguarda writer, comprova `indisvalid=false`, exige reparo explícito e comprova os dois flags verdadeiros no final. Não usa alteração manual do catálogo PostgreSQL.

## Promoção dev → staging → produção

1. Rodar toda a CI local em banco vazio. Em staging, criar projeto Supabase e projetos frontend/backend próprios. Não restaurar dados reais sem processo separado de privacidade. Não reutilizar secrets de produção.
2. Backend: `NODE_ENV=production`, `DEPLOYMENT_ENV=staging`, `EXPECTED_SUPABASE_PROJECT_REF=<staging>`, `PRODUCTION_SUPABASE_PROJECT_REF=<produção>`, URL e credenciais do projeto staging. O startup recusa projeto igual/diferente do esperado. Configurar origins/callback/public menu/Mux/jobs de staging e quotas existentes. Billing continua desligado conforme configuração comercial existente.
3. Frontend: o `vercel.json` histórico aponta para produção. **Não usar esse proxy sem ajuste em staging.** Gerar configuração com `STAGING_API_ORIGIN` e `PRODUCTION_API_ORIGIN`: `node frontend/scripts/create-staging-config.mjs`. Resultado ignorado: `.tools/staging-vercel.json`. Usar a configuração separada no deploy manual do projeto staging, conservando CSP/headers. O gerador recusa o host de produção conhecido e o host do proxy original; não usa tokens.
4. Revisar histórico aplicado; aplicar somente migrations pendentes, cada uma em sua conexão/operação apropriada, SQL concorrente fora de transação. Conferir checksum e índice. Bucket piloto deve continuar privado; configuração inesperada causa erro, não é sobrescrita silenciosamente.
5. Smokes: health; login/me; CRUD de fixtures próprias; catálogo público de fixture publicada; QR/render; Analytics por plano; Mux signed playback/webhook no ambiente de teste. Conferir cookies HttpOnly/Secure/SameSite, Origin/CSRF, no-store, revogação, suspensão e tenant. Usar credenciais de fixture fora dos logs. Executar integração real de Storage antes de qualquer exposição.
6. Medir baseline com as duas flags `false`. Habilitar **só** `PERFORMANCE_REORDER_RPC_ENABLED=true` em staging após testes. Medir e conferir ordem persistida/erros/concorrência. Não usar reorder de cliente real como teste de carga. Comparar distribuição e chamadas com cenário equivalente, sem outro deploy simultâneo.
7. Analytics batch permanece `false`. Experimento separado com amostras suficientes em staging: comparar p50/p95/p99, erros, CPU/tempo SQL, concorrência, chamadas e cache frio/quente. Menos chamadas externas não garante menor p95/p99. Voltar a `false` se não melhorar consistentemente.
8. Só considerar promoção após revisar evidências e configuração efetiva. Rollback das flags é independente e não remove dados/schema. Produção mantém `MEDIA_STORAGE_ENABLED=false`; startup bloqueia o piloto se ativado em produção.

## Regiões e runtime — AÇÃO MANUAL

| Inspeção | Onde / o que registrar sem secrets |
|---|---|
| Vercel Functions | Projeto **backend**, Settings → Functions/Function Region; conferir deployment efetivo e logs da Function, inclusive região de execução/failover. Não inferir região do `x-vercel-id` de uma requisição ao frontend. |
| Node | Settings → Build and Deployment → Node.js Version e logs do deployment. `backend/package.json` não fixa engines; CI usa Node 24. A versão efetiva publicada não foi consultada. |
| Supabase | Project Settings / General / Infrastructure: região do projeto **staging** e **produção**; confirmar project ref separadamente. Não divulgar connection strings. |
| Aproximação geográfica | Registrar região API, região DB, RTT observado e cold/warm; escolher região de Function próxima ao DB somente após revisão. Manter uma região evita multiplicar distância/conexões sem benefício. |
| Mudança de região do DB | Tratar como migração própria: backup, Auth/Storage, replicação/disponibilidade, URLs/keys, cutover, rollback e janela. Não mover produção automaticamente. |

Referências primárias: [regiões Vercel](https://vercel.com/docs/functions/configuring-functions/region), [runtime Vercel](https://vercel.com/docs/functions/configuring-functions/runtime), [versões Node](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). A configuração no repositório não prova os valores nos painéis.

## Medição real e observabilidade

Usar tráfego legítimo em staging ou janela passiva de produção. Não foi preparado gerador de carga destrutiva. Exportar apenas eventos `request_performance` para arquivo local protegido e executar, por exemplo, `Get-Content logs.jsonl | node backend/scripts/summarize-performance.mjs`. Credenciais nunca entram nesse arquivo.

Endpoints prioritários: GET `/auth/me`, `/items`, `/categories`, `/design`, `/public/menu/:slug`, `/analytics`, `/qr`; PATCH reorder aparece com rótulo fixo `/items/reorder` (categories/subcategories continuam agrupados na área). Manter separados método, status, ambiente, versão/flags e janela de coleta. Medir cold/warm e distribuição de planos/tamanho de menu, sem exportar identificadores de clientes. Guardar tamanho da amostra e taxa de erro; p99 de poucas amostras não é evidência suficiente para rollout.

O resumo retorna p50/p95/p99 para `duration_ms`, `auth_ms`, `database_ms`, `database_calls`, `external_ms`, `external_calls`, com allowlist exata de endpoints, limite de 300 grupos, 10 mil amostras/grupo e 100 mil no total. Relata rejeições; excedentes são descartados e o resultado não deve ser interpretado como amostragem aleatória. Campos extras, slugs reais, query strings, IDs e dados privados não são reproduzidos. Exportações devem preservar linhas JSON completas; envelopes do provedor precisam ser desembrulhados com projeção segura antes da ferramenta.

Custos observados por revisão: um contexto AsyncLocalStorage/request, contadores/timestamps por chamada, uma linha JSON e a escrita SQL já existente **após** response. A instrumentação não acrescenta consultas dentro do caminho da request; o RPC de métrica pós-response é uma chamada adicional real fora das contagens publicadas. Não foi medido custo real de console/exportador/cold-start. DB/external medem fetch até cabeçalhos; durações somadas em paralelo podem superar duration total. Não representam CPU exclusiva SQL. Coleta não registra URL de provedor, corpo, query, e-mail, slug, business_id, Cookie ou Authorization. `request_id` é gerado pelo servidor.

A escrita após `finish` em serverless permanece **best-effort**, sem garantia de entrega. PREPARADO para observabilidade durável: exportar logs pela plataforma para coletor dedicado, allowlist do schema, timestamps do provedor, transporte autenticado/TLS, retenção limitada, controle de acesso e deduplicação por request_id. Configurar credenciais do exportador exclusivamente na infraestrutura. Validar entrega/perda e custos em staging; não inventar webhook HTTP dentro da API nem aguardar um coletor por request. `API_PERFORMANCE_LOG_ENABLED=false` permite desligar a linha de performance preservando a métrica existente; não desliga audit logs de segurança.

`backend/scripts/performance-diagnostics.sql` é somente leitura para DBA. Primeiro verificar se `pg_stat_statements` está disponível; só então executar as consultas seguintes na schema correta (`public`/`extensions`, conforme instalação). Priorizar volume de chamadas e tempo total acumulado, além de média/buffers. Não usar apenas o maior outlier. Não exportar query text/parâmetros. Não executar CREATE EXTENSION, reset ou EXPLAIN ANALYZE de escrita em produção por este processo. Comparar deltas em duas janelas equivalentes, sem reset global.

## Dashboard e bootstrap

Auditoria estática e Playwright desktop/mobile: o guard chama `AuthService.restore()` → GET `/auth/me`. Esse endpoint já devolve o conjunto leve de conta solicitado, embora business ainda possa conter imagens Base64. Depois, `DashboardComponent.ngOnInit` faz categorias, produtos e design em paralelo; alimentam home e preview. Home/phone preview não disparam uma segunda carga desses três datasets. `restore()` já compartilha somente a request em andamento; não virou cache de autorização. A atualização posterior de uso do plano tem outro propósito e foi preservada.

O teste `frontend/e2e/dashboard-loading.spec.ts` verifica as 4 requests, dependência de Auth e sobreposição das outras três; registra tempo total e bytes das fixtures. API simulada de 30 ms, tenant vazio e navegador local não estimam latência real. Na execução observada: **1.699 ms desktop**, **1.414 ms mobile**, 4 requests e **480 bytes JSON** em cada um (uma navegação por dispositivo, sem percentis). Isso não estima menus com imagens Base64. Em staging medir tempo desde navegação até loader concluído, payload real, waterfall e cold/warm. Sem evidência de duplicação/redução de payload não foi criado novo BFF, nem incluídos produtos/mídia/Analytics no `/me`.

## Storage e Base64: piloto seguro, cutover separado

IMPLEMENTADO: migration aditiva `20261014020000_private_image_pilot.sql` cria bucket **privado** `pingo-images-private`, catálogo `image_assets`, metadata/path/hash, estados reservado/verificado por `verified_at`, FORCE RLS e leitura do owner ativo/comercialmente elegível. Browser não escreve metadata. Uma policy **restritiva** bloqueia operações diretas anon/authenticated nesse bucket mesmo se houver policy permissiva global. Não altera buckets anteriores. Service role só existe no backend e requer autorização explícita antes de Storage, pois bypassa RLS por definição.

Serviço de piloto verifica staging e projeto distinto, identidade Auth, consulta business pelo JWT/RLS e owner, atividade e entitlement atual. Path é produzido exclusivamente no servidor: `businesses/<id-resolvido>/images/<sha256-do-PNG-normalizado>.png`. Não recebe object_path do browser, não sobrescreve, não assina leitura de arquivos de outro tenant. Não está montado em endpoint HTTP e não pode ser ativado em produção. Uma futura rota deverá usar a sessão opaca existente, Origin/CSRF, shared quotas e revogação normal; JWT temporário do piloto CLI não é uma nova forma de login no frontend.

Allowlist inicial: PNG RGB/RGBA 8 bits, não interlaçado, até **4 MiB**, até 2048 por dimensão e 4.194.304 pixels. Valida extensão ASCII simples, MIME declarado **e** assinatura/IHDR/chunks/CRC. Recusa SVG, APNG, tipos desconhecidos, metadata arbitrária, bytes após IEND, nomes com caminhos, tamanho/pixels excessivos e corrupção. PNG é decodificado com limite de pixels antes da inflação e reencodificado; ancillary seguros de comprimento fixo são descartados na normalização. Não distribui o original recebido. JPG/WebP/GIF/PDF antigos não são apagados nem convertidos automaticamente; ampliação de allowlist requer normalizador revisado e testes de formatos/bombs. O fluxo QR existente permanece independente.

`backend/scripts/backfill-private-images.mjs`: usa credencial temporária de **owner de fixture staging**, resolve seu business via RLS, pagina itens/categorias e imagens do business. Padrão: inventário com contagens, sem upload. `--upload`: reserva metadata, upload sem overwrite, download/readback/hash e só então `verified_at`. Hash determinístico + chave `(business_id,sha256)` tornam retries idempotentes; 409 exige readback correto, não é aceito como sucesso sem verificação. Falha não altera origem e pode ser retomada. Logs mostram contagens; auditoria de objeto fica na metadata, sem imprimir conteúdo ou IDs. Remover a credencial do ambiente ao finalizar. Não rodado contra Storage real nesta entrega; unit usa mocks e banco usa catálogo local.

Antes de cutover real, implementar em nova fase:

1. Fonte→asset em ledger por `(business, tabela, registro, campo, hash_origem)`, status/attempt/erro sanitizado; locks/CAS por referência. Inventário sem conteúdo e aprovação de custos/capacidade.
2. Upload verificado como no piloto. Manter original como backup; ao atualizar referência exigir que o hash/origem continue igual para não sobrescrever edição concorrente. Nunca apagar original antes do upload **e** leitura **e** referência verificados.
3. Renderer compatível Base64/URL/asset, entrega privada autenticada ou projeção pública somente para mídia realmente publicada. Não tornar bucket de drafts público para obter CDN. Assinaturas curtas não devem ser gravadas como URLs permanentes no banco.
4. Integrar purge existente, bucket específico e inventário de assets; impedir upload em andamento ressuscitar arquivo após exclusão. Integrar compensação/limpeza de órfãos por lease/retention e estado da conta. Essa ausência é o motivo do bloqueio de produção do piloto.
5. Medir payload/tempo/custo antes/depois; só então conectar o editor e cutover gradual em staging, com rollback por referência. Manter originais até expirar janela de verificação/retenção explicitamente aprovada.

URLs externas atuais (incluindo imagens demo Unsplash) continuam por compatibilidade; não houve fetch server-side de URL arbitrária nem introdução de SSRF. Modelo final deve servir assets controlados. Ingestão futura de externos precisa tratar SSRF, DNS rebinding, redirecionamentos, redes privadas e limites de download; não fazer backfill por hotlink automático.

Referências: [bucket privado](https://supabase.com/docs/guides/storage/buckets/fundamentals), [RLS e service keys](https://supabase.com/docs/guides/storage/security/access-control), [downloads](https://supabase.com/docs/guides/storage/serving/downloads).

## Proposta de publicação imutável — PREPARADO, NÃO IMPLEMENTADO

Hoje: publicação guarda flag/estado, design e mídia pronta; GET público consulta dados vivos após elegibilidade fresca. Editar dados pode mudar o menu visível sem novo snapshot. Manter comportamento nesta fase evita quebrar atualização, QR e playback.

Proposta inicial: `menu_publications(id uuid, business_id uuid, version bigint, schema_version int, snapshot jsonb, content_hash text, published_at timestamptz, created_by uuid, UNIQUE(business_id,version))` e ponteiro `business_account_state.active_publication_id`, com FK composta para impedir referência entre tenants. JSON contém só projeção pública: business sem owner/secrets, design permitido, categorias/subcategorias/itens elegíveis e **referências** de mídia. Não inclui Base64 grande, URLs assinadas expirantes, tokens, entitlements privados ou objetos de draft. Revisão do tamanho máximo e schema_version obrigatória.

JSON favorece leitura única/coerência de um menu pequeno e rollback simples. Tabelas versionadas oferecem integridade por linha/consulta SQL, mas multiplicam linhas, joins, policies, retenção e complexidade de rollback. Recomenda-se JSON tipado/validado para primeira implementação após medir payload; tabelas versionadas só se consultas/integridade por item justificarem. Não é decisão de migração executada.

Publicar em transação: owner JWT e tenant do servidor, validações frescas de conta/subscription/entitlements, advisory lock por business, capturar visão consistente do draft, validar relações/assets prontos, alocar versão, inserir snapshot imutável, trocar ponteiro e gravar audit. Conteúdo e ponteiro devem corresponder à mesma versão; concorrência entre edição/publicação exige snapshot transacional consistente (RPC com projeção única ou isolamento/locks revistos), não vários fetches sem consistência. Browser não escolhe version nem created_by. Grants impedem UPDATE do snapshot; política de retenção/purge é separada e não apaga evidência silenciosamente.

GET público: checar elegibilidade **atual** antes de servir versão. Snapshot não pode contornar suspensão/unpublish/past_due/grace. Apenas conteúdo imutável pode usar cache por `(publication_id,content_hash)`; autorização e ponteiro não recebem cache longo. QR mantém identidade estável e aponta para publicação ativa; Analytics mantém IDs de produto/version quando necessário sem aceitar eventos para outro tenant. Playback Mux continua emitido pelo backend, com política assinada e elegibilidade atual; não embutir token no snapshot nem congelar direitos de plano. Curtidas/contadores podem vir em overlay leve, sem reescrever JSON imutável.

Rollback: nova operação auditada aponta para versão anterior compatível, revalida disponibilidade dos assets/regras atuais e não restaura direitos antigos. Deletion deve invalidar ponteiro/eligibilidade imediatamente e coordenar referências de assets, Mux e purge. Rollout: leitura dual controlada, backfill idempotente de versão inicial apenas de menus publicados, comparação de projeções, canário staging, flag independente, rollback para live. Não gerar snapshots de todos os drafts nem expor dados sem publicar.

## Validação adversarial e limites

| Tentativa | Evidência executada |
|---|---|
| A acessar B / business_id forjado | owner-items-category, owner-phase1-auth `/me?businessId=...`, FKs/RLS SQL e reorder misto |
| Sessão revogada / escopo recovery | owner-phase1-auth e revocation cutoff/refresh lease no PostgreSQL |
| Suspenso / subscription / entitlement | owner e Analytics/QR SQL; piloto Storage nega conta/entitlement e metadata some via RLS |
| Limite por concorrência | SQL de produtos, categorias, vídeo, QR e quotas persistentes |
| RPC direta | authenticated/anon negados em RPCs privadas; reorder invoker permite somente owner/tenant correto |
| Reorder de outro tenant | IDOR, IDs mistos, duplicatas, mass assignment, rollback e lock concorrente |
| Analytics/QR de outro tenant | suites SQL reais e unit/API correspondentes |
| Storage privado de B / overwrite / delete | SET ROLE reais sobre catálogo, policy permissiva adversarial, metadata tenant e mock de owner falso antes do serviço privilegiado |
| Upload malicioso | unit de magic/MIME/extensão, SVG/polyglot/trailing, CRC, dimensões/size, interlace e truncamento |
| Bootstrap alheio | `/auth/me` ignora tenant/plan/header forjados; nenhum endpoint bootstrap novo criado |
| Mux / webhook | suites backend de mídia/upload, assinatura, estados e rotas autenticadas; chamadas reais ao provider não executadas |

VALIDADO: backend build; frontend typecheck/build; 21 suites backend com **214 testes passando**, 2 casos opt-in skipped; frontend **14 arquivos / 57 testes passando**; **4 testes operacionais**; **2 Playwright** de Dashboard desktop/mobile. PostgreSQL: **59 cenários anteriores**, 2 grupos performance, 1 grupo Storage e 1 recuperação real de índice. As execuções não garantem segurança absoluta.

NÃO EXECUTADO: pgTAP histórico (extensão não preparada), Supabase remoto descartável (TEST_SUPABASE_*), API Storage/Auth/Mux real, carga real, métricas de staging/prod, GitHub Actions remoto e deploy. O benchmark HTTP opt-in fica skipped na suíte normal. Builds frontend mantêm dois avisos preexistentes de budget CSS em design-editor/public-menu-view, sem novos erros. Não foram feitas refatorações visuais nesta fase.

## Achados corrigidos, riscos e arquivos

Corrigidos: histórico necessário fora do Git; locais divergentes de migration; ativação acoplada de RPCs com evidência diferente; ausência de teste/recuperação de índice inválido; resumidor aceitava nomes de endpoints arbitrários e só duration; falta de CI com banco vazio. Risco do proxy staging apontar produção agora tem gerador testado e procedimento explícito, mas o uso da configuração continua ação de deploy. Piloto acrescenta barreiras para uploads/path/RLS; não substitui o fluxo legado antes da integração completa.

Residuais: imagens Base64/externas ainda pesam; campos de imagem legados têm validações diferentes e não passaram a usar o validador do piloto; estilos CSS antigos acima do budget; telemetria pós-response pode perder eventos; regiões/runtime remoto desconhecidos; credenciais de staging e exportação real indisponíveis; catálogo local não comprova configuração da API Storage hospedada; ampliar formatos, integrar purge/publicação e realizar cutover ainda são trabalho separado. Não ativar Storage em produção nem Analytics batch sem suas evidências.

Arquivos desta fase: `.gitattributes`, `.github/workflows/ci.yml`, `README.md`; `supabase/migrations/*` + manifesto, `supabase/preflight/*`, `supabase/tests/*`; `backend/.env.example`, `backend/src/config/deployment.config.ts`, serviços menu-order/menu-analytics/image-storage-pilot; testes performance-security/performance-read-paths/image-storage-pilot/admin-phase3-hardening; scripts test-owner-database/check-migrations/recover-performance-index/verify-index-recovery/verify-image-storage/scan-source-secrets/summarize-performance/operational-tools.test/backfill-private-images; `frontend/scripts/create-staging-config.mjs`, `frontend/e2e/dashboard-loading.spec.ts`; docs 24 (referência histórica atualizada) e 25. Mudanças da auditoria anterior e do Analytics visual foram preservadas; não foram revertidas ou reimplementadas.
