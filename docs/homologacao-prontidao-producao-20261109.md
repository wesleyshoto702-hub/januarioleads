# JanuárioLeads — Preparação de homologação e produção
**Atualização:** 09/11/2026  
**Escopo:** somente branch `feature/maps-one-click-auto-staging-20261108`, PR #94 (draft) e Supabase Staging `prlrxjothrslhswpkoza`.  
**Não realizado:** deploy Vercel, merge na `main`, migrações em produção, integração de pagamentos.

## 1. Implementações verificadas
- Free: **3 pesquisas/dia**, 5 créditos diários; sem Buscar via Maps.
- Pro: **R$ 19,90/mês**, 25 créditos/dia; acesso ao Maps.
- Advanced: **R$ 29,90/mês**, 70 créditos/dia; acesso ao Maps.
- Busca tradicional consome 1 crédito/lead; Maps, 2 créditos/lead, com deduplicação por ID e aliases verificados da mesma data.
- Proteção do CRM contra mesmo Place ID duplicado por usuário (índice único no staging); tratamento de conflitos entre abas.
- Correspondência conservadora entre Google e Geoapify, sem confundir filiais distantes, endereços compartilhados ou candidatos ambíguos.
- Índices para as cinco chaves estrangeiras de enriquecimento indicadas pelo Supabase Advisor.
- Funções de staging `search-places` v13 e `geoapify-places` v15, ambas com JWT obrigatório.
- Busca Google em staging continua visível durante a sessão, mas não grava resultados em cache de busca no navegador nem na tabela persistente `places_search_cache`. Antigos caches de resultados são limpos ao acessar os fluxos correspondentes.
- Google → CRM em staging: somente Place ID e **nome digitado pelo usuário**; não gravar automaticamente endereço, telefone, website, descrição, localização, categorias ou avaliações do Places. A origem Geoapify/OSM conserva a atribuição.

## 2. Testes executados e aprovados
- SQL transacional `supabase/staging/tests/20261108_cross_provider_credit_aliases.sql`: Google→OSM, OSM→Google, nenhum débito extra no mesmo dia para alias verificado, Pro com 2 créditos, bloqueio Free e testes de repetição, sempre com `ROLLBACK`.
- SQL transacional `supabase/staging/tests/20261108_crm_cross_provider_history.sql`: recuperação de identificadores do CRM em datas anteriores; `ROLLBACK`.
- SQL `supabase/staging/tests/20261109_release_readiness.sql`: catálogo, planos, índices, permissões e ausência de cache/CRM Google legado em staging; aprovado.
- Conferências estáticas das integrações e proteção de conteúdo Google realizadas sem erro.
- Advisors após índices: nenhum aviso de FK sem índice. Os avisos de índices ainda não utilizados são informativos em base pequena.

**Não há certificado de teste integral:** os testes Deno/Playwright foram adicionados/atualizados, mas **não rodaram integralmente** por limitação atual dos jobs do GitHub Actions, e não houve nova versão visual na Vercel.

## 3. Pendências bloqueadoras antes de produção

### Qualidade e experiência real
- Normalizar CI (franquia GitHub Actions) e executar `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, `npm run test:browser` em ambiente isolado com variáveis de staging.
- Validar a navegação real em desktop e mobile (375px, 768px, 1280px), login, filtros, resultados, cadastro com nome manual, duplicatas, erros 401/403/429, créditos e atribuições.
- Confirmar experiência do módulo Oportunidades após desativar o cache persistente do Google. Dados de provedores não podem ser reintroduzidos em armazenamento por conveniência.
- Verificar custos reais, limites de API, orçamento, credenciais restritas e cotas globais antes de expor para usuários.

### Política de dados e conformidade
- Documentos públicos próprios de **Termos de Uso** e **Política de Privacidade**, com responsável legal e meios de contato reais; não criar dados fictícios. Verificar LGPD.
- Revisão contratual humana dos Termos Google Places: os Place IDs são exceção de armazenamento, mas conteúdo Google não deve ser armazenado/extraído indevidamente. A alteração de Google→CRM no staging reduz o risco; não substitui análise contratual.
- Geoapify e OSM: manter `Powered by Geoapify` quando o plano exigir e `© OpenStreetMap contributors`, esclarecer obrigações ODbL e limites do plano gratuito para operação comercial.
- Revisão e eventual saneamento de dados legados na produção **somente após backup e aprovação expressa**, sem exclusão automática.

### Segurança, operações e backup
- Supabase Advisor ainda sinaliza **Leaked Password Protection Disabled**; habilitar no painel de Auth caso o fluxo de senha continue ativo e o plano permita, depois reexecutar o Advisor.
- Validar provedores OAuth, URLs de retorno, segregação de ambiente, políticas RLS, regras de cookies/sessão e isolamento entre usuários.
- Acesso do CI às dependências/variáveis de staging; nunca publicar credenciais service_role.
- **Backup de produção real não foi criado**. Antes de migração, consultar `Database > Backups` do Supabase, ou realizar exportação lógica segura (Supabase CLI `db dump`) se o plano não fornecer backups automáticos; validar restauração em ambiente isolado. Objetos do Supabase Storage devem ser tratados separadamente.
- Testar reversão: manter feature flag Maps desabilitada em produção até a liberação, reverter deploy de frontend se falhar; conservar migrations de dados e restaurar backup **apenas com plano de recuperação aprovado**.
- Evitar executar `DROP`, `DELETE` ou restaurar snapshot em produção automaticamente.

## 4. Sequência de liberação (não executada)
1. Corrigir bloqueio do CI e rodar testes + revisão de licenciamento/política.
2. Quando a Vercel estiver disponível e o usuário autorizar, gerar preview do commit atualizado; validar com conta de teste e limites sem custo inesperado.
3. Validar backup restaurável e plano de rollback de produção.
4. Revisar a cadeia de branches/PRs e promover somente mudanças aprovadas, preservando o banco em produção até autorização.
5. Publicar frontend, aplicar migrações e Edge Functions na ordem validada, testar o domínio oficial, monitorar custos e erros.
6. Pagamentos permanecem **adiados**.

## 5. Fontes oficiais
- Google Places: https://developers.google.com/maps/documentation/places/web-service/policies
- Geoapify: https://www.geoapify.com/terms-and-conditions/
- OSM: https://www.openstreetmap.org/copyright
- Supabase backups: https://supabase.com/docs/guides/platform/backups
- Supabase Auth password security: https://supabase.com/docs/guides/auth/password-security

**Go/No-Go:** NO-GO para produção enquanto CI/E2E, políticas de dados, backup restaurável e testes reais não estiverem aprovados.
