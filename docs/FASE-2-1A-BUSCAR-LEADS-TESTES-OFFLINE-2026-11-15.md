# Januário Leads — Fase 2.1a: Buscar Leads com fontes simuladas (offline)

**Data-base:** 15/11/2026. **Repositório:** `wesleyshoto702-hub/januarioleads`.  
**Escopo:** testes offline com empresas e sessão sintéticas; refatoração pequena do frontend para testar as **mesmas funções que a UI usa**; nenhum dado pessoal ou URL de API real.

**Segurança:** Fase 0 ADIADA, **NÃO concluída**. Chave `service_role` de STAGING anteriormente exposta, sem comprovação de revogação; backup/restore de produção pendentes. Esta PR **não foi publicada** no Supabase, Lovable nem Vercel; não executou Colab, não fez consulta paga, não escreveu empresas e não abriu sessão real. Teste automatizado não é teste E2E em navegador conectado a homologação.

## 1. O que foi auditado

Foram inspecionados componentes e funções reais:
- `SearchLeadsView.tsx`: fluxo usuário seleciona **UF → município oficial → nicho**, chama `searchBusinesses`, controla busca nova vs próxima página, ignora resposta atrasada por `searchRequestIdRef`, mantém resultados já carregados quando muda filtro, apresenta erros e salva apenas dados de fontes abertas na sessão.
- `search-businesses.ts` e função remota `search-places`: a UI exige sessão e envia autorização por Bearer e chave publicável. A função de backend segue não publicada com as correções Fase 1.3/1.5; apenas leitura do código, sem execução autenticada.
- `overture-search.ts`: categoria exata, UF/cidade, janela limitada de 250 candidatos por busca, ordenação determinística do conjunto inicial, resultados em páginas de 20 até 100 visíveis, sem inventar nichos ou horários.
- `identity.ts`: vinculação com CRM por `placeId` ou mesmo nome+endereço conhecido na mesma localização, não por telefone compartilhado.
- `search-result-filters.ts`: filtros de telefone/e-mail, formato WhatsApp, site conhecido/desconhecido, Instagram confirmado, estágio do lead e pontuação de oportunidade.
- `search-page-merge.ts`: evita duplicar `placeId` entre páginas e preserva confirmação anterior do Instagram quando chega dado posterior menos confiável.

## 2. Correções preparadas e sua justificativa

### 2.1 HTTP de busca confiável e testável

Criado `search-businesses-http.ts` com **injeção de `fetch`**. A função real `searchBusinesses` obtém token de sessão e delega a esse módulo. Foram cobertos:
- 401 e sessão ausente → `AUTH_REQUIRED`; sem sessão, **nenhuma chamada**;
- 403 `FORBIDDEN`, 429 `QUOTA`, 503, erro de rede e JSON inválido → falha controlada;
- HTTP 5xx com payload `{ok:true}` **não** vira sucesso falso;
- payload com `ok`, campos básicos de resultado ou token inválidos → erro, não sucesso;
- usa `POST`, Bearer da sessão fornecida pela camada de auth e **somente chave publicável**, sem `service_role`.

**Limitação:** o teste simula o transporte HTTP; não valida que as credenciais reais ou RLS funcionam, nem a versão remota publicada.

### 2.2 Filtros reais extraídos para módulo puro

A lógica que a UI já utilizava foi movida para `search-result-filters.ts` e **a UI agora importa exatamente esse módulo**, evitando teste de uma cópia divergente do código. Verifica:
- `Com telefone` e `Com WhatsApp` (número com tamanho/prefixo compatível, **não prova WhatsApp ativo**);
- `Com e-mail` (sintaxe básica, **não prova entrega**);
- `Com site` / `Sem site` (site identificado/ausente na fonte, **não comprova inexistência**);
- `Com Instagram`: **somente confiança alta** ou Instagram previamente confirmado manualmente no CRM, sem promover automaticamente links `medium`, sem confiança, ou `needsReview`;
- `novos`, `aguardando`, `chance alta` e modo `Abertos Agora`: apenas sobre os resultados já carregados, sem outra consulta externa. Um status de funcionamento desconhecido **não** é considerado aberto.

**Pendência para a etapa 2.3:** revisar o texto visível **“Com WhatsApp”**, pois o que temos é apenas número com formato compatível, não confirmação do aplicativo. Rever também “Sem site”, contadores locais vs universo da cidade e nuances de Instagram na interface. Não introduzir promessa de validação sem prova.

### 2.3 Paginação e deduplicação entre páginas

`mergeSearchPageResults` agora é função pura chamada na UI, mantendo o resultado mais recente para cada ID e preservando um Instagram previamente confirmado em página anterior. Ensaio completo com **43 empresas fictícias**, páginas **20 + 20 + 3**, IDs distintos, mesma cidade/UF/nicho e consulta simulada exclusivamente à tabela Overture. Sem chamadas reais a Overture, Geoapify ou Google.

Os tokens de continuação são testados (`overture:20`, `overture:40` e `null` na última), além de `state=eq.MG`, `city_key=eq.lavras`, categoria `barber`, `order=id.asc`, `limit=250`.

**Limitação:** simula o leitor Overture e contrato HTTP. Não valida a deduplicação efetiva após o fallback multimodal da Edge Function real nem integra automaticamente React, Auth e CRM persistido.

### 2.4 Corrigida marcação indevida de lead existente no CRM

Foi identificado que `findBusinessDuplicate` reconhecia **dois negócios diferentes da mesma cidade como o mesmo lead só porque partilhavam número de telefone**. Essa situação ocorre quando redes ou negócios usam central telefônica. A regra preparada exige:
- mesmo `placeId` original; **ou**
- mesmo nome e endereço conhecido equivalente, sem municípios/UFs conhecidos diferentes.

Telefone por si só não determina identidade. Também foi corrigida a normalização de endereço com pontuação — `Rua A, 25` e `Rua A 25` devem ser comparáveis — sem unir `Rua A 25` a `Rua A 27`.

**Trade-off intencional:** algumas duplicatas reais sem endereço podem deixar de ser reconhecidas, mas isso é preferível a impedir que filiais legítimas sejam salvas. Testar persistência real e proteção contra repetição no servidor depois da Fase 0.

## 3. Evidência automatizada e decisões

| Componente | Cenários | Evidência |
|---|---|---|
| Busca mockada com Overture | 43 dados fictícios, 3 páginas, origem, cidade, nicho, token | Deno teste de fluxo |
| Autenticação e HTTP | Ausência de token, 401, 403, 429, 503, rede, JSON inválido | Deno teste de fluxo |
| Filtros da UI | Telefone, e-mail, site, WhatsApp-formatado, Instagram, estágio, chance | Deno teste de fluxo |
| CRM + páginas | Telefone compartilhado, filiais diferentes, nome/endereço, confirmação Instagram | Deno teste de fluxo |
| Compatibilidade anterior | Deduplicação e relevância Overture da Fase 1.5, mapeamento, paginação | Deno regressões |
| UI ligada às regras | A UI importa o módulo de filtros e paginação; preserva guardas de busca | Python contrato estático |

Comando reproduzível, sem segredos, para GitHub Actions:
```bash
deno test tests/fase2_1a_buscar_leads_offline.test.ts
deno check tests/fase2_1a_buscar_leads_offline.test.ts
deno test tests/overture-staging-search-pilot.test.ts tests/fase1_5_conservative_dedup_offline.test.ts
python -m unittest discover -s tests -p test_fase2_1a_search_contract_offline.py -v
```

Workflow: `.github/workflows/fase2-1a-buscar-leads-offline.yml`. **Não usa rede, chave, usuário real ou banco**. Requisitos para marcar esta etapa como concluída: workflow verde e TypeScript do build sem novas falhas atribuíveis a esta PR.

## 4. O que NÃO foi validado

- Login Google, RLS, JWT/segredos efetivos, quotas e provider fallback da Edge Function REAL.
- Interface renderizada/experiência responsiva em navegador com dados reais, sessionStorage, conexão Supabase ou persistência de CRM.
- Origem e validade dos números, telefone WhatsApp confirmado, site ativo, Instagram oficial ou existência das empresas.
- Migração de dados Overture para produção, preço, limites comerciais, pagamento e LGPD.
- Qualquer alteração nos 321.179 registros de Overture, nos 212 leads de produção ou nas assinaturas.

**Próxima ação segura após aprovação:** **Fase 2.2a — ampliar os ensaios offline para tokens inválidos, estados vazios, concorrência de respostas, cache e limites de resultados**, com testes de estado/UX estáticos ou browser completamente simulado. **2.1b — teste autenticado real — continua bloqueado pela Fase 0.**

**IMPORTANTE:** não considerar toda a Fase 2 concluída até que sejam testados UI, banco, fontes, custos e CRM com conta autorizada, com a chave exposta revogada, backup/restauração comprovados e rollback. Os testes offline não substituem isso.
