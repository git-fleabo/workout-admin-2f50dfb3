import { completedItemCoveredBySavedPlans } from "./completed-coach-work.ts";
import type { SavedWorkoutPlan } from "./supabase-plans.browser.ts";
import type { ProgrammeScheduleSession } from "./supabase-programmes.browser.ts";
import type { WeeklyPlan, WeeklyPlanAdjustments, WeeklyPlanItemKind } from "./weekly-plan.ts";
import type { CoachingPreferences } from "./coaching-preferences.ts";

export type TrainingContextKind =
  | "strength"
  | "climbing"
  | "conditioning"
  | "skill"
  | "mobility"
  | "other";

export type TrainingContextSession = {
  id: string;
  date: string;
  kind: TrainingContextKind;
  label: string;
  completed: boolean;
  source: "programme" | "scheduled" | "completed";
  focusId: string;
};

export type TrainingContextExpectation = {
  date: string;
  kind: TrainingContextKind;
  label: string;
};

export type TrainingContextSignal = {
  tone: "positive" | "caution" | "information";
  title: string;
  detail: string;
};

export type TrainingContext = {
  startDate: string;
  endDate: string;
  headline: string;
  confidence: "low" | "medium" | "high";
  sessions: TrainingContextSession[];
  expectations: TrainingContextExpectation[];
  counts: Record<TrainingContextKind, number>;
  openDays: number;
  occupiedDays: number;
  demandingDays: number;
  signals: TrainingContextSignal[];
};

export type TrainingContextCoaching = {
  preferences: CoachingPreferences;
  focusLabels: Record<string, string>;
};

const KINDS: TrainingContextKind[] = [
  "strength",
  "climbing",
  "conditioning",
  "skill",
  "mobility",
  "other",
];

const KIND_LABEL: Record<TrainingContextKind, string> = {
  strength: "Strength",
  climbing: "Climbing",
  conditioning: "Conditioning",
  skill: "Skill",
  mobility: "Mobility / recovery",
  other: "Other training",
};

const DAY_MS = 86_400_000;

function planKind(kind: SavedWorkoutPlan["planKind"]): TrainingContextKind {
  if (kind === "climbing") return "climbing";
  if (kind === "conditioning") return "conditioning";
  if (kind === "skill") return "skill";
  if (kind === "mobility" || kind === "yoga") return "mobility";
  if (kind === "strength") return "strength";
  return "other";
}

function inferredKind(kind: WeeklyPlanItemKind): TrainingContextKind {
  if (kind === "home" || kind === "gym") return "strength";
  if (kind === "climb") return "climbing";
  if (kind === "run" || kind === "class" || kind === "sport") return "conditioning";
  if (kind === "recovery") return "mobility";
  return "other";
}

function inferredLabel(kind: WeeklyPlanItemKind) {
  if (kind === "home") return "Home training pattern";
  if (kind === "gym") return "Gym training pattern";
  if (kind === "climb") return "Climbing pattern";
  if (kind === "run") return "Running pattern";
  if (kind === "class") return "Class pattern";
  if (kind === "sport") return "Sport / conditioning pattern";
  return "Recovery / mobility pattern";
}

function dayName(date: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

function consecutiveRuns(dates: string[]) {
  const unique = Array.from(new Set(dates)).sort();
  const runs: string[][] = [];
  for (const date of unique) {
    const previous = runs.at(-1)?.at(-1);
    const distance = previous
      ? (new Date(`${date}T00:00:00Z`).getTime() - new Date(`${previous}T00:00:00Z`).getTime()) /
        DAY_MS
      : null;
    if (distance === 1) runs[runs.length - 1].push(date);
    else runs.push([date]);
  }
  return runs;
}

export function buildTrainingContext({
  plan,
  programmeSessions,
  scheduledPlans,
  adjustments,
  coaching,
}: {
  plan: WeeklyPlan;
  programmeSessions: ProgrammeScheduleSession[];
  scheduledPlans: SavedWorkoutPlan[];
  adjustments: WeeklyPlanAdjustments;
  coaching?: TrainingContextCoaching;
}): TrainingContext {
  const sessions: TrainingContextSession[] = [
    ...programmeSessions.map((session) => ({
      id: `programme:${session.assignmentId}:${session.programWorkoutId}`,
      date: session.date,
      kind: "strength" as const,
      label: `${session.programmeName} · ${session.workoutName}`,
      completed: session.status === "completed",
      source: "programme" as const,
      focusId: "programme",
    })),
    ...scheduledPlans.map((saved) => ({
      id: `scheduled:${saved.suggestedWorkoutId}`,
      date: saved.suggestedFor ?? plan.startDate,
      kind: planKind(saved.planKind),
      label: saved.title,
      completed: saved.status === "completed",
      source: "scheduled" as const,
      focusId: saved.goalId
        ? `goal:${saved.goalId}`
        : saved.mobilityRunId
          ? `mobility:${saved.mobilityRunId}`
          : `kind:${planKind(saved.planKind)}`,
    })),
  ].filter((session) => session.date >= plan.startDate && session.date <= plan.endDate);

  for (const day of plan.days) {
    for (const item of day.completedItems) {
      if (completedItemCoveredBySavedPlans(day, item, scheduledPlans)) continue;
      const kind = inferredKind(item);
      if (sessions.some((session) => session.date === day.date && session.kind === kind)) continue;
      sessions.push({
        id: `completed:${day.date}:${item}`,
        date: day.date,
        kind,
        label: inferredLabel(item).replace(" pattern", ""),
        completed: true,
        source: "completed",
        focusId: `kind:${kind}`,
      });
    }
  }
  sessions.sort(
    (left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id),
  );

  const expectations = plan.days.flatMap((day) => {
    const items = adjustments[day.date] ?? day.inferredItems;
    return items.flatMap((item): TrainingContextExpectation[] => {
      const kind = inferredKind(item);
      if (sessions.some((session) => session.date === day.date && session.kind === kind)) return [];
      return [{ date: day.date, kind, label: inferredLabel(item) }];
    });
  });
  const counts = Object.fromEntries(KINDS.map((kind) => [kind, 0])) as Record<
    TrainingContextKind,
    number
  >;
  for (const session of sessions) counts[session.kind] += 1;

  const demanding = new Set<TrainingContextKind>(["strength", "climbing", "conditioning"]);
  const demandingByDate = new Map<string, TrainingContextSession[]>();
  for (const session of sessions.filter((item) => demanding.has(item.kind))) {
    demandingByDate.set(session.date, [...(demandingByDate.get(session.date) ?? []), session]);
  }
  const signals: TrainingContextSignal[] = [];
  const occupiedDates = new Set(sessions.map((session) => session.date));
  if (coaching?.preferences.saved) {
    const { preferences, focusLabels } = coaching;
    if (occupiedDates.size > preferences.weeklyTrainingDays) {
      signals.push({
        tone: "caution",
        title: `${occupiedDates.size} training days exceed your ${preferences.weeklyTrainingDays}-day limit`,
        detail:
          "Combine a supporting session with another day or remove the lowest-priority item before adding more.",
      });
    }
    if (demandingByDate.size > preferences.maxDemandingDays) {
      signals.push({
        tone: "caution",
        title: `${demandingByDate.size} demanding days exceed your limit of ${preferences.maxDemandingDays}`,
        detail:
          "Strength, climbing and conditioning currently ask for more hard days than you chose.",
      });
    }
    const represented = new Set(sessions.map((session) => session.focusId));
    const primaryLabel = focusLabels[preferences.primaryFocusId] ?? "Your primary focus";
    if (!represented.has(preferences.primaryFocusId)) {
      signals.push({
        tone: "caution",
        title: `${primaryLabel} has no saved session this week`,
        detail:
          "Your primary focus should usually receive space before supporting or maintenance work.",
      });
    }
    const missingSupporting = preferences.secondaryFocusIds.filter((id) => !represented.has(id));
    if (missingSupporting.length) {
      signals.push({
        tone: "information",
        title: `${missingSupporting.length} supporting priorit${missingSupporting.length === 1 ? "y is" : "ies are"} not yet scheduled`,
        detail: missingSupporting.map((id) => focusLabels[id] ?? "Saved focus").join(" · "),
      });
    }
  }
  const overlaps = [...demandingByDate.entries()].filter(
    ([, items]) => new Set(items.map((item) => item.kind)).size >= 2,
  );
  for (const [date, items] of overlaps.slice(0, 2)) {
    const labels = Array.from(new Set(items.map((item) => KIND_LABEL[item.kind])));
    signals.push({
      tone: "caution",
      title: `Demanding work overlaps on ${dayName(date)}`,
      detail: `${labels.join(" and ")} are both scheduled. Check that this reflects your priority for the day.`,
    });
  }

  const longestRun = consecutiveRuns([...demandingByDate.keys()]).sort(
    (left, right) => right.length - left.length,
  )[0];
  if (longestRun?.length >= 3) {
    signals.push({
      tone: "caution",
      title: `${longestRun.length} demanding days run together`,
      detail: `${dayName(longestRun[0])} to ${dayName(longestRun.at(-1) ?? longestRun[0])} has strength, climbing or conditioning each day.`,
    });
  }

  const skillSessions = sessions.filter((session) => session.kind === "skill");
  const pairedSkills = skillSessions.filter((skill) =>
    sessions.some((session) => session.date === skill.date && session.kind === "strength"),
  ).length;
  if (pairedSkills > 0) {
    signals.push({
      tone: "positive",
      title: "Skill practice is attached to strength days",
      detail: `${pairedSkills} skill session${pairedSkills === 1 ? " is" : "s are"} grouped with strength, containing its extra weekly footprint.`,
    });
  }

  const recoverySessions = sessions.filter((session) => session.kind === "mobility");
  const recoveryOnly = recoverySessions.filter(
    (recovery) => !(demandingByDate.get(recovery.date)?.length ?? 0),
  ).length;
  if (recoveryOnly > 0) {
    signals.push({
      tone: "positive",
      title: "Recovery work has its own space",
      detail: `${recoveryOnly} mobility or yoga session${recoveryOnly === 1 ? " sits" : "s sit"} away from demanding work.`,
    });
  }

  if (counts.strength > 0 && counts.climbing > 0 && overlaps.length === 0) {
    signals.push({
      tone: "information",
      title: "Strength and climbing are both represented",
      detail:
        "They are currently separated across the week; later readiness and fatigue signals will determine whether that spacing is sufficient.",
    });
  }
  if (expectations.length > 0) {
    signals.push({
      tone: "information",
      title: "Some of the week is still inferred",
      detail: `${expectations.length} item${expectations.length === 1 ? " comes" : "s come"} from recent patterns or your weekly adjustments rather than a saved session.`,
    });
  }

  const cautionCount = signals.filter((signal) => signal.tone === "caution").length;
  const openDays = plan.days.filter((day) => !occupiedDates.has(day.date)).length;
  const confidence = sessions.length >= 4 ? "high" : sessions.length >= 2 ? "medium" : "low";
  const headline = cautionCount
    ? cautionCount === 1
      ? "One pressure point is worth reviewing"
      : `${cautionCount} pressure points are worth reviewing`
    : sessions.length
      ? "The week looks workable on paper"
      : "The week is still taking shape";

  return {
    startDate: plan.startDate,
    endDate: plan.endDate,
    headline,
    confidence,
    sessions,
    expectations,
    counts,
    openDays,
    occupiedDays: occupiedDates.size,
    demandingDays: demandingByDate.size,
    signals: signals.slice(0, 4),
  };
}
