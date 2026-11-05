# Catálogo de ícones

O catálogo compartilhado atende aos seletores de categorias e aos ícones da página inicial. A expansão adiciona **201 opções: 105 vetores 2D e 96 imagens 3D**, mantendo intactos os 188 registros anteriores de `icon-catalog-extra.json`, além dos ícones legados e da coleção Pixel.

As fontes são os repositórios oficiais [Lucide](https://github.com/lucide-icons/lucide), [Tabler](https://github.com/tabler/tabler-icons), [Phosphor](https://github.com/phosphor-icons/core) e [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji). Os commits usados estão fixados em `frontend/public/assets/catalog/sources.json`; os avisos de licença são distribuídos em `frontend/public/assets/catalog/licenses/`.

As opções têm nomes em português, grupos e termos de busca. Incluem pratos, carnes, frutos do mar, lanches, massas, bebidas, confeitaria, padaria, frutas, legumes, utensílios, serviço e entrega. Os seletores permitem filtrar 2D/3D; a busca de categorias ignora acentos e aceita múltiplos termos. Ambas as grades apresentam inicialmente até 96 opções e permitem carregar mais.

Os SVGs 2D usam somente primitivas de desenho validadas pelo importador. Os arquivos 3D são PNGs transparentes de 256 × 256, servidos pelo próprio projeto. O cardápio não busca ícones em CDNs de terceiros. A ampliação não exige migration: são persistidos os mesmos identificadores limitados `2d-*`/`3d-*`, compatíveis com as validações atuais do backend e com importação/exportação.

Para regenerar apenas o catálogo gráfico, preservando as versões fixadas e o inventário Unicode existente:

```sh
python frontend/scripts/import-icon-catalog.py --catalog-only
node frontend/scripts/check-icon-assets.mjs
```

O importador requer rede, mantém a primeira ocorrência de cada ID e rejeita SVGs com elementos ativos. A validação local confere IDs, versões das fontes, licenças e os arquivos PNG referenciados.
