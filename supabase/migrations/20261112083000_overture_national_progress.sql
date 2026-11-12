-- Explicitly track all 27 Brazilian federal units as planned, never as imported.
insert into public.overture_import_progress (state, status, imported_rows)
select code, 'pending', 0 from unnest(array[
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
]) as code
on conflict (state) do nothing;
