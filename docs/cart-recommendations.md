# Sugestões no carrinho — MVP

O proprietário configura até três complementos em **Menu → Editar produto → Sugestões para acompanhar**, depois de salvar o produto principal. A busca considera nome e categoria; incluir, remover e mudar a prioridade salva a lista completa automaticamente. Uma falha mantém a lista anterior.

Em **Design → Recursos → Sugestões no carrinho**, a ativação segue o fluxo existente de alterações pendentes e salvamento. A ausência da configuração significa desativado. Desativar o recurso preserva as associações. A opção de carrinho em Recursos também precisa estar habilitada; desligá-la esconde sugestões, inclusive quando o fluxo existente de pedidos externos mantém o carrinho disponível.

## Consumidor e preview

- Uma notificação compartilhada aparece 2 segundos após abrir o carrinho, apenas com carrinho não vazio e sugestão elegível. Fica abaixo da lista rolável e acima do total, com entrada suave e suporte a movimento reduzido. Fechar o carrinho cancela o temporizador; reabri-lo inicia uma nova contagem, preservando a dispensa enquanto os itens permanecerem iguais.
- Prioridade: produto adicionado mais recentemente, depois a ordem dos seus complementos; sem candidato, avalia os demais produtos do carrinho.
- Ignora produtos já no carrinho, removidos, indisponíveis, de categorias ocultas ou sem preço público positivo válido. Usa o preço público do catálogo carregado, incluindo a promoção comum do produto.
- Adicionar usa o carrinho atual; detalhes abrem a visualização existente. Dispensar esconde o card até a próxima alteração do carrinho, inclusive se ele for fechado e aberto novamente.
- O payload público inclui as relações; abrir o carrinho não consulta outra API. A imagem tem dimensões reservadas e lazy loading; o card não carrega vídeos.
- O preview usa os mesmos seletor, componente e carrinho. Disponibilidade remota reflete o último catálogo carregado, sem promessa de atualização instantânea.

## Persistência e segurança

Aplicar `supabase/migrations/20261104010000_product_recommendations.sql` **antes de publicar o backend e o frontend atualizados**. A migração está registrada no manifesto; nenhuma configuração existente é ativada ou sobrescrita.

`product_recommendations` usa chaves estrangeiras compostas por empresa/produto, exclusão em cascata, unicidade e posições de 1 a 3. A RPC `replace_product_recommendations` valida proprietário e produtos e substitui a lista em uma transação, com bloqueio do produto e da capacidade da empresa. Gravações simultâneas permanecem completas e com no máximo três associações.

Os endpoints autenticados `GET/PUT /api/v1/items/:id/recommendations` usam a empresa da sessão, validação estrita, limite de corpo de 2 KB e as proteções existentes de autenticação, CSRF e quotas. O visitante não acessa diretamente a tabela; a API pública projeta somente IDs elegíveis. A consulta pública opcional falha sem impedir a abertura do cardápio.

A exportação inclui as relações. A importação completa remapeia os IDs e restaura associações na mesma transação; a importação somente da aparência preserva as associações do catálogo de destino. Arquivos antigos sem relações continuam aceitos. Retentativas de uma importação concluída são idempotentes.

Nenhuma tabela de pedidos/carrinhos, dependência externa, novo limite de plano ou evento de analytics foi acrescentado.

## Verificação

- Backend: testes de API, projeção pública, configuração e importação/exportação; `npm run build`.
- Banco: `npm run test:database` em PostgreSQL temporário, incluindo concorrência, RLS, referências entre empresas, importação/exportação e exclusões.
- Frontend: testes unitários do seletor e do estado do carrinho; `npm run build`.
- Navegador: `npx playwright test e2e/cart-recommendations.spec.ts` (desktop, mobile de 360/390/430 px, teclado, dispensa, subtotal, editor, preview e salvamento da opção global).
