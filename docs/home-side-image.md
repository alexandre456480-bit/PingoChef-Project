# Imagem lateral do Início

Em Design > Blocos da Página > Imagem lateral do Início, o proprietário pode adicionar, trocar, ocultar ou remover uma imagem. O enquadramento usa a proporção 3:4 e o otimizador já existente. A alteração segue o salvamento normal do Design e aparece no preview.

A imagem ocupa uma coluna reservada à direita do conjunto de itens da primeira seção de produtos realmente renderizada no Início: promoções, mais curtidos, pratos do chef, combos ou mais vendidos. A capa, as categorias e o título da seção mantêm sua largura normal. Blocos desativados, vitrines vazias e curtidos desabilitados não recebem a imagem. Reordenar os blocos reposiciona a imagem automaticamente. Ela não aparece nas categorias, na busca ou na tela de boas-vindas. A identidade e a apresentação fora da lista de blocos mantêm seu lugar.

O layout reserva espaço para os produtos e usa cantos arredondados. A opção ausente ou desativada preserva o layout existente. Nenhuma imagem padrão é acrescentada a contas existentes.

Persistência: design_settings.custom_config.first_block_image = {enabled:boolean,imageUrl:string|null}. A coluna JSONB e a RLS existentes são reutilizadas; não há migração nova. O backend valida a estrutura e a origem da imagem, bloqueia esquemas ativos e credenciais em URLs, e projeta somente os dois campos públicos. Exportação e importação preservam a opção pelo contrato existente, incluindo arquivos antigos sem essa preferência. Não há download de URLs pelo servidor.

Verificação: testes de design, projeção pública e arquivos no backend; persistência e otimização no frontend; exportação/importação em PostgreSQL temporário; frontend/e2e/home-side-image.spec.ts para blocos, templates, viewport mobile/desktop e upload com recorte.
