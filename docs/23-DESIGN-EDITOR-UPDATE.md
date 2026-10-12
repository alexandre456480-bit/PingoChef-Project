# Atualização do editor de design — 11/10/2026

As sete seções usam `details/summary`, com teclado e estado de expansão nativos. Estrutura & Template inicia aberta; as demais iniciam recolhidas. Recolher mantém o rascunho e os controles montados.

O catálogo tem 17 paletas (9 claras e 8 escuras), além da personalizada, que continua acessível em qualquer filtro. O tema é classificado pela luminância do fundo; filtrar não altera a seleção atual. As 10 novas paletas oferecem contraste mínimo de 4,5:1 para texto principal, secundário e preços, sobre o fundo e os cards.

Textos sobre botões, categorias ativas e badges selecionam preto ou branco conforme o contraste da primária/destaque. Em botões com gradiente, a escolha considera os dois extremos. O cálculo é compartilhado pelo cardápio público e preview.

Tipografia: 14 fontes de títulos, 11 de corpo e 12 combinações. Os filtros independentes de títulos, leitura e combinações são Modernas, Clássicas/Serifadas, Impacto/Condensadas e Arredondadas; estilos sem opções não aparecem. Nas combinações, o estilo é definido pela fonte de título. As 9 novas famílias carregam pelo Google Fonts, usando os domínios já permitidos na CSP.

Filtros e expansão são estados locais da interface, sem campos adicionais na API ou no banco. Cores, fontes, blocos, banners e configurações existentes continuam no mesmo contrato, com validação de HEX e nomes de fonte e isolamento por estabelecimento.

## Remoção da preferência de animações

A preferência editável `motion` foi removida dos modelos, payloads, preview e respostas públicas. As animações próprias do cardápio e `prefers-reduced-motion` continuam ativos. Esta atualização substitui as referências históricas ao seletor de animações nos documentos 05, 06 e 08.

Ordem de publicação:

1. Publicar a API atualizada: aceita e descarta o campo legado enviado por clientes antigos, sem ler nem escrever a coluna.
2. Aplicar `supabase/migrations/20261011010000_remove_design_motion.sql` para remover somente a coluna `motion`. Não altera RLS, permissões ou outras configurações.
3. Publicar o frontend atualizado. Ele também funciona antes da migração.

## Validação

- Builds de frontend e backend.
- Testes de persistência, compatibilidade com payload antigo e rejeição de estilos inválidos/campos extras.
- Contraste das novas paletas e preservação de cores personalizadas.
- Playwright em desktop/mobile: teclado, filtros, estado após recolher, salvar/recarregar e temas claro/escuro.
- Cadeia completa de migrações e verificações locais de PostgreSQL/RLS.
