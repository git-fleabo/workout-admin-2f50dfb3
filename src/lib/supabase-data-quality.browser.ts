import {
  classifySessionGroups,
  normalizeExerciseName,
  resolveReviewedAlias,
  type DataShape,
  type GroupingSession,
  type LoadSemantics,
  type VolumeStatus,
} from "./data-quality";
import { getCurrentPerson } from "./supabase-people.browser";
import { supabasePublicRpc, supabasePublicSelect } from "./supabase-public";

type SetRecord = {
  id: string;
  set_number: number | string | null;
  reps: number | string | null;
  weight: number | string | null;
  duration_seconds: number | string | null;
  distance: number | string | null;
  distance_unit: string | null;
  rpe: number | string | null;
  rest_seconds: number | string | null;
  rest_time: string | null;
  assistance_type: string | null;
  assistance_detail: string | null;
  quality: string | null;
  notes: string | null;
  data_shape: DataShape | null;
  aggregate_set_count: number | string | null;
  load_semantics: LoadSemantics | null;
  volume_status: VolumeStatus | null;
  implement_count: number | string | null;
  entry_set_segments: Array<{ id: string }> | null;
};

type EntryRecord = {
  id: string;
  exercise_id: string | null;
  activity_type_id: string | null;
  name: string;
  source_sheet: string | null;
  source_row: number | null;
  activity_types: { name: string | null } | null;
  exercises: { name: string; equipment: string | null } | null;
  entry_sets: SetRecord[] | null;
  entry_metrics: Array<{ id: string }> | null;
};

type SessionRecord = {
  id: string;
  person_id: string;
  session_date: string;
  title: string | null;
  source: string;
  source_sheet: string | null;
  source_row: number | null;
  created_at: string;
  training_location_id: string | null;
  duration_minutes: number | string | null;
  rpe: number | string | null;
  activity_type_id: string | null;
  session_entries: EntryRecord[] | null;
};

type ExerciseRecord = {
  id: string;
  name: string;
  equipment: string | null;
  activity_type_id: string | null;
  is_active: boolean;
};

type AliasRecord = {
  id: string;
  alias_name: string;
  normalized_alias: string;
  exercise_id: string;
  status: string;
  exercises: { name: string } | null;
};

export type DataQualityRow = {
  id: string;
  date: string | null;
  title: string;
  detail: string;
  confidence?: "high" | "ambiguous" | "manual";
  fix?: DataQualityFix;
};

export type DataQualityFix =
  | { action: "link_exercise"; entityId: string }
  | {
      action: "update_session_metadata";
      entityId: string;
      durationMinutes: number | null;
      rpe: number | null;
    }
  | {
      action: "classify_load";
      entityId: string;
      weight: number;
      loadSemantics: LoadSemantics | null;
      implementCount: number | null;
      equipment: string | null;
    }
  | { action: "clear_session_provenance"; entityId: string }
  | { action: "clear_entry_provenance"; entityId: string }
  | { action: "delete_empty_set"; entityId: string };

export type DataQualityCategory = {
  key:
    | "unlinked"
    | "aggregate"
    | "empty"
    | "missing"
    | "weight"
    | "provenance"
    | "duplicates"
    | "grouping";
  title: string;
  description: string;
  rows: DataQualityRow[];
};

const numberOrNull = (value: unknown) => {
  if (value == null || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function setHasDose(set: SetRecord) {
  return [set.reps, set.weight, set.duration_seconds, set.distance].some(
    (value) => numberOrNull(value) != null,
  );
}

function setIsStrictlyEmpty(set: SetRecord) {
  return (
    !setHasDose(set) &&
    numberOrNull(set.rpe) == null &&
    numberOrNull(set.rest_seconds) == null &&
    [set.rest_time, set.assistance_type, set.assistance_detail, set.quality, set.notes].every(
      (value) => !value?.trim(),
    ) &&
    !(set.entry_set_segments?.length ?? 0)
  );
}

function displayNumber(value: unknown) {
  const number = numberOrNull(value);
  return number == null ? "—" : Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function sessionEntryRows(sessions: SessionRecord[]) {
  return sessions.flatMap((session) =>
    (session.session_entries ?? []).map((entry) => ({ session, entry })),
  );
}

export async function getDataQualityAuditClient() {
  const person = await getCurrentPerson();
  if (!person) throw new Error("This account is not linked to a training profile.");

  const [sessions, exercises, aliases] = await Promise.all([
    supabasePublicSelect<SessionRecord>("sessions", {
      select:
        "id,person_id,session_date,title,source,source_sheet,source_row,created_at,training_location_id,duration_minutes,rpe,activity_type_id,session_entries(id,exercise_id,activity_type_id,name,source_sheet,source_row,activity_types(name),exercises(name,equipment),entry_sets(id,set_number,reps,weight,duration_seconds,distance,distance_unit,rpe,rest_seconds,rest_time,assistance_type,assistance_detail,quality,notes,data_shape,aggregate_set_count,load_semantics,volume_status,implement_count,entry_set_segments(id)),entry_metrics(id))",
      person_id: `eq.${person.id}`,
      completed: "eq.true",
      order: "session_date.desc,created_at.desc",
      limit: 2000,
    }),
    supabasePublicSelect<ExerciseRecord>("exercises", {
      select: "id,name,equipment,activity_type_id,is_active",
      is_active: "eq.true",
      order: "name.asc",
      limit: 2000,
    }),
    supabasePublicSelect<AliasRecord>("exercise_aliases", {
      select: "id,alias_name,normalized_alias,exercise_id,status,exercises(name)",
      order: "alias_name.asc",
      limit: 2000,
    }),
  ]);

  const entryRows = sessionEntryRows(sessions);
  const unlinked = entryRows
    .filter(({ entry }) => !entry.exercise_id)
    .map(({ session, entry }) => {
      const alias = resolveReviewedAlias(
        entry.name,
        aliases.map((candidate) => ({
          ...candidate,
          aliasName: candidate.alias_name,
        })),
      );
      return {
        id: entry.id,
        date: session.session_date,
        title: entry.name,
        detail: alias
          ? `Reviewed alias → ${alias.exercises?.name ?? alias.exercise_id}`
          : "No reviewed exact alias. Manual decision required.",
        confidence: alias ? ("high" as const) : ("manual" as const),
        fix: { action: "link_exercise" as const, entityId: entry.id },
      };
    });

  const aggregate = entryRows.flatMap(({ session, entry }) =>
    (entry.entry_sets ?? [])
      .filter(
        (set) =>
          set.data_shape === "aggregate" ||
          (numberOrNull(set.reps) ?? 0) > 12 ||
          set.data_shape === "unknown",
      )
      .map((set) => ({
        id: set.id,
        date: session.session_date,
        title: entry.name,
        detail:
          set.data_shape === "aggregate"
            ? `${displayNumber(set.aggregate_set_count)} sets · ${displayNumber(set.reps)} total reps · ${displayNumber(set.weight)} kg`
            : `${displayNumber(set.reps)} reps · shape ${set.data_shape ?? "unknown"}`,
        confidence: set.data_shape === "aggregate" ? ("high" as const) : ("ambiguous" as const),
      })),
  );

  const emptySets = entryRows.flatMap(({ session, entry }) =>
    (entry.entry_sets ?? [])
      .filter((set) => !setHasDose(set))
      .map((set) => ({
        id: set.id,
        date: session.session_date,
        title: entry.name,
        detail:
          numberOrNull(set.rpe) == null
            ? "Strictly empty set row"
            : `RPE-only row · RPE ${set.rpe}`,
        confidence: "ambiguous" as const,
        fix: setIsStrictlyEmpty(set)
          ? ({ action: "delete_empty_set" as const, entityId: set.id } satisfies DataQualityFix)
          : undefined,
      })),
  );
  const emptyEntries = entryRows
    .filter(({ entry }) => !(entry.entry_sets?.length ?? 0) && !(entry.entry_metrics?.length ?? 0))
    .map(({ session, entry }) => ({
      id: entry.id,
      date: session.session_date,
      title: entry.name,
      detail: "Entry has neither sets nor metrics.",
      confidence: "manual" as const,
    }));

  const missing = sessions
    .filter(
      (session) =>
        numberOrNull(session.duration_minutes) == null || numberOrNull(session.rpe) == null,
    )
    .map((session) => ({
      id: session.id,
      date: session.session_date,
      title: session.title?.trim() || "Workout",
      detail: [
        numberOrNull(session.duration_minutes) == null ? "duration" : "",
        numberOrNull(session.rpe) == null ? "final RPE" : "",
      ]
        .filter(Boolean)
        .join(" and ")
        .concat(" missing"),
      confidence: "manual" as const,
      fix: {
        action: "update_session_metadata" as const,
        entityId: session.id,
        durationMinutes: numberOrNull(session.duration_minutes),
        rpe: numberOrNull(session.rpe),
      },
    }));

  const weight = entryRows.flatMap(({ session, entry }) =>
    (entry.entry_sets ?? [])
      .filter(
        (set) =>
          numberOrNull(set.weight) != null &&
          (set.load_semantics === "unknown" ||
            set.volume_status === "ambiguous" ||
            entry.exercises?.equipment?.toLowerCase().includes("dumbbell")),
      )
      .map((set) => ({
        id: set.id,
        date: session.session_date,
        title: entry.name,
        detail: `${displayNumber(set.weight)} kg · ${set.load_semantics ?? "unknown semantics"} · ${entry.exercises?.equipment ?? "uncatalogued equipment"}`,
        confidence: "ambiguous" as const,
        fix: {
          action: "classify_load" as const,
          entityId: set.id,
          weight: numberOrNull(set.weight)!,
          loadSemantics: set.load_semantics,
          implementCount: numberOrNull(set.implement_count),
          equipment: entry.exercises?.equipment ?? null,
        },
      })),
  );

  const provenance = [
    ...sessions
      .filter(
        (session) =>
          session.source === "manual" && (session.source_sheet || session.source_row != null),
      )
      .map((session) => ({
        id: session.id,
        date: session.session_date,
        title: session.title?.trim() || "Workout",
        detail: `Native session carries ${session.source_sheet ?? `source row ${session.source_row}`}`,
        confidence: "high" as const,
        fix: { action: "clear_session_provenance" as const, entityId: session.id },
      })),
    ...entryRows
      .filter(
        ({ session, entry }) =>
          session.source === "manual" && (entry.source_sheet || entry.source_row != null),
      )
      .map(({ session, entry }) => ({
        id: entry.id,
        date: session.session_date,
        title: entry.name,
        detail: `Native movement carries ${entry.source_sheet ?? `source row ${entry.source_row}`}`,
        confidence: "high" as const,
        fix: { action: "clear_entry_provenance" as const, entityId: entry.id },
      })),
  ];

  const names = new Map<string, Array<{ id: string; label: string; kind: string }>>();
  for (const exercise of exercises) {
    const key = normalizeExerciseName(exercise.name);
    const rows = names.get(key) ?? [];
    rows.push({ id: exercise.id, label: exercise.name, kind: "canonical" });
    names.set(key, rows);
  }
  for (const alias of aliases.filter((row) => row.status === "reviewed")) {
    const rows = names.get(alias.normalized_alias) ?? [];
    rows.push({ id: alias.id, label: alias.alias_name, kind: "alias" });
    names.set(alias.normalized_alias, rows);
  }
  const duplicates = Array.from(names.entries())
    .filter(([, rows]) => new Set(rows.map((row) => row.id)).size > 1)
    .map(([key, rows]) => ({
      id: key,
      date: null,
      title: rows.map((row) => row.label).join(" / "),
      detail: rows.map((row) => `${row.kind}: ${row.id}`).join(" · "),
      confidence: "manual" as const,
    }));

  const singleEntrySessions: GroupingSession[] = sessions.flatMap((session) => {
    const entries = session.session_entries ?? [];
    if (entries.length !== 1) return [];
    const entry = entries[0]!;
    return [
      {
        id: session.id,
        personId: session.person_id,
        date: session.session_date,
        source: session.source,
        sourceSheet: session.source_sheet,
        sourceRow: session.source_row,
        createdAt: session.created_at,
        locationId: session.training_location_id,
        durationMinutes: numberOrNull(session.duration_minutes),
        entryName: entry.name,
        activityName: entry.activity_types?.name ?? "",
      },
    ];
  });
  const grouping = classifySessionGroups(singleEntrySessions).map((group) => ({
    id: group.key,
    date: group.sessions[0]?.date ?? null,
    title: group.sessions.map((session) => session.entryName).join(" + "),
    detail: `${group.sessions.length} sessions · ${group.sessions.map((session) => session.id).join(", ")}`,
    confidence: group.confidence,
  }));

  const categories: DataQualityCategory[] = [
    {
      key: "unlinked",
      title: "Unlinked exercise entries",
      description: "Historical movement names without a canonical exercise ID.",
      rows: unlinked,
    },
    {
      key: "aggregate",
      title: "Aggregate and suspicious sets",
      description:
        "Historical totals and high-repetition rows that must not become synthetic sets.",
      rows: aggregate,
    },
    {
      key: "empty",
      title: "Empty sets and entries",
      description: "Strictly empty, RPE-only, and movement rows without measurable detail.",
      rows: [...emptySets, ...emptyEntries],
    },
    {
      key: "missing",
      title: "Missing duration and final RPE",
      description: "Prompts for future review; no values are inferred.",
      rows: missing,
    },
    {
      key: "weight",
      title: "Ambiguous weight semantics",
      description: "Loads that cannot safely be compared or doubled without review.",
      rows: weight,
    },
    {
      key: "provenance",
      title: "Native rows with sheet labels",
      description: "Supabase-native records still carrying operational spreadsheet fields.",
      rows: provenance,
    },
    {
      key: "duplicates",
      title: "Canonical and alias collisions",
      description: "Exact normalized-name collisions requiring an explicit decision.",
      rows: duplicates,
    },
    {
      key: "grouping",
      title: "Same-day grouping candidates",
      description: "Strict high-confidence candidates are separated from ambiguous sessions.",
      rows: grouping,
    },
  ];

  return {
    capturedAt: new Date().toISOString(),
    sessionCount: sessions.length,
    exerciseOptions: exercises.map(({ id, name, activity_type_id }) => ({
      id,
      name,
      activityTypeId: activity_type_id,
    })),
    categories,
  };
}

export function applyDataQualityFixClient(
  action: DataQualityFix["action"],
  entityId: string,
  payload: Record<string, unknown> = {},
) {
  return supabasePublicRpc<{
    ok: true;
    batch_id: string;
    action: DataQualityFix["action"];
    entity_table: string;
    entity_id: string;
  }>("apply_data_quality_fix", {
    p_action: action,
    p_entity_id: entityId,
    p_payload: payload,
  });
}
