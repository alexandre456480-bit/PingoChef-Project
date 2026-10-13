# Cadastro do proprietário sem confirmação de e-mail

Este fluxo substitui a confirmação de cadastro descrita na fase 1. O e-mail
continua sendo o identificador de login e o destino da recuperação de senha.

## Comportamento

- O cadastro valida os dados, a escolha Free e o aceite dos termos no servidor.
- A identidade é criada por `supabaseAdmin.auth.admin.createUser`, somente no
  backend, com `email_confirm: true`. Não usa `signUp` nem envia confirmação.
  O indicador interno do provedor libera o login por senha; não comprova a
  propriedade da caixa de entrada e não é exibido como “E-mail verificado”.
- A identidade é vinculada à intenção legítima, que passa a `READY`. Perfil,
  estabelecimento e assinatura Free são provisionados imediatamente em transação.
- O cadastro retorna `202 REGISTRATION_ACCEPTED`, inclusive para e-mails existentes,
  sem substituir contas, alterar senhas existentes ou iniciar uma sessão no navegador.
  O frontend abre o login com o e-mail preenchido. O acesso exige a senha.
- Falhas na criação da identidade liberam a seleção para nova tentativa. Uma
  identidade já criada é preservada; falhas de provisionamento podem ser retomadas
  após o login pela tela de conclusão do cadastro.
- Reenvio de confirmação foi removido. Links antigos apenas redirecionam ao login,
  sem verificar OTP, provisionar uma conta ou criar uma sessão.

O cadastro conserva validação de senha, quotas por e-mail/IP, Origin, separação
de administradores, RLS, isolamento de estabelecimentos, cookies HttpOnly,
CSRF, expiração e revogação de sessões. Plano pago continua bloqueado no cadastro.

## Banco e implantação

1. Aplique `20261012000000_repair_free_registration.sql`, caso esteja pendente.
2. Aplique `20261012010000_remove_owner_email_verification.sql` antes do backend.
3. Aplique `20261012020000_repair_business_subscription_trigger.sql`.
4. Publique backend e frontend atualizados. No localhost, use `npm run dev` para
   recarregar o backend ao editar; um processo `node dist/server.js` já iniciado
   continua com a versão antiga até ser reiniciado.

Se o cadastro ou login falhar com `PROVISIONING_UNAVAILABLE` e o banco retornar
`record "old" has no field "business_id"`, a terceira migration restaura o
gatilho de consistência da assinatura. Usa acesso seguro aos campos dos registros
das duas tabelas e conserva a exigência de assinatura para cada estabelecimento.
Não recria contas, altera senhas ou desativa triggers. Para conferir a definição
instalada, use a consulta somente de leitura
`supabase/preflight/20261012_registration_trigger_audit.sql`.

A segunda migration converte intenções `AWAITING_EMAIL` em `READY`, atualiza
índices e funções relacionadas e remove a exigência de confirmação das sessões
e do provisionamento. Libera o indicador de login do provedor somente para
proprietários existentes ou identidades associadas a cadastros legítimos.
Administradores e identidades alheias a esses fluxos não são alterados. Senhas,
conteúdo, sessões e tokens de recuperação existentes são preservados. A migration
pode ser reaplicada; permissões das funções continuam exclusivas de `service_role`.

Se um banco parcialmente atualizado contiver rascunhos ativos duplicados por
e-mail, a migration mantém o cadastro vinculado à identidade e expira somente
os rascunhos excedentes sem identidade. Entre rascunhos sem vínculo, prioriza
o aceite dos termos e depois o mais recente. O histórico permanece no banco.
Conflitos entre registros vinculados interrompem a transação para revisão,
sem escolher arbitrariamente uma conta. Em caso de erro `23505` ao criar
`registration_intents_email_pending_idx`, execute novamente o arquivo completo
atualizado; não remova o índice de proteção nem apague usuários.

Não é necessário desativar globalmente as confirmações no painel Auth: a criação
de contas pelo backend usa a [API administrativa oficial](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
e mantém a configuração dos outros usos do mesmo projeto Supabase.

## Recuperação de senha

Configure `OWNER_RECOVERY_CALLBACK_URL` como
`https://<origem-do-frontend>/api/v1/auth/recover`, com a URL permitida no Supabase.
Por compatibilidade, a variável antiga `OWNER_AUTH_CALLBACK_URL` ainda é aceita:
o backend troca apenas o sufixo `confirm-email` por `recover`. Não exponha as chaves
administrativas no frontend.

Preserve o template de recuperação com `{{ .TokenHash }}` no callback `/recover`.
`forgot-password`, OTP do tipo `recovery`, sessão restrita de 15 minutos, CSRF,
troca de senha e revogação das sessões permanecem ativos. Cadastro não depende
de SMTP nem do callback; somente a recuperação de senha precisa enviar e-mail.
