-- Older frontends may see the new shared scaffold in their generic picker.
-- Personal setup inserts a paused assignment, then its complete editable plan.
create function app_private.guard_dup_personal_setup() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.status='active'
    and exists(select 1 from public.programs where id=new.program_id and method_type='base_strength_dup')
    and not exists(select 1 from public.personal_programmes where assignment_id=new.id) then
    raise exception 'Set up DUP through Explore Base Strength before starting this programme.';
  end if;
  return new;
end; $$;
revoke all on function app_private.guard_dup_personal_setup() from public, anon;
grant execute on function app_private.guard_dup_personal_setup() to authenticated;

-- PostgreSQL runs same-event triggers in name order. This guard runs before
-- pause_new_base_strength_run so a generic active insert cannot become an empty run.
create trigger guard_dup_personal_setup before insert or update of status,program_id
on public.program_assignments for each row execute function app_private.guard_dup_personal_setup();
