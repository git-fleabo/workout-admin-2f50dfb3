-- The Simple Strength prototype is unused by workout-admin and all tables are
-- empty. Drop children before their parent tables to preserve FK dependencies.
drop table if exists public.simple_strength_template_entry_variations;
drop table if exists public.simple_strength_template_entries;
drop table if exists public.simple_strength_templates;
drop table if exists public.simple_strength_progression_state;
drop table if exists public.simple_strength_progression_configs;
drop table if exists public.simple_strength_rotation_rule_variations;
drop table if exists public.simple_strength_rotation_rules;
drop table if exists public.simple_strength_in_progress_sessions;
drop table if exists public.simple_strength_messages;
drop table if exists public.simple_strength_personal_bests;
drop table if exists public.simple_strength_settings;
