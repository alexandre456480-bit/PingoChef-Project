# 🔐 02 — Autenticação e Cadastro

> **Domínio**: Login, registro com token de ativação, sessão BFF, logout, estados de autenticação e validações.  
> **Depende de**: [01-ARQUITETURA-GERAL.md](./01-ARQUITETURA-GERAL.md), [07-CYBERSECURITY.md](./07-CYBERSECURITY.md), [08-BANCO-DADOS-RLS.md](./08-BANCO-DADOS-RLS.md)  
> **Referenciado por**: [03-PAINEL-USUARIO.md](./03-PAINEL-USUARIO.md), [09-API-CONTRATOS.md](./09-API-CONTRATOS.md), [10-ROADMAP-FASES.md](./10-ROADMAP-FASES.md)

---

## 1. Visão Geral do Fluxo de Auth

```
┌─────────────┐    ┌──────────────┐    ┌──────────────────┐    ┌───────────────┐
│   CADASTRO  │───▶│    LOGIN     │───▶│  SESSÃO ATIVA    │───▶│    PAINEL     │
│  (+ token)  │    │ (email+senha)│    │ (cookie BFF)     │    │  (autenticado)│
└─────────────┘    └──────────────┘    └────────┬─────────┘    └───────────────┘
                                                │
                                    ┌───────────┴───────────┐
                                    ▼                       ▼
                            ┌──────────────┐       ┌──────────────┐
                            │   EXPIRADA   │       │    LOGOUT    │
                            │ (re-login)   │       │ (limpa tudo) │
                            └──────────────┘       └──────────────┘
```

---

## 2. Arquitetura de Sessão — Padrão BFF (Backend for Frontend)

O Angular **nunca** armazena tokens JWT diretamente. O Node.js atua como BFF:

| Componente       | Responsabilidade                                              |
|------------------|---------------------------------------------------------------|
| **Node.js (BFF)**| Interage com Supabase Auth, mantém tokens em cookies seguros  |
| **Cookies**      | `HttpOnly`, `Secure`, `SameSite=Strict`                       |
| **Angular**      | Chama a API Node via HTTP, recebe estado de sessão via `/api/auth/session` |
| **CSRF**         | Token CSRF validado no servidor para ações mutáveis           |

### Fluxo Detalhado

```
[Angular]                    [Node.js API]               [Supabase Auth]
    │                             │                            │
    │── POST /api/auth/login ────▶│                            │
    │   { email, password }       │── signInWithPassword ─────▶│
    │                             │◀── access_token + refresh ─│
    │                             │                            │
    │                             │── Set-Cookie: session ────▶│ (HttpOnly, Secure)
    │◀── { user, business } ──────│                            │
    │                             │                            │
    │── GET /api/auth/session ───▶│── valida cookie ──────────▶│
    │◀── { authenticated, user }──│                            │
```

### O que o Angular faz

- **AuthGuard**: Melhora UX redirecionando para `/login`, mas **não protege recurso** (a API decide).
- **Interceptor CSRF**: Envia token CSRF conforme contrato do servidor.
- **Interceptor de Sessão**: Detecta `401` e redireciona para login.
- **Estado de Auth**: Mantido em service reativo (BehaviorSubject/Signal).

### O que o Angular NÃO faz

- ❌ Gravar senha/token em localStorage
- ❌ Armazenar JWT no browser
- ❌ Confiar em guards como proteção real
- ❌ Enviar `business_id` como parâmetro de autorização

---

## 3. Cadastro com Token de Ativação

### Regras do Token

| Propriedade     | Valor                                                          |
|-----------------|----------------------------------------------------------------|
| Geração         | Manualmente pelo admin (MVP); alta entropia                    |
| Validade        | Configurável (recomendação inicial: 30 dias)                   |
| Uso             | **Único** — uma vez consumido, nunca mais reutilizado          |
| Armazenamento   | Apenas como **hash/HMAC** no banco; raw token nunca persiste   |
| Relação com sub | Token ativa onboarding; **mensalidade altera subscription, não reativa token** |
| Na URL          | **Nunca** — token não identifica negócio e não aparece em rota |

### Fluxo de Registro: `POST /api/auth/register`

```
1. Validar e-mail, senha (política), formato do token
2. Derivar token_hash = HMAC(server_secret, raw_token)
3. Localizar token: status=unused, não expirado, não reservado
4. Reservar token por curto período (evitar race condition)
5. Criar usuário no Supabase Auth
6. Em TRANSAÇÃO:
   ├── Consumir token (status=used, used_at, used_by)
   ├── Criar profile (user_id)
   ├── Criar business vazio (owner_user_id, status=active)
   └── Criar subscription (business_id, status=active, starts_at, expires_at)
7. Se falhar: COMPENSAR
   ├── Reverter criação do usuário no Auth
   └── Liberar reserva do token
8. Criar sessão segura (cookies BFF)
9. Devolver DTO mínimo { user, business }
```

### Cenários de Token

| Token       | Permitido      | Resposta                                                 |
|-------------|----------------|----------------------------------------------------------|
| Válido      | Uma criação    | Conta, business e subscription criados; `used_at` preenchido |
| Inválido    | Nenhuma        | Mensagem genérica + rate limit                           |
| Expirado    | Nenhuma        | Informar expiração sem revelar dados internos            |
| Usado       | Nenhuma        | Não criar nova conta; orientar suporte                   |
| 2 requests simultâneos | Somente uma | Constraint/transação impede duplo consumo         |

### Status do Token no Banco

```
unused → reserved → used      (fluxo feliz)
unused → reserved → unused    (falha, compensação)
unused → revoked               (admin revoga)
unused → expired               (expirou sem uso)
```

---

## 4. Login

### Endpoint: `POST /api/auth/login`

**Entrada**: `{ email, password }`

**Fluxo**:
1. Validar formato de e-mail e presença de senha
2. Chamar `supabase.auth.signInWithPassword`
3. Se válido: criar sessão em cookie `HttpOnly/Secure/SameSite`
4. Devolver DTO mínimo `{ user, business (status mínimo) }`
5. Se inválido: **mensagem genérica** ("Credenciais inválidas") — nunca revelar se o e-mail existe

### Rate Limit

- Rate limit progressivo para tentativas de login
- Mensagem genérica para credenciais inválidas
- Logs de tentativas (sem senha)
- MFA no admin (antes de produção)

---

## 5. Logout

### Endpoint: `POST /api/auth/logout`

1. Validar CSRF + sessão
2. Revogar/encerrar sessão no Supabase Auth
3. Limpar cookies de sessão
4. Angular limpa estado em memória e redireciona para `/login`

---

## 6. Sessão — `GET /api/auth/session`

**Entrada**: Cookie de sessão

**Saída**:
```json
{
  "authenticated": true,
  "user": {
    "id": "uuid",
    "email": "user@email.com"
  },
  "business": {
    "id": "uuid",
    "name": "Pizzaria Bella",
    "status": "active"
  },
  "subscription": {
    "status": "active",
    "expiresAt": "2026-10-07T..."
  }
}
```

**Se não autenticado**: `{ "authenticated": false }`

---

## 7. Estados de Autenticação

```
UNAUTHENTICATED → REGISTERING → ACTIVE_SESSION
ACTIVE_SESSION → EXPIRED_SESSION → UNAUTHENTICATED
```

### Estados derivados do business/subscription

| Condição                          | Comportamento                              |
|-----------------------------------|--------------------------------------------|
| `business.active` + `subscription.active` | Painel completo + cardápio público ativo |
| `subscription.expired`           | Painel limitado / tela de renovação; público controlado |
| `business.suspended`             | Acesso negado conforme política administrativa |

---

## 8. Tela de Login — Requisitos de UI

### Layout
- **Desktop**: Duas áreas — esquerda com marca/benefício, direita com formulário
- **Mobile**: Formulário prioritário em coluna única

### Campos
- E-mail (input type="email")
- Senha (com toggle mostrar/ocultar)
- Botão "Entrar"

### Estados da Tela
| Estado                | Comportamento                                               |
|-----------------------|--------------------------------------------------------------|
| Carregando            | Skeleton/spinner; botão desabilitado                         |
| Credencial inválida   | Mensagem genérica junto ao formulário                        |
| Rate limit (429)      | Informar para tentar novamente depois                        |
| Sessão expirada       | Redirecionamento automático + mensagem contextual            |
| Indisponibilidade     | Mensagem de erro recuperável                                 |

### Validações
- E-mail: formato válido no front (validação real no servidor)
- Senha: presença obrigatória (política de força no servidor)

### Acessibilidade
- Funcionar com teclado e leitores de tela
- Zoom de 200%
- Foco visível em todos os campos
- Erros associados ao campo via `aria-describedby`
- `prefers-reduced-motion` respeitado

---

## 9. Tela de Cadastro — Requisitos de UI

### Campos
| Campo            | Tipo            | Validação                                          |
|------------------|-----------------|----------------------------------------------------|
| E-mail           | `email`         | Formato válido; normalização server-side            |
| Senha            | `password`      | Política de comprimento e bloqueio de senhas comuns  |
| Confirmar senha  | `password`      | Deve ser igual à senha                              |
| Token de ativação| `text`          | Aceita grupos visuais; normalizado no servidor      |
| Aceite de termos | `checkbox`      | Obrigatório para criar conta                        |

### Botão
- "Criar Conta"
- **Protegido contra duplo clique** (desabilitado durante request)

### Estados da Tela
| Estado                | Comportamento                                               |
|-----------------------|--------------------------------------------------------------|
| Carregando            | Spinner no botão; formulário bloqueado                       |
| Força da senha        | Indicador visual (fraca/média/forte)                         |
| Token inválido        | Mensagem: "Verifique o código informado"                     |
| Token expirado        | Mensagem de expiração sem revelar dados internos             |
| Token já usado        | Orientar contato com suporte                                 |
| Conflito de e-mail    | Mensagem genérica (não revelar se e-mail existe)             |
| Sucesso               | Redireciona para `/painel` com sessão ativa                  |

### Validações de Segurança
- E-mail normalizado para comparação (trim, lowercase)
- E-mail nunca refletido sem escape (prevenção XSS)
- Senha com política de comprimento e bloqueio de senhas comuns/vazadas
- Token normalizado no servidor; mensagens não expõem hash, ID, comprador ou datas
- Rate limit no endpoint de registro

---

## 10. Dados de Teste

> ⚠️ **Regra crítica**: Valores de teste **nunca** entram em:
> - Código versionado
> - PDF ou README público
> - Logs ou screenshots
> - Commits ou mensagens de commit

### Variáveis de Ambiente

```bash
# .env.local (NÃO VERSIONADO)
TEST_USER_EMAIL=teste@exemplo.com
TEST_USER_PASSWORD=SenhaSegura123!
TEST_ACTIVATION_TOKEN=TOKEN_DE_TESTE_AQUI
```

### Seed de Desenvolvimento
- Mecanismo de seed local que cria conta/token de teste
- Script em `supabase/seed.sql` ou similar (não versionado com valores reais)
- Usar placeholders no `.env.example`

---

## 11. Preparação para Futuro (não implementar agora)

| Recurso                   | Status           | Notas                                              |
|---------------------------|------------------|-----------------------------------------------------|
| Recuperação de senha      | Antes de produção| Estrutura de estados e telas deve ser preparada agora |
| Verificação de e-mail     | Antes de produção| Idem                                                |
| MFA / Step-up auth        | Antes de produção| Essencial para admin                                |
| Múltiplos usuários        | Futuro           | Arquitetura já separa user de business              |

---

## Referências

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Supabase Auth Sessions](https://supabase.com/docs/guides/auth/sessions)
- [Angular Security Best Practices](https://angular.dev/best-practices/security)

---

## Documentos Relacionados

→ [07-CYBERSECURITY.md](./07-CYBERSECURITY.md) — Rate limit, credential stuffing, CSRF  
→ [08-BANCO-DADOS-RLS.md](./08-BANCO-DADOS-RLS.md) — Tabelas `activation_tokens`, `profiles`, `subscriptions`  
→ [09-API-CONTRATOS.md](./09-API-CONTRATOS.md) — Detalhamento dos endpoints de auth  
→ [03-PAINEL-USUARIO.md](./03-PAINEL-USUARIO.md) — O que acontece após login bem-sucedido
