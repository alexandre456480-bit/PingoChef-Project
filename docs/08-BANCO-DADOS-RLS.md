# 🗄️ 08 — Banco de Dados e RLS

> **Domínio**: Modelo de dados, tabelas, constraints, índices, RLS, multi-tenant, migrations e chaves.  
> **Depende de**: [01-ARQUITETURA-GERAL.md](./01-ARQUITETURA-GERAL.md), [07-CYBERSECURITY.md](./07-CYBERSECURITY.md)  
> **Referenciado por**: Todos os documentos que envolvem dados.

---

## 1. Diagrama de Relacionamentos

```
auth.users (Supabase Auth)
    │
    │ 1:1
    ▼
profiles ─────────────────┐
    │                     │
    │ FK: user_id         │
    ▼                     │
businesses ───────────────┤
    │ PK: id              │
    │ FK: owner_user_id   │
    │                     │
    ├───── activation_tokens (FK: used_by)
    │
    ├───── subscriptions (FK: business_id)
    │
    ├───── categories (FK: business_id)
    │           │
    │           └── menu_items (FK: business_id, category_id)
    │                   │
    │                   ├── item_attributes (FK: item_id)
    │                   └── item_likes (FK: business_id, item_id)
    │
    ├───── promotions (FK: business_id, item_id)
    │
    ├───── design_settings (FK: business_id)
    │
    ├───── home_blocks (FK: business_id)
    │
    ├───── menu_publications (FK: business_id)
    │
    └───── audit_logs (FK: actor/target referencial)
```

---

## 2. Tabelas — Detalhamento

### 2.1 `profiles`

| Coluna       | Tipo          | Constraint                  | Notas                     |
|--------------|---------------|-----------------------------|---------------------------|
| `user_id`    | UUID          | PK, FK → auth.users(id)    | Mesmo UUID do Supabase Auth |
| `created_at` | timestamptz   | NOT NULL, DEFAULT now()     |                           |
| `updated_at` | timestamptz   | NOT NULL, DEFAULT now()     |                           |

> **Regra**: Nenhum dado secreto nesta tabela. Serve como ponte entre Auth e o domínio.

---

### 2.2 `businesses`

| Coluna                    | Tipo          | Constraint                            | Notas                              |
|---------------------------|---------------|---------------------------------------|------------------------------------|
| `id`                      | UUID          | PK, DEFAULT gen_random_uuid()         |                                    |
| `owner_user_id`           | UUID          | FK → auth.users(id), UNIQUE          | Um usuário = um business no MVP    |
| `name`                    | varchar(100)  | Nullable (não definido pós-cadastro)  |                                    |
| `description`             | text          | Nullable                              | Max 500 chars na API               |
| `logo_path`               | varchar(255)  | Nullable                              | Caminho no Storage                 |
| `slug`                    | varchar(100)  | UNIQUE, Nullable inicialmente         | Gerado/personalizado               |
| `status`                  | varchar(20)   | NOT NULL, DEFAULT 'active'            | `active`, `suspended`, `deleting`, `deleted` |
| `current_publication_id`  | UUID          | FK → menu_publications(id), Nullable  | Última publicação ativa            |
| `created_at`              | timestamptz   | NOT NULL, DEFAULT now()               |                                    |
| `updated_at`              | timestamptz   | NOT NULL, DEFAULT now()               |                                    |

**Índices**:
- `idx_businesses_owner` → `owner_user_id`
- `idx_businesses_slug` → `slug` (unique)
- `idx_businesses_status` → `status`

---

### 2.3 `activation_tokens`

| Coluna       | Tipo          | Constraint                       | Notas                              |
|--------------|---------------|----------------------------------|------------------------------------|
| `id`         | UUID          | PK, DEFAULT gen_random_uuid()    |                                    |
| `token_hash` | varchar(128)  | UNIQUE, NOT NULL                 | HMAC(secret, raw_token); raw nunca persiste |
| `status`     | varchar(20)   | NOT NULL, DEFAULT 'unused'       | `unused`, `reserved`, `used`, `revoked`, `expired` |
| `expires_at` | timestamptz   | NOT NULL                         | Validade configurável (30 dias)    |
| `used_at`    | timestamptz   | Nullable                         | Preenchido no consumo              |
| `used_by`    | UUID          | FK → auth.users(id), Nullable    | Quem consumiu                      |
| `created_at` | timestamptz   | NOT NULL, DEFAULT now()          |                                    |

**Índices**:
- `idx_tokens_hash` → `token_hash` (unique)
- `idx_tokens_status_expires` → `(status, expires_at)` — busca de token válido

---

### 2.4 `subscriptions`

| Coluna       | Tipo          | Constraint                       | Notas                              |
|--------------|---------------|----------------------------------|------------------------------------|
| `id`         | UUID          | PK, DEFAULT gen_random_uuid()    |                                    |
| `business_id`| UUID          | FK → businesses(id), NOT NULL    |                                    |
| `status`     | varchar(20)   | NOT NULL, DEFAULT 'active'       | `active`, `expired`, `suspended`, `cancelled` |
| `starts_at`  | timestamptz   | NOT NULL                         |                                    |
| `expires_at` | timestamptz   | NOT NULL                         |                                    |
| `created_at` | timestamptz   | NOT NULL, DEFAULT now()          |                                    |
| `updated_at` | timestamptz   | NOT NULL, DEFAULT now()          |                                    |

**Índices**:
- `idx_subscriptions_business` → `business_id`
- `idx_subscriptions_status` → `(business_id, status)`

---

### 2.5 `categories`

| Coluna         | Tipo          | Constraint                       | Notas                              |
|----------------|---------------|----------------------------------|------------------------------------|
| `id`           | UUID          | PK, DEFAULT gen_random_uuid()    |                                    |
| `business_id`  | UUID          | FK → businesses(id), NOT NULL    |                                    |
| `name`         | varchar(100)  | NOT NULL                         | Sanitizado                         |
| `icon_key`     | varchar(50)   | Nullable                         | Chave da biblioteca de ícones      |
| `display_mode` | varchar(20)   | NOT NULL, DEFAULT 'icon_name'    | `icon`, `name`, `icon_name`        |
| `position`     | integer       | NOT NULL, DEFAULT 0              |                                    |
| `is_active`    | boolean       | NOT NULL, DEFAULT true           |                                    |
| `deleted_at`   | timestamptz   | Nullable                         | Soft delete                        |
| `created_at`   | timestamptz   | NOT NULL, DEFAULT now()          |                                    |
| `updated_at`   | timestamptz   | NOT NULL, DEFAULT now()          |                                    |

**Índices**:
- `idx_categories_business` → `(business_id, position)` — listagem ordenada
- `idx_categories_active` → `(business_id, is_active)` — filtro ativo

---

### 2.6 `menu_items`

| Coluna              | Tipo          | Constraint                            | Notas                                   |
|---------------------|---------------|---------------------------------------|-----------------------------------------|
| `id`                | UUID          | PK, DEFAULT gen_random_uuid()         |                                         |
| `business_id`       | UUID          | FK → businesses(id), NOT NULL         |                                         |
| `category_id`       | UUID          | FK → categories(id), NOT NULL         | Deve pertencer ao mesmo business        |
| `name`              | varchar(150)  | NOT NULL                              | Sanitizado                              |
| `description`       | text          | Nullable                              | Max 1000 chars; sem HTML                |
| `price_cents`       | integer       | Nullable, CHECK (price_cents >= 0)    | Null = "consultar estabelecimento"      |
| `promo_price_cents`  | integer      | Nullable, CHECK (promo_price_cents >= 0) | Preço promocional                    |
| `media_path`        | varchar(255)  | Nullable                              | Caminho no Storage                      |
| `position`          | integer       | NOT NULL, DEFAULT 0                   |                                         |
| `is_active`         | boolean       | NOT NULL, DEFAULT true                |                                         |
| `deleted_at`        | timestamptz   | Nullable                              | Soft delete                             |
| `created_at`        | timestamptz   | NOT NULL, DEFAULT now()               |                                         |
| `updated_at`        | timestamptz   | NOT NULL, DEFAULT now()               |                                         |

**Constraints**:
- CHECK: `category_id` pertence ao mesmo `business_id` (via FK composta ou trigger)
- CHECK: `promo_price_cents < price_cents` quando ambos NOT NULL

**Índices**:
- `idx_items_business_category` → `(business_id, category_id, position)`
- `idx_items_active` → `(business_id, is_active)`

---

### 2.7 `item_attributes`

| Coluna    | Tipo         | Constraint                   | Notas                               |
|-----------|--------------|------------------------------|---------------------------------------|
| `id`      | UUID         | PK                           |                                       |
| `item_id` | UUID         | FK → menu_items(id), NOT NULL|                                       |
| `type`    | varchar(30)  | NOT NULL                     | `serves`, `volume`, `weight`, `prep_time` |
| `value`   | varchar(50)  | NOT NULL                     | Sem HTML arbitrário                   |
| `unit`    | varchar(20)  | Nullable                     | `pessoas`, `ml`, `g`, `min`           |
| `position`| integer      | NOT NULL, DEFAULT 0          |                                       |

---

### 2.8 `promotions`

| Coluna       | Tipo         | Constraint                    | Notas                          |
|--------------|--------------|-------------------------------|--------------------------------|
| `id`         | UUID         | PK                            |                                |
| `business_id`| UUID         | FK → businesses(id), NOT NULL |                                |
| `item_id`    | UUID         | FK → menu_items(id), Nullable | Null = promoção geral          |
| `starts_at`  | timestamptz  | NOT NULL                      |                                |
| `ends_at`    | timestamptz  | NOT NULL                      | CHECK: `ends_at > starts_at`  |
| `enabled`    | boolean      | NOT NULL, DEFAULT true        |                                |
| `config`     | jsonb        | Nullable                      | Configurações extras           |
| `created_at` | timestamptz  | NOT NULL, DEFAULT now()       |                                |

---

### 2.9 `design_settings`

| Coluna           | Tipo         | Constraint                    | Notas                          |
|------------------|--------------|-------------------------------|--------------------------------|
| `business_id`    | UUID         | PK, FK → businesses(id)      | Um design por business         |
| `template_key`   | varchar(30)  | NOT NULL, DEFAULT 'minimal'   | Chave do template              |
| `palette`        | jsonb        | NOT NULL                      | Cores (preset ou custom)       |
| `font_pair`      | varchar(30)  | NOT NULL, DEFAULT 'modern'    | Par tipográfico                |
| `category_style` | varchar(20)  | NOT NULL, DEFAULT 'icon_name' | `icon`, `name`, `icon_name`    |
| `motion`         | varchar(20)  | NOT NULL, DEFAULT 'fade'      | `fade`, `slide`, `scale`, `none` |
| `custom_config`  | jsonb        | Nullable                      | Configs extras por template    |
| `updated_at`     | timestamptz  | NOT NULL, DEFAULT now()       |                                |

> Schema JSON **validado e versionado** — alterações no formato devem ser migradas.

---

### 2.10 `home_blocks`

| Coluna        | Tipo         | Constraint                    | Notas                                  |
|---------------|--------------|-------------------------------|----------------------------------------|
| `id`          | UUID         | PK                            |                                        |
| `business_id` | UUID         | FK → businesses(id), NOT NULL |                                        |
| `type`        | varchar(30)  | NOT NULL                      | `hero`, `promotion`, `most_liked`, `featured_product`, `categories` |
| `position`    | integer      | NOT NULL, DEFAULT 0           |                                        |
| `enabled`     | boolean      | NOT NULL, DEFAULT true        |                                        |
| `config_json` | jsonb        | Nullable                      | Config validada por tipo               |

> Tipos em **allowlist** — novos tipos adicionados sem reconstruir a Home.

---

### 2.11 `item_likes`

| Coluna        | Tipo         | Constraint                       | Notas                               |
|---------------|--------------|----------------------------------|---------------------------------------|
| `id`          | UUID         | PK                               |                                       |
| `business_id` | UUID         | FK → businesses(id), NOT NULL    |                                       |
| `item_id`     | UUID         | FK → menu_items(id), NOT NULL    |                                       |
| `like_key`    | varchar(128) | NOT NULL                         | `HMAC(server_secret, business_id + visitor_id)` |
| `created_at`  | timestamptz  | NOT NULL, DEFAULT now()          |                                       |

**Constraints**:
- `UNIQUE(item_id, like_key)` — 1 like por visitante por item

**Índices**:
- `idx_likes_item` → `item_id` — contagem/ranking
- `idx_likes_business` → `(business_id, item_id)` — ranking por business

---

### 2.12 `menu_publications`

| Coluna         | Tipo         | Constraint                        | Notas                              |
|----------------|--------------|-----------------------------------|------------------------------------|
| `id`           | UUID         | PK                                |                                    |
| `business_id`  | UUID         | FK → businesses(id), NOT NULL     |                                    |
| `version`      | integer      | NOT NULL                          | Sequencial por business            |
| `snapshot_json` | jsonb       | NOT NULL                          | Snapshot completo e imutável       |
| `published_by` | UUID         | FK → auth.users(id), NOT NULL     |                                    |
| `published_at` | timestamptz  | NOT NULL, DEFAULT now()           |                                    |

**Constraints**:
- `UNIQUE(business_id, version)` — versão única por business

> Snapshot é **imutável** — uma vez publicado, não se altera. Nova publicação cria nova versão.

---

### 2.13 `audit_logs`

| Coluna     | Tipo         | Constraint               | Notas                                     |
|------------|--------------|--------------------------|-------------------------------------------|
| `id`       | UUID         | PK                       |                                           |
| `actor`    | UUID         | NOT NULL                 | Quem realizou a ação                      |
| `action`   | varchar(50)  | NOT NULL                 | `register`, `login`, `publish`, `suspend`...|
| `target`   | varchar(100) | Nullable                 | ID do recurso afetado                     |
| `metadata` | jsonb        | Nullable                 | **Segura** — sem senha/token/conteúdo sensível |
| `created_at`| timestamptz | NOT NULL, DEFAULT now()  |                                           |

> **Append-only** — nunca alterar ou deletar logs. Nunca incluir senha, token ou conteúdo sensível.

---

## 3. Row Level Security (RLS)

### Política Geral

Toda tabela com dados de tenant tem RLS ativo. A identidade vem de `auth.uid()`.

### Exemplo de Policy — `businesses`

```sql
-- SELECT: somente o owner vê seu business
CREATE POLICY "Users can view own business"
  ON businesses FOR SELECT
  USING (owner_user_id = auth.uid());

-- UPDATE: somente o owner atualiza
CREATE POLICY "Users can update own business"
  ON businesses FOR UPDATE
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- INSERT: somente via processo controlado (registro)
CREATE POLICY "Insert via registration only"
  ON businesses FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

-- DELETE: não permitir delete direto
-- (soft delete via UPDATE do status)
```

### Exemplo — `categories` e `menu_items`

```sql
-- SELECT: via business do owner
CREATE POLICY "Tenant isolation for categories"
  ON categories FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_user_id = auth.uid()
    )
  );

-- Padrão similar para INSERT, UPDATE, DELETE
-- Sempre verificar business_id pertence ao tenant
```

### Exemplo — `item_likes` (público)

```sql
-- INSERT: qualquer anônimo pode criar like (controlado por rate limit na API)
CREATE POLICY "Public can like items"
  ON item_likes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM menu_items mi
      JOIN businesses b ON mi.business_id = b.id
      WHERE mi.id = item_likes.item_id
      AND b.status = 'active'
    )
  );

-- SELECT: público pode ler contagem
CREATE POLICY "Public can read likes"
  ON item_likes FOR SELECT
  USING (true);
```

### Testes de RLS Obrigatórios

| Tabela        | Teste                                                |
|---------------|------------------------------------------------------|
| businesses    | Owner A não vê/altera business de owner B            |
| categories    | Owner A não CRUD categorias de business B            |
| menu_items    | Owner A não CRUD itens de business B                 |
| design_settings | Owner A não lê/altera design de B                 |
| home_blocks   | Owner A não altera blocos de B                       |
| subscriptions | Owner A não vê/altera subscription de B              |
| menu_publications | Owner A não cria publicação para business B     |

---

## 4. Grants

```sql
-- Não conceder acesso direto às tabelas para roles não autorizadas
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;

-- Conceder seletivamente
GRANT SELECT, INSERT, UPDATE ON businesses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON menu_items TO authenticated;
-- etc.

-- Público (anon) — somente leitura de publicações e likes
GRANT SELECT ON menu_publications TO anon;
GRANT SELECT, INSERT, DELETE ON item_likes TO anon;
```

---

## 5. Migrations

### Regras

- Toda alteração de schema, grants ou RLS deve estar em **migration versionada e revisável**
- Migrations devem ser **reproduzíveis** — rodar do zero gera o mesmo resultado
- Nomear migrations com timestamp + descrição: `20260907_001_create_profiles.sql`
- Testar migrations em ambiente limpo antes de produção

### Ordem Sugerida de Migrations

```
001_create_profiles.sql
002_create_businesses.sql
003_create_activation_tokens.sql
004_create_subscriptions.sql
005_create_categories.sql
006_create_menu_items.sql
007_create_item_attributes.sql
008_create_promotions.sql
009_create_design_settings.sql
010_create_home_blocks.sql
011_create_item_likes.sql
012_create_menu_publications.sql
013_create_audit_logs.sql
014_apply_rls_policies.sql
015_apply_grants.sql
```

---

## 6. Storage — Estrutura por Tenant

```
supabase-storage/
└── businesses/
    └── {businessId}/
        ├── logo/
        │   └── {uuid}.webp
        ├── items/
        │   └── {itemId}/
        │       ├── {uuid}_thumb.webp
        │       ├── {uuid}_medium.webp
        │       └── {uuid}_full.webp
        └── hero/
            └── {uuid}.webp
```

### Políticas de Storage

- Leitura: Assets publicados podem ser públicos ou assinados
- Escrita: Somente o owner do business pode fazer upload no caminho do seu tenant
- Verificação: Validar que o `businessId` no path corresponde ao tenant autenticado

---

## Documentos Relacionados

→ [07-CYBERSECURITY.md](./07-CYBERSECURITY.md) — Threat model e testes RLS  
→ [09-API-CONTRATOS.md](./09-API-CONTRATOS.md) — Endpoints que leem/escrevem estas tabelas  
→ [04-CARDAPIO-CONTEUDO.md](./04-CARDAPIO-CONTEUDO.md) — Regras de negócio de categorias e produtos  
→ [02-AUTENTICACAO-CADASTRO.md](./02-AUTENTICACAO-CADASTRO.md) — Token e fluxo de criação

---

## 7. Extensão implementada: `product_media`

A implementação versionada da fundação de mídia está em
`supabase/migrations/20260923000000_add_product_media.sql`. Ela usa FK composta
`(business_id, menu_item_id)` para impedir associação cross-tenant no próprio
banco, mantém os IDs administrativos fora do acesso anônimo e bloqueia escritas
diretas de clientes autenticados. O desenho completo, inclusive transição de
imagens e publicação, está em [11-PRODUCT-MEDIA-ARCHITECTURE.md](./11-PRODUCT-MEDIA-ARCHITECTURE.md).
