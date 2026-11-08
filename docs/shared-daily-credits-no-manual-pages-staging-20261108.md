# Créditos diários compartilhados — Januário Leads (STAGING)

## Regras implementadas

- **Free** mantém 3 pesquisas/dia e regra atual de 5 contatos completos/dia; resultados adicionais aparecem como prévia e não são debitados como leads completos.
- **Pro (R$ 19,90/mês)**: 25 créditos/dia. Buscar Leads tradicional custa 1 crédito por empresa entregue. Maps fica bloqueado na interface e backend.
- **Advanced (R$ 29,90/mês)**: 70 créditos/dia. Buscar Leads tradicional custa 1 crédito/empresa; Buscar via Maps custa 2 créditos/empresa. Uma pesquisa pode entregar até 70 tradicionais ou 35 Maps, sujeitos a dados existentes e cotas de APIs.
- Pesquisas trazem automaticamente páginas de resultados do provedor, com limite de até 4 páginas Google para Buscar Leads e 2 para Maps. **Não existe mais botão de "Carregar mais"** nas telas de pesquisa.
- O backend só desconta créditos quando entrega lugares reais. Retorno sem resultados não debita créditos de leads. Falhas após algumas páginas entregam resultados já válidos, com aviso de resultado parcial.
- A tabela `saas_daily_credit_leads` usa chave `(user_id, usage_date, place_id)`, evitando cobrar duas vezes pelo mesmo ID de estabelecimento no mesmo dia. IDs de fontes diferentes não são automaticamente considerados o mesmo local.
- O débito é transacional em `claim_daily_leads_for_user(uuid,text[],text)`, que trava o saldo do usuário por dia e impede utilização acima do limite, inclusive em buscas simultâneas.
- A carteira renova à meia-noite no fuso `America/Sao_Paulo`. O Google Places/Geoapify seguem tendo limites monetários e técnicos separados.
- A prévia do frontend passa a buscar locais reais no Google por padrão; modo fictício só é opt-in explícito para testes.
- A versão prévia permite adicionar Geoapify/OSM diretamente ao CRM com atribuição e Google Place IDs com nome fornecido pelo cliente. Os dados da API Google não são copiados automaticamente para armazenamento permanente. Veja `docs/maps-crm-import-cross-provider-credits-staging-20261108.md`.

## Arquivos envolvidos

- `supabase/migrations/20261108192500_shared_daily_lead_credits.sql`
- `supabase/migrations/20261108194500_fix_credit_unlock_insert.sql`
- `supabase/functions/search-places/index.ts`
- `supabase/functions/geoapify-places/index.ts`
- `supabase/functions/_shared/geoapify-adapter.ts`
- `src/features/search-leads/SearchLeadsView.tsx`
- `src/features/search-leads/search-businesses.ts`
- `src/features/maps-leads/MapsLeadsView.tsx`
- `src/features/maps-leads/geoapify-client.ts`
- `src/routes/app.tsx`
- `supabase/staging/tests/20261108_shared_credit_wallet.sql`

## Validação

- Migrações aplicadas **somente** no Supabase staging `prlrxjothrslhswpkoza`.
- `search-places` v10 e `geoapify-places` v12 ativos, com verificação de JWT.
- Executado teste SQL em transação revertida (`ROLLBACK`): 1 e 2 créditos, reconsulta no mesmo dia sem cobrança, zero resultados sem cobrança, saldo insuficiente e bloqueio Maps no Pro. Todos passaram, sem consumo de créditos da conta real.
- Testes Deno/Playwright e navegação autenticada de ponta a ponta **não foram integralmente executados**, portanto não liberar produção antes da homologação.
- A Vercel Preview pode estar temporariamente desatualizada em função de limite de deploys; confirmar SHA no ambiente publicado antes de testar as telas.

## Cuidados antes do lançamento

- Revisar compatibilidade com as políticas de cache/armazenamento e uso comercial do Google Maps/Places, principalmente ao armazenar informações de locais no CRM.
- Medir custo real de consultas automáticas, dimensionar Google Text Search Enterprise vs Pro, limites por usuário e chamadas do Maps JavaScript API.
- Validar o caso de empresa sem telefone/website público. "Lead disponível" não garante contato obtido; não inventar dados.
- Os créditos são unidades internas de uso, **não** pontos comprados nem pagamentos debitados em gateway.
