# Planos e publicação

| Plano | Preço mensal apresentado | Vídeos | Templates publicados |
|---|---:|---:|---|
| Free | Gratuito | 0 | Simples |
| Basic | R$ 34,90 | 5 | Todos |
| Medium | R$ 49,90 | 15 | Todos |
| Pro | R$ 84,90 | 30 | Todos |

Os limites de produtos, categorias, analytics e QR permanecem iguais. Os preços apresentados vêm do catálogo da API em `owner-commercial.controller.ts`. A contratação online continua indisponível; os planos pagos oferecem contato com o atendimento, sem criar checkout ou assinatura fictícia.

Aplicar `20261104020000_update_plan_permissions.sql` antes de disponibilizar a API e o frontend atualizados. A migração atualiza as permissões existentes e adiciona `THEMATIC_TEMPLATES`. Reservas de vídeo continuam usando a capacidade transacional do banco. Nenhum vídeo ou personalização existente é apagado ao mudar de plano; o limite impede novos uploads e substituições quando não há capacidade.

O Free pode selecionar, personalizar, salvar, importar e pré-visualizar temas. A publicação exige Basic ou superior e apresenta um aviso com acesso aos planos. A RPC de publicação valida a empresa e a permissão sob o bloqueio de capacidade existente. A API pública também verifica a permissão: salvar ou importar um tema em um Free já publicado não contorna a restrição. Nesse caso, a apresentação pública usa o template Padrão, preservando a seleção para o preview e as cores, fontes, imagens e conteúdo do cliente. Imersão e Vidro Líquido são simples.

A página de planos usa quatro identidades neon e ícones vetoriais com volume, sem bibliotecas ou canvas. Selecionar um card ou usar “Explorar os recursos” destaca o plano e abre detalhes, com foco no título e retorno ao botão ao fechar. O Medium apresenta uma ilustração flutuante de QR; o Pro destaca Analytics e exportação CSV. Explorar não inicia cadastro nem contratação. Em telas sem hover as partículas e a ilustração são estáticas; movimento reduzido desativa as animações.

Verificação: `npm run test:database` no backend (PostgreSQL temporário, cadeia completa), testes de API e projeção pública, teste unitário de publicação, builds e Playwright `plan-permissions.spec.ts` e a comparação de planos em `owner-phase2.spec.ts`.
