#!/usr/bin/env python3
"""Build read-only, secret-scrubbed AI-review files from a Git checkout.

This script NEVER reads .env files, local credentials, Supabase Vault,
project secrets, or live customer records. It only reads tracked source files.
The files written under /tmp are suitable for a separate AI review.
"""
from __future__ import annotations

import datetime as dt
import io
import json
import re
import subprocess
import tarfile
from pathlib import Path

SOURCE_COMMIT = "0a6168d26774d5cd57ab015db39fc297ef9042fd"
REPOSITORY = "wesleyshoto702-hub/januarioleads"
OUT = Path("myhub-audit-export")
OUT.mkdir(exist_ok=True)

ALLOWED_SUFFIX = {
    ".ts", ".tsx", ".js", ".jsx", ".json", ".sql", ".toml", ".yml",
    ".yaml", ".md", ".txt", ".css", ".py", ".sh", ".html", ".xml",
    ".lock", ".gitignore", ".prettierignore", ".prettierrc",
}
DENIED_SEGMENTS = {
    ".git", ".vercel", ".next", "node_modules", "dist", "build",
    "coverage", "test-results", "__pycache__", ".cache",
    "secrets", "credentials", "private_keys",
}
DENIED_BASENAMES = {
    ".npmrc", ".pypirc", "id_rsa", "id_ed25519",
    "service-account.json", "service_account.json", "credentials.json",
    "firebase-adminsdk.json", "settings.local.json",
}
DENIED_EXTENSIONS = {
    ".pem", ".key", ".pfx", ".p12", ".db", ".sqlite", ".sqlite3",
    ".png", ".jpeg", ".jpg", ".gif", ".ico", ".svg", ".webp",
    ".pdf", ".zip", ".gz", ".tar", ".cer", ".crt", ".asc",
}
SPECIAL_EXPORT_FILES = {
    "scripts/export-ai-review-snapshot.py",
    ".github/workflows/niche-catalog-check.yml",
}
LANGUAGES = {
    ".ts": "typescript", ".tsx": "tsx", ".js": "javascript",
    ".jsx": "jsx", ".json": "json", ".sql": "sql", ".toml": "toml",
    ".yml": "yaml", ".yaml": "yaml", ".md": "markdown",
    ".css": "css", ".py": "python", ".sh": "bash",
    ".html": "html", ".xml": "xml",
}

def included(path: str) -> bool:
    parts = Path(path).parts
    low_parts = [part.lower() for part in parts]
    name = low_parts[-1]
    if path == "scripts/export-ai-review-snapshot.py":
        return False
    if any(part in DENIED_SEGMENTS for part in low_parts):
        return False
    if any(part.startswith(".env") or part.startswith("env.local") for part in low_parts):
        return False
    if name in DENIED_BASENAMES:
        return False
    if "secret" in name and name.endswith((".json", ".txt", ".pem", ".key")):
        return False
    if Path(name).suffix in DENIED_EXTENSIONS:
        return False
    if Path(name).suffix not in ALLOWED_SUFFIX:
        return False
    return True

SENSITIVE_PATTERNS = [
    (re.compile(r"-----BEGIN [^-]*PRIVATE KEY-----.*?-----END [^-]*PRIVATE KEY-----", re.S), "[CHAVE_PRIVADA_REMOVIDA]"),
    (re.compile(r"(?<!\w)AIza[A-Za-z0-9_-]{25,}"), "[GOOGLE_API_KEY_REMOVIDA]"),
    (re.compile(r"(?<!\w)(?:sk-(?:proj-|live-|test-)?)[A-Za-z0-9_-]{18,}"), "[API_KEY_REMOVIDA]"),
    (re.compile(r"(?<!\w)gh[pousr]_[A-Za-z0-9]{20,}"), "[GITHUB_TOKEN_REMOVIDO]"),
    (re.compile(r"(?<!\w)github_pat_[A-Za-z0-9_]{20,}"), "[GITHUB_TOKEN_REMOVIDO]"),
    (re.compile(r"(?<!\w)sb_secret_[A-Za-z0-9_-]{15,}"), "[SUPABASE_SECRET_REMOVIDO]"),
    (re.compile(r"(?<!\w)sb_publishable_[A-Za-z0-9_-]{15,}"), "[SUPABASE_KEY_OMITIDA]"),
    (re.compile(r"(?<!\w)AKIA[A-Z0-9]{16}"), "[AWS_KEY_REMOVIDA]"),
    (re.compile(r"(?<!\w)ya29\.[A-Za-z0-9_-]{20,}"), "[GOOGLE_TOKEN_REMOVIDO]"),
    (re.compile(r"(?<!\w)eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}"), "[JWT_REMOVIDO]"),
    (re.compile(r"(?i)(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s@\/]+:[^\s@\/]+@"), "[DB_CREDENTIALS_REMOVIDAS]@"),
    (re.compile(r"(?i)(?:Bearer\s+)(?!\$\{|\$|<)([A-Za-z0-9_.-]{24,})"), "Bearer [TOKEN_REMOVIDO]"),
    (re.compile(r"(?i)(AccountKey\s*=\s*)[A-Za-z0-9+/=]{20,}"), r"\1[CHAVE_REMOVIDA]"),
]
ASSIGNMENT_PATTERN = re.compile(
    r'''(?im)^([^\n]{0,120}\b(?:API_KEY|ACCESS_TOKEN|REFRESH_TOKEN|PRIVATE_KEY|CLIENT_SECRET|SERVICE_ROLE_KEY|DATABASE_PASSWORD|PASSWORD|CRON_SECRET)\b\s*[:=]\s*["'])([^\n"']{12,})(["'])'''
)

def sanitize(content: str) -> tuple[str, int]:
    changed = 0
    for pattern, replacement in SENSITIVE_PATTERNS:
        content, count = pattern.subn(replacement, content)
        changed += count
    def assignment(match: re.Match[str]) -> str:
        nonlocal changed
        value = match.group(2).strip()
        if value.startswith(("$", "{", "<", "[", "import.meta", "Deno.env", "process.env")):
            return match.group(0)
        changed += 1
        return match.group(1) + "[VALOR_REDACTADO]" + match.group(3)
    content = ASSIGNMENT_PATTERN.sub(assignment, content)
    return content, changed

def tracked_files() -> list[str]:
    raw = subprocess.check_output(["git", "ls-files", "-z"])
    return sorted(
        file for file in raw.decode("utf-8").split("\x00")
        if file and included(file)
    )

files: dict[str, str] = {}
redactions: dict[str, int] = {}
excluded_binary_or_invalid: list[str] = []
for path in tracked_files():
    source = Path(path)
    if not source.is_file():
        continue
    try:
        text = source.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        excluded_binary_or_invalid.append(path)
        continue
    if "\x00" in text:
        excluded_binary_or_invalid.append(path)
        continue
    safe, count = sanitize(text)
    files[path] = safe
    if count:
        redactions[path] = count

def is_backend(path: str) -> bool:
    if path.startswith("supabase/"):
        return True
    if path.startswith((
        "src/lib/auth", "src/lib/bff", "src/lib/account-storage",
        "src/lib/supabase-config", "src/lib/rest-pagination",
        "src/features/leads/remote-leads",
        "src/features/leads/use-lead-workspace",
        "src/features/search-leads/search-businesses",
        "src/features/opportunities/places-search-cache",
        "src/features/business-enrichment/business-enrichment",
        "src/features/business-presence/discover-business-presence",
        "src/features/open-now-niches/open-now-service",
        "src/features/lead-finance/finance",
        "src/features/next-actions/next-actions",
        "src/features/lead-activities/lead-activities",
        "src/server.ts", "src/start.ts",
        "tests/deployment/", "scripts/",
        "docs/migration-history/",
    )):
        return True
    if path in {
        "package.json", "README.md", ".github/workflows/deploy-search-places.yml",
        ".github/workflows/staging-rls.yml", "docs/database-recovery.md",
        "docs/migration-history-audit.md", "docs/migration-history-review-23.md",
        "docs/security-review-2026-11-03.md", "docs/release-validation.md",
        "docs/sync-leads-quota-2026-11-05.md",
        "docs/mvp-without-automatic-places-sync-2026-11-05.md",
        "docs/session-security-migration.md",
    }:
        return True
    return False

today = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
production_info = """## Contexto de producao observado em 05/11/2026 (somente metadados)

- Supabase project ref: czkazbianiflhldenhcj (identificador publico, nao e senha).
- Host do frontend: Vercel; codigo versionado em GitHub; integraçao ao Lovable.
- 17 tabelas no schema public com RLS habilitado: private_access, leads,
  lead_updates, sync_internal_config, site_previews, lead_activities,
  prompt_visual_reference_sets, prompt_visual_references,
  prompt_visual_reference_assets, business_enrichment_runs,
  business_enrichment_sources, business_enrichment_facts,
  open_now_niche_cache, open_now_refresh_guard, lead_payments,
  places_search_cache, api_request_rate_limit.
- Edge Functions ativas: search-places (v31, JWT true),
  generate-site-prompt (v18, JWT true), sync-leads (v10, JWT false),
  generate-preview (v10, JWT true), analyze-visual-references (v8, JWT true),
  capture-visual-reference (v9, JWT true), deep-enrich-business (v27, JWT true),
  open-now-niches (v15, JWT true).
- Quatro funcoes antigas existem no ambiente e nao possuem codigo-fonte
  integral na pasta supabase/functions do GitHub:
  generate-site-prompt, generate-preview, analyze-visual-references,
  capture-visual-reference. Para auditar 100% do deploy, solicitar separadamente
  o codigo das funcoes implantadas, sem acessar valores de secrets.
- Cron sync-leads-daily registrado com expressao 0 */8 * * * e active=false;
  o job foi desativado para o MVP. A funcao Edge ainda existe.
- Historico remoto de migrations possui entradas anteriores ao recorte do
  repositorio; nao assumir que migracoes locais equivalem a um dump fiel
  do banco em producao.
- Nao foram exportadas linhas de dados, nomes de usuarios, perfis,
  autenticacoes, leads, chaves da Vault, variaveis de ambiente ou logs pessoais.
"""

def md_header(title: str, selected: list[str]) -> str:
    return (
        "# " + title + "\n\n"
        "Criado em: " + today + "\n\n"
        "Repositorio original (privado): https://github.com/" + REPOSITORY + "\n\n"
        "Commit principal usado como referencia: " + SOURCE_COMMIT + "\n\n"
        "Arquivos-texto incluidos: " + str(len(selected)) + "\n\n"
        "### Seguranca e escopo\n\n"
        "- Contem apenas codigo e documentacao versionados, com mascaramento "
        "de possiveis credenciais literais.\n"
        "- TODOS os .env, chaves privadas, certificados, binarios, caches, "
        "credenciais e arquivos de dados locais foram omitidos.\n"
        "- Nao ha exportacao de clientes, auth.users, tabelas com dados, "
        "senhas, Vault, variaveis de ambiente implantadas ou logs reais.\n"
        "- Um filtro automatizado nao substitui auditoria humana "
        "de cada texto antes de compartilhamento publico.\n"
        "- Nao reproduza nem implante estes arquivos como infraestrutura "
        "de producao sem revisao tecnica e sem segredos gerenciados fora do codigo.\n\n"
        + production_info + "\n"
    )

def section(path: str, contents: str) -> str:
    fence = "~" * max(7, max((len(run) + 2 for run in re.findall(r"~+", contents)), default=0))
    lang = LANGUAGES.get(Path(path).suffix, "text")
    return "\n## Arquivo: " + path + "\n\n" + fence + lang + "\n" + contents.rstrip() + "\n" + fence + "\n"

def write_markdown(path: Path, title: str, selected: list[str]) -> None:
    with path.open("w", encoding="utf-8") as out:
        out.write(md_header(title, selected))
        out.write("## Indice de arquivos\n\n")
        for file in selected:
            out.write("- " + file + "\n")
        out.write("\n## Codigo e configuracoes\n")
        for file in selected:
            out.write(section(file, files[file]))

all_paths = sorted(files)
backend_paths = [name for name in all_paths if is_backend(name)]
write_markdown(
    OUT / "Januario_Leads_Repositorio_Sanitizado_MyHub.md",
    "Januario Leads - codigo e arquitetura para auditoria MyHub IA",
    all_paths,
)
write_markdown(
    OUT / "Januario_Leads_Backend_Supabase_Sanitizado_MyHub.md",
    "Januario Leads - backend Supabase para auditoria MyHub IA",
    backend_paths,
)

# Optional full folder structure for tools able to inspect TAR.GZ (not ZIP).
archive = OUT / "Januario_Leads_Codigo_Sanitizado.tar.gz"
with tarfile.open(archive, "w:gz") as tf:
    for name in all_paths:
        data = files[name].encode("utf-8")
        info = tarfile.TarInfo(name)
        info.size = len(data)
        info.mode = 0o644
        info.mtime = 0
        tf.addfile(info, io.BytesIO(data))

manifest = {
    "repository": REPOSITORY,
    "source_main_commit": SOURCE_COMMIT,
    "created_utc": today,
    "text_files_in_repo_bundle": len(all_paths),
    "text_files_in_backend_bundle": len(backend_paths),
    "paths_redacted": redactions,
    "binary_or_invalid_omissions": excluded_binary_or_invalid,
    "intentional_omissions": [".env and variants", "credentials", "private keys",
                               "binary assets", "production rows", "deployed secrets"],
}
(OUT / "resumo_exportacao.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
for item in sorted(OUT.iterdir()):
    print(item.name, item.stat().st_size, "bytes")
print("MASKED_FILE_COUNT", len(redactions))
print("EXPORTED_FILES", len(all_paths), "BACKEND_FILES", len(backend_paths))
