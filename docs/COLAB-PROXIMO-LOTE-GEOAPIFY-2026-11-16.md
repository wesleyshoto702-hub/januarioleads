# Próxima Colab preparada — triagem segura de lotes Geoapify (16/11/2026)

**Arquivo:** [Januario_Leads_Proxima_Colab_V1_Preparacao_Geoapify_Offline.ipynb](../notebooks/Januario_Leads_Proxima_Colab_V1_Preparacao_Geoapify_Offline.ipynb)

**Continuação da Fase 9 V6.1**, mas **não faz nova importação** nem enriquece registros ainda. Complementa o fluxo de Overture com um plano de seleção conservadora de 25 candidatos a enriquecimento. O Plano Mestre permanece em **Fase 3.1a**.

## Diagnóstico lido na homologação (somente SELECT)
- `public.overture_places`: **321.179** empresas em 16/11/2026.
- `public.overture_geoapify_enrichment`: **38 registros**, todos `status=no_match`. Logo, não há enriquecimentos confirmados na tabela de sugestões atual.
- `public.overture_geoapify_free_credit_usage`: total histórico de **50 créditos reservados**, e não necessariamente consumidos/faturados. Nenhuma chamada Geoapify/Google/OpenAI foi realizada na criação desta Colab.

## Como a Colab funciona
- **Modo padrão DEMONSTRACAO:** 144 empresas e três tentativas artificiais; processa lote sintético para validar pontuação, limites e exclusão de tentativas antigas.
- **Modo CSV (somente depois de Fase 0):** importa dois CSVs obtidos em ambiente autorizado, com limite de 5.000 linhas e 25 MB cada. O segundo CSV deve listar **todas** as tentativas existentes na Geoapify; sem ele, a Colab impede a seleção.
- Exclui qualquer ID já tentado, mesmo quando a tentativa retornou `no_match` ou `matched`, e empresas com sinal de fechamento permanente.
- Escolhe apenas empresas com nome, categoria, município, UF e coordenadas brasileiras plausíveis; prioriza telefones, e-mails, websites, Instagram e endereço **não registrados**. A ausência do campo não comprova que a empresa não tenha o contato.
- Produz no máximo **25 candidatos**, **3 por município** e **8 por UF**, em ordem determinística, sem dependência de servidores externos.
- Exporta `lote_geoapify_revisao.csv`, `cobertura_amostra.csv`, `manifesto_lote.json` sem atualizar a base. A saída mantém somente os dados da Overture, marcados como pendentes de revisão humana; não agrega dados pessoais novos.

## Exportação somente leitura (APÓS FASE 0)
- `scripts/colab_proximo_lote_geoapify_candidatos_readonly.sql`: SELECT de até 5.000 candidatos, balanceados por UF, excluindo IDs previamente tentados.
- `scripts/colab_proximo_lote_geoapify_historico_readonly.sql`: SELECT de todos os IDs e status previamente tentados (para prevenção de reconsultas).
- Exportar os resultados em arquivos com os nomes solicitados pelo notebook, em sessão autorizada da **homologação**, nunca produção.

## Segurança e custos
- [x] Sem `service_role`, API keys, tokens nem URL de conexão ao Supabase na Colab.
- [x] Nenhum `fetch`/HTTP/SQL de escrita, serviços Google, Geoapify ou OpenAI no notebook.
- [x] Lotes pequenos somente para revisão; selecionar 25 **não** garante que 25 consultas reais sejam gratuitas.
- [ ] Fase 0.1: revogar/rotacionar a antiga `service_role` de homologação exposta.
- [ ] Fase 0.2: backup e ensaio recuperável de restauração de produção.
- [ ] Próxima Colab **de execução real**, futura: apenas após Fase 0, licenças e autorização expressa de orçamento, sob reserva atômica server-side. Não permitir execução direta com API key, pois um ledger local do Colab pode perder estado ao reiniciar.

**Esta versão já é útil para planejar a próxima rodada sem custos e sem escrita.** Não confundir a aprovação dos testes offline com execução real do enriquecimento ou cobertura nacional do Overture.

## Testes
- `tests/test_proxima_colab_geoapify_offline.py`: faz o notebook rodar realmente com dados falsos em duas modalidades, testa limites, exportações, exclusão de tentativas e SQL somente SELECT.
- Workflow `.github/workflows/validar-proxima-colab-geoapify-offline.yml`: sem segredos nem chamadas aos fornecedores.
