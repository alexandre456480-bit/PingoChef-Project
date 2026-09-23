# 📜 ADR — Registro de Decisões de Arquitetura (DECISIONS.md)

---

## ADR-001: Escolha da Stack Base (Angular + Node.js + Supabase)
- **Data**: 2026-09-07
- **Status**: Aceito
- **Contexto**: O projeto necessita de um painel administrativo ágil com preview em tempo real e um cardápio público rápido, seguro e escalável.
- **Decisão**: Utilizar Angular no Frontend para forte tipagem e gerenciamento de estado local via Signals; Node.js no Backend como BFF (Backend-For-Frontend) para validações rigorosas e abstração de segredos; e Supabase como BaaS para Auth, PostgreSQL com RLS e Storage.
- **Consequências**:
  - (+) Alta velocidade de desenvolvimento de formulários complexos no Angular.
  - (+) Segurança garantida pelo PostgreSQL RLS no nível do banco de dados.
  - (-) Exige manutenção de dois ambientes (Node.js e Supabase).

---

## ADR-002: Estratégia de Isolamento Multi-Tenant via RLS
- **Data**: 2026-09-07
- **Status**: Aceito
- **Contexto**: Múltiplos restaurantes (tenants) compartilharão o mesmo banco de dados PostgreSQL.
- **Decisão**: Adotar o modelo de Shared Database com `business_id` em todas as tabelas e aplicar Row Level Security (RLS) habilitado nativamente no PostgreSQL.
- **Consequências**:
  - (+) Custo-benefício excelente (um único cluster de banco atende milhares de estabelecimentos).
  - (+) Impossibilidade de vazamento de dados via queries diretas no Supabase Client.
  - (-) Necessidade de incluir `business_id` em índices compostos e constraints.

---

## ADR-003: Validação de Tokens de Ativação no BFF Node.js
- **Data**: 2026-09-07
- **Status**: Aceito
- **Contexto**: O cadastro gera um token de ativação (`ACT-XXXX`) que precisa ser ativado antes de liberar o painel do usuário.
- **Decisão**: A validação e queima do token ocorrem exclusivamente via endpoint seguro no Node.js BFF (`POST /api/v1/auth/activate`), utilizando o Supabase Service Role Key em ambiente fechado.
- **Consequências**:
  - (+) Impede ataques de força bruta no Supabase Client direto.
  - (+) Permite auditoria e rate limit estrito por IP no Node.js.

---

## ADR-004: Mídia de produto com integridade composta e escrita somente pelo BFF

- **Data**: 2026-09-23
- **Status**: Aceito (Fase 1 da funcionalidade de vídeo)
- **Contexto**: Vídeos introduzem IDs administrativos, custo de provedor e um
  ciclo de vida que não pode ser controlado diretamente pelo cliente. A tabela
  também precisa impedir associação cross-tenant mesmo em uma escrita
  privilegiada.
- **Decisão**:
  - criar `product_media` como coleção ordenada e extensível, preservando
    `menu_items.image_url` durante a transição;
  - usar FK composta `(business_id, menu_item_id)` para provar ownership no
    banco;
  - bloquear escrita direta para `anon` e `authenticated`; o owner pode apenas
    ler as próprias mídias via RLS;
  - concentrar mutações futuras no BFF, com validação de sessão/tenant/produto
    antes de usar `service_role`;
  - impedir no banco que um vídeo Mux acima de 15 segundos fique `ready` e que
    qualquer mídia não pronta seja publicada;
  - não conceder leitura pública direta da tabela, evitando vazamento de IDs
    Mux. A API pública futura deverá retornar uma projeção sanitizada.
- **Consequências**:
  - (+) isolamento independe da correção do payload ou de filtros da API;
  - (+) clientes não conseguem burlar quota, status ou deleção provider-aware;
  - (+) índices suportam galeria, observabilidade e jobs de reconciliação;
  - (-) toda mutação requer endpoint controlado no BFF;
  - (-) publicação por snapshot continua pendente e `is_published` funciona
    apenas como trava transitória explícita.

---

## ADR-005: Upload Mux direto e estado de UX separado do formulário

- **Data**: 2026-09-23
- **Status**: Aceito (Fase 3 da funcionalidade de vídeo)
- **Contexto**: O painel precisa validar e enviar vídeos com progresso sem fazer
  o arquivo atravessar o BFF ou misturar estado efêmero de rede ao DTO do produto.
- **Decisão**:
  - manter a criação da URL autorizada no BFF e executar o `PUT` do arquivo
    diretamente do navegador para o Mux;
  - isolar seleção, validação, progresso, polling e cancelamento em um componente
    standalone e em um serviço Angular dedicados;
  - habilitar upload somente depois que o produto possuir `itemId` persistido;
  - bloquear fechamento/salvamento durante seleção e transferência, mas liberar
    o painel quando o backend já controla o estado `processing`;
  - cancelar o request no browser e solicitar exclusão idempotente ao BFF;
  - não montar player, stream, iframe ou URL de playback no painel desta fase.
- **Consequências**:
  - (+) bytes e credenciais Mux permanecem fora do BFF e do bundle;
  - (+) progresso reflete bytes realmente enviados pelo navegador;
  - (+) o processamento sobrevive ao fechamento do modal;
  - (-) o `PUT` simples reinicia do zero se a conexão cair; para arquivos de até
    50 MiB esse compromisso foi preferido a adicionar uma dependência de upload
    em chunks nesta fase;
  - (-) validação local melhora UX, mas não substitui webhook e constraints.

---

## ADR-006: Playback signed sob demanda e defesa operacional em profundidade

- **Data**: 2026-09-23
- **Status**: Aceito (Fases 4 e 5 da funcionalidade de vídeo)
- **Contexto**: O cardápio é público, mas a listagem não deve iniciar delivery,
  expor identificadores administrativos nem permitir uso irrestrito do Mux como CDN.
- **Decisão**:
  - manter o playback ID signed no backend e emitir JWT de curta duração somente
    depois que slug, business ativo, produto, mídia, status e publicação forem validados;
  - retornar ao cliente apenas o playback ID necessário, token temporário, expiração
    e título sanitizado;
  - montar o Mux Player somente após Play, com `preload="none"`, e desmontá-lo na
    troca/saída da mídia;
  - usar um renderer de galeria compartilhado por preview e produção;
  - restringir origens de mídia/conexão via CSP e verificar o bundle contra secrets;
  - executar reconciliação autenticada para uploads abandonados, deleções
    pendentes e assets Mux órfãos.
- **Consequências**:
  - (+) nenhum stream é solicitado na listagem ou na abertura do produto;
  - (+) tokens copiados possuem janela de uso curta e rate limit por IP;
  - (+) falhas do provedor preservam referência local para retry;
  - (-) a disponibilidade comercial ainda usa `businesses.status = 'ACTIVE'` porque
    o projeto não possui modelo de assinatura/grace period;
  - (-) playback real exige chaves Mux e validação no ambiente publicado.
