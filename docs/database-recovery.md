# Estrutura reproduzível do banco

O snapshot `supabase/baseline/20261103-public.sql` é a exportação original enviada
pelo proprietário em 03/11/2026. Foi preservado sem alterações. O manifest registra
SHA-256, commit de referência, contagens e fronteira das migrações do repositório.
Não contém registros de clientes. A revisão do arquivo não encontrou credenciais
embutidas. Ele contém tabelas, sequências, índices, constraints, funções, triggers,
RLS e permissões do schema public.

## Reproduzir a validação

Com Bash e Docker disponíveis, na raiz do repositório:

```bash
bash scripts/test-database-baseline.sh
```

O script cria um PostgreSQL 17 descartável, sem publicar portas, restaura o SQL
com `ON_ERROR_STOP`, executa testes e remove apenas o container criado por ele.
Não usa credenciais nem conexões de produção. A CI executa o mesmo teste.

A fixture `supabase/tests/platform-fixture.sql` fornece apenas os contratos usados
pelo snapshot: roles, auth.users(id), auth.uid() e pgcrypto. É exclusiva de teste;
NUNCA deve ser aplicada em Supabase. Isso valida SQL e RLS no PostgreSQL real,
mas não simula login/JWT, GoTrue, PostgREST ou toda a plataforma Supabase.

Testado: criação de lead com atividade automática, pagamento próprio, isolamento
entre duas contas em leads/atividades/pagamentos, bloqueio de alteração e exclusão
de lead alheio, bloqueio de inserção com proprietário alheio e pagamento em lead
alheio, bloqueio de conta sem private_access, RLS habilitado em todas as tabelas.

## Uso como baseline

Para um novo ambiente Supabase, o schema public precisa estar vazio e os serviços
nativos, roles, auth e pgcrypto já inicializados. Restaure o snapshot uma única vez
com um cliente PostgreSQL que pare no primeiro erro. Não execute a fixture de teste.
Não restaure esse snapshot sobre produção ou um banco com objetos existentes.

As migrações antigas continuam preservadas como histórico. Não as reaplique sobre
o snapshot atual: elas contêm ALTERs e CREATEs já incorporados. Para a linha de
baseline local, a fronteira do repositório é `20261103181928`; futuras mudanças
precisam de migrações posteriores. Não use `supabase db reset` esperando que essa
baseline separada seja aplicada automaticamente: o CLI continua vendo o histórico
incompleto em migrations. O caminho validado é o script acima. A reorganização do
histórico de ambientes remotos exige primeiro consultar seu ledger de migrações;
a exportação não inclui esse ledger e nenhum migration repair foi executado.

## Limites da exportação

O arquivo é somente do schema public. Contas, senhas, private_access preenchido,
configurações internas de sincronização, segredos, cron jobs, Vault, Storage,
Edge Functions e configurações Auth não são restaurados por ele. Provisionar esses
itens separadamente em qualquer ambiente completo, sem copiar dados de produção.
Nenhum acesso ou alteração em produção foi realizado nesta validação.

## Inconsistência preexistente identificada

`claim_api_request_for_user` aceita `presence_site`, mas a constraint
`api_request_rate_limit_bucket_check` não inclui esse valor. Portanto, essa operação
pode falhar por violação de CHECK. O snapshot preserva fielmente essa inconsistência;
não foi silenciosamente alterado. A correção está em `supabase/migrations/20261103220000_allow_presence_site_rate_limit.sql`. O teste restaura o snapshot, aplica essa migração duas vezes e verifica o limite de 80 chamadas, o bloqueio de clientes e buckets inválidos. A correção foi aplicada e validada no banco de produção em 03/11/2026. A execução original foi feita por SQL autorizado. Após verificar a constraint em produção, a versão `20261103220000_allow_presence_site_rate_limit` foi registrada no ledger remoto sem reaplicar o DDL; o Supabase confirmou o registro. Permanecem divergências históricas independentes desta correção: 35 timestamps somente no remoto e 10 somente no diretório local. Portanto, `supabase db push` **continua bloqueado operacionalmente** até alinhamento completo e revisão com `supabase migration list --linked` e `supabase db push --dry-run`. Nunca presumir que a reparação de uma única versão torna seguro reaplicar todo o histórico.
