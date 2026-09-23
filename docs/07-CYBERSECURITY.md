# 🛡️ 07 — Cybersecurity

> **Domínio**: Threat model, controles de segurança, testes de ataque, headers, secrets, logs e checklist de segurança.  
> **Depende de**: [01-ARQUITETURA-GERAL.md](./01-ARQUITETURA-GERAL.md), [02-AUTENTICACAO-CADASTRO.md](./02-AUTENTICACAO-CADASTRO.md)  
> **Referenciado por**: Todos os documentos (segurança é transversal).

---

## 1. Princípio de Segurança

> **Segurança por arquitetura**: O navegador não tem autoridade. Node valida regras. RLS isola dados. Segredos ficam no servidor. Toda decisão de segurança é implementada em **camadas de defesa** (defense in depth).

```
┌──────────────────────────────────────────────────────────┐
│ Camada 1: ANGULAR (UX apenas)                            │
│ - Guards melhoram UX, NÃO protegem recursos              │
│ - Sanitização do Angular (XSS)                           │
│ - CSRF token enviado conforme contrato                   │
├──────────────────────────────────────────────────────────┤
│ Camada 2: NODE.JS API (autoridade real)                  │
│ - Autenticação da sessão                                 │
│ - Derivação do tenant                                    │
│ - Validação de entrada (schemas allowlist)               │
│ - Rate limit, CSRF, Origin, Content-Type                 │
│ - Regras de negócio                                      │
├──────────────────────────────────────────────────────────┤
│ Camada 3: PostgreSQL + RLS (última barreira)             │
│ - Row Level Security por tenant                          │
│ - Constraints, grants e tipos                            │
│ - Mesmo se API tiver bug, RLS impede cross-tenant        │
├──────────────────────────────────────────────────────────┤
│ Camada 4: INFRAESTRUTURA                                 │
│ - HTTPS, HSTS, CSP, headers de segurança                 │
│ - Storage policies por tenant                             │
│ - Segredos em secret manager (nunca no código)           │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Threat Model do MVP

### Ameaças e Controles

| Ameaça                  | Exemplo de Ataque                    | Controles Mínimos                                                          |
|-------------------------|--------------------------------------|----------------------------------------------------------------------------|
| **IDOR / Quebra de tenant** | Alterar UUID de um item para acessar dados de outro business | Tenant derivado da sessão; filtros server-side; RLS; testes A/B (user A não lê dados de B) |
| **XSS**                | Descrição de produto com `<script>` | Não aceitar HTML arbitrário; escape contextual; sanitização; CSP; Trusted Types (quando viável) |
| **CSRF**               | Site externo aciona PATCH no painel  | SameSite cookies; token CSRF; validação de Origin para cookie auth         |
| **Credential stuffing** | Milhares de tentativas de login     | Rate limit progressivo; mensagens genéricas; logs de tentativas; MFA admin |
| **Abuso de token**     | Força bruta / reuso / race condition | Entropia alta; hash/HMAC; validade; uso único; reserva; rate limit; constraint |
| **Upload malicioso**   | Executável disfarçado de imagem     | Allowlist MIME real (magic bytes); decoder; tamanho; pixels; rename; storage isolado |
| **Bot de likes**        | Milhares de likes automatizados    | UNIQUE constraint; HMAC de sessão; rate limit; validação de item; detecção de anomalia |
| **Vazamento de segredo**| `service_role` no Angular ou Git    | Secret scanning; `.env` fora do Git; rotação; ambientes separados          |
| **Mass assignment**     | Enviar `owner_user_id` ou `status` no body | Schemas allowlist; DTOs de entrada específicos; ignorar campos não permitidos |
| **Exclusão acidental**  | Admin apaga business sem querer    | Soft delete; confirmação dupla; step-up auth; logs; recuperação             |

---

## 3. Autenticação e Sessão — Controles

### Login

| Controle                    | Implementação                                          |
|-----------------------------|--------------------------------------------------------|
| Rate limit                  | Progressivo por IP e por e-mail (ex: 5 tentativas/15min) |
| Mensagem genérica           | "Credenciais inválidas" — nunca "e-mail não encontrado" |
| Não revelar existência      | Timing constante; mesma resposta para email válido/inválido |
| Logs                        | Registrar tentativas (sem senha); alertar picos de 401/403 |
| MFA                         | Obrigatório para admin antes de produção               |

### Sessão (BFF)

| Controle                    | Implementação                                          |
|-----------------------------|--------------------------------------------------------|
| Cookies HttpOnly            | JWT/sessão nunca acessível via JavaScript               |
| Secure flag                 | Cookies somente via HTTPS                              |
| SameSite=Strict             | Impede envio de cookie por sites terceiros              |
| Validação de expiração      | Server-side; renovação conforme política               |
| Logout real                 | Revogar no Auth + limpar cookies + limpar estado       |

### Token de Ativação

| Controle                    | Implementação                                          |
|-----------------------------|--------------------------------------------------------|
| Entropia alta               | Mínimo 128 bits de entropia aleatória                  |
| Armazenamento               | Somente `token_hash = HMAC(secret, raw_token)` no banco |
| Uso único                   | Constraint no banco; transação com reserva              |
| Expiração                   | `expires_at` verificado no momento do uso               |
| Rate limit                  | Limitar tentativas de registro por IP                  |
| Mensagem segura             | Não revelar se token existe, quem comprou ou datas     |

---

## 4. Multi-Tenant — Isolamento de Dados

### Regra #1 do SaaS

> **Impedir que o usuário A leia ou altere qualquer recurso do usuário B, mesmo conhecendo um UUID válido.**

### Derivação do Tenant

```
JWT/sessão → auth.uid() → businesses.owner_user_id → tenant atual
→ Recurso.business_id DEVE corresponder ao tenant atual
→ Falha → 404 (preferencial — não confirma existência)
```

### Testes de Isolamento Obrigatórios

| Camada   | Teste                                                        |
|----------|--------------------------------------------------------------|
| **API**  | Usuário A tenta GET/PATCH/DELETE no item de B → **negado**   |
| **Banco**| Políticas SELECT/INSERT/UPDATE/DELETE testadas separadamente |
| **Storage**| Usuário A tenta acessar `businesses/B/...` → **negado**    |
| **Publicação**| A não publica snapshot de B nem injeta categoryId de B  |
| **Admin**| Somente função server-side; nunca confiar em `is_admin` do Angular |

---

## 5. Validação de Entrada (Input Validation)

### Princípio: Allowlist, não Blocklist

```typescript
// ✅ CORRETO — schema allowlist
const updateBusinessSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
});

// ❌ ERRADO — aceitar tudo e filtrar depois
// Nunca confiar em req.body diretamente
```

### Regras

| Validação                    | Implementação                                          |
|------------------------------|--------------------------------------------------------|
| E-mail                       | Normalizado (trim, lowercase); validado no servidor; nunca refletido sem escape |
| Senha                        | Política de comprimento; bloqueio de senhas comuns/vazadas; sem regras cosméticas frágeis |
| Token                        | Normalizado no servidor; mensagens não expõem hash, ID ou datas |
| IDs (UUID)                   | Validar formato; verificar pertencimento ao tenant     |
| Texto livre (nome/descrição) | Max length; sanitizado contra XSS; sem HTML arbitrário |
| Preços                       | Integer >= 0; validação no servidor                    |
| Posições                     | Integer; validar que IDs pertencem ao tenant           |

### Mass Assignment

Campos que **nunca** podem ser alterados pelo cliente:
- `owner_user_id`
- `business_id` (no contexto de criação de recursos)
- `status` de business/subscription
- `created_at`, `updated_at`
- `used_by`, `used_at` de tokens

---

## 6. Upload de Arquivos — Segurança

### Controles Obrigatórios

| Controle           | Implementação                                                |
|--------------------|--------------------------------------------------------------|
| **Tamanho**        | Máximo 8MB por imagem; rejeitar antes de processar           |
| **Tipo real**      | Verificar magic bytes (assinatura real), não confiar em Content-Type |
| **Allowlist**      | Apenas JPEG, PNG e WebP                                      |
| **SVG**            | **Não aceitar** no MVP (vetor de XSS)                        |
| **Dimensões**      | Limitar pixels totais (evitar image bombs)                   |
| **Nome**           | Ignorar nome original; gerar UUID + extensão após normalização |
| **Processamento**  | Remover metadados EXIF; corrigir orientação; decoder real    |
| **Caminho**        | `businesses/{businessId}/...`; verificar que businessId = tenant |
| **Cota**           | Limite de storage por tenant (configurável)                  |

### Rejeições

```
foto.jpg.exe          → rejeitar (dupla extensão)
imagem 400 MB         → rejeitar ANTES de processar
image/png com bytes   → rejeitar (magic bytes divergem)
  executáveis
SVG com <script>      → não aceitar SVG no MVP
path com businessId   → ignorar / 404
  de outro tenant
```

---

## 7. Headers e Plataforma

### Headers de Segurança Obrigatórios

| Header                     | Valor                                              |
|----------------------------|-----------------------------------------------------|
| `Strict-Transport-Security`| `max-age=31536000; includeSubDomains` (produção)    |
| `Content-Security-Policy`  | Progressiva; restritiva para scripts/styles          |
| `X-Content-Type-Options`   | `nosniff`                                            |
| `X-Frame-Options`          | `DENY` ou `SAMEORIGIN`                              |
| `Referrer-Policy`          | `strict-origin-when-cross-origin`                    |
| `Permissions-Policy`       | Restritiva conforme necessidade                     |

### CORS

- **Estrito por ambiente** — somente origens permitidas
- **Nunca** `Access-Control-Allow-Origin: *` para rotas autenticadas
- Validar `Origin` em ações mutáveis

### Payload

- Limite de body size (ex: 10MB para uploads, 1MB para JSON)
- Timeout por rota
- Rate limit global e por rota

---

## 8. Chaves Supabase — Uso Correto

| Chave              | Onde                   | Uso                                            | ⚠️ Cuidado                     |
|--------------------|------------------------|-------------------------------------------------|--------------------------------|
| **anon/publishable**| Angular (frontend)   | Fluxos projetados para ela; não é segredo       | RLS e grants devem estar corretos |
| **service_role**   | Node.js (servidor)    | Operações administrativas específicas           | **Nunca** no Angular, Git ou logs |

### Regras da `service_role`

- Bypassa RLS — só usar quando absolutamente necessário
- Somente no servidor (Node.js)
- Para CRUD comum, propagar identidade do usuário para que RLS continue atuando
- Se vazar: rotacionar imediatamente

---

## 9. Logs e Observabilidade

### Logs Permitidos ✅

- `requestId`, rota normalizada, status, latência
- Ator/tenant pseudonimizado
- Ação administrativa e resultado
- Tentativas de login (sem senha)
- Alertas de picos de 401/403/429

### Logs PROIBIDOS ❌

- Senha
- Token bruto
- Cookie / Authorization header
- `service_role` key
- Corpo completo de cadastro
- URL assinada de Storage
- Stack traces em produção (retornar erro genérico)
- Query SQL
- Nomes de tabelas
- Objetos brutos do Auth
- Detalhes de outro tenant

### Alertas Recomendados

| Alerta                          | Trigger                                    |
|---------------------------------|--------------------------------------------|
| Pico de 401/403                 | > X em Y minutos por IP                   |
| Rate limit atingido (429)       | > X por IP em janela                       |
| Falhas repetidas de token       | > 5 tentativas inválidas de registro por IP|
| Volume de upload anormal        | > X uploads por tenant em Y minutos       |
| Anomalia de likes               | > X likes por visitor em Y minutos         |

---

## 10. Dependências e CI

### Segurança de Dependências

- Versões travadas (`package-lock.json`)
- Atualizar regularmente
- Examinar com `npm audit` ou similar no CI
- Não usar pacotes abandonados ou com vulnerabilidades conhecidas

### Portões do CI

```
LINT → TYPECHECK → UNIT → INTEGRAÇÃO → RLS → BUILD
```

Todos devem passar antes de merge.

---

## 11. Testes de Segurança Obrigatórios

### Teste de Ataque Mínimo (Fase 1)

| #  | Teste                                                    | Resultado Esperado              |
|----|----------------------------------------------------------|---------------------------------|
| 1  | Registrar com mesmo token duas vezes                     | Segunda tentativa falha         |
| 2  | Trocar UUID de business/item na request                  | 404/403 sem vazamento de dados  |
| 3  | Enviar `owner_user_id` ou `status` no PATCH              | Campos ignorados/rejeitados     |
| 4  | Forçar 20 logins/tokens                                  | 429 conforme política           |
| 5  | Inspecionar bundle Angular e logs                        | Nenhum segredo encontrado       |
| 6  | Chamar API sem Angular (curl/Postman)                    | Backend protege tudo            |

### Testes de Segurança por Nível

| Nível                | Testes                                                        |
|----------------------|---------------------------------------------------------------|
| **Unitário**         | Schemas, normalização, estado do token, expiração             |
| **Integração API**   | Cadastro (sucesso + falhas); login/logout; sessão expirada; tenant A/B; upload inválido |
| **RLS / Banco**      | Allow e deny para SELECT/INSERT/UPDATE/DELETE em cada tabela; anon, authenticated, outro owner |
| **E2E**             | Cadastro com token → painel; login; completar business; criar conteúdo; preview; publicar; /m/:slug |
| **Segurança negativa**| IDOR, mass assignment, brute force, CSRF, XSS, upload polyglot, segredo no bundle |

---

## 12. Checklist de Segurança — Definition of Done

### Para cada feature:

- [ ] Entrada validada com schema allowlist
- [ ] Tenant derivado da sessão, nunca do request body/query
- [ ] RLS ativa e testada para a tabela envolvida
- [ ] Mensagens de erro genéricas (sem detalhes internos)
- [ ] Rate limit aplicado onde necessário
- [ ] Nenhum segredo no código, log, bundle ou resposta
- [ ] CSRF validado para ações mutáveis
- [ ] Upload validado com magic bytes (se aplicável)
- [ ] Teste de isolamento cross-tenant passando
- [ ] `npm audit` sem vulnerabilidades críticas/altas

### Para produção:

- [ ] HTTPS com HSTS
- [ ] CSP configurada
- [ ] Headers de segurança aplicados
- [ ] MFA ativo para admin
- [ ] Recuperação de senha implementada
- [ ] Verificação de e-mail implementada
- [ ] Rotação de segredos possível
- [ ] Backup com teste de restauração
- [ ] Monitoramento de logs e alertas configurados

---

## 13. Referências Técnicas

| Referência                           | URL                                                                  |
|--------------------------------------|----------------------------------------------------------------------|
| Angular Security                     | https://angular.dev/best-practices/security                          |
| Supabase RLS                         | https://supabase.com/docs/guides/database/postgres/row-level-security|
| Supabase Storage Access Control      | https://supabase.com/docs/guides/storage/security/access-control     |
| Supabase User Sessions               | https://supabase.com/docs/guides/auth/sessions                       |
| OWASP Authentication Cheat Sheet     | https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html |
| OWASP REST Security Cheat Sheet      | https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html  |
| OWASP File Upload Cheat Sheet        | https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html    |

---

## Documentos Relacionados

→ [02-AUTENTICACAO-CADASTRO.md](./02-AUTENTICACAO-CADASTRO.md) — Detalhes de auth e token  
→ [08-BANCO-DADOS-RLS.md](./08-BANCO-DADOS-RLS.md) — RLS policies e grants  
→ [09-API-CONTRATOS.md](./09-API-CONTRATOS.md) — Validação e envelope de erro  
→ [01-ARQUITETURA-GERAL.md](./01-ARQUITETURA-GERAL.md) — Separação de camadas
