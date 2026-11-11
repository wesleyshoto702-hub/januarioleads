# Migração dos módulos comerciais para Supabase

Data: 10–11/11/2026. Status: **estrutura aplicada em staging e produção; integração frontend adicionada nesta branch; importação de dados reais será feita no próximo acesso do usuário, após publicação e validação do build**.

## Escopo

Foi criada uma tabela nova e aditiva, `public.commercial_workspace_documents`, nos projetos:

- Produção `czkazbianiflhldenhcj`, migration version `20261111003505`.
- Staging `prlrxjothrslhswpkoza`, migration version `20261111003400`.

Os projetos já tinham históricos de migração diferentes. O arquivo `supabase/migrations/20261111003505_commercial_workspace_documents_rls.sql` acompanha o número de produção e usa DDL repetível para evitar recriação na homologação. **Não executar resets ou sincronizações destrutivas de schema para conciliar o histórico.**

### Dados sincronizados

A tabela guarda **documentos JSONB por usuário e tipo**, sem duplicar ou alterar a estrutura existente de leads e financeiro:

| Documento | Dados |
| --- | --- |
| `proposals` | propostas comerciais salvas |
| `campaigns` | campanhas e referências aos IDs de leads |
| `sequences` | modelos de follow-up |
| `enrollments` | acompanhamentos de cada sequência |
| `agenda` | compromissos criados no calendário |
| `objections` | histórico de objeções por lead |
| `projects` | projetos e tarefas de entrega |
| `goals` | objetivos de produtividade |
| `digital-reports` | cache de relatórios públicos PageSpeed |

O limite é de 500 elementos e até 500 KB por documento no banco. O frontend limita cada escrita a 450 KB para acomodar a sobrecarga da API, inclusive o proxy BFF.

## Autenticação e segurança

- Os dados são acessíveis somente com a conta autenticada via Supabase Auth ou BFF HttpOnly.
- A linha pertence a `auth.uid()`. RLS tem políticas individuais de `SELECT`, `INSERT`, `UPDATE`, com `USING` e `WITH CHECK` adequados.
- `anon` não possui nenhum privilégio de leitura ou escrita e usuários autenticados não recebem `DELETE` ou `TRUNCATE` da tabela.
- A lista de documentos é fechada por constraint SQL e whitelist TypeScript. **Chaves de Google Maps, Geoapify, Auth, tokens, settings privilegiados e credenciais não são enviadas.**
- Testado no banco em transações com rollback: inserção/leitura própria no staging, e zero linhas visíveis/atualizáveis por outra conta em produção. Consultas de auditoria confirmaram RLS habilitado e restrições de grants.

## Quando os registros existentes serão realmente migrados

Os registros atuais das oito funções estão em `localStorage` vinculado ao ID da conta, **no navegador do usuário**. Os operadores do Supabase/GitHub não têm acesso ao armazenamento do aparelho.

Após a publicação de um build funcional:

1. Entrar com a mesma conta no **mesmo navegador e endereço** onde os dados foram criados.
2. O Workspace realiza a leitura da nuvem antes de exibir as páginas comerciais.
3. Coleções com conteúdo apenas local são enviadas para a própria conta no Supabase.
4. Coleções já sincronizadas, sem alterações locais, adotam a revisão mais recente da nuvem.
5. Se houver alterações locais e remotas, o sistema tenta uma conciliação por ID/data sem descartar registros novos; mantém uma cópia local de recuperação nos casos conflitantes.
6. Cada ação futura de salvar, criar, editar ou excluir um item da coleção dispara atualização autenticada por versão; em conflito ou offline, a cópia local é mantida e um aviso permite tentar novamente.
7. O usuário deve conferir os dados em outro aparelho somente após o banner de sincronização desaparecer e validar o resultado no Supabase.

**Não afirmar que os dados já foram transferidos só porque a tabela existe.** O banco inicia com zero documentos. Se os registros de origem estiverem em outro navegador/domínio ou em um dispositivo com dados apagados, a importação automática não encontra esse conteúdo.

## Limites e cuidados para lançamento público

- O modelo JSONB por coleção foi escolhido para um passo **não destrutivo** de migração dos MVPs pessoais. Para SaaS com muitas contas/equipes, considerar esquema relacional normalizado, auditoria, paginação e índices por entidade.
- **Não há sincronização em tempo real** entre navegadores abertos nem resolução perfeita de exclusões concorrentes. Revisões CAS evitam substituição cega; uma exclusão feita durante conflito pode precisar ser repetida.
- O fluxo atual depende da confirmação de cada gravação em rede. Quando falha, conserva dados locais. Não remove caches automaticamente.
- Não usar snapshots para autorização de planos, cotas financeiras ou cobrança. Continue usando as políticas e serviços server-side já existentes.
- Não usar a API de maneira que cause custos não previstos. Esta migração não cria serviços pagos ou consultas Google adicionais.
- Restauração de banco e políticas de backup/retenção ainda precisam ser verificadas antes do lançamento comercial.

## QA

- Consultas SQL e testes de RLS básicos executados em staging e produção, sem deixar dados artificiais.
- Teste SQL pgTAP em `supabase/tests/commercial_workspace_documents_rls_test.sql` e testes TypeScript/Deno da lógica de merges adicionados ao repositório.
- **Build, Deno tests, impressão e testes em browser não validados**: GitHub Actions está falhando antes de executar os steps por problema de franquia do runner.
- A nova tabela **não modifica** `public.leads`, `public.lead_payments`, `public.user_settings` nem funções de API, Auth ou RLS anteriores.
- A publicação efetiva depende do pipeline de hospedagem; o merge para `main` não comprova sozinho que o site de produção foi atualizado.

## Operação / diagnóstico

Se a nuvem estiver indisponível, o usuário pode continuar com o armazenamento local, mas a tela deve mostrar o aviso de falha. **Não limpar dados do site até confirmar a sincronização.** Se aparecer um conflito, usar **Sincronizar novamente**, conferir o resultado, e manter o backup local para auditoria. Nenhum componente envia automaticamente mensagens ou altera pagamentos na migração.
