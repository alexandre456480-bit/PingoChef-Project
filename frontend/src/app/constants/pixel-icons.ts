import type { CatalogIcon } from './icon-catalog';

// Original artwork on a 16 × 16 grid. Transparent cutouts respect any surface.
function pixelIcon(key: string, name: string, tags: string[], path: string): CatalogIcon {
  return {
    id: `2d-pixel-${key}`, name: `${name} Pixel`, type: '2d', group: 'Pixel & Arcade', source: 'Pixel',
    tags: ['pixel', 'pixels', '8-bit', 'retro', 'arcade', ...tags],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" shape-rendering="crispEdges"><path fill-rule="evenodd" d="${path}"/></svg>`
  };
}

export const PIXEL_ICONS: CatalogIcon[] = [
  pixelIcon('home', 'Início', ['inicio', 'casa', 'loja'],
    'M7 1h2v2h2v2h2v2h2v2h-2v6H3V9H1V7h2V5h2V3h2zM7 4v2H5v2H4v6h3v-4h2v4h3V8h-1V6H9V4z'),
  pixelIcon('burger', 'Hambúrguer', ['hamburguer', 'burger', 'lanche', 'combo'],
    'M5 2h6v1h2v2h1v3H2V5h1V3h2zM5 4v1h1V4zM9 4v1h1V4zM1 9h4v1h2V9h3v1h2V9h3v2h-3v1h-2v-1H7v1H5v-1H1zM2 13h12v1h-1v1H3v-1H2z'),
  pixelIcon('fries', 'Batata frita', ['batata', 'fritas', 'porcao', 'acompanhamento'],
    'M2 3h2v5h1V1h2v7h2V2h2v6h1V4h2v5h1v3h-1v3H2v-3H1V9h1zM4 10v3h8v-3h-2v1H6v-1z'),
  pixelIcon('pizza', 'Pizza', ['pizza', 'massa', 'fatia'],
    'M2 1h10v1h2v2h1v2h-2V4h-2V3H2zM2 4h2v2h2V4h4v2h2v2h-2v2H8v2H6v2H4v1H2zM4 9v2h2V9zM7 6v2h2V6z'),
  pixelIcon('drink', 'Bebida', ['bebida', 'suco', 'refrigerante', 'copo'],
    'M10 1h4v2h-3v3h3v3h-1v6H3V9H2V6h7V2h1zM4 8v2h1v3h6v-3h1V8z'),
  pixelIcon('coffee', 'Café', ['cafe', 'xicara', 'padaria', 'quente'],
    'M4 1h2v3H4zM8 1h2v3H8zM2 5h10v1h3v5h-3v2h-1v1H3v-1H2zM4 7v5h6V7zM12 8v1h1V8zM1 15h12v1H1z'),
  pixelIcon('icecream', 'Sorvete', ['sorvete', 'sobremesa', 'doce', 'gelado'],
    'M6 1h4v1h2v2h1v4h1v2H2V8h1V4h1V2h2zM6 3v1H5v4h6V4h-1V3zM4 11h8v1h-1v1h-1v1H9v2H7v-2H6v-1H5v-1H4z'),
  pixelIcon('heart', 'Coração', ['coracao', 'curtidas', 'favorito', 'amor'],
    'M2 2h4v1h1v1h2V3h1V2h4v1h1v1h1v5h-2v2h-2v2h-2v2H6v-2H4v-2H2V9H0V4h1V3h1zM3 4v2H2v2h2V6h2V4z'),
  pixelIcon('star', 'Estrela', ['estrela', 'destaque', 'especial', 'chef'],
    'M7 1h2v3h1v1h5v3h-2v2h-1v2h1v3h-3v-1H9v-1H7v1H6v1H3v-3h1v-2H3V8H1V5h5V4h1z'),
  pixelIcon('fire', 'Chama', ['fogo', 'chama', 'promocao', 'oferta', 'quente'],
    'M7 0h2v2h2v4h1V5h2v3h1v5h-1v2h-3v1H5v-1H2v-2H1V9h1V6h2v3h1V5h1V3h1zM7 8v3H5v2h1v1h4v-1h1v-2H9V8z'),
  pixelIcon('trophy', 'Troféu', ['trofeu', 'premio', 'mais vendidos', 'campeao'],
    'M4 1h8v1h4v6h-2v2h-3v1H9v2h3v2H4v-2h3v-2H5v-1H2V8H0V2h4zM6 3v5h1v1h2V8h1V3zM2 4v3h1v1h1V4zM12 4v4h1V7h1V4z'),
  pixelIcon('chef', 'Chapéu do chef', ['chef', 'chapeu', 'cozinha', 'especialidade'],
    'M6 1h4v1h2v1h2v1h1v5h-1v1h-2v5H4v-5H2V9H1V4h1V3h2V2h2zM6 3v2H3v3h3v3h4V8h3V5h-3V3zM6 13v1h4v-1z'),
];
