-- Personal import for Noam. Source: lesson titles and links in the signed-in
-- Mobility & Flexibility Toolkit outline on 2026-09-30. No lesson content.
-- Run only after 20260930152741_expand_mobility_toolkit_sections.sql.
do $$
declare
  source record;
  target_exercise_id uuid;
  mobility_type_id uuid;
begin
  select id into strict mobility_type_id
  from public.activity_types where name = 'Mobility/Flexibility';

  for source in
    select * from (values
  ('pancake','2975050','9913300','Standing Pancake Hang | Contract Relax','Standing Pancake Hang | Contract Relax'),
  ('pancake','2975050','9913372','Straddle Jefferson Curl','Straddle Jefferson Curl'),
  ('pancake','2975050','11389755','Tailors Pose | Overview & Positioning','Tailors Pose | Overview & Positioning'),
  ('pancake','2975050','11389745','Tailors Pose | Progression & Underload','Tailors Pose | Progression & Underload'),
  ('pancake','2975050','2154200787','Tailors Pose | Straight Arm Lifts','Tailors Pose | Straight Arm Lifts'),
  ('pancake','2975050','13892871','Adductor Flyes','Adductor Flyes'),
  ('pancake','2975050','9913302','Drop Stance Squats','Drop Stance Squats'),
  ('pancake','2975050','9913325','Pancake Good Morning | Round Back','Pancake Good Morning | Round Back'),
  ('pancake','2975050','9913957','Pancake Straight Arm Lifts','Pancake Straight Arm Lifts'),
  ('pancake','2975050','9913286','Over Pancake Isometrics | Feet & Leg Elevated','Over Pancake Isometrics | Feet & Leg Elevated'),
  ('pancake','2975050','12388965','Pancake Lifts | Intro, Measuring & Progression','Pancake Lifts | Intro, Measuring & Progression'),
  ('pancake','2975050','9913303','Pancake Lifts | Single Leg','Pancake Lifts | Single Leg'),
  ('pancake','2975050','2174094467','Hip External Rotation Good Mornings','Hip External Rotation Good Mornings'),
  ('pancake','2975050','11389536','Rolling Out the Feet','Rolling Out the Feet'),
  ('pancake','2975050','14307055','Standing & Donkey Calf Stretches','Standing & Donkey Calf Stretches'),
  ('pancake','2975050','12492990','Standing Pike Good Morning','Pike Good Morning | Standing'),
  ('side_split','2371714','7877763','Horse Stance Slides','Horse Stance Slides'),
  ('side_split','2371714','2154926708','Slide to Side Split','Slide to Side Split'),
  ('side_split','2371714','7877766','Tailors Pose | Overview & Positioning','Tailors Pose | Overview & Positioning'),
  ('side_split','2371714','10737490','Tailors Pose | Progression & Underload','Tailors Pose | Progression & Underload'),
  ('side_split','2371714','2154200133','Tailors Pose | Straight Arm Lifts','Tailors Pose | Straight Arm Lifts'),
  ('side_split','2371714','2194899293','Pancake Good Morning | Round Back','Pancake Good Morning | Round Back'),
  ('side_split','2371714','7877790','Adductor Flyes','Adductor Flyes'),
  ('side_split','2371714','7877767','Horse Stance Squats | Overview & Positioning','Horse Stance Squats | Overview & Positioning'),
  ('side_split','2371714','7925523','Horse Stance Squats | How to Measure & Progress','Horse Stance Squats | How to Measure & Progress'),
  ('side_split','2371714','10639260','Drop Stance Squats','Drop Stance Squats'),
  ('side_split','2371714','7877788','Straight Leg Get Ups | Hands Free','Straight Leg Get Ups | Hands Free'),
  ('side_split','2371714','10800152','Straight Leg Get Ups (Straddle Ups) | Hands Assisted','Straight Leg Get Ups (Straddle Ups) | Hands Assisted'),
  ('side_split','2371714','7877801','Kneeling Tilt | Measuring & Progression','Kneeling Tilt | Measuring & Progression'),
  ('side_split','2371714','10800160','Kneeling Tilt | Closed Hip','Kneeling Tilt | Closed Hip'),
  ('side_split','2371714','7877792','Isometric Side Split','Isometric Side Split'),
  ('side_split','2371714','2179160178','Supported Side Split','Supported Side Split'),
  ('side_split','2371714','8826693','Side Split Contract Relax','Side Split Contract Relax'),
  ('side_split','2371714','10639199','Standing Pancake Hang | Contract Relax','Standing Pancake Hang | Contract Relax'),
  ('side_split','2371714','2174097540','Hip External Rotation Good Mornings','Hip External Rotation Good Mornings'),
  ('front_split','2150479520','2159008298','Isometric Front Split','Isometric Front Split'),
  ('front_split','2150479520','2159045100','Front Split Slides','Front Split Slides'),
  ('front_split','2150479520','2160948382','Blocked Hip Extension','Blocked Hip Extension'),
  ('front_split','2150479520','2162104346','Couch Stretch | Hips Low','Couch Stretch | Hips Low'),
  ('front_split','2150479520','2159045111','Couch Stretch | Hips High','Couch Stretch | Hips High'),
  ('front_split','2150479520','2160948416','Reverse Nordic Curls','Reverse Nordic Curls'),
  ('front_split','2150479520','2169549760','Kneeling Needle','Kneeling Needle'),
  ('front_split','2150479520','2158405375','Jefferson Curl','Jefferson Curl'),
  ('front_split','2150479520','2158405383','Pike Good Morning | Standing','Pike Good Morning | Standing'),
  ('front_split','2150479520','2158405387','Pike Good Morning | B-Stance','Pike Good Morning | B-Stance'),
  ('front_split','2150479520','2158405385','Pike Good Morning | Leg Elevated','Pike Good Morning | Leg Elevated'),
  ('front_split','2150479520','2158405378','Leg Elevated Pike Lift | CRACR','Leg Elevated Pike Lift | CRACR'),
  ('front_split','2150479520','2168445599','Split Squats','Split Squats'),
  ('front_split','2150479520','2169247351','B-Stance Rotating RDL','B-Stance Rotating RDL'),
  ('front_split','2150479520','2173699602','Rec Fem Pin & Stretch','Rec Fem Pin & Stretch'),
  ('shoulder','2975118','9913541','Straps Grip Band Routine | Overview & Setup','Straps Grip Band Routine | Overview & Setup'),
  ('shoulder','2975118','9913572','Straps Grip Band Routine | Library','Straps Grip Band Routine | Library'),
  ('shoulder','2975118','9913543','Straps Grip Band Routine | Variations','Straps Grip Band Routine | Variations'),
  ('shoulder','2975118','2162768893','Pillar Lat Stretch | Vertical Setup','Pillar Lat Stretch | Vertical Setup'),
  ('shoulder','2975118','9913624','Lat Stretch | Standing & Lying','Lat Stretch | Standing & Lying'),
  ('shoulder','2975118','2154925509','Pec Stretch | Loaded','Pec Stretch | Loaded'),
  ('shoulder','2975118','9913619','Pec Stretch | Passive, Contract Relax & End Range Lift Offs','Pec Stretch | Passive, Contract Relax & End Range Lift Offs'),
  ('shoulder','2975118','2172347706','Inlocates & Dislocates | Open Kinetic Chain','Inlocates & Dislocates | Open Kinetic Chain'),
  ('shoulder','2975118','12406117','Stretching in External Rotation | Contract Relax','Stretching in External Rotation | Contract Relax'),
  ('shoulder','2975118','2174035391','Stick External Rotation','Stick External Rotation'),
  ('shoulder','2975118','2185293973','Overhead Stick External Rotation','Overhead Stick External Rotation'),
  ('shoulder','2975118','12406779','Stretching in Internal Rotation | Contract Relax','Stretching in Internal Rotation | Contract Relax'),
  ('shoulder','2975118','2161379148','Sleeper Stretch | Internal Rotation','Sleeper Stretch | Internal Rotation'),
  ('shoulder','2975128','9913577','Hanging | Passive & Active Hang','Hanging | Passive & Active Hang'),
  ('shoulder','2975227','9913564','Elbow on Knee External Rotation | Dumbbell','Elbow on Knee External Rotation | Dumbbell'),
  ('shoulder','2975227','9913962','Powell Raises | Overview & Positioning','Powell Raises | Overview & Positioning'),
  ('shoulder','2975227','12612204','Lower Trap (Trap-3) & Upper Trap (Trap-1) Raises','Lower Trap (Trap-3) & Upper Trap (Trap-1) Raises'),
  ('shoulder','2975227','2157807647','Front Raises','Front Raises'),
  ('shoulder','2975227','2163597065','Horizontal & Prone Scapula Strength Variations','Horizontal & Prone Scapula Strength Variations')
    ) as entries(skill, category_id, post_id, source_name, exercise_name)
  loop
    -- Keep existing movements and tracking settings whenever names match.
    select e.id into target_exercise_id
    from public.exercises e
    left join public.activity_types a on a.id = e.activity_type_id
    where e.name = source.exercise_name and e.is_active
    order by (a.name = 'Mobility/Flexibility') desc, e.created_at desc
    limit 1;

    if target_exercise_id is null then
      insert into public.exercises (
        activity_type_id, focus_area, name, default_metric, circuit_suitability
      ) values (
        mobility_type_id,
        initcap(replace(source.skill, '_', ' ')),
        source.exercise_name,
        case
          when source.exercise_name ~* '(stretch|isometric|hang|pose)' then 'hold'
          else 'reps_only'
        end,
        'excluded'
      ) returning id into target_exercise_id;
    end if;

    insert into public.person_exercises (person_id, exercise_id, is_enabled, location_scope)
    values ('c497a408-8f8a-4efb-903a-5c2109d96797', target_exercise_id, true, 'both')
    on conflict (person_id, exercise_id) do update set is_enabled = true;

    insert into public.person_exercise_toolkit_lessons (
      person_id, exercise_id, skill, lesson_url
    ) values (
      'c497a408-8f8a-4efb-903a-5c2109d96797',
      target_exercise_id,
      source.skill,
      'https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/'
        || source.category_id || '/posts/' || source.post_id
    ) on conflict (person_id, exercise_id, skill) do update
      set lesson_url = excluded.lesson_url;
  end loop;
end $$;
