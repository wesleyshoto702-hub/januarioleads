-- Executar somente com acesso administrativo ao banco do Januário Leads.
-- Mantém a tarefa cadastrada para eventual reavaliação, mas impede novas
-- execuções automáticas de consulta ao Google Places.
-- A operação é idempotente: executar novamente mantém active=false.
do $$
declare
  v_job_count integer;
  v_job_id bigint;
begin
  select count(*), min(jobid)
    into v_job_count, v_job_id
  from cron.job
  where jobname = 'sync-leads-daily'
    and command like '%/functions/v1/sync-leads%';

  if v_job_count <> 1 then
    raise exception 'Expected exactly one sync-leads cron job, found %', v_job_count;
  end if;

  perform cron.alter_job(job_id := v_job_id, active := false);
end
$$;

-- Conferir o resultado antes de encerrar a manutenção.
select jobid, jobname, schedule, active
from cron.job
where jobname = 'sync-leads-daily';
