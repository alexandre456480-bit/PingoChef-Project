# Cardápio demonstrativo PingoChef

Abra `pingo_chef_alexandre45648.sql`, copie o arquivo completo e execute no **SQL Editor do Supabase** do projeto conectado. O arquivo é um seed manual, fora da cadeia de migrations. Não execute apenas uma seleção parcial.

**Se já executou a versão anterior:** execute o arquivo completo `pingo_chef_corrigir_imagens.sql`. Ele atualiza somente as fotos dos produtos demonstrativos identificados pelos UUIDs do seed, sem recriar produtos ou alterar textos e preços. A consulta final mostra quantos produtos foram encontrados e quantas fotos foram atualizadas; uma nova execução sem mudanças retorna zero atualizações.

O destino está fixado pelo e-mail `alexandre45648@gmail.com`, UUID do proprietário e UUID do estabelecimento `pingo-chef`, verificados na base conectada. O script interrompe a execução se esses identificadores não concordarem ou se não houver capacidade no plano.

O catálogo contém **60 produtos**, distribuídos por **8 categorias e 17 subcategorias**: artesanais e smash, frango e vegetarianos, combos, porções, bebidas, milk-shakes, sobremesas, molhos e adicionais. Inclui descrições, preços demonstrativos, promoções e todos os tipos de destaque existentes no sistema. Os novos produtos começam com zero curtidas.

Categorias, subcategorias e produtos já existentes com o mesmo nome são reutilizados ou preservados, sem substituir descrição, preço, imagem, ícone ou ordem. A comparação considera categoria/estabelecimento, ignora maiúsculas e espaços nas pontas e interrompe se houver categorias/subcategorias ambíguas. Os registros novos são acrescentados depois dos existentes. As novas categorias recebem ícones do catálogo Pixel; as anteriores mantêm suas escolhas.

As fotos são ilustrativas e foram pesquisadas no **Wikimedia Commons e Pixnio**. Há **58 arquivos diferentes**, com licença **CC0 ou domínio público**, URLs HTTPS verificadas e revisão visual para remover arquivos duplicados e resultados sem relação com o alimento. `pingo_chef_imagens.json` registra a foto, o autor, a página de origem e a licença de cada seleção. As fotos representam o tipo de produto e não são fotografias das receitas reais do PingoChef.

Dadinho de Tapioca e Refrigerante Guaraná não receberam foto nesta seleção: o seed mantém `NULL` nesses dois produtos e o SQL de correção não toca neles. Produtos sem foto usam o estado sem imagem já oferecido pelo aplicativo. Não cria vídeos nem duplica imagens base64. Molhos e ingredientes extras são produtos separados, sem simular um sistema de modificadores.

O script é transacional e pode ser repetido sem duplicar os mesmos registros. Não altera plano, permissões, fontes, cores, template, hero, vídeos, dados de outros clientes nem o estado de publicação. Se o cardápio já estiver publicado, os novos produtos disponíveis fazem parte desse catálogo público.

Na leitura da conta em 28/10/2026 havia 5 categorias, 6 subcategorias e 13 produtos, com limites de 40 categorias e 150 produtos. Mantida essa base, a primeira execução adiciona 4 categorias, 13 subcategorias e 60 produtos, totalizando **9 categorias, 19 subcategorias e 73 produtos**. O resultado final aparece na consulta ao fim do SQL.

SQL validado em PostgreSQL 16 local com a cadeia completa de migrations e os metadados de ícones presentes na base conectada: inserção, integridade dos vínculos, reexecução, preservação dos registros anteriores e de outro cliente, limite de plano e rejeição de conta divergente. A correção de imagens também foi validada sobre fotos repetidas simuladas, sem alterar os demais campos. Nenhum dos scripts foi executado por este agente na conta conectada.
