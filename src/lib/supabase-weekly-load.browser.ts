import { getCurrentPerson } from "./supabase-people.browser";
import { supabasePublicSelect } from "./supabase-public";

export type WeeklyLoadKind = "climb" | "run" | "class" | "sport" | "recovery";

export type WeeklyLoadHistoryItem = {
  id: string;
  date: string;
  kind: WeeklyLoadKind;
  label: string;
  minutes: number | null;
  rpe: number | null;
};

type WeeklyLoadSessionRecord = {
  id: string;
  session_date: string;
  title: string | null;
  duration_minutes: number | string | null;
  rpe: number | string | null;
  activity_types: { name: string | null } | null;
  session_entries: Array<{
    name: string;
    entry_kind: string | null;
    completed: boolean;
    activity_types: { name: string | null } | null;
    entry_sets: Array<{ duration_seconds: number | string | null }> | null;
  }> | null;
};

function numberOrNull(value: unknown) {
  if (value == null || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sessionLabels(session: WeeklyLoadSessionRecord) {
  const entries = (session.session_entries ?? []).filter((entry) => entry.completed);
  return [
    session.title,
    session.activity_types?.name,
    ...entries.flatMap((entry) => [entry.name, entry.entry_kind, entry.activity_types?.name]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function classifySession(session: WeeklyLoadSessionRecord): WeeklyLoadKind | null {
  const labels = sessionLabels(session);
  if (labels.includes("climb") || labels.includes("boulder")) return "climb";
  if (labels.includes("run") || labels.includes("jog")) return "run";
  if (labels.includes("class")) return "class";
  if (
    labels.includes("strength") ||
    labels.includes("calisthenics") ||
    labels.includes("grip") ||
    labels.includes("1rm")
  ) {
    return null;
  }
  if (
    labels.includes("mobility") ||
    labels.includes("flexibility") ||
    labels.includes("stretch") ||
    labels.includes("yoga")
  ) {
    return "recovery";
  }
  if (
    labels.includes("conditioning") ||
    labels.includes("sport") ||
    labels.includes("cardio") ||
    labels.includes("cycle") ||
    labels.includes("swim") ||
    labels.includes("row")
  ) {
    return "sport";
  }
  return null;
}

function sessionMinutes(session: WeeklyLoadSessionRecord) {
  const direct = numberOrNull(session.duration_minutes);
  if (direct != null && direct > 0) return direct;
  const seconds = (session.session_entries ?? []).reduce(
    (total, entry) =>
      entry.completed
        ? total +
          (entry.entry_sets ?? []).reduce(
            (entryTotal, set) => entryTotal + (numberOrNull(set.duration_seconds) ?? 0),
            0,
          )
        : total,
    0,
  );
  return seconds > 0 ? Math.round(seconds / 60) : null;
}

const KIND_LABEL: Record<WeeklyLoadKind, string> = {
  climb: "Climbing",
  run: "Running",
  class: "Class",
  sport: "Sport / conditioning",
  recovery: "Recovery / mobility",
};

function startDateFor(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toLocaleDateString("en-CA");
}

export async function getWeeklyLoadHistoryClient(days = 90): Promise<WeeklyLoadHistoryItem[]> {
  const person = await getCurrentPerson();
  if (!person) throw new Error("This account is not linked to a training profile.");
  const rows = await supabasePublicSelect<WeeklyLoadSessionRecord>("sessions", {
    select:
      "id,session_date,title,duration_minutes,rpe,activity_types(name),session_entries(name,entry_kind,completed,activity_types(name),entry_sets(duration_seconds))",
    person_id: `eq.${person.id}`,
    completed: "eq.true",
    session_date: `gte.${startDateFor(days)}`,
    order: "session_date.desc",
    limit: 500,
  });
  return rows.flatMap((session) => {
    const kind = classifySession(session);
    if (!kind) return [];
    return [
      {
        id: session.id,
        date: session.session_date,
        kind,
        label: session.title?.trim() || KIND_LABEL[kind],
        minutes: sessionMinutes(session),
        rpe: numberOrNull(session.rpe),
      },
    ];
  });
}
