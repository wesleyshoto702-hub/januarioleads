# Auditoria de aderência comercial — Free, Pro e Advanced

**Data:** 07/11/2026  
**Escopo:** código do CRM na branch `feature/home-pricing-free-pro-advanced-20261107`; esquema de planos e quotas no projeto Supabase Staging; estado atual da produção (consultas somente leitura).

## Conclusão

**Ainda não está pronto para vender Free/Pro/Advanced como ofertas efetivamente distintas.** O CRM contém funções reais, mas as permissões comerciais e o checkout não estão conectados à produção. O texto da homepage é uma proposta futura, como indica o aviso de "Planos em preparação".

## Comparação promessa × entrega

| Item anunciado | Código existente? | Efetivamente disponível por plano? | Observação |
| --- | --- | --- | --- |
| Free: 5 novos leads/dia | **Sim, em Staging** | **Não em produção** | RPC atômica e Edge Function de busca integradas na branch PR #83; não presentes na branch da homepage/produção. |
| Free: busca por cidade e segmento | **Sim** | **Não separada por plano** | Pesquisa Google Places via `search-places` para usuários autorizados, com orçamento técnico, não com quota comercial no backend de produção. |
| Free: CRM básico | **Sim** | **Não separado por plano** | Cadastro/listagem/edição persistidos no workspace por usuário; `private_access` ainda exige autorização. |
| Free: modelos essenciais | **Sim** | **Não separado por plano** | Modelos padrão e follow-up no módulo de mensagens. |
| Pro: 25 novos leads/dia | **Sim, em Staging** | **Não em produção** | Mesmo mecanismo de quotas do PR #83; falta liberação real e E2E com sessão autenticada. |
| Pro: CRM completo e Kanban | **Sim** | **Não separado por plano** | `LeadKanban` e a visualização de carteira funcionam para o usuário atualmente autorizado. |
| Pro: modelos personalizados | **Sim** | **Não separado por plano** | `MessagesView` permite criar, editar, remover e favoritar modelos; envio para WhatsApp permanece manual. |
| Pro: central de acompanhamento | **Sim** | **Não separado por plano** | `DailyProspectingQueue` organiza atrasadas, hoje e sugestões; não dispara mensagens ou notificações externas. |
| Pro: relatórios básicos | **Sim** | **Não separado por plano** | `CommercialReports` possui período, status, cidade, segmento, recebimentos; são dados do CRM, não projeções de venda. |
| Advanced: 70 novos leads/dia | **Sim, em Staging** | **Não em produção** | Mesma ressalva do Free/Pro. |
| Advanced: todos os recursos Pro | **Parcialmente** | **Não separado por plano** | Recursos do Pro existem, mas a autorização por assinatura não é aplicada a todas as funcionalidades. |
| Advanced: priorização inteligente | **Parcialmente** | **Não separado por plano** | `evaluateIdealCustomer` calcula score heurístico por segmento, cidade, presença digital e outros dados. Não é IA preditiva nem serviço Advanced exclusivo. |
| Advanced: relatórios avançados | **Parcialmente** | **Não separado por plano** | Há relatórios de status/cidade/segmento, tendências e exportação agregada; ainda faltam análises comerciais exclusivas e avançadas para o Advanced. |
| Advanced: automações internas | **Não como anunciado** | **Não** | Ações e follow-ups são organizados e sugeridos, mas não há mecanismo completo de regras automáticas e execução agendada desse plano. |

## Bloqueios para venda

1. **Monetização:** catálogo, flags, assinaturas e eventos comerciais existem no Supabase Staging, mas não há checkout/webhook comercial, liberação automática de planos ou experiência de pagamento validada.
2. **Isolamento de funcionalidades:** flags no banco de Staging são contrato futuro; UI de produção e demais Edge Functions não aplicam todos os gates Pro/Advanced. Criar as flags não restringe Kanban, relatórios ou templates por si só.
3. **Consumo:** integrar PR #83 ao CRM completo e ao frontend em homologação, testar paginação, limite por usuário, concorrência, reinício e condições de erro. O produto comercial ainda não foi lançado.
4. **Onboarding:** conta nova e direito de acesso são etapas distintas. Uma conta pode ser criada/confirmada sem receber `private_access`. Botões `Solicitar acesso Pro`/`Advanced` redirecionam a `/cadastro` e não iniciam uma solicitação específica do plano escolhido.
5. **Valor do Advanced:** priorização heurística e relatórios comuns não bastam para caracterizar funções avançadas exclusivas; automações inteligentes precisam ser especificadas e implementadas.
6. **Custo das APIs:** a assinatura não pode liberar consultas Google ilimitadas. O controle de novos leads precisa coexistir com rate limits/custos por chamada e licenças dos dados.
7. **Liberação:** testes end-to-end autenticados e revisão do cenário de Staging + backups antes de produção. O GitHub Actions estava com franquia mensal esgotada nesta revisão; build Vercel READY sozinho não substitui todos os testes.

## Cuidados com a comunicação pública

Enquanto o produto não estiver comercialmente pronto, manter indicação clara **"Planos em preparação"** e não afirmar compra, contratação ou desbloqueio imediato. Evitar chamar o score atual de previsão de vendas; é uma heurística explicável. Evitar afirmar que um clique em "Solicitar acesso Pro" contrata, seleciona ou reserva o plano: hoje abre a tela geral de cadastro.

**Sugestão de decisão:** lançar primeiro Free/Pro com limites e gates reais, depois Advanced com diferenciais testados; ou manter todos os cards como roadmap com funcionalidades previstas, sem checkout.

## Mudança visual desta etapa

Os números `01`, `02` e `03` foram removidos dos cards Free, Pro e Advanced na homepage e seu CSS residual foi excluído. As cores vermelhas, o Pro recomendado, a aurora e a ausência de setas permanecem.
