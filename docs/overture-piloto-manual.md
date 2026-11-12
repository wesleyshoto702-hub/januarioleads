# Piloto Overture em homologação — execução manual segura

Este pacote **não altera a interface ou o backend de produção** do Januário
Leads. Ele torna disponível na branch `main` o workflow manual
`.github/workflows/import-overture-piloto-staging.yml`.

## Condição para executar

O GitHub Actions precisa receber um runner (`ubuntu-latest`). Em 12/11/2026,
os workflows recentes falharam em ~2 s **sem runner e sem steps**; não
inferir a causa exata sem consultar a mensagem exibida no GitHub. Enquanto
esse bloqueio existir, o fluxo não poderá importar dados.

Crie ou use o environment do GitHub `homologacao` e nele configure os secrets:
- `OVERTURE_SUPABASE_URL` = URL pública
  `https://prlrxjothrslhswpkoza.supabase.co`
- `OVERTURE_SUPABASE_SERVICE_ROLE_KEY` = chave **service_role da homologação**
  obtida no painel Supabase, armazenada somente no secret GitHub.
  **Jamais** coloque a chave neste documento, no código, na conversa,
  na captura de tela, nem no ambiente de produção.

Link de ambiente: https://github.com/wesleyshoto702-hub/januarioleads/settings/environments
Link do Actions: https://github.com/wesleyshoto702-hub/januarioleads/actions

## Primeiro piloto

Quando a execução estiver disponível, abra:
`Actions → Piloto Overture Brasil - somente homologacao → Run workflow`.

Selecionar exatamente:
- `uf`: `MG`
- `municipio`: `Varginha`
- `limite_por_municipio`: `30`

A rotina recusa qualquer URL diferente da homologação, usa apenas uma
cidade, limita registros a **30** por piloto e observa teto de **100 MiB**
de tamanho do banco. O runner instala o leitor Overture, faz download da
malha municipal do IBGE e salva registros reais na tabela privada
`overture_places`. Custo de rede, minutos Actions e armazenamento devem
ser conferidos antes de elevar limites; este arquivo não garante cobrança zero.

## Conferir o resultado no Supabase de homologação

```sql
select state, city, count(*) as leads
from public.overture_places
group by state, city
order by state, city;

select state, status, imported_rows, last_error
from public.overture_import_progress
where state in ('MG', 'SP', 'RJ')
order by state;

select pg_size_pretty(pg_database_size(current_database())) as tamanho;
```

Se Varginha passar e permanecer confortável no limite, os próximos pilotos
são **Pouso Alegre/MG**, **Campinas/SP** e **Niterói/RJ**. Não automatizar
os 27 estados de uma só vez ou afirmar que uma amostra corresponde à
cobertura de toda a cidade/UF.

> Importante: a PR #140 continua contendo a busca Overture em
> desenvolvimento. Este pacote publica **somente o script e um workflow
> manual**, sem mexer no site ou conectar a produção ao banco de homologação.
