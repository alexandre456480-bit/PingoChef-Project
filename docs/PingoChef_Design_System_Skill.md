# PingoChef — Skill de Design System, UI & UX

Este documento define o padrão visual e de experiência das áreas controladas pelo próprio PingoChef, incluindo autenticação, Dashboard, configurações, onboarding, planos, Analytics, QR Code, modais, estados de carregamento, telas de erro e área administrativa.

O cardápio público possui seu próprio sistema de templates e personalização e não deve ser forçado a seguir esta linguagem visual.

Este guia funciona como base, não como limitação absoluta. Sempre que uma solução diferente produzir melhor clareza, acessibilidade ou experiência, a decisão profissional de design deve prevalecer.

---

## 1. Princípio visual

A identidade do painel PingoChef deve ser baseada principalmente em:

**Neomorphism suave + Claymorphism controlado.**

O objetivo não é reproduzir o neomorphism clássico de baixo contraste. O efeito deve ser moderno, legível e utilizável.

A interface precisa transmitir:

**amigável → premium → tecnológica → simples → confiável.**

Claymorphism será utilizado principalmente para criar personalidade em elementos interativos e superfícies importantes.

Neomorphism será utilizado para integrar superfícies ao fundo através de sombras suaves e sensação de profundidade.

O efeito nunca deve prejudicar contraste, legibilidade, hierarquia ou percepção de elementos clicáveis.

---

## 2. Hierarquia visual

A interface deve funcionar em quatro níveis principais de profundidade:

```text
NÍVEL 0
Background principal

        ↓

NÍVEL 1
Superfícies / containers

        ↓

NÍVEL 2
Cards e elementos interativos

        ↓

NÍVEL 3
CTA / elementos em destaque
```

Evitar fazer cada elemento parecer elevado. Se tudo tiver sombra forte, nada terá hierarquia.

---

## 3. Paleta oficial

A identidade principal continua baseada em **Dark Plum + Burgundy + Orange + Cream**.

| Token | Cor | Uso |
|---|---|---|
| `brand-plum` | `#2C1024` | Background escuro, navegação |
| `brand-plum-deep` | `#1D0A18` | Áreas de maior profundidade |
| `brand-burgundy` | `#691525` | Destaques estruturais |
| `brand-burgundy-soft` | `#8A2338` | Hover, gráficos e elementos secundários |
| `brand-orange` | `#F47B20` | CTA principal |
| `brand-orange-hover` | `#E96B12` | Hover do CTA |
| `brand-orange-soft` | `#FFAB66` | Highlights |
| `brand-cream` | `#F7EEE7` | Background Light |
| `brand-cream-soft` | `#FFF9F4` | Superfícies claras |
| `brand-rose` | `#C86F70` | Accent auxiliar |

O laranja é principalmente uma cor de **ação**, portanto deve chamar atenção deliberadamente. Não utilizar laranja em dezenas de elementos simultâneos.

---

## 4. Sistema de temas

Light e Dark devem possuir o mesmo DNA visual, porém não devem ser simplesmente cores invertidas.

### Light Theme

```css
:root,
[data-theme="light"] {
  --bg-primary: #F7EEE7;
  --bg-secondary: #F1E4DC;

  --surface-primary: #FFF9F4;
  --surface-secondary: #F9EEE7;
  --surface-raised: #FFFFFF;

  --sidebar-bg: #2C1024;
  --sidebar-surface: #351329;

  --text-primary: #2D1B2E;
  --text-secondary: #725F68;
  --text-muted: #95858C;
  --text-inverse: #FFF8F3;

  --brand-primary: #691525;
  --brand-secondary: #8A2338;

  --accent-primary: #F47B20;
  --accent-hover: #E96B12;
  --accent-soft: #FFAB66;

  --border-soft: rgba(74, 38, 57, 0.10);
  --border-medium: rgba(74, 38, 57, 0.16);

  --success: #26855B;
  --warning: #D99122;
  --danger: #C94A55;
  --info: #5B72C9;
}
```

No Light Theme, o painel deve transmitir **creme + branco quente + vinho + laranja**. Evitar branco puro como background geral.

### Dark Theme

```css
[data-theme="dark"] {
  --bg-primary: #180B15;
  --bg-secondary: #21101D;

  --surface-primary: #281320;
  --surface-secondary: #311725;
  --surface-raised: #391B2B;

  --sidebar-bg: #130911;
  --sidebar-surface: #21101D;

  --text-primary: #FFF7F2;
  --text-secondary: #CEBBC4;
  --text-muted: #9F8C95;
  --text-inverse: #26121F;

  --brand-primary: #8F263E;
  --brand-secondary: #B33D54;

  --accent-primary: #F47B20;
  --accent-hover: #FF8B38;
  --accent-soft: #FFAE6B;

  --border-soft: rgba(255, 255, 255, 0.06);
  --border-medium: rgba(255, 255, 255, 0.10);

  --success: #5BC38A;
  --warning: #E4A94D;
  --danger: #EB6672;
  --info: #8195E8;
}
```

Evitar `#000000` como background principal. O Dark Theme deve trabalhar com tons de ameixa e vinho quase pretos.

---

## 5. Superfícies e Neomorphism

O neomorphism do PingoChef deve ser extremamente suave.

### Light

```css
.neo-surface {
  background: var(--surface-primary);
  border: 1px solid var(--border-soft);
  border-radius: 20px;

  box-shadow:
    8px 8px 18px rgba(93, 56, 70, 0.08),
    -6px -6px 16px rgba(255, 255, 255, 0.72);
}
```

### Dark

```css
[data-theme="dark"] .neo-surface {
  background: var(--surface-primary);
  border: 1px solid var(--border-soft);

  box-shadow:
    8px 8px 18px rgba(0, 0, 0, 0.25),
    -4px -4px 12px rgba(255, 255, 255, 0.025);
}
```

No Dark Theme, a sombra clara superior deve ser quase imperceptível. Nunca criar o efeito clássico de plástico cinza do neomorphism antigo.

---

## 6. Claymorphism

Claymorphism representa os elementos mais importantes e interativos.

Exemplos adequados:

- CTA principal;
- plano recomendado;
- cards de onboarding;
- cards de métricas;
- botões importantes;
- feature previews;
- cards de recursos;
- badges premium.

```css
.clay-card {
  background: var(--surface-raised);
  border: 1px solid var(--border-soft);
  border-radius: 22px;

  box-shadow:
    0 10px 26px rgba(44, 16, 36, 0.10),
    inset 1px 1px 0 rgba(255, 255, 255, 0.22);

  transition:
    transform 180ms cubic-bezier(0.23, 1, 0.32, 1),
    box-shadow 180ms cubic-bezier(0.23, 1, 0.32, 1);
}
```

Dark:

```css
[data-theme="dark"] .clay-card {
  box-shadow:
    0 12px 30px rgba(0, 0, 0, 0.28),
    inset 1px 1px 0 rgba(255, 255, 255, 0.035);
}
```

Claymorphism não significa adicionar cinco sombras diferentes. A profundidade deve continuar elegante.

---

## 7. Glassmorphism

Glassmorphism deixa de ser linguagem principal.

Pode aparecer apenas em situações específicas:

- modal sobre conteúdo;
- popover;
- floating toolbar;
- toast;
- overlay;
- feature presentation.

Nunca utilizar glassmorphism em tabelas inteiras, Dashboard inteiro, inputs comuns, todos os cards ou Analytics principal.

```css
.frosted-surface {
  background: color-mix(
    in srgb,
    var(--surface-raised) 82%,
    transparent
  );

  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);

  border: 1px solid var(--border-soft);
}
```

---

## 8. Border Radius

```css
--radius-xs: 8px;
--radius-sm: 12px;
--radius-md: 16px;
--radius-lg: 20px;
--radius-xl: 24px;
--radius-pill: 999px;
```

Uso recomendado:

- Inputs: `12–14px`
- Botões: `12–16px`
- Cards: `18–22px`
- Cards especiais: `24px`
- Modal: `24px`
- Badges/Pills: `999px`

---

## 9. Espaçamento

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
```

Cards principais normalmente utilizam `20–24px` em mobile e `24–32px` em desktop.

---

## 10. Tipografia

### Outfit

Usar em títulos, KPIs, preços, CTAs e títulos de cards.

### Inter

Usar em parágrafos, labels, inputs, tabelas, descrições, dados secundários e tooltips.

```css
--text-xs: 12px;
--text-sm: 14px;
--text-base: 16px;
--text-lg: 18px;
--text-xl: 22px;
--text-2xl: 28px;
--text-3xl: 36px;
```

Números importantes de Analytics podem chegar a `36–48px` em desktop.

---

## 11. Botões

### Primary

```css
.button-primary {
  background: linear-gradient(135deg, #F58B38, #F47B20);
  color: #FFFFFF;
  border-radius: 14px;

  box-shadow:
    0 7px 16px rgba(244, 123, 32, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.24);

  transition:
    transform 160ms cubic-bezier(0.23, 1, 0.32, 1),
    box-shadow 160ms cubic-bezier(0.23, 1, 0.32, 1);
}

.button-primary:hover {
  transform: translateY(-1px);
}

.button-primary:active {
  transform: translateY(1px);
}
```

### Secondary

Usar `surface-secondary`, `border-soft` e texto principal.

### Ghost

Para ações de baixa prioridade como Cancelar, Voltar e Fechar.

### Danger

Somente para Excluir, Revogar e Suspender. Não usar vermelho para ações comuns.

---

## 12. Inputs

### Light

```css
.input {
  background: #F4E8E1;
  border: 1px solid rgba(74, 38, 57, 0.08);

  box-shadow:
    inset 3px 3px 7px rgba(96, 59, 70, 0.07),
    inset -3px -3px 7px rgba(255, 255, 255, 0.65);
}
```

### Dark

```css
[data-theme="dark"] .input {
  background: #21101D;

  box-shadow:
    inset 3px 3px 7px rgba(0, 0, 0, 0.22),
    inset -2px -2px 5px rgba(255, 255, 255, 0.02);
}
```

Focus deve usar borda laranja e focus ring suave. Nunca depender apenas de mudança de cor.

---

## 13. Sidebar

A sidebar é uma assinatura visual do PingoChef.

No Light Theme, **manter a sidebar escura**.

```text
LIGHT
sidebar dark
conteúdo cream/light

DARK
sidebar dark
conteúdo plum/dark
```

Isso melhora consistência visual entre temas e combina com a versão clara da logo.

### Item ativo

```css
.sidebar-item.active {
  background:
    linear-gradient(
      135deg,
      rgba(244,123,32,.18),
      rgba(244,123,32,.08)
    );

  border: 1px solid rgba(244,123,32,.22);
  color: #FF9A4A;
}
```

---

## 14. Ícones

Utilizar preferencialmente **Lucide Angular**.

Nunca emoji como ícone permanente de interface.

Tamanhos:

- `16px` → inline;
- `18–20px` → navegação;
- `22–24px` → ações importantes;
- `28–32px` → empty states.

Espessura normalmente: `1.75–2px`.

---

## 15. Cards de métricas

Analytics exige uma versão mais disciplinada do claymorphism.

Exemplo:

```text
Visualizações

4.281

+13,4%
vs período anterior
```

O container pode ter profundidade. Os dados não.

Evitar gradiente forte atrás do gráfico, glow em cada número, ícones gigantes e múltiplas cores competindo.

Analytics precisa parecer ferramenta de decisão.

---

## 16. Gráficos

Cores sugeridas:

- principal → laranja;
- comparação → burgundy/rose;
- secundário → plum claro;
- positivo → verde;
- negativo → vermelho.

Evitar paletas multicoloridas aleatórias.

Linhas: `2–3px`.

Grid: muito discreto.

Tooltips devem seguir o mesmo padrão clay/neomorphic de superfícies.

---

## 17. Tabelas

Tabelas devem ser visualmente mais simples que os cards.

Não aplicar claymorphism em cada célula.

```text
Container elevado
↓
Header discreto
↓
Linhas planas
↓
Hover sutil
```

Especialmente em Analytics, Admin, Clientes, Convites, Assinaturas e Auditoria.

---

## 18. Modais

Modal:

- radius `22–24px`;
- `surface-raised`;
- sombra forte porém difusa.

Backdrop:

```css
background: rgba(10, 5, 10, 0.48);
backdrop-filter: blur(4px);
```

Não utilizar modais gigantes para tudo.

Configurações pode utilizar um modal/painel grande por possuir estrutura própria.

---

## 19. Configurações

A tela de Configurações deve seguir inspiração estrutural em aplicações modernas como ChatGPT, sem copiar visualmente.

```text
┌─────────────────────────────────────────┐
│ Configurações                           │
├───────────────┬─────────────────────────┤
│ Conta         │                         │
│ Plano e uso   │ conteúdo               │
│ Segurança     │                         │
│ Suporte       │                         │
│ Conta         │                         │
└───────────────┴─────────────────────────┘
```

Desktop: navegação lateral interna.

Mobile: seções empilhadas.

Poucos efeitos visuais. Configurações deve priorizar clareza.

---

## 20. Pricing

A página de planos pode utilizar claymorphism de maneira mais expressiva.

Plano Medium:

- levemente elevado;
- borda laranja;
- badge `Mais recomendado`;
- CTA mais destacado.

Evitar card muito maior, animação constante ou glow exagerado.

O usuário ainda deve conseguir comparar todos os planos facilmente.

---

## 21. Feature Locked

Analytics e QR Code bloqueados devem possuir linguagem visual específica.

Primeiro: demonstração visual curta.

Depois:

- benefício;
- plano necessário;
- CTA.

O lock não deve parecer um erro.

Pode utilizar surface, mockup, ícone de cadeado Lucide e accent orange.

---

## 22. Empty States

Utilizar o PingoChef de forma funcional.

Pode mostrar mascote + CTA em estados como `Nenhum produto ainda`.

Não usar mascote em erro crítico, pagamento recusado, problema de segurança ou confirmação de exclusão.

Nesses casos, prioridade é clareza.

---

## 23. Loading

Loader principal continua sendo o PingoChef correndo com o cloche.

Utilizar principalmente em:

- entrada do Dashboard;
- editor;
- operações de tela inteira;
- publicação.

Não utilizar para micro-requests.

Pequenas ações podem utilizar skeleton, progress indicator ou spinner minimalista.

---

## 24. Skeleton

Skeleton deve respeitar o tema.

Light: `cream → off-white`.

Dark: `plum → plum-light`.

Animação discreta. Não utilizar shimmer extremamente brilhante.

---

## 25. Motion System

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-move: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

Durações:

- Button feedback: `100–160ms`
- Hover: `150–200ms`
- Dropdown: `150–250ms`
- Card transition: `180–260ms`
- Modal: `200–350ms`
- Drawer: `250–400ms`
- Feature demo: contextual

Preferir `transform` e `opacity`.

Evitar animação de `width`, `height`, `top`, `left`, `margin` e `padding` quando transform puder resolver.

Nunca utilizar:

```css
transition: all;
```

---

## 26. Reduced Motion

Obrigatório:

```css
@media (prefers-reduced-motion: reduce)
```

Nesse modo:

- remover movimentos de entrada grandes;
- remover bounce;
- reduzir feature previews;
- loader do mascote pode usar frame estático;
- preservar apenas feedback essencial.

---

## 27. Light/Dark transition

Troca de tema deve ser rápida e discreta.

Pode utilizar aproximadamente `150–200ms` em:

- `background-color`;
- `border-color`;
- `color`;
- `box-shadow`.

Evitar fazer a aplicação inteira piscar ou executar animações complexas.

---

## 28. Acessibilidade

Claymorphism e neomorphism não podem reduzir contraste.

Elementos clicáveis sempre precisam possuir pelo menos uma indicação além da sombra:

- cor;
- borda;
- texto;
- ícone;
- focus state.

```css
:focus-visible {
  outline: 3px solid rgba(244, 123, 32, 0.38);
  outline-offset: 2px;
}
```

Não remover outline sem substituição.

---

## 29. Estados semânticos

| Estado | Uso |
|---|---|
| Success | publicação concluída, ativo |
| Warning | próximo do limite, grace |
| Danger | erro, exclusão, bloqueio |
| Info | orientação |
| Neutral | estados normais |

Não usar laranja para tudo, pois ele já é CTA da marca.

---

## 30. Responsividade

O painel deve ser desenvolvido desktop-first visualmente, mas responsivo desde o componente.

Breakpoints aproximados:

```text
Mobile      < 640px
Tablet      640–1024px
Desktop     1024–1440px
Wide        > 1440px
```

Evitar depender rigidamente desses valores se container queries resolverem melhor o componente.

---

## 31. Bento Grid

Bento continua apropriado para Dashboard.

Porém os cards devem variar de tamanho por importância, não apenas por estética.

```text
┌───────────┬───────────────┐
│ Status    │ Onboarding    │
├─────┬─────┼───────────────┤
│Prod │Cat. │ Plano / Uso   │
└─────┴─────┴───────────────┘
```

Analytics pode utilizar grid semelhante, mas mais regular.

---

## 32. Logo

Utilizar:

```text
logo normal
→ superfícies claras

logo com wordmark clara
→ superfícies escuras
```

Nunca colocar a versão escura do texto sobre sidebar escura.

A logo não deve possuir sombra exagerada.

Animação de float só deve aparecer em telas onde ela tenha propósito, principalmente autenticação/onboarding.

Não manter logo flutuando continuamente no Dashboard.

---

## 33. Regra final de consistência

Antes de criar qualquer componente novo, verificar se já existe um padrão para:

- button;
- input;
- card;
- modal;
- tooltip;
- dropdown;
- badge;
- table;
- empty state;
- loading;
- toast.

Não criar dez variações visualmente diferentes para a mesma função.

O Design System deve possuir componentes base reutilizáveis.

---

## 34. Diretriz conceitual final

O visual do PingoChef deixa de ser:

> “um sistema claro com alguns efeitos glass/clay”

E passa a ser:

> **uma interface PingoChef construída sobre superfícies neomórficas suaves, componentes clay com personalidade e identidade adaptativa Light/Dark.**

### Dark

```text
Dark Plum background
      ↓
Burgundy/plum surfaces
      ↓
soft depth
      ↓
cream typography
      ↓
orange CTA
      ↓
clay highlights
```

### Light

```text
Warm Cream background
      ↓
warm white surfaces
      ↓
soft neomorphic depth
      ↓
dark plum typography
      ↓
orange CTA
      ↓
burgundy accents
```

A sidebar deve permanecer escura mesmo no Light Theme, funcionando como assinatura visual persistente da marca.

---

## 35. Regra de atuação da skill

Sempre que esta skill for utilizada para criar, revisar ou refatorar uma interface do PingoChef:

1. analise primeiro a função da tela;
2. identifique a hierarquia de informação;
3. use este design system como base;
4. preserve a identidade visual atual do painel;
5. não aplique clay/neomorphism por decoração;
6. privilegie usabilidade e contraste;
7. adapte corretamente para Light e Dark;
8. mantenha consistência com componentes existentes;
9. use animações apenas quando ajudarem a compreensão;
10. valide desktop, tablet e mobile;
11. valide `prefers-reduced-motion`;
12. valide foco, contraste e navegação por teclado;
13. evite emojis;
14. use ícones profissionais, preferencialmente Lucide Angular;
15. não copie interfaces externas literalmente;
16. preserve personalidade própria do PingoChef.
