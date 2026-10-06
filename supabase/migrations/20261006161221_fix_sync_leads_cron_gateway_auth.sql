-- The server-side Vault secret "sync_leads_gateway_key" must exist
-- in the target environment. It contains a publishable/anon gateway key,
-- never a service-role key.
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
    schedule := '0 */8 * * *',
    command := $command$
      select net.http_post(
        url := (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'januarioleads_project_url'
          limit 1
        ) || '/functions/v1/sync-leads',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'sync_leads_gateway_key'
            limit 1
          ),
          'Authorization', 'Bearer ' || (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'sync_leads_gateway_key'
            limit 1
          ),
          'x-sync-secret', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'sync_leads_cron_secret'
            limit 1
          )
        ),
        body := jsonb_build_object(
          'source', 'sync-leads-daily',
          'scheduledAt', now()
        ),
        timeout_milliseconds := 15000
      ) as request_id;
    $command$
  );
end
$$;
