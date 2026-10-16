# Início — centro de controle do cardápio

A alteração visual fica dentro de `dashboard-home`. Sidebar, topbar, navegação,
rotas e preview lateral permanecem sob responsabilidade da estrutura existente.
Não foi necessário alterar banco, backend, endpoints ou planos.

## Arquivos e reutilização

- `frontend/src/app/pages/dashboard/sections/dashboard-home/dashboard-home.component.ts`:
  estado derivado com `computed`, cálculo de saúde, prioridades e resumo de desempenho.
- `dashboard-home.component.html` e `dashboard-home.component.css`: template e estilos
  extraídos do componente para manutenção, sem criar componentes para cada card.
- `frontend/src/app/components/plan-usage/plan-usage.component.ts`: componente existente
  reutilizado com uma variante optativa `compact`. A tela de configurações continua
  usando a variante original. Na variante da Home, limites ausentes e recursos não
  incluídos ganham estados explícitos, sem divisão por zero.
- `frontend/src/app/pages/dashboard/dashboard.component.ts`: somente ligação dos inputs
  de carregamento/erro à Home, aproveitando as requisições iniciais já existentes.
- Dois WebPs oficiais copiados de `img/animations` para
  `frontend/public/assets/mascots/home`, preservando os arquivos originais.
- Testes em `dashboard-home.component.spec.ts` e `frontend/e2e/dashboard-home.spec.ts`.
- `plan-usage.component.spec.ts` comprova a preservação da variante original e os
  estados de limite da Home. O teste existente `dashboard-loading.spec.ts` somente
  recebeu isolamento das fontes externas e tolerância para o bootstrap do servidor
  local; as verificações de quantidade, conteúdo e paralelismo das requisições foram
  mantidas.

Reutilizados: `AuthService`, `MenuService`, `CommercialService`, `AnalyticsService`,
`PlanUsageComponent`, `buildPublicMenuUrl`, eventos de navegação do painel, loader
global e ícones da dependência já instalada `@lucide/angular`.

## Dados reais

| Bloco                 | Origem                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Boas-vindas           | `AuthService.currentBusiness().name`, com fallback Pingo Chefinho                                                           |
| Plano, limites e uso  | `account.plan`, `account.entitlements.MAX_*`, `account.usage`                                                               |
| Produtos e categorias | Signals `MenuService.items` e `MenuService.categories`, já carregados pelo painel                                           |
| Produtos com vídeo    | Produtos cujo array `media` contém `mediaType: video`; não confundir com reproduções ou número de arquivos                  |
| Publicação            | `account.isPublished`                                                                                                       |
| Desempenho            | Uma chamada ao endpoint existente `GET /analytics`, somente com entitlement de Analytics e depois do carregamento essencial |
| Saúde                 | Configuração existente da conta, produtos, fotos e descrições                                                               |
| Próxima ação          | Dados da empresa, categorias, produtos, cobertura de fotos/descrições, publicação, design e entitlement de QR               |
| Primeiros passos      | Nome e logo da empresa, categorias, produtos, `onboarding.designConfigured`, publicação                                     |
| Link público          | Slug atual e helper existente `buildPublicMenuUrl`                                                                          |

O endpoint de Analytics já define os últimos sete dias no fuso configurado. A Home
mostra o intervalo e fuso retornados, sem outra chamada de opções ou comparação.
Quando `qrEntries` não existe no plano Basic, o segundo indicador mostra visitantes.
No Free, mostra disponibilidade a partir do Basic, sem métricas fictícias. Falhas
de Analytics apresentam retry independente; falhas no catálogo escondem o resumo
para não representar indisponibilidade como uma conta vazia.

## Saúde e prioridades

Oito critérios têm o mesmo peso: nome da empresa, logo, existência de categoria,
existência de produto, design configurado, publicação, cobertura de fotos e
cobertura de descrições. Os dois últimos são frações entre 0 e 1; catálogo vazio
tem cobertura zero. Pontuação = `round((seis checks + duas coberturas) / 8 * 100)`.
Vídeos são opcionais e não reduzem a pontuação. A interface explica o cálculo em
“Como calculamos?”. A lista de saúde tem quatro itens.

Prioridades da próxima ação: completar empresa/logo/slug → criar categoria → criar
produto → fotos ausentes → descrições ausentes → revisar e publicar → personalizar
design → divulgar QR quando disponível, ou revisar o menu. Os CTAs usam as seções
existentes; publicação passa pela revisão existente, preservando seu fluxo.

Primeiros passos mostra até quatro pendências por padrão e permite expandir as
seis etapas. Ao concluir, a lista começa recolhida e o card assume estado de sucesso.

## Responsividade e movimento

A Home respeita os breakpoints globais existentes (640 e 1024px) e usa container
queries locais para adaptar os cards à largura real entre sidebar e preview. Por
isso, uma viewport desktop com preview aberto pode ter KPIs em 2×2: quatro colunas
só aparecem quando há espaço para legibilidade. Desempenho e saúde empilham quando
o canvas fica estreito. Em celulares: três KPIs, hero com texto separado da segunda
pose, plano vertical com uma barra por linha, CTA amplo e atalhos em 2×2.

O mascote original com cloche e frase aparece em desktop; a segunda pose aparece
abaixo de 640px via `picture`, sem carregar os dois arquivos simultaneamente.
Dimensões e proporções são reservadas, com `object-fit: contain`.

Entrada única do mascote: 550ms, opacidade, deslocamento de 12px e escala de 0,97
a 1. Cards clicáveis sobem 2px no hover; botões têm feedback de pressão e foco.
Não há movimento contínuo do mascote. `prefers-reduced-motion: reduce` remove
animações, transições e transformações de interação da Home.

## Adaptações da referência

- Números, percentuais e crescimentos ilustrativos não foram reproduzidos.
- Contagem de produtos com vídeo substitui reproduções no KPI de catálogo, evitando
  repetir as reproduções já presentes no resumo de desempenho.
- A frase faz parte do asset desktop; não foi redesenhada nem duplicada em texto.
- Miniaturas da próxima ação usam somente fotos reais dos produtos existentes.
- Não foi criado seletor de período: a Home usa o resumo fixo de sete dias.
- Links “Criar produto” e “Criar categoria” abrem o editor Menu já existente,
  preservando o contrato atual de navegação por seção.

## Validação

Os testes de unidade cobrem cálculo proporcional, catálogo vazio, atualizações dos
signals, vídeos opcionais, prioridades, fallback de QR e retry de Analytics.
O Playwright cobre 1440, 1280, 1024, 768, 430, 390 e 360px, temas claro/escuro,
reduced-motion, requests sem duplicar o bootstrap, planos, erros e navegação.
As APIs são interceptadas com fixtures; não há gravações em contas reais.
Fontes externas são isoladas nos testes novos para evitar dependência de rede.

Resultados de compilação e unidade:

- Typecheck Angular: `npm exec -- ngc -p tsconfig.app.json --noEmit` — aprovado.
- Oito testes de unidade em dois arquivos — aprovados.
- Vinte e duas verificações Playwright — aprovadas: dez cenários da Home por perfil
  (desktop e mobile) e a auditoria de carregamento existente nos dois perfis. A
  auditoria mantém exatamente quatro requisições de bootstrap no Free, sem Analytics
  ou segunda consulta à sessão. Esse ensaio usa latência simulada, não mede produção.
- `npm run build` — aprovado, sem erros da Home. Permanecem os avisos de orçamento
  de CSS de `public-menu-view` (36,26 kB) e `design-editor` (27,89 kB), fora do escopo.
- Capturas de desktop, mobile e temas em `.tools/home-*.png`; os testes usam fixtures,
  portanto as capturas não representam o conteúdo de uma conta de produção.
