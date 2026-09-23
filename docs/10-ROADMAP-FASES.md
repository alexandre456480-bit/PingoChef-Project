# 🚀 10 — Roadmap e Fases de Execução

> **Domínio**: Cronograma de implementação, divisão em fases, entregáveis, Definition of Done (DoD), gestão de riscos e checklist de go-live.  
> **Depende de**: [01-ARQUITETURA-GERAL.md](./01-ARQUITETURA-GERAL.md) até [09-API-CONTRATOS.md](./09-API-CONTRATOS.md).  
> **Referenciado por**: Todo o time de produto e desenvolvimento.

---

## 1. Estratégia Geral de Lançamento

O desenvolvimento do **SaaS Cardápio Digital Autônomo** é dividido em 3 fases estratégicas com foco na validação contínua do modelo de assinatura e estabilidade técnica da experiência do cliente final:

```
┌────────────────────────────────────────────────────────┐
│  FASE 1: MVP Core Autônomo                             │
│  (Auth, Cadastro, Token, Painel, Cardápio & Public Web) │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│  FASE 2: Design System & UX Polishing                  │
│  (Templates, Customização, Previews, PWA & Storage)    │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│  FASE 3: Escala, Monetização Automática & Telemetria   │
│  (Gateway Pagamentos, Multi-tenant Pro, Analytics)     │
└────────────────────────────────────────────────────────┘
```

---

## 2. Detalhamento das Fases

### 📍 FASE 1: Core Autônomo (MVP Funcional) ✅ Concluída
**Objetivo**: Permitir que um restaurante se cadastre, ative sua conta com um token, cadastre produtos e exiba um cardápio público acessível por URL pública.

* **Sprints/Blocos**:
  1. **Configuração da Infraestrutura & Banco de Dados**: ✅
     - Esquemas de banco `profiles`, `businesses`, `categories`, `menu_items`, `activation_tokens` e `design_settings`.
     - Backend BFF configurado com TypeScript, Zod e rotas de segurança.
     - Frontend Angular configurado com rotas, signals, guards e layout responsivo.
  2. **Módulo de Autenticação & Ativação**: ✅
     - Fluxo de cadastro com geração autônoma do token `ACT-XXXX-XXX`.
     - Tela de ativação no Angular e validação via API BFF.
     - Login seguro e renovação de sessão local.
  3. **Módulo do Painel do Gestor (CRUD Cardápio)**: ✅
     - Cadastro e ordenação de categorias simplificado (Nome + Catálogo de Ícones 2D/3D).
     - Cadastro, edição, exclusão e pausa de itens com preços e promoções.
  4. **Módulo Público de Exibição (Cardápio do Cliente)**: ✅
     - Rota dinâmica pública `/m/:slug` (com alias `/c/:slug`).
     - Welcome Screen de alta conversão com animação cinematográfica de entrada.
     - Vitrine com promoções, mais curtidos, categorias navegáveis e catálogo geral.
     - Funcionalidade de Curtir/Like em tempo real com debounce e persistência local.

---

### 📍 FASE 2: Design System, Templates & Refinamento de UX ✅ Em Andamento / Avançada
**Objetivo**: Permitir a personalização estética completa do cardápio digital (temas, cores, fontes) e otimização para dispositivos móveis.

* **Sprints/Blocos**:
  1. **Motor de Templates e Design System**: ✅
     - Implementação dos templates visuais (*Modern*, *Minimal*, *Premium*, *Dark*).
     - Seletor dinâmico de paletas de cores e pares tipográficos Google Fonts (`Outfit`, `Inter`).
  2. **Preview em Tempo Real no Painel do Gestor**: ✅
     - Mockup interativo de Smartphone no Angular executando **exatamente o mesmo componente** (`PublicMenuViewComponent`) do cliente final.
     - Sincronização instantânea com as categorias, produtos e configurações de design.
  3. **Catálogo Curado de Ícones 2D e 3D**: ✅
     - Dezenas de ícones organizados por grupos culinários nas abas 2D e 3D.
     - Busca inteligente por nome e tags.
     - Opção de imagem personalizada ou desativação de ícone (somente nome).
  4. **Welcome Screen Cinematográfica & Vitrine Modular**: ✅
     - Botão Claymorphic "Ver o Cardápio" com shimmer sweep e animação *Portal Reveal*.
     - Blocos de Promoções e Mais Curtidos com contadores dinâmicos.

---

### 📍 FASE 3: Automação Financeira, Escala & Auditoria
**Objetivo**: Integrar cobrança recorrente automática (SaaS), métricas de acesso para o gestor e relatórios de segurança.

* **Sprints/Blocos**:
  1. **Gateway de Pagamento Recorrente (Asaas / Mercado Pago / Stripe)**:
     - Webhook de renovação automática de assinatura.
     - Bloqueio automático do painel e redirecionamento para página de renovação se a assinatura expirar.
  2. **Painel Analytics & Telemetria do Gestor**:
     - Dashboard com contagem de visualizações diárias no cardápio público.
     - Produtos mais curtidos e categorias mais visitadas.
  3. **Segurança Avançada & Auditoria**:
     - Audit Log de ações administrativas no painel.
     - Testes automatizados de Carga (k6) no endpoint público do catálogo.
     - Pipeline CI/CD automatizado no GitHub Actions com verificações de linting e segurança.

---

## 3. Definition of Done (DoD) — Critérios de Aceite por Tarefa

Para qualquer tarefa ser considerada **CONCLUÍDA**, os seguintes 6 pilares devem ser atendidos:

1. **Código & Arquitetura**:
   - Código escrito em TypeScript strict mode sem o uso de `any`.
   - Componentes Angular seguindo arquitetura standalone e Signals.
   - API BFF Node.js com DTOs validados via Zod.
2. **Segurança & RLS**:
   - Nenhuma query ao Supabase consulta dados sem filtro explícito de `business_id` (enforcado por RLS ou middleware).
   - Endpoints autenticados recusam requisições sem JWT válido.
3. **UX & Design**:
   - Layout 100% responsivo (testado nas resoluções 360px, 768px, 1024px e 1440px).
   - Feedback visual imediato para ações do usuário (Spinners, Skeletons, Toasts de erro/sucesso).
4. **Performance**:
   - Carregamento do catálogo público em menos de 1.5s na 3G rápida.
   - Imagens otimizadas automaticamente em formato WebP.
5. **Erros & Resiliência**:
   - Todos os erros tratadas via Envelope Padrão de Erro RFC 7807 sem expor stack trace.
6. **Documentação**:
   - Caso haja nova rota ou alteração de modelo de dados, os arquivos [08-BANCO-DADOS-RLS.md](./08-BANCO-DADOS-RLS.md) ou [09-API-CONTRATOS.md](./09-API-CONTRATOS.md) foram atualizados.

---

## 4. Matriz de Riscos e Planos de Mitigação

| Risco Identificado | Impacto | Probabilidade | Mitigação Técnica / Estratégica |
|---|---|---|---|
| **Vazamento de dados entre estabelecimentos (Multi-tenant)** | CRÍTICO | Baixa | Habilitação estrita de RLS no PostgreSQL do Supabase + Testes unitários focados na isolação de `business_id`. |
| **Lentidão no carregamento do cardápio público em horários de pico** | ALTO | Média | Utilização de CDN Edge Caching para arquivos estáticos + Invalidation Cache inteligente na atualização do cardápio. |
| **Upload de imagens maliciosas ou gigabytes de fotos no Storage** | ALTO | Média | Validação de extensão/MIME type no Backend (somente JPEG/PNG/WEBP) + limite estrito de 5MB por imagem. |
| **Tentativas de força bruta em tokens de ativação (`ACT-XXXX`)** | MÉDIO | Média | Rate limiting por IP no endpoint de ativação (5 tentativas/minuto) + invalidação do token após 10 tentativas incorretas. |
| **Navegador antigo do cliente final não renderizar o cardápio** | MÉDIO | Baixa | Utilização de Polyfills modernos no Angular + Fallbacks CSS Vanilla standard para CSS Grid e Flexbox. |

---

## 5. Checklist de Go-Live (Produção)

- [ ] **Variáveis de Ambiente**: Confirmar que todas as chaves de API (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`) estão configuradas de forma segura no ambiente de produção.
- [ ] **Banco de Dados**: Migrations de schema e políticas RLS executadas e testadas em ambiente de Staging.
- [ ] **SSL / TLS**: Certificados HTTPS ativos no domínio principal e subdomínios.
- [ ] **CORS**: Permitir apenas origens autorizadas no Backend Node.js.
- [ ] **Politica de Privacidade & Termos**: Páginas legais expostas no rodapé do cadastro.
- [ ] **Monitoramento**: Captura de exceções e erros de runtime ativa via Sentry no Frontend e Backend.
