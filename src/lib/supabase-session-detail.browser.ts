import { getCurrentPerson } from "./supabase-people.browser";
import { supabasePublicSelect } from "./supabase-public";

export type SessionDetailSet = {
  setNumber: number | string | null;
  reps: number | string | null;
  weight: number | string | null;
  durationSeconds: number | string | null;
  rpe: number | string | null;
  restTime: string | null;
  assistanceType: string | null;
  assistanceDetail: string | null;
  quality: string | null;
  completed: boolean;
  segments: SessionDetailSetSegment[];
};

export type SessionDetailSetSegment = {
  methodName: string;
  segmentIndex: number | string;
  reps: number | string | null;
  weight: number | string | null;
  rpe: number | string | null;
  restAfterSeconds: number | string | null;
  rangeOfMotion: string | null;
};

export type SessionDetailMetric = {
  key: string;
  value: number | string | null;
  text: string | null;
  unit: string | null;
};

export type SessionDetailEntry = {
  id: string;
  name: string;
  workoutType: string | null;
  entryKind: string | null;
  progressionLevel: string | null;
  notes: string | null;
  completed: boolean;
  sets: SessionDetailSet[];
  metrics: SessionDetailMetric[];
};

export type SessionDetailMethodBlock = {
  id: string;
  methodName: string;
  family: string;
  rounds: number | string | null;
  restBetweenMovementsSeconds: number | string | null;
  restBetweenRoundsSeconds: number | string | null;
  memberEntryIds: string[];
};

export type SessionDetail = {
  id: string;
  date: string;
  title: string;
  completed: boolean;
  durationMinutes: number | string | null;
  intensity: string | null;
  rpe: number | string | null;
  notes: string | null;
  location: { name: string | null; kind: string | null } | null;
  entries: SessionDetailEntry[];
  methodBlocks: SessionDetailMethodBlock[];
};

type SessionDetailRecord = {
  id: string;
  session_date: string;
  title: string | null;
  completed: boolean;
  duration_minutes: number | string | null;
  intensity: string | null;
  rpe: number | string | null;
  notes: string | null;
  training_locations: { name: string | null; kind: string | null } | null;
  session_method_blocks: Array<{
    id: string;
    method_name: string;
    family: string;
    order_index: number | string | null;
    rounds: number | string | null;
    rest_between_movements_seconds: number | string | null;
    rest_between_rounds_seconds: number | string | null;
    session_method_block_entries: Array<{
      session_entry_id: string;
      sequence_index: number | string | null;
    }> | null;
  }> | null;
  session_entries: Array<{
    id: string;
    order_index: number | string | null;
    name: string;
    entry_kind: string | null;
    progression_level: string | null;
    notes: string | null;
    completed: boolean;
    activity_types: { name: string | null } | null;
    entry_sets: Array<{
      set_number: number | string | null;
      reps: number | string | null;
      weight: number | string | null;
      duration_seconds: number | string | null;
      rpe: number | string | null;
      rest_time: string | null;
      assistance_type: string | null;
      assistance_detail: string | null;
      quality: string | null;
      completed: boolean;
      entry_set_segments: Array<{
        method_name: string;
        segment_index: number | string;
        reps: number | string | null;
        weight: number | string | null;
        rpe: number | string | null;
        rest_after_seconds: number | string | null;
        range_of_motion: string | null;
      }> | null;
    }> | null;
    entry_metrics: Array<{
      metric_key: string;
      metric_value: number | string | null;
      metric_text: string | null;
      metric_unit: string | null;
    }> | null;
  }> | null;
};

const orderNumber = (value: number | string | null) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

export async function getSessionDetailClient(sessionId: string): Promise<SessionDetail> {
  const person = await getCurrentPerson();
  if (!person) throw new Error("This account is not linked to a training profile.");
  const rows = await supabasePublicSelect<SessionDetailRecord>("sessions", {
    select:
      "id,session_date,title,completed,duration_minutes,intensity,rpe,notes,training_locations(name,kind),session_method_blocks(id,method_name,family,order_index,rounds,rest_between_movements_seconds,rest_between_rounds_seconds,session_method_block_entries(session_entry_id,sequence_index)),session_entries(id,order_index,name,entry_kind,progression_level,notes,completed,activity_types(name),entry_sets(set_number,reps,weight,duration_seconds,rpe,rest_time,assistance_type,assistance_detail,quality,completed,entry_set_segments(method_name,segment_index,reps,weight,rpe,rest_after_seconds,range_of_motion)),entry_metrics(metric_key,metric_value,metric_text,metric_unit))",
    id: `eq.${sessionId}`,
    person_id: `eq.${person.id}`,
    limit: 1,
  });
  const session = rows[0];
  if (!session) throw new Error("This workout session could not be found.");

  return {
    id: session.id,
    date: session.session_date,
    title: session.title ?? "Workout",
    completed: session.completed,
    durationMinutes: session.duration_minutes,
    intensity: session.intensity,
    rpe: session.rpe,
    notes: session.notes,
    location: session.training_locations,
    methodBlocks: [...(session.session_method_blocks ?? [])]
      .sort((a, b) => orderNumber(a.order_index) - orderNumber(b.order_index))
      .map((block) => ({
        id: block.id,
        methodName: block.method_name,
        family: block.family,
        rounds: block.rounds,
        restBetweenMovementsSeconds: block.rest_between_movements_seconds,
        restBetweenRoundsSeconds: block.rest_between_rounds_seconds,
        memberEntryIds: [...(block.session_method_block_entries ?? [])]
          .sort((a, b) => orderNumber(a.sequence_index) - orderNumber(b.sequence_index))
          .map((member) => member.session_entry_id),
      })),
    entries: [...(session.session_entries ?? [])]
      .sort((a, b) => orderNumber(a.order_index) - orderNumber(b.order_index))
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        workoutType: entry.activity_types?.name ?? null,
        entryKind: entry.entry_kind,
        progressionLevel: entry.progression_level,
        notes: entry.notes,
        completed: entry.completed,
        sets: [...(entry.entry_sets ?? [])]
          .sort((a, b) => orderNumber(a.set_number) - orderNumber(b.set_number))
          .map((set) => ({
            setNumber: set.set_number,
            reps: set.reps,
            weight: set.weight,
            durationSeconds: set.duration_seconds,
            rpe: set.rpe,
            restTime: set.rest_time,
            assistanceType: set.assistance_type,
            assistanceDetail: set.assistance_detail,
            quality: set.quality,
            completed: set.completed,
            segments: [...(set.entry_set_segments ?? [])]
              .sort((a, b) => orderNumber(a.segment_index) - orderNumber(b.segment_index))
              .map((segment) => ({
                methodName: segment.method_name,
                segmentIndex: segment.segment_index,
                reps: segment.reps,
                weight: segment.weight,
                rpe: segment.rpe,
                restAfterSeconds: segment.rest_after_seconds,
                rangeOfMotion: segment.range_of_motion,
              })),
          })),
        metrics: (entry.entry_metrics ?? []).map((metric) => ({
          key: metric.metric_key,
          value: metric.metric_value,
          text: metric.metric_text,
          unit: metric.metric_unit,
        })),
      })),
  };
}
