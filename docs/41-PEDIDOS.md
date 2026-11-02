# Pedidos pelo carrinho

Em **Empresa → Pedidos**, o proprietário ativa pedidos, escolhe WhatsApp, iFood,
site próprio, sistema de delivery ou outro link, informa a URL HTTPS e personaliza
o texto do botão (até 40 caracteres). Usa o botão existente **Salvar e Sincronizar**.

Ativar pedidos disponibiliza o carrinho, mesmo quando a opção de carrinho em Design
está desmarcada. Desativar pedidos devolve o controle dessa visibilidade a Design.
Estabelecimentos existentes começam com pedidos desativados.

O WhatsApp recebe apenas a saudação inicial e os nomes atuais dos itens do catálogo
com suas quantidades, sem valores, totais ou mensagem de encerramento.
O consumidor precisa revisar e enviar a mensagem;
disponibilidade, frete, pagamento e confirmação são tratados pelo estabelecimento.
Use um link com número internacional: `https://wa.me/5511999999999`.
Links de grupo e links curtos sem número não permitem compor esse pedido.

Nos outros canais, o botão abre a URL cadastrada, sem transferir itens.
O carrinho é preservado ao abrir o destino. Nenhum pedido ou dado pessoal do
consumidor é registrado em uma nova tabela.

## Banco e implantação

Aplique `supabase/migrations/20261102000000_add_business_order_settings.sql`
na sequência do manifesto **antes de atualizar a API**. A migration acrescenta
`businesses.order_settings`, com padrão desativado e CHECK de estrutura,
canal, URL e texto; mantém as políticas de propriedade existentes.
Não exige modificar planos, produtos, analytics ou políticas de acesso.

URLs são validadas na API, no banco e na renderização pública. Apenas HTTPS com
domínio público, sem credenciais, é aceito; WhatsApp exige destino com número
e iFood exige domínio correspondente. Configurações públicas inválidas são
tratadas como desativadas. Clientes antigos que omitem `order_settings` preservam
a configuração salva. A aplicação não consulta o conteúdo de links externos.

## Verificação local

- API: `npm test -- --runInBand business-orders public-orders business-social-links public-menu-subcategories public-menu-performance`
- Banco PostgreSQL local, cadeia de migrations e RLS: `npm run test:database`
- Frontend: `npm test -- --watch=false --include=src/app/models/order-settings.spec.ts --include=src/app/components/public-menu-view/public-menu-view.component.spec.ts`
- Navegador desktop/celular, temas claro/escuro e template Pixel: `npx playwright test e2e/orders.spec.ts`

O teste de navegador intercepta os destinos externos; verifica URL e mensagem,
sem enviar pedidos reais. O formato de mensagem preenchida segue o
[recurso oficial clique para conversa do WhatsApp](https://faq.whatsapp.com/5913398998672934/?locale=pt_BR).
