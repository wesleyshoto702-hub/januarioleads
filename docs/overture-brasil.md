# Overture Places — Integração para o Brasil inteiro

**Status (2026-11-12):** código da busca preparado; função `search-places` implantada somente na homologação; esquema privado migrado e validado; **nenhum dado Overture importado ainda**. Não declarar cobertura nacional como concluída até conferir o relatório por UF e por município.

## Objetivo e limites

- As 27 unidades federativas são suportadas pelo importador, sem usar serviços de raspagem ou Google para copiar dados.
- O Overture não é uma API de pesquisa em tempo real. É um conjunto de dados mensal que precisa de atualização.
- O primeiro plano usa até **20 estabelecimentos por município** (ajustável), distribuindo o orçamento de armazenamento e não prometendo cobertura exaustiva.
- O importador interrompe novas inserções quando o banco alcança o teto configurado (400 MB por padrão). O tamanho da última transação e índices podem produzir pequena margem, portanto monitore o limite real no provedor.
- A infraestrutura do Supabase, downloads e GitHub Actions consomem recursos sujeitos a cotas. **R$ 0 não é garantido em qualquer escala.**
- O código da busca usa Overture antes do Geoapify e do Google Places, e mantém os resultados de cada provedor separados para respeitar suas licenças.
- Atribuição Overture é exibida no resultado. Consulte sempre os avisos de licenças por fonte em https://docs.overturemaps.org/attribution/

## Bancos

- Homologação: Supabase `prlrxjothrslhswpkoza`.
- Produção: Supabase `czkazbianiflhldenhcj` — **não alterar até revisão e aprovação dos testes.**
- Migration `20261112080000_overture_national_places.sql` cria `overture_places`, `overture_import_progress` e a guarda `overture_storage_bytes()`.
- Migration `20261112083000_overture_national_progress.sql` cadastra 27 UFs com estado `pending`.
- As tabelas Overture possuem RLS e não são acessíveis diretamente a `anon` ou `authenticated`. O adaptador `_shared/overture-search.ts` lê no servidor usando chave privada.
- A função `search-places` mantém autenticação de usuário, limites e CORS existentes.

## Como executar uma importação (operador do projeto)

1. Revise e integre a PR após os testes. O workflow manual de importação deve estar na branch padrão para o botão **Run workflow** aparecer.
2. No GitHub, configure dois environments com proteção adequada: `homologacao` e `producao`. Cada um terá os secrets `OVERTURE_SUPABASE_URL` e `OVERTURE_SUPABASE_SERVICE_ROLE_KEY`, pertencentes **ao projeto correto**. Não cole essa chave no código, no chat ou no frontend.
3. Acesse **Actions > Importar Overture Places Brasil (manual, com limite) > Run workflow**. Primeiro rode em `homologacao`, `states=MG` ou um conjunto pequeno, com `max_records_per_city=20` e `max_records_per_state=0`.
4. Confira tabela `overture_import_progress`, total de linhas, cidades presentes e tamanho do banco. Não interprete `partial` como concluído; `complete` significa que a seleção configurada daquela UF foi varrida, não que todos os POIs possíveis foram importados.
5. Quando validado, rode outras UFs em lotes, sem ultrapassar o teto, e faça testes reais do dashboard com usuários autorizados. Como o workflow é manual, nenhuma execução é iniciada automaticamente.
6. Só depois de validação, aprove migrações em produção, publique a Edge Function no projeto de produção e use os **segredos de produção** protegidos para importação controlada.

**Comando local equivalente** (não envie segredos pelo terminal compartilhado):
```bash
python -m pip install overturemaps geopandas shapely pyogrio
python scripts/import_overture_br.py \
  --states AC,AL,AP,AM,BA,CE,DF,ES,GO,MA,MT,MS,MG,PA,PB,PR,PE,PI,RJ,RN,RS,RO,RR,SC,SP,SE,TO \
  --max-records-per-city 20 --database-max-mb 400
```

A malha municipal base utilizada é o arquivo público `BR_Municipios_2024.zip` do IBGE. O importador baixa o arquivo se ele não estiver em `data/`, cerca de 199 MB; o projeto não deve versionar esse arquivo.

## Checklist de liberação

- [x] Código da função e importador preparados na PR.
- [x] Tabelas privadas criadas em staging com RLS e grants verificados.
- [x] Edge Function em staging publicada com Overture opcional.
- [ ] Teste de importação real em município e UF, verificar contagens e contatos.
- [ ] Verificar qualidade do mapeamento das categorias para os nichos brasileiros.
- [ ] Confirmar limites de banco, execução e mensalidades gratuitas.
- [ ] Testes automáticos TypeScript, build, browser e ingestão passando.
- [ ] Migração e deploy aprovados em produção.
- [ ] Importar as 27 UFs e avaliar cobertura efetiva (não presumir 100%).
