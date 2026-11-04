# Importação e exportação de cardápios

Disponível em **Configurações → Conta**. O arquivo `.pingochef.json` contém os dados já salvos no servidor; alterações ainda não salvas no editor não entram na exportação.

## Conteúdo

- Template, paleta, fontes, estilo de categorias, blocos da página inicial e configurações visuais, incluindo banners e textos.
- Nome, descrição, logo, imagens de boas-vindas, contatos públicos, redes sociais e configuração do botão de pedido.
- Categorias, ícones, subcategorias, produtos, imagens, preços, destaques, disponibilidade e ordenação.
- Imagens Base64 permanecem incorporadas, sem recompressão. Imagens HTTPS e assets locais preservam suas referências; a disponibilidade de links externos continua dependendo da origem. O servidor não busca URLs do arquivo.

Não transfere credenciais, IDs da empresa, endereço público/slug, assinatura, permissões, publicação, QR Codes, curtidas, pedidos ou analytics. Vídeos do provedor não são portáveis: o arquivo informa a quantidade excluída e o usuário precisa enviá-los novamente.

## Fluxo de importação

1. Selecione um arquivo gerado pelo PingoChef (formato `pingochef-menu`, versão `1`, até 32 MiB).
2. O servidor valida a estrutura, referências entre categorias/produtos, template, preços, links e conteúdo potencialmente inseguro. A prévia não modifica o cardápio.
3. Escolha **personalização e dados públicos** ou **cardápio completo**. A primeira opção preserva produtos, categorias e banners específicos das categorias de destino. A segunda substitui o catálogo e remapeia seus IDs e banners.
4. Confirme a substituição. O painel primeiro inicia o download de uma cópia do estado atual; somente depois solicita a aplicação.
5. O banco aplica tudo em uma transação. Falhas revertem todas as alterações. Repetir a requisição concluída não duplica os produtos. Após sucesso, recarregue o painel pelo botão apresentado.

O catálogo completo respeita os limites atuais do plano. Sua substituição é bloqueada se a empresa de destino possui registros em `product_media`, evitando apagar vídeos ou deixar objetos privados órfãos. A opção de personalização permanece disponível.

Em um cardápio já publicado, os dados importados passam a ser exibidos online após a transação. Um cardápio não publicado continua não publicado.

## Segurança e armazenamento temporário

- A sessão de proprietário existente determina a empresa e o usuário em todas as operações. O arquivo não pode escolher esses identificadores.
- Todas as escritas usam a proteção de origem/CSRF da sessão existente. Buffers e RPCs de transferência não são acessíveis pelos papéis `anon` ou `authenticated`.
- Os arquivos são transferidos em partes de até 500.000 caracteres para manter cada requisição abaixo do limite da hospedagem. Não depende de memória compartilhada entre instâncias serverless.
- Até quatro transferências não concluídas por empresa e doze inícios por hora. Buffers expiram em uma hora e são removidos ao iniciar outra transferência ou pela manutenção de segurança existente.
- São rejeitados campos protegidos, referências quebradas, IDs duplicados, protocolos executáveis, SVGs, chaves de poluição de protótipo e estruturas excessivamente profundas. O contrato admite até 200 categorias, 1.000 subcategorias e 1.000 produtos, além dos limites comerciais de destino.
- Logs e mensagens de erro não contêm o arquivo, credenciais ou detalhes internos de banco.

## Implantação

Aplique **`supabase/migrations/20261104000000_menu_import_export.sql` antes de publicar o backend e frontend**. O checksum está registrado no manifest. A migration também adiciona, se ausentes, os campos legados `categories.icon_type`, `icon_key` e `image_url`, sem modificar os existentes. Nenhum cardápio é importado automaticamente.

As rotas ficam sob `/api/v1/menu-transfer`: início, envio/leitura de partes, prévia, aplicação e cancelamento. A limpeza reutiliza `maintain_shared_security_state()` e seu cron existente; não requer um novo serviço ou cron.

Validação: `npm run build` nos dois projetos; testes `menu-transfer.test.ts`, `menu-transfer-routes.test.ts` e `owner-phase4-settings.test.ts` no backend; `npm run test:database`; `npx playwright test e2e/menu-transfer.spec.ts` no frontend.
