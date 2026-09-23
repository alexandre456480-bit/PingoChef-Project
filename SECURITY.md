# 🛡️ Modelo de Segurança Vivo (SECURITY.md)

---

## 1. Diretrizes de Segurança de Segredos

1. **Chave de Serviço Supabase (`SUPABASE_SERVICE_ROLE_KEY`)**:
   - **NUNCA** expor no Frontend (Angular).
   - Uso restrito a rotas administrativas e rotas de bypass do BFF Node.js.
2. **Tokens de Sessão (JWT)**:
   - Gerados pelo Supabase Auth.
   - Validados em todo request HTTP no Node.js através de middleware de verificação de assinatura JWT.

---

## 2. Checklist de Hardening Multi-Tenant

- [x] RLS ativado em `profiles`.
- [x] RLS ativado em `businesses`.
- [x] RLS ativado em `categories`.
- [x] RLS ativado em `menu_items`.
- [x] RLS ativado em `promotions`.
- [x] RLS ativado em `design_settings`.
- [x] Storage buckets configurados com políticas de leitura pública e escrita restrita por `owner_user_id`.
- [x] `product_media` protegido por FK composta de tenant/produto.
- [x] RLS de `product_media` permite ao owner somente leitura do próprio tenant.
- [x] `anon` e clientes `authenticated` não podem escrever diretamente em `product_media`.
- [x] `anon` não pode ler a tabela administrativa de mídia.

### Fronteira de segurança de mídia

- IDs Mux, duração observada, status e exclusão são campos controlados pelo
  backend/provedor, nunca pelo Angular.
- A API pública não deve serializar `mux_upload_id`, `mux_asset_id`, caminhos
  internos ou dados do owner.
- O BFF pode usar `service_role` para mutações somente depois de validar a cadeia
  sessão → usuário → business ativo → produto → mídia.
- `product_media` não armazena bytes/Base64 de vídeo nem HTML/iframe externo.
- A tabela recusa publicação antes de `ready` e recusa Mux `ready` acima de 15 s.
- O Angular envia ao BFF somente `itemId`, tamanho declarado e MIME allowlisted;
  `business_id`, status e IDs Mux não fazem parte do payload do cliente.
- O `PUT` direto para a URL temporária Mux não recebe o header `Authorization`
  do PingoChef. O JWT é enviado apenas ao BFF.
- URLs locais `blob:` usadas para ler metadata são revogadas imediatamente.
- A validação Angular de 15 s/50 MiB é uma barreira de UX; duração real,
  ownership, quota e estados continuam validados no backend/provedor.
- O painel não monta `<video>`, iframe ou stream durante upload/processamento.

### Playback e entrega pública

- O endpoint público valida slug, business ativo, disponibilidade do produto,
  ownership da mídia, `source = mux`, `status = ready` e `is_published = true`.
- O preview de owner passa por autenticação e tenant derivado da sessão; draft
  pronto pode ser visto sem tornar a mídia pública.
- Tokens de playback são signed, curtos e limitados a no máximo cinco minutos.
- A resposta pública não inclui upload ID, asset ID, owner, dados de assinatura ou
  caminhos internos.
- O player e seu código são carregados somente após Play e usam `preload="none"`.
- A autorização anônima de playback possui rate limit e respostas sem cache.

### Hardening operacional

- O webhook recebe bytes RAW antes do parser JSON e exige assinatura criptográfica Mux.
- Eventos são reivindicados de forma idempotente; payload bruto não é persistido.
- Reservas de upload usam lock transacional e limites por usuário, IP anonimizado,
  business, dia e quantidade pendente.
- A duração real do asset vem do Mux; acima de 15 s o registro é rejeitado,
  despublicado e o asset é removido.
- Deleções que falham ficam como `pending_deletion`; a reconciliação também
  cancela uploads abandonados e elimina assets órfãos identificáveis.
- O endpoint de reconciliação exige segredo dedicado comparado em tempo constante.
- Logs de segurança registram request ID, evento, rota e status, nunca Authorization,
  URL assinada, JWT de playback, corpo RAW ou credenciais.
- Tokens `local_jwt_` só existem em `APP_MODE=demo` e nunca em produção.
- O segredo HMAC de ativação é obrigatório fora de testes; não existe fallback
  fixo utilizável em runtime.
- CSP restringe scripts/frames e limita delivery/conexões aos provedores necessários;
  headers equivalentes estão declarados para Vercel e hosts compatíveis com `_headers`.
- `npm run security:scan` deve rodar depois do build de produção e falhar se o
  bundle contiver nomes/formatos de secrets privados conhecidos.

### Limitações conhecidas

- `businesses` ainda não possui campos de assinatura ou grace period. Até o domínio
  comercial existir, o gate público disponível é `status = 'ACTIVE'`.
- A CSP mantém `img-src https:` por compatibilidade com o sistema legado de imagens.
  Novos provedores de imagem devem migrar para uma allowlist antes de estreitar essa regra.
- YouTube/Vimeo permanecem fora desta entrega; `frame-src` continua `none`.

---

## 3. Divulgação Responsável & Incidentes

Em caso de identificação de falhas de segurança ou comportamentos anômalos no RLS/API:
1. Notificar a equipe imediatamente via canal de segurança interno.
2. Congelar o token do tenant afetado via flag `status = 'SUSPENDED'`.
