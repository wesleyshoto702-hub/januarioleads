do $$
declare
  v_job_count integer;
  v_job_id bigint;
begin
  select count(*), min(jobid)
    into v_job_count, v_job_id
  from cron.job
  where active = true
    and (
      jobname = 'sync-leads-daily'
      or command like '%/functions/v1/sync-leads%'
    );

  if v_job_count <> 1 then
    raise exception 'Expected exactly one active sync-leads cron job, found %', v_job_count;
  end if;

  perform cron.alter_job(
    job_id := v_job_id,
    schedule := '0 */8 * * *'
  );
end
$$;
