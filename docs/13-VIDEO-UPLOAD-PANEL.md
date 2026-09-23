# Upload de vídeo no painel — Fase 3

## Escopo

Esta fase conecta o editor Angular aos endpoints Mux da Fase 2. Ela não cria
player, playback público, links externos ou galeria do consumidor.

## Fluxo

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

