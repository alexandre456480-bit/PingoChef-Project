# 05 — Design System, Templates e Experiência Visual — PingoChef

> **Status:** versão atualizada conforme o estado atual do PingoChef em outubro/2026.  
> **Domínio:** Design System do painel, editor de design, templates do cardápio público, paletas, tipografia, hero/banners, descrição de apresentação, categorias, subcategorias, cards de produto, preview, motion, responsividade e performance visual.  
> **Depende de:** `01-ARQUITETURA-GERAL.md`, `03-PAINEL-USUARIO.md`, `04-CARDAPIO-CONTEUDO.md`.  
> **Referenciado por:** `06-EXPERIENCIA-PUBLICA.md`, `08-BANCO-DADOS-RLS.md` e qualquer skill que implemente novos templates.

---

## 0. Regra de autoridade

Este documento descreve a direção visual e o contrato de design atual do PingoChef.

Entretanto:

1. **o código atual é a fonte de verdade para nomes de rotas, schemas, chaves e templates já registrados**;
2. não recriar schemas antigos apenas porque aparecem em documentação histórica;
3. ao implementar ou editar um template, primeiro localizar o registry/configuração real existente;
4. alterações visuais nunca podem reimplementar regras de negócio;
5. templates novos devem ser adicionados dentro da arquitetura atual, sem duplicar backend, APIs ou regras de conteúdo.

Se houver divergência entre esta skill e uma interface/schema real mais novo no repositório, preservar o comportamento funcional atual e atualizar apenas a camada visual necessária.

---

# 1. O que o design do PingoChef precisa comunicar

O PingoChef não é apenas um "cardápio digital".

O produto é uma **plataforma para transformar o cardápio em uma vitrine digital da marca do estabelecimento**.

O design deve fazer duas coisas simultaneamente:

- o **painel PingoChef** precisa parecer um produto SaaS profissional, organizado e fácil de operar;
- o **cardápio público** precisa desaparecer como software genérico e deixar a identidade do estabelecimento dominar.

A experiência final deve transmitir:

> "Este cardápio pertence a este restaurante."

E não:

> "Este restaurante está usando o mesmo template genérico que todos os outros."

---

# 2. Princípios fundamentais

| Princípio | Regra prática |
|---|---|
| **Vitrine antes de lista** | O produto, sua fotografia e a identidade da marca têm protagonismo. |
| **Personalização controlada** | O usuário personaliza dentro de guardrails; não existe editor pixel a pixel. |
| **Templates estruturais** | Templates precisam mudar a composição visual, não somente cor e radius. |
| **Cores e fontes independentes do template** | Trocar template preserva a paleta e tipografia escolhidas pelo estabelecimento. |
| **Mobile first** | O cardápio público nasce para 360–430 px e escala para telas maiores. |
| **Performance é parte do design** | Skeleton, estabilidade, lazy media e feedback instantâneo fazem parte da UX. |
| **Marca do cliente em primeiro lugar** | Logo, hero, cores, fontes e produtos do estabelecimento dominam a experiência pública. |
| **Hierarquia antes de decoração** | Elementos visuais só existem se ajudarem navegação, desejo ou compreensão. |
| **Acessibilidade é obrigatória** | Contraste, foco, reduced motion, targets tocáveis e semântica são requisitos. |
| **Sem regressão funcional** | Alteração visual não pode quebrar likes, vídeos, busca, QR, Analytics, publicação ou segurança. |

---

# 3. Dois sistemas visuais diferentes

O PingoChef possui duas superfícies visuais com objetivos diferentes.

## 3.1 Painel administrativo

É a interface da plataforma PingoChef.

Sua identidade é estável e controlada pela marca PingoChef.

### Linguagem atual

- tema principal dark;
- superfícies charcoal/grafite;
- sidebar vinho/burgundy;
- vermelho/burgundy como CTA estrutural, especialmente `Publicar Cardápio`;
- laranja/amber como destaque e assinatura PingoChef;
- verde apenas para estados positivos/sucesso/online;
- roxo/azul somente quando possuem função semântica;
- creme/off-white para textos e superfícies claras pontuais;
- cards arredondados;
- bordas sutis;
- profundidade suave;
- clay/neomorphism muito controlado;
- evitar glassmorphism excessivo;
- evitar glow decorativo sem função;
- evitar gradientes decorativos desnecessários.

### Tipografia do painel

Usar as fontes/tokens já presentes no projeto.

Direção atual:

- títulos/display: forte personalidade, boa leitura;
- corpo/UI: alta legibilidade;
- KPIs com peso visual alto;
- textos secundários discretos, mas nunca pequenos demais.

Não introduzir novas famílias globais sem necessidade.

### Ícones

- usar a biblioteca de ícones já adotada no projeto;
- preferir Lucide quando aplicável;
- não usar emoji como substituto de ícone funcional do painel;
- o mascote é uma exceção de identidade, não um ícone genérico.

---

## 3.2 Cardápio público

É a vitrine do estabelecimento.

A identidade do PingoChef deve permanecer secundária.

O cardápio público herda do estabelecimento:

- logo;
- nome;
- descrição quando exibida;
- paleta;
- tipografia;
- hero/banners;
- imagens de produtos;
- vídeos;
- estrutura de categorias;
- blocos habilitados;
- template escolhido.

A marca PingoChef não deve competir visualmente com a marca do restaurante.

---

# 4. Contrato atual de Template

## 4.1 Definição

Um **template** é uma composição estrutural do cardápio público.

Ele deve ser capaz de fazer dois estabelecimentos com os mesmos dados parecerem visualmente diferentes **sem alterar os dados nem a lógica do produto**.

## 4.2 O que o template PODE mudar

No contrato atual do PingoChef, um template altera somente a estrutura/estilo visual destas regiões:

1. **Logo**
2. **Hero Section / banners**
3. **Descrição/apresentação do estabelecimento**, quando habilitada
4. **Navegação de categorias**
5. **Subcategorias**
6. **Containers/cards dos produtos**

Dentro dessas regiões, o template pode modificar:

- posição;
- tamanho;
- proporção;
- alinhamento;
- largura;
- altura;
- full-width vs contained;
- sobreposição;
- radius;
- bordas;
- sombras;
- espaçamento;
- densidade;
- composição interna;
- direção horizontal/vertical;
- forma dos tabs/pills/cards;
- hierarquia visual;
- estilo do cabeçalho de subcategoria;
- relação entre imagem, título, descrição, preço e CTA dentro do card de produto;
- tratamento visual da descrição/apresentação.

## 4.3 O que o template NÃO muda

Um template **não pode** alterar:

- produtos;
- categorias reais;
- subcategorias reais;
- preços;
- promoções;
- imagens escolhidas;
- vídeos;
- likes;
- dados da empresa;
- disponibilidade;
- busca;
- regras do carrinho/lista;
- publicação;
- Analytics;
- QR Code;
- planos;
- entitlements;
- auth;
- APIs;
- backend;
- segurança;
- RLS;
- regras de negócio.

Também não deve substituir arbitrariamente as **cores** ou **fontes** já escolhidas pelo usuário.

### Regra crítica

> Ao trocar de template, **cores e fontes são preservadas**.

O template interpreta esses tokens de forma diferente, mas não decide uma nova identidade cromática/tipográfica para o cliente.

---

# 5. O template precisa realmente mudar o layout

Template não é:

```text
mesmo layout
+ outro radius
+ outra sombra
+ outra cor
```

Template deve permitir diferenças como:

### Exemplo A — compacto

```text
logo superior pequena
hero contida
categorias em pills
subcategoria em accordion
produto horizontal compacto
```

### Exemplo B — hero imersiva

```text
hero quase edge-to-edge
logo centralizada e sobreposta no rodapé da hero
categorias abaixo em faixa horizontal
cards de produto mais visuais
```

### Exemplo C — editorial

```text
hero alta
logo discreta
muito espaço negativo
categorias tipográficas
subcategorias com divisores editoriais
cards mais planos e sofisticados
```

### Exemplo D — pixel/arcade

```text
hero com moldura temática
logo integrada ao frame
categorias como controles de jogo
subcategorias em headers pixelados
cards com linguagem 8-bit/arcade
```

A paleta e os conteúdos podem ser exatamente os mesmos em todos os exemplos.

O teste conceitual é:

> Se mostrarmos o mesmo restaurante em três templates, a pessoa deve perceber "três sites diferentes", não "o mesmo site com skins".

---

# 6. Regiões do template

## 6.1 Logo

O template pode definir:

- logo acima da hero;
- logo dentro da hero;
- logo sobreposta na borda inferior da hero;
- logo centralizada;
- logo alinhada à esquerda;
- avatar circular;
- logo em badge;
- logo sem frame;
- logo pequena, média ou protagonista.

Regras:

- preservar o arquivo original do estabelecimento;
- usar `object-fit: contain` quando aplicável;
- não deformar;
- reservar dimensões para evitar CLS;
- frame e backdrop podem mudar por template;
- não aplicar filtros que descaracterizem a marca sem opção explícita.

---

## 6.2 Hero Section

A hero é a capa visual do cardápio.

O template pode definir:

- contained;
- full-width;
- quase edge-to-edge;
- full-bleed;
- alta ou compacta;
- cantos retos ou arredondados;
- borda inferior curva;
- logo sobreposta;
- controles dentro ou fora da hero;
- diferentes proporções mobile/desktop.

A imagem hero não é trocada pelo template.

O template muda **como ela é apresentada**, não o conteúdo escolhido pelo usuário.

### Banners

O Design Editor atual permite configurar **até 5 banners** da Hero Section.

A interface atual indica rotação automática em aproximadamente **4,5 s**.

Ao implementar template novo:

- suportar 1 a 5 banners;
- não assumir que sempre haverá 5;
- manter indicadores discretos;
- não baixar todos os banners em prioridade alta;
- priorizar apenas o banner visível/necessário;
- reservar aspect ratio antes da imagem chegar;
- respeitar `prefers-reduced-motion`.

---

## 6.3 Descrição / apresentação

A descrição de apresentação é opcional.

Quando ativa, o template também controla sua apresentação visual.

Pode aparecer:

- abaixo da logo;
- abaixo da hero;
- em bloco editorial;
- dentro de card;
- em superfície glass controlada;
- centralizada;
- alinhada à esquerda;
- integrada ao cabeçalho.

O template pode alterar:

- posição;
- largura;
- tipografia aplicada aos tokens existentes;
- container;
- borda;
- background;
- spacing;
- alinhamento.

Se não houver descrição:

- não renderizar espaço vazio;
- o layout deve recompor naturalmente.

### Não confundir

- **Descrição do Negócio**: informação da área Empresa.
- **Descrição de Apresentação**: bloco visual configurável dentro do Design.

São conceitos diferentes e não devem ser mesclados automaticamente.

---

## 6.4 Categorias

O conteúdo continua sendo o mesmo, mas o template define sua estrutura visual.

Possibilidades:

- horizontal scroll;
- pills;
- tabs;
- cards;
- botões quadrados;
- ícone + texto;
- texto puro;
- imagem + texto;
- estilo editorial;
- estilo pixel/arcade;
- barra segmentada;
- navegação compacta sticky, quando fizer sentido.

Regras:

- mobile não pode gerar overflow não controlado;
- target de toque confortável;
- categoria ativa precisa ser identificável sem depender somente da cor;
- manter rolagem suave e sem handlers pesados;
- não fazer request de backend só porque o usuário trocou de categoria se os dados já existem localmente.

---

## 6.5 Subcategorias

O template pode renderizar subcategorias como:

- accordion;
- heading + divider;
- bloco editorial;
- painel;
- chip/header;
- seção independente;
- lista expansível.

O estado e o conteúdo da subcategoria continuam sendo dados reais do menu.

O template define apenas apresentação.

Regras:

- título legível;
- contador opcional se o produto atual expõe isso;
- `aria-expanded` quando houver accordion;
- área clicável confortável;
- estado aberto/fechado coerente;
- evitar animações de altura pesadas.

---

## 6.6 Cards / containers de produtos

Os cards podem variar bastante entre templates.

Direções permitidas:

### Horizontal compacto

```text
[foto] [nome + descrição + preço + CTA]
```

### Foto dominante

```text
[foto grande]
[nome]
[descrição]
[preço] [CTA]
```

### Editorial

```text
foto discreta + tipografia forte + divider
```

### Bento/modular

```text
cards com proporções diferentes dentro de uma lógica controlada
```

### Arcade/pixel

```text
moldura temática + hierarquia de game UI
```

### Regras comuns

Sempre preservar:

- nome;
- descrição disponível;
- preço;
- preço promocional quando houver;
- mídia;
- curtidas quando habilitadas;
- CTA existente;
- estados de disponibilidade;
- semântica.

Não inventar informações para preencher layout.

---

# 7. Registry de templates

O catálogo de templates é evolutivo.

Não manter uma lista rígida neste documento como autoridade.

Antes de qualquer implementação:

1. localizar o registry atual;
2. listar os templates realmente registrados;
3. verificar keys atuais;
4. reaproveitar o renderer existente;
5. adicionar o novo template sem duplicar regras.

### Templates conhecidos/referenciados no projeto recente

Exemplos já utilizados ou testados ao longo do projeto incluem:

- Modern;
- Minimal;
- Premium;
- Dark;
- Vitrine Compacta.

Essa lista **não é considerada completa nem definitiva**.

Novos templates são adicionados continuamente a partir de referências visuais.

---

# 8. Direções aprovadas para expansão de templates

Estas são direções criativas válidas para novos templates, desde que respeitem o contrato estrutural:

- Minimal Premium;
- Editorial Bistrô;
- Bento Moderno;
- Soft Clay;
- Retro Diner;
- Pixel / 8-bit;
- Arcade UI;
- Hero Imersiva;
- Vitrine Compacta;
- Premium Fotográfico;
- Flat Editorial;
- Street Food / Smash;
- Café artesanal;
- Açaí vibrante;
- Fine dining.

Esses nomes são **direções de design**, não necessariamente keys já implementadas.

---

# 9. Regra para implementar um novo template a partir de imagem

Quando o usuário fornecer uma imagem de referência:

## A referência manda apenas nas regiões do template

Extrair da imagem:

- posição/tamanho da logo;
- proporção e comportamento da hero;
- relação entre logo e hero;
- estilo/posição da descrição;
- categorias;
- subcategorias;
- composição dos cards;
- spacing;
- radius;
- bordas;
- sombras;
- densidade;
- hierarquia.

## Não copiar da referência elementos fora do contrato

Não alterar:

- cores escolhidas pelo estabelecimento;
- fontes escolhidas;
- dados;
- produtos;
- preços;
- imagens;
- vídeos;
- features;
- APIs;
- backend;
- segurança;
- rotas.

## Fidelidade

A imagem é a principal referência para a estrutura daquele template.

O objetivo é reproduzir sua lógica visual com alta fidelidade **usando o conteúdo real do PingoChef**.

---

# 10. Design Editor atual

A área Design do painel foi consolidada em seções/accordions.

A estrutura visual atual contém grupos equivalentes a:

1. **Estrutura & Template**
2. **Paleta de Cores**
3. **Tipografia**
4. **Blocos da Página**
5. **Recursos do Cardápio**
6. **Descrição de Apresentação**
7. **Banners da Hero Section**

A UI atual comunica explicitamente que **cores e fontes são preservadas** quando a estrutura/template é alterada.

### Comportamento do editor

- alterações visuais devem refletir no Preview ao Vivo;
- não salvar a cada micro interação se a arquitetura atual trabalha com edição local;
- usar o fluxo de `Salvar Alterações` existente;
- não inventar uma segunda lógica de rascunho se não existir no código atual;
- `Restaurar/Descartar`, quando disponível, deve voltar ao último estado persistido;
- o botão global `Publicar Cardápio` continua separado do ato de editar visualmente.

### Regra de implementação

Sempre descobrir no código atual:

- estado local do editor;
- estado persistido;
- endpoint real;
- serialização real;
- comportamento de publicação.

Não reconstruir os schemas históricos desta skill.

---

# 11. Paletas de cores

A interface atual do Design Editor informa **17 paletas harmônicas** e também permite personalização controlada das cores do cardápio.

O número e as keys reais devem ser obtidos do código.

## Regras

- paleta é independente do template;
- trocar template não troca paleta;
- não aplicar combinações que tornem texto ilegível;
- CTA, preço, surface e texto precisam continuar semanticamente distinguíveis;
- gerar estados hover/active/focus de forma consistente;
- cores de erro/sucesso continuam semânticas e não devem desaparecer por causa da paleta.

## Contraste

Meta WCAG AA:

- texto normal: `4.5:1`;
- texto grande: `3:1`;
- componentes/ícones essenciais: `3:1` quando aplicável.

Se a customização produzir contraste ruim:

1. avisar;
2. sugerir correção;
3. manter preview confiável;
4. não comprometer controles críticos.

---

# 12. Tipografia

O editor atual permite **até duas fontes distintas**:

- títulos/display;
- corpo/interface pública.

A biblioteca real de fontes deve ser obtida do registry atual.

## Regras

- carregar apenas as fontes realmente escolhidas;
- carregar somente os pesos usados;
- `font-display: swap` ou estratégia equivalente;
- fallback seguro;
- não permitir URL de fonte arbitrária do usuário;
- não baixar todas as famílias disponíveis no bootstrap do cardápio;
- template não altera a seleção feita pelo estabelecimento;
- template pode alterar escala/hierarquia, mas respeita a família escolhida.

---

# 13. Blocos da página pública

A Home pública é modular.

Blocos podem incluir, conforme implementação atual:

- Hero;
- Categorias;
- Mais Curtidos;
- Promoções & Ofertas;
- Pratos do Chef / Especialidades;
- Combos;
- Mais Vendidos;
- vitrines adicionais suportadas pelo projeto.

## Regras

- bloco desabilitado não deve ocupar espaço;
- bloco desabilitado não deve buscar asset desnecessário;
- ordem deve respeitar configuração atual;
- não mostrar título de seção sem conteúdo;
- template não altera quais blocos estão ativos;
- template apenas apresenta os conteúdos dentro da linguagem visual escolhida.

---

# 14. Recursos do cardápio

Recursos como:

- curtidas;
- carrinho/lista de intenção;
- vídeo;
- outros toggles suportados;

são funcionalidades, não propriedades do template.

O template pode estilizar o componente visível, mas não pode:

- habilitar recurso bloqueado;
- alterar entitlement;
- alterar lógica;
- transformar carrinho em checkout;
- mudar semântica de likes.

---

# 15. Área Empresa e identidade visual

A área Empresa é responsável por elementos de identidade que não pertencem diretamente ao Template Editor.

Atualmente inclui elementos equivalentes a:

- Logo da Empresa;
- nome do estabelecimento;
- slug/URL pública;
- descrição do negócio opcional;
- configuração visual da página de entrada/Welcome;
- salvar e sincronizar.

### Logo

A UI atual comunica que a logo é visível no cardápio e na experiência de Welcome.

### Welcome / fundo de entrada

O fluxo atual permite opções equivalentes a:

- imagem de fundo;
- cor sólida personalizada.

Não reintroduzir automaticamente opções antigas como gradiente/formatos extras se elas não estiverem no código atual.

Sempre seguir a implementação real.

---

# 16. Preview ao Vivo

O Preview ao Vivo é uma parte central do produto.

## Desktop

- permanece como coluna lateral/dedicada;
- mostra o cardápio dentro de um mockup de smartphone;
- deve refletir mudanças do editor rapidamente;
- deve representar o renderer real o mais próximo possível.

## Mobile do painel

A navegação móvel atual usa uma versão compacta do header.

Direção atual:

- botão/ícone PingoChef à esquerda;
- botão de Preview do celular ao lado;
- CTA `Publicar Cardápio` à direita;
- busca não funcional deve permanecer removida;
- Configurações e alternância dark/light ficam na sidebar/menu, não duplicadas no header móvel.

### Regra

Preview não pode implementar um segundo renderer visual incompatível com o público.

Ideal:

> mesma configuração + mesmos tokens + mesma estrutura de template.

---

# 17. Design System do painel — componentes

## Cards

Direção atual:

- `border-radius` geralmente entre 16–20 px em cards grandes;
- surfaces charcoal;
- borda sutil;
- sombra controlada;
- estados hover discretos;
- sem glow exagerado.

## Inputs

- boa separação da surface;
- foco visível;
- labels claras;
- estados de erro explícitos;
- controles grandes o suficiente no mobile.

## Botões

### Primário estrutural

Exemplo: `Publicar Cardápio`.

- vermelho/burgundy forte;
- contraste alto;
- ícone + label quando houver espaço;
- feedback `active` imediato.

### Secundário

- surface escura;
- border;
- cor de texto de alta legibilidade.

### Highlight PingoChef

- laranja/amber;
- usar em ações/destaques pontuais;
- não transformar todo CTA em laranja.

---

# 18. Mascote PingoChef

O mascote é parte oficial da identidade do produto.

## Uso

- onboarding;
- Home do dashboard;
- tutorial;
- loading;
- estados vazios especiais;
- feedback de sucesso;
- dicas.

## Regras

- usar assets oficiais;
- não redesenhar em CSS;
- não substituir por emoji;
- preservar proporção;
- `object-fit: contain`;
- fundo transparente quando asset exigir;
- animações discretas;
- não repetir mascote em todos os cards.

O mascote deve ter impacto porque aparece em momentos selecionados.

---

# 19. Tutorial visual do painel

O tutorial usa a identidade do PingoChef e faz parte do sistema visual.

Direção:

- overlay escurecido;
- spotlight no componente real;
- mascote animado/ilustrado;
- diálogo contextual;
- Próximo / Voltar / Pular;
- progresso;
- mobile com bottom sheet quando necessário.

## Regras

- spotlight ancorado ao DOM, nunca posição pixel fixa;
- não esconder o elemento explicado;
- não bloquear o target quando interação for necessária;
- não disparar ações destrutivas;
- `prefers-reduced-motion`;
- targets via identificadores estáveis, como `data-tour`;
- tutorial pode mudar de rota e abrir accordions, mas não criar dados fictícios.

---

# 20. Motion e microinterações

O PingoChef usa motion para dar qualidade, não para teatralizar a navegação.

## Curvas preferidas

Quando compatível com o Design System atual:

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-move: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

## Durações usuais

- hover/press: `120–220ms`;
- dialogs/cards: `180–300ms`;
- mascote/hero: `300–650ms` quando necessário;
- evitar transições longas acima de ~700 ms em UI comum.

## Propriedades

Preferir:

- `transform`;
- `opacity`;
- `background-color`;
- `border-color`.

Evitar:

- `transition: all`;
- animações de `width/height/top/left` quando não necessárias;
- loops decorativos agressivos.

## Reduced motion

Todos os templates e painel precisam respeitar:

```css
@media (prefers-reduced-motion: reduce) {
  /* remover shimmer/movimentos e reduzir transições não essenciais */
}
```

Não usar regra global destrutiva que possa quebrar componentes; reduzir motion de forma controlada.

---

# 21. Performance UX do cardápio público

Performance é requisito de template.

Um template visualmente bonito que deixa o menu lento é um template ruim.

## Fluxo desejado

```text
QR / link
↓
shell visível
↓
skeleton compatível com o template
↓
hero/categorias/primeiros produtos
↓
imagens entram progressivamente
↓
conteúdo abaixo da dobra
↓
vídeos somente após intenção
```

## Skeleton

Cada template precisa possuir skeleton coerente com seu layout.

Não usar skeleton universal com dimensões diferentes do conteúdo final.

Skeleton deve reservar:

- hero;
- categorias;
- cards;
- módulos;
- detalhe quando aplicável.

Evitar flicker em respostas extremamente rápidas.

## Imagens

- reservar `width/height` ou `aspect-ratio`;
- abaixo da dobra: `loading="lazy"` quando apropriado;
- `decoding="async"` quando apropriado;
- priorizar somente mídia crítica above-the-fold;
- não marcar todas as imagens como `fetchpriority="high"`;
- fallback elegante;
- nunca mostrar ícone quebrado do navegador.

## Vídeos

- poster primeiro;
- player somente após Play;
- `preload="none"` quando aplicável;
- não inicializar players para todos os produtos;
- não prefetch de vídeo.

Template não pode regredir essas otimizações.

---

# 22. Responsividade

## Prioridade de projeto

1. `360px`
2. `390px`
3. `430px`
4. tablet
5. desktop

O cardápio público deve parecer intencional em cada largura.

Não simplesmente reduzir o desktop.

## Regras

- targets de toque ~44 px quando possível;
- nada de horizontal scroll acidental;
- categorias horizontais precisam de scroll intencional;
- textos não podem ficar minúsculos;
- cards precisam recompor e não apenas encolher;
- hero pode mudar proporção por breakpoint;
- logo sobreposta não pode cobrir controles/texto;
- safe areas mobile devem ser respeitadas;
- produto não deve saltar de posição quando imagem carregar.

---

# 23. Estabilidade visual

Todo template deve minimizar CLS.

Reservar espaço para:

- logo;
- hero;
- imagem de produto;
- poster de vídeo;
- skeleton;
- badges.

Evitar:

```text
conteúdo aparece
↓
imagem chega
↓
página pula 200 px
```

---

# 24. Acessibilidade

Todo template precisa manter:

- HTML semântico;
- foco visível;
- teclado em desktop;
- contraste;
- `aria-label` em botões icon-only;
- `aria-expanded` em accordions;
- `aria-current` quando aplicável;
- alt adequado em imagens;
- estados não dependentes apenas de cor;
- reduced motion.

Estilo visual nunca justifica regressão de acessibilidade.

---

# 25. Theme e light/dark

Não confundir:

- **tema do dashboard PingoChef**;
- **paleta do cardápio do estabelecimento**.

O dashboard pode possuir light/dark controlado pela plataforma.

O cardápio público segue as cores selecionadas pelo negócio.

Trocar o tema do painel não deve modificar o cardápio público.

---

# 26. Modelo conceitual de TemplateConfig

Este modelo é apenas conceitual.

**Não substituir o schema real do projeto sem primeiro encontrá-lo.**

```ts
interface TemplateVisualContract {
  key: string;
  name: string;

  logo: {
    placement: string;
    size: string;
    frame: string;
  };

  hero: {
    layout: string;
    aspectRatioMobile: string;
    aspectRatioDesktop?: string;
    radius: string;
    logoOverlap?: boolean;
  };

  presentation: {
    placement: string;
    containerStyle: string;
    alignment: string;
  };

  categories: {
    layout: string;
    shape: string;
    density: string;
  };

  subcategories: {
    layout: string;
    dividerStyle: string;
  };

  productCards: {
    layout: string;
    mediaRatio: string;
    density: string;
    radius: string;
    shadow: string;
  };
}
```

O template deve consumir:

```text
conteúdo real
+ palette tokens
+ font tokens
+ resource flags
+ home blocks
```

sem duplicá-los.

---

# 27. Regras para adicionar um template novo

Ao receber uma referência visual:

1. localizar o renderer atual;
2. localizar registry/templates existentes;
3. identificar componentes compartilhados;
4. mapear apenas as regiões alteráveis;
5. definir nova key sem quebrar existentes;
6. preservar paleta/fontes;
7. preservar dados e regras;
8. criar/ajustar skeleton compatível;
9. validar mobile primeiro;
10. validar preview ao vivo;
11. validar cardápio público real;
12. executar typecheck/build/testes;
13. testar template anterior para garantir ausência de regressão.

---

# 28. Critérios de aceitação de template

Um template só está pronto quando:

- [ ] muda estruturalmente logo/hero/categorias/subcategorias/cards conforme referência;
- [ ] descrição opcional tem tratamento coerente;
- [ ] paleta é preservada;
- [ ] fontes são preservadas;
- [ ] conteúdo é preservado;
- [ ] sem quebra de busca;
- [ ] sem quebra de likes;
- [ ] sem quebra de vídeo;
- [ ] sem quebra de preços/promos;
- [ ] sem quebra de estados vazios;
- [ ] skeleton corresponde ao layout;
- [ ] não há CLS evidente;
- [ ] mobile 360/390/430 validado;
- [ ] tablet validado;
- [ ] desktop validado;
- [ ] preview e público são coerentes;
- [ ] reduced motion funciona;
- [ ] contraste continua aceitável;
- [ ] build passa;
- [ ] templates antigos continuam funcionando.

---

# 29. O que NÃO fazer

Nunca:

- recriar um backend por template;
- duplicar lógica de produto;
- hardcodar dados da referência visual;
- trocar cores do cliente ao trocar template;
- trocar fontes do cliente ao trocar template;
- criar HTML arbitrário configurável;
- permitir JS/CSS arbitrário do usuário;
- permitir controle pixel a pixel;
- carregar todos os vídeos na abertura;
- carregar todas as fontes da biblioteca;
- criar template que só funciona no desktop;
- usar animação pesada para compensar layout ruim;
- introduzir dependência grande apenas para um efeito visual;
- alterar RLS, auth ou entitlements por motivo estético;
- tratar imagem de referência como ordem para mudar funcionalidades fora do escopo de template.

---

# 30. Linguagem visual do cardápio como produto

O objetivo visual final deve seguir esta hierarquia:

```text
MARCA DO ESTABELECIMENTO
        ↓
PRODUTO / FOTO / VÍDEO
        ↓
NAVEGAÇÃO
        ↓
PREÇO / DESTAQUE
        ↓
INTERAÇÃO
        ↓
PINGOCHEF COMO INFRAESTRUTURA
```

O consumidor não precisa perceber a complexidade do SaaS.

Ele precisa perceber:

- rapidez;
- identidade;
- desejo;
- clareza;
- consistência;
- facilidade.

---

# 31. Referência rápida para agentes/Codex

Quando a tarefa for "implementar este template da imagem":

> Analise primeiro o renderer e o registry reais. A referência visual define apenas o que pertence ao contrato do template: logo, hero, descrição/apresentação opcional, categorias, subcategorias e cards/containers de produto. Preserve paleta, fontes, dados, imagens, vídeos, likes, preços, busca, features, APIs, segurança e regras. Reproduza posicionamento, proporções, bordas, espaçamentos, hierarquia e composição com alta fidelidade, mobile-first, sem quebrar skeleton/performance, preview ou templates existentes.

---

# 32. Documentos relacionados

- `06-EXPERIENCIA-PUBLICA.md` — renderização e UX do consumidor.
- `04-CARDAPIO-CONTEUDO.md` — conteúdo exibido pelos templates.
- `08-BANCO-DADOS-RLS.md` — persistência e segurança.
- `03-PAINEL-USUARIO.md` — Dashboard, Preview ao Vivo e Editor de Design.
- documentação de performance pública — skeleton, imagens, lazy loading e Web Vitals.
- documentação de vídeo — poster/playback e segurança Mux.

---

## Resumo operacional

O Design System atual do PingoChef se baseia em duas ideias:

1. **O painel tem identidade PingoChef forte e consistente.**
2. **O cardápio público deve ser estruturalmente personalizável e visualmente pertencer ao estabelecimento.**

Templates são ferramentas de composição, não skins e não motores de negócio.

A evolução futura do catálogo deve aumentar diversidade estrutural sem sacrificar:

- velocidade;
- acessibilidade;
- mobile;
- consistência;
- segurança;
- manutenção;
- identidade do cliente.
