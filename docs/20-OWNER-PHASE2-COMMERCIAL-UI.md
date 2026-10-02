# PingoChef — Fase 2: jornada comercial e painel do proprietário

Implementação local em 02/10/2026, sobre a fundação da [Fase 1](./19-OWNER-PHASE1-FOUNDATION.md). Esta entrega não habilita cobrança nem implementa Analytics ou QR Code reais.

## 1. Design e integração

Antes de criar as telas, foram examinados a skill de design, o novo `PingoChef_Design_System_Skill.md`, o shell do Dashboard, sidebar, topbar, login, cadastro, checklist de primeiros passos e os serviços de autenticação, conteúdo e design.

A implementação utiliza a identidade PingoChef: ameixa escura, vinho, laranja e creme; fontes Outfit e Inter; cards arredondados; profundidade controlada; contraste e bordas nos elementos clicáveis. A sidebar permanece escura nos dois temas. O cardápio público continua seguindo sua personalização própria.

O onboarding existente foi integrado. Não há um segundo cadastro de empresa/categorias/produtos nem um segundo editor. O checklist acompanha categorias e produtos por sinais e recebe do backend os marcos de design e o estado de publicação. A quantidade de produtos deixou de representar, por si só, que o cardápio foi publicado.

## 2. Jornada pública

```mermaid
flowchart LR
  A[Escolher plano] --> B[Intenção Free criada no backend]
  B --> C[Conta e aceite dos textos preliminares]
  C --> D[Confirmação de e-mail]
  D --> E[Login com senha]
  E --> F[Primeiros passos no Dashboard existente]
  F --> G[Empresa, logo, categoria, produto, design e publicação]
```

O link de confirmação valida o OTP no backend e direciona para `/confirm-email`. Ele não autentica automaticamente o navegador. Após entrar, contas confirmadas seguem ao Dashboard; um provisionamento interrompido segue para `/complete-registration`.

### Rotas

| Rota | Função |
|---|---|
| `/` | Planos; preserva o login Admin no hostname administrativo |
| `/plans` | Comparação dos quatro planos |
| `/register?intent=<uuid>` | Cadastro vinculado a uma intenção criada pelo backend |
| `/register` sem intenção | Retorna à escolha de plano |
| `/confirm-email` | Enviado, reenviado, confirmado, pendente e link expirado/usado |
| `/login` | Verifica `/auth/me` antes de apresentar o formulário |
| `/forgot-password`, `/reset-password` | Recuperação da Fase 1 |
| `/complete-registration` | Recuperação de cadastro confirmado incompleto |
| `/dashboard` | Sessão e elegibilidade validadas antes de renderizar o painel |
| `/terms`, `/privacy` | Textos preliminares desta etapa; links reais e sem âncoras vazias |

Dashboard, cadastro, cardápio público e demais páginas são carregados sob demanda. O build observado passou de aproximadamente 1,03 MB na primeira compilação desta fase para 456,61 kB de carga inicial, sem aumentar os budgets.

## 3. Planos

| Plano | Produtos | Categorias | Vídeos | Recursos apresentados | Preço provisório |
|---|---:|---:|---:|---|---:|
| Free | 10 | 4 | 1 | Editor e publicação | R$ 0,00 |
| Basic | 30 | 10 | 7 | Analytics essencial | R$ 29,90/mês |
| Medium | 70 | 25 | 25 | Analytics avançado e QR personalizado | R$ 59,90/mês |
| Pro | 150 | 40 | 40 | Analytics completo e QR premium | R$ 99,90/mês |

Os preços são somente apresentação no catálogo comercial do backend. Não são valores de cobrança, direitos de assinatura nem autorização. Não há gateway, checkout ou contrato de pagamento implementado. Somente Free possui CTA de cadastro; os demais exibem **Em breve**. Medium recebe destaque **Mais recomendado**, sem ocultar Free, escassez fictícia, preço riscado ou contagem regressiva.

O catálogo público é uma configuração de apresentação. A capacidade operacional continua sendo obtida de `plan_entitlements` e aplicada no PostgreSQL. Alterações futuras no catálogo precisam manter a comparação consistente com o catálogo de planos implantado.

As concessões administrativas auditadas da Fase 1 continuam funcionando. Uma conta Basic, Medium ou Pro concedida pelo Admin é reconhecida por `/auth/me`; a interface pública não pode conceder esses planos.

## 4. Intenção de cadastro

`owner_plan_intents` registra uma escolha Free sem e-mail, senha ou outros dados pessoais. Seu UUID aleatório referencia a escolha; não é uma sessão nem um token de acesso à conta.

- Criada pelo backend, expira após 30 minutos.
- Somente `service_role` possui acesso; RLS e privilégios impedem acesso pelo navegador/Supabase público.
- A leitura revela somente plano, identificador e validade.
- O cadastro valida o plano e o prazo, exige `termsAccepted: true` quando recebe `intentId` e consome a escolha com atualização condicional.
- Duas tentativas concorrentes não podem consumir a mesma escolha.
- A intenção original de provisionamento da Fase 1 continua responsável pela identidade, confirmação e criação da empresa.
- A ligação entre as duas intenções, versão dos textos e horário de aceite ficam em `registration_intents`.
- Escolhas expiradas há mais de sete dias são removidas pelo `/internal/auth/maintain`; o registro de aceite permanece na intenção de cadastro.

O contrato de cadastro da Fase 1 sem `intentId` continua aceito para compatibilidade, sempre limitado a Free e sujeito aos controles anteriores. Ele não libera plano pago. O frontend novo utiliza exclusivamente a intenção comercial.

## 5. Contratos adicionais

Todos os endpoints abaixo estão sob `/api/v1/auth`. O backend valida objetos estritos e mantém respostas sem cache.

| Método | Endpoint | Contrato |
|---|---|---|
| GET | `/plans` | Catálogo, `pricesProvisional: true`, `billingAvailable: false` |
| POST | `/plan-intents` | `{ planCode }`; Origin permitido; limitação por IP; pagos retornam 409 |
| GET | `/plan-intents/:id` | Escolha válida; consumida/expirada/inexistente retorna 410 |
| POST | `/register` | Campos da Fase 1 mais `intentId` e `termsAccepted: true` |
| GET | `/me` | Acrescenta nome do perfil, dados completos da empresa, publicação e marco de design |
| POST | `/change-password` | `{ currentPassword, password }`; sessão, Origin, CSRF e senha atual |
| POST | `/delete-account` | `{ currentPassword, confirmBusinessId, confirmation: 'EXCLUIR' }` |

`/me` continua sendo a fonte de identidade, situação da conta, plano, assinatura, permissões, contagens e CSRF. O login mantém o estado inicial de verificação e não renderiza o Dashboard antes da resposta do guard. Expiração durante operações do painel direciona ao login com mensagem amigável.

## 6. Navegação, configurações e uso

A sidebar apresenta **Início, Menu, Empresa, Design, Analytics e QR Code**, além de Sair e da engrenagem. Preview e Likes deixaram a navegação visível; seus componentes e recursos não foram removidos. O preview do telefone, publicação e acesso pelo checklist continuam disponíveis.

Configurações utiliza diálogo central no desktop, tela inteira no mobile e navegação interna horizontal nas telas pequenas:

- **Conta:** nome, e-mail, verificação e estabelecimento.
- **Plano e uso:** plano atual, produtos/categorias/vídeos, limites e recursos concedidos.
- **Segurança:** troca de senha e saída de todos os dispositivos.
- **Suporte:** `pingochef@gmail.com`.
- **Gerenciar conta:** sair e solicitar exclusão.

O diálogo prende o foco, oferece Escape e fechamento explícito e torna o painel ao fundo inerte. A sidebar fechada no mobile deixa de receber foco. As telas seguem `prefers-reduced-motion`.

As barras utilizam contagens e limites do backend. Alertas aparecem a partir de 80% e no limite. O conteúdo excedente após downgrade continua acessível para edição. A criação recebe bloqueio preventivo na UI, e o banco revalida de forma independente. Erros de capacidade orientam a comparar planos, incluindo vídeos.

Após mutações em conteúdo, mídia, design ou empresa, a sessão/uso é atualizada com agrupamento de 250 ms para evitar requisições duplicadas próximas. Abrir configurações também atualiza o snapshot. Alterações administrativas externas são reconhecidas em uma nova leitura do snapshot; não há push em tempo real nesta fase.

Não existe um endpoint de listagem de dispositivos na API anterior; por isso a interface não inventa uma lista de sessões ativas.

## 7. Feature gates e demonstrações

Analytics utiliza `ANALYTICS_BASIC` ou `ANALYTICS_ADVANCED`; QR utiliza `QR_GENERATOR`. As decisões não usam comparações com o nome do plano.

| Plano padrão | Analytics | QR Code |
|---|---|---|
| Free | Bloqueado | Bloqueado |
| Basic | Incluído | Bloqueado |
| Medium | Incluído | Incluído |
| Pro | Incluído | Incluído |

Um clique em recurso bloqueado abre sua apresentação, sem redirecionar automaticamente a planos. O gráfico, métricas e QR são explicitamente ilustrativos. A animação dura 2,4 segundos, usa transform/opacity, ocorre uma vez por recurso durante a sessão da aplicação e é removida com movimento reduzido.

Os textos e CTA seguem o pedido: Analytics explica a interação dos clientes e indica Basic; QR apresenta distribuição do cardápio e indica Medium. Ambos oferecem **Comparar planos**. Contas com permissão veem que a ferramenta real está em preparação. Não existem consultas de Analytics, QR utilizável, exportação ou geração de materiais nesta entrega.

Alterar a UI com DevTools pode alterar sua aparência, mas não concede assinatura, capacidade no banco ou acesso a ferramentas futuras. As rotas reais dessas ferramentas, quando implementadas, deverão chamar a verificação de permissões da Fase 1.

## 8. Senha e exclusão

A troca de senha valida a senha atual com um cliente Auth isolado, utiliza a quota de tentativas, altera a senha e revoga todas as sessões BFF. O usuário volta ao login. Senhas e tokens não são gravados no armazenamento do navegador.

Excluir exige senha atual, identificador exato da própria empresa e confirmação textual. O ator é derivado da sessão. A função SQL `owner_schedule_account_deletion`:

1. Confere a empresa pertencente ao usuário autenticado.
2. Bloqueia a linha de ciclo de vida e confere a transição.
3. Define `PENDING_DELETION`, prazo de 30 dias e publicação falsa.
4. Registra `owner_account_audit`, sem atribuir identidade administrativa ao dono.
5. Revoga as sessões e registra o corte de revogação na mesma transação.

A limpeza definitiva continua no worker existente: inventário de Storage, exclusão/cancelamento Mux com checkpoints e retries, limpeza de banco e exclusão da identidade Auth. Falhas do provedor não são tratadas como exclusão concluída. O cancelamento durante retenção segue pelo suporte/Admin existente.

## 9. Validação e implantação

Comandos utilizados:

```text
backend: npm run build
backend: npm test -- --runInBand --silent
backend: npm run test:database
frontend: npx tsc --noEmit -p tsconfig.app.json
frontend: npm test -- --watch=false
frontend: npm run build
frontend: npm run security:scan
frontend: npm run e2e -- owner-phase2.spec.ts
```

Os testes de API cobrem catálogo, rejeição de planos pagos/payloads forjados, intenção/aceite, CSRF, senha atual, revogação global e confirmação de exclusão. O PostgreSQL local verifica a cadeia completa de migrações, concorrência, privilégios, quotas exatas dos quatro planos e exclusão atômica. O navegador utiliza respostas HTTP controladas para validar UI e navegação; ele não substitui o teste de banco nem realiza operações em produção.

Resultados finais: **112 testes de backend**, **37 testes unitários de frontend**, **24 verificações em PostgreSQL 16** e **22 testes de navegador** aprovados. Build e typecheck aprovados; scanner de segredos aprovado em 18 arquivos do bundle. Um teste de integração remota permanece desabilitado por exigir configuração explícita de ambiente descartável; os testes SQL locais não dependem dessa configuração.

As verificações responsivas abrangem 1600, 1280, 900 e 390 pixels, temas claro/escuro, cards, sidebar, configurações, formulários e movimento reduzido. As capturas locais estão em `.tools/phase2-*`, fora dos arquivos de aplicação.

### Implantação

- Aplicar primeiro as migrações da Fase 1 e depois `20261003020000_owner_commercial_journey.sql`, após o preflight e backup previstos na fundação.
- Manter a chave de criptografia, allowlists, callbacks e confirmação de e-mail da Fase 1 configurados.
- O callback continua no backend; seu destino público passa a ser `/confirm-email`.
- Manter o agendamento interno de manutenção e purge, `INTERNAL_JOBS_SECRET`, `PURGE_STORAGE_BUCKET` e credenciais Mux/Storage do processo existente.
- Backend e frontend precisam ser implantados de forma compatível com os novos contratos.
- Revisar os textos preliminares de uso e privacidade antes do lançamento comercial e publicar a versão correspondente ao aceite registrado.

Nenhuma migração remota, cobrança, exclusão real ou publicação de deploy foi executada nesta fase. Permanecem os avisos anteriores de orçamento de CSS do editor de design e do cardápio público; o budget inicial voltou a ficar abaixo do limite de aviso.

## 10. Arquivos principais

Backend: `owner-commercial.controller.ts`, `owner-auth.controller.ts`, `auth.routes.ts` e a nova migração comercial.

Frontend: `commercial.service.ts`, páginas `plans`, `selected-register`, `confirm-email`, textos preliminares; componentes `settings`, `plan-usage`, `feature-preview` e diretiva de foco; integração em rotas, login, guard, Dashboard, sidebar, checklist, editor de menu, uploader e tema do painel.

Testes: `owner-phase1-auth.test.ts` com novos cenários comerciais, `verify-owner-database.mjs` com verificações adicionais e `e2e/owner-phase2.spec.ts`.

**Limite de escopo:** a próxima fase pode implementar ferramentas reais de Analytics e QR Code. Esta fase termina na jornada comercial, configurações, apresentação de uso e controle de permissões.
