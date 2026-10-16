# Auditoria de vídeo — 15/10/2026

Fonte: código da árvore de trabalho, antes da implementação. Alterações locais anteriores preservadas. Nenhum teste contra produção autorizado por este roteiro.

## Inventário e fluxo atual

OWNER UPLOAD: `product-video-uploader.component.ts` / `video-upload.service.ts` → `product-video.routes.ts` → `authenticateJwt` (sessão server-side, Origin/CSRF, business ativo) → `product-video.controller.ts` → `ProductVideoService` → `SupabaseProductMediaRepository.reserveUpload` → RPC `reserve_video_upload` → lock de capacity + snapshot de entitlements + reserva persistida → `OfficialMuxVideoProvider` → Direct Upload assinado (900s) → browser/Mux → webhook raw (`mux-webhook.routes.ts`, antes do parser JSON) → assinatura oficial → claim persistente por event ID → validação de duração/policy → `finalize_product_video_ready` → READY.

PLAYBACK: `/m/:slug` → `public-menu.component.ts` / galeria → clique Play (botão já bloqueado durante request; player somente após intenção, preload none) → `public.routes.ts` → filtro local IP 20/min + `reserve_shared_request` IP 30/min → `ProductPlaybackService` → `businessEligibility.findPublicBusinessBySlug` + produto available + media publicada/ready/mux do mesmo tenant → JWT assinado SDK Mux (`aud=v`, `sub=playbackId`, 120s) → player/Mux. O erro de vídeo é local à galeria e não remove produtos.

Banco: migrations `20260923*`, `20260924*`, `20260925*`, `20261003*`. FK composta produto/business, IDs Mux únicos, RLS, RPCs privadas service_role. Capacidade comercial já protegida por `lock_business_capacity`/triggers e planos reais; não substituir. Reservas já limitam dia, pendentes, owner/business/IP e troca de vídeo. Reserva sem ID de upload tem lacuna de expiração na busca do reconciler. Reconciliation busca apenas primeira página recente de uploads Mux e não tem lease global. READY sem asset e rejeitados com cleanup falho precisam entrar na manutenção.

Purge: `item.controller.ts` usa remoção coordenada; `account-purge.service.ts` e migrations `20261002010000*` coordenam Mux/Storage/DB/Auth por checkpoints e lease. Jobs internos são autenticados, mas `backend/vercel.json` não agenda cron. Admin já possui Infraestrutura/Vídeos/Segurança e quotas distribuídas por administrador. Telemetria de API e infraestrutura existente não mede custo real/delivery Mux. Config em `video.config.ts`, `.env.example`; validação de deploy em `deployment.config.ts`. Logs seguros em `security-audit.service.ts`; não imprimir valores de ENV.

Lacunas: circuito financeiro, kill switch persistido, dimensões de playback além de IP (NAT legítimo prejudicado), alertas/contadores por tenant/media, idempotency key de upload, erros de configuração/DB do webhook classificados indevidamente como assinatura, lease/continuidade de sweep, startup de vídeo e roteiro Mux real. Nenhuma necessidade de Redis/Upstash.

## Threat model antes de implementar

P=PREVENT; D=DETECT; C=CONTAIN; R=RECOVER. Classificação é impacto potencial, não garantia de exploração.

| Ameaça | Nível | P / D / C / R |
|---|---|---|
| Visitante anônimo legítimo / NAT cheio | MEDIUM | sessão curta sem fingerprint / contadores separados / IP folgado, sessão limitada / retry com backoff |
| Visitante abusivo | HIGH | quotas compartilhadas / eventos / negar tokens / expiração de janela |
| Bot simples | HIGH | sessão + IP HMAC / burst / 429 / TTL |
| Bot distribuído | CRITICAL | agregado business/media/global / alertas / breaker tenant e emergency stop / revisão Admin |
| Scraper | HIGH | resolver media no servidor / telemetria / limites / retenção curta |
| Hotlink | HIGH | signed + restriction claim / teste domínio / TTL / rotação |
| Token harvesting | HIGH | quotas em camadas / contador / negar emissão / TTL |
| Replay token | HIGH | TTL curto + restrição Mux / métrica auxiliar / revogar key em incidente / rotação; JWT não é de uso único |
| Owner legítimo | MEDIUM | sessão atual + capacidade atômica / pendentes / retry idempotente / manutenção |
| Owner malicioso | HIGH | entitlement e reserva / tentativas por janela/dia / quotas / purge |
| Owner comprometido | CRITICAL | auth/CSRF + limites owner/business / alertas / revogar sessão e suspender / reconciliar |
| Sessão roubada | CRITICAL | cookie HttpOnly + CSRF/Origin / tentativas / revogação / recuperação conta |
| Requests concorrentes | HIGH | lock/unique/RPC atômica / testes 100 / negar excesso / retry |
| Furar quota | CRITICAL | entitlements reais + capacity lock / DB tests / negar reserva / reconciliar |
| Spam intents | CRITICAL | orçamento de tentativas antes do provider / contador persistente / fail closed / cooldown |
| Upload abandonado | HIGH | URL curta e reserva / timeout / expirar e cancelar / sweep |
| Upload gigante fora do frontend | HIGH | metadados são UX; Direct Upload não oferece limite de bytes customizado / provider duração / reserva limita quantidade / delete; bytes de ingestão residuais |
| Vídeo >15s | HIGH | validar duração provider / rejected / negar playback / cleanup repetível |
| Webhook falso | CRITICAL | raw + assinatura oficial e tolerância timestamp / 4xx / sem efeitos / nenhuma transição |
| Webhook repetido | HIGH | unique event ID / duplicate / efeitos idempotentes / retry |
| Webhook atrasado | HIGH | estados monotônicos + vínculo upload/asset / conflito / sem regressão / cleanup tardio |
| Falha Mux | HIGH | timeouts/retries limitados / 503 / somente vídeo indisponível / compensation+sweep |
| Divergência Mux/DB | HIGH | passthrough e IDs únicos / reconciliation / rejeitar associação inválida / checkpoints |
| Asset órfão | HIGH | reserva anterior à chamada / sweep paginado / remoção apenas namespace Pingo / retry |
| Asset de outro tenant | CRITICAL | FK composta, IDs únicos e relação upload/asset / cross-tenant tests / negar / auditoria |
| Avalanche playback | CRITICAL | quotas agregadas / alerta precoce / bloqueio conservador e kill switch / expiração e override auditado |
| Ataque à fatura Mux | CRITICAL | todas as camadas / estimativas separadas de billing / emergency stop / incident response; emissão != delivery real |

## Plano técnico

1. Migration aditiva na cadeia/checksum: reutilizar `shared_request_quotas`, adicionar estado, agregados, alertas e lease privados; preservar planos e RPC comercial atual.
2. Adaptor PostgreSQL/VideoAbuseService: sessão opaca curta assinada, hashes rotativos, quotas por sessão/IP/business/media/global, fail closed somente vídeo, limites centrais e overrides auditados.
3. Playback validado no servidor + restriction claim oficial; upload orçamento de tentativas, retry idempotente, URL curta; webhook distingue 4xx/5xx e estados tardios.
4. Manutenção autenticada/lease/batches/cron, expiração e sweep progressivo, sem destruição paralela.
5. Admin existente para relatórios e controles; nenhuma mudança em template/CSS do cardápio público.
6. Testes unitários, PostgreSQL real local com conexões independentes, builds e roteiro staging opt-in. Ausência de provider/staging nunca conta como validação real.
