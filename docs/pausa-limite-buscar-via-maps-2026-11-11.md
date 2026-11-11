# Buscar via Maps — pausa reversível do limite pessoal de buscas

Data: 11/11/2026

## Estado atual

**O limite próprio do Januário Leads de 10 buscas por dia está PAUSADO** nos Supabase original e staging a pedido do proprietário, somente durante a fase de ajustes. O sistema ainda exige sessão JWT válida e acesso à conta proprietária original. A restrição **não foi excluída**: foi preservada e encapsulada pela flag no banco.

- Migração: `supabase/migrations/20261111183100_personal_maps_daily_limit_pause_switch.sql`.
- Flag privada: `public.personal_maps_daily_limit_control` (registro `id=1`, `enabled=false`).
- Função original mantida: `public.claim_personal_geoapify_search()`. A única alteração é que a função passa a permitir imediatamente pesquisas do proprietário quando `enabled=false`, sem registrar novas buscas diárias. Se `enabled=true`, conserva a regra exata anterior de 10 por dia, incluindo a contagem histórica e o horário de Brasília.
- A tabela de limite possui RLS ativado e nenhum acesso direto para visitantes, `anon` ou `authenticated`. Somente o banco de dados/administrador deve modificar o sinalizador.
- O código da busca híbrida e do CRM não é removido ou refeito.

## Reativação, quando o proprietário solicitar

Execute **somente quando o proprietário pedir explicitamente para reativar o limite**:

```sql
UPDATE public.personal_maps_daily_limit_control
SET enabled = true, updated_at = now()
WHERE id = 1;
```

Faça isso no Supabase original e, se desejar uniformidade, no staging. Verifique:

```sql
SELECT enabled FROM public.personal_maps_daily_limit_control WHERE id = 1;
```

Resultado `true` = limite de 10/dia ativo; `false` = limite pausado. Não há necessidade de recriar funções, executar migrações novamente, zerar contagens ou fazer deploy para o banco voltar a limitar as buscas.

Para pausar novamente a pedido do proprietário:

```sql
UPDATE public.personal_maps_daily_limit_control
SET enabled = false, updated_at = now()
WHERE id = 1;
```

A cópia do SQL original, que registra e bloqueia pesquisas após 10/dia, está preservada na migração e pode ser reativada sem alterações no código da Edge Function. Atualize também a mensagem de interface `src/features/maps-leads/MapsPersonalView.tsx` ao reativar.

## Verificação executada

No staging e no Supabase original, a migração foi aplicada com sucesso. No original, a verificação em transação reversível confirmou:
- proprietário autorizado: `true` com limite pausado;
- usuário não autorizado: `false` apesar da pausa;
- simulando reativação no mesmo dia em que havia 10/10 utilizadas: `false`, preservando a regra de limite;
- nenhum histórico de buscas foi apagado ou reiniciado.

Os testes de SQL foram feitos com `ROLLBACK`, sem consumir buscas reais nem alterar o sinalizador por conta dos testes.

## O que NÃO foi pausado

Permanecem independentes: **créditos do Geoapify**, cotas, faturamento e limites do **Google Places/Google Cloud**, limites dos provedores comunitários, custos de infraestrutura e autenticação de usuário. O Januário Leads pode gerar cobrança pelo Google Places durante a pausa. Evite automações ou pesquisa repetitiva em massa; configure as cotas no Google Cloud para impedir cobranças inesperadas.

Esta pausa é temporária para desenvolvimento pessoal, e **não** é uma configuração adequada para abrir o SaaS a usuários públicos sem uma política de abuso/custos.
