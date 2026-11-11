# Buscar Leads unificado — Lista, Mapa e Busca avançada
Data: 11/11/2026

## Objetivo
Evitar duas entradas no menu para tarefas de prospecção equivalentes, mantendo
**uma área "Buscar Leads"** para consultar empresas por nicho, cidade e UF.

## Alterações
1. Menu lateral e móvel: removido somente o **item de navegação** "Buscar via Maps".
   O tipo de view `maps` foi preservado como compatibilidade legada; chamadas antigas
   chegam a `Buscar Leads` com a visualização Mapa selecionada.
   As preferências de página inicial já aceitam somente o valor `search`
   (não havia opção `maps` nessa configuração).
2. Página Buscar Leads (conta proprietária original):
   - **Lista** (padrão): pesquisa híbrida Geoapify → Google Places com resultados
     apresentados em lista ampla, detalhes selecionados e botão de salvar no CRM.
   - **Mapa**: **a mesma pesquisa híbrida** e os mesmos resultados do estado React,
     mostrados no MapLibre/OpenFreeMap para dados Geoapify/OSM; se o provedor for
     Google, usa o Google Maps quando há SDK/chave de navegador ou uma lista
     sem mapa, com atribuição Google. Nunca posiciona Google Places no mapa OSM.
   - **Busca avançada**: mantém a antiga experiência de Buscar Leads (filtros
     inteligentes, seleção de nichos, avaliação/chance, pesquisas paginadas,
     presença digital, enriquecimento e ações de CRM), sem remover funcionalidade.
     É uma pesquisa diferente, com cache/sessão próprios e essa diferença é
     indicada ao usuário.
3. O componente `MapsPersonalView` ganhou `displayMode="list"|"map"` e
   `embedded`. **Trocar Lista/Mapa não chama APIs nem altera a consulta**:
   modifica apenas os elementos renderizados e preserva `geoResults`,
   `googleResults`, `selection` e os dados da busca atual.
4. O painel sem mapa dá acesso aos detalhes, atribuição da fonte, link
   externo e ação de adicionar ao CRM. O Google Place ID continua sendo o único
   identificador persistente do provedor; não se grava dados transitórios
   do Google indevidamente.
5. Em contas diferentes da conta proprietária original, o aplicativo **não
   habilita o Busca via Maps pessoal**: mantém a tela de Busca avançada existente,
   até que permissões, planos, limites e cobrança do futuro SaaS sejam implementados.

## Não alterado
- Credenciais Geoapify e Google (somente na infraestrutura Supabase), funções
  Edge, planos de consulta, limites externos dos provedores e regras de CRM.
- A **pausa temporária de 10 buscas/dia** continua guardada e reversível no
  banco pela migração e documento
  `docs/pausa-limite-buscar-via-maps-2026-11-11.md`.
- Nenhuma dependência da Vercel.
- Nenhuma requisição de busca externa é realizada na abertura da página
  ou na mudança do modo de visualização.

## Checklist de homologação
- [ ] Abrir Buscar Leads como conta proprietária e verificar abas Lista,
      Mapa e Busca avançada, no desktop e no celular.
- [ ] Pesquisar por um nicho/cidade/UF em Lista; confirmar resultados e fonte.
- [ ] Clicar em Mapa sem repetir busca; confirmar preservação dos resultados,
      da seleção e ausência de nova chamada Edge Function.
- [ ] Testar Geoapify/OSM exibindo marcadores no OpenFreeMap.
- [ ] Testar resposta Google com chave browser ausente: exibir painel sem
      mapa e atribuição Google, sem OpenFreeMap simultâneo.
- [ ] Testar adicionar ao CRM e prevenção de duplicação nos dois modos.
- [ ] Confirmar que Busca avançada continua com filtros e pesquisa independentes.
- [ ] Testar uma conta não proprietária: a tela antiga permanece, sem desbloquear
      permissões pessoais.
- [ ] Testar navegação legada `navigateTo("maps")`: redirecionar para Buscar Leads/Mapa.

A revisão estática é possível pelo GitHub, mas os testes reais de navegador e
compilação integral dependem de runner/ambiente disponível. Não declarar
homologação em produção sem passar o checklist.
