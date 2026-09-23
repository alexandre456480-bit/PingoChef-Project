# 🍽️ 04 — Cardápio e Conteúdo

> **Domínio**: Categorias, produtos, promoções, atributos, ordenação, estados e regras de conteúdo.  
> **Depende de**: [01-ARQUITETURA-GERAL.md](./01-ARQUITETURA-GERAL.md), [03-PAINEL-USUARIO.md](./03-PAINEL-USUARIO.md), [08-BANCO-DADOS-RLS.md](./08-BANCO-DADOS-RLS.md)  
> **Referenciado por**: [05-DESIGN-SYSTEM-TEMPLATES.md](./05-DESIGN-SYSTEM-TEMPLATES.md), [06-EXPERIENCIA-PUBLICA.md](./06-EXPERIENCIA-PUBLICA.md), [09-API-CONTRATOS.md](./09-API-CONTRATOS.md)

---

## 1. Visão Geral

O conteúdo do cardápio é composto por **categorias** e **produtos (itens de menu)**. O usuário gerencia tudo pelo painel (`/painel/menu`), trabalhando sempre com dados de **rascunho**. Somente após publicação os dados se tornam visíveis no cardápio público.

```
                    PAINEL (rascunho)                      PÚBLICO (snapshot)
┌──────────────────────────────────────┐        ┌─────────────────────────────┐
│  Categorias ─┬── Produtos           │        │                             │
│              ├── Produtos           │  ───▶  │  Snapshot imutável          │
│              └── Produtos           │ Publicar│  lido de menu_publications  │
│  Categorias ─┬── Produtos           │        │                             │
│              └── Produtos           │        │                             │
└──────────────────────────────────────┘        └─────────────────────────────┘
```

---

## 2. Categorias

### Campos

| Campo          | Tipo             | MVP                                      | Futuro                    |
|----------------|------------------|------------------------------------------|---------------------------|
| `id`           | UUID             | PK, gerado automaticamente               | —                         |
| `business_id`  | UUID (FK)        | Referência ao tenant                      | —                         |
| `name`         | varchar(100)     | Obrigatório, sanitizado (único campo de texto) | —                    |
| `icon_type`    | varchar(20)      | `'2d'`, `'3d'`, `'image'`, `'none'` (default `'2d'`) | —             |
| `icon_key`     | varchar(100)     | Chave do catálogo curado (`2d-burger`, `3d-pizza`, etc.) | —          |
| `image_url`    | varchar(500)     | URL da imagem customizada (se `icon_type = 'image'`) | Upload direto Storage |
| `display_mode` | enum             | `icon`, `name`, `icon_name`               | —                         |
| `position`     | integer          | Ordem de exibição (drag & drop)           | —                         |
| `is_active`    | boolean          | Ativa/inativa                             | —                         |
| `description`  | text             | Descontinuado na UI simples               | —                         |

### Regras

- **Edição Simplificada de Categoria**: A interface de edição no painel possui **apenas o Nome** e o **Seletor de Ícone** do catálogo (sem poluição com campos secundários).
- **Catálogo de Ícones Expandido**:
  - Distribuído nas abas **Ícones 2D** (vetores modernos com traço fino e limpo) e **Ícones 3D** (renderização volumétrica rica com gradientes e sombras táteis).
  - Pesquisa em tempo real com filtros por nome e tags culinárias (ex: "burger", "chopp", "sobremesa").
- **Flexibilidade Total de Exibição**:
  - **Ícone do Catálogo**: Escolha entre centenas de ícones 2D e 3D curados.
  - **Colocar Imagem**: O usuário pode definir uma imagem própria em vez de um ícone.
  - **Desativar Ícone**: Modo "Sem Ícone", exibindo apenas o texto do nome da categoria.
- **Posição**: Gerenciada por ordenação no painel.
- **Ativa/Inativa**: Categorias inativas não aparecem no cardápio público nem no preview.

### Limites Técnicos

| Limite                   | Valor inicial  | Notas                                         |
|--------------------------|----------------|-----------------------------------------------|
| Categorias por business  | **100**        | Configurável, não hardcoded na interface       |
| Nome mínimo              | 2 caracteres   | Sanitizado contra XSS                         |
| Nome máximo              | 100 caracteres | —                                              |

### Biblioteca de Ícones Curada (2D e 3D)

O catálogo inclui dezenas de ícones organizados por grupos culinários:

| Grupo Culinário     | Ícones 2D Disponíveis                   | Ícones 3D Volumétricos Disponíveis      |
|---------------------|-----------------------------------------|-----------------------------------------|
| Lanches & Fast Food | `2d-burger`, `2d-hotdog`, `2d-fries`, `2d-sandwich` | `3d-burger`, `3d-hotdog`, `3d-fries` |
| Bebidas & Bar       | `2d-beer`, `2d-cocktail`, `2d-coffee`, `2d-soda`   | `3d-beer`, `3d-cocktail`, `3d-coffee` |
| Pratos & Carnes     | `2d-dish`, `2d-chicken`, `2d-fish`      | `3d-steak`, `3d-chicken`                |
| Pizzas & Massas     | `2d-pizza`, `2d-pasta`                  | `3d-pizza`                              |
| Sobremesas & Doces  | `2d-dessert`, `2d-icecream`             | `3d-dessert`                            |
| Saudável & Veg      | `2d-salad`, `2d-vegan`                  | `3d-salad`                              |
| Especiais & Bar     | `2d-fire`, `2d-star`                    | `3d-fire`, `3d-crown`                   |

---

## 3. Produtos (Menu Items)

### Campos

| Campo              | Tipo          | MVP                                              | Futuro                              |
|--------------------|---------------|--------------------------------------------------|--------------------------------------|
| `id`               | UUID          | PK                                                | —                                    |
| `business_id`      | UUID (FK)     | Tenant                                            | —                                    |
| `category_id`      | UUID (FK)     | Categoria pai                                     | —                                    |
| `name`             | varchar(150)  | Recomendado mas pode ser flexível conforme tela   | —                                    |
| `description`      | text          | Opcional; max 1000 chars; sem HTML                 | —                                    |
| `price_cents`      | integer       | **Pode ser null** → modo "consultar estabelecimento" | Moedas adicionais quando houver demanda |
| `promo_price_cents` | integer      | Preço promocional opcional                         | —                                    |
| `media_path`       | varchar       | Caminho da foto no Storage                         | Galeria de múltiplas fotos           |
| `position`         | integer       | Ordem de exibição dentro da categoria              | —                                    |
| `is_active`        | boolean       | Ativa/inativa                                      | Agenda de disponibilidade            |

### Campos Futuros (preparar no schema, não expor na UI)

| Campo             | Tipo       | Descrição                                      |
|-------------------|------------|-------------------------------------------------|
| `video_path`      | varchar    | Vídeo do produto                                |
| `gallery_paths`   | jsonb      | Array de caminhos de imagens adicionais         |
| `complement_ids`  | jsonb      | IDs de complementos/adicionais                  |
| `tags`            | jsonb      | Etiquetas/labels (vegano, picante, etc.)        |

### Regras de Preço

| Cenário                  | `price_cents` | `promo_price_cents` | Exibição                                  |
|--------------------------|---------------|---------------------|-------------------------------------------|
| Preço normal             | 1500          | null                | R$ 15,00                                  |
| Preço com promoção       | 2000          | 1500                | ~~R$ 20,00~~ R$ 15,00                    |
| Sem preço (consultar)    | null          | null                | "Consulte o estabelecimento"              |
| Preço oculto             | 0             | null                | Definir por config se mostra R$ 0 ou oculta |

> **Preço em centavos** (integer): evita problemas de ponto flutuante. `1500` = R$ 15,00.

### Validações de Segurança

- `category_id` **deve** pertencer ao mesmo `business_id` do produto → FK composta ou trigger que impede categoria de outro tenant
- `price_cents >= 0` quando não null
- `promo_price_cents < price_cents` quando ambos presentes
- Descrição sem HTML arbitrário; escape e sanitização contextual
- Nome sanitizado contra XSS

---

## 4. Atributos do Produto

| Campo      | Tipo         | Exemplos                                |
|------------|--------------|------------------------------------------|
| `item_id`  | UUID (FK)    | Produto pai                              |
| `type`     | enum/string  | `serves`, `volume`, `weight`, `prep_time`|
| `value`    | varchar      | "2", "500", "300", "30"                  |
| `unit`     | varchar      | "pessoas", "ml", "g", "min"             |
| `position` | integer      | Ordem de exibição                        |

### Tipos Aprovados

| Tipo        | Label sugerido        | Exemplo               |
|-------------|------------------------|------------------------|
| `serves`    | Serve X pessoas       | Serve 2 pessoas        |
| `volume`    | Volume                | 500ml                  |
| `weight`    | Peso                  | 300g                   |
| `prep_time` | Tempo de preparo      | 30 min                 |

> Sem HTML arbitrário nos valores. Tipos tipados ou de catálogo controlado.

---

## 5. Promoções

### Campos

| Campo        | Tipo       | Descrição                                         |
|--------------|------------|---------------------------------------------------|
| `business_id`| UUID (FK)  | Tenant                                             |
| `item_id`    | UUID (FK)  | Produto em promoção (ou config para promoção geral)|
| `starts_at`  | timestamp  | Início da promoção                                 |
| `ends_at`    | timestamp  | Fim da promoção (`ends_at > starts_at`)            |
| `enabled`    | boolean    | Ativa/inativa                                      |
| `config`     | jsonb      | Configurações adicionais (contador, label, etc.)   |

### Regras

- **Validade real vem do servidor** — frontend pode mostrar countdown mas não decide se promoção está ativa
- `ends_at > starts_at` validado no banco e na API
- Promoção pode ter intervalo e contador visual
- Preço anterior vs. atual exibido automaticamente quando `promo_price_cents` está presente no item

---

## 6. Operações CRUD no Painel

### Categorias

| Operação   | Endpoint                           | Notas                                       |
|------------|-------------------------------------|----------------------------------------------|
| Listar     | `GET /api/private/categories`      | Paginado; ordenado por `position`            |
| Criar      | `POST /api/private/categories`     | Validação server-side; posição automática    |
| Editar     | `PATCH /api/private/categories/:id`| Somente campos permitidos; tenant verificado |
| Excluir    | `DELETE /api/private/categories/:id`| Soft delete; verificar dependências          |
| Reordenar  | `PATCH /api/private/categories/reorder` | Array de IDs na nova ordem              |

### Produtos

| Operação   | Endpoint                           | Notas                                       |
|------------|-------------------------------------|----------------------------------------------|
| Listar     | `GET /api/private/items`           | Por categoria ou todos; paginado             |
| Criar      | `POST /api/private/items`          | `category_id` validado contra tenant         |
| Editar     | `PATCH /api/private/items/:id`     | Campos allowlist; foto via endpoint separado |
| Excluir    | `DELETE /api/private/items/:id`    | Soft delete                                  |
| Reordenar  | `PATCH /api/private/items/reorder` | Array de IDs na nova ordem                   |
| Upload foto| `POST /api/private/items/:id/media`| Validação server-side de imagem              |

---

## 7. Ordenação (Drag & Drop)

### Implementação

- No Angular: biblioteca de drag & drop (CDK ou similar)
- Ao soltar: enviar array de IDs na nova ordem para o backend
- Backend valida que **todos os IDs pertencem ao mesmo tenant**
- Atualizar `position` de cada item em transação
- Feedback visual otimista com reconciliação

### Consistência

- Gaps na posição são aceitáveis (não precisa ser sequencial 1, 2, 3...)
- Ao criar novo item: posição = `max(position) + 1`
- Ao deletar: não reordenar automaticamente os demais

---

## 8. Upload de Mídia (Fotos)

> **Detalhamento de segurança**: [07-CYBERSECURITY.md](./07-CYBERSECURITY.md) seção de uploads

### Fluxo

1. Angular seleciona arquivo e exibe preview local
2. Enviar para `POST /api/private/items/:id/media` ou `/api/private/business/logo`
3. Node.js valida:
   - Tamanho ≤ 8MB
   - Tipo real (magic bytes): JPEG, PNG ou WebP
   - Dimensões e pixels totais (rejeitar image bombs)
4. Processar:
   - Remover metadados EXIF
   - Corrigir orientação
   - Gerar variantes responsivas (thumbnail, medium, full)
   - Converter para WebP quando suportado
5. Salvar no Storage: `businesses/{businessId}/items/{itemId}/{uuid}.webp`
6. Atualizar `media_path` no banco
7. Retornar URL para o Angular

### Rejeições

| Arquivo                     | Resultado                              |
|-----------------------------|----------------------------------------|
| `foto.jpg.exe`              | Rejeitado                              |
| Imagem de 400MB             | Rejeitado antes de processar           |
| Content-Type image/png com bytes executáveis | Rejeitado              |
| SVG com script              | Não aceitar SVG no MVP                 |
| Path com businessId de outro tenant | Ignorar/404                    |

---

## 9. Limites Técnicos

| Recurso                  | Limite inicial  | Comportamento                                |
|--------------------------|-----------------|-----------------------------------------------|
| Categorias por business  | 100             | Alertar ao se aproximar; bloquear ao atingir  |
| Produtos por business    | 1.000           | Idem                                          |
| Tamanho por imagem       | 8 MB            | Rejeitar antes de processar                   |
| Cota de storage/tenant   | Configurável    | Alertar; bloquear upload                      |
| Caracteres nome          | 2-150           | Validação front e back                        |
| Caracteres descrição     | 0-1000          | Sem HTML arbitrário                           |

> Comunicação comercial pode dizer "sem limite", mas **internamente sempre existem limites contra abuso**.

---

## 10. Especial da Casa

- **É um produto escolhido pelo usuário** como destaque especial
- Configurado via bloco da Home (`featured_product` no `home_blocks`)
- O usuário seleciona qual produto é o "Especial da Casa"
- Aparece na Home pública como bloco destacado

---

## 11. Estados da Interface do Menu

| Estado          | UX                                                              |
|-----------------|------------------------------------------------------------------|
| **Loading**     | Skeletons nas listas de categorias e produtos                   |
| **Vazio**       | Empty state: "Crie sua primeira categoria para começar"         |
| **Normal**      | Lista com cards; ações de editar, desativar, reordenar, excluir |
| **Salvando**    | Spinner inline no item sendo salvo                              |
| **Salvo**       | Toast ou badge "Salvo" temporário                               |
| **Erro**        | Mensagem recuperável com retry junto ao item                    |
| **Conflito**    | "Os dados foram alterados. Deseja recarregar?"                  |
| **Limite**      | "Você atingiu o máximo de X categorias/produtos"                |

---

## 12. Detalhe do Produto (Experiência Pública)

> Este é o comportamento na **tela pública** (`/m/:slug`), não no painel.

| Dispositivo | Comportamento                                         |
|-------------|-------------------------------------------------------|
| **Mobile**  | Bottom sheet com gesto de fechar                      |
| **Desktop** | Modal lateral                                         |

### Requisitos do Modal/Sheet

- Prender foco (focus trap)
- Fechar com `Escape`
- Restaurar foco no card anterior ao fechar
- Impedir scroll do fundo (`body scroll lock`)
- Conteúdo: foto, descrição, preço, atributos e ações (like, carrinho)

---

## Documentos Relacionados

→ [05-DESIGN-SYSTEM-TEMPLATES.md](./05-DESIGN-SYSTEM-TEMPLATES.md) — Como o conteúdo é renderizado visualmente  
→ [06-EXPERIENCIA-PUBLICA.md](./06-EXPERIENCIA-PUBLICA.md) — Jornada do cliente final  
→ [07-CYBERSECURITY.md](./07-CYBERSECURITY.md) — Segurança de uploads e XSS  
→ [08-BANCO-DADOS-RLS.md](./08-BANCO-DADOS-RLS.md) — Tabelas de categorias, itens e atributos  
→ [09-API-CONTRATOS.md](./09-API-CONTRATOS.md) — Endpoints de CRUD
