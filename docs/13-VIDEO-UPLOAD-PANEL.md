# Upload de vídeo no painel — Fase 3

## Escopo

Atualização de 11/10/2026: o uploader notifica a detecção de mudanças do Angular 22 após respostas assíncronas e progresso. O polling usa `exhaustMap`, com timeout por requisição, pausa após falhas repetidas ou dez minutos e ação explícita para verificar o status novamente. O processamento no provedor permite salvar o produto; o vídeo novo deve ficar pronto antes de publicar o cardápio.

O GET autenticado de mídias recupera transições de upload/asset perdidas por webhook. A consulta usa somente referências Mux já vinculadas ao produto da conta, mantém a validação de duração/playback assinado e limita consultas ao provedor a uma por mídia a cada 15 segundos, com atualização condicional de `last_provider_sync_at` no banco. Não cancela uploads dentro do prazo nem publica automaticamente vídeos novos. A estrutura existente do banco atende à correção, sem nova migration. Webhook e scheduler continuam sendo os mecanismos principais. Testes locais cobrem recuperação sem webhook, falhas, isolamento e envio/publicação no navegador com APIs simuladas.

Esta fase conecta o editor Angular aos endpoints Mux da Fase 2. Ela não cria
player, playback público, links externos ou galeria do consumidor.

## Fluxo

Na recuperação complementar, o polling começa durante o PUT, sem depender de sua resposta final. Enquanto o Mux ainda informa `waiting/uploading`, a tela mantém o estado de envio e as ações de cancelar; ao confirmar `processing/ready`, encerra a assinatura do PUT e passa ao estado confirmado pelo backend. Falhas na resposta do navegador preservam a mídia e consultam o status, evitando apagar um arquivo já recebido pelo provedor. Testes cobrem respostas normais, atrasadas e interrompidas. Em 11/10/2026, duas mídias reais que permaneciam `uploading` foram recuperadas pela RPC existente após validar asset pronto, duração e playback assinado; não houve publicação automática.

```text
selecionar -> validar localmente -> solicitar upload-intent
-> PUT navegador/Mux -> processando -> pronto | rejeitado | erro
```

O upload fica disponível somente na edição de um produto persistido. Produtos
novos precisam ser salvos antes porque o BFF exige um `itemId` real e pertencente
ao tenant autenticado.

## Validação local

- allowlist: MP4, MOV e WebM;
- tamanho máximo: 50 MiB;
- duração máxima: exatamente 15 segundos;
- metadata lida por um elemento de vídeo temporário usando URL `blob:` revogada;
- nenhum upload-intent é solicitado quando o preflight falha.

Essa validação é somente UX. O backend continua sendo a autoridade para tamanho
declarado, quotas, ownership e duração real recebida do Mux.

## Transferência e cancelamento

O Angular pede uma URL temporária ao BFF com JWT e depois executa um `PUT`
diretamente ao Mux. O request Mux recebe somente `Content-Type`; o token do
PingoChef nunca é encaminhado ao host de storage.

Angular `HttpClient` fornece o progresso real de upload e cancelar desfaz a
subscription/XHR. Quando já existe `mediaId`, o painel chama também a exclusão
idempotente do backend, que resolve corridas com criação do asset e indisponibilidade
do provedor.

Foi escolhido `PUT` simples, oficialmente suportado pelo Direct Upload, porque o
produto limita arquivos a 50 MiB. Upload em chunks/recomeço parcial fica como
evolução caso telemetria real mostre necessidade.

## Estados e acessibilidade

O componente apresenta `selecionando`, `validando`, `enviando`, `processando`,
`pronto`, `erro` e `rejeitado`. A seleção usa um botão nativo acessível por
teclado, progresso tem atributos ARIA e mensagens usam `role=status/alert`.

Animações ficam em transform/opacity/progresso, hovers só são aplicados em
dispositivos adequados e existe tratamento de `prefers-reduced-motion`. O mascote
existente aparece apenas em processamento, sucesso e erro.

O painel faz polling da projeção sanitizada do BFF. Nenhum ID administrativo Mux
é exibido ou armazenado pelo componente, e nenhum player/stream é montado.

