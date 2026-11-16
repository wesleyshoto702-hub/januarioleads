# Januário Leads — Fase 2.3a: filtros e contadores honestos do Buscar Leads

**Data-base:** 15/11/2026 | **Repositório:** `wesleyshoto702-hub/januarioleads` | **Execução:** mudanças no GitHub, CI com dados fictícios e sem acesso a contas reais.

**Bloqueio preservado:** a Fase 0 segue adiada/não resolvida (revogação comprovada de uma chave `service_role` de homologação anteriormente exposta e backup/restauração de produção pendentes). **Sem deploy de Edge Functions/frontend, alterações no Supabase, migração, Colab, provedores pagos ou dados de clientes**. Código na `main` não significa que esteja disponível ao usuário final.

## 1. Problemas identificados

- O filtro **`Com telefone`** exigia o mesmo teste de **formato WhatsApp** do filtro `Com WhatsApp`, embora não tenham o mesmo significado. Um telefone listado, mas com número malformado, não aparecia em `Com telefone`.
- Os rótulos `Sem site` e `Sem Instagram` poderiam levar o usuário a entender **inexistência comprovada**, quando a base só informa **site não identificado** e **perfil Instagram não confirmado**. Perfis candidatos podem existir, mesmo que o filtro de confirmação não os inclua.
- A UI já calculava contagens apenas sobre os registros carregados; contudo, o cabeçalho dizia **"empresas encontradas"**, sem evidenciar que podem existir outras páginas e empresas na mesma cidade. Os números nos seis atalhos também não declaravam explicitamente o escopo.
- `BusinessDetailsModal` considerava equivocadamente `instagramConfidence: null` diferente de `medium`/`low` como Instagram "confirmado". A pontuação `calculateLeadChance` também adicionava pontos para perfis com confiança ausente, inclusive quando havia revisão pendente.

## 2. Correções preparadas

Os **oito filtros** continuam selecionando a mesma categoria de dados, com um ajuste intencional na semântica do telefone. Labels e tooltips agora vivem em `src/features/search-leads/search-filter-presentation.ts`; a tela importa diretamente esses valores, sem duplicação de regras.

| Filtro | O que realmente significa |
|---|---|
| **Todos** | Todos os resultados já carregados da pesquisa atual |
| **Telefone informado** | Campo de telefone preenchido, sem comprovar telefone ativo |
| **E-mail com formato válido** | Sintaxe básica compatível, não entrega nem titularidade verificadas |
| **Número compatível com WhatsApp** | Formato de número brasileiro compatível, **não** prova conta ativa |
| **Site identificado** | URL listada pela fonte; site pode estar indisponível ou não pertencer à empresa |
| **Site não identificado** | Sem URL no registro consultado; **não** significa que a empresa não tenha site |
| **Instagram com alta confiança** | Perfil marcado com confiança alta e sem revisão pendente; **não** significa titularidade oficial comprovada |
| **Instagram não confirmado** | Inclui perfis candidatos, não pesquisados ou sem confiança alta; **não** prova ausência |

**Importante:** `Telefone informado` deixa de filtrar por validade do formato; o filtro de formato permanece isolado em `Número compatível com WhatsApp`. Exibir telefone não significa autorização para contatar nem consentimento de mensagens em massa.

Os seis atalhos de prospecção também têm textos e explicações compatíveis com os critérios, sem prometer WhatsApp ativo, site inexistente, Instagram oficial ou probabilidade real de fechar uma venda.

## 3. Contadores agora explicitamente locais

A tela de resultados agora informa:
- **X resultados carregados** na pesquisa; **Y ainda não salvos** e **Z já nos leads**, contados apenas entre os X.
- **"Exibindo A de X resultados carregados"**, ou seja, A considera filtros, CRM e modo de visualização; nunca representa o total de empresas do município.
- **"Contagens referentes somente aos resultados carregados nesta pesquisa, não ao total de empresas da cidade"**; se existe `nextPageToken`, a tela avisa que há mais páginas.
- Cada contador dos atalhos é calculado sobre **o mesmo conjunto de resultados já carregados**, e respeita o modo `Abertos Agora` quando selecionado. Um horário desconhecido continua excluído de `Abertos Agora`, sem supor fechamento.

Essas regras são implementadas em `search-loaded-counts.ts`, importado diretamente por `SearchLeadsView.tsx`. A paginação e a seleção original dos 216 nichos não foram alteradas.

## 4. Instagram e score: consistência entre ficha, filtro e priorização

- A ficha detalhada agora reutiliza `hasConfirmedInstagram`, a **mesma** condição da busca: `instagramConfidence === "high"` e `!instagramNeedsReview`.
- Quando a ficha não tem confiança alta, ela **não** exibe o perfil como confirmado; candidatos continuam sujeitos a conferência.
- `calculateLeadChance` deixa de atribuir pontos de Instagram para confiança `null` / `medium` / `low` ou quando o perfil está marcado para revisão. O score continua **heurístico**, não probabilidade de conversão.
- O botão que abre o WhatsApp avisa que a existência da conta não foi verificada.
- O texto "Instagram com alta confiança" **não é uma certificação oficial do Instagram**, nem verificação de titularidade feita pelo Januário Leads. Para perfis realmente verificados por revisão humana/procedimento formal, uma etapa própria seria necessária.

## 5. Testes e limites de validação

- `tests/fase2_3a_filtros_contadores_offline.test.ts`: 7 cenários com empresas fictícias: oito labels e ressalvas, telefone vs formato WhatsApp, sintaxe de e-mail, site identificado/ausente, Instagram candidato/confiável/sob revisão, score sem certeza, contagens locais (novos, salvos, abertos, filtrados), atalhos por modo.
- `tests/test_fase2_3a_filter_presentation_offline.py`: garante que **a tela real usa os módulos testados** e não os dados de outra implementação; que a ficha e a pontuação compartilham a regra do Instagram; e que não há segredos nos helpers puros.
- Workflow `.github/workflows/fase2-3a-search-filter-semantics-offline.yml`: Deno + verificação TypeScript + regressões 2.1a e 2.2a + contrato de interface Python. O build SaaS tem workflow separado.

**Critério de aceite 2.3a:** CI específico verde, regressões 2.1a/2.2a preservadas e build TypeScript aprovado. Mesmo com CI verde, **não** equivale a teste real com navegador, usuário autenticado, RLS, API paga, ou publicação no Supabase.

## 6. O que permanece pendente

- [x] Código e testes offline para significado correto dos filtros, classificação do Instagram e contadores apenas do que já foi carregado — **concluído quando CI verde**.
- [ ] **2.3b:** validar acessibilidade, tamanho dos rótulos no celular, fidelidade dos contadores em sessão autenticada, retorno de APIs, privacidade/identidade de Instagram e CRM — **bloqueada pela Fase 0**.
- [ ] Rever outros componentes do SaaS que exibem informações de contatos fora de `Buscar Leads`; não fazer alteração em massa de UI sem auditar dados e escopo.
- [ ] Resolver falha histórica do teste de navegador HttpOnly e divergência no auditor de migrações antes de publicar beta.
- [ ] Revogar comprovadamente a chave de homologação exposta, concluir backup e ensaio real de restauração de produção.

**Próxima ação segura no Plano Mestre:** **Fase 2.4a — observabilidade e orçamento de chamadas em testes simulados**, criando baseline de latência p50/p95 e contagem de chamadas de leitura com mocks/CI, **sem** afirmar números de performance reais ou fazer novas consultas de fornecedores. Publicação e medição reais continuam dependentes da Fase 0.
