export function archiveFixture(): any {
  const cat = '11111111-1111-4111-8111-111111111111';
  const sub = '22222222-2222-4222-8222-222222222222';
  return {
    format: 'pingochef-menu', version: 1, exportedAt: '2026-11-04T12:00:00.000Z', excludedVideos: 0,
    business: { name: 'Restaurante', description: 'Descrição', logo_url: null, banner_url: null, phone: null, whatsapp: null,
      welcome_bg_type: 'image', welcome_bg_image: null, welcome_bg_color: '#ffffff', social_links: [],
      order_settings: { enabled: false, channel: 'whatsapp', url: '', button_text: 'Fazer pedido' } },
    design: { template_key: 'sweet-boutique', palette: { key: 'custom', name: 'Minha paleta', colors: {
      primary: '#8B1A3A', secondary: '#D26E2D', accent: '#F47B20', background: '#FAF5F0', surface: '#FFFFFF', textPrimary: '#2D1822', textSecondary: '#6E5D65'
    } }, font_heading: 'Outfit', font_body: 'Inter', font_pair: 'custom', category_style: 'icon_name', home_blocks: [],
      custom_config: { hero_banners: ['data:image/png;base64,aGVsbG8='], category_hero_configs: { [cat]: { enabled: true, banners: ['/assets/example.webp'] } } } },
    categories: [{ id: cat, name: 'Categoria', description: null, icon: '2d-dish', iconType: '2d', iconKey: '2d-dish', imageUrl: null, displayMode: 'icon_text_side', displayOrder: 0, isActive: true }],
    subcategories: [{ id: sub, categoryId: cat, name: 'Subcategoria', displayOrder: 0 }],
    items: [{ id: '33333333-3333-4333-8333-333333333333', categoryId: cat, subcategoryId: sub, name: 'Produto', description: 'Descrição',
      price: 20, promotionalPrice: 15, imageUrl: 'https://images.example.com/product.webp', isAvailable: true,
      isHighlighted: false, highlightType: 'none', showPrice: true, displayOrder: 0 }]
  };
}
