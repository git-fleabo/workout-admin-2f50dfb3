import { supabasePublicSelect } from "./supabase-public";
import { claimNoamProfile, getCurrentPerson } from "./supabase-people.browser";

type ActivityTypeRef = { name: string | null } | null;

type EntrySetRecord = {
  set_number: number | string | null;
  reps: number | string | null;
  weight: number | string | null;
  duration_seconds: number | string | null;
  rpe: number | string | null;
  rest_time: string | null;
  assistance_type: string | null;
  assistance_detail: string | null;
  quality: string | null;
  completed: boolean | null;
  entry_set_segments: Array<{
    method_name: string;
    reps: number | string | null;
    weight: number | string | null;
    range_of_motion: string | null;
  }> | null;
};

type EntryMetricRecord = {
  metric_key: string;
  metric_value: number | string | null;
  metric_text: string | null;
  metric_unit: string | null;
};

type SessionEntryRecord = {
  id: string;
  entry_kind: string | null;
  name: string;
  progression_level: string | null;
  completed: boolean;
  notes: string | null;
  source_sheet: string | null;
  activity_types: ActivityTypeRef;
  entry_sets: EntrySetRecord[] | null;
  entry_metrics: EntryMetricRecord[] | null;
};

type SessionRecord = {
  id: string;
  session_date: string;
  title: string | null;
  completed: boolean;
  duration_minutes: number | string | null;
  intensity: string | null;
  rpe: number | string | null;
  notes: string | null;
  source_sheet: string | null;
  activity_types: ActivityTypeRef;
  training_locations: { name: string | null; kind: string | null } | null;
  session_entries: SessionEntryRecord[] | null;
};

type OneRMRecord = {
  id: string;
  test_date: string;
  source: string | null;
  exercise_name: string;
  load_type: string | null;
  external_weight: number | string | null;
  reps: number | string | null;
  rpe: number | string | null;
  estimated_total: number | string | null;
  estimated_external: number | string | null;
  is_pr: boolean;
};

type BodyweightRecord = {
  id: string;
  logged_date: string;
  bodyweight: number | string;
  notes: string | null;
};

export type TimelineKind = "workout" | "climb" | "one_rm" | "bodyweight";

export type TimelineEntry = {
  id: string;
  sessionId: string | null;
  kind: TimelineKind;
  date: string;
  title: string;
  subtitle: string;
  details: string[];
  notes: string;
  minutes: number | null;
  value: number | null;
  isPr: boolean;
};

export type TimelineData = {
  entries: TimelineEntry[];
};

const toNum = (value: unknown): number | null => {
  if (value == null) return null;
  const text = value.toString().trim();
  if (!text) return null;
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
};

const clean = (value: unknown) => (value == null ? "" : value.toString().trim());

function combineNotes(...values: unknown[]) {
  const notes: string[] = [];
  for (const value of values) {
    const note = clean(value);
    if (note && !notes.includes(note)) notes.push(note);
  }
  return notes.join("\n");
}

function metricNumber(metrics: EntryMetricRecord[] | null | undefined, key: string) {
  const row = metrics?.find((m) => m.metric_key === key);
  return toNum(row?.metric_value ?? row?.metric_text);
}

function metricText(metrics: EntryMetricRecord[] | null | undefined, key: string) {
  const row = metrics?.find((m) => m.metric_key === key);
  return clean(row?.metric_text ?? row?.metric_value);
}

function isClimbing(session: SessionRecord, entry?: SessionEntryRecord) {
  const labels = [
    session.source_sheet,
    session.activity_types?.name,
    session.title,
    entry?.entry_kind,
    entry?.activity_types?.name,
    entry?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return labels.includes("climb") || labels.includes("boulder");
}

function sessionMinutes(session: SessionRecord, entry?: SessionEntryRecord) {
  const sessionValue = toNum(session.duration_minutes);
  if (sessionValue != null && sessionValue > 0) return sessionValue;
  return (entry?.entry_sets ?? []).reduce((total, set) => {
    const seconds = toNum(set.duration_seconds);
    return total + (seconds != null && seconds > 0 ? seconds / 60 : 0);
  }, 0);
}

function compactNumber(value: number) {
  return Number.isInteger(value) ? `${value}` : `${Math.round(value * 10) / 10}`;
}

function describeSets(sets: EntrySetRecord[] | null | undefined) {
  if (!sets?.length) return "";
  const set = sets[0];
  const parts: string[] = [];
  const individualSets = sets.length > 1;
  const setCount = individualSets ? sets.length : toNum(set.set_number);
  const completedSets = sets.filter((item) => item.completed !== false);
  const durationValues = completedSets.flatMap((item) => {
    const duration = toNum(item.duration_seconds);
    return duration != null && duration > 0 ? [duration] : [];
  });
  const isHold = durationValues.length > 0 && sets.every((item) => (toNum(item.reps) ?? 0) <= 0);
  const workRows: Array<{
    method_name: string | null;
    reps: number | string | null;
    weight: number | string | null;
    range_of_motion: string | null;
  }> = [];
  for (const item of sets) {
    if (item.entry_set_segments?.length) workRows.push(...item.entry_set_segments);
    else
      workRows.push({
        method_name: null,
        reps: item.reps,
        weight: item.weight,
        range_of_motion: null,
      });
  }
  const reps = workRows.reduce((total, item) => total + (toNum(item.reps) ?? 0), 0);
  const weight = workRows.reduce<number | null>((max, item) => {
    const value = toNum(item.weight);
    return value == null || (max != null && max >= value) ? max : value;
  }, null);
  const aggregateAttempts = !individualSets && setCount != null && setCount > 1 ? setCount : 1;
  const attemptCount = individualSets ? completedSets.length : aggregateAttempts;
  const totalHoldSeconds =
    durationValues.reduce((total, value) => total + value, 0) *
    (individualSets ? 1 : aggregateAttempts);
  const bestHoldSeconds = durationValues.length ? Math.max(...durationValues) : null;
  if (isHold && attemptCount > 0) {
    parts.push(`${compactNumber(attemptCount)} ${attemptCount === 1 ? "attempt" : "attempts"}`);
  } else if (setCount != null && setCount > 0) {
    parts.push(`${compactNumber(setCount)} sets`);
  }
  if (reps != null && reps > 0) parts.push(`${compactNumber(reps)} reps`);
  const partialReps = workRows.reduce(
    (total, item) =>
      total + (item.range_of_motion?.toLowerCase() === "partial" ? (toNum(item.reps) ?? 0) : 0),
    0,
  );
  if (partialReps > 0) parts.push(`${compactNumber(partialReps)} partial`);
  if (weight != null && weight > 0) parts.push(`${compactNumber(weight)}kg max`);
  const methodName = sets.flatMap((item) => item.entry_set_segments ?? [])[0]?.method_name;
  if (methodName) parts.push(methodName);
  if (totalHoldSeconds > 0) parts.push(`${compactNumber(totalHoldSeconds)}s total hold`);
  if (bestHoldSeconds != null) parts.push(`${compactNumber(bestHoldSeconds)}s best`);
  return parts.join(" · ");
}

function workoutEntry(session: SessionRecord, entry: SessionEntryRecord): TimelineEntry {
  const firstSet = entry.entry_sets?.[0];
  const minutes = sessionMinutes(session, entry);
  const details = [
    session.training_locations?.name ? `Location: ${session.training_locations.name}` : "",
    session.activity_types?.name ?? entry.activity_types?.name,
    entry.entry_kind,
    entry.progression_level,
    describeSets(entry.entry_sets),
    clean(firstSet?.quality) ? `Quality: ${clean(firstSet?.quality)}` : "",
    clean(firstSet?.rest_time) ? `Rest: ${clean(firstSet?.rest_time)}` : "",
    clean(firstSet?.assistance_type) && clean(firstSet?.assistance_type).toLowerCase() !== "none"
      ? `Assistance: ${[firstSet?.assistance_type, firstSet?.assistance_detail].map(clean).filter(Boolean).join(" · ")}`
      : "",
    minutes > 0 ? `${Math.round(minutes)} min` : "",
  ].filter(Boolean) as string[];

  return {
    id: `workout-${entry.id}`,
    sessionId: session.id,
    kind: "workout",
    date: session.session_date,
    title: entry.name,
    subtitle: session.title ?? "Workout",
    details,
    notes: combineNotes(entry.notes, session.notes),
    minutes: minutes || null,
    value: null,
    isPr: false,
  };
}

function climbEntry(session: SessionRecord, entry?: SessionEntryRecord): TimelineEntry {
  const metrics = entry?.entry_metrics ?? [];
  const hours = metricNumber(metrics, "hours");
  const boulders = metricNumber(metrics, "boulders");
  const grade = metricText(metrics, "grade");
  const gradient = metricText(metrics, "gradient");
  const trackingMode = metricText(metrics, "tracking_mode");
  const minutes = hours != null ? hours * 60 : sessionMinutes(session, entry);
  const details = [
    trackingMode,
    hours != null ? `${compactNumber(hours)} hr` : "",
    boulders != null ? `${compactNumber(boulders)} boulders` : "",
    grade ? `Grade ${grade}` : "",
    gradient ? `${gradient} board` : "",
    session.intensity,
    session.rpe ? `RPE ${session.rpe}` : "",
  ].filter(Boolean) as string[];

  return {
    id: `climb-${session.id}`,
    sessionId: session.id,
    kind: "climb",
    date: session.session_date,
    title: session.title ?? entry?.name ?? "Climbing",
    subtitle: entry?.name ?? session.activity_types?.name ?? "Climb",
    details,
    notes: combineNotes(entry?.notes, session.notes),
    minutes: minutes || null,
    value: hours ?? boulders ?? null,
    isPr: false,
  };
}

function oneRmEntry(row: OneRMRecord): TimelineEntry {
  const estimated = toNum(row.estimated_total ?? row.estimated_external);
  const external = toNum(row.external_weight);
  const reps = toNum(row.reps);
  const details = [
    row.source,
    row.load_type,
    external != null ? `${compactNumber(external)}kg external` : "",
    reps != null ? `${compactNumber(reps)} reps` : "",
    estimated != null ? `${compactNumber(estimated)}kg estimated` : "",
    row.rpe ? `RPE ${row.rpe}` : "",
  ].filter(Boolean) as string[];

  return {
    id: `one-rm-${row.id}`,
    sessionId: null,
    kind: "one_rm",
    date: row.test_date,
    title: row.exercise_name,
    subtitle: row.is_pr ? "1RM test · PR" : "1RM test",
    details,
    notes: "",
    minutes: null,
    value: estimated ?? external,
    isPr: row.is_pr,
  };
}

function bodyweightEntry(row: BodyweightRecord): TimelineEntry {
  const bodyweight = toNum(row.bodyweight);
  return {
    id: `bodyweight-${row.id}`,
    sessionId: null,
    kind: "bodyweight",
    date: row.logged_date,
    title: bodyweight != null ? `${compactNumber(bodyweight)}kg` : "Bodyweight",
    subtitle: "Bodyweight",
    details: bodyweight != null ? [`${compactNumber(bodyweight)}kg`] : [],
    notes: row.notes ?? "",
    minutes: null,
    value: bodyweight,
    isPr: false,
  };
}

export async function getTimelineDataClient(): Promise<TimelineData> {
  const person = (await getCurrentPerson()) ?? (await claimNoamProfile());
  if (!person) throw new Error("Link this login to your profile first.");

  const [sessions, oneRmRows, bodyweightRows] = await Promise.all([
    supabasePublicSelect<SessionRecord>("sessions", {
      select:
        "id,session_date,title,completed,duration_minutes,intensity,rpe,notes,source_sheet,activity_types(name),training_locations(name,kind),session_entries(id,entry_kind,name,progression_level,completed,notes,source_sheet,activity_types(name),entry_sets(set_number,reps,weight,duration_seconds,rpe,rest_time,assistance_type,assistance_detail,quality,completed,entry_set_segments(method_name,reps,weight,range_of_motion)),entry_metrics(metric_key,metric_value,metric_text,metric_unit))",
      order: "session_date.desc",
      limit: 1000,
    }),
    supabasePublicSelect<OneRMRecord>("one_rm_tests", {
      select:
        "id,test_date,source,exercise_name,load_type,external_weight,reps,rpe,estimated_total,estimated_external,is_pr",
      order: "test_date.desc",
      limit: 1000,
    }),
    supabasePublicSelect<BodyweightRecord>("bodyweight_logs", {
      select: "id,logged_date,bodyweight,notes",
      order: "logged_date.desc",
      limit: 1000,
    }),
  ]);

  const entries: TimelineEntry[] = [];
  for (const session of sessions) {
    if (!session.completed) continue;
    const completedEntries = session.session_entries?.filter((entry) => entry.completed) ?? [];
    if (isClimbing(session, completedEntries[0])) {
      entries.push(climbEntry(session, completedEntries[0]));
      continue;
    }
    for (const entry of completedEntries) {
      entries.push(workoutEntry(session, entry));
    }
  }
  entries.push(...oneRmRows.map(oneRmEntry));
  entries.push(...bodyweightRows.map(bodyweightEntry));

  entries.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
  return { entries };
}
