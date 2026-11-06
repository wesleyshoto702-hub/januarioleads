# JanuarioLeads — Roadmap para SaaS comercial

**Data:** 06/11/2026  
**Fase atual:** produto funcional para contas autorizadas, sem cadastro comercial aberto nem assinatura automatizada.

## Objetivo

Transformar o workspace existente de prospecção em um SaaS multicliente, com aquisição, ativação, assinatura, retenção e suporte. A ferramenta já possui busca por cidade/nicho via Google Places, CRM, mensagens (encaminhamento manual ao WhatsApp), acompanhamento de oportunidades, tarefas e financeiro **do CRM**. O financeiro atual não representa faturamento/assinaturas do SaaS.

## Entrega 1 — Apresentação pública (esta PR)

- Criar rota pública `/produto` (não requer autenticação), com benefícios reais, funcionamento, comunicação de acesso por convite e links para `/login`.
- Identificar a prévia de interface como **ilustrativa** e explicitar que o WhatsApp continua com envio manual. Não divulgar preços ou trial inexistentes.
- Disponibilizar link da tela de login à página pública.
- Manter `/` como workspace privado nesta fase, preservando clientes existentes. Uma migração posterior pode colocar a página pública em `/` e o app em `/app`, com redirects e regressões testadas.
- Não escrever dados de clientes ou chamar Supabase para exibir a página.

**Critério:** CI com teste de navegação pública, desktop/mobile, login existente intacto.

## Entrega 2 — Onboarding e cadastro comercial

- Definir público inicial e modelo de ativação: aprovação manual (beta), teste gratuito ou assinatura direta.
- Criar `/cadastro`, confirmação de e-mail e recuperação de senha com Supabase Auth, com estados de erro e disponibilidade.
- Separar identidade de usuário, workspace/organização e direito de acesso. Um cadastro Auth sem direito de uso **não concede** acesso aos leads ou APIs.
- Após aprovação, orientar o usuário para busca inicial, salvar um lead, marcar primeiro follow-up e acompanhar sua fila.
- Definir comunicações de suporte, termos, privacidade e políticas de uso antes de adquirir clientes.

**Critério:** conta fictícia pode se cadastrar, receber confirmação, completar onboarding e acessar somente seus próprios dados após ativação.

## Entrega 3 — Planos, cobrança e limites

- Escolher gateway de pagamento e método de cobrança compatível com Brasil, com base em preços, taxas e requisitos atuais.
- Aprovar **preços em BRL, limites de consultas/API, número de usuários e funcionalidades por plano**; nenhum valor é presumido neste documento.
- Modelar `subscriptions`, `plans`, `billing_events`/idempotência e `usage_counters` em migrations revisadas e versionadas, com webhooks autenticados no servidor.
- Direito de acesso e cotas avaliados **no servidor**, não por plano ou status configurável no `localStorage`. Gate de uso deve ser aplicado nas Edge Functions e no banco quando pertinente.
- Tratar trial, cobrança em atraso, cancelamento, reativação, reembolso, troca de plano e custos de Google/OpenAI.
- Evitar ativar checkout enquanto não houver plano de restore/migrations aprovado e isolamento de tenant validado.

**Critério:** assinaturas simuladas mudam o direito de uso conforme webhooks idempotentes; nenhuma credencial de pagamento chega ao navegador.

## Entrega 4 — Operação comercial e lançamento

- Painel administrativo com clientes, assinaturas, eventos de cobrança, limites, suspend/activate e suporte, com permissões específicas.
- Indicadores de aquisição/ativação/retenção: visitas à apresentação, contas convidadas, cadastro iniciado, ativação, primeira busca, primeiro lead salvo, follow-up definido, retenção.
- Monitorar custos por consulta e quotas de fornecedor antes de liberar contas em escala.
- Validar acessibilidade, navegação, testes em mobile, mensagens de erro, desempenho e conformidade LGPD.
- Lançar beta controlado com clientes autorizados e colher feedback antes de ampliar aquisição.

## Restrições para as próximas PRs

- Não usar dados reais de clientes em testes/CI.
- Não implantar alterações de schema, autenticação ou cobrança na produção sem ambiente de teste, migrações conciliadas, backup recuperável e autorização específica.
- Manter o produto atual utilizável para as contas existentes.
- Nenhum novo serviço pago ou chave de API deve ser contratado por pressuposição.
- UX em desenvolvimento na PR #27 deve ser reconciliada sem sobrescrever alterações mais recentes da main.

## Próximas decisões de produto

1. Público-alvo: profissionais de prospecção, agências, vendedores individuais ou times.
2. Oferta: beta por convite, teste por prazo, ou acesso pago desde o início.
3. Estrutura dos planos: valor mensal, consultas e funcionalidades incluídas.
4. Gateway e política de cancelamento/suporte.
5. Canal comercial de contato (e-mail de vendas ou WhatsApp comercial), para que possamos habilitar um CTA de solicitação de acesso sem inventar destinatários.

**Resultado:** a apresentação pública é uma etapa útil de aquisição. Ela **não equivale ao lançamento do SaaS**, que exige as fases de ativação, cobrança e controle de uso.
