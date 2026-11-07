# Januário Leads — Preparação do CRM em Staging (07/11/2026)

## Objetivo e limites

Homologar os planos Free (5), Pro (25) e Advanced (70 leads/dia) sem alterar o CRM de produção nem copiar dados de clientes.

Projetos:
- **Staging:** `prlrxjothrslhswpkoza` (alterado).
- **Produção:** `czkazbianiflhldenhcj` (somente leitura; inalterado).

## O que foi executado

1. Aplicado em Staging o snapshot **somente de estrutura** do repositório `supabase/baseline/20261103-public.sql`. A cópia sanitizada e isolada está em `supabase/staging/20261107_prepare_crm_schema.sql`; não foi colocada em `supabase/migrations` para evitar execução acidental na produção.
2. O snapshot contém **17 tabelas** de CRM, quatro funções, triggers, índices, restrições e **38 políticas RLS**. A comparação automatizada com os metadados atuais de produção confirmou os mesmos nomes de tabelas, colunas/tipos/nullability e políticas.
3. Incluído o bucket `presence_site` no CHECK de `api_request_rate_limit`, conforme migração de produção posterior ao snapshot.
4. Foi detectada uma diferença nas permissões padrão de funções. A correção está em `supabase/staging/20261107_restrict_crm_functions.sql`: execuções internas de `claim_api_request_for_user`, `claim_open_now_refresh` e triggers não são permitidas a `anon` ou `authenticated`, mas permanecem disponíveis ao `service_role`.
5. Autorizada **somente a conta Gmail já confirmada de Staging** na tabela `private_access`. Novas contas não recebem automaticamente acesso ao CRM.
6. Mantidas as seis tabelas comerciais `saas_*` e respectivas RPCs de planos/cotas da fase anterior. Nenhuma alteração em cobrança ou `private_access` da produção.

As cinco migrações registradas no Staging até esta etapa são a de cadastro Gmail, as duas de planos, a do snapshot do CRM e a da restrição de funções.

## Validações efetuadas

- **Esquema CRM:** 17/17 tabelas e 38/38 políticas RLS equivalentes às da produção; seis tabelas SaaS com RLS ativo.
- **RLS:** usuário de teste autorizado consegue criar e ler o próprio lead; trigger gera `lead_added`; simulação de segunda identidade não consegue visualizar/alterar o lead nem ler `private_access`.
- **ACL:** RPC de limite de requisições não é executável por `anon`/`authenticated`; permanece disponível a `service_role`.
- **Buckets:** `places_search` e `presence_site` aceitos; identificador desconhecido rejeitado.
- **Dados:** Staging ficou com **0 leads, 0 atividades, 0 buscas em cache, 0 consumo de quota SaaS e 0 assinaturas pagas**. Só a autorização explícita da conta de teste permanece; as inserções fictícias rodaram dentro de transações com `ROLLBACK`.
- **Produção:** tabela `saas_plans` ainda inexistente; o gate `private_access` existente continua preservado.

Teste SQL reproduzível: `supabase/staging/tests/20261107_verify_crm_staging.sql`. O teste simula identidades via claims SQL e **não substitui** teste E2E real de múltiplas sessões.

## O que ainda não está pronto

- O Supabase Staging ainda **não possui Edge Functions implantadas**, inclusive `search-places`. Não foi configurada chave de Google Places de produção ou gerada cobrança.
- A busca do frontend ainda não verifica os **5/25/70 leads por dia**; a nova RPC já existe, mas ainda não foi integrada à Edge Function para filtrar resultados antes de responder.
- Não foi implantado checkout, assinatura paga, webhook, upgrade ou bloqueio visual de recursos.
- Ainda precisamos testar paginação/caches, cotas de requisições e concorrência em cenário E2E com mais de um usuário real.

## Próxima etapa recomendada

Integrar a Edge Function de busca em branch de teste, implantar no Staging com `verify_jwt=true`, conectar a RPC `claim_daily_leads_for_user` antes de enviar resultados, bloquear chamadas que excedam cotas e testar com respostas falsas do Google Places; só depois configurar credenciais de teste que possam gerar custos reais. Testar a liberação de leads e condições de corrida sem depender do GitHub Actions, que segue sem franquia de computação.

**Aviso existente:** o Supabase Auth de Staging ainda registra aviso de proteção de senhas vazadas desativada. Aviso informativo da tabela `saas_billing_events` sem policies é intencional: ela não tem acesso concedido a usuários comuns.
