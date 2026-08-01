alter table public.program_assignment_exercises
  add column if not exists manual_adjustment_percent numeric not null default 0,
  add column if not exists manual_adjusted_at timestamptz;

alter table public.program_assignment_exercises
  drop constraint if exists program_assignment_exercises_manual_adjustment_check,
  add constraint program_assignment_exercises_manual_adjustment_check
    check (manual_adjustment_percent between -5 and 5);

create or replace function public.apply_programme_manual_adjustments(
  p_assignment_id uuid,
  p_adjustments jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  adjustment_item jsonb;
  exercise_id_value uuid;
  adjustment_value numeric;
  affected_rows integer;
  updated_count integer := 0;
begin
  if jsonb_typeof(p_adjustments) <> 'array' or jsonb_array_length(p_adjustments) = 0 then
    raise exception 'At least one programme adjustment is required.';
  end if;

  if not exists (
    select 1
    from public.program_assignments assignment
    where assignment.id = p_assignment_id
      and assignment.status in ('active', 'paused')
  ) then
    raise exception 'The active programme assignment was not found.';
  end if;

  for adjustment_item in
    select value from jsonb_array_elements(p_adjustments)
  loop
    exercise_id_value := (adjustment_item ->> 'exercise_id')::uuid;
    adjustment_value := (adjustment_item ->> 'manual_adjustment_percent')::numeric;

    if adjustment_value not in (-5, -2.5, 0, 2.5, 5) then
      raise exception 'Programme adjustments must use a supported 2.5-point step.';
    end if;

    update public.program_assignment_exercises exercise
    set manual_adjustment_percent = adjustment_value,
        manual_adjusted_at = case when adjustment_value = 0 then null else now() end
    where exercise.id = exercise_id_value
      and exercise.program_assignment_id = p_assignment_id
      and exercise.is_enabled;

    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'A programme exercise could not be updated.';
    end if;
    updated_count := updated_count + affected_rows;
  end loop;

  return updated_count;
end;
$$;

revoke all on function public.apply_programme_manual_adjustments(uuid, jsonb) from public;
revoke all on function public.apply_programme_manual_adjustments(uuid, jsonb) from anon;
grant execute on function public.apply_programme_manual_adjustments(uuid, jsonb) to authenticated;
