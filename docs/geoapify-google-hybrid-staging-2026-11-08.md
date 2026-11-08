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


## Teste real da API realizado em 08/11/2026

O usuário confirmou `GEOAPIFY_API_KEY` e `GEOAPIFY_HYBRID_ENABLED=true` no Supabase de staging. Foi executado **um teste real, no servidor**, com requisição fixa `Barbearia em Lavras, MG`, sem copiar a chave, sem chamar o Google e sem importar contatos.

**Resultado medido:**
- Geoapify Geocoding API: HTTP 200, cidade `Lavras / MG` encontrada e ID de cidade compatível.
- Geoapify Places API: HTTP 200 para `service.beauty.hairdresser` com `filter=place:<id>`, mas **zero estabelecimentos retornados pelo normalizador**.
- Tabelas de proteção confirmam exatamente **1 crédito reservado de geocoding e 1 de Places** para o dia 08/11/2026. Limites de staging permanecem 5/dia por operação, 100/mês por operação, 4 requests/s.
- Não houve consulta a Google Places, importação ao CRM ou alteração em produção.
- A função temporária `geoapify-credential-smoke` foi desativada (HTTP 410) após o teste; a extensão transitória `pg_net` foi removida após uso.

**Conclusão:** a chave e a conectividade dos dois endpoints estão válidas. A **utilidade da busca de empresas ainda não está homologada**: é necessário separar `features` brutas de dados filtrados pelo normalizador e comparar filtro por cidade com raio geográfico usando uma conta autenticada de staging. Os valores 200 não implicam presença de empresas em Lavras. Não liberar Geoapify na interface da Lovable antes da correção/validação da cobertura.

A tentativa de implantar uma segunda variante de diagnóstico foi bloqueada; não houve mais chamadas à API nessa etapa.


## Investigação e correção da busca vazia de barbearias em Lavras — 08/11/2026

**Diagnóstico confirmado com a API real do Geoapify**, usando a chave do Supabase staging, sem expô-la:
- Geocoding localizou Lavras/MG corretamente em aproximadamente `lat=-21.2425512`, `lon=-44.9991978`.
- `categories=service.beauty.hairdresser&filter=place:<cidade>`: HTTP 200, **0 features brutas**.
- Mesma categoria com `filter=circle:<lon>,<lat>,10000`: HTTP 200, **0 features brutas**.
- `categories=service.beauty` com raio de 10km: HTTP 200, **2 features válidas**, porém não eram barbearias (esmalteria e outro negócio de beleza).
- `categories=commercial,service.beauty&name=Barbearia` com raio de 10km: HTTP 200, **0 features**.
- O normalizador não estava descartando barbearias válidas nesse teste: **o próprio Geoapify devolveu zero registros brutos** para a categoria específica e busca pelo nome. Isso é uma lacuna da cobertura OSM/Geoapify para essa categoria/localidade, não falha de autenticação, filtro inválido ou serialização.

**Correção implementada em código do PR #91 e implantada somente no Supabase staging:**
1. Geocoder valida cidade + estado + país e extrai coordenadas do mesmo resultado, sem assumir localização por nome.
2. Se o filtro por fronteira da cidade retornar zero features, o backend tenta **somente mais uma vez** com a **mesma categoria** em um raio máximo de 10km, reservando crédito próprio do Geoapify e slot global de 4 requisições/s. Não amplia categoria para apresentar estabelecimentos irrelevantes.
3. Quando os dois recortes retornam zero, o backend entrega `places: []` e `coverage.status=no_osm_category_matches`, mais uma mensagem transparente e sugestão de usar o Google Places **apenas mediante ação explícita do usuário**. Não há fallback automático para o Google nem dupla cobrança entre provedores.
4. Quando o limite do fornecedor bloqueia a segunda consulta ou a consulta falha, devolve `coverage.status=unconfirmed_nearby`, sem afirmar incorretamente que a região não tem negócios.
5. Se o fornecedor retornar `features` não vazias mas o normalizador não conseguir interpretar nenhum registro, responde erro de formato (502), em vez de exibir silenciosamente zero empresas.
6. Normalizador tem fallback para coordenadas das propriedades e conserva a cidade/UF informadas pelo fornecedor em resultados próximos.

**Consumo medido após diagnóstico:** 2 chamadas de geocodificação e 5 chamadas de Places reservadas em 08/11/2026, exatamente o teto diário piloto de Places (5/dia). Mais testes reais dependem da renovação da quota de staging à meia-noite de Brasília; não elevar o limite somente para forçar um resultado.

**Segurança/limpeza:** funções temporárias de diagnóstico foram substituídas por respostas HTTP 410; extensão `pg_net` temporária removida; Google Places e produção não modificados. Testes unitários adicionados no GitHub, mas sua execução automatizada permanece pendente de CI. A implantação do endpoint revisado no staging não muda Lovable/Vercel até integração de frontend.

**Implicação de produto:** Geoapify/OSM pode não ter determinadas categorias em cidades brasileiras. Para entregar barbearias de Lavras, pode ser necessário oferecer busca independente no Google Places, observando limites, custos, atribuição e termos de uso. Não atribuir ao Geoapify negócios que ele não retornou.
