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

1. Aplicar **somente** `20261103220000_allow_presence_site_rate_limit.sql` pelo
   mecanismo de migrações autorizado ou SQL Editor. Ela ajusta uma CHECK constraint;
   não remove linhas nem muda dados. Pode ser reaplicada. O script de teste cobre
   essa reaplicação. Não usar a baseline para atualizar um banco existente.
2. Publicar o frontend e as funções alteradas `deep-enrich-business` e
   `search-places` (ambas importam módulos compartilhados alterados).
3. No GitHub Actions, executar o workflow `deploy-search-places.yml` na branch
   `main` (ou publicar uma tag `deploy/supabase-*` no commit de release). Ele testa o SQL e aplica somente a migração incremental via Management
   API, depois publica search-places e deep-enrich-business. Requer o segredo
   SUPABASE_ACCESS_TOKEN já configurado no GitHub. Mantém os segredos existentes
   das funções; não exige copiar OPENAI_API_KEY para este ambiente. Confirmar o
   sucesso do run; listar funções não substitui testar funcionalidades.
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
