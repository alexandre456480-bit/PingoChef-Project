# Fase 1 do proprietário: autenticação, cadastro e planos

Implementação e validação local em 02/10/2026. Este documento descreve o código desta fase e prevalece sobre especificações históricas de autenticação. A execução não aplicou migrations nem alterou configurações no Supabase remoto.

## Inventário real antes da migração

O comando `npm run audit:owner-transition`, no backend, consultou Supabase Auth e tabelas exclusivamente em leitura. Relatório de 02/10/2026 às 16:13:43 UTC:

| Verificação | Resultado |
| --- | ---: |
| Usuários Auth | 2 |
| Usuários com e-mail confirmado | 2 |
| Estabelecimentos | 1 ativo |
| Assinaturas atuais | 1 Free |
| Produtos atuais | 13 |
| Categorias atuais | 4 |
| Slots de vídeo ocupados | 0 |
| Proprietários duplicados | 0 |
| Proprietários sem identidade Auth | 0 |
| Relações inconsistentes entre tenants | 0 |
| Estabelecimentos sem assinatura | 0 |
| Assinaturas com provider sem plano | 0 |

O estabelecimento existente tem **13 produtos no Free**, cujo novo limite é 10. O conteúdo permanece intacto. Novos produtos serão bloqueados; edição e exclusão voluntária continuam disponíveis. Para conceder um plano maior, o Admin deve usar a operação auditada com motivo. A migration não atribui um plano pago para compensar conteúdo anterior.

As contagens representam o momento da leitura; repetir o preflight imediatamente antes da implantação. O script imprime agregados e códigos sanitizados de tabelas indisponíveis. Uma tabela indisponível invalida a conclusão sobre seus dados.

## Migrations e integridade

Aplicar em ordem, após `20261002010000_admin_phase3_purge.sql`:

1. `supabase/migrations/20261003000000_owner_plans_and_limits.sql`: catálogo, entitlements, backfill de assinaturas, limites transacionais, proteção do upload, relacionamentos entre tenants e atribuição administrativa.
2. `supabase/migrations/20261003010000_owner_sessions_and_registration.sql`: sessões, quotas de autenticação, intenções de cadastro, provisionamento, retomada, revogação e manutenção.

O preflight SQL está em `supabase/preflight/20261003_owner_phase1_audit.sql`. As migrations abortam diante de relações inconsistentes entre tenants ou de assinatura com provider sem plano. Não tentam corrigir silenciosamente esses casos.

A constraint `businesses_owner_user_id_unique`, já introduzida na fundação Admin, continua garantindo um proprietário por estabelecimento. Cada novo business recebe uma assinatura Free por trigger. Uma constraint diferida impede que uma transação deixe um business sem assinatura; permite a purga autorizada de ambos na mesma transação.

Assinaturas existentes com plano são preservadas. Assinaturas sem plano e sem provider recebem Free. Businesses sem assinatura recebem Free/active, com provider nulo. Não há alteração de senha, eliminação de conteúdo ou revogação indiscriminada de sessões durante as migrations.

## Sessão BFF

```mermaid
sequenceDiagram
  participant A as Angular
  participant B as Node/BFF
  participant S as Supabase Auth
  participant D as PostgreSQL
  A->>B: POST /auth/login + Origin + credenciais
  B->>D: Reservar tentativas por e-mail e IP
  B->>S: signInWithPassword em cliente isolado
  S-->>B: Sessão Supabase
  B->>D: Salvar hash do cookie e tokens cifrados
  B-->>A: Cookie HttpOnly + conta + CSRF
  A->>B: Operação com cookie, Origin e X-CSRF-Token
  B->>D: Validar sessão, revogação e tenant
  B->>S: Validar usuário; renovar sob lease quando necessário
  B->>D: Executar operação com JWT do usuário e RLS
```

O cookie contém 32 bytes aleatórios em hexadecimal. O banco armazena somente seu SHA-256. Supabase access e refresh tokens ficam cifrados com AES-256-GCM; o hash da sessão é AAD, impedindo a troca de ciphertext entre sessões. A chave de 32 bytes fica apenas no ambiente do backend.

Produção usa `__Host-pc_owner_session`: HttpOnly, Secure, SameSite=Lax, Path=/ e sem Domain. Desenvolvimento usa `pc_owner_session`. Lax permite a navegação de links de e-mail; operações que alteram estado continuam exigindo Origin exata e CSRF. O BFF deve estar sob a origem da aplicação, por proxy `/api`, ou em implantação compatível com cookies do mesmo site. Não foi habilitado SameSite=None.

Sessões de proprietário têm validade absoluta de até 8 horas e inatividade máxima de 30 minutos. A recuperação tem scope `recovery` e validade absoluta de 15 minutos; não autoriza dashboard, `/me` ou operações de conteúdo. A UI exibe o endereço associado à recuperação antes da alteração da senha.

Um novo login gera outro cookie e revoga a sessão anterior apresentada pelo navegador. O token CSRF é um HMAC vinculado ao cookie e à chave do servidor, devolvido em JSON e mantido somente em memória. `/me` não o rotaciona a cada chamada, evitando invalidar abas concorrentes. Origin aceita apenas a allowlist do proprietário; o host do Admin não recebe autorização por estar na allowlist global de CORS. Cookies duplicados são rejeitados.

A renovação automática dos tokens Supabase usa uma lease no PostgreSQL, válida por 30 segundos. Apenas a instância que obtém a lease usa o refresh token. As demais aguardam uma atualização, sem reutilizar o token de refresh. Se a renovação não estiver pronta, a resposta é `SESSION_BUSY`/503. A conclusão verifica novamente expiração e revogação. O cookie permanece estável durante o refresh para evitar respostas concorrentes gravando cookies antigos.

Logout revoga a sessão BFF e pede signOut local no Auth. Logout-all revoga todas as sessões BFF, atualiza o cutoff administrativo e elimina as sessões Auth do usuário. A indisponibilidade do signOut externo não desfaz a revogação no banco. O cutoff também impede importar ou criar uma sessão com JWT emitido antes da revogação. Revogações administrativas existentes invalidam as novas sessões pelo mesmo cutoff.

## Proteções e limites de autenticação

- Login: até 10 tentativas por e-mail e 50 por IP a cada janela de 15 minutos, no banco.
- Cadastro: até 3 tentativas por e-mail e 10 por IP por hora, no banco.
- Recuperação/reenvio: até 4 por e-mail e 20 por IP por hora, no banco.
- Identificadores são HMACs; a tabela de tentativas não recebe IP ou e-mail em texto puro.
- Os limitadores Express existentes continuam protegendo borda/IP. As rotas de consulta e logout não compartilham a quota de tentativas de senha.
- Cadastro, login, recuperação, reenvio e importação exigem Origin. Operações autenticadas exigem CSRF e Origin; `Sec-Fetch-Site: cross-site` é rejeitado.
- DTOs de autenticação são estritos. `plan_id`, `businessId`, `source`, status e identidades administrativas enviados pelo navegador não conferem autoridade.
- A identidade Auth, e não o corpo da requisição, determina o tenant. Operações existentes conservam JWT do usuário no servidor e RLS no Postgres.
- Foreign keys compostas impedem vincular produto e categoria/subcategoria de tenants diferentes, inclusive quando a escrita ocorre fora do controller.
- Logs da aplicação registram códigos, request ID e grupo de rota. Não registram senha, cookie, CSRF, tokens ou query string de confirmação.

Origin é um controle de navegador: clientes HTTP externos conseguem escrever esse header. A autorização continua dependendo da senha ou sessão válida e do CSRF. HttpOnly reduz o roubo direto do cookie por JavaScript, mas não impede que um XSS executado na origem faça operações em nome da vítima. A CSP e a validação de conteúdo continuam necessárias.

## Cadastro e confirmação

O cadastro público recebe dados do proprietário e estabelecimento e `planCode`, cujo único valor concedido publicamente nesta fase é Free. Pedidos BASIC/MEDIUM/PRO retornam `PAID_PLAN_UNAVAILABLE`/409. Não há pagamento fictício, checkout ou bypass de produção.

`start_owner_registration` registra no servidor um UUID imprevisível, e-mail normalizado, plano selecionado, origem PUBLIC ou ADMIN_INVITE, dados de provisionamento, status e validade. PROMOTION existe como origem preparada, sem endpoint público de concessão. O navegador não escolhe um `selected_plan_id` autorizado.

Uma única intenção pendente por e-mail/identidade evita registros concorrentes. Uma identidade Auth existente não é vinculada a uma nova intenção por um pedido anônimo. Respostas para endereço existente e cadastro aceito usam o mesmo 202 e texto genérico.

O BFF usa `Supabase Auth.signUp`, nunca `email_confirm: true`. Se Auth devolver uma sessão imediata ou e-mail já confirmado para um novo cadastro, o fluxo falha fechado: a confirmação precisa estar habilitada. Convites utilizam o hash HMAC existente, são reservados para o endereço indicado e passam pela mesma confirmação de e-mail.

O callback verifica `token_hash` por `verifyOtp`, com tipo `email` ou `recovery` conforme a rota fixa. Não há token de confirmação próprio nem redirect escolhido pelo navegador. O redirecionamento vai para a primeira origem configurada do proprietário. A confirmação de cadastro não autentica automaticamente o Angular: o usuário entra com a senha depois.

`provision_owner_account` adquire lock por identidade e cria profile, business e assinatura Free em uma única transação, apenas após confirmação Auth. Consome o convite e conclui a intenção na mesma transação. Um segundo callback/transação retorna o business já criado. Uma intenção de outra identidade ou alterada para plano pago é rejeitada.

Link expirado ou já consumido redireciona para um estado seguro, sem criar outra conta. O usuário pode tentar login ou reenvio. Se a confirmação ocorreu mas a resposta/provisionamento foi interrompida, o login tenta retomar o RPC. Conflitos de slug e intenções expiradas podem ser concluídos por `/complete-registration` após login e prova de e-mail. A retomada também cobre falha temporária na vinculação de uma identidade Auth recém-criada à intenção original. Não apaga ou recria a identidade para resolver uma falha.

Se um convite expirar ou for revogado, ele não é consumido pela retomada. Um proprietário com e-mail verificado pode continuar pelo cadastro público Free, já que o produto admite cadastro público nesta fase. Cortesia paga permanece uma operação do Admin.

## Configuração obrigatória do e-mail

1. Habilitar **Confirm email** no Supabase Auth e configurar Site URL/redirect allowlist por ambiente.
2. Definir `OWNER_AUTH_CALLBACK_URL` com o callback HTTPS do BFF sob a origem da aplicação, por exemplo `https://app.exemplo.com/api/v1/auth/confirm-email`.
3. No template de confirmação de cadastro, usar o redirect do BFF e `TokenHash`:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}">Confirmar e-mail</a>
```

4. No template de recuperação, usar a mesma estrutura. A aplicação envia `RedirectTo` terminado em `/api/v1/auth/recover`, e o BFF fixa o tipo `recovery`.
5. Não usar neste fluxo a URL de confirmação padrão que redireciona tokens em fragmentos para o Angular. Não acrescentar access/refresh tokens a nenhuma URL da aplicação.
6. Validar envio, confirmação, reenvio e recuperação em staging com uma caixa postal real antes da implantação.

Esses templates seguem os campos documentados pelo [Supabase Auth](https://supabase.com/docs/guides/auth/auth-email-templates); a validação server-side utiliza [verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp). SMTP customizado pode ser configurado posteriormente no Supabase, com credenciais secretas e domínio de envio validado. Nenhum fornecedor SMTP foi escolhido ou instalado. Limites reais de entrega e política de senhas são os configurados no projeto Auth.

Proxy, CDN e plataforma de hospedagem também devem omitir ou mascarar query strings de confirmação em logs de acesso. O callback envia `Referrer-Policy: no-referrer` e `Cache-Control: no-store`.

## Planos, assinatura e entitlements

Os códigos FREE, BASIC, MEDIUM e PRO são estáveis. O nome de exibição continua separado no banco. Nenhum preço financeiro foi definido como autoridade.

| Entitlement | FREE | BASIC | MEDIUM | PRO |
| --- | ---: | ---: | ---: | ---: |
| MAX_PRODUCTS | 10 | 30 | 70 | 150 |
| MAX_CATEGORIES | 4 | 10 | 25 | 40 |
| MAX_VIDEOS | 1 | 7 | 25 | 40 |
| ANALYTICS_BASIC | false | true | true | true |
| ANALYTICS_ADVANCED | false | false | true | true |
| ANALYTICS_EXPORT | false | false | false | true |
| QR_GENERATOR | false | false | true | true |
| QR_CUSTOMIZATION | false | false | true | true |

`VIDEO_UPLOAD=true` integra o catálogo anterior com os quatro planos. Os limites MAX_* são inteiros não negativos. Novos códigos podem ser cadastrados em `plan_feature_definitions` e receber valores tipados em `plan_entitlements`.

`EntitlementService` centraliza `getEntitlements`, `canUse`, `getLimit`, `assertCanCreateProduct`, `assertCanCreateCategory` e `assertCanUploadVideo`. Usa um snapshot do banco, sem copiar a matriz paga para controllers. Pré-checagens de produto/categoria dão feedback; o trigger transacional é a autoridade final. Upload passa pelo RPC de reserva e pelo mesmo controle no banco, permitindo substituir o vídeo de um produto sem ocupar outro slot.

O Admin atribui plano através de `admin_assign_business_plan`, somente com identidade administrativa ativa, sessão administrativa recente e motivo de 3–500 caracteres. Plano, motivo, identidade e timestamp são registrados, e o audit log é inserido na mesma transação. Assinaturas já administradas por provider são rejeitadas para evitar sobrescrever estado de billing. Não há bypass público por ambiente.

Assinaturas suportam pending, trialing, active, past_due, grace, suspended e canceled. Free usa provider nulo. PUBLIC, ADMIN_GRANT, BILLING e LEGACY distinguem a origem da atribuição. O BillingProvider e os webhooks existentes permanecem preparados; nenhum gateway foi adicionado.

Elegibilidade administrativa, comercial e publicação continuam separadas. A suspensão administrativa bloqueia operações e publicação mesmo quando há cortesia comercial. `/me` permite mostrar a própria conta suspensa, sem liberar operações de conteúdo. Entitlements efetivos exigem conta ativa, plano ativo, estado comercial compatível e assinatura utilizável. A configuração existente de billing desabilitado continua controlando a elegibilidade comercial dos menus públicos.

## Concorrência, uso e downgrade

Todas as criações de produtos/categorias e mudanças de assinatura adquirem o mesmo advisory lock transacional por business. A contagem ocorre depois do lock dentro de funções VOLATILE. READ COMMITTED obtém a visão atual depois da espera; SERIALIZABLE exige repetição da transação se houver conflito. REPEATABLE READ é rejeitado nessas escritas para não usar uma contagem anterior ao lock.

Triggers protegem também inserts diretos por PostgREST e inserts com múltiplas linhas. Se uma linha ultrapassar a quota, a transação inteira é revertida. Não basta conferir o contador no Angular ou fazer SELECT e INSERT em requisições independentes.

Uso de produtos inclui todos os registros, mesmo indisponíveis. Categorias inativas também contam. Vídeos contam **produtos com slot ocupado** em waiting/uploading/processing/ready. Errored/rejected/pending_deletion não ocupam uma nova vaga. Um vídeo em substituição compartilha o slot do produto existente; os índices anteriores continuam impedindo mais de um ready e um pending por produto.

`reserve_video_upload` protege limites de plano antes de chamar Mux. Além do lock do tenant, há lock do hash de IP, mantendo quotas diárias, pendentes e por IP corretas entre uploads concorrentes. Reservas para contas sem elegibilidade ou sem VIDEO_UPLOAD são negadas. Processamento de uma reserva já aceita pode concluir após downgrade, preservando conteúdo existente.

Downgrade não remove registros. Novas vagas são bloqueadas enquanto o uso está no limite ou acima. A resposta é 409:

```json
{"success":false,"error":{"code":"LIMIT_EXCEEDED","message":"Limite do plano atingido.","metadata":{"resource":"products","used":13,"limit":10}}}
```

Metadata é limitada a resource/used/limit. `requiredPlan` não é calculado porque um upgrade pago público ainda não tem billing real. O erro não contém SQL, tenant IDs ou detalhes de infraestrutura.

## Endpoints desta fase

Todos abaixo estão sob `/api/v1`:

| Método e rota | Contrato principal |
| --- | --- |
| POST `/auth/login` | email/password; cookie + conta + csrfToken; Origin obrigatória |
| GET `/auth/me` | user, business, emailVerified, accountActive, provisioningRequired, plan, subscription, entitlements, usage, csrfToken |
| POST `/auth/logout` | cookie + Origin + CSRF; revoga sessão; 204 |
| POST `/auth/logout-all` | cookie + Origin + CSRF; revoga todas; 204 |
| POST `/auth/register` | email, password, fullName, businessName, slug, phone?, planCode?=FREE, invitationCode?; 202 genérico |
| POST `/auth/resend-confirmation` | email; Origin; 202 genérico |
| GET `/auth/confirm-email` | token_hash; intent_id opcional validado; redirect 303 para login |
| POST `/auth/forgot-password` | email; Origin; 202 genérico |
| GET `/auth/recover` | token_hash; cookie restrito de recuperação; redirect 303 |
| GET `/auth/recovery-session` | email e csrfToken; somente scope recovery |
| POST `/auth/reset-password` | password; recovery cookie + Origin + CSRF; revoga sessões; 204 |
| POST `/auth/complete-registration` | fullName, businessName, slug, phone?, planCode?=FREE; proprietário confirmado + CSRF |
| POST `/auth/migrate-session` | Authorization com JWT antigo, body vazio, Origin; janela explicitamente habilitada |
| POST `/admin/businesses/:id/plan` | planCode/reason; sessão Admin + CSRF + reautenticação recente |
| POST `/internal/operations/auth/maintain` | segredo interno existente; expira intenções e remove sessões/tentativas antigas |

`/me` não retorna token Supabase, ciphertext, cookie, hash de sessão ou provider subscription/customer IDs. As rotas antigas de conteúdo conservam seus contratos, mas agora a autenticação é por cookie.

## Transição e implantação

1. Repetir o inventário e executar o preflight SQL. Fazer snapshot/backup conforme a operação existente.
2. Validar todas as migrations em staging isolado e revisar o caso de conteúdo acima do Free. Não há necessidade de reset de senha para as contas inventariadas.
3. Preparar `OWNER_SESSION_ENCRYPTION_KEY`: 32 bytes criptograficamente aleatórios, codificados em base64. Guardar no secret manager do backend, com o mesmo valor em todas as instâncias. Nunca no frontend/Git. Chaves novas invalidam ciphertext antigo; rotação exige um plano próprio e não deve ser feita a cada deploy.
4. Configurar as origens HTTPS, callback, allowlist e templates Auth. Produção recusa inicializar sem os valores obrigatórios. `backend/.env.example` contém somente campos vazios/exemplos sem credenciais.
5. Se desejar preservar sessões antigas até o JWT expirar, habilitar `OWNER_LEGACY_TOKEN_ACCEPT_UNTIL` com um **cutoff ISO fixo**, no máximo 14 dias no futuro. Sem esse valor, importação fica fechada.
6. Aplicar as migrations na ordem indicada e publicar backend/frontend de forma coordenada. Abas com bundle antigo devem ser recarregadas, pois não enviam CSRF. Senhas e dados existentes são preservados.
7. O Angular consulta `/me`. Se houver um access token antigo e ainda não houver cookie, remove os registros antigos do storage e tenta importação uma única vez. Não envia refresh token. A sessão importada termina no menor prazo entre cutoff e expiração do JWT. Ela não renova esse JWT; login posterior cria uma sessão normal.
8. Quando a janela acabar, remover a variável de transição. A API de conteúdo não aceita bearer de proprietário em produção. O bearer de demonstração só existe em APP_MODE=demo fora de production, como no ambiente anterior.
9. Programar a manutenção interna de autenticação. Ela expira intenções, libera reservas de convites correspondentes ainda válidas e elimina tentativas antigas e sessões vencidas/revogadas há mais de 7 dias. Não apaga identidades ou conteúdo.

O frontend usa `/api/v1` na própria origem. A configuração de proxy Vercel existente precisa apontar para o backend do mesmo ambiente; o callback deve usar essa origem pública para o cookie permanecer no host correto.

## Arquivos de implementação

Novos arquivos:

- `backend/src/controllers/owner-auth.controller.ts`
- `backend/src/services/owner-session.service.ts`
- `backend/src/services/entitlement.service.ts`
- `backend/src/services/invitation-hash.service.ts`
- `backend/src/__tests__/owner-phase1-auth.test.ts`
- `backend/scripts/audit-owner-transition.mjs`
- `backend/scripts/test-owner-database.mjs`
- `backend/scripts/verify-owner-database.mjs`
- `frontend/src/app/services/owner-session-state.service.ts`
- `frontend/src/app/services/owner-session.interceptor.ts`
- `frontend/src/app/services/auth.service.spec.ts`
- `frontend/src/app/pages/login/account-access.component.ts`
- As duas migrations e o preflight SQL listados acima.

Arquivos existentes ajustados:

- `backend/.env.example`, `backend/package.json`, `backend/package-lock.json`
- `backend/src/config/deployment.config.ts`, `backend/src/server.ts`
- Controllers `admin-operations`, `category`, `item`, `customer-login` e `invitation-registration`; os dois últimos são exports de compatibilidade para o fluxo unificado.
- `backend/src/middleware/auth.middleware.ts`, `backend/src/repositories/product-media.repository.ts`
- Rotas `auth`, `admin` e `internal-operations`.
- Testes `security`, `admin-phase3-hardening` e `invitation-concurrency.integration`.
- `frontend/src/app/app.config.ts`, `app.routes.ts`, `guards/auth.guard.ts`
- Componentes de login, registro e dashboard.
- Services `auth`, `menu`, `design`, `video-upload`, `product-playback` e teste `video-upload.service.spec.ts`.
- `frontend/scripts/scan-build-secrets.mjs`, incluindo as novas chaves de sessão entre os padrões proibidos no build.
- README, índice e notas históricas de autenticação/cybersecurity/banco/contratos.

## Validação e alcance dos testes

Ambiente validado: Node 24.19.0, Angular 22, PostgreSQL 16.14 local.

| Gate | Resultado |
| --- | --- |
| Backend Jest | 107 aprovados; 1 integração Supabase externa opt-in não executada |
| Frontend | 37 aprovados |
| PostgreSQL real | 21 verificações aprovadas, incluindo toda a cadeia de migrations |
| Typecheck/backend build | Aprovados |
| Typecheck/frontend build | Aprovados; avisos anteriores de orçamento CSS |
| Scanner de build frontend | Aprovado em 10 arquivos |
| npm audit backend | Zero vulnerabilidades após atualizações compatíveis no lockfile |

Executar no backend `npm test -- --runInBand`, `npm run build`, `npm run test:database` e, com acesso ao projeto correto, `npm run audit:owner-transition`. No frontend, executar `npm test -- --watch=false`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build` e `npm run security:scan`.

O banco de teste é iniciado apenas em 127.0.0.1, com senha aleatória e diretório recém-criado dentro de `.tools`; é parado e removido no fim. Não lê `.env` nem recebe URL remota. Os binários são dependências de desenvolvimento e não fazem parte do runtime de produção. A implementação usa os [binários do embedded-postgres](https://github.com/leinelissen/embedded-postgres).

As verificações reais cobrem matriz, permissões e RLS, assinatura obrigatória, um proprietário/um business, quinto cadastro de categoria, décimo primeiro produto, dois inserts concorrentes em 9/10, insert em lote, segunda vaga de vídeo, uploads concorrentes pelo RPC usado pelo Mux, atribuição auditada, downgrade com 13 produtos preservados, tenant isolation, confirmação obrigatória, intenção adulterada, provisionamento concorrente idempotente, convite, retomada de vinculação interrompida, lease de refresh, cutoff de revogação e quota distribuída de tentativas.

Os testes HTTP do BFF substituem a comunicação com Supabase Auth por um provider de teste; exercitam login, rejeições, cookie, expiração, logout/logout-all, CSRF, Origin, rotação, recovery scope, redefinição de senha e callbacks. A transmissão SMTP, entrega de e-mail e semântica do Auth hospedado precisam da validação de staging descrita acima. Os scripts pgTAP históricos documentam o schema de cada fase anterior; o gate desta fase completa é `test:database`.

## Pendências operacionais e riscos residuais

- As migrations foram executadas no PostgreSQL local descartável; não foram aplicadas ao Supabase remoto.
- Configuração de chave de sessão, callbacks, allowlists e templates é obrigatória para ativação. SMTP/entrega real não foi validado nesta execução.
- O cookie é uma credencial bearer: seu roubo fora de JavaScript ainda permite replay até revogação/expiração. HttpOnly, TLS, rotação e revogação limitam esse risco; não foi criado fingerprint por IP que pudesse bloquear clientes móveis.
- A indisponibilidade do Auth/DB causa falha fechada. Não existe fallback para usuários de demonstração em produção.
- Locks foram validados com concorrência real; transações SERIALIZABLE/deadlocks devem ser repetidas pelo chamador quando aplicável. O PostgREST normal utiliza READ COMMITTED.
- O cadastro devolve mensagens genéricas e limita tentativas, mas não pretende tornar todos os tempos de resposta indistinguíveis.
- Os 13 produtos atuais permanecem no Free, com novas criações bloqueadas até uso abaixo do limite ou atribuição administrativa autorizada.

Esta fase termina na fundação e nos ajustes mínimos de autenticação. UI completa de planos, configurações, Analytics e QR permanece para as fases seguintes.
