# Relatório de hardening de vídeo — 15/10/2026

**Resultado: implementação local concluída; NÃO liberada para produção.** Gates restantes: aplicação da migration e configuração de staging, Mux real/restrictions/hotlink/browser matrix, permissão da conta e confirmação do scheduler Vercel. Nenhum deployment, migration remota, cobrança ou teste de ataque em produção foi executado.

## IMPLEMENTADO

Auditoria e threat model antes do código em [VIDEO-SECURITY-AUDIT.md](VIDEO-SECURITY-AUDIT.md). Operação, limites, release/rollback, rotação de keys, incident response e roteiro opt-in em [VIDEO-SECURITY-OPERATIONS.md](VIDEO-SECURITY-OPERATIONS.md).

Migration aditiva `20261015000000_video_security_budgets.sql`, incluída na cadeia de 33 migrations com SHA-256. Reutiliza `shared_request_quotas`; adiciona estados/lease/agregados/alertas/provider usage privados com RLS forçada. Mantém RPC de reserva/capacidade/entitlements comercial atual, sem alterar FREE/BASIC/MEDIUM/PRO ou billing.

Adaptor `PostgresVideoRateLimiter` e `VideoAbuseService`: consumo transacional de budgets por sessão curta assinada, IP HMAC diário, estabelecimento, mídia, endpoint e agregado global; fail closed; budgets de tentativas antes do provider; breaker NORMAL/SOFT_ALERT/HARD_BLOCK; bloqueio global Admin/ENV; override temporário auditado, sem controle pelo owner.

Playback revalida elegibilidade e vínculo também na RPC de segurança antes de assinar, mantém JWT 120s (máximo 300), aud=v/sub, restriction claim oficial e no-store em todas as respostas do controller. Upload: TTL padrão 300s, limite de payload, chave idempotente com reserva única e reaproveitamento da URL existente sem armazená-la no DB. Webhook: raw/assinatura/event ID preservados, erros operacionais 503, tolerância passado/futuro, bloqueio de regressão e vínculo imutável upload/asset.

Reconciliation tem lease com token, progresso de páginas de upload/asset, batch/tempo limitados, expiração de reserva sem ID, limpeza rejeitados/errored e verificação de ready sem asset. Alertas/logs de órfãos e falhas são persistidos quando o banco está disponível. Purge existente é preservado; jobs GET autenticados/cron versionados. Sincronização opcional da API oficial Delivery Usage, com atraso, separa PROVIDER_REPORTED de ESTIMATED e não calcula custo financeiro.

Admin integrado em Infraestrutura/Vídeos e Segurança: filtros hoje/7/30 dias, plano, mídia pronta, intents, token requests, bloqueios, uso estimado/reportado, alertas e estado; controles com motivo, alvo explícito, expiração, sessão/MFA/CSRF/Origin e reautenticação existentes. Aplicada a skill local `design-system` para reutilizar os padrões administrativos. Nenhum template, CSS ou layout do cardápio público foi alterado por esta fase. As modificações locais anteriores do usuário foram preservadas.

## VALIDADO LOCALMENTE

| Verificação | Resultado |
|---|---|
| Backend `npm run build` | Passou |
| Backend `npm test -- --runInBand --silent` | 252 passaram; 2 testes opcionais já condicionais foram pulados |
| Regressão final de upload/webhook/manutenção | 30 passaram, incluindo sanitização de retry e falha do usage job sem bloquear checkpoints; inclui um caso novo após a suíte completa |
| Frontend `npm run build` | Passou; avisos de orçamento CSS em public-menu-view (36,48KB) e design-editor (27,89KB), áreas não alteradas por esta fase |
| Testes Angular afetados (upload, validação, uploader e Admin vídeo) | 21 passaram em 4 arquivos |
| Cadeia de migrations + testes banco (`npm run test:database`) | Passou em PostgreSQL 16 local temporário, sem URL remota |
| Concorrência playback | 100 requests, exatamente 20 autorizações na mesma sessão |
| Bot simulado | 1000 chamadas SQL na mesma sessão, exatamente 20 permitidas; nenhum minuto real no Mux |
| Dimensões IP / mídia / business | 100 solicitações com rotação de sessão/IP; agregados respeitados |
| Limite distribuído | Dois processos Node independentes, mesmo PostgreSQL; soma exatamente 20 slots |
| Capacidade comercial / pending / idempotência | 100 reservas concorrentes; capacidade do plano preservada, 3 pendentes quando configurado, mesma chave cria uma reserva |
| Circuit / Admin / global stop | Transições NORMAL→SOFT_ALERT→HARD_BLOCK, owner negado, override auditado, menu continua elegível |
| Webhook concorrente | 100 claims do mesmo evento; um claim vencedor, falha pode ser repetida e finalizado não é reaplicado |
| Assinatura / JWT / isolamentos | HMAC real SDK, replay tolerance; RSA local com exp/sub/aud/restriction; testes tenant/publicação/status/duração; sem provider real |
| Lease e retenção | Exclusão mútua, token incorreto não finaliza, limpeza de buckets, RLS/grants privados |
| Playwright Chromium desktop e mobile | 6 passaram: dois formatos, Play explícito, preload none, coalescing e erro 503 preservando produto/foto |
| Testes operacionais Node | 5 passaram; manifesto, ferramentas staging-only e restriction dry-run |
| Scanner de secrets em código | Passou; imprime somente paths/regras, nenhum valor |
| Scanner de secrets no bundle final | Passou; 27 arquivos, 12 valores privados conhecidos conferidos sem divulgação |
| Arquivos ENV rastreados pelo Git nos caminhos auditados | Nenhum; exemplos contêm nomes/placeholders |

Os dois opcionais pulados são a integração remota descartável de convites e o benchmark opt-in de performance. O teste distribuído desta fase **não** foi pulado: iniciou processos separados e storage PostgreSQL real local. Testes no sandbox que precisavam iniciar binários locais foram repetidos com execução autorizada; não se usou banco remoto para contornar limitações.

## VALIDADO COM MUX REAL

**Nenhum. PREPARADO — NÃO VALIDADO COM PROVIDER.** O SDK oficial foi inspecionado e exercitado criptograficamente sem chamada Mux de upload/playback. Não confundir mocks Playwright ou RSA/HMAC local com enforcement do CDN, faturamento, webhook remoto ou reprodução real. Nenhuma credencial foi exposta para provar disponibilidade de ambiente.

## REQUER CONFIGURAÇÃO MANUAL

- Aplicar a migration em staging pela cadeia/checksum oficial e confirmar os grants/RPCs. Deploy de código só depois do schema.
- Configurar segredos e signing key, allowlist oficial por ambiente e restriction Mux; script padrão DRY_RUN, APPLY explícito somente staging. Assets antigos não exigem migração porque a referência está no token.
- Validar permissões/plano da conta Mux para Playback Restrictions/Delivery Usage. Habilitar `MUX_USAGE_SYNC_ENABLED` somente após teste read-only no ambiente correto.
- Definir CRON_SECRET e conferir projeto/root directory, cron/frequência/maxDuration suportados e execução real no dashboard Vercel. Configuração no repositório não é evidência de job executado.
- Calibrar budgets contra tráfego legítimo e NAT cheio em staging, observando locks e latência do banco. Os limites comerciais dos planos não precisam de alteração.
- Executar o roteiro opt-in completo do documento operacional antes de qualquer promoção a produção.

## NÃO EXECUTADO

Upload real <=15s/>15s, webhook Mux remoto, expiração/rejeição de JWT no CDN, hotlink permitido/negado, compatibilidade Safari/Firefox/mobile real, rotação de credenciais real, confirmação de delete/purge 404 no provider, uso reportado real, deployment/scheduler Vercel, benchmarks de carga remota e qualquer stress test de produção. Não há dados suficientes para afirmar conclusão desses gates P0.

## RISCO RESIDUAL

JWT de playback é bearer reutilizável até expirar: budgets limitam emissões e não quantas vezes o CDN aceita um mesmo token. Bloqueio de novas emissões não revoga imediatamente tokens ou playback já autorizado. Headers Referer/UA não são prova forte de browser legítimo. Ataque distribuído pode atingir budgets agregados; hard block conservador pode causar indisponibilidade temporária de vídeo e exige revisão. Não existe teto garantido da fatura Mux.

Direct Upload não oferece limite customizado real de bytes no contrato auditado; rejeitar duração depois do processamento não desfaz ingestão já cobrada. Metadados declarados não são barreira suficiente. Resolver esse teto exigiria mudar o caminho de ingestão, fora desta fase cirúrgica. Provider usage tem atraso mínimo de 12h e cobertura limitada aos assets associáveis no banco; estimativa por token não é delivery nem preço real.

Rate limiter usa janelas fixas; perto da fronteira pode liberar dois budgets. Agregado global e serialização por business precisam ser medidos em staging. O limiter HTTP global anterior continua podendo restringir NAT cheio antes do controle de vídeo; não foi removido. Falha do PostgreSQL inteiro não permite prometer disponibilidade do cardápio dependente desse banco; isolamento de falha aqui refere-se ao subsistema de vídeo/anti-abuso. Secret scan não audita logs externos nem histórico Git completo.

## Antes / depois

| Controle | Antes | Depois | Status |
|---|---|---|---|
| Signed playback | SDK signed | Mantido; aud/sub/exp testados | Local validado |
| Playback restriction | Ausente | Claim oficial + ferramenta staging-only idempotente, sem backfill de assets | Provider pendente |
| Token TTL | 120s, max 300 | Mantido | Local validado |
| Distributed rate limiting | PostgreSQL IP 30/min + local IP 20/min | Transação com sessão, burst, IP folgado, business, media e global | Dois processos/DB local validado |
| Upload intent quota | Reservas aceitas/dia/janela | Budget de tentativas antes de Mux, incluindo falhas/retries | Local validado |
| Pending upload quota | Reserva atômica existente, padrão 3 | Preservada; testada sob 100 requests | Local validado |
| Webhook validation | Oficial raw; erro interno podia virar signature 400 | Raw/HMAC, replay tolerance; erro operacional 503 | Criptografia local; remoto pendente |
| Webhook idempotency | Event ID/claim persistente | Preservado; replay/estados endurecidos | 100 claims locais |
| Tenant isolation | RLS/FK/vínculo server-side | Preservada + revalidação RPC + binding imutável | Local validado |
| Abuse detection | Limites de upload/IP | Regras auditáveis + contadores/alertas persistentes | Local validado; calibração staging |
| Circuit breaker | Ausente | Soft, hard, expiração e override auditado | Local validado |
| Global kill switch | Ausente | ENV + Admin persistido | Local + E2E com 503 |
| Monitoring per tenant | Upload counts básicos | Métricas tenant/media/dia, ESTIMATED e PROVIDER_REPORTED separados | Local; provider pendente |
| Reconciliation | Sem lease, primeira página de uploads, lacunas | Lease/token, páginas, expiração sem ID, cleanup e ready missing | Local; provider pendente |
| Purge | Máquina existente Mux/Storage/DB/Auth | Preservada, endpoints GET cron autenticados | Local; 404 provider pendente |
| Cron scheduling | Nenhum cron em backend/vercel.json | Três agendamentos versionados com segredo e maxDuration | Dashboard/manual pendente |
| Admin monitoring | Infraestrutura básica | Segurança vídeo integrada; filtros/controle/auditoria | Build/unit local validados |
| Secret handling | ENV e scanner existentes | Preservados; startup valida vídeo, sem segredo em frontend/log novo | Scanners locais; ambiente externo não auditado |

## Gate P0 para produção

Checks de código/local passam. Permanecem abertos: Mux Playback Restriction real, hotlink e browser matrix, integração completa real incluindo exclusão/expiração, migration/secrets do ambiente e execução dos cron jobs. **Não classificar como pronta para produção antes dessas evidências.**
