# Operação de segurança de vídeo

Estado: preparado e validado localmente; staging/Mux real e configuração do deploy são gates obrigatórios antes da produção. Auditoria prévia: [VIDEO-SECURITY-AUDIT.md](VIDEO-SECURITY-AUDIT.md). Resultado dos testes e tabela antes/depois: [VIDEO-SECURITY-REPORT.md](VIDEO-SECURITY-REPORT.md).

## Arquitetura e autoridade

Angular → sessão owner atual/Origin/CSRF → orçamento de tentativas persistente → reserva comercial existente (`lock_business_capacity`, entitlements reais, limite diário e pendentes) → Mux Direct Upload signed → webhook raw/assinatura oficial/event ID → validação de vínculo, duração e policy → ready.

Consumidor → clique explícito → API resolve slug/produto/mídia/tenant → elegibilidade atual → RPC compartilhada revalida mídia, publicação, produto e elegibilidade → budgets → breaker → JWT curto com restriction ID → Mux. A identidade anônima é um cookie opaco assinado de 30 minutos, HttpOnly, Secure em produção, SameSite=Lax, sem fingerprint/PII e sem papel de autenticação. O BFF deve ficar na mesma origem do frontend; o serviço público envia credentials para manter esse cookie.

Não existe fallback para memória quando PostgreSQL falha. Uploads e novas autorizações de playback falham fechados; GET do cardápio não depende dessas tabelas. O player já só nasce após Play e mantém `preload=none`; autoplay no player expandido é consequência do clique explícito, não autoplay da página. O botão já bloqueia cliques enquanto aguarda resposta. Nenhum HTML/CSS/layout público foi modificado por esta fase.

## Configuração e limites iniciais

`backend/src/config/video-security.config.ts`, `video.config.ts` e `backend/.env.example` são as referências. Limites são operacionais, ajustáveis por ENV; não representam nem substituem capacidade dos planos.

| Configuração | Padrão | Interpretação |
|---|---:|---|
| VIDEO_PLAYBACK_TOKEN_TTL_SECONDS | 120 | segundos; permitido 30–300 |
| VIDEO_UPLOAD_URL_TTL_SECONDS | 300 | segundos; permitido 60–900 |
| VIDEO_MAX_DURATION_SECONDS | 15 | máximo absoluto de duração aceita |
| VIDEO_MAX_UPLOAD_BYTES | 52428800 | tamanho declarado/UX; não limite real de bytes imposto pelo Direct Upload |
| VIDEO_PLAYBACK_RATE_LIMIT | 20 | solicitações por sessão/janela; antes era também filtro IP local |
| VIDEO_PLAYBACK_RATE_WINDOW_SECONDS | 60 | janela em segundos |
| VIDEO_PLAYBACK_BURST_LIMIT | 8 | solicitações por sessão/10s |
| VIDEO_PLAYBACK_IP_LIMIT | 1200 | solicitações por IP HMAC/janela, maior para NAT compartilhado |
| VIDEO_PLAYBACK_BUSINESS_LIMIT | 6000 | agregado por estabelecimento/janela |
| VIDEO_PLAYBACK_MEDIA_LIMIT | 3000 | agregado por mídia/janela |
| VIDEO_PLAYBACK_GLOBAL_LIMIT | 10000 | agregado da plataforma/janela |
| VIDEO_CIRCUIT_SOFT_THRESHOLD | 1500 | alerta de volume por estabelecimento |
| VIDEO_CIRCUIT_HARD_THRESHOLD | 9000 | volume alto + denials abaixo, nunca só popularidade |
| VIDEO_CIRCUIT_HARD_DENIALS | 1500 | negativas na mesma janela, combinadas ao volume alto |
| VIDEO_CIRCUIT_BLOCK_SECONDS | 300 | expiração automática do hard block |
| VIDEO_AUTO_CIRCUIT_BREAKER_ENABLED | true | desliga somente a transição automática hard, não quotas ou bloqueios manuais |
| VIDEO_PLAYBACK_GLOBAL_KILL_SWITCH | false | bloqueia novas autorizações incluindo preview |
| VIDEO_UPLOAD_RATE_LIMIT | 5 | tentativas owner/business/IP antes de reservar, por janela |
| VIDEO_UPLOAD_RATE_WINDOW_SECONDS | 900 | janela upload |
| VIDEO_DAILY_UPLOAD_LIMIT | 20 | tentativas owner/business/dia e reserva existente |
| VIDEO_MAX_PENDING_UPLOADS | 3 | reserva atômica existente; waiting/uploading/processing |
| VIDEO_WEBHOOK_RATE_LIMIT | 10000 | eventos assinados por minuto; excesso gera 5xx para retry |
| VIDEO_ANONYMOUS_SESSION_TTL_SECONDS | 1800 | sessão curta; 300–3600 |
| MUX_USAGE_SYNC_ENABLED | false | read-only no Mux; persiste delivery reportado sem cálculo monetário |

Todas as dimensões são consumidas na mesma transação, inclusive negativas. Contadores saturam, não crescem indefinidamente. Janela fixa pode permitir até dois budgets em torno da fronteira da janela; isso não é sliding window. As quotas anteriores de reserva continuam sendo uma segunda barreira. A instância mantém filtro IP barato, e o limiter global HTTP anterior (1000/15min/IP) permanece: monitorar NAT cheio também nesse controle geral, sem removê-lo silenciosamente nesta tarefa.

Os valores são budgets iniciais conservadores, não calibrados em tráfego real. Validar restaurante cheio, redes móveis/NAT, latência e pico de sessões em staging antes da liberação. O PostgreSQL serializa por estabelecimento e atualiza um agregado global; medir contenção do banco em staging. Não houve benchmark de carga de produção nem instalação de serviço externo.

## Playback restrictions e compatibilidade

SDK auditado: `@mux/ts` instalado (15.x), `lib/jwt.ts` suporta `params`, e `video.playbackRestrictions` suporta referrer/UA. A [documentação oficial Mux](https://www.mux.com/docs/guides/secure-video-playback) aplica a restriction no claim `playback_restriction_id`, não por mutação de asset. Portanto assets antigos não precisam de backfill: tokens novos passam a referenciar a restriction. Tokens já emitidos expiram naturalmente. O teste criptográfico local verifica RS256, exp, sub, aud=v e restriction claim; não prova enforcement no CDN.

Ferramenta idempotente e staging-only, sem carregar `.env` implicitamente:

```powershell
# Fornecer apenas credenciais do ambiente Mux de staging pelo secret manager.
$env:DEPLOYMENT_ENV='staging'
$env:MUX_PLAYBACK_ALLOWED_DOMAINS='staging.seudominio.com.br'
node backend/scripts/configure-mux-playback-restriction.mjs
# Só após revisar o DRY_RUN:
node backend/scripts/configure-mux-playback-restriction.mjs --apply
```

Sem `--apply` não há chamada nem alteração no provider. Apply reutiliza restriction equivalente ou o ID explicitamente configurado; não recria assets. Configurar `MUX_PLAYBACK_RESTRICTION_ID` com o ID retornado. Não misturar credenciais Mux produção/staging. Para produção, promover as mesmas settings revisadas no dashboard/secret manager do ambiente correto. A ferramenta recusa produção, não testa automaticamente nenhum recurso real.

Allowlist exige hosts exatos (até 10), nenhum wildcard, localhost ou host de teste. Política preparada: `allow_no_referrer=false`, `allow_high_risk_user_agent=false`, `allow_no_user_agent=false`. Validar Safari/iOS, Firefox, Chrome, Android e privacidade antes de ativar: clientes que omitem Referer podem falhar. Não há prova de compatibilidade real nesta entrega. Conferir permissão/plano da conta Mux. A restrição de User-Agent do Mux não equivale a anti-bot infalível; cabeçalhos podem ser forjados por clientes fora do browser. CORS não é autoridade.

Produção com vídeo exige signing key RSA válida, provider/secrets, restriction ID e CRON_SECRET no startup. `VIDEO_REQUIRE_PLAYBACK_RESTRICTION=false` só permite a exceção explícita de compatibilidade em staging; em produção não ignora a restriction. Instalações sem credenciais de vídeo podem executar somente o cardápio, mas endpoints de vídeo continuam falhando fechados. `VIDEO_SECURITY_ENABLED` ativa a validação de configuração, não desliga os checks obrigatórios.

## Upload e idempotência

O cliente envia UUID em `Idempotency-Key`. Reutilizar a mesma chave somente em retry da mesma intenção, com mesmo produto, tamanho, MIME, proporção e substituição. A chave é HMAC no banco, única por business. Requests concorrentes encontram a reserva única. Enquanto a primeira chamada ainda não vinculou o upload, retornar 409 e repetir com backoff; depois, retornar a mesma URL enquanto waiting e não expirada. Não persistir URL no banco, localStorage ou logs. Não fazer retry ilimitado: tentativas de retry também consomem budget anti-abuso.

URL de upload só existe após a reserva. Timeout/falha limita retries do SDK a zero, para não criar recursos duplicados silenciosamente; compensation cancela quando possível e o sweep usa passthrough para recuperar a lacuna transacional Mux/DB. Pendentes sem ID e sem expiração são candidatos após 10min. Payload de intent limitado a 2KB. Tamanho/MIME/duração declarados continuam sendo UX. O contrato oficial de [Direct Upload](https://www.mux.com/docs/api-reference/video/direct-uploads/create-direct-upload) não expõe um limite customizado de bytes: um arquivo malicioso maior pode gerar ingestão antes da validação de duração. Não foi inventado `max_file_size` ou truncamento. Se um teto absoluto de bytes for obrigatório, é necessário outro caminho de ingestão; não substituir a arquitetura nesta fase.

## Webhook, recuperação e purge

Webhook `/api/v1/webhooks/mux`: raw body limitado a 1MB antes de JSON, assinatura oficial sobre bytes, tolerância de 300s (passado e futuro), evento único persistente. Assinatura inválida é 400; configuração/DB/processamento indisponível é 503; duplicata concluída é 200. Eventos com lease de processamento anterior são recuperáveis pelo mecanismo de stale claim. Assinaturas válidas não autorizam reassociar um asset a outro upload. IDs do provider são imutáveis no banco e únicos; ready não regride por evento errored atrasado. Uma falha temporária é registrada para retry, com logging sanitizado.

Reconciliation tem lease com token (240s), checkpoint de páginas de uploads/assets, batch até 100 (padrão 50), orçamento de loop de 40s e chamadas Mux até 8s sem retries. O fechamento do lease exige o mesmo token e lease não expirado. Falha segura mantém lease até expiração. Percurso por offset do Mux retorna à primeira página ao terminar; exclusões concorrentes podem deslocar páginas, então ciclos repetidos são necessários. Não há scan ilimitado em uma função serverless.

Busca: waiting/uploading expirados, waiting sem upload ID, processing antigo, cleanup rejeitado/errored, pending_deletion e ready com asset ausente. Rotação por `last_provider_sync_at` evita que as mesmas mídias monopolizem o batch. Sweep remove somente recursos no namespace `pingo-media:`; assets sem vínculo têm carência de uma hora e reservas em processamento são preservadas. Alertas de órfão (inclusive sem tenant sobrevivente) e remoção são persistidos; erros mantêm nova tentativa. Recursos fora do namespace não são removidos.

Purge existente permanece sequencial e idempotente: mídia/produto chamam remoção Mux, falha deixa pending_deletion; conta/business usam a máquina de purge existente, recursos externos antes de DB/Auth, checkpoints e lease de 900s. Não apagar referências locais antes da confirmação de exclusão. Confirmar 404 no provider em staging. Uma função terminada por timeout preserva checkpoints, mas pode aguardar expiração do lease antes de continuar.

## Cron e implantação

`backend/vercel.json` agenda GET autenticados: vídeo reconcile a cada 5min, purge de contas a cada 10min, shared maintenance no minuto 15 de cada hora. Função com maxDuration=240s. Definir `CRON_SECRET` aleatório de pelo menos 32 caracteres; o Vercel o envia em Authorization. Chamadas manuais antigas continuam aceitando `VIDEO_RECONCILIATION_SECRET` para vídeo e `INTERNAL_JOBS_SECRET` para operações. Não usar query string para segredo nem permitir tenant informado pelo chamador. Endpoints sem credencial respondem 401.

Configuração versionada não prova execução real. Conferir no dashboard Vercel: root directory `backend`, projeto/ambiente correto, suporte do plano a cron com essa frequência e duração, CRON_SECRET, rota pública alcançável pelo scheduler e logs dos jobs. Vercel Cron invoca o deployment de produção do projeto; um projeto separado de staging pode usar cron no seu deployment principal com DEPLOYMENT_ENV=staging. Preview não é prova de agendamento. Se o plano não suportar a frequência, usar scheduler existente aprovado ou ajustar plano; não reduzir para um cron diário fingindo atender cleanup rápido. Nenhum deploy foi realizado por esta tarefa.

Sequência de release: backup/metadados do schema → verificar manifest/checksums → migration aditiva no Supabase de staging → configurar secrets/restriction → backend → frontend/Admin → testes reais abaixo → observar jobs → só então revisão e promoção. Nunca publicar código antes da migration; ausência de RPC falha fechada e indisponibiliza vídeo.

## Telemetria, privacidade e custo

Admin em Infraestrutura/Vídeos ou Sistema/Segurança: sessões administrativas atuais, rate limits compartilhados, CSRF/Origin, reautenticação recente para override. Owner não altera breaker. Escolher explicitamente tenant ou global, estado, duração (60s–24h) e motivo. NORMAL temporário impede novo auto hard durante o override, mas não ignora budgets/eligibilidade. O kill switch de ENV tem prioridade sobre a liberação Admin. Todas as mudanças entram em `admin_audit_log`.

Contadores por business/media/dia UTC: intents permitidas/bloqueadas, solicitações de tokens, autorizações permitidas/bloqueadas, rate hits, ready/rejected/failed/expired. `estimatedDeliverySeconds` soma duração uma vez por autorização permitida. Pode superestimar visualizações e subestimar replay; não é billing nem limite financeiro exato. Eventos de play do cliente não foram adicionados e não são autoridade. As métricas de tokens contam autorização anterior à assinatura: falha posterior ao assinar pode supercontar permissões.

`MUX_USAGE_SYNC_ENABLED=true` habilita job read-only na [API oficial Delivery Usage](https://www.mux.com/docs/api-reference/video/delivery-usage/list-delivery-usage), uma página de 100 registros por manutenção, cursor persistente e upsert diário idempotente. Usa um dia UTC completo de dois dias atrás porque a API possui atraso mínimo de 12h. Dados no Admin são PROVIDER_REPORTED, separados de ESTIMATED; sem valores monetários/BILLING_ACTUAL. Sem permissão da conta, registrar PROVIDER_USAGE_FAILURE e retornar usageStatus=unavailable, preservando os checkpoints da conciliação principal; desabilitar somente esse job opcional e investigar. Retenção roda antes das chamadas Mux, inclusive durante indisponibilidade do provider. Assets apagados antes da associação histórica não são atribuídos: essa cobertura não representa uma fatura completa. Não há integração de preço, porcentagem de receita ou ledger financeiro falso. Mux Data Monitoring é outro produto com elegibilidade/plano próprios; não foi adicionado como dependência.

Retenção: cookie 30min; buckets/HMACs de IP e sessão 2 dias; ledger de upload com HMAC diário 7 dias; alertas e webhooks finalizados 30 dias; agregados estimados/provider 90 dias. Audit log Admin segue retenção existente. Cron executa cleanup. Não guardar IP bruto ou UA completo. Código da fase não loga URL de upload, JWT, secrets, headers ou cookies; scanner de código e de bundle não substitui auditoria dos logs do ambiente implantado.

## Roteiro opt-in obrigatório — Mux real, somente staging

Executar apenas com projeto Supabase e ambiente Mux separados de produção, fixture sintética descartável e orçamento pequeno. Não usar clientes reais, replay massivo nem milhares de minutos no CDN.

1. Aplicar migration e confirmar RPC privada via service_role, RLS forçada e jobs autenticados. Rodar `/health`, menu público, auth owner e preview. Registrar deployment IDs, versão/checksum, horários e resultado, sem tokens/URLs.
2. DRY_RUN da ferramenta de restriction; revisar allowlist staging; APPLY explícito; configurar restriction ID no backend. Validar host permitido e host externo controlado em Chrome, Safari/iOS, Firefox e Android. Host externo deve falhar no manifesto/segmentos. Repetir com referer ausente e high-risk UA e documentar compatibilidade.
3. Upload pela aplicação de arquivo sintético <=15s. Verificar reserva, Direct Upload real, webhook assinado real, ready privado, publicação explícita, Play após clique e reprodução com som. Confirmar token sem cache em DevTools e nenhum token em storage/snapshot/log.
4. Copiar token somente em memória de uma ferramenta de teste protegida. Verificar sub/aud, expiração real após TTL e falha ao reutilizar em outro playback ID. Não salvar token em relatório, shell history ou URL permanente.
5. Repetir intenção com mesma Idempotency-Key; confirmar uma reserva/um upload. Simular falha de conexão após criação. Aguardar recuperação sem duplicar capacity.
6. Subir um único vídeo >15s. Confirmar rejected, mídia não publicada, capacidade consistente e asset removido (404). Isso pode incorrer em ingestão; não repetir em massa.
7. Criar um upload e não enviar arquivo. Aguardar timeout; executar maintenance autenticada; confirmar capacidade liberada, cancelamento/cleanup e ausência de pendente eterno. Simular criação sem attach usando fixture de staging.
8. Testar eventos duplicados, fora de ordem e indisponibilidade temporária DB sem desabilitar assinatura. Verificar 200 em duplicata concluída e 503 em falha operacional; provider deve reenviar.
9. Bloquear tenant no Admin, verificar alertas e Play indisponível mantendo produto/foto/preço/categorias. Outro tenant continua. Testar global stop e liberação auditada. Ataques de volume são simulados no PostgreSQL local, não no Mux real.
10. Remover vídeo, produto e conta fixture. Verificar purge sequencial e 404 dos recursos externos. Observar cron real completando lease/checkpoint e retenção. Ativar usage sync opcional e aguardar dados atrasados do provider.

Status nesta entrega: PREPARADO — NÃO VALIDADO COM PROVIDER. O teste Playwright local usa respostas simuladas e Chromium desktop/mobile; não equivale a Safari, Firefox nem validação real Mux/hotlink.

## Incidente: consumo Mux disparou

Abrir Admin/Vídeos → identificar tenant, mídia, endpoint e alertas → comparar estimativas com provider (atraso) → HARD_BLOCK temporário do business com motivo → se global, HARD_BLOCK global e/ou VIDEO_PLAYBACK_GLOBAL_KILL_SWITCH=true → confirmar que novos tokens foram negados e cardápios continuam → investigar sessões comprometidas/harvesting/replays → revogar sessões/suspender conta quando necessário → reconciliar e remover órfãos → acompanhar uso oficial → liberar gradualmente com override temporário e métricas.

Kill switch impede novos tokens; não revoga JWTs já emitidos nem interrompe sessões já autorizadas no CDN imediatamente. TTL e restrição reduzem a janela. Em abuso ativo de token assinado, a resposta extrema é revogar a signing key Mux (impacta todos os tokens dessa key). Orçamento de emissão não estabelece teto absoluto em reais: um mesmo token pode ser reutilizado dentro de sua validade e clientes podem forjar headers. Alarmes/limites financeiros no provider e controle de WAF existentes devem complementar essa proteção.

## Rotação de credenciais

Signing key: gerar nova key no ambiente Mux correto → salvar private key/ID no secret manager → atualizar deployment/env e emitir token de teste em staging → promover/reiniciar instâncias usando a nova key → aguardar pelo menos o maior TTL permitido (300s) mais margem/propagação antes de revogar a antiga. Em vazamento, revogar a antiga imediatamente e aceitar a indisponibilidade temporária dos vídeos. O suporte real da conta à coexistência de keys deve ser confirmado; não depende de IDs embutidos no código. Nunca registrar PEM/token.

Token ID/secret da API Mux vazou: revogar imediatamente, criar credencial com escopo mínimo, atualizar secret manager/backend/jobs, verificar uploads/assets e audit trail da conta, reconciliar recursos. Webhook secret: atualizar segredo correspondente ao endpoint e provider de forma coordenada; durante a transição esperar retries e testar assinatura real. Rotacionar VIDEO_IP_HASH_SECRET invalida cookies curtos/identidades anti-abuso e idempotency HMAC anterior; fazer fora de incidentes de upload em andamento ou aceitar retries 409, sem desligar tenant checks.

## Rollback

Migration aditiva: manter as tabelas e colunas no rollback de aplicação. Não executar DROP em produção nem alterar migration aplicada. Restaurar versão anterior de backend/frontend com rollback de deploy atômico e avaliar novos controles perdidos. Preservar entitlements/capacity, signed playback, auth/tenant e webhook signature.

Se auto breaker gerar falsos positivos: `VIDEO_AUTO_CIRCUIT_BREAKER_ENABLED=false` + NORMAL temporário auditado no tenant; budgets continuam. Se a restriction quebrar browser legítimo: corrigir settings no ambiente Mux correto ou trocar por restriction revisada menos restritiva; não tornar playback público. Exceção sem restriction só em staging. Se o adaptor compartilhado falhar: conter vídeo com kill switch, corrigir DB/RPC/migration ou voltar ao deploy anterior que já possui limite compartilhado IP; não habilitar fallback ilimitado nem criar flag que remova controles obrigatórios. Desabilitar `MUX_USAGE_SYNC_ENABLED` reverte só a coleta opcional. Confirmar jobs no dashboard depois de qualquer rollback.
