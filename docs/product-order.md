# Ordenar produtos no painel

Em Menu, segure a alca de seis pontos de um produto e arraste para a nova posicao. A grade abre espaco durante o movimento. No celular, o gesto inicia apos uma breve pressao na alca; o restante do card continua permitindo rolar a pagina. No teclado, as setas sobre a alca reposicionam o produto.

A ordem e salva ao soltar. Durante o envio, uma nova ordenacao fica bloqueada. Falhas mantem a ordem anterior e exibem uma mensagem. Ao ordenar dentro de uma categoria, os produtos das outras categorias mantem seus lugares na ordem global.

A interface usa Angular CDK 22.2.0, com orientacao mixed para grades responsivas e scroll automatico na area do painel. A API existente PATCH /items/reorder usa a RPC atomica reorder_business_menu para produtos, com o escopo da empresa da sessao e as permissoes existentes. Nenhuma migracao nova ou mudanca de plano e necessaria; a migracao 20261111224444_restore_atomic_category_order.sql precisa estar aplicada.

Verificacoes: frontend/e2e/product-order.spec.ts; testes performance-security; testes PostgreSQL de reorder, isolamento e rollback.
