# Januário Leads — Busca com cotas comerciais (Staging)

**Data:** 07/11/2026. **Status:** código e banco implantados para homologação, sem liberação comercial e sem mudar a produção.

## Planos

| Plano | Preço futuro | Novos leads desbloqueados/dia |
|---|---:|---:|
| Free | Grátis | 5 |
| Pro | R$ 14,90/mês | 25 |
| Advanced | R$ 29,90/mês | 70 |

O saldo diário renova à meia-noite em America/Sao_Paulo; um Google Place ID já desbloqueado pelo usuário pode ser reapresentado sem custo de cota. Esse é um limite de **empresas reveladas em resultados de busca**, não de cadastros manuais nem de requisições à API.

## Mudanças integradas

- Migration `supabase/migrations/20261107224200_saas_quota_peek.sql` criou `peek_daily_leads_for_user(uuid)`, RPC de leitura **exclusiva do service_role**.
- A Edge Function `search-places` consulta essa RPC depois de autenticar JWT e `private_access`, **antes** de chamar o Google. Com saldo zero devolve HTTP 429 / `DAILY_LEAD_LIMIT`, sem solicitar o Google.
- Cada lote de Places IDs do Google passa pela RPC atômica `claim_daily_leads_for_user` antes de ser enviado ao navegador. IDs não aprovados são removidos. A paginação é encerrada ao esgotar saldo.
- A resposta de sucesso informa `quota: {plan,daily_limit,used_today,remaining_today,usage_date}`. Falhas de RPC impedem que qualquer resultado seja entregue.
- Enriquecimento Google é negado a contas Free em ambientes com cotas ativas (ainda há outros recursos a conectar às permissões do plano).
- O frontend tem um serviço de leitura do saldo autenticado (`src/features/search-leads/saas-usage.ts`) e mostra plano, utilizados, disponíveis e renovação. Com saldo zero, desativa o botão de nova pesquisa.
- A integração de frontend é ativada apenas quando o URL público do projeto é o Supabase Staging. A aplicação em produção permanece inalterada pela branch. No backend, produção só ativa cotas se o operador configurar `SAAS_DAILY_QUOTAS_ENABLED=true` **depois** de aplicar e verificar o schema comercial.
- A lista de CORS do backend foi estendida **somente para o Supabase Staging**, aceitando previews HTTPS de `januarioleads-*-wesley-s-projects16.vercel.app`. JWT e `private_access` permanecem obrigatórios; CORS não é autenticação.

## Simulação sem custos com Google

O frontend no Supabase Staging envia `stagingDemo: true`. A Edge Function só honra essa opção quando o ambiente real é o projeto `prlrxjothrslhswpkoza`, após login/autorização. A função gera até quatro páginas de 20 empresas **explicitamente fictícias**, com IDs determinísticos. Não há telefone ou dados de terceiros, e não ocorre solicitação ao Google Places nesse modo.

Os limites e a filtragem são os mesmos que seriam aplicados a IDs de empresas reais. No Free, a primeira página devolve no máximo cinco resultados; no Pro, as duas primeiras páginas podem liberar 25; no Advanced, até 70, enquanto não houver histórico de consumos anteriores.

**Nota:** O modo fictício não substitui testes posteriores com Google Places e suas regras de API/termos de uso. Não prometer captação de empresas reais no Staging até configurar credenciais apropriadas, revisar custos e executar E2E real.

## Implantação verificada

- Supabase Staging: `search-places` ACTIVE, versão 2, `verify_jwt=true`.
- Vercel: branch `feature/saas-plans-quotas-staging-20261107` tem quatro variáveis privadas de preview: `VITE_DEPLOY_TARGET=staging`, `VITE_SUPABASE_URL` apontando exclusivamente a Staging, chave publicável de Staging e `VITE_HTTPONLY_SESSION=false`.
- O Preview da branch foi construído com status READY. A prévia pode exigir autenticação Vercel do proprietário.
- Não alterados: segredo Google de produção, banco de produção, domínio `januarioleads.vercel.app`, variáveis do ambiente production, `private_access` de produção.

## Testes executados

- SQL transacional, sem resíduos: `supabase/staging/tests/20261107_verify_search_quota_pipeline.sql`.
- Testes confirmaram saldo 5/5, seis IDs novos retornam no máximo cinco, saldo final zero, repetição não consome cota, Pro calcula 25, Advanced calcula 70 e cancelamento volta ao Free.
- ACL: clientes `anon` e `authenticated` não podem executar a RPC administrativa `peek_daily_leads_for_user`.
- Os testes de SQL ocorreram em `BEGIN`/ `ROLLBACK`. Nenhuma assinatura, nenhum consumo nem empresa fictícia foi persistida.
- O build da Vercel terminou READY. **O teste funcional HTTP com uma sessão de usuário real no Preview ainda precisa ser realizado**; não inferir aprovação E2E somente do build.

## Como testar manualmente

1. Abra o Preview da branch logado na sua conta da Vercel.
2. Entre usando a conta Gmail de teste autorizada do Supabase Staging.
3. Abra **Buscar Leads** e observe `Plano FREE — 5 de 5 leads disponíveis hoje`.
4. Escolha uma cidade e segmento, clique Buscar; deve aparecer banner **Simulação no Staging**, somente cinco empresas fictícias e saldo zero.
5. Verifique que a opção de nova busca é desativada. Em outras sessões, o backend deve devolver `DAILY_LEAD_LIMIT` a tentativas diretas.
6. Para testar Pro e Advanced, faça atualizações de assinaturas **somente em dados artificiais no Staging**, com rollback após cada teste. Não conceder planos pagos em produção manualmente.

## Pendente antes de abrir ao público

- Teste E2E HTTP usando login de usuário de Staging, inclusive paginação e duas sessões simultâneas.
- Validar detecção de cada funcionalidade por plano também nos endpoints `open-now-niches`, `deep-enrich-business` e operações de CRUD que exigirem franquia específica.
- Estudar caches antigos/degradação de planos, custos por consulta Google, regulamentação de dados e segurança de clientes.
- Integrar gateway em Sandbox com webhooks assinados e idempotentes. Nenhum checkout real está ativo.
- Revisão de migrações, backup/restauração e homologação antes de merge na `main`.

**Não fazer merge do PR #83 na produção por enquanto.** GitHub Actions segue bloqueado por cota de faturamento, embora o Preview da Vercel possa buildar.
