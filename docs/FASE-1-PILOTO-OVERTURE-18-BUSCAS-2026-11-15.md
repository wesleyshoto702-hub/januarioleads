# Fase 1.1 — Piloto seguro de 18 pesquisas Overture

**Data:** 15/11/2026 | **Ambiente:** somente homologação (`prlrxjothrslhswpkoza`) | **Execução:** SQL `SELECT` pela integração Supabase; **nenhum dado modificado, nenhum provedor externo consultado**.

## Decisão registrada
A pedido do proprietário, a **Fase 0 está adiada temporariamente**, por estar usando o celular, e **não concluída**. Continuam bloqueados: produção, migrações, backups/restaurações, alterações em credenciais, pagamentos e novas importações com a chave `service_role` exposta. A fase atual de trabalho é **Fase 1**: análise somente de leitura e testes offline. Testes de interface de staging autenticados deverão ser reavaliados antes da execução devido à credencial comprometida.

## Amostra fixa e reproduzível
Categorias correspondem explicitamente ao mapeamento de `supabase/functions/_shared/overture-search.ts`; 18 pares, 14 UFs, incluindo cidade pequena, capitais, casos zero e diferentes nichos.

| UF | Cidade | Nicho | Registros | Telefone com 10–13 dígitos | Site não registrado | Instagram registrado |
|---|---|---|---:|---:|---:|---:|
| AM | Manaus | Mercado / Supermercado | 2 | 2 | 0 | 0 |
| BA | Salvador | Salão de Beleza | 6 | 6 | 0 | 0 |
| CE | Fortaleza | Farmácia | 3 | 3 | 0 | 0 |
| DF | Brasília | Clínica Odontológica | 8 | 8 | 3 | 3 |
| ES | Vitória | Loja de Roupas | 3 | 3 | 1 | 1 |
| GO | Goiânia | Pizzaria | 2 | 2 | 1 | 1 |
| MG | Lavras | Academia | 1 | 1 | 0 | 0 |
| MG | Lavras | Barbearia | 0 | 0 | 0 | 0 |
| MG | Varginha | Clínica Odontológica | 2 | 2 | 2 | 2 |
| MT | Cuiabá | Loja de Veículos Seminovos | 3 | 3 | 0 | 0 |
| PE | Recife | Imobiliária | 4 | 4 | 0 | 0 |
| PR | Curitiba | Hotel | 3 | 3 | 0 | 1 |
| RJ | Rio de Janeiro | Restaurante | 10 | 10 | 5 | 6 |
| RS | Porto Alegre | Mecânica Automotiva | 3 | 3 | 0 | 2 |
| SC | Florianópolis | Pet Shop | 2 | 2 | 1 | 1 |
| SP | Campinas | Barbearia | 3 | 3 | 0 | 0 |
| SP | Campinas | Padaria | 2 | 2 | 1 | 1 |
| SP | São Paulo | Academia | 4 | 4 | 0 | 0 |

**Importante:** `telefone com 10–13 dígitos` é apenas um sinal de plausibilidade, não prova de número ativo ou WhatsApp. `Site não registrado` não significa que a empresa não tenha site. Estes são resultados agregados do banco, não confirmação da interface autenticada.

## Leitura da amostra
- Todas as 18 buscas retornaram **0–10** registros por nicho/cidade. Isso é insuficiente para uma promessa comercial de cobertura profunda nacional.
- Lavras/MG Barbearia **0**, Academia **1**, Campinas/SP Barbearia **3**; esses exemplos mostram lacunas importantes para a oferta inicial.
- O script SQL de reprodução está em `scripts/fase1-overture-amostra-18-readonly.sql`; só executar na homologação, nunca em produção.
- Estão pendentes: avaliação manual da relevância por nicho sem expor dados pessoais, mapeamentos dos **91 nichos ainda sem correspondência exata**, testes de duplicação/filiais e categorização de cobertura. Não inferir empresas não encontradas.

## Próxima ação única permitida no celular
Concluir **Fase 1.2** por análises agregadas (evidência de categorias trocadas, dados ausentes, regiões fracas), atualizar o catálogo e preparar testes offline. **Não alterar a produção nem executar chamadas externas pagas**.

## Bloqueios que permanecem
- Fase 0.1: rotação/revogação da `service_role` de homologação **não confirmada**.
- Fase 0.2: backup real e restauração de produção **não realizados**.
- Fase 2 autenticada, fase 3 migração, fase 5 beta com usuários, fase 6 cobranças e fase 7 lançamento **NÃO podem ser consideradas concluídas** sem os critérios originais de segurança, backup, validação e conformidade.
