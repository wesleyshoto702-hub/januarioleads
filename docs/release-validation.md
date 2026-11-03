# Correções de confiabilidade — publicação

## Validação local

- `bun run typecheck`: tipos do frontend.
- `bun run test`: regras, autenticação, persistência e paginação.
- `bun run test:browser`: navegador real, backend simulado, sem tráfego de produção.
- `bash scripts/test-database-baseline.sh`: PostgreSQL real, fixture dos contratos
  Auth, baseline original, migração incremental e isolamento entre contas.
- `bun run build`: build de produção.

Os testes de navegador não provam login real, RLS via PostgREST nem APIs pagas.
O teste SQL não provisiona toda a plataforma Supabase. O histórico de migrações
antigo não deve ser reaplicado sobre a baseline (ver database-recovery.md).

## Implantação incremental no projeto existente

1. A migração incremental `20261103220000_allow_presence_site_rate_limit.sql`
   foi **aplicada e conferida na produção em 03/11/2026** por uma conexão
   autorizada. Ela ajusta somente uma CHECK constraint; não remove leads nem
   usuários. Ela é idempotente. Em outro ambiente, aplicá-la primeiro via
   mecanismo de migrações autorizado ou SQL Editor. Nunca usar a baseline em
   banco existente. A aplicação manual não inscreve automaticamente esta versão
   no histórico do Supabase CLI; reconciliar o ledger antes de um `db push`.
2. Publicar o frontend e as funções alteradas `deep-enrich-business` e
   `search-places` (ambas importam módulos compartilhados alterados).
3. O workflow `deploy-search-places.yml` separa **validação** de
   **publicação**. Um push na `main` testa regras, banco e contrato de migração
   e verifica a constraint de produção usando SQL somente de leitura
   (`scripts/verify-release-migration.py`), **sem publicar funções**.
   Para publicar pelo GitHub, disparar `workflow_dispatch` ou uma tag
   `deploy/supabase-*` e configurar `SUPABASE_ACCESS_TOKEN` com a permissão
   `edge_functions_write`. O token atualmente salvo no Actions não possui
   essa permissão (HTTP 403); substituí-lo de forma segura em GitHub > Settings
   > Secrets and variables > Actions. Nunca colocar tokens no repositório.
   O Management API executa DDL em transação somente de leitura (erro 25006);
   aplicar futuras migrações por mecanismo autorizado antes de publicar funções.
   Em 03/11/2026 as versões `search-places` v27 e
   `deep-enrich-business` v23 foram publicadas por conexão Supabase autorizada
   e verificadas como ativas. Uma validação verde de push **não significa**
   que ocorreu uma nova publicação.
4. Em homologação, usar duas contas autorizadas em private_access para testar
   login, edição, exclusão, pagamentos, atualização da página e troca de conta.
   Testar com rede interrompida e restabelecida; pendências devem sobreviver.
5. Executar buscas externas somente após confirmar segredos e limites de custos
   do ambiente. Não usar uma conta de cliente para testes que alteram dados.

## Provisionamento de um projeto novo

Além do schema public, provisionar Auth, URLs de redirecionamento, contas de teste,
private_access, Edge Functions e os segredos exigidos pelas funções. Não copiar
os dados de produção ou inventar credenciais.

Para sync-leads, o código exige hash SHA-256 em sync_internal_config, chave
x-sync-secret correspondente no agendador e configuração de serviço no backend.
O cron original usa Vault (januarioleads_project_url, sync_leads_gateway_key e
sync_leads_cron_secret), pg_cron e pg_net. Esses objetos/dados não constam no dump.
As migrações antigas do cron pressupõem um job existente; não criam um projeto
novo completo. Obter as configurações autoritativas antes de ativar o agendamento.

## Dependências externas ainda necessárias

Nenhuma credencial de Supabase, conta de homologação ou credencial de implantação
está disponível neste ambiente. O dump fornecido é estrutural e não concede acesso.
A API do GitHub também rejeitou a autenticação disponível; o acesso Git é separado.
Não registrar senhas ou tokens no repositório ou nesta documentação.

## Frontend Lovable

O proprietário confirmou que o frontend está no Lovable. Alterações em main
sincronizam com o editor conectado. A publicação do site exige a sessão Lovable
ou integração de deploy autorizada; um push não comprova que o site foi publicado.
