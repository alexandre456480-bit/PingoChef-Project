# Catálogo de ícones e emojis

No painel, acesse **Design → Ícones da Página Inicial → Alterar**. Cada seção permite escolher um ícone, um emoji, o padrão original ou nenhum ícone. Aplicar atualiza o rascunho; **Salvar Alterações** persiste a escolha.

O catálogo contém 250 ícones 2D/3D, incluindo 188 novos desenhos de [Lucide](https://github.com/lucide-icons/lucide), [Tabler](https://github.com/tabler/tabler-icons), [Phosphor](https://github.com/phosphor-icons/core) e [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji). Os ícones antigos mantêm seus identificadores e desenhos. O catálogo compartilhado também amplia as opções de ícones das categorias em Menu.

O filtro **Emojis** inclui as 3.953 sequências totalmente qualificadas e componentes do [Unicode Emoji 17](https://unicode.org/Public/17.0.0/emoji/emoji-test.txt), com nomes e termos de busca em português de [Emojibase 17](https://github.com/milesj/emojibase). Inclui famílias, profissões, tons de pele e bandeiras. A apresentação visual usa a fonte de emojis do dispositivo, portanto símbolos recentes podem exigir atualização do sistema.

Há busca sem diferenciação de acentos, grupos temáticos, dez categorias de emojis, prévia e paginação de 96 opções. Os nomes dos emojis são carregados apenas ao abrir o seletor. Imagens e dados ficam no próprio aplicativo; não há consulta a CDN em tempo de execução.

## Persistência e segurança

- As escolhas continuam em `design_settings.custom_config.home_icons`; nenhuma alteração de tabela ou migração é necessária.
- Chave ausente conserva o padrão; `null` remove o ícone. IDs antigos `2d-*` e `3d-*` continuam compatíveis.
- Emojis usam IDs canônicos `emoji-<codepoints>`. API e DTO público aceitam somente sequências da mesma lista Unicode usada pelo frontend.
- O cliente não envia SVG, caracteres arbitrários nem URLs para esses campos. O renderizador resolve apenas assets locais e sequências conhecidas.
- A importação de SVG permite somente elementos de desenho e rejeita eventos, estilos e referências externas.

## Atualização dos assets

Execute `python frontend/scripts/import-icon-catalog.py` na raiz, com acesso à rede. O script baixa arquivos das fontes oficiais, verifica a integridade SHA-512 do pacote Emojibase e gera os catálogos, dados de busca e listas de IDs de ambos os serviços. Os commits das bibliotecas ficam fixados em `frontend/public/assets/catalog/sources.json`.

As licenças completas ficam em `frontend/public/assets/catalog/licenses/`. Os testes verificam IDs únicos, manutenção dos desenhos antigos, equivalência dos inventários de emojis entre as camadas, referências locais, validação da API e exibição no cardápio público.
