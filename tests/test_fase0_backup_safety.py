"""Offline, non-destructive safety checks for phase-0 local backup script."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "fase0-backup-producao.ps1"
DOC = ROOT / "docs" / "FASE-0-SEGURANCA-BACKUP-2026-11-15.md"

class PhaseZeroBackupSafety(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.script = SCRIPT.read_text(encoding="utf-8")
        cls.docs = DOC.read_text(encoding="utf-8")

    def test_prod_only_and_explicit_confirmation(self):
        self.assertIn("$projectRef = 'czkazbianiflhldenhcj'", self.script)
        self.assertIn("$expectedDirectHost = 'db.czkazbianiflhldenhcj.supabase.co'", self.script)
        self.assertIn("$expectedPoolerUser = 'postgres.czkazbianiflhldenhcj'", self.script)
        self.assertIn("BACKUP_PRODUCAO", self.script)
        self.assertIn("Host nao autorizado", self.script)
        self.assertIn("[ValidateSet('Check','Backup')]", self.script)

    def test_no_plaintext_passwords_or_uploads(self):
        self.assertIn("Read-Host 'Senha de BANCO DE DADOS da PRODUCAO (campo oculto)' -AsSecureString", self.script)
        self.assertIn("Remove-Item Env:PGPASSWORD", self.script)
        self.assertIn("ZeroFreeBSTR", self.script)
        self.assertIn("$env:PGSSLMODE = 'require'", self.script)
        self.assertNotIn("--password=", self.script)
        for forbidden in ("git push", "supabase storage", "Invoke-WebRequest",
                          "curl ", "DROP TABLE", "ALTER TABLE", "DELETE FROM"):
            self.assertNotIn(forbidden, self.script)

    def test_dump_is_readonly_encrypted_and_verified(self):
        for marker in ("--schema', 'public'", "--schema', 'auth'", "--schema', 'storage'",
                       "--format', 'custom'", "pg_restore --list",
                       "gpg --no-symkey-cache --symmetric --cipher-algo AES256",
                       "gpg --no-symkey-cache --decrypt", "Remove-Item -LiteralPath $tempDump"):
            self.assertIn(marker, self.script)
        self.assertIn("isolated_database_restore_verified = $false", self.script)
        self.assertIn("Backup real", self.docs)
        self.assertIn("ainda não foi executado", self.docs)
        self.assertIn("não inclui bytes de objetos Storage", self.docs)

if __name__ == "__main__":
    unittest.main()
