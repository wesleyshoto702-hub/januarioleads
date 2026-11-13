#!/usr/bin/env python3
"""Execução automática Overture, exclusivamente no Supabase STAGING.

- Seleciona cidades novas a partir do progresso no Supabase.
- Não modifica produção nem reimporta cidades já presentes.
- Respeita bloqueio preventivo de armazenamento e guarda falhas para retomar.
- Usa a mesma seleção municipal dos notebooks, sem API de localidades do IBGE.
"""
import argparse
from datetime import datetime, timedelta, timezone
import os
import subprocess
import sys
import time
from urllib.parse import urlencode

from import_overture_br import (
    STATE_CODES, api, database_bytes, ensure_state_boundaries,
    municipalities_index, normalize,
)

STAGING = "https://prlrxjothrslhswpkoza.supabase.co"
MIB = 1024 * 1024
STOP_MIB = 88  # margem sob o limite estrito do importador (90 MiB)
PAGE_SIZE = 1000
PRIORIDADES = {
    "MG": ["Uberlândia", "Juiz de Fora", "Uberaba", "Montes Claros", "Divinópolis", "Contagem", "Betim", "Sete Lagoas"],
    "SP": ["Sorocaba", "São José dos Campos", "Santos", "Bauru", "Piracicaba", "São José do Rio Preto", "São Carlos", "Franca"],
    "RJ": ["Volta Redonda", "São Gonçalo", "Nova Iguaçu", "Duque de Caxias", "Campos dos Goytacazes", "Macaé", "Cabo Frio"],
    "AC": ["Sena Madureira", "Brasiléia", "Tarauacá", "Feijó"],
    "AL": ["Palmeira dos Índios", "Rio Largo", "Penedo", "União dos Palmares"],
    "AP": ["Laranjal do Jari", "Oiapoque", "Porto Grande"],
    "AM": ["Itacoatiara", "Manacapuru", "Tefé", "Coari", "Tabatinga"],
    "BA": ["Vitória da Conquista", "Camaçari", "Ilhéus", "Itabuna", "Juazeiro", "Barreiras", "Porto Seguro"],
    "CE": ["Sobral", "Maracanaú", "Caucaia", "Crato", "Iguatu"],
    "ES": ["Serra", "Cariacica", "Cachoeiro de Itapemirim", "Linhares", "Colatina"],
    "GO": ["Anápolis", "Rio Verde", "Trindade", "Jataí", "Itumbiara", "Catalão"],
    "MA": ["Caxias", "Timon", "Açailândia", "Bacabal", "Balsas"],
    "MT": ["Rondonópolis", "Sinop", "Sorriso", "Tangará da Serra", "Cáceres"],
    "MS": ["Três Lagoas", "Corumbá", "Ponta Porã", "Naviraí", "Nova Andradina"],
    "PA": ["Santarém", "Marabá", "Castanhal", "Parauapebas", "Altamira"],
    "PB": ["Patos", "Sousa", "Bayeux", "Santa Rita", "Cajazeiras"],
    "PR": ["Maringá", "Cascavel", "Ponta Grossa", "Foz do Iguaçu", "São José dos Pinhais", "Guarapuava"],
    "PE": ["Olinda", "Paulista", "Caruaru", "Petrolina", "Garanhuns"],
    "PI": ["Picos", "Floriano", "Piripiri", "Campo Maior", "Oeiras"],
    "RN": ["Parnamirim", "Caicó", "Macaíba", "Assú", "Ceará-Mirim"],
    "RS": ["Pelotas", "Santa Maria", "Canoas", "Novo Hamburgo", "Passo Fundo", "Bento Gonçalves"],
    "RO": ["Ariquemes", "Vilhena", "Cacoal", "Jaru", "Rolim de Moura"],
    "RR": ["Alto Alegre", "Caracaraí", "Bonfim", "Mucajaí", "Cantá"],
    "SC": ["Blumenau", "Itajaí", "Chapecó", "Criciúma", "São José", "Balneário Camboriú"],
    "SE": ["Itabaiana", "Lagarto", "Estância", "São Cristóvão", "Propriá"],
    "TO": ["Gurupi", "Porto Nacional", "Paraíso do Tocantins", "Colinas do Tocantins"],
}

ORDEM_UFS = ("MG SP RJ AC AL AP AM BA CE ES GO MA MT MS PA PB PR PE PI RN RS RO RR SC SE TO").split()
assert set(ORDEM_UFS) == set(STATE_CODES) - {"DF"}
assert set(PRIORIDADES) == set(ORDEM_UFS)


def listar(chave, tabela, colunas, filtros=""):
    offset = 0
    tudo = []
    while True:
        path = ("/rest/v1/" + tabela + "?select=" + colunas + filtros
                + "&limit=" + str(PAGE_SIZE) + "&offset=" + str(offset))
        pagina = api(STAGING, chave, path)
        if not isinstance(pagina, list):
            raise RuntimeError("Falha ao consultar a tabela " + tabela)
        tudo.extend(pagina)
        if len(pagina) < PAGE_SIZE:
            return tudo
        offset += len(pagina)


def municipios_existentes(chave):
    return {
        (r["state"], r["city_key"])
        for r in listar(chave, "overture_import_city_progress", "state,city_key")
        if r.get("state") and r.get("city_key")
    }


def municipios_em_espera(chave):
    momento = datetime.now(timezone.utc).isoformat()
    filtro = "&" + urlencode({"retry_after": "gt." + momento})
    return {
        (r["state"], r["city_key"])
        for r in listar(chave, "overture_auto_city_attempts", "state,city_key", filtro)
        if r.get("state") and r.get("city_key")
    }


def guardar_falha(chave, uf, cidade, motivo):
    agora = datetime.now(timezone.utc)
    proxima = agora + timedelta(days=3)
    linha = {
        "state": uf, "city": cidade, "city_key": normalize(cidade),
        "last_error": str(motivo)[:150],
        "retry_after": proxima.isoformat(),
        "updated_at": agora.isoformat(),
    }
    api(STAGING, chave,
        "/rest/v1/overture_auto_city_attempts?on_conflict=state,city_key",
        method="POST", payload=[linha])


def catalogo_malha(uf, cache):
    if uf not in cache:
        zip_path = ensure_state_boundaries(uf)
        frame = municipalities_index(zip_path)
        cache[uf] = {
            normalize(str(row.NM_MUN)): str(row.NM_MUN)
            for row in frame.itertuples()
            if str(row.SIGLA_UF) == uf and str(row.NM_MUN).strip()
        }
    return cache[uf]


def escolher(existentes, em_espera, tentadas, cache):
    contagem = {uf: 0 for uf in ORDEM_UFS}
    for uf, _ in existentes:
        if uf in contagem:
            contagem[uf] += 1
    ordem = sorted(ORDEM_UFS, key=lambda uf: (contagem[uf], ORDEM_UFS.index(uf)))
    bloqueadas = existentes | em_espera | tentadas

    # Primeira passagem: prioridades locais, sem requisição HTTP ao IBGE.
    for uf in ordem:
        for cidade in PRIORIDADES[uf]:
            if (uf, normalize(cidade)) not in bloqueadas:
                return uf, cidade

    # Quando as prioridades acabam, recorre aos ZIPs oficiais de municípios.
    for uf in ordem:
        for chave, nome in sorted(catalogo_malha(uf, cache).items()):
            if (uf, chave) not in bloqueadas:
                return uf, nome
    return None


def contagem_cidade(chave, uf, cidade):
    filtros = "&" + urlencode({"state": "eq." + uf, "city_key": "eq." + normalize(cidade)})
    rows = listar(chave, "overture_import_city_progress", "imported_rows", filtros)
    return int(rows[0]["imported_rows"]) if rows else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cities-per-run", type=int, default=100)
    parser.add_argument("--max-runtime-minutes", type=int, default=40,
                        help="Tempo máximo por sessão, sem depender do GitHub Actions.")
    parser.add_argument("--per-city", type=int, default=60)
    args = parser.parse_args()
    if not 1 <= args.cities_per_run <= 100 or not 1 <= args.per_city <= 100:
        parser.error("Use 1..100 municipios por sessão e 1..100 empresas por municipio.")
    if not 5 <= args.max_runtime_minutes <= 45:
        parser.error("--max-runtime-minutes deve estar entre 5 e 45 minutos.")

    # Evita que uma variável de ambiente ou secret de produção seja usada.
    if os.environ.get("SUPABASE_URL", "").rstrip("/") != STAGING:
        raise SystemExit("BLOQUEADO: SUPABASE_URL nao corresponde ao STAGING autorizado.")
    segredo = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not segredo.startswith(("sb_secret_", "eyJ")):
        raise SystemExit("BLOQUEADO: segredo de homologacao nao configurado/valido.")

    deadline = time.monotonic() + args.max_runtime_minutes * 60
    antes = database_bytes(STAGING, segredo)
    print(f"STAGING: {antes/MIB:.2f} MiB. Limite preventivo: {STOP_MIB} MiB.", flush=True)
    print(f"Modo contínuo: até {args.max_runtime_minutes} minutos, "
          f"máximo de {args.cities_per_run} municípios por sessão.", flush=True)
    if antes >= STOP_MIB * MIB:
        print("PARADA SEGURA: armazenamento acima do limite preventivo.")
        return 0

    existentes = municipios_existentes(segredo)
    em_espera = municipios_em_espera(segredo)
    print(f"Municipios existentes: {len(existentes)}; em espera: {len(em_espera)}")
    tentadas = set()
    catalogos = {}
    importadas = 0
    falhas = 0
    while importadas < args.cities_per_run and falhas < 3:
        remaining = deadline - time.monotonic()
        if remaining < 240:
            print("PAUSA PARA RETOMADA: sessão próxima do limite de tempo.", flush=True)
            break
        if database_bytes(STAGING, segredo) >= STOP_MIB * MIB:
            print("PARADA SEGURA: banco atingiu limite preventivo.")
            break
        proxima = escolher(existentes, em_espera, tentadas, catalogos)
        if not proxima:
            print("SEM PROXIMOS MUNICIPIOS ELEGIVEIS.")
            break
        uf, cidade = proxima
        item = (uf, normalize(cidade))
        tentadas.add(item)
        if contagem_cidade(segredo, uf, cidade) > 0:
            existentes.add(item)
            continue
        print(f"INICIANDO: {cidade}/{uf} (ate {args.per_city})", flush=True)

        cmd = [
            sys.executable, "scripts/import_overture_br.py",
            "--states", uf, "--cities", cidade,
            "--max-records-per-state", str(args.per_city),
            "--max-records-per-city", str(args.per_city),
            "--database-max-mb", "90",
        ]
        try:
            # Máximo 12 minutos por município; sempre deixa margem para
            # salvar o resultado e encerrar a sessão antes do timeout do GitHub.
            import_timeout = min(720, max(60, int(deadline - time.monotonic() - 120)))
            proc = subprocess.run(cmd, timeout=import_timeout, check=False)
            if proc.returncode != 0:
                # Retentativa em 3 dias para não ficar preso na mesma cidade.
                guardar_falha(segredo, uf, cidade, "exit_code=" + str(proc.returncode))
                em_espera.add(item)
                falhas += 1
                print(f"ADIADO: {cidade}/{uf}; retorno {proc.returncode}.")
                continue
        except subprocess.TimeoutExpired:
            if deadline - time.monotonic() < 180:
                print(f"PAUSA PARA RETOMADA: limite de tempo em {cidade}/{uf}. "
                      "O banco preserva os registros já gravados.", flush=True)
                break
            guardar_falha(segredo, uf, cidade, "timeout_ate_720s")
            em_espera.add(item)
            falhas += 1
            print(f"ADIADO: {cidade}/{uf}; tempo excedido.", flush=True)
            continue

        depois = contagem_cidade(segredo, uf, cidade)
        if depois == 0:
            guardar_falha(segredo, uf, cidade, "sem_registros_verificados")
            em_espera.add(item)
            falhas += 1
            print(f"ADIADO: {cidade}/{uf}; nenhum registro confirmado.")
            continue
        existentes.add(item)
        importadas += 1
        print(f"CONFIRMADO NO SUPABASE: {cidade}/{uf} | {depois} empresas", flush=True)

    print(f"SESSAO CONCLUIDA: {importadas} novos municípios; {falhas} falhas adiadas; "
          f"{len(existentes)} municípios no banco; "
          f"{database_bytes(STAGING, segredo)/MIB:.2f} MiB. "
          "Quando habilitado, o agendamento fará a próxima sessão.", flush=True)
    return 0 if falhas == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
