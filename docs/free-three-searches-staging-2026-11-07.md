# Free: 3 pesquisas/dia — implementação em staging

- Branch: `feature/free-three-searches-staging-20261107`
- Base: `feature/places-cost-guardrails-staging-20261107`, **não** `main`.
- Banco staging: `prlrxjothrslhswpkoza`; produção: **não alterada**.
- `saas_free_search_quota`: cota transacional por usuário, 3 novas pesquisas por dia de Brasília, com bloqueio da 4ª e sem paginação Free.
- 20 resultados por pesquisa. O limite de leads/contatos desbloqueados já existente na tabela `saas_plans` permanece distinto (Free: 5/dia, Pro: 25/dia, Advanced: 70/dia). Contatos que excedem o desbloqueio aparecem somente como prévia; o Free não pode salvá-los pelo card ou pelo modal.
- O frontend usa `search-quota` (consulta sem consumo) e atualiza o contador a cada busca.
- O backend rejeita busca sem quota **antes de chamar o fornecedor** e reserva uma chamada atomicamente para impedir bypass por concorrência ou várias abas.
- `mapMode` segue reservado aos planos Pro/Advanced; esta etapa **não introduz Geoapify** nem altera Google Cloud ou o preço dos planos.

## Validação

1. Aplicar a migration em staging; manter produção isolada.
2. Executar `supabase/staging/tests/20261108_free_three_searches.sql`; nenhuma cota de teste persistirá devido ao `ROLLBACK`.
3. Autenticar uma conta Free autorizada no preview e validar 3 buscas com até 20 resultados, o bloqueio da 4ª, a persistência entre abas e a renovação à meia-noite de Brasília.
4. Verificar que uma busca paginada Free diretamente no endpoint é recusada e não gasta cota.
5. Confirmar que contatos além do limite Free de desbloqueio ficam redigidos, mesmo por chamada direta à API, e que Pro/Advanced mantêm as cotas anteriores.
6. Validar build, typecheck e testes E2E antes de merge. O Google Places real não deve ser acionado por testes; staging usa fixtures.

**Nota:** uma pesquisa validamente autorizada é contabilizada antes da chamada ao provedor, mesmo que o provedor falhe; isso evita estouros de custo. Nenhum dado de cliente em produção deve ser usado para testes.
