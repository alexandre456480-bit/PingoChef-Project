# PingoChef Admin: painel e analytics

## Estado e implantação

O Admin Angular usa rotas `/admin/*` e API relativa `/api/v1/admin`. Em produção, publique a mesma aplicação em `admin.pingochef.com` e mantenha o rewrite `/api/*` para a API. A sessão Admin é um cookie `HttpOnly`, `SameSite=Strict` e `Secure` em produção; o token CSRF fica apenas na memória da página. O backend valida origem, CSRF, sessão e identidade administrativa. O login do cliente ainda usa armazenamento local no navegador; sua migração é uma dívida técnica separada.

Aplicar `supabase/migrations/20261001000000_admin_dashboard_analytics.sql` **depois** das migrations 20260930000000 e 20260930010000, antes de publicar backend e frontend desta fase. Validar em banco descartável com `supabase/tests/admin_dashboard_security.test.sql`. A migration cria consultas agregadas, índices, publicação explícita e corte de sessões do cliente. Ela preserva o estado de publicação das contas existentes e define novas contas como não publicadas. A publicação é feita pelo endpoint de cliente `POST /api/v1/business/publish` após salvar o cardápio e exige ao menos um produto.

`ADMIN_ORIGINS` deve conter a origem exata `https://admin.pingochef.com` em produção. Desenvolvimento usa `http://localhost:4300`; staging usa sua origem separada. Não usar wildcard. A aplicação Admin deve servir `/admin/*` com fallback para `index.html` e encaminhar `/api/*` à API. Execute um login e uma consulta autenticada no domínio final antes de liberar a operação.

## Páginas e componentes

| Rota | Conteúdo |
| --- | --- |
| `/admin/login` | Login administrativo separado |
| `/admin/overview` | KPIs, gráficos e atenção necessária |
| `/admin/clients` | Tabela paginada, busca, filtros e CSV da página |
| `/admin/clients/:id` | Visão geral, cardápio, uso, assinatura, atividade e ações auditadas |
| `/admin/invites` | Criação, código exibido uma vez, lista e revogação |
| `/admin/analytics` | Aquisição, engajamento, funil, tempos, templates e mídia |
| `/admin/subscriptions` | Status comerciais, sem valores financeiros presumidos |
| `/admin/usage`, `/admin/videos`, `/admin/storage` | Uso agregado e inventário de mídia |
| `/admin/security`, `/admin/audit`, `/admin/settings` | Controles, registros e políticas de operação |

O shell possui sidebar persistente em desktop e menu adaptado a tablet/mobile. `AdminFilterComponent` controla período, fuso, comparação e granularidade. `AdminChartComponent` oferece gráfico simples e tabela acessível. `AdminApiService` concentra chamadas com cookie e CSRF, sem reutilizar o token do cliente.

## Filtros e interpretação

Presets: hoje, ontem, últimos 7/30 dias, mês atual/anterior, últimos 3/6 meses, ano atual/anterior. Também há dia, mês, ano e intervalo personalizados. Os filtros usam intervalos semiabertos `[from, to)` em ISO UTC, com fronteiras calculadas no fuso selecionado. Preset, datas, fuso, comparação e granularidade vão para a URL. Horas: até 2 dias; dias: até 90 dias; períodos longos usam semanas/meses/anos. A API limita a janela a 730 dias. Comparação oferece período anterior ou mesmas datas no ano anterior; a comparação de clientes novos é feita por `businesses.created_at`.

| Métrica | Definição e fonte |
| --- | --- |
| Clientes totais, ativos e suspensos | Contagem atual de `businesses` e `business_account_state.lifecycle_status`. “Ativo” aqui é estado administrativo, não atividade de uso. |
| Novos clientes | Businesses criados no período (`businesses.created_at`). |
| Cardápios publicados | Estado `business_account_state.is_published=true`, mesmo que a conta esteja suspensa. A elegibilidade pública continua exigindo estado administrativo, comercial e publicação. |
| Produtos | Linhas de `menu_items`; criações usam `created_at`. |
| Imagens vinculadas | Mídias de imagem `ready` mais imagens legadas em produtos sem uma mídia `ready`. Imagens adicionadas no período contam apenas `product_media` `ready` criada no intervalo. |
| Vídeos prontos | `product_media` tipo vídeo e status `ready`. Vídeos adicionados usam criação no intervalo. |
| Clientes ativos 7d/30d | Businesses distintos com evento `LOGIN` do proprietário nas janelas móveis de 7/30 dias; não significa uso de todas as funções. |
| Publicações | Primeiro evento `MENU_PUBLISHED` por business no intervalo, via ação explícita de publicar. Contas antigas já publicadas podem não ter evento histórico. |
| Funil | Coorte de businesses criada no período. Cada etapa exige o marco anterior: configuração (`BUSINESS_CONFIGURED`), categoria, produto, design e publicação. Eventos anteriores à instrumentação podem deixar a contagem abaixo da atividade real. |
| Convite → cadastro | Média de `customer_invitations.consumed_at - created_at` para convites consumidos no período. |
| Cadastro → publicação | Média de `MENU_PUBLISHED.occurred_at - businesses.created_at` para primeiras publicações no período. |
| Templates | Distribuição atual de `design_settings.template_id`, não uma métrica temporal. |
| Grace e status de assinatura | Estado atual de `subscriptions`; billing real ainda não está habilitado. |
| Webhooks falhando | `mux_webhook_events` em status `failed` com `updated_at` no período. |
| Uploads rejeitados | `product_media` em status `rejected` com `updated_at` no período. |
| Tentativas de login Admin | Registros de `admin_login_attempts.occurred_at` no período; não equivale a contas comprometidas. |

MRR, receita, custo monetário, bytes de armazenamento e reproduções de vídeo não são exibidos como zero: ainda não há fonte confiável instrumentada. O inventário de mídia da página Vídeos/Storage respeita o intervalo selecionado; seu KPI de total é um snapshot atual.

## Endpoints e proteção

`GET /api/v1/admin/dashboard` chama `admin_dashboard_report` em uma consulta agregada; `GET /api/v1/admin/businesses` chama `admin_business_list` com paginação no servidor. Detalhe, convites, auditoria e mídia usam `/businesses/:id`, `/invites`, `/audit-logs` e `/media`. A busca de clientes tem debounce, e mudanças rápidas de filtro cancelam a requisição anterior no frontend. A exportação CSV contém apenas a página filtrada visível, sem segredos; células de texto são protegidas contra fórmulas de planilha.

No detalhe, `POST /businesses/:id/suspend`, `/reactivate`, `/free-period`, `/revoke-sessions`, `/schedule-deletion` e `/cancel-deletion` passam por autorização Admin. Ações sensíveis exigem reautenticação recente no backend; agendamento de exclusão e revogação de sessões também exigem digitar o UUID exato. O RPC de revogação marca `sessions_revoked_at`, remove `auth.sessions` e grava auditoria; JWTs de cliente anteriores ao corte são recusados na API e nas políticas de dados que usam `business_is_account_active`. Dados de perfil do Supabase fora dessa política ainda dependem do vencimento natural do JWT; trate essa limitação ao revisar a autenticação do cliente.

## Verificação

Execute `npm test -- --runInBand` e `npm run build` em `backend/`; `npm test -- --watch=false`, `npx ngc -p tsconfig.app.json --noEmit`, `npm run build`, `npm run security:scan` e `npx playwright test e2e/admin-dashboard-responsive.spec.ts` em `frontend/`. O teste visual usa respostas simuladas da API e verifica desktop (1440px), tablet (768px) e mobile (390px). Ele não substitui um teste de integração com o Supabase real. Teste o SQL em banco descartável antes da aplicação no projeto de produção.
