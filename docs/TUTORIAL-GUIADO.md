# Tutorial guiado do painel PingoChef

## Arquitetura e arquivos

O guia acompanha o painel existente em `/dashboard`. As áreas são selecionadas por
`activeSection`, não por rotas independentes. Não há dependência externa nova.

- `frontend/src/app/pages/dashboard/tutorial/tutorial.steps.ts`: roteiro, seletores,
  seção, condições por permissão, pose do mascote e preparação de cada passo.
- `tutorial.service.ts`: estado por instância do painel, leitura server-side,
  comandos serializados, avanço, retorno, retomada e encerramento.
- `tutorial-overlay.component.{ts,html,css}`: recorte SVG, borda dourada, diálogo,
  confirmação de saída, acompanhamento do DOM e acessibilidade.
- `tutorial-layout.ts`: escolha de posicionamento conforme espaço disponível.
- `tutorial-mascot.component.ts`: reutiliza os quatro WebPs reais.
- `dashboard.component.ts`: integração, carregamento adiado do overlay, bloqueio
  do fundo e preparo das seções, navegação móvel, subcategorias e preview.
- Sidebar, topbar e seções: apenas âncoras `data-tour` nos controles existentes.
- `components/settings/settings.component.{ts,html,css}`: entrada dourada Tutorial
  em Configurações → Conta.
- `backend/src/controllers/tutorial.controller.ts` e `routes/business.routes.ts`:
  leitura e atualização autorizadas do progresso.
- `supabase/migrations/20261018000000_owner_tutorial.sql` e `manifest.json`:
  migração aditiva no perfil existente.
- Testes: `tutorial.service.spec.ts`, `frontend/e2e/tutorial.spec.ts`,
  `backend/src/__tests__/tutorial.test.ts`, `backend/scripts/verify-owner-tutorial.mjs`.

O overlay é carregado com `@defer`, após a autenticação e a carga essencial do
painel. Os assets são solicitados conforme a pose exibida.

## Roteiro final

| ID | Conteúdo | Âncora / preparação |
|---|---|---|
| welcome | Boas-vindas e possibilidade de rever o guia | Sem spotlight |
| home | Estado, plano, saúde, desempenho e atalhos | `home` |
| company-nav | Localização de Empresa | `nav-empresa`; abre sidebar móvel |
| company | Identidade e entrada do estabelecimento | `company` |
| company-save | Salvamento próprio e diferença entre descrições | `company-save` |
| categories | Organização, ícone, imagem e apresentação | `new-category` |
| subcategories | Subdivisões opcionais | `subcategories`, somente havendo categoria |
| products | Cadastro, preço, foto e destaques | `new-product` |
| videos | Produto salvo, formatos, limites e processamento | Explicativo, somente com permissão |
| design-nav | Localização de Design | `nav-design`; abre sidebar móvel |
| design | Template, cores, fontes, blocos, apresentação e banners | `design` |
| design-save | Salvar ou descartar o design em edição | `design-save` |
| preview | Conferência do resultado | `preview-desktop` ou `preview-mobile` |
| resources | Curtidas e carrinho consultivo | `resources`; abre `resources-panel` |
| publish | Significado correto da publicação | `publish-menu` |
| link | Copiar e compartilhar endereço | `menu-link` |
| qr | Criar, salvar, baixar e testar QR | `qr`, conforme permissão |
| analytics | Métricas disponíveis no plano | `analytics`, conforme permissão |
| finish | Conclusão e caminho para rever | Sem spotlight |

São até 19 passos, com total recalculado pelas permissões da conta. A sidebar
recebe `nav-<section>` em seus itens. `restart-tutorial` identifica a entrada nas
configurações. Não há âncora nem explicação para a busca ainda não funcional.

## Planos e conta vazia

- QR depende de `QR_GENERATOR`.
- Analytics depende de `ANALYTICS_BASIC` ou `ANALYTICS_ADVANCED`.
- Vídeos dependem de `VIDEO_UPLOAD` e `MAX_VIDEOS > 0`.
- Não são inferidas permissões apenas pelo nome comercial do plano.
- Sem categorias, o passo de subcategorias é explicativo. Havendo categoria,
  seleciona-se a primeira apenas no estado da interface, sem gravar dados.
- Vídeos são explicados sem abrir o editor, mesmo em contas com produtos. Isso
  mantém o guia seguro e funcional em contas vazias e evita uploads involuntários.
- Analytics e QR podem abrir suas áreas para leitura; nenhuma geração é executada.

## Persistência e comportamento

O perfil autenticado é a autoridade. Não há dependência de localStorage para
decidir se o tutorial deve aparecer.

`GET /api/v1/business/tutorial` consulta o progresso.
`PATCH /api/v1/business/tutorial` aceita somente `{ action, step, version: 1 }`.
As ações são `start`, `restart`, `progress`, `skip` e `complete`.

Campos aditivos em `profiles`: `tutorial_status`, `tutorial_version`,
`tutorial_step`, `tutorial_started_at` e `tutorial_finished_at`.

- NOT_STARTED: inicia depois de carregar os dados essenciais do painel.
- IN_PROGRESS: retoma o passo salvo e informa que está continuando o guia.
- COMPLETED e SKIPPED: não reabrem automaticamente.
- Pular exige confirmação dentro do diálogo.
- Tutorial nas configurações envia `restart`, começando nas boas-vindas.
- Versão nova não apaga automaticamente a conclusão anterior.
- Usuários já existentes que nunca receberam o recurso também têm NOT_STARTED
  após a migração; verão o guia no primeiro acesso posterior à disponibilização.
- A API deriva a identidade exclusivamente da sessão autenticada e mantém o
  middleware de autorização, cookies, CSRF e limites já existentes.
- Escritas atrasadas de progresso não reabrem um tutorial já concluído/pulado.
- Falha de leitura não bloqueia a Home. Falha ao salvar avanço mantém o passo e
  permite tentar novamente. Não há fallback local fingindo persistência.
- Somente no modo demo explícito do backend, o progresso fica em memória.

Antes de disponibilizar em produção, aplicar a migração pelo processo normal do
projeto e publicar backend e frontend compatíveis. A implementação e os testes
nesta tarefa não aplicam mudanças em banco remoto.

## Posicionamento e mobile

O spotlight usa `getBoundingClientRect`, `ResizeObserver`, eventos de scroll em
captura, resize e `visualViewport`. Não usa coordenadas fixas dos controles.
O diálogo escolhe posições inferiores, superiores ou laterais por espaço livre.
Em telas até 768 px, usa uma folha inferior compacta com safe-area.

O painel móvel de navegação é aberto nos passos que explicam seus itens. A partir
do breakpoint real do preview, o guia destaca o botão de celular, sem depender da
coluna oculta. Resize durante o guia refaz a seleção de âncoras quando necessário.

Alvos fora da área visível são rolados para a tela. No mobile, o contêiner existente
é ajustado para deixar o alvo acima do diálogo. O recorte respeita os contêineres
de scroll. Se uma âncora não aparecer em até 1,8 segundo, o guia continua como um
passo explicativo central/inferior e registra apenas seu ID em desenvolvimento.

Enquanto o guia móvel está aberto, uma reserva inferior temporária permite rolar
até os controles mesmo em uma conta vazia. A barra de salvar Design também sobe
acima do diálogo no seu passo. Ao sair, espaçamento e posição voltam ao normal.
O botão de prévia acompanha o breakpoint de 1100 px da coluna do painel.

## Mascote, animação e acessibilidade

Usa cópias dos assets originais em `frontend/public/assets/mascots/tutorial/`:
`pingo-chef-tutorial-animation-1.webp` a `4.webp`. Não há redesenho do mascote.
As poses variam entre boas-vindas, explicação, orientação e conclusão. O mascote
tem movimento discreto de 3 px; fade e transições duram cerca de 180–220 ms.
`prefers-reduced-motion` desativa as animações e usa rolagem imediata.

O diálogo usa `role="dialog"`, `aria-modal`, título e descrição associados,
progresso acessível, foco visível, foco contido e fundo `inert`. Escape abre a
confirmação para pular; setas navegam os passos. A saída devolve o foco ao botão
visível de publicação, sem acioná-lo. Todos os passos são de leitura: mouse e
teclado não podem executar comandos do painel durante o guia.

## Validação

- Build TypeScript do backend e builds Angular de desenvolvimento e produção.
  O overlay é um chunk adiado de aproximadamente 18 KB (5,5 KB de transferência
  estimada). O build mantém avisos de orçamento dos estilos já existentes do
  cardápio público e do editor de Design, sem erro de compilação.
- 7 testes HTTP do backend: autenticação, validação, isolamento, retomada,
  estados terminais, reinício e indisponibilidade do armazenamento.
- 17 testes unitários frontend: início, conclusão/skip, retomada, avanço/retorno,
  permissões, conta vazia, falha de gravação e posicionamento nas sete larguras.
  Inclui uma regressão para o diálogo estreitar sem sobrepor a Home em 1280 px.
- 14 testes backend aprovados na execução combinada do tutorial e da regressão
  dos fluxos existentes de design/publicação; 7 são específicos do tutorial.
- PostgreSQL 16 temporário: cadeia completa de migrações, defaults, persistência,
  constraints e isolamento por RLS entre perfis, além dos checks existentes.
- Playwright: fluxo completo, conta vazia/preenchida, larguras 1440, 1280, 1024,
  768, 430, 390 e 360; reinício, confirmação, teclado, refresh, alvo ausente,
  accordion, navegação móvel, preview e ausência de operações comerciais reais.
  Os resultados de execução e capturas ficam em `frontend/test-results/`.
  A validação consolidada aprovou 18 cenários E2E únicos, incluindo a repetição
  dirigida de 1280 px após o ajuste e a restauração do preview recolhido. As
  larguras duplicadas no projeto de emulação móvel são puladas; 390 px e os
  fluxos de interação também são executados com o perfil móvel do Chromium.

Comandos de validação, nos respectivos diretórios:

```text
backend:  npm run build
backend:  npm test -- --runInBand tutorial.test.ts design-settings.test.ts
backend:  npm run test:database
frontend: npm run build
frontend: npm test -- --watch=false --include="src/app/pages/dashboard/tutorial/*.spec.ts"
frontend: npx playwright test e2e/tutorial.spec.ts
```

## Adaptações ao painel real

- A navegação usa as seções locais da rota `/dashboard`.
- A tela inicial tem atalhos que levam a Menu, sem abrir diretamente formulários.
- Os destaques dos produtos são classificações do estabelecimento; +Curtidos
  não é apresentado como contador de curtidas dos clientes.
- O carrinho não envia pedidos. Essa limitação é explicada no guia.
- Empresa e Design têm descrições e salvamentos distintos.
- Publicar não é tratado como isolamento universal de rascunhos: cadastros já
  salvos podem refletir em um cardápio publicado.
- O título final conclui o aprendizado; nenhuma categoria/produto/publicação é
  criada pelo tutorial.
