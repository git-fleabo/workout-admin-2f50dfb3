alter table public.session_entries
  add column if not exists grade text,
  add column if not exists grade_system text,
  add column if not exists send_type text,
  add column if not exists is_project boolean default false;

alter table public.session_entries
  drop constraint if exists session_entries_grade_system_check,
  add constraint session_entries_grade_system_check
    check (grade_system is null or grade_system in ('V-scale', 'Font', 'French', 'YDS')),
  drop constraint if exists session_entries_send_type_check,
  add constraint session_entries_send_type_check
    check (send_type is null or send_type in ('attempt', 'flash', 'onsight', 'redpoint'));

create or replace function public.sync_climbing_entry_metric()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  update public.session_entries
  set
    grade = case when new.metric_key = 'grade' then new.metric_text else grade end,
    grade_system = case when new.metric_key = 'grade_system' then new.metric_text else grade_system end,
    send_type = case when new.metric_key = 'send_type' then new.metric_text else send_type end,
    is_project = case when new.metric_key = 'is_project' then coalesce(new.metric_value <> 0, false) else is_project end
  where id = new.session_entry_id;
  return new;
end;
$$;

drop trigger if exists entry_metrics_sync_climbing_fields on public.entry_metrics;
create trigger entry_metrics_sync_climbing_fields
after insert or update of metric_key, metric_value, metric_text on public.entry_metrics
for each row execute function public.sync_climbing_entry_metric();

update public.session_entries as entry
set
  grade = metric.metric_text
from public.entry_metrics as metric
where metric.session_entry_id = entry.id
  and metric.metric_key = 'grade'
  and metric.metric_text is not null;

update public.session_entries as entry
set
  grade_system = metric.metric_text
from public.entry_metrics as metric
where metric.session_entry_id = entry.id
  and metric.metric_key = 'grade_system'
  and metric.metric_text is not null;

update public.session_entries as entry
set
  send_type = metric.metric_text
from public.entry_metrics as metric
where metric.session_entry_id = entry.id
  and metric.metric_key = 'send_type'
  and metric.metric_text is not null;

update public.session_entries as entry
set
  is_project = metric.metric_value <> 0
from public.entry_metrics as metric
where metric.session_entry_id = entry.id
  and metric.metric_key = 'is_project';
