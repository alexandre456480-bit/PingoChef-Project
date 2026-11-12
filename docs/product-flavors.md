# Sabores de produtos

Em **Menu → Editar produto → Sabores e opções**, cadastre até 30 sabores, com nomes distintos, preço próprio opcional e disponibilidade individual. Os sabores são salvos junto com o produto. Não consomem novas vagas de produtos nem alteram planos, QR codes, mídias ou recomendações já configuradas.

Sem sabores, o produto mantém seu fluxo anterior. Com sabores, o cliente precisa escolher uma opção disponível antes de adicionar; a quantidade vale para aquela opção. O mesmo produto pode aparecer em várias linhas do carrinho, uma por sabor. A adição rápida e as sugestões abrem a visualização quando for necessário escolher.

Um preço próprio substitui o preço e a promoção do produto. Sem preço próprio, o sabor usa o preço/promoção do produto. Cards mostram o menor preço disponível com “A partir de”; o detalhe mostra o preço exato após a escolha. A configuração de ocultar preços continua valendo.

O carrinho persiste o ID do sabor. Ao carregar o catálogo, atualiza nomes e preços a partir dele. Sabores excluídos, pausados, desconhecidos ou ausentes quando uma escolha passou a ser obrigatória bloqueiam a finalização e aparecem como indisponíveis, para remoção e nova escolha. Nenhuma opção é trocada silenciosamente. Isso reflete o catálogo carregado; não implica disponibilidade remota em tempo real.

O WhatsApp recebe produto, sabor e quantidade, com nomes obtidos do catálogo atual; nomes e preços persistidos no carrinho não determinam a mensagem. O fluxo existente não envia preços nem cria cobrança ou pedido no servidor. O estabelecimento confirma os valores e a disponibilidade pelo WhatsApp. Canais externos (iFood, site etc.) continuam abrindo o link configurado, sem transportar o carrinho ou os sabores para esses sistemas.

## Banco e implantação

Aplicar `supabase/migrations/20261111233304_add_product_flavors.sql` antes de publicar o backend/frontend atualizados. `menu_items.flavors` é um JSONB limitado e validado também por CHECK: IDs e nomes únicos, tipos estritos, disponibilidade booleana, preços positivos e nomes sem marcação ou controles. A coluna usa o RLS e a titularidade do produto existente; nenhum identificador de empresa é aceito dentro dos sabores.

As novas RPCs privadas `menu_transfer_start_with_flavors` e `menu_transfer_apply_with_flavors` incluem e restauram os sabores na transação existente. As RPCs antigas ficam inalteradas, preservando compatibilidade durante o rollout. Arquivos antigos continuam aceitos; importação completa sem sabores restaura produtos sem opções, enquanto importação apenas da aparência preserva o catálogo de destino. Retentativas continuam idempotentes. Os IDs dos produtos são remapeados e os IDs locais dos sabores permanecem vinculados ao produto importado.

## Validação

Testes de schema/API/arquivos portáveis, banco temporário com validação e rollback, carrinho/WhatsApp e navegador em desktop/mobile. Produtos legados, promoções, recomendações e atualização independente das quantidades permanecem cobertos.
