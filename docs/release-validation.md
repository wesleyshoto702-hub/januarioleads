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
   banco existente. Em 03/11/2026, após confirmar a CHECK constraint validada,
   a versão `20261103220000` foi registrada no histórico remoto de migrações
   **sem reaplicar o ALTER TABLE**. O Supabase confirmou a versão no ledger
   e preservou 197 leads e 2 contas autorizadas.
2. Publicar o frontend e as funções alteradas `deep-enrich-business` e
   `search-places` (ambas importam módulos compartilhados alterados).
3. O workflow `deploy-search-places.yml` separa **validação** de
   **publicação**. Um push na `main` testa regras, banco e contrato de migração
   e verifica a constraint de produção usando SQL somente de leitura
   (`scripts/verify-release-migration.py`), além de verificar RLS em todas
   as tabelas físicas `public` e o bloqueio de execução por clientes de
   funções `SECURITY DEFINER` (`scripts/verify-production-security.py`),
   **sem publicar funções**.
   Para publicar pelo GitHub, disparar `workflow_dispatch` ou uma tag
   `deploy/supabase-*` e configurar `SUPABASE_ACCESS_TOKEN` com a permissão
   `edge_functions_write`. O segredo foi atualizado pelo proprietário; a
   execução manual #10 (41736549911) foi aprovada, incluindo as duas publicações.
   Nunca colocar tokens no repositório.
   O Management API executa DDL em transação somente de leitura (erro 25006);
   aplicar futuras migrações por mecanismo autorizado antes de publicar funções.
   Depois da publicação manual aprovada, `search-places` v29 e
   `deep-enrich-business` v25 foram confirmadas ACTIVE, com JWT habilitado. Uma validação verde de push **não significa**
   que ocorreu uma nova publicação.
4. **Histórico de migrações parcialmente reconciliado em 03/11/2026**:
   foram corrigidos no GitHub **oito nomes de migrações** para os timestamps
   idênticos aos registrados no Supabase; sete arquivos tinham conteúdo SQL
   exato e um tinha diferenças apenas de comentários/espaçamento.
   As migrações locais `20260930144545` (status `send_message`) e
   `20260930152000` (Instagram) tiveram seus efeitos conferidos em produção
   e foram registradas **somente no ledger**, sem executar suas alterações.
   Resultado verificado: **51 versões no remoto, 24 arquivos locais,
   nenhuma versão local pendente no remoto, mas 27 versões remotas sem arquivos
   locais**. As versões históricas remotas incluem migrações temporárias,
   operações de dados e referências a segredos: inspecionar e higienizar
   cuidadosamente antes de versionar qualquer SQL recuperado.
   Inventário das 27 versões remotas sem arquivo:
   [docs/migration-history-audit.md](migration-history-audit.md).
   [Revisão dos 23 scripts](migration-history-review-23.md): 11 SQLs
   adicionais foram recuperados como texto não executável, somados aos
   4 de índices anteriores (15 arquivados); 12 permanecem no ledger remoto
   por incluírem operações de usuários, dados ou Cron/Vault. Nenhum desses
   históricos deve ser reaplicado ou usado para restaurar produção.
   **Não executar `supabase db push`, `db reset` remoto nem reparações em lote**.
   Conferir `supabase migration list --linked`, recuperar apenas conteúdos
   revisados com `supabase migration fetch`, estabelecer um baseline coerente
   para novos ambientes e usar `supabase db push --dry-run` antes de qualquer
   push futuro. A correção do ledger não significa que o histórico está completo.
5. Em homologação, usar duas contas autorizadas em private_access para testar
   login, edição, exclusão, pagamentos, atualização da página e troca de conta.
   Testar com rede interrompida e restabelecida; pendências devem sobreviver.
6. Executar buscas externas somente após confirmar segredos e limites de custos
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

O segredo `SUPABASE_ACCESS_TOKEN` está operacional para publicação manual
das Edge Functions (execução GitHub Actions #10 aprovada). Renovar com segurança
antes da expiração do token e manter escopo mínimo; nunca copiar valores de token
para chats ou repositórios. **O deploy automático a cada push continua desativado
por design**, mesmo com o segredo válido. Contas de homologação e credenciais de
terceiros devem ser providenciadas separadamente; o dump estrutural não fornece
acesso. Ver também `docs/security-review-2026-11-03.md`.

## Frontend Lovable

O proprietário confirmou que o frontend está no Lovable. Alterações em main
sincronizam com o editor conectado. A publicação do site exige a sessão Lovable
ou integração de deploy autorizada; um push não comprova que o site foi publicado.
