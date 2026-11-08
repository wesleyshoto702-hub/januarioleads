# Januário Leads — preparação Geoapify + Google Places (somente STAGING)

**Data:** 08/11/2026  
**Base Git:** `feature/free-three-searches-staging-20261107`; depende do PR #89.  
**Supabase staging:** `prlrxjothrslhswpkoza`.  
**Produção:** nenhuma alteração.

## Provedores com responsabilidades diferentes

| Fonte | Função planejada | Comportamento desta entrega |
| --- | --- | --- |
| Geoapify | Descoberta de estabelecimentos por nicho + cidade/região, com atribuição OSM | Endpoint isolado `geoapify-places`, implantado **desativado** em staging, sem chave e sem chamadas externas |
| Google Places | Busca já existente e consultas específicas permitidas/licenciadas, sujeitas às cotas anteriores | Endpoint `search-places` preservado, sem alterações de rota nem credenciais |

**NÃO** chamar ambas em cada clique. Sem fallback automático entre provedores. A futura interface deverá indicar proveniência e obter somente os dados necessários de cada fonte.

## Implementado

- `supabase/functions/geoapify-places/index.ts`: exige JWT, chave pública legítima, `private_access`, CORS existente e esquema limitado, sem suporte a busca ilimitada.
- `supabase/functions/_shared/geoapify-adapter.ts`: sete nichos com correspondência explícita de categorias (Barbearia, Salão de Beleza, Academia, Restaurante, Cafeteria, Pizzaria, Spa), valida país/UF/cidade e normaliza resultado como `source: geoapify`.
- `src/features/maps-leads/geoapify-client.ts`: cliente preparado para ligação futura **ainda não chamado pela interface**.
- Nova tabela `saas_geoapify_api_limits` (default `enabled=false`): **100 geocodificações/dia, 100 consultas de Places/dia, 2.000/mês por operação, até 15/dia por usuário**. Caps são reservas do sistema, não quotas oficiais.
- Limite agregado **4 requisições por segundo** (abaixo do limite gratuito publicado de 5/s).
- Todas as reservas de crédito e slots usam RPC transacional com `service_role`; clientes `anon/authenticated` sem EXECUTE e sem acesso às tabelas.
- Resultados limitados a **20 empresas/consulta**, sem paginação nem dados de contato, CRM ou auto-importação nesta etapa.
- Regra Free de **3 pesquisas por dia** e gate de Maps do Pro/Advanced respeitados. Esta preparação não concede mais contatos nem altera preços.
- Atribuições Geoapify e OpenStreetMap incluídas na resposta. Antes de mostrar no mapa, devem ser exibidas na interface.
- Failsafe triplo: staging exclusivamente; variável `GEOAPIFY_HYBRID_ENABLED` e `GEOAPIFY_API_KEY`; flags de orçamento `enabled` no banco. Sem qualquer um desses, **não há chamadas externas**.

### Como ativar SOMENTE em staging depois de obter a chave

1. Criar projeto em https://myprojects.geoapify.com/ (Geoapify permite testar o Free sem cartão). **Não enviar chave para o chat nem registrá-la no GitHub.**
2. Configurar `GEOAPIFY_API_KEY` **em Supabase staging → Edge Functions → Secrets**; jamais usar prefixo `VITE_` ou expor no navegador/Vercel.
3. Configurar no mesmo local `GEOAPIFY_HYBRID_ENABLED=true`, somente após revisão dos termos de licenciamento.
4. Após validar orçamento e autenticação no staging, executar no SQL Editor **somente desse projeto**:
   ```sql
   update public.saas_geoapify_api_limits
   set enabled = true, updated_at = now()
   where operation in ('geocode','places');
   ```
5. Fazer busca controlada com conta autorizada para verificar acurácia geográfica, créditos, duplicatas, campos, privacidade, rotulagem e erros. **Não ativar produção ainda.**
6. Só então integrar opt-in à interface `Buscar via Maps` com seleção/routing de fonte, sem buscar Google e Geoapify em paralelo por padrão. Ajustar atribuição, consentimento e regras de CRM.

Para desativar imediatamente:
```sql
update public.saas_geoapify_api_limits
set enabled = false, updated_at = now();
```

### Limitações assumidas

- **Barbearia** cai na categoria OSM `service.beauty.hairdresser`, mais ampla que "barbearia". Verificar nomes/cobertura e evitar prometer que todos os resultados são barbearias.
- O geocoder precisa localizar uma cidade **exata** no estado esperado. A busca tenta `filter=place:<place_id>`; exige teste real com chave antes de prometer cobertura.
- O Geoapify Free comercial requer atribuições Geoapify + fontes OSM conforme licença. Conferir direitos de armazenamento/reutilização antes de gravar dados OSM em CRM.
- Google Places: seguir regras de atribuição, armazenamento/caching restritos e serviços licenciados. Não persistir dados do Google de forma indiscriminada em lista própria de prospecção; Place IDs possuem exceções específicas.
- O endpoint não está conectado ao frontend nem é chamado por busca comum ou Maps; não altera resultado visual de Lovable/Vercel.
- Sem credencial Geoapify fornecida, não foram realizadas consultas reais nem medidos resultados de Lavras/MG. Não existem custos novos nesta preparação.

## Verificações realizadas

- SQL de staging aplicado: budgets + global rate limiter, `enabled=false`.
- Teste transacional no staging: bloqueio desativado, habilitação temporária, contadores por operação, 4/s e 5ª recusada; `ROLLBACK` sem consumo persistido.
- ACL validada: `authenticated` não executa RPCs de orçamento; `service_role` executa.
- Edge Function `geoapify-places` implantada apenas em staging, `verify_jwt=true`, status ACTIVE v2.
- Testes unitários em `geoapify-adapter.test.ts` preparados, **ainda não executados nesta sessão**.
- Teste SQL versionado: `supabase/staging/tests/20261108_geoapify_hybrid_budget_guards.sql`.
- Ainda pendem E2E autenticado, simulação de concorrência, testes de carga e buscas reais com API key. Nenhuma alteração na produção ou integração de frontend ativada.

## Referências oficiais
- https://apidocs.geoapify.com/docs/places/
- https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/
- https://www.geoapify.com/pricing/
- https://developers.google.com/maps/documentation/places/web-service/policies

## Homologação após cadastro da API key — 08/11/2026

O usuário informou ter configurado `GEOAPIFY_API_KEY` em Secrets do Supabase staging. **O valor e a validade da chave não foram acessados ou confirmados pela conexão de ferramentas.**

Para reduzir risco na etapa inicial, os limites **atuais do banco staging** foram ajustados por SQL (não são os defaults da migration):
- geocode: `enabled=true`, até 5/dia no projeto, 100/mês, 5/dia por usuário;
- places: `enabled=true`, até 5/dia no projeto, 100/mês, 5/dia por usuário;
- tráfego total: 4 req/s permanece;
- zero consumos registrados depois do ajuste.

O backend permanece impedido de chamar Geoapify se `GEOAPIFY_HYBRID_ENABLED` não estiver literalmente `true` **ou** a chave não estiver presente; somente staging com JWT + `private_access` pode chegar à rota.

A função `geoapify-places` foi atualizada em staging para v4 com retorno de status (`action: status`) exclusivamente para usuários autenticados autorizados. O status informa `keyConfigured` e `featureFlagEnabled` como booleans, sem retornar material da chave. **Nenhum teste de credencial real contra Geoapify foi executado**, porque a função exige autenticação de uma sessão staging, que as ferramentas da conexão não fornecem.

Próximo passo humano: cadastrar `GEOAPIFY_HYBRID_ENABLED=true` em Edge Functions → Secrets do mesmo projeto staging. Depois validar, com sessão legítima de usuário autorizado, `action: status` e uma única consulta real (por exemplo, Barbearia em Lavras/MG). Conferir os indicadores de consumo e desativar os budgets após a homologação, se apropriado. Não criar esse segredo na produção e não enviar a API key pelo chat.
