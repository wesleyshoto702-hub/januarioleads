#!/usr/bin/env python3
"""Read-only backup of bytes from one *private* Januario Leads production Storage bucket.

Runs locally only, on an owner-confirmed encrypted volume. Never prints secrets,
object names or content, uploads data, or connects to staging.
The output directory must be outside the Git repository.
"""
from __future__ import annotations

import argparse
import getpass
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

PROD_REF = "czkazbianiflhldenhcj"
BASE = f"https://{PROD_REF}.supabase.co"
BUCKET = "prompt-visual-references"
DEFAULT_EXPECTED_OBJECTS = 9
DEFAULT_EXPECTED_BYTES = 760690
MAX_OBJECTS = 1000
MAX_ONE_OBJECT_BYTES = 10 * 1024 * 1024
MAX_TOTAL_BYTES = 64 * 1024 * 1024
MAX_DEPTH = 12
REPO = Path(__file__).resolve().parent.parent


class BackupBlocked(Exception):
    pass


def checked_output_directory(value: str, *, confirmed_encrypted: bool) -> Path:
    if not confirmed_encrypted:
        raise BackupBlocked("Confirme o volume criptografado com --confirm-encrypted-volume")
    root = Path(value).expanduser().resolve()
    if root == REPO or REPO in root.parents:
        raise BackupBlocked("Nunca guarde arquivos privados dentro do repositorio Git")
    if not root.is_dir():
        raise BackupBlocked("Crie previamente uma pasta em volume criptografado")
    return root


def valid_segment(segment: str) -> bool:
    # Windows-safe path component. Reject path traversal and ambiguous separators.
    return (bool(segment) and segment not in (".", "..") and
            not segment.endswith((" ", ".")) and
            not re.search(r'[<>:"\\|?*\x00-\x1f/]', segment) and
            not re.match(r"^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$",
                         segment, flags=re.IGNORECASE))


def remote_json(secret: str, path: str, body: dict) -> list:
    request = Request(
        BASE + path,
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "apikey": secret,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "JanuarioLeadsPrivateBackup/1.0",
        },
    )
    try:
        with urlopen(request, timeout=30) as response:
            raw = response.read(1_000_001)
    except HTTPError as err:
        raise BackupBlocked(f"Listagem Storage recusada (HTTP {err.code})") from None
    except (URLError, TimeoutError, OSError):
        raise BackupBlocked("Nao foi possivel listar o Storage") from None
    if len(raw) > 1_000_000:
        raise BackupBlocked("Resposta de listagem excessiva")
    try:
        value = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        raise BackupBlocked("Resposta de listagem invalida") from None
    if not isinstance(value, list):
        raise BackupBlocked("Formato de listagem inesperado")
    return value


def list_all_objects(secret: str) -> list[tuple[str, int | None]]:
    result: list[tuple[str, int | None]] = []
    seen: set[str] = set()

    def visit(prefix: str, depth: int) -> None:
        if depth > MAX_DEPTH:
            raise BackupBlocked("Profundidade de pastas acima do limite")
        offset = 0
        while True:
            items = remote_json(
                secret,
                "/storage/v1/object/list/" + quote(BUCKET, safe=""),
                {"prefix": prefix, "limit": 100, "offset": offset,
                 "sortBy": {"column": "name", "order": "asc"}},
            )
            for item in items:
                if not isinstance(item, dict):
                    raise BackupBlocked("Entrada invalida no Storage")
                name = item.get("name")
                if not isinstance(name, str) or not valid_segment(name):
                    raise BackupBlocked("Objeto com nome que nao pode ser salvo com seguranca")
                full_name = prefix + name
                if item.get("id") is None and item.get("metadata") is None:
                    visit(full_name + "/", depth + 1)
                    continue
                if item.get("id") is None or full_name in seen:
                    raise BackupBlocked("Objeto ausente ou duplicado na listagem")
                seen.add(full_name)
                meta = item.get("metadata")
                size: int | None = None
                if isinstance(meta, dict):
                    raw_size = meta.get("size")
                    if isinstance(raw_size, int) and not isinstance(raw_size, bool):
                        size = raw_size
                    elif isinstance(raw_size, str) and raw_size.isdecimal():
                        size = int(raw_size)
                result.append((full_name, size))
                if len(result) > MAX_OBJECTS:
                    raise BackupBlocked("Quantidade de objetos excedeu o teto protegido")
            if len(items) < 100:
                break
            offset += len(items)
    visit("", 0)
    return sorted(result)


def download_object(secret: str, path: str) -> bytes:
    req = Request(
        BASE + "/storage/v1/object/" + quote(BUCKET, safe="") + "/" + quote(path, safe="/"),
        method="GET",
        headers={"apikey": secret, "User-Agent": "JanuarioLeadsPrivateBackup/1.0"},
    )
    try:
        with urlopen(req, timeout=45) as response:
            value = response.read(MAX_ONE_OBJECT_BYTES + 1)
    except HTTPError as err:
        raise BackupBlocked(f"Arquivo privado inacessivel (HTTP {err.code})") from None
    except (URLError, TimeoutError, OSError):
        raise BackupBlocked("Falha no download de arquivo privado") from None
    if len(value) > MAX_ONE_OBJECT_BYTES:
        raise BackupBlocked("Arquivo maior do que o teto permitido")
    return value


def backup_storage(secret: str, root: Path, expected_count: int, expected_bytes: int) -> Path:
    objects = list_all_objects(secret)
    if len(objects) != expected_count:
        raise BackupBlocked(
            f"Inventario mudou: encontrados {len(objects)} objetos; esperado {expected_count}. "
            "Atualize a contagem por consulta read-only ao Supabase antes de continuar."
        )
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    destination = root / f"januario-prod-storage-{stamp}-{os.urandom(3).hex()}"
    destination.mkdir(mode=0o700)
    done = False
    try:
        private = destination / "files"
        private.mkdir(mode=0o700)
        inventory = []
        total_bytes = 0
        for relative, advertised_size in objects:
            # Every segment was already validated; resolve again as a defense.
            target = (private / relative).resolve()
            if private.resolve() not in target.parents:
                raise BackupBlocked("Caminho fora da pasta privada")
            data = download_object(secret, relative)
            if advertised_size is not None and len(data) != advertised_size:
                raise BackupBlocked("Arquivo mudou durante a copia")
            total_bytes += len(data)
            if total_bytes > MAX_TOTAL_BYTES:
                raise BackupBlocked("Storage cresceu acima do teto de 64 MiB")
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open("xb") as fd:
                fd.write(data)
            digest = hashlib.sha256(target.read_bytes()).hexdigest()
            inventory.append({"name": relative, "size_bytes": len(data), "sha256": digest})
        if total_bytes != expected_bytes:
            raise BackupBlocked(
                f"Total de bytes mudou: {total_bytes} contra {expected_bytes} esperados"
            )
        manifest = {
            "project_ref": PROD_REF,
            "bucket": BUCKET,
            "objects": inventory,
            "count": len(inventory),
            "bytes": total_bytes,
            "captured_utc": datetime.now(timezone.utc).isoformat(),
            "encrypted_volume_confirmed_by_owner": True,
            "object_bytes_verified": True,
            "isolated_restore_verified": False,
            "notice": "DADOS PRIVADOS: nao enviar ao GitHub, ChatGPT ou por email",
        }
        (destination / "manifest-private.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        done = True
        return destination
    finally:
        if not done:
            shutil.rmtree(destination, ignore_errors=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Backup local e read-only de objetos Storage da producao")
    parser.add_argument("--directory", required=True, help="Pasta preexistente fora do Git")
    parser.add_argument("--confirm-encrypted-volume", action="store_true")
    parser.add_argument("--expected-count", type=int, default=DEFAULT_EXPECTED_OBJECTS)
    parser.add_argument("--expected-bytes", type=int, default=DEFAULT_EXPECTED_BYTES)
    args = parser.parse_args()
    try:
        root = checked_output_directory(args.directory,
                                        confirmed_encrypted=args.confirm_encrypted_volume)
        if not 0 <= args.expected_count <= MAX_OBJECTS or not 0 <= args.expected_bytes <= MAX_TOTAL_BYTES:
            raise BackupBlocked("Limites invalidos")
        if input(f"Confirmar backup do Storage de PRODUCAO {PROD_REF}? Digite BACKUP_STORAGE: ").strip() != "BACKUP_STORAGE":
            raise BackupBlocked("Confirmacao de destino nao recebida")
        secret = getpass.getpass("sb_secret_ da PRODUCAO (nao sera exibida): ")
        if not secret.startswith("sb_secret_") or len(secret) < 25:
            raise BackupBlocked("Nao use JWT legado nem uma chave publicavel")
        output = backup_storage(secret, root, args.expected_count, args.expected_bytes)
        print(f"BACKUP STORAGE LOCAL CONCLUIDO. Objetos: {args.expected_count}; bytes: {args.expected_bytes}")
        print(f"Arquivos privados no volume protegido: {output}")
        print("RESTAURO ISOLADO AINDA NAO VALIDADO. Nao envie a pasta a servicos externos.")
        return 0
    except BackupBlocked as err:
        print("BLOQUEADO: " + str(err), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
