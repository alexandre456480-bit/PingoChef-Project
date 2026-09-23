# Product Media — arquitetura de banco (Fase 1)

## Escopo desta fase

Esta fase cria somente a fundação PostgreSQL para mídia de produtos. Não há
integração com Mux, endpoints de upload/webhook/playback, alteração de frontend
ou player.

O código atual usa:

- Angular 22 standalone no painel e no menu público;
- Express/TypeScript como BFF;
- Supabase Auth, PostgreSQL e RLS;
- `businesses.owner_user_id = auth.uid()` como raiz do tenant;
- `menu_items.image_url` como imagem legada;
- leitura pública do estado vivo das tabelas pelo BFF com `service_role`.

O preview e `/m/:slug` já compartilham `PublicMenuViewComponent`, mas o fluxo de
snapshot/publicação descrito nos documentos antigos ainda não existe no banco
ou na API. Por isso, `product_media.is_published` é uma trava explícita de
transição; ela não é apresentada como substituta de um futuro snapshot
imutável.

## Modelo definitivo de `product_media`

Cada linha representa uma mídia ordenável de um produto:

| Grupo | Colunas | Regra |
| --- | --- | --- |
| Identidade | `id`, `business_id`, `menu_item_id` | UUIDs; tenant e produto obrigatórios |
| Classificação | `media_type`, `source`, `provider` | allowlists fechadas |
| Galeria | `position`, `is_published` | posição não negativa; só mídia `ready` pode ser publicada |
| Ciclo de vida | `status` | `waiting`, `uploading`, `processing`, `ready`, `rejected`, `errored`, `pending_deletion` |
| Storage | `storage_object_path` | chave do objeto, nunca bytes/Base64 |
| Mux | `mux_upload_id`, `mux_asset_id`, `mux_playback_id` | IDs administrativos privados e únicos quando presentes |
| Externo | `external_provider`, `external_video_id` | apenas YouTube/Vimeo; nenhum HTML, iframe ou URL arbitrária |
| Metadata | `duration_seconds` | duração observada pelo provedor, não pelo browser |
| Auditoria | `created_at`, `updated_at` | `updated_at` mantido por trigger |

### Formatos válidos por origem

- `storage`: imagem, provider `supabase`, com `storage_object_path`.
- `mux`: vídeo, provider `mux`; os IDs aparecem conforme o processamento.
- `external`: vídeo, provider e `external_provider` iguais a `youtube` ou
  `vimeo`, com ID normalizado do vídeo.

Esses formatos são mutuamente exclusivos por `CHECK`. O banco não aceita URL de
embed, arquivo de vídeo, Base64 nem combinações ambíguas de IDs.

## Integridade multi-tenant

`menu_items` recebe a candidate key `UNIQUE (business_id, id)`. A mídia usa:

```sql
FOREIGN KEY (business_id, menu_item_id)
REFERENCES menu_items (business_id, id)
```

Assim, mesmo uma escrita privilegiada falha se tentar associar o business A a
um produto do business B. A validação não depende somente do Angular, do BFF ou
de uma trigger suscetível a esquecimento.

## Invariantes de estado

- `uploading` exige origem Mux e `mux_upload_id`.
- `processing` exige origem Mux e `mux_asset_id`.
- Mux `ready` exige asset, playback ID e duração real.
- Mux `ready` exige `duration_seconds <= 15`, sem tolerância silenciosa.
- `is_published = true` exige `status = 'ready'`.
- Durações e posições negativas são recusadas.
- IDs vazios são recusados.

O limite no banco é a última barreira, não substitui a validação de UX nem o
tratamento do webhook. Um asset acima de 15 segundos deverá ser persistido como
`rejected` na Fase 2 e removido do provedor de forma idempotente.

## Índices

- IDs Mux e caminho de Storage: únicos quando presentes.
- Vídeo externo: único por produto/provedor/ID.
- `(business_id, menu_item_id, position, created_at, id)`: galeria ordenada.
- `(business_id, status)`: métricas e quotas por tenant.
- índice parcial de mídia publicada/pronta: leitura futura do menu.
- índice parcial de trabalho pendente: reconciliação, timeout e exclusão.

Não há `UNIQUE (menu_item_id, position)`: reordenação temporariamente pode
precisar de posições repetidas, e o desempate estável é `created_at, id`.

## RLS e fronteira de escrita

| Papel | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `anon` | negado | negado | negado | negado |
| `authenticated` owner | somente o próprio tenant | negado | negado | negado |
| `authenticated` outro owner | nenhuma linha | negado | negado | negado |
| BFF `service_role` | permitido | permitido | permitido | permitido |

A ausência intencional de escrita direta para `authenticated` impede contornar
rate limit, quota, validação de link, transições do provedor e exclusão segura.
Na Fase 2, o BFF poderá escrever com `service_role` somente após validar:

```text
JWT válido → auth user → business ativo → produto do mesmo business → mídia
```

O uso da `service_role` não transfere confiança ao payload: `business_id`, IDs
Mux, duração e status continuam derivados pelo servidor/provedor.

## Exposição pública

Não existe policy pública nem grant para `anon`. Isso é deliberado: um `SELECT`
direto da tabela revelaria `mux_upload_id`, `mux_asset_id` e outros campos
administrativos. A futura API pública deve projetar apenas IDs públicos do
PingoChef, tipo, posição e dados visuais necessários, após validar business,
produto, publicação e assinatura.

## Compatibilidade com imagens atuais

`menu_items.image_url` permanece intacto nesta fase. Não há backfill automático
porque os dados atuais podem ser URL remota ou `data:` e não provam a existência
de um objeto no Supabase Storage. A migração de imagens será separada,
observável e reversível; até lá, o renderer continua usando a coluna legada.

## Testes de banco

`supabase/tests/product_media_rls.test.sql` cobre:

- estrutura mínima da tabela;
- linha válida;
- associação cross-tenant recusada pela FK composta;
- incoerência de provider recusada;
- Mux pronto acima de 15 segundos recusado;
- publicação antes de `ready` recusada;
- unicidade de asset Mux;
- SELECT isolado entre owners A e B;
- INSERT/UPDATE/DELETE diretos bloqueados para `authenticated`;
- acesso `anon` bloqueado.

O teste deve rodar em banco descartável com todas as migrations aplicadas:

```bash
supabase test db
```

## Evolução na Fase 2

A integração backend com Mux, quotas, webhook e reconciliação foi desenhada
em `12-MUX-BACKEND-INTEGRATION.md`. Playback público, links externos e frontend
continuam fora desta fase.

## Itens originalmente adiados para a Fase 2

- SDK e credenciais Mux;
- Direct Upload e suas quotas/rate limits;
- tabela/estratégia de idempotência de eventos do webhook;
- endpoints privados e públicos;
- validação de URLs externas;
- tokens de playback assinados;
- reconciliação/exclusão de assets;
- contratos DTO e projeções públicas;
- qualquer mudança de frontend/player/CSP.
