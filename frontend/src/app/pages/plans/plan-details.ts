export interface PlanDetail {
  tagline: string;
  title: string;
  description: string;
  art: string;
  label: string;
  highlights: { icon: string; title: string; description: string }[];
}
export const PLAN_DETAILS: Record<string, PlanDetail> = {
  FREE: {
    tagline: 'Seu primeiro cardápio online', title: 'Sua identidade começa aqui.',
    description: 'Organize os produtos, escolha suas cores e publique um cardápio com a cara do seu negócio.', art: 'palette', label: 'Personalização incluída',
    highlights: [
      { icon: 'palette', title: 'Sua marca em destaque', description: 'Personalize cores, fontes, imagens, logo e ícones. Escolha um dos templates simples para publicar.' },
      { icon: 'FREE', title: 'Tudo bem organizado', description: 'Distribua seus produtos em categorias e mantenha fotos, descrições e preços fáceis de encontrar.' },
      { icon: 'MEDIUM', title: 'Experimente os temas', description: 'Veja os templates temáticos no preview. Para publicá-los, escolha Basic ou superior.' }
    ]
  },
  BASIC: {
    tagline: 'Mais presença para sua marca', title: 'Mostre o que torna seu menu especial.',
    description: 'Combine todos os templates com vídeos de produtos e acompanhe os primeiros indicadores do seu cardápio.', art: 'video', label: 'Produtos com mais movimento',
    highlights: [
      { icon: 'palette', title: 'Todos os templates', description: 'Publique templates simples e temáticos, preservando as cores, fontes e imagens da sua marca.' },
      { icon: 'video', title: 'Vídeos nos produtos', description: 'Apresente textura, preparo e detalhes dos seus produtos em vídeo, dentro do limite do plano.' },
      { icon: 'analytics', title: 'Analytics essencial', description: 'Acompanhe os indicadores essenciais de acesso e interação com seu cardápio.' }
    ]
  },
  MEDIUM: {
    tagline: 'Conecte o físico ao digital', title: 'Seu cardápio a um QR de distância.',
    description: 'Crie QR Codes personalizados para os pontos de contato do seu negócio e acompanhe o desempenho com Analytics avançado.', art: 'qr', label: 'QR Code personalizado incluído',
    highlights: [
      { icon: 'qr', title: 'QR com a sua identidade', description: 'Personalize a aparência do QR Code, incluindo a logo, e use o material no seu estabelecimento.' },
      { icon: 'analytics', title: 'Uma visão mais completa', description: 'Compare períodos e explore origens dos acessos, categorias e tendências de produtos.' },
      { icon: 'video', title: 'Mais espaço para apresentar', description: 'Amplie seu catálogo e use mais vídeos. Todos os templates também estão incluídos.' }
    ]
  },
  PRO: {
    tagline: 'Mais dados para suas decisões', title: 'Conheça melhor cada ponto de contato.',
    description: 'Tenha os maiores limites do catálogo e aprofunde a análise com exportação e informações de desempenho por QR Code.', art: 'analytics', label: 'Analytics completo + exportação',
    highlights: [
      { icon: 'analytics', title: 'Detalhes por QR Code', description: 'Explore os resultados dos seus QR Codes para entender como cada ponto de acesso participa do cardápio.' },
      { icon: 'export', title: 'Dados que acompanham você', description: 'Exporte relatórios em CSV para continuar suas análises fora do painel.' },
      { icon: 'PRO', title: 'A maior capacidade', description: 'Mais produtos, categorias e vídeos, com todos os templates e QR Code personalizado incluídos.' }
    ]
  }
};
