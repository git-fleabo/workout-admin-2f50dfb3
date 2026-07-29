import { getMovementMetricProfile } from "./movement-metrics";
import { todayISO } from "./date";
import { getCurrentPerson } from "./supabase-people.browser";
import { getPRsClient } from "./supabase-log.browser";
import { supabasePublicSelect } from "./supabase-public";
import { comparableVolume, type LoadSemantics, type VolumeStatus } from "./data-quality";
import {
  summarizeProgrammeAdherence,
  type ProgrammeAdherence,
  type ProgrammeAdherenceLink,
} from "./programme-adherence";
import { getUpcomingProgrammeScheduleClient } from "./supabase-programmes.browser";

type ActivityTypeRef = { name: string | null } | null;

type ReviewSetRecord = {
  reps: number | string | null;
  weight: number | string | null;
  duration_seconds: number | string | null;
  rpe: number | string | null;
  load_semantics: LoadSemantics | null;
  implement_count: number | string | null;
  volume_status: VolumeStatus | null;
  entry_set_segments: Array<{
    reps: number | string | null;
    weight: number | string | null;
  }> | null;
};

type ReviewMetricRecord = {
  metric_key: string;
  metric_value: number | string | null;
  metric_text: string | null;
};

type ReviewEntryRecord = {
  name: string;
  entry_kind: string | null;
  completed: boolean;
  activity_types: ActivityTypeRef;
  exercises: {
    default_metric: string | null;
    activity_types: ActivityTypeRef;
  } | null;
  entry_sets: ReviewSetRecord[] | null;
  entry_metrics: ReviewMetricRecord[] | null;
};

type ReviewSessionRecord = {
  id: string;
  session_date: string;
  title: string | null;
  completed: boolean;
  duration_minutes: number | string | null;
  rpe: number | string | null;
  activity_types: ActivityTypeRef;
  training_locations: { name: string | null; kind: string | null } | null;
  session_entries: ReviewEntryRecord[] | null;
};

type ReviewPlanRecord = {
  id: string;
  title: string;
  status: "pending" | "accepted" | "completed" | "skipped" | "archived";
  suggested_for: string | null;
  created_at: string;
  completed_session_id: string | null;
  program_assignment_id: string | null;
  program_workout_id: string | null;
};

export type WeeklyReviewTone = "positive" | "caution" | "neutral";

export type WeeklyReviewItem = {
  title: string;
  detail: string;
  tone: WeeklyReviewTone;
};

export type WeeklyReviewAction = WeeklyReviewItem & {
  evidence: string;
};

export type WeeklyReviewSession = {
  id: string;
  date: string;
  title: string;
  location: string;
  movements: string[];
  activities: string[];
  minutes: number;
  rpe: number | null;
};

export type WeeklyReviewData = {
  weekStart: string;
  weekEnd: string;
  reviewEnd: string;
  isCurrentWeek: boolean;
  isCompleteWeek: boolean;
  comparisonLabel: string;
  summary: {
    sessions: number;
    activeDays: number;
    minutes: number;
    strengthVolume: number;
    movements: number;
    hardDays: number;
    rpeCoverage: number;
  };
  comparison: {
    sessions: number;
    activeDays: number;
    minutes: number;
    strengthVolume: number;
    sessionDelta: number;
    activeDayDelta: number;
    minuteDelta: number;
    volumeDelta: number;
  };
  adherence: {
    total: number;
    completed: number;
    skipped: number;
    open: number;
    percentage: number | null;
  };
  programmeAdherence: ProgrammeAdherence;
  activityMix: Array<{ label: string; sessions: number }>;
  locations: Array<{ label: string; sessions: number }>;
  highlights: WeeklyReviewItem[];
  watchlist: WeeklyReviewItem[];
  actions: WeeklyReviewAction[];
  sessions: WeeklyReviewSession[];
};

type WeeklyReviewPR = {
  title: string;
  value: string;
  detail: string;
  date: string;
};

const DAY_MS = 86_400_000;

function toNumber(value: unknown) {
  if (value == null || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseISO(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function toISO(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = parseISO(value);
  if (!date) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return toISO(date);
}

export function weeklyReviewWeekStart(anchor = todayISO()) {
  const date = parseISO(anchor) ?? new Date();
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
  return toISO(date);
}

export function moveWeeklyReviewWeek(weekStart: string, amount: number) {
  return addDays(weekStart, amount * 7);
}

function metricNumber(entry: ReviewEntryRecord, key: string) {
  const metric = entry.entry_metrics?.find((item) => item.metric_key === key);
  return toNumber(metric?.metric_value ?? metric?.metric_text);
}

function entryMinutes(entry: ReviewEntryRecord) {
  const direct = metricNumber(entry, "duration_minutes");
  if (direct != null && direct > 0) return direct;
  const hours = metricNumber(entry, "hours");
  if (hours != null && hours > 0) return hours * 60;
  const seconds = (entry.entry_sets ?? []).reduce(
    (total, set) => total + (toNumber(set.duration_seconds) ?? 0),
    0,
  );
  return seconds > 0 ? seconds / 60 : 0;
}

function sessionMinutes(session: ReviewSessionRecord, entries: ReviewEntryRecord[]) {
  const direct = toNumber(session.duration_minutes);
  if (direct != null && direct > 0) return direct;
  return entries.reduce((total, entry) => total + entryMinutes(entry), 0);
}

function sessionRpe(session: ReviewSessionRecord, entries: ReviewEntryRecord[]) {
  const values = [
    toNumber(session.rpe),
    ...entries.map((entry) => metricNumber(entry, "rpe")),
    ...entries.flatMap((entry) => (entry.entry_sets ?? []).map((set) => toNumber(set.rpe))),
  ].filter((value): value is number => value != null);
  return values.length ? Math.max(...values) : null;
}

function entryVolume(entry: ReviewEntryRecord) {
  return (entry.entry_sets ?? []).reduce((total, set) => {
    const rows = set.entry_set_segments?.length ? set.entry_set_segments : [set];
    return (
      total +
      rows.reduce((rowTotal, row) => {
        const reps = toNumber(row.reps);
        const weight = toNumber(row.weight);
        return (
          rowTotal +
          (comparableVolume({
            reps,
            weight,
            volumeStatus: set.volume_status ?? "unknown",
            loadSemantics: set.load_semantics ?? "unknown",
            implementCount: set.implement_count == null ? null : Number(set.implement_count),
          }) ?? 0)
        );
      }, 0)
    );
  }, 0);
}

function entryActivity(entry: ReviewEntryRecord, session: ReviewSessionRecord) {
  const workoutType =
    entry.activity_types?.name ??
    entry.exercises?.activity_types?.name ??
    session.activity_types?.name ??
    "Other";
  const labels = `${workoutType} ${entry.entry_kind ?? ""} ${entry.name}`.toLowerCase();
  if (labels.includes("climb") || labels.includes("boulder")) return "Climbing";
  if (labels.includes("run") || labels.includes("jog") || labels.includes("cardio")) {
    return "Cardio";
  }
  if (
    labels.includes("mobility") ||
    labels.includes("flexibility") ||
    labels.includes("yoga") ||
    labels.includes("stretch")
  ) {
    return "Mobility / recovery";
  }
  if (labels.includes("class")) return "Class";
  if (labels.includes("conditioning") || labels.includes("sport")) return "Conditioning";

  const profile = getMovementMetricProfile({
    workoutType,
    movement: entry.name,
    defaultMetric: entry.exercises?.default_metric ?? "",
  });
  if (["weighted", "reps", "hold", "grip", "carry", "power"].includes(profile)) {
    return "Strength / skill";
  }
  if (profile === "time") return "Cardio";
  if (profile === "mobility_position") return "Mobility / recovery";
  if (profile === "climbing") return "Climbing";
  if (profile === "conditioning") return "Conditioning";
  return "Other";
}

function normalizeSession(session: ReviewSessionRecord): WeeklyReviewSession & { volume: number } {
  const entries = (session.session_entries ?? []).filter((entry) => entry.completed);
  const activities = Array.from(new Set(entries.map((entry) => entryActivity(entry, session))));
  const location = session.training_locations;
  return {
    id: session.id,
    date: session.session_date,
    title: session.title?.trim() || activities.join(" + ") || "Workout",
    location: location?.name?.trim() || location?.kind?.trim() || "No location",
    movements: Array.from(new Set(entries.map((entry) => entry.name).filter(Boolean))),
    activities,
    minutes: Math.round(sessionMinutes(session, entries)),
    rpe: sessionRpe(session, entries),
    volume: Math.round(entries.reduce((total, entry) => total + entryVolume(entry), 0)),
  };
}

function summarize(sessions: Array<WeeklyReviewSession & { volume: number }>) {
  const activeDays = new Set(sessions.map((session) => session.date));
  const hardDays = new Set(
    sessions
      .filter((session) => session.rpe != null && session.rpe >= 9)
      .map((session) => session.date),
  );
  const rpeSessions = sessions.filter((session) => session.rpe != null).length;
  return {
    sessions: sessions.length,
    activeDays: activeDays.size,
    minutes: sessions.reduce((total, session) => total + session.minutes, 0),
    strengthVolume: sessions.reduce((total, session) => total + session.volume, 0),
    movements: sessions.reduce((total, session) => total + session.movements.length, 0),
    hardDays: hardDays.size,
    rpeCoverage: sessions.length ? Math.round((rpeSessions / sessions.length) * 100) : 0,
  };
}

function delta(current: number, previous: number) {
  return Math.round((current - previous) * 10) / 10;
}

function planDate(plan: ReviewPlanRecord) {
  return plan.suggested_for ?? plan.created_at.slice(0, 10);
}

function planAdherence(plans: ReviewPlanRecord[], start: string, end: string) {
  const relevant = plans.filter((plan) => {
    const date = planDate(plan);
    return (
      date >= start && date <= end && plan.status !== "archived" && !plan.program_assignment_id
    );
  });
  const completed = relevant.filter(
    (plan) => plan.status === "completed" || Boolean(plan.completed_session_id),
  ).length;
  const skipped = relevant.filter((plan) => plan.status === "skipped").length;
  const open = relevant.filter(
    (plan) => plan.status === "pending" || plan.status === "accepted",
  ).length;
  return {
    total: relevant.length,
    completed,
    skipped,
    open,
    percentage: relevant.length ? Math.round((completed / relevant.length) * 100) : null,
  };
}

function countLabels(sessions: WeeklyReviewSession[], key: "activities" | "location") {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    const labels = key === "activities" ? session.activities : [session.location];
    for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, sessions: count }))
    .sort((left, right) => right.sessions - left.sessions || left.label.localeCompare(right.label));
}

function formatKgVolume(value: number) {
  if (value >= 1000) return `${Math.round((value / 1000) * 10) / 10}k kg`;
  return `${Math.round(value)} kg`;
}

function buildHighlights({
  current,
  previous,
  prs,
  adherence,
  programmeAdherence,
}: {
  current: ReturnType<typeof summarize>;
  previous: ReturnType<typeof summarize>;
  prs: WeeklyReviewPR[];
  adherence: WeeklyReviewData["adherence"];
  programmeAdherence: ProgrammeAdherence;
}) {
  const highlights: WeeklyReviewItem[] = prs.slice(0, 2).map((pr) => ({
    title: `${pr.title} personal best`,
    detail: [pr.value, pr.detail].filter(Boolean).join(" · "),
    tone: "positive" as const,
  }));

  if (adherence.completed > 0) {
    highlights.push({
      title: `${adherence.completed} planned workout${adherence.completed === 1 ? "" : "s"} completed`,
      detail: "Completed sessions stayed linked to their saved plans.",
      tone: "positive",
    });
  }
  if (programmeAdherence.completed > 0) {
    highlights.push({
      title: `${programmeAdherence.completed}/${programmeAdherence.due} programme sessions completed`,
      detail:
        programmeAdherence.late > 0
          ? `${programmeAdherence.onTime} on time · ${programmeAdherence.late} completed late.`
          : "All completed programme sessions were finished on schedule.",
      tone: "positive",
    });
  }
  if (current.activeDays > previous.activeDays && current.activeDays >= 2) {
    highlights.push({
      title: "More consistent training rhythm",
      detail: `${current.activeDays} active days versus ${previous.activeDays} at the same point last week.`,
      tone: "positive",
    });
  }
  if (
    current.strengthVolume > 0 &&
    previous.strengthVolume > 0 &&
    current.strengthVolume >= previous.strengthVolume * 1.1
  ) {
    highlights.push({
      title: "Strength workload moved up",
      detail: `${formatKgVolume(current.strengthVolume)} versus ${formatKgVolume(previous.strengthVolume)} in the comparison period.${
        current.strengthVolume >= previous.strengthVolume * 3
          ? " The percentage change is large because the comparison baseline was low."
          : ""
      }`,
      tone: "positive",
    });
  }
  if (!highlights.length) {
    highlights.push({
      title: current.sessions ? "A useful week is taking shape" : "No completed sessions yet",
      detail: current.sessions
        ? `${current.sessions} completed session${current.sessions === 1 ? "" : "s"} across ${current.activeDays} active day${current.activeDays === 1 ? "" : "s"}.`
        : "The review will fill in as completed training is logged.",
      tone: "neutral",
    });
  }
  return highlights.slice(0, 4);
}

function buildWatchlist({
  current,
  previous,
  adherence,
  programmeAdherence,
}: {
  current: ReturnType<typeof summarize>;
  previous: ReturnType<typeof summarize>;
  adherence: WeeklyReviewData["adherence"];
  programmeAdherence: ProgrammeAdherence;
}) {
  const watchlist: WeeklyReviewItem[] = [];
  if (current.hardDays >= 2) {
    watchlist.push({
      title: "Repeated high effort",
      detail: `${current.hardDays} days reached RPE 9 or above. Treat that as recovery pressure, not proof that a deload is required.`,
      tone: "caution",
    });
  }
  if (
    previous.minutes >= 60 &&
    current.minutes - previous.minutes >= 45 &&
    current.minutes >= previous.minutes * 1.3
  ) {
    watchlist.push({
      title: "Training time increased quickly",
      detail: `${current.minutes} minutes versus ${previous.minutes} at the same point last week.`,
      tone: "caution",
    });
  }
  if (current.sessions >= 2 && current.rpeCoverage < 60) {
    watchlist.push({
      title: "Effort data is incomplete",
      detail: `RPE was available for ${current.rpeCoverage}% of sessions, which limits fatigue interpretation.`,
      tone: "caution",
    });
  }
  if (adherence.skipped > 0) {
    watchlist.push({
      title: `${adherence.skipped} planned workout${adherence.skipped === 1 ? " was" : "s were"} skipped`,
      detail:
        "Check whether the plan needs rescheduling or whether the weekly target was simply too ambitious.",
      tone: "caution",
    });
  }
  if (programmeAdherence.missed > 0 || programmeAdherence.skipped > 0) {
    watchlist.push({
      title: `${programmeAdherence.missed + programmeAdherence.skipped} programme session${
        programmeAdherence.missed + programmeAdherence.skipped === 1 ? "" : "s"
      } missed or skipped`,
      detail:
        "This is calculated from the fixed programme dates, including sessions that were never started.",
      tone: "caution",
    });
  }
  if (!watchlist.length) {
    watchlist.push({
      title: "No obvious recovery flag",
      detail: current.sessions
        ? "Recorded effort, time and plan outcomes do not currently show a strong caution signal."
        : "There is not enough completed training this week to assess recovery pressure.",
      tone: "neutral",
    });
  }
  return watchlist.slice(0, 4);
}

function buildActions({
  current,
  previous,
  adherence,
  programmeAdherence,
  prs,
}: {
  current: ReturnType<typeof summarize>;
  previous: ReturnType<typeof summarize>;
  adherence: WeeklyReviewData["adherence"];
  programmeAdherence: ProgrammeAdherence;
  prs: WeeklyReviewPR[];
}): WeeklyReviewAction[] {
  const planAction: WeeklyReviewAction =
    programmeAdherence.missed + programmeAdherence.skipped > 0
      ? {
          title: "Reconcile the missed programme session",
          detail:
            "Leave it recorded as missed if it no longer fits, or complete the outstanding programme session before advancing.",
          evidence: `${programmeAdherence.missed} missed · ${programmeAdherence.skipped} skipped`,
          tone: "caution",
        }
      : programmeAdherence.outstanding > 0
        ? {
            title: "Complete the due programme session",
            detail:
              "Open Today and use the programme card; the assignment advances only after the linked workout is completed.",
            evidence: `${programmeAdherence.outstanding} programme session${
              programmeAdherence.outstanding === 1 ? "" : "s"
            } outstanding`,
            tone: "neutral",
          }
        : adherence.skipped > 0
          ? {
              title: "Reconcile the skipped plan",
              detail:
                "Reschedule it only if it still fits the coming week; otherwise leave it skipped and plan from what actually happened.",
              evidence: `${adherence.skipped} skipped · ${adherence.completed} completed`,
              tone: "caution",
            }
          : adherence.open > 0
            ? {
                title: "Resolve the remaining planned workout",
                detail:
                  "Complete, skip or archive it so Today and Plan start next week from a clear lifecycle state.",
                evidence: `${adherence.open} plan${adherence.open === 1 ? "" : "s"} still open`,
                tone: "neutral",
              }
            : {
                title: "Set the next concrete workout",
                detail:
                  "Use Plan to save one editable Home or Gym session rather than carrying a vague intention into next week.",
                evidence: adherence.total
                  ? `${adherence.completed}/${adherence.total} planned workouts completed`
                  : "No dated plans in this review period",
                tone: "neutral",
              };

  const recoveryPressure =
    current.hardDays >= 2 || (previous.minutes >= 60 && current.minutes >= previous.minutes * 1.3);
  const recoveryAction: WeeklyReviewAction = recoveryPressure
    ? {
        title: "Keep the next session adjustable",
        detail:
          "Start with normal targets, but use the existing Tired option if warm-ups confirm that recovery is lagging.",
        evidence: `${current.hardDays} hard day${current.hardDays === 1 ? "" : "s"} · ${current.minutes} min recorded`,
        tone: "caution",
      }
    : {
        title: "Normal progression remains reasonable",
        detail:
          "There is no strong weekly signal to force a lighter session; keep using exercise-level Progress evidence.",
        evidence: `${current.hardDays} RPE 9+ days · ${current.rpeCoverage}% RPE coverage`,
        tone: "positive",
      };

  let progressAction: WeeklyReviewAction;
  if (prs.length) {
    progressAction = {
      title: `Consolidate the ${prs[0].title} result`,
      detail:
        "Use the new best as evidence, but do not automatically increase every set in the next session.",
      evidence: `${prs[0].value}${prs[0].detail ? ` · ${prs[0].detail}` : ""}`,
      tone: "positive",
    };
  } else if (current.sessions >= 2 && current.rpeCoverage < 60) {
    progressAction = {
      title: "Capture working-set RPE next week",
      detail:
        "A few reliable effort ratings will make progression and recovery recommendations more useful.",
      evidence: `${current.rpeCoverage}% of sessions currently have usable RPE`,
      tone: "neutral",
    };
  } else if (current.sessions === 0) {
    progressAction = {
      title: "Restart with one easy-to-finish session",
      detail:
        "Choose a familiar recent workout and reduce friction before trying to rebuild the whole week.",
      evidence: "No completed sessions in this review period",
      tone: "neutral",
    };
  } else {
    progressAction = {
      title: "Choose one movement to progress",
      detail:
        "Open Progress and use the strongest exercise-level signal rather than increasing the entire programme at once.",
      evidence: `${current.movements} movement entries reviewed this week`,
      tone: "neutral",
    };
  }

  return [planAction, recoveryAction, progressAction];
}

export async function getWeeklyReviewClient(anchor?: string): Promise<WeeklyReviewData> {
  const person = await getCurrentPerson();
  if (!person) throw new Error("This account is not linked to a training profile.");

  const today = todayISO();
  const currentWeekStart = weeklyReviewWeekStart(today);
  const requestedWeekStart = weeklyReviewWeekStart(anchor ?? today);
  const weekStart = requestedWeekStart > currentWeekStart ? currentWeekStart : requestedWeekStart;
  const weekEnd = addDays(weekStart, 6);
  const isCurrentWeek = weekStart === currentWeekStart;
  const reviewEnd = isCurrentWeek && today < weekEnd ? today : weekEnd;
  const elapsedDays = Math.max(
    0,
    Math.round(
      ((parseISO(reviewEnd)?.getTime() ?? 0) - (parseISO(weekStart)?.getTime() ?? 0)) / DAY_MS,
    ),
  );
  const comparisonStart = addDays(weekStart, -7);
  const comparisonEnd = addDays(comparisonStart, elapsedDays);

  const [sessionRows, planRows, prData, scheduledProgrammeSessions] = await Promise.all([
    supabasePublicSelect<ReviewSessionRecord>("sessions", {
      select:
        "id,session_date,title,completed,duration_minutes,rpe,activity_types(name),training_locations(name,kind),session_entries(name,entry_kind,completed,activity_types(name),exercises(default_metric,activity_types(name)),entry_sets(reps,weight,duration_seconds,rpe,load_semantics,volume_status,implement_count,entry_set_segments(reps,weight)),entry_metrics(metric_key,metric_value,metric_text))",
      person_id: `eq.${person.id}`,
      completed: "eq.true",
      and: `(session_date.gte.${comparisonStart},session_date.lte.${reviewEnd})`,
      order: "session_date.desc",
      limit: 500,
    }),
    supabasePublicSelect<ReviewPlanRecord>("suggested_workouts", {
      select:
        "id,title,status,suggested_for,created_at,completed_session_id,program_assignment_id,program_workout_id",
      person_id: `eq.${person.id}`,
      order: "created_at.desc",
      limit: 500,
    }),
    getPRsClient(),
    getUpcomingProgrammeScheduleClient(weekStart, reviewEnd, ["active", "complete"]),
  ]);

  const normalized = sessionRows
    .filter((session) => (session.session_entries ?? []).some((entry) => entry.completed))
    .map(normalizeSession);
  const currentSessions = normalized
    .filter((session) => session.date >= weekStart && session.date <= reviewEnd)
    .sort((left, right) => right.date.localeCompare(left.date));
  const previousSessions = normalized.filter(
    (session) => session.date >= comparisonStart && session.date <= comparisonEnd,
  );
  const current = summarize(currentSessions);
  const previous = summarize(previousSessions);
  const adherence = planAdherence(planRows, weekStart, reviewEnd);
  const completedSessionDates = new Map(
    sessionRows.map((session) => [session.id, session.session_date]),
  );
  const programmeLinks: ProgrammeAdherenceLink[] = planRows.flatMap((plan) =>
    plan.program_assignment_id && plan.program_workout_id
      ? [
          {
            assignmentId: plan.program_assignment_id,
            programWorkoutId: plan.program_workout_id,
            status: plan.status,
            completedSessionId: plan.completed_session_id,
          },
        ]
      : [],
  );
  const programmeAdherence = summarizeProgrammeAdherence({
    sessions: scheduledProgrammeSessions,
    links: programmeLinks,
    completedSessionDates,
    reviewEnd,
  });
  const prs: WeeklyReviewPR[] = [
    ...prData.oneRm.map((pr) => ({
      title: pr.exercise,
      value: `${pr.estTotal || pr.estExternal || pr.externalWeight || "Recorded"}${
        pr.estTotal || pr.estExternal || pr.externalWeight ? " kg" : ""
      }`,
      detail: [pr.reps ? `${pr.reps} reps` : "", pr.type].filter(Boolean).join(" · "),
      date: pr.date,
    })),
    ...prData.skills.map((pr) => ({
      title: pr.skill,
      value: `${pr.value} ${pr.unit}`,
      detail: [pr.progression, pr.assistanceLabel].filter(Boolean).join(" · "),
      date: pr.date,
    })),
  ];
  const weeklyPRs = prs.filter((pr) => pr.date >= weekStart && pr.date <= reviewEnd);

  return {
    weekStart,
    weekEnd,
    reviewEnd,
    isCurrentWeek,
    isCompleteWeek: reviewEnd === weekEnd,
    comparisonLabel: `Compared with ${comparisonStart} to ${comparisonEnd}`,
    summary: current,
    comparison: {
      sessions: previous.sessions,
      activeDays: previous.activeDays,
      minutes: previous.minutes,
      strengthVolume: previous.strengthVolume,
      sessionDelta: delta(current.sessions, previous.sessions),
      activeDayDelta: delta(current.activeDays, previous.activeDays),
      minuteDelta: delta(current.minutes, previous.minutes),
      volumeDelta: delta(current.strengthVolume, previous.strengthVolume),
    },
    adherence,
    programmeAdherence,
    activityMix: countLabels(currentSessions, "activities"),
    locations: countLabels(currentSessions, "location"),
    highlights: buildHighlights({
      current,
      previous,
      prs: weeklyPRs,
      adherence,
      programmeAdherence,
    }),
    watchlist: buildWatchlist({ current, previous, adherence, programmeAdherence }),
    actions: buildActions({
      current,
      previous,
      adherence,
      programmeAdherence,
      prs: weeklyPRs,
    }),
    sessions: currentSessions.map(({ volume: _volume, ...session }) => session),
  };
}
