# Homologação de duas contas com Supabase real

O teste real `scripts/test-staging-rls.py` está preparado e o workflow
[staging-rls.yml](../.github/workflows/staging-rls.yml) é manual.

**Ambiente de execução**: projeto Supabase separado, com Auth real e duas
contas fictícias autorizadas em `private_access`. Não utilizar o projeto
de produção nem contas ou leads de clientes. O script falha ao receber a URL
do projeto `czkazbianiflhldenhcj`, ou qualquer URL sem HTTPS.

Configurar *secrets* no GitHub para o ambiente `staging`:
`JANUARIO_STAGING_SUPABASE_URL`,
`JANUARIO_STAGING_SUPABASE_KEY` (publishable/anon),
`JANUARIO_STAGING_A_EMAIL`,
`JANUARIO_STAGING_A_PASSWORD`,
`JANUARIO_STAGING_B_EMAIL`,
`JANUARIO_STAGING_B_PASSWORD`.

O script autentica as duas contas via GoTrue, confere allowlist, insere dois
leads temporários, tenta ler, modificar e excluir o lead de outra conta e
depois remove os leads de teste. Valida que as tentativas de alteração cruzada
não retornam linhas (RLS); não usa `service_role`.

**Estado atual:** testes unitários e testes PostgreSQL de duas contas já
cobrem regras locais, mas a homologação com GoTrue/PostgREST real **não foi
executada**, porque não há um projeto de staging + secrets disponibilizados.
Não ativar o workflow apontando para produção. Habilitar proteção do
`environment: staging` para impedir uso de secrets sem revisão.
