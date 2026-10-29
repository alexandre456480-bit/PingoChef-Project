# Templates do cardápio

O catálogo atual contém `default` (Padrão), `centered-cover` (Capa Central),
`arched-cover` (Capa em Arco), `brand-hero` (Marca na Capa) e
`signature-cover` (Capa Assinatura) e `pixel` (Pixel). O registro em
`frontend/src/app/constants/menu-templates.ts` define geometria e apresentação.
O componente público compartilha as interações e usa o mesmo template na prévia.
Não cadastrar cores, fontes, ícones, conteúdo ou flags de recursos no template.

As personalizações continuam em `design_settings.palette`, `font_heading`,
`font_body`, `font_pair`, `category_style`, `home_blocks` e `custom_config`.
Logo e descrição do estabelecimento continuam em `businesses`. O template
respeita blocos habilitados, sua ordem, banners por categoria e recursos opcionais.

## Transição

1. Publicar a API atualizada: chaves ativas são preservadas; gravações reconhecidas
   de clientes antigos são normalizadas para `default`, removendo apenas
   `template_variant` e seus marcadores de blocos. Chaves desconhecidas são rejeitadas.
2. Aplicar `20261024000000_reset_menu_templates.sql` pelo processo de migrações.
   Todos os modelos anteriores passam para o padrão. A migração preserva as
   personalizações, altera o relatório administrativo para `template_key` e
   remove `template_id`. Não altera políticas de acesso ou publicação.
3. Publicar o frontend atualizado. Ele também resolve respostas antigas como
   padrão, sem depender dos marcadores de variantes.

Não existe uma cópia separada de design publicado: salvar continua atualizando a
configuração lida pelo cardápio online. Essa regra de publicação não foi alterada.

## Próximos templates

Adicionar uma chave explícita ao catálogo visual, à validação do backend e à
restrição SQL em uma nova migração. Reutilizar os componentes de busca, produto,
carrinho e curtidas. Não introduzir preferências visuais em `home_blocks`.
Validar a preservação da personalização, a equivalência entre prévia e público
e as interações no celular e desktop.

## Capa Central

A chave `centered-cover` usa capa de margem a margem, logo circular centralizada
sobre a borda inferior e descrição alinhada ao centro. Utiliza os mesmos cards,
conteúdos, fontes, cores, ícones e funções do Padrão.
Aplicar `20261025000000_add_centered_cover_template.sql` antes de disponibilizar
a seleção no frontend. Essa migração apenas amplia as chaves permitidas;
não modifica a seleção nem as personalizações de nenhum cliente.

## Capa em Arco

A chave `arched-cover` utiliza hero com borda inferior curva, logo circular
centralizada, categorias em pílulas e controles compactos sobre a capa.
A apresentação com glassmorphism fica depois da hero. As fotos dos produtos
continuam quadradas e todas as personalizações e ações são compartilhadas.
Aplicar `20261025010000_add_arched_cover_template.sql` antes de disponibilizar
a seleção no frontend. Nenhuma escolha existente é substituída.

## Marca na Capa

A chave `brand-hero` posiciona logo e nome dentro da hero, com apresentação
acima no mesmo formato de vidro da Capa Central. Os cards têm foto ampla à
esquerda e informações à direita, sem etiquetas adicionais. Busca, carrinho,
curtidas e detalhes reutilizam as mesmas ações; nenhum recurso é habilitado
pelo template. Cores, fontes, conteúdo e blocos permanecem do cliente.
Aplicar `20261026000000_add_brand_hero_template.sql` antes de disponibilizar
a seleção. A migração apenas permite a nova chave e preserva as anteriores.

## Capa Assinatura

A chave `signature-cover` usa uma capa com recorte inferior côncavo, logo
centralizada sobre a borda e nome entre duas linhas decorativas, uma de cada
lado. A apresentação fica abaixo da hero. O recorte é transparente e respeita
o fundo escolhido pelo cliente. A apresentação é exibida sem caixa de vidro,
e as categorias usam cartões arredondados. Os cards de 148 px têm foto quadrada
com margem interna e curtidas na área de informações. Marca na Capa mantém
seus próprios cards de 144 px. Cores, fontes e conteúdo continuam do cliente.
Aplicar `20261026010000_add_signature_cover_template.sql` antes de disponibilizar
a seleção. Essa migração apenas amplia as chaves permitidas, sem substituir
templates ou personalizações existentes.

## Pixel

A chave `pixel` utiliza recorte da hero em degraus, logo centralizada,
molduras pixeladas, sombras sem desfoque e categorias com marcador de seleção.
Contornos e decorações usam os tokens ativos da paleta; fundos de ação usam
as cores de contraste calculadas para essa mesma paleta. Nenhuma cor ou fonte
é gravada pelo template. Fontes, ícones personalizados, fotografias, banners,
descrições, ordem e habilitação dos blocos permanecem do cliente.

Os controles continuam sendo somente busca e carrinho, respeitando a habilitação
do carrinho. Não há botão de menu lateral, indicadores fictícios ou contadores
decorativos. Curtidas, grupos recolhíveis, detalhes e carrinho reutilizam as
ações existentes. As fotografias e os ícones não recebem filtro de pixelização.

Aplicar `20261028000000_add_pixel_menu_template.sql` antes de disponibilizar
o salvamento no ambiente conectado. A migração apenas permite a nova chave,
sem redefinir as escolhas ou alterar acesso e publicação.

A seção Tipografia oferece o filtro Pixel e a combinação opcional Pixel & Arcade:
Silkscreen para títulos e Pixelify Sans para descrições. As famílias entram no
mesmo catálogo permitido de fontes e carregam apenas quando selecionadas no
cardápio público. Escolher o template Pixel não aplica essa combinação automaticamente.
Não há alteração de banco para adicionar essas opções de fonte.

Quando Pixelify Sans é escolhida, somente os dígitos 0–9 usam os algarismos
Silkscreen locais (pesos 400/700, licença SIL OFL junto aos arquivos). Letras e
pontuação permanecem Pixelify Sans. A composição também vale para a prévia e
não muda o nome da fonte salvo, outras fontes ou a seleção do template.

O catálogo compartilhado oferece 12 ícones SVG locais no grupo Pixel & Arcade,
também encontrados pela busca `pixel`. São opções 2D para categorias e ícones
da página inicial, com geometria em grade e cor herdada (`currentColor`).
A seleção é individual, funciona em qualquer template e não altera escolhas
existentes. Os IDs `2d-pixel-*` usam o contrato de persistência atual.
