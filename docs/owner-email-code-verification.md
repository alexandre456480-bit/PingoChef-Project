# Cadastro sem envio de e-mail

O cadastro funciona sem domínio próprio, SMTP ou código. A identidade é autenticada por **e-mail e senha**; isso não comprova a titularidade da caixa de e-mail. Não usamos perguntas pessoais, verificação de DNS ou confirmação visual como substitutos dessa prova.

## Fluxo atual

1. O servidor valida os campos, normaliza o e-mail, aplica quotas persistentes por e-mail/IP e valida a escolha do plano Free, os termos e o convite opcional.
2. A identidade é criada somente pelo backend, com `email_confirm: true` para permitir autenticação por senha no Supabase, sem disparar e-mail. Essa marca de compatibilidade do provedor **não é uma prova de posse do endereço**. Chaves administrativas permanecem no servidor.
3. O vínculo da intenção e o provisionamento transacional continuam existentes. A resposta genérica `202 REGISTRATION_ACCEPTED` também cobre endereços já cadastrados, sem substituir suas senhas ou tomar suas contas.
4. O navegador segue para o login. Senhas são limpas do formulário e não vão no estado da navegação. Cadastrar não cria nem substitui uma sessão do navegador; entrar exige a senha.

Origin obrigatório, validação estrita, senha de 8 a 128 caracteres e política do provedor, quotas, cookies HttpOnly e proteção CSRF das operações autenticadas foram preservados. A confirmação de senha do formulário evita erros de digitação. O layout laranja responsivo permanece.

`/verify-email` redireciona ao login; os endpoints de código foram removidos. Recuperação de senha conserva o fluxo separado e continua dependendo da entrega de e-mail pelo provedor. Não existe recuperação por simples declaração de endereço.

## Banco e publicação

Aplicar as migrações pendentes em ordem, incluindo `supabase/migrations/20261107010000_owner_registration_without_email_delivery.sql`, **antes** de executar o backend atualizado. Não editar ou reaplicar migrations antigas já executadas. A migração anterior de códigos permanece na cadeia para manter o histórico consistente.

A nova migração desliga explicitamente a exigência de código e define as futuras intenções sem essa exigência. Libera no provedor somente identidades ligadas a cadastros legítimos interrompidos pela exigência anterior, excluindo administradores. Não altera senhas, tokens de recuperação, assinaturas ou conteúdo. Não preenche `verified_at` nem fabrica evidência de verificação.

As tabelas históricas de desafios continuam privadas, e as RPCs aposentadas perdem inclusive a permissão de execução de serviço. Os demais controles de provisionamento e sessão permanecem.

Não é necessário alterar o SMTP para cadastrar usuários. Publicar frontend/backend juntos e reiniciar o backend local após aplicar o banco. Testes usam PostgreSQL temporário e autenticação simulada, sem envio real ou alteração de configuração remota.

Referência oficial: [criação administrativa no Supabase](https://supabase.com/docs/reference/javascript/auth-admin-createuser).
