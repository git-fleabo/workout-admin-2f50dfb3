alter table public.session_method_blocks
  add column if not exists block_duration_seconds integer
    check (block_duration_seconds is null or block_duration_seconds > 0),
  add column if not exists work_interval_seconds integer
    check (work_interval_seconds is null or work_interval_seconds >= 0),
  add column if not exists rest_interval_seconds integer
    check (rest_interval_seconds is null or rest_interval_seconds >= 0),
  add column if not exists completed_rounds integer
    check (completed_rounds is null or completed_rounds >= 0);

alter table public.session_method_blocks
  add constraint session_method_blocks_completed_within_plan_check
  check (completed_rounds is null or rounds is null or completed_rounds <= rounds);

revoke all privileges on table public.session_method_blocks from authenticated;
revoke all privileges on table public.session_method_block_entries from authenticated;
grant select, insert on table public.session_method_blocks to authenticated;
grant select, insert on table public.session_method_block_entries to authenticated;

drop policy if exists session_method_blocks_insert_accessible on public.session_method_blocks;
create policy session_method_blocks_insert_accessible
  on public.session_method_blocks for insert to authenticated
  with check (
    exists (
      select 1 from public.sessions session
      where session.id = session_id
        and app_private.person_is_accessible(session.person_id)
    )
    and exists (
      select 1 from public.training_methods method
      where method.id = training_method_id
        and method.family = session_method_blocks.family
        and (
          method.person_id is null
          or method.person_id = (
            select session.person_id
            from public.sessions session
            where session.id = session_id
          )
        )
    )
  );
