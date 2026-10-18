import type { ActiveSection } from '../components/sidebar/sidebar.component';

export interface TutorialContext { qr: boolean; analytics: boolean; video: boolean; categories: boolean; mobile: boolean }
export interface TutorialStep {
  id: string;
  section: ActiveSection;
  target?: string | ((context: TutorialContext) => string | undefined);
  title: string;
  description: string;
  note?: string;
  mascot: 1 | 2 | 3 | 4;
  placement?: 'bottom' | 'top' | 'right' | 'left';
  prepare?: 'navigation' | 'subcategory' | 'preview' | 'resources';
  condition?: (context: TutorialContext) => boolean;
}
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: 'welcome', section: 'dashboard', title: 'Bem-vindo ao PingoChef! 👋', mascot: 1,
    description: 'Vou te mostrar como criar, personalizar e publicar seu cardápio. Um passo de cada vez, do seu jeito.',
    note: 'Você pode pular agora e rever o guia em Configurações → Conta → Tutorial.' },
  { id: 'home', section: 'dashboard', target: 'home', title: 'Tudo começa por aqui', mascot: 2,
    description: 'No Início você acompanha o estado do cardápio, uso do plano, saúde, desempenho disponível e próximos passos. Os atalhos Criar produto e Criar categoria levam à seção Menu.' },
  { id: 'company-nav', section: 'dashboard', target: 'nav-empresa', prepare: 'navigation', placement: 'right',
    title: 'Primeiro, a sua marca', mascot: 2, description: 'Empresa reúne a identidade do estabelecimento. No próximo passo, vamos conhecer essa área.' },
  { id: 'company', section: 'empresa', target: 'company', title: 'Apresente seu estabelecimento', mascot: 2,
    description: 'Configure logo, nome, endereço público, descrição do negócio e o fundo da página de entrada. Um endereço fácil de lembrar ajuda a compartilhar seu cardápio.' },
  { id: 'company-save', section: 'empresa', target: 'company-save', title: 'Salve os dados da empresa', mascot: 3,
    description: 'Depois de editar, use Salvar e Sincronizar. A descrição do negócio fica nesta área; a mensagem de apresentação do início é configurada separadamente em Design.',
    note: 'Durante o guia, vamos apenas conhecer os controles. Nenhum dado será salvo automaticamente.' },
  { id: 'categories', section: 'menu', target: 'new-category', title: 'Organize por categorias', mascot: 2,
    description: 'Comece em Nova Categoria. Escolha um nome, ícone do catálogo ou imagem e o formato de exibição. Depois salve para organizar seus produtos em grupos.' },
  { id: 'subcategories', section: 'menu', prepare: 'subcategory', target: ctx => ctx.categories ? 'subcategories' : undefined,
    title: 'Um pouco mais de organização', mascot: 2,
    description: 'Depois de criar e selecionar uma categoria, você pode adicionar subcategorias como Tradicionais, Especiais ou Combos. Também pode renomear e ordenar esses grupos.' },
  { id: 'products', section: 'menu', target: 'new-product', title: 'Dê vida ao seu cardápio', mascot: 2,
    description: 'Em Novo Produto, cadastre nome, descrição, preço, foto, categoria e subcategoria. Há preço promocional e destaques: Padrão, Promoção, +Curtidos, Prato Chefe, Combo e Mais Vendido. Após salvar, você também pode pausar a disponibilidade.',
    note: 'Os destaques são classificações escolhidas por você. +Curtidos não é o contador real de curtidas dos clientes.' },
  { id: 'videos', section: 'menu', condition: ctx => ctx.video, title: 'Seu produto em movimento', mascot: 3,
    description: 'Crie e salve o produto primeiro. Depois, abra Editar para adicionar um vídeo MP4, MOV ou WebM de até 15 segundos e 50 MB. Escolha horizontal 16:9 ou vertical 9:16.',
    note: 'Aguarde o processamento terminar antes de publicar. Vídeos são opcionais e seguem os limites do plano.' },
  { id: 'design-nav', section: 'menu', target: 'nav-design', prepare: 'navigation', placement: 'right', title: 'Agora, o visual', mascot: 2,
    description: 'Design reúne as opções para deixar o cardápio com a identidade da sua marca. Vamos conhecer os principais grupos.' },
  { id: 'design', section: 'design', target: 'design', title: 'Personalize cada detalhe', mascot: 2,
    description: 'Explore Estrutura & Template, Paleta de Cores, Tipografia, Blocos da Página, Ícones da Página Inicial, Recursos, Descrição de Apresentação e Banners. Abra cada grupo para configurar e acompanhe o resultado na prévia.' },
  { id: 'design-save', section: 'design', target: 'design-save', title: 'Guarde suas escolhas', mascot: 3,
    description: 'As mudanças de Design ficam em edição até você salvá-las. Salvar Alterações grava a configuração; Descartar volta ao último estado salvo.' },
  { id: 'preview', section: 'design', prepare: 'preview', target: ctx => ctx.mobile ? 'preview-mobile' : 'preview-desktop', placement: 'left',
    title: 'Veja com os olhos do cliente', mascot: 2,
    description: 'Use o Preview ao Vivo para conferir como o cardápio ficará para seus clientes. Em telas menores, o botão com ícone de celular abre a prévia.' },
  { id: 'resources', section: 'design', target: 'resources', prepare: 'resources', title: 'Escolha a experiência', mascot: 3,
    description: 'Curtidas permitem a interação real dos consumidores. O carrinho ajuda a selecionar produtos, quantidades e consultar o total.',
    note: 'O carrinho funciona como uma lista de intenção: ele não envia pedidos ao estabelecimento.' },
  { id: 'publish', section: 'design', target: 'publish-menu', title: 'Pronto para publicar?', mascot: 3,
    description: 'Publicar salva o design atual, publica as mídias prontas e coloca o cardápio online. É a conclusão da configuração inicial.',
    note: 'Empresa, categorias e produtos têm salvamentos próprios. Em um cardápio já publicado, alterações salvas podem refletir no público. Este guia não executa a publicação.' },
  { id: 'link', section: 'dashboard', target: 'menu-link', title: 'Compartilhe seu endereço', mascot: 2,
    description: 'Depois de publicar, compartilhe o endereço com seus clientes. Copiar link leva o endereço para a área de transferência; Abrir cardápio permite conferir a versão pública.' },
  { id: 'qr', section: 'qr', target: 'qr', condition: ctx => ctx.qr, title: 'Seu cardápio em cada mesa', mascot: 2,
    description: 'Crie um QR Code, personalize conforme o plano, salve, baixe em PNG ou SVG e teste a leitura no celular antes de imprimir.',
    note: 'A prévia e os downloads representam a versão salva. Atualize as mudanças antes de baixar. O cardápio precisa estar publicado para o QR funcionar publicamente.' },
  { id: 'analytics', section: 'analytics', target: 'analytics', condition: ctx => ctx.analytics,
    title: 'Aprenda com seus clientes', mascot: 3,
    description: 'Acompanhe acessos, visitantes, produtos, curtidas, vídeos e as métricas disponíveis no seu plano. Escolha um período e aplique filtros para entender o interesse pelo cardápio.' },
  { id: 'finish', section: 'dashboard', title: 'Seu PingoChef está pronto! 🎉', mascot: 4,
    description: 'Agora você já sabe criar, personalizar, publicar e acompanhar seu cardápio. Vamos colocar essas ideias em prática?',
    note: 'Você pode rever este guia a qualquer momento em Configurações → Conta → Tutorial.' },
];
