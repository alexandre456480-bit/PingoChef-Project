# Pré-lançamento: auditoria inicial de segurança e integração

Data: 08/11/2026. Estado: **pendente de correções e inspeção SQL remota**. Este documento não certifica segurança absoluta nem substitui um teste de invasão independente.

Atualização: as dependências de produção apontadas foram corrigidas no projeto, com auditoria sem avisos conhecidos nesse escopo. A restrição de leitura pública foi implementada e validada localmente; sua ativação na hospedagem depende da aplicação de `20261108173908_restrict_public_menu_item_reads.sql` e do deploy do backend/frontend atualizados. As seções anteriores registram o diagnóstico; o estado da correção consta ao final.

## Evidências coletadas

- Backend: 35 suítes, 404 testes aprovados, 2 testes opcionais ignorados. Isso verifica os cenários escritos, não todos os ataques possíveis.
- Frontend: 28 arquivos, 168 testes aprovados.
- Scanner de fontes: 479 arquivos aprovados. Scanner do build frontend: 39 arquivos aprovados, comparando 12 valores privados conhecidos sem exibi-los. Não houve auditoria completa de segredos em todo o histórico Git ou nos logs da hospedagem.
- Manifesto: 64 migrações locais ordenadas e com hashes válidos. Isso não comprova que todas foram aplicadas no Supabase.
- A suíte PostgreSQL temporária passou na correção de vídeo imediatamente anterior, incluindo concorrência, RLS, planos, referências entre empresas e restauração do contrato de vídeo.
- Hospedagem: sem sessão, `/auth/me`, `/items`, `/admin/auth/session`, `/admin/businesses`, `/analytics` e `/qr` responderam 401. Esses testes foram somente leitura.
- Supabase anônimo: nenhuma RPC apareceu no catálogo OpenAPI consultado. Sessões, intenções de cadastro, transferências, recomendações, estado de vídeo e entitlements recusaram leitura anônima; `profiles` retornou contagem zero. Isso não prova isolamento para todas as identidades autenticadas.
- A página hospedada apresentou CSP, HSTS, nosniff, Referrer-Policy e Permissions-Policy. A presença desses headers não comprova que toda diretiva seja ideal.
- Revisão direcionada: sessões BFF HttpOnly, escopo separado para recuperação, verificação de Origin/CSRF, autenticação administrativa com suporte a MFA, webhooks raw antes do parser e emissão signed de playback estão implementados. Configuração operacional ainda precisa ser auditada.

## Achados e decisão de liberação

| Prioridade | Achado | Evidência / próximo passo |
|---|---|---|
| Alta | Dependências de produção com avisos conhecidos | `npm audit --omit=dev`: backend 2 altos/2 moderados; frontend 1 alto. Bibliotecas listadas abaixo. Atualizar de maneira controlada e repetir testes; não executar `npm audit fix --force` indiscriminadamente. |
| Alta para liberação | Não há evidência completa do estado SQL remoto | O erro de vídeo demonstrou divergência entre backend e banco; foi reparado, mas o manifesto local não valida o restante do banco remoto. Inspecionar políticas, grants, funções privilegiadas, constraints, índices e migrações aplicadas. |
| Pendente operacional | Recuperação de senha, backups e restauração | Cadastro sem e-mail não elimina a necessidade de entrega de e-mail para recuperar senha. Verificar entrega com uma conta controlada, URLs permitidas e procedimento de restauração de backup. |
| Pendente operacional | MFA administrativo e separação de ambientes | Suporte no código não prova que MFA seja exigido para cada administrador, que staging esteja separado, que crons estejam ativos ou que as chaves de produção estejam corretamente configuradas. |
| Decisão de produto aceita | Cadastro não comprova titularidade do e-mail | Validação de formato e senha permanecem. Não apresentar `email_confirmed_at` como evidência de posse da caixa de e-mail neste fluxo. |

Os alertas de dependências são achados sobre versões instaladas. Não foi demonstrado um ataque bem-sucedido contra o PingoChef. Limites de corpo, quotas e validação podem reduzir exposição, mas não substituem as correções das bibliotecas.

### Avisos identificados

- `body-parser` (backend, transitivo, alto): [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828), negação de serviço relacionada a corpos comprimidos.
- `zod` (backend direto e frontend transitivo, alto): [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), consumo de memória na validação de coleções. A correção proposta pelo audit do backend exige troca de versão principal; revisar compatibilidade e uso no servidor. A presença transitiva no frontend não prova exploração remota do servidor.
- `ip-address` (backend, transitivo, moderado): [GHSA-rxp7-6hxx-x8q5](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5).
- `qs` (backend, transitivo, moderado): [GHSA-6pq8-jhm2-2vcw](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw).

## Acesso recomendado ao Supabase

A sessão atual acessa o repositório e a API do Supabase pelo backend já configurado; não possui ferramenta SQL administrativa conectada. Não enviar senhas, service-role ou chaves privadas pelo chat.

Conectar o MCP oficial em modo somente leitura, restrito ao projeto correto. Preferir staging com dados anonimizados para testes; para evidência da instalação real, fazer apenas consultas limitadas de metadados. URL:

```text
https://mcp.supabase.com/mcp?project_ref=SEU_PROJECT_REF&read_only=true&features=database,debugging,docs
```

No cliente local: adicionar um servidor Streamable HTTP, autenticar por OAuth no navegador e reiniciar a conexão. Não habilitar escrita para a auditoria. O acesso por MCP poderá exigir uma nova sessão para disponibilizar ferramentas.

Alternativa sem MCP: executar `supabase/audits/prelaunch_security_metadata.sql` no SQL Editor e fornecer os resultados. O script é somente leitura e consulta metadados, não linhas de clientes ou credenciais. Configurações de Auth, Storage, backup e entrega de e-mail precisam de verificação adicional no painel.

Referências: [MCP Supabase e seguranção](https://supabase.com/docs/guides/ai-tools/mcp), [MCP no cliente OpenAI](https://learn.chatgpt.com/docs/extend/mcp).

## Continuidade: piloto com 5 empresas e proteção de custo

Escopo confirmado pelo proprietário: 5 empresas reais, Vercel Hobby atualmente, eventual upgrade e futura adesão ao Mux pago. **Não ativar verificação de e-mail.** Nesta etapa foram feitas somente inspeções; não se alteraram planos, quotas, Auth, objetos Mux ou políticas do banco remoto.

### Supabase: inspeção remota adiada pelo proprietário

O gerenciador confirmou o plugin Supabase instalado, habilitado e com a permissão padrão para ações de baixo risco. O proprietário confirmou que sua conta está autenticada. Mesmo assim, **nenhuma ferramenta Supabase de SQL, inventário ou advisors foi disponibilizada a esta sessão**. Isso impede declarar concluída a inspeção das políticas reais. Reiniciar a aplicação/conexão e retomar em uma nova sessão é necessário se as ferramentas continuarem ausentes. Nenhuma permissão ampla foi solicitada ou alterada.

O proprietário pediu para continuar sem Supabase e deixar essa etapa por último. As verificações adicionais abaixo foram executadas sem depender do acesso SQL remoto; não houve nova tentativa de conexão nem alteração do banco remoto nessa continuação.

RLS é o controle do banco que decide quais linhas cada identidade pode acessar. A empresa A precisa ficar impedida de ler ou alterar dados da empresa B mesmo por chamadas diretas ao Supabase. Ver apenas o botão RLS ativado não basta: é necessário examinar policies, grants, funções privilegiadas e relações entre tabelas. O backend usa service role em operações específicas, que não devem depender de RLS para filtrar a empresa: derivar a identidade da sessão e validar o tenant continua obrigatório.

A inspeção das migrations e os testes PostgreSQL existentes dão evidência do contrato local; não provam que as mesmas policies estejam aplicadas no projeto remoto. A ausência da migração de vídeo já demonstrou por que essa distinção importa.

### Vercel Hobby

- Os 3 crons do `backend/vercel.json` são diários (reconciliação de vídeo, purge de contas e manutenção). A [documentação atual](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing) permite crons diários no Hobby; não permite frequência maior e não garante execução no minuto exato.
- O código protege os endpoints internos por segredo, trabalha com lotes e utiliza leases. Não foram disparados jobs de purge ou reconciliação durante a auditoria. Ainda é preciso conferir no painel se os crons foram implantados e se concluíram com sucesso.
- Remover uma tarefa de manutenção não deve desativar autenticação, quotas ou elegibilidade. Sem manutenção, entretanto, pode haver acúmulo de buffers/contadores e demora na limpeza de mídias órfãs. Para o piloto, a execução diária precisa ser observada ou substituída por uma rotina operacional protegida.
- Há uma questão separada da capacidade técnica: o [Hobby é restrito a uso pessoal não comercial](https://vercel.com/docs/limits/fair-use-guidelines). Um piloto para empresas/atividade comercial deve ser avaliado conforme essa regra, mesmo sem cobrança inicial. Não foi realizado upgrade, compra ou migração de hospedagem.

### Mux: controles presentes e limites reais

Consulta real da reprodução hospedada: token com `aud=v`, validade restante de 120 segundos e `playback_restriction_id` presente. Consulta somente de leitura ao Mux: a restrição retornou o domínio `pingochef-web-drab.vercel.app`, com agentes de alto risco e agentes ausentes desabilitados. A opção de referer ausente não veio explicitamente na resposta; não foi considerada comprovada. Nenhum token ou segredo foi registrado neste relatório.

Controles encontrados no código:

- Upload exige sessão de proprietário, Origin/CSRF, vínculo com empresa e produto, limites do plano e reserva atômica. Plano Free não habilita novos uploads. Limites operacionais de tentativas incluem proprietário, empresa e IP.
- URLs diretas de upload são curtas, com playback signed, idempotência e preservação do vídeo anterior durante a substituição.
- Webhooks têm validação de assinatura sobre bytes raw, deduplicação e conferência do vínculo Mux/mídia. Duração acima de 15 segundos é rejeitada após a inspeção do asset.
- Playback revalida elegibilidade, produto e mídia; quotas compartilhadas cobrem sessão, IP, empresa, mídia e global. Falha no banco não emite token. Existe circuit breaker e kill switch de novas autorizações.
- O frontend solicita playback por ação explícita, conserva a identidade anônima por cookie e não recebe credenciais administrativas do Mux.

**Não são garantias financeiras:**

1. Quotas contam autorizações da API. Um JWT aceito pelo CDN pode ser reutilizado durante sua validade, sem consumir outra quota do backend. Restrição de domínio não equivale a prova de uma pessoa real ou token de uso único. Ver [documentação signed playback](https://www.mux.com/docs/guides/secure-video-playback).
2. Os 50 MB são o tamanho declarado pelo cliente e a validação de UX. No contrato de Direct Upload utilizado, o servidor não impõe um teto customizado de bytes antes da ingestão. Um proprietário malicioso ou comprometido pode mentir sobre o tamanho. Rejeitar e apagar depois não cancela necessariamente custo de processamento já incorrido.
3. A sincronização de Delivery Usage é opcional e atrasada; o próprio código espera dados de dias completos anteriores. Ela não interrompe gastos em tempo real. Não foi encontrado um teto financeiro mensal efetivo de entrega no mecanismo de emissão atual.
4. O kill switch bloqueia novas autorizações de playback; tokens já emitidos precisam expirar. Na implementação atual, ele não desliga o endpoint de upload.

Antes de ativar pay-as-you-go, definir um orçamento de exposição, confirmar os alertas/controles de gasto realmente oferecidos pela conta do provedor, validar a resposta de emergência e revisar o upload de contas comprometidas. Não prometer custo zero sob ataque. Para o piloto, liberar upload somente aos proprietários controlados e acompanhar consumo/erros diariamente, sem alterar os planos comerciais silenciosamente.

### Ordem de liberação do piloto

1. Tratar os avisos de dependências altos já listados e repetir os testes afetados, sem `audit fix --force` indiscriminado.
2. Conferir as rotinas diárias, backups e recuperação de senha com uma conta controlada. Não modificar a decisão de cadastro sem código de e-mail.
3. Validar com identidades de duas empresas controladas que uma não consegue ler/alterar a outra. Não fazer testes destrutivos em dados de clientes.
4. Ao retomar o Supabase, concluir a revisão do banco real (RLS, grants, SECURITY DEFINER, constraints, Storage e advisors), antes de considerar o piloto aprovado em segurança.
5. Iniciar com as 5 empresas observadas e sem ativar cobrança Mux variável antes de resolver os riscos financeiros acima.

Conclusão atual: a arquitetura tem controles relevantes e evidência automatizada positiva, mas **a liberação de segurança do banco remoto permanece pendente**. A revisão do plugin foi uma verificação de instalação/permissão, não uma execução de SQL.

## Verificações adicionais sem Supabase

### Backend e frontend

- As rotas privadas de catálogo, design, recomendações e transferências passam pela sessão do proprietário. Operações com service role precisam manter a empresa derivada da sessão; nas rotas revisadas, atualizações/exclusões incluem esse vínculo e não usam um `businessId` arbitrário recebido do formulário.
- Cookies administrativos têm identidade separada, HttpOnly/Secure/SameSite e checagem de CSRF/Origin. Recuperação de senha usa sessão com escopo próprio; alteração de senha e exclusão da conta não confiam apenas no estado do frontend. Respostas privadas e tokens de playback usam `no-store`.
- O interceptor de sessão limita credenciais e CSRF à API esperada. O PUT direto de vídeo não recebe Authorization, CSRF nem cookies da aplicação. Guards Angular auxiliam a navegação; não são a autoridade de autorização.
- Os sinks HTML revisados recebem SVGs do catálogo fixo de ícones. Não foi identificado nesse recorte um caminho que injete a descrição livre do produto como HTML confiável. Isso não equivale a uma prova universal de ausência de XSS.
- A CSP local bloqueia scripts externos e `eval`, objetos e frames. Estilos inline e imagens HTTPS externas continuam permitidos para suportar personalização; esse é um escopo mais amplo que uma allowlist de fornecedores de imagens.
- O salvamento comprime imagens e limita o payload abaixo do teto da hospedagem. Transferências usam partes limitadas, com revisão antes da aplicação. A importação continua validando estrutura, referências e limites; não baixa URLs arbitrárias no servidor.
- Não existe cobrança pública paga habilitada sem um adaptador de pagamento registrado. O catálogo de planos pode exibir valores, mas isso não comprova um checkout operacional. Para um piloto com recursos pagos, usar o fluxo administrativo já existente de atribuição de plano e conferir os entitlements resultantes.

### Testes operacionais e de navegador

- Testes operacionais: **5 aprovados**. A checagem de manifesto exigia um número fixo antigo de 58 migrações, enquanto a cadeia válida tem 64. Foi corrigida para validar a integridade pelo verificador existente e exigir as migrações essenciais, sem impedir o crescimento normal da cadeia.
- Primeiro lote Playwright: **14 aprovados**, desktop e mobile, cobrindo importação/exportação em partes, carrinho, sugestões, temporizador, dispensa, preview e degradação segura de vídeo.
- Segundo lote: **12 aprovados** para cadastro sem verificação de e-mail, sessão expirada, logout com CSRF, confirmação do servidor em ações de segurança e salvamento de imagens grandes com mudança de cor. Os cenários de upload foram separados para corrigir fixtures desatualizadas: expectativa de sombra da sidebar sem relação com vídeo e resposta de recomendações com formato antigo. O design da aplicação não foi alterado para satisfazer esses testes.
- Upload após a correção das fixtures: **6 aprovados**, desktop e mobile, com resposta normal, atrasada e perdida do PUT. O vídeo fica pronto, pode ser salvo e publicado; uma resposta de upload perdida não provoca exclusão indevida. O teste também verifica que a aplicação não envia suas credenciais para o destino externo de upload. A espera inicial da navegação foi ajustada para tolerar a compilação fria do servidor local. Total desta continuação: **32 testes de navegador aprovados**.

Esses testes de navegador usam respostas de API e upload simuladas. Validam comportamento e integração do frontend com os contratos, não entrega real de e-mail, ingestão Mux, configuração do Vercel ou policies do Supabase hospedado. Os alertas de dependências e as pendências operacionais acima continuam abertos.

## Resultado SQL fornecido pelo proprietário

Foi analisado o arquivo anexado com o resultado da consulta de constraints: **248 regras em 53 tabelas**, sendo 164 CHECKs, 65 chaves estrangeiras e 19 regras UNIQUE. Dessas, 247 estão marcadas como validadas. Essa contagem não inclui chaves primárias, NOT NULL, índices independentes, triggers nem as demais consultas do script.

- As relações compostas de empresa/categoria/produto estão presentes e validadas em `menu_items`, `subcategories`, `product_media`, `product_recommendations`, `anonymous_likes` e `video_upload_attempts`. Elas impedem referências incompatíveis entre empresas para os vínculos cobertos; não substituem autorização por sessão e RLS.
- Estão presentes regras para estados de mídia, publicação somente de mídia pronta, duração de mídia Mux pronta de até 15 segundos, tamanho declarado de upload, idempotência e posições de recomendações de 1 a 3. O tamanho declarado no banco não comprova o tamanho real recebido pelo provedor.
- `plan_entitlements_defined_feature` aparece com `convalidated=false` e `NOT VALID`. A migração `20261002000000_admin_phase3_commercial_ops.sql` já a criou assim. Isso deixa a verificação integral dos dados anteriores pendente; não significa que a chave estrangeira esteja desligada para novas gravações. Não foi demonstrado que existam referências antigas inválidas. Antes de validar, conferir referências sem definição; não apagar nem recriar permissões para resolver isso. Referência: [PostgreSQL — NOT VALID / VALIDATE CONSTRAINT](https://www.postgresql.org/docs/current/sql-altertable.html).
- A listagem não contém o CHECK que vincula `video_security_state.scope` a `business_id`, embora ele exista tanto na migração original quanto na de restauração. Confirmar a ausência diretamente em `pg_constraint` antes de corrigir. É uma divergência de integridade a investigar, não evidência de exploração. `CREATE TABLE IF NOT EXISTS` não adiciona constraints ausentes a uma tabela que já existe.

O anexo **não contém** os resultados de RLS/grants, policies, privilégios de funções ou índices inválidos. Portanto, não autoriza concluir que as tabelas estejam protegidas contra acesso entre empresas, nem que os índices estejam todos válidos. O script `supabase/audits/prelaunch_security_metadata.sql` foi ajustado para retornar um único conjunto com seis seções, incluindo views e todas as operações CRUD para os papéis de navegador, evitando a cópia de apenas um resultado do editor. A consulta continua somente de leitura e sem linhas de clientes ou credenciais.

## Segundo resultado SQL: seis seções completas

O novo JSON fornecido pelo proprietário contém 64 tabelas, 20 policies, 119 funções, 250 constraints e resultados vazios para índices inválidos e views em `public`/`storage`. Ele substitui as pendências de metadados cobertas pela primeira coleta; não foi obtido por uma conexão SQL direta do agente.

### Controles confirmados no resultado

- Todas as 64 tabelas listadas têm RLS habilitado. `rls_forced=false` em algumas tabelas não significa RLS desabilitado: o FORCE trata a aplicação das policies ao proprietário da tabela, não a ativação para visitantes. A service role continua sendo uma autoridade privilegiada que exige proteção no backend.
- Sessões administrativas e de proprietários, intenções de cadastro, transferências, quotas, eventos internos e estado de segurança de vídeo não concedem CRUD aos papéis `anon` e `authenticated`.
- As policies de escrita do catálogo verificam proprietário por `auth.uid()` e conta ativa, com condições de entrada e saída. A policy de `profiles` usa `auth.uid()=id`; a ausência de `WITH CHECK` explícito em uma policy ALL reutiliza a condição USING, não constitui por si só uma falha. Referência: [PostgreSQL CREATE POLICY](https://www.postgresql.org/docs/current/sql-createpolicy.html).
- As RPCs de publicação, atribuição de plano, importação, provisionamento, recomendações e reserva/budget de vídeo não permitem EXECUTE a `anon`/`authenticated`, mas permitem à service role.
- As 119 funções têm um `search_path` configurado. Isso é endurecimento relevante, mas não prova que o corpo de cada função seja correto. Das 27 funções executáveis por algum papel de navegador, três SECURITY DEFINER com parâmetros são os helpers de elegibilidade/conta usados nas policies. Várias funções sem parâmetros são triggers nas migrações locais; não devem ser classificadas automaticamente como RPC administrativa explorável nem receber revogações indiscriminadas. O tipo de retorno, corpo e vínculos dos triggers reais ainda não constam da coleta.
- O CHECK `video_security_state_check` aparece agora presente e validado. A divergência levantada na primeira listagem está resolvida nesta evidência. Também aparece o CHECK do caminho de `image_assets` vinculado à empresa/hash.
- Não foram encontrados índices inválidos/não prontos no schema `public`, nem views/materialized views em `public` e `storage`, conforme o escopo da consulta. Isso não mede desempenho nem cobre índices dos demais schemas.

### Achado: leitura pública de produtos mais ampla que a API

**Prioridade média, confirmada na definição enviada.** A policy pública de SELECT de `menu_items` contém apenas `business_is_publicly_eligible(business_id)`. A tabela concede SELECT ao papel `anon`. Portanto, quando a empresa satisfaz a elegibilidade, a policy não restringe a consulta a `is_available=true`, nem exige categoria ativa. A API pública do backend filtra itens disponíveis e categorias ativas, mas esse filtro não impede uma consulta direta à Data API quando a tabela estiver exposta.

Impacto: leitura de dados de produtos indisponíveis ou pertencentes a categorias ocultas de uma empresa publicada. Não foi demonstrado vazamento de senha, sessão ou credenciais; tampouco foi feita uma extração de linhas de clientes para reproduzir o achado. A exposição por coluna é outro limite: RLS filtra linhas, não mascara colunas. O `show_price=false` é tratado pela interface; uma permissão SELECT sobre a linha inteira não torna o preço secreto.

Correção a preparar: alinhar a leitura pública do banco ao contrato público desejado, preservando a leitura completa do proprietário. Se algum campo precisar ser privado mesmo em um produto público, usar projeção/grants por coluna ou concentrar a leitura pública no BFF; não apenas esconder o campo no frontend. Antes de revogar SELECT globalmente, conferir dependências de policies, joins e clientes existentes. Não foi aplicada alteração de grants/policies no banco nem criada uma migração nesta análise.

### Pontos ainda abertos

- A FK `plan_entitlements_defined_feature` continua `NOT VALID`. Conferir referências anteriores antes de validar; não há evidência aqui de referências inválidas.
- Em `storage.objects` existe somente uma policy RESTRICTIVE excluindo o bucket privado. Sem policy permissiva aplicável, não há acesso normal por RLS para esses papéis. Isso não informa se existem buckets públicos nem comprova a configuração do serviço Storage, seus limites ou suas URLs de entrega. Referência: [PostgreSQL CREATE POLICY — default deny e combinação de policies](https://www.postgresql.org/docs/current/sql-createpolicy.html).
- Verificar definições e ativação dos triggers reais que protegem campos administrativos, capacidade, sessões e publicação, além do corpo das funções de elegibilidade. Metadados de assinatura/grants não comprovam que o corpo remoto corresponda à versão do repositório.
- Continuam necessárias verificações de privilégios por coluna, privilégios padrão, roles customizados, schemas expostos na Data API, configuração Auth/Storage, backups e testes controlados com duas identidades. Os avisos de dependências e limites financeiros de vídeo registrados anteriormente não foram resolvidos por essa coleta.

Decisão atual: os principais bloqueios de acesso às tabelas e RPCs internas estão presentes na evidência real enviada. A parte coberta da auditoria avançou, porém a política pública de produtos precisa de ajuste e os pontos abertos impedem uma certificação geral de segurança.

## Correções: dependências de produção e leitura pública

### Dependências

- Backend: Zod `3.25.76` → `4.6.7`, usando efetivamente a API v4, sem fallback para `zod/v3`. A resposta de validação passa a usar `issues`, mantendo o campo público `error.details`.
- Frontend: Zod transitivo `4.6.5` → `4.6.7`. Um override explícito evita que o pin antigo do Angular CLI mantenha a versão vulnerável; não foi introduzida uma dependência direta de runtime desnecessária.
- Transitividades compatíveis do backend: body-parser `1.20.8` → `1.20.9`, qs `6.16.0` → `6.16.2`, ip-address `10.7.3` → `10.7.6`. O Express continua na mesma versão principal.
- `npm audit --omit=dev`: **zero avisos no backend e zero no frontend** após as alterações. Isso não significa ausência universal de vulnerabilidades. O audit completo ainda aponta avisos de ferramentas de desenvolvimento (incluindo Angular CLI/MCP, Vite/Undici/Vitest); eles não foram ocultados nem tratados com atualizações indiscriminadas fora deste escopo.

### Banco e resposta pública

- Nova migração `20261108173908_restrict_public_menu_item_reads.sql`, criada pelo CLI e registrada no manifesto. Ela exige produto disponível, empresa publicamente elegível e categoria ativa da mesma empresa na policy pública de `menu_items`.
- As policies de gerenciamento de itens e categorias passam a aplicar-se explicitamente a `authenticated`. As condições de propriedade permanecem: o dono continua vendo e editando seus itens ocultos/indisponíveis. Isso também evita que uma consulta anônima precise avaliar helpers privados das policies de proprietário nas instalações que restringem EXECUTE desses helpers.
- O BFF usa service role para ler o catálogo e, portanto, também filtra produtos e subcategorias sem categoria pública ativa antes de montar a resposta. Nenhuma linha é apagada, nenhum template/personalização é alterado e a configuração de cadastro sem código de e-mail permanece intacta.

### Validação e ativação

- Backend: 36 suítes aprovadas, 406 testes aprovados, 2 testes opcionais ignorados. Regressões focadas confirmam detalhes estruturados de validação, requisição gzip malformada com bytes adicionais sem derrubar o processo e ocultação de categorias na API pública.
- Frontend: 28 arquivos / 168 testes aprovados; build aprovado. Backend: build aprovado.
- Navegador após as atualizações: 4 cenários aprovados, desktop e mobile, cobrindo cadastro sem código de e-mail e importação/exportação de arquivo grande com revisão, confirmação e backup, usando APIs simuladas.
- PostgreSQL temporário: cadeia completa de 65 migrações e suítes de segurança aprovadas, incluindo teste real com `anon` e duas identidades autenticadas para visibilidade pública, acesso completo do dono e isolamento de escrita entre empresas.
- Scanner de fontes: 484 arquivos aprovados. Scanner do build: 39 arquivos aprovados, 12 valores privados conhecidos conferidos sem divulgação. Verificações operacionais: 5 aprovadas.
- Existem avisos prévios de orçamento de CSS nos builds; não houve redesenho ou aumento desses estilos neste trabalho.

**Pendente na instalação hospedada:** executar a nova migração no projeto Supabase correto e publicar backend/frontend com os lockfiles atualizados. A sessão não dispõe de ferramenta SQL administrativa do Supabase, portanto não foi aplicada nem declarada aplicada uma mudança remota. Depois da aplicação, conferir a policy na auditoria de metadados. A migração é transacional e não exige desativar RLS ou disponibilizar service role no frontend.
