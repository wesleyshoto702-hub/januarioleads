# Fechamento operacional do JanuarioLeads — 03/11/2026

## Verificações feitas sem alterar dados de clientes

- [x] Auditoria de todas as 27 versões remotas históricas; 15 SQLs
  preservados em `docs/migration-history/recovered/` (não executáveis)
  e 12 mantidos somente no ledger original por segurança.
- [x] Gate automático de migrações via
  `scripts/verify-migration-ledger.py` e testes de integridade/RLS.
  Histórico esperado: 51 registros remotos, 24 arquivos em
  `supabase/migrations/`, 27 versões remotas somente no ledger.
- [x] Testes descartáveis de isolamento de duas contas em PostgreSQL real.
- [x] Workflow para duas contas em Auth/PostgREST de staging, com proteção
  contra uso do ID do projeto de produção.
- [x] BFF HttpOnly opcional com cookie AES-256-GCM e proxy RLS, integrado
  na `main` por PR #22 com testes simulados aprovados.
- [x] Verificação pública Vercel (HTTP 200, CSP nonce, HSTS).
- [x] Confirmado no Supabase: 197 leads, 2 contas autorizadas, 51
  migrações e 0 tabelas físicas `public` sem RLS.

## Dependências externas — sem aprovação de ativação

1. **Homologação Supabase real:** falta provisionar um ambiente
   independente, duas contas fictícias autorizadas e seus secrets.
   Possíveis custos não devem ser assumidos sem autorização.
   [Procedimento](staging-two-accounts.md).
2. **Ativar HttpOnly em staging e validar:** o modo novo está **desligado
   por padrão** na aplicação. Não foi feita migração/rotação de sessões
   de produção nem validação do BFF com Auth real.
   [Plano](session-security-migration.md).
3. **Banco:** as 27 versões remotas só serão conciliadas para uso de
   `db push` após baseline e restore testados no Supabase completo.
   Não preencher lacunas com migrações vazias ou dados sensíveis.
4. **Lovable:** Vercel está acessível, mas a sincronização interna e
   versão exata de commit do editor Lovable não foram demonstradas.

## Política de segurança

Não executar `supabase db push`, reset ou reparos de lote em produção.
Não ativar `VITE_HTTPONLY_SESSION` e `BFF_HTTPONLY_ENABLED` em produção
antes de aprovar testes reais e plano de rollback.
Não criar projeto/branch com custo nem usar credenciais de cliente sem
autorização. Não expor segredos no GitHub ou chat.

### Evidências

- [CI da branch principal após PR #22](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/41747240991)
- [CI do BFF opcional](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/41746972548)
- [CI do endereço público](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/41747061455)
- [Auditoria das migrações](migration-history-review-23.md)
