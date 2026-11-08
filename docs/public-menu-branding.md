# Marca PingoChef no rodapé público

- Free: exibe o rodapé **logo PingoChef + Cardápio Digital**, com link direto para `/plans`.
- Basic, Medium e Pro: não exibem esse bloco de rodapé.

A permissão existente `REMOVE_PINGOCHEF_BRANDING` é definida pelos entitlements do plano. O backend a consulta e retorna somente o booleano `showPingoChefBranding` no catálogo público; não expõe dados da assinatura. A prévia do editor usa o mesmo entitlement na sessão do proprietário. Aparência importada e `custom_config` não controlam essa decisão.

O bloco original fica no final do cardápio, com área de toque de 44 px e foco de teclado. Não há um segundo crédito “Feito por PingoChef”. A identidade do estabelecimento nas outras partes do cardápio permanece inalterada.

## Implantação

1. Aplicar `supabase/migrations/20261108174854_add_public_menu_branding_entitlement.sql` no projeto correto. A migração não altera produtos, assinaturas, preços nem outras permissões.
2. Publicar backend e frontend atualizados; recarregar o painel para atualizar os entitlements da prévia.

Se a permissão estiver ausente ou a consulta falhar, o catálogo continua disponível com o crédito. Portanto, aplicar a migração antes do deploy evita que clientes pagos exibam temporariamente a marca.

## Validação

Testes do backend verificam a permissão booleana e a tolerância a falhas. O teste de banco compara a regra nos quatro planos, usando o snapshot real de entitlements. O teste do componente verifica o texto/link, a remoção no público e o comportamento na prévia.
