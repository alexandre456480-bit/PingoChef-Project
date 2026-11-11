# Cores da tela de boas-vindas

Em **Empresa → Fundo da Tela de Entrada → Duas Cores Personalizadas**, a primeira cor define o fundo; a segunda define as formas dos cantos e o botão. A prévia acompanha ambas. O texto recebe contraste automático, e o botão permanece acessível pelo teclado.

A configuração anterior de fundo e a opção de imagem são preservadas. Sem uma segunda cor salva, os detalhes usam amarelo (`#FFB800`). Logo, nome, descrição e fontes continuam vindo das personalizações existentes.

Aplicar `supabase/migrations/20261111192607_add_welcome_accent_color.sql` antes de publicar o backend e o frontend atualizados. O novo campo nullable `businesses.welcome_bg_accent_color` aceita apenas HEX de três ou seis dígitos na API e no banco. As permissões existentes da empresa e das RPCs de transferência são preservadas.

A exportação inclui a segunda cor; a importação restaura essa configuração na transação existente. Arquivos antigos que não contêm o campo preservam a segunda cor do destino.

Ao entrar, duas cortinas nas cores da empresa se abrem e a logo desaparece suavemente. A transição dura menos de um segundo, usa apenas transformações e opacidade e remove suas camadas ao terminar. Com movimento reduzido, a entrada é imediata. Não há nova consulta de API nem dependência de animação.

No localhost, `npm start` do backend compila uma vez: após atualizar os campos aceitos pela API, reinicie esse processo. Para desenvolvimento com recompilação automática, use `npm run dev` em `backend`.
