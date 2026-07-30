alter table public.exercises
  add column if not exists position_measurement_guide text,
  add column if not exists position_measurement_label text,
  add column if not exists position_measurement_direction text;

alter table public.exercises
  drop constraint if exists exercises_position_measurement_guide_check,
  add constraint exercises_position_measurement_guide_check
    check (
      position_measurement_guide is null
      or position_measurement_guide in ('foam_cork_blocks')
    ),
  drop constraint if exists exercises_position_measurement_direction_check,
  add constraint exercises_position_measurement_direction_check
    check (
      position_measurement_direction is null
      or position_measurement_direction in ('lower', 'higher', 'neutral')
    );

comment on column public.exercises.position_measurement_guide is
  'Optional logger measurement aid. foam_cork_blocks uses the configured short-height block guide.';
comment on column public.exercises.position_measurement_label is
  'Exercise-specific label for a neutral position measurement, for example Head-to-floor.';
comment on column public.exercises.position_measurement_direction is
  'How Progress should interpret the position measurement: lower, higher, or neutral.';

update public.exercises
set
  position_measurement_guide = 'foam_cork_blocks',
  position_measurement_label = case
    when lower(name) = 'handstand pushups' then 'Head-to-floor'
    when lower(name) = 'front split' then 'Hip-to-floor'
    else position_measurement_label
  end,
  position_measurement_direction = 'lower'
where lower(name) in ('handstand pushups', 'front split');
