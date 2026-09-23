# 📡 09 — API e Contratos

> **Domínio**: Contratos HTTP REST, envelopes de resposta, DTOs TypeScript, validação de payload, códigos de erro, rate limits e documentação de endpoints.  
> **Depende de**: [01-ARQUITETURA-GERAL.md](./01-ARQUITETURA-GERAL.md), [02-AUTENTICACAO-CADASTRO.md](./02-AUTENTICACAO-CADASTRO.md), [07-CYBERSECURITY.md](./07-CYBERSECURITY.md), [08-BANCO-DADOS-RLS.md](./08-BANCO-DADOS-RLS.md)  
> **Referenciado por**: Frontend (Angular Services), Backend (Node.js Controllers & Middlewares).

---

## 1. Diretrizes Mestas da API

1. **Protocolo**: HTTP/2 ou HTTP/1.1 sobre TLS 1.3 obrigatório.
2. **Formato Padrão**: JSON (`application/json; charset=utf-8`).
3. **Convenção de Nomenclatura**: `camelCase` para propriedades JSON, `kebab-case` para URLs e rotas.
4. **Autenticação**: Header `Authorization: Bearer <jwt_supabase_auth_token>` em rotas protegidas.
5. **Contexto de Tenant**: Extraído deterministicamente pelo Backend através das claims do JWT ou tabela de vínculo no BFF (`req.tenantId`).
6. **Versionamento**: Prefixado na URL `/api/v1/`.

---

## 2. Envelopes de Resposta & Formato de Erro

### 2.1 Resposta de Sucesso (`StandardSuccessResponse<T>`)

```typescript
export interface StandardSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    timestamp: string;
  };
}
```

### 2.2 Resposta de Erro (`StandardErrorResponse` - inspirado na RFC 7807)

```typescript
export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
}

export interface StandardErrorResponse {
  success: false;
  error: {
    code: string;           // Ex: "UNAUTHORIZED", "BUSINESS_SLUG_TAKEN", "INVALID_ACTIVATION_TOKEN"
    message: string;        // Mensagem amigável sanitizada
    details?: ValidationErrorDetail[];
    requestId?: string;     // Para rastreabilidade no Sentry/logs (Correlation ID)
    timestamp: string;
  };
}
```

---

## 3. Códigos de Status HTTP

| Código | Significado | Aplicação no Sistema |
|---|---|---|
| `200 OK` | Sucesso genérico | Consultas (GET), atualizações parciais ou totais bem-sucedidas. |
| `201 Created` | Recurso criado | Cadastro de usuário, criação de categoria, produto, upload de mídia. |
| `204 No Content` | Sucesso sem corpo | Exclusão de produto/categoria. |
| `400 Bad Request` | Falha de validação | Payload malformado, token de ativação inválido/expirado, regra de negócio violada. |
| `401 Unauthorized` | Autenticação ausente/inválida | JWT ausente, expirado ou com assinatura inválida. |
| `403 Forbidden` | Permissão negada | Tenant inativo (assinatura vencida), acesso a recurso de outro tenant. |
| `404 Not Found` | Não encontrado | Slug do cardápio público não existe, ID de produto não encontrado no tenant. |
| `409 Conflict` | Conflito de estado | E-mail já cadastrado, slug já em uso. |
| `429 Too Many Requests` | Rate limit excedido | Limite de requisições por IP ou por chave pública excedido. |
| `500 Internal Server Error` | Erro interno do servidor | Falha não tratada no servidor. Mensagem interna não é exposta ao cliente. |

---

## 4. Endpoints por Domínio

### 4.1 Autenticação e Onboarding (`/api/v1/auth`)

#### `POST /api/v1/auth/register`
- **Descrição**: Cria conta do gestor, perfil, registro do estabelecimento e gera token de ativação.
- **Acesso**: Público. Rate limit: 5 req/min/IP.
- **Request Body**:
```json
{
  "email": "gestor@restaurante.com",
  "password": "SenhaSuperSegura123!",
  "fullName": "João da Silva",
  "businessName": "Restaurante Sabor Real",
  "slug": "sabor-real",
  "phone": "+5511999998888"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "userId": "usr_9481a8b2-3c11-4f90",
    "businessId": "biz_7122f8a1-2b00-4e12",
    "slug": "sabor-real",
    "requiresActivation": true,
    "message": "Conta registrada com sucesso. Utilize o token de ativação para liberar o acesso."
  }
}
```

#### `POST /api/v1/auth/activate`
- **Descrição**: Valida token alfanumérico de ativação e ativa a conta do estabelecimento.
- **Acesso**: Público. Rate limit: 5 req/min/IP.
- **Request Body**:
```json
{
  "token": "ACT-8472-X9K"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "businessId": "biz_7122f8a1-2b00-4e12",
    "status": "ACTIVE",
    "activatedAt": "2026-09-07T14:00:00Z"
  }
}
```

---

### 4.2 Gestão do Estabelecimento & Perfil (`/api/v1/tenant`)

#### `GET /api/v1/tenant/profile`
- **Descrição**: Retorna os dados do estabelecimento do gestor autenticado.
- **Acesso**: Autenticado (Gestor).
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "id": "biz_7122f8a1-2b00-4e12",
    "name": "Restaurante Sabor Real",
    "slug": "sabor-real",
    "phone": "+5511999998888",
    "whatsapp": "+5511999998888",
    "status": "ACTIVE",
    "logoUrl": "https://storage.supabase.co/v1/object/public/logos/sabor-real.webp",
    "bannerUrl": null,
    "address": {
      "street": "Rua das Flores, 123",
      "city": "São Paulo",
      "state": "SP"
    }
  }
}
```

#### `PUT /api/v1/tenant/profile`
- **Descrição**: Atualiza dados cadastrais do estabelecimento.
- **Acesso**: Autenticado (Gestor).
- **Request Body**:
```json
{
  "name": "Restaurante Sabor Real Gourmet",
  "phone": "+5511999998888",
  "whatsapp": "+5511999998888"
}
```

---

### 4.3 Gestão de Categorias (`/api/v1/categories`)

#### `GET /api/v1/categories`
- **Descrição**: Lista todas as categorias do tenant do gestor (incluindo ativas e inativas).
- **Acesso**: Autenticado (Gestor).
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "cat_101",
      "name": "Hambúrgueres Artesanais",
      "description": "Burgers grelhados no fogo com blend especial",
      "icon": "hamburger",
      "displayOrder": 1,
      "isActive": true,
      "itemsCount": 8
    }
  ]
}
```

#### `POST /api/v1/categories`
- **Descrição**: Cria uma nova categoria.
- **Acesso**: Autenticado (Gestor).
- **Request Body**:
```json
{
  "name": "Bebidas & Sucos",
  "description": "Bebidas geladas e sucos naturais",
  "icon": "drink",
  "isActive": true
}
```

#### `PATCH /api/v1/categories/reorder`
- **Descrição**: Atualiza a ordem de exibição das categorias em lote (Drag and Drop).
- **Acesso**: Autenticado (Gestor).
- **Request Body**:
```json
{
  "orders": [
    { "id": "cat_102", "displayOrder": 1 },
    { "id": "cat_101", "displayOrder": 2 }
  ]
}
```

---

### 4.4 Gestão de Produtos (`/api/v1/items`)

#### `GET /api/v1/items`
- **Descrição**: Lista produtos do tenant com paginação e filtro por categoria.
- **Acesso**: Autenticado (Gestor).
- **QueryParams**: `categoryId`, `page`, `limit`, `search`, `status`.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "item_501",
      "categoryId": "cat_101",
      "name": "Smash Burger Duplo",
      "description": "Dois hambúrgueres smash de 90g, queijo cheddar e molho da casa.",
      "price": 32.90,
      "promotionalPrice": 28.90,
      "imageUrl": "https://storage.supabase.co/v1/object/public/menu-items/smash.webp",
      "isAvailable": true,
      "isHighlighted": true,
      "likesCount": 142
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

#### `POST /api/v1/items`
- **Descrição**: Cria um novo item no cardápio.
- **Acesso**: Autenticado (Gestor).
- **Request Body**:
```json
{
  "categoryId": "cat_101",
  "name": "Bacon Cheese Burger",
  "description": "Hambúrguer 180g, queijo prato, bacon crocante e maionese verde.",
  "price": 38.00,
  "promotionalPrice": null,
  "imageUrl": "https://storage.supabase.co/v1/object/public/menu-items/bacon.webp",
  "isAvailable": true,
  "isHighlighted": false,
  "attributes": [
    { "name": "Ponto da Carne", "type": "SELECT", "required": true, "options": ["Ao Ponto", "Bem Passado", "Mal Passado"] }
  ]
}
```

#### `PATCH /api/v1/items/:id/toggle-availability`
- **Descrição**: Alterna rapidamente a disponibilidade (pausa o item se acabar o estoque).
- **Acesso**: Autenticado (Gestor).

---

### 4.5 Gestão de Design & Templates (`/api/v1/design`)

#### `GET /api/v1/design`
- **Descrição**: Retorna a configuração de design atual do cardápio do tenant.
- **Acesso**: Autenticado (Gestor).
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "templateId": "tmpl_modern_dark",
    "primaryColor": "#FF5722",
    "secondaryColor": "#1A1A1A",
    "backgroundColor": "#0F0F0F",
    "fontFamily": "Inter",
    "borderRadius": "MD",
    "showWelcomeModal": true,
    "welcomeTitle": "Seja bem-vindo ao Sabor Real!",
    "welcomeMessage": "Escolha seus pratos favoritos e faça seu pedido.",
    "layoutMode": "GRID_2_COL"
  }
}
```

#### `PUT /api/v1/design`
- **Descrição**: Atualiza as configurações visuais do cardápio.
- **Acesso**: Autenticado (Gestor).

---

### 4.6 Experiência Pública (`/api/v1/public/:slug`)

#### `GET /api/v1/public/:slug/catalog`
- **Descrição**: Endpoint público de alta velocidade (cached no CDN/Edge) para carregar todo o cardápio público de um estabelecimento pelo slug.
- **Acesso**: Público. Rate limit: 60 req/min/IP.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "business": {
      "name": "Restaurante Sabor Real",
      "slug": "sabor-real",
      "logoUrl": "https://storage.supabase.co/v1/object/public/logos/sabor-real.webp",
      "phone": "+5511999998888",
      "whatsapp": "+5511999998888"
    },
    "design": {
      "templateId": "tmpl_modern_dark",
      "primaryColor": "#FF5722",
      "backgroundColor": "#0F0F0F",
      "fontFamily": "Inter",
      "showWelcomeModal": true,
      "welcomeTitle": "Seja bem-vindo ao Sabor Real!"
    },
    "promotions": [
      {
        "id": "promo_01",
        "title": "Combo Smash Burger + Refri",
        "bannerUrl": "https://storage.supabase.co/v1/object/public/banners/combo.webp",
        "discountPercentage": 15
      }
    ],
    "categories": [
      {
        "id": "cat_101",
        "name": "Hambúrgueres Artesanais",
        "icon": "hamburger",
        "items": [
          {
            "id": "item_501",
            "name": "Smash Burger Duplo",
            "description": "Dois hambúrgueres smash de 90g com queijo cheddar.",
            "price": 32.90,
            "promotionalPrice": 28.90,
            "imageUrl": "https://storage.supabase.co/v1/object/public/menu-items/smash.webp",
            "likesCount": 142,
            "isAvailable": true
          }
        ]
      }
    ]
  }
}
```

#### `POST /api/v1/public/:slug/items/:itemId/like`
- **Descrição**: Adiciona um curtir/like em um item do cardápio público.
- **Acesso**: Público. Rate limit: 10 req/min por IP + impressão digital de navegador (Fingerprint local storage).
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "itemId": "item_501",
    "totalLikes": 143
  }
}
```

---

## 5. Middleware de Validação de Schemas (Zod)

Toda requisição no Backend Node.js passa por validação estrita utilizando Zod. Exemplo de Schema para criação de produto:

```typescript
import { z } from 'zod';

export const createItemSchema = z.object({
  categoryId: z.string().uuid("ID de categoria inválido"),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100, "Nome muito longo"),
  description: z.string().max(500, "Descrição excede 500 caracteres").optional(),
  price: z.number().positive("Preço deve ser maior que zero"),
  promotionalPrice: z.number().positive().nullable().optional(),
  imageUrl: z.string().url("URL da imagem inválida").optional().nullable(),
  isAvailable: z.boolean().default(true),
  isHighlighted: z.boolean().default(false)
}).refine(data => {
  if (data.promotionalPrice && data.promotionalPrice >= data.price) {
    return false;
  }
  return true;
}, {
  message: "Preço promocional deve ser estritamente menor que o preço normal",
  path: ["promotionalPrice"]
});
```

---

## 6. Rate Limit & Resiliência na API

- **Headers HTTP Retornados em Cada Resposta**:
  - `X-RateLimit-Limit`: Limite total de requisições na janela.
  - `X-RateLimit-Remaining`: Requisições restantes na janela atual.
  - `X-RateLimit-Reset`: Timestamp UTC para reset da janela.
- **Comportamento quando excedido (`429 Too Many Requests`)**:
```json
{
  "success": false,
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Limite de requisições excedido. Tente novamente em alguns minutos.",
    "timestamp": "2026-09-07T14:15:00Z"
  }
}
```
