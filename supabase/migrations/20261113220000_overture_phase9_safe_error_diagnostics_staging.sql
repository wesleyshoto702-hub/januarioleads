-- Januário Leads / HOMOLOGAÇÃO: diagnóstico seguro da retomada na Fase 9.
-- Mantém os 40 checkpoints anteriores e não modifica nenhum registro Overture.
alter table public.overture_phase9_attempts
  add column if not exists error_code text;
alter table public.overture_phase9_attempts
  add constraint overture_phase9_error_code_maxlen check (error_code is null or length(error_code) <= 80);
comment on column public.overture_phase9_attempts.error_code is
  'Código técnico sanitizado da última falha, sem URL, chave, traceback ou mensagem externa.';
