# Buscar via Maps — modo pessoal (JanuárioLeads)

## Objetivo
Recuperar o visual escuro/vermelho inspirado na CodeMakers com **Google Maps JavaScript real**, pins numerados nas coordenadas devolvidas pelas fontes, lista de resultados e botão **Adicionar lead** que grava na carteira original. Esta versão é pessoal, **não usa SaaS/planos/créditos**.

## Fluxo do Workspace
- Menu lateral **Buscar via Maps**, imediatamente abaixo de **Buscar Leads**, disponível somente para a conta original.
- Pesquisar por nicho da lista, UF, município do IBGE e bairro opcional.
- Escolher **Automática (Geoapify → Google)**, **Google Places** ou **Geoapify/OSM**.
- Visualizar marcadores numerados sobre o mapa geográfico real, selecionar um negócio, fechar card, usar zoom e salvar no CRM.
- Empresas já identificadas no CRM são indicadas e não recebem novas gravações intencionais.
- Dados de Geoapify/OSM mantêm fonte e atribuição visível. Para Google Places, **usuário digita o nome do lead**, salvando somente nome digitado, cidade/UF digitadas na busca e Place ID; não copiar nome/endereço/telefone/coordenadas do conteúdo Google para o CRM.

## Chaves e custos (não colocar no GitHub)
**Google Maps JavaScript**: clique **Ativar mapa Google** e forneça **somente uma chave pública de navegador**, previamente restrita no Google Cloud aos exatos domínios de prévia da Lovable e à **Maps JavaScript API**. O valor fica nas preferências deste navegador e da conta; não é o `GOOGLE_PLACES_API_KEY` do backend. Alternativamente, configurar `VITE_GOOGLE_MAPS_BROWSER_KEY` no ambiente de build da Lovable. O mapa real precisa de faturamento/APIs habilitadas; caso falhe, a lista continua utilizável.

**Google Places**: segue o endpoint **`search-places` existente no Supabase original**, protegido por sessão, `private_access` e controles de custos atuais. Nada de automação ilimitada ou segundo projeto para diluir uso.

**Geoapify**: precisa da chave privada `GEOAPIFY_API_KEY` em **Supabase original → Edge Functions → Secrets**. A função `geoapify-personal` usa a chave somente no servidor; nunca incluí-la no navegador. Se não estiver configurada, o modo automático pode usar o Google; o modo explícito Geoapify informará o bloqueio.

A função mantém limite atômico **10 pesquisas Geoapify/dia por conta original**, em fuso America/Sao_Paulo. Cada pesquisa Geoapify envolve geocodificação e Places (até 25 estabelecimentos) e **pode gerar cobrança no provedor**, mesmo em uso pessoal. Ao retornar nenhum resultado na escolha automática, um fallback Google pode consumir quota/custo Google separado. Quota não concede uso gratuito ilimitado.

## Supabase e segurança
Migração versionada `20261109210000_personal_geoapify_safe_budget.sql` adiciona apenas `personal_maps_daily_usage` com RLS e função `claim_personal_geoapify_search()` que verifica `auth.uid()`. Nenhuma alteração na tabela `leads`, mensagens ou follow-ups. A Edge Function exige JWT, confirma conta e `private_access`, valida município/UF e grupo de nicho antes de qualquer chamada externa, respeita CORS da Lovable, devolve dados mínimos e atribuição.

## Validação
- Segurança/cotas: migração aplicada e inspecionada em staging e original; `anon` sem acesso de execução, execução sem contexto de autenticação não debita busca.
- Contrato UI/rotas: checagens estáticas da navegação, do Google Maps JS real e da integração com o callback de inclusão de leads.
- Ainda **é necessária validação no navegador** com login e chaves de API válidas; o acesso ao Google Cloud não foi configurado pelo assistente.
- Sem deploy pela Vercel e sem prompts pagos à IA da Lovable.

## Cuidados futuros
Não transformar esta implementação em SaaS multicliente sem novo projeto de autorização, auditoria de RLS, orçamento e termos do Google Maps Platform / Geoapify. Considere se o resultado de uma busca Google pode ser mostrado em lista sem mapa carregado: mantenha as exigências de logomarca/atribuição de Google, quando aplicáveis.
