# Mux no backend — Fase 2

## Escopo entregue

Esta fase implementa somente a fronteira backend do upload Mux. Não inclui
componente Angular, player, token de playback, links externos nem publicação.

O fluxo é:

```text
JWT -> reserva atômica no PostgreSQL -> Direct Upload assinado
    -> navegador envia bytes ao Mux -> webhook assinado
    -> processing -> ready | rejected | errored
```

O BFF nunca recebe os bytes do vídeo. O cliente também nunca informa
`business_id`, IDs Mux ou status como autoridade.

## Endpoints

### `POST /api/v1/items/:itemId/media/video/upload-intent`

Exige Bearer JWT e `Origin` pertencente à allowlist. O corpo é estrito:

```json
{
  "fileSizeBytes": 1048576,
  "mimeType": "video/mp4"
}
```

Tipos aceitos: `video/mp4`, `video/quicktime` e `video/webm`. O endpoint deriva o
tenant da sessão e a função SQL `reserve_video_upload` serializa reservas por
business com advisory lock. Na mesma transação ela valida owner/business ativo,
FK do produto, cota diária, pendências e rate limits por user, business e HMAC
do IP.

Somente depois da reserva o backend cria a Direct Upload URL. O asset futuro é
configurado com playback `signed`, CORS exato e TTL curto. A resposta contém
somente `mediaId`, URL temporária, expiração e limites públicos. Se persistir o
`mux_upload_id` falhar, o backend tenta cancelar o upload para evitar órfãos.

### `POST /api/v1/webhooks/mux`

A rota recebe no máximo 1 MB como bytes brutos e está montada antes de
`express.json()`. `@mux/ts` valida assinatura e timestamp com o signing secret;
payload sem assinatura válida não chega ao serviço de domínio.

Eventos tratados:

- `video.upload.asset_created`: vincula o asset previamente autorizado e move
  a mídia para `processing`;
- `video.asset.ready`: usa a duração real do Mux e exige playback ID `signed`;
- `video.asset.errored` e `video.upload.errored`: movem a mídia para `errored`.

`mux_webhook_events.event_id` e uma claim transacional tornam o processamento
idempotente. Não se persiste o corpo bruto do webhook. Eventos fora de ordem
podem correlacionar asset pelo `mux_upload_id` já registrado, nunca por um ID
enviado por usuário.

### `DELETE /api/v1/items/:itemId/media/:mediaId`

Exige JWT e consulta pela tupla `business_id + menu_item_id + media_id`. A linha
é marcada `pending_deletion` antes da chamada ao Mux. `404` do provedor é
sucesso idempotente; indisponibilidade preserva a referência e incrementa a
tentativa para reconciliação posterior.

### `GET /api/v1/items/:itemId/media`

Lista os estados da galeria do produto autenticado para polling futuro do
painel. A projeção omite `mux_upload_id`, `mux_asset_id` e `mux_playback_id`.

### `POST /api/v1/internal/videos/reconcile`

Endpoint operacional protegido por um segredo dedicado comparado em tempo
constante. Deve ser invocado por scheduler privado. Ele:

- tenta novamente exclusões pendentes;
- cancela uploads vencidos e os marca `errored`;
- reconsulta assets presos em `processing`;
- recupera transições perdidas por falha ou atraso de webhook.

## Limites e estados

- tamanho declarado máximo: 50 MiB (`52.428.800` bytes);
- duração real máxima: exatamente 15 segundos, sem tolerância;
- `15.000` pode virar `ready`; `15.001` vira `rejected` e o asset é apagado;
- playback nunca é público: o asset nasce com política `signed`;
- `is_published` continua falso nesta fase.

A API de Direct Upload do Mux não oferece um campo server-side de tamanho
máximo. Portanto, 50 MiB é aplicado no preflight do BFF e no banco sobre a
declaração; a futura Fase de frontend também deverá usar o limite do uploader.
Um cliente hostil ainda pode mentir sobre o tamanho depois de receber a URL.
Essa limitação do protocolo não deve ser descrita como garantia criptográfica.
A duração, por outro lado, é validada contra metadata real do Mux e o banco
impede `ready` acima de 15 segundos.

## Configuração do dashboard Mux

1. Criar Access Token com acesso de escrita a Mux Video para o ambiente correto.
2. Criar um webhook apontando para
   `https://<api>/api/v1/webhooks/mux`.
3. Assinar ao menos os eventos listados acima.
4. Copiar o signing secret para o backend, nunca para Angular/Vercel público.
5. Usar credenciais e webhooks distintos para development, staging e produção.
6. Agendar a conciliação com autenticação privada e intervalo compatível com
   o TTL configurado.

## Banco e implantação

A migration `20260924000000_add_video_backend_controls.sql` adiciona metadata de
upload/exclusão a `product_media`, tabelas privadas de tentativas e eventos,
índices operacionais e RPCs restritas ao `service_role`.

Ordem segura de deploy:

1. aplicar a migration;
2. configurar todos os segredos e allowlists;
3. publicar o backend;
4. configurar e testar o webhook Mux;
5. habilitar o scheduler de reconciliação.

Não publicar o backend novo antes da migration: o endpoint responderá erro de
serviço ao tentar reservar uploads.

## Testes

- Jest cobre configuração, reserva, quotas, anti-órfão, webhooks, duração,
  assinatura ausente e exclusão idempotente;
- `video_backend_controls.test.sql` tem 22 asserções pgTAP para estrutura,
  limites, ownership, rate limit, idempotência e grants;
- `product_media_rls.test.sql` continua cobrindo as 25 asserções da Fase 1.
