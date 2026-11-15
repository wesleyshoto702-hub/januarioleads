# Buscar Leads — piloto Overture somente em homologação (15/11/2026)

## Decisão
**Integração interna na homologação: sim. Publicação na produção: ainda não.**

O frontend chama a função autenticada `search-places`, que **já consulta o Overture primeiro** via `overture-search.ts` na homologação. A tabela `public.overture_places` está na homologação `prlrxjothrslhswpkoza` com RLS ativada, **sem privilégio SELECT para anon/authenticated**, e acessível apenas ao serviço autenticado no backend; `verify_jwt=true` na Edge Function. Na produção `czkazbianiflhldenhcj`, a tabela `overture_places` ainda não existe.

Não ativar em produção nem replicar diretamente as 321 mil linhas sem auditoria de retenção, origem, qualidade, segurança e custos.

## Leitura de referência
Consulta somente leitura, em 15/11/2026: **321.179 registros totais**, **264.030 preliminarmente úteis** (contagem da RPC `overture_phase9_v5_status`). Esta contagem NÃO corresponde a 264 mil resultados para cada nicho ou município.

## Piloto de 12 buscas (11 municípios, nichos distintos)
Resultados aproximados encontrados no banco, antes de eventuais filtros adicionais na Edge Function:

| UF | Município | Nicho | Registros |
|---|---|---|---:|
| MG | Lavras | Barbearia | 0 |
| MG | Varginha | Clínica Odontológica | 2 |
| SP | São Paulo | Academia | 4 |
| SP | Campinas | Barbearia | 3 |
| RJ | Rio de Janeiro | Restaurante | 10 |
| DF | Brasília | Clínica Odontológica | 8 |
| PR | Curitiba | Hotel | 7 |
| BA | Salvador | Salão de Beleza | 6 |
| CE | Fortaleza | Farmácia | 3 |
| AM | Manaus | Mercado | 2 |
| RS | Porto Alegre | Estética Automotiva | 4 |
| SP | Campinas | Padaria | 2 |

**Atenção:** Estes são resultados de SQL por categorias exatas, não uma prova de busca autenticada pelo site. A correspondência fina pode reduzir a contagem. Os contatos presentes não foram confirmados externamente. A amostra intencionalmente inclui o caso zero em Lavras; não representa a distribuição inteira da base.

Reprodução: `scripts/overture_buscar_leads_piloto_readonly.sql` (somente homologação).

## Problema de qualidade encontrado e corrigido
A rotina antiga considerava como duplicados todos os negócios que tinham o mesmo nome, mesma cidade e endereço ausente, mesmo com coordenadas muito distantes.

Auditoria somente leitura: **511 grupos** de nome repetido e endereço ausente (1.028 registros), dos quais **507 grupos** têm mais de uma coordenada distinta. Não significa que todos são estabelecimentos legítimos distintos; demonstra que o critério antigo descarta candidatos sem verificar localização.

A correção no leitor evita descartar estabelecimentos distantes com o mesmo nome. Para registros com coordenadas válidas, só considera duplicados dentro de 15 metros; quando faltam coordenadas, exige **mesmo endereço conhecido**. Bounded payload de 250 candidatos com ordem por ID; a página visível continua com 20 e máximo de 100 em páginas limitadas.

## Checklist para liberação
1. 12 cenários devem retornar dados coerentes, sem falsos positivos por categoria; naqueles com menos de 8 candidatos, mostrar cobertura insuficiente em vez de prometer listas completas.
2. Testar busca autenticada na UI do ambiente de homologação, incluindo 20 resultados por página, filtros de contato/site/Instagram e deduplicação com CRM.
3. Confirmar domínio/URL do app de homologação, JWT e limites de quotas. Não ativar **Geoapify/Google Places** só para passar nos testes.
4. Garantir custo autorizado de **R$ 0**: se não houver aprovação de orçamento, todas as chamadas de provedores externos precisam ficar bloqueadas (fail-closed). Consultas Overture usam a base já importada.
5. Decidir mecanismo versionado e seguro para publicar apenas dados aprovados em produção e atualização incremental, sem depender da Colab diretamente em produção.
6. Medir cobertura de nichos: 216 nichos no catálogo, 125 com correspondência Overture explícita na auditoria. Os demais devem receber correspondências específicas validadas, nunca categorias genéricas.
7. Não apagar registros antigos ou alterar o pipeline Fase 9 da Colab.

## Testes do projeto
- `tests/overture-staging-search-pilot.test.ts`: somente dados fictícios, autenticação sem bypass, relevância por categoria, deduplicação geográfica, paginação, retorno seguro.
- CI em `.github/workflows/validar-overture-piloto-staging.yml`.
- Verificação de permissões do PostgreSQL realizada em homologação, sem conceder novos privilégios.

Nenhuma alteração de dados empresariais foi realizada neste piloto, e nenhuma consulta externa foi executada.
