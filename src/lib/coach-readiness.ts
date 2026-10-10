import type {
  ProgrammeSupportPlanHistoryEntry,
  SkillGoalExercise,
  SkillPracticeHistoryEntry,
} from "./programme-support.ts";
import { recommendSkillPracticeDose } from "./programme-support.ts";
import type { SavedWorkoutPlan } from "./supabase-plans.browser.ts";
import type { WeeklyLoadHistoryItem } from "./supabase-weekly-load.browser.ts";
import type { GoalRow } from "./training-types.ts";
import type { WeeklyPlan } from "./weekly-plan.ts";
import {
  buildWeeklyRecoveryRecommendation,
  type WeeklyRecoveryLevel,
  type WeeklyRecoveryAdjustments,
} from "./weekly-recovery.ts";
import type { RecentWorkoutLog } from "./workout-plan.ts";

export type CoachReadinessStatus = "ready" | "hold" | "reduce" | "insufficient";

export type CoachReadinessSnapshot = {
  status: CoachReadinessStatus;
  title: string;
  detail: string;
  evidence: string[];
  maxPain: number | null;
  hardDays: number;
  effortCoverage: number;
  supportAdherence: number | null;
  supportDue: number;
  recoveryLevel: WeeklyRecoveryLevel;
};

export type SupportDoseOpportunity = {
  suggestedWorkoutId: string;
  subjectFocusId: string;
  sessionLabel: string;
  date: string;
  adjustment: "progress" | "reduce";
  currentSets: number;
  currentValue: number;
  targetSets: number;
  targetValue: number;
  doseUnit: "reps" | "seconds";
  rationale: string;
};

function addDays(value: string, count: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function numberOrNull(value: unknown) {
  if (value == null || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function percentage(value: number) {
  return `${Math.round(value)}%`;
}

export function buildCoachReadinessSnapshot({
  logs,
  loadHistory,
  plan,
  adjustments,
  supportPlans,
  today,
}: {
  logs: RecentWorkoutLog[];
  loadHistory: WeeklyLoadHistoryItem[];
  plan: WeeklyPlan;
  adjustments: WeeklyRecoveryAdjustments;
  supportPlans: ProgrammeSupportPlanHistoryEntry[];
  today: string;
}): CoachReadinessSnapshot {
  const recovery = buildWeeklyRecoveryRecommendation({
    logs,
    loadHistory,
    plan,
    adjustments,
    today,
  });
  const recentStart = addDays(today, -13);
  const recentLogs = logs.filter(
    (log) => log.completed && log.date >= recentStart && log.date <= today,
  );
  const painValues = recentLogs
    .map((log) => numberOrNull(log.pain))
    .filter((value): value is number => value != null);
  const maxPain = painValues.length ? Math.max(...painValues) : null;
  const adherenceStart = addDays(today, -27);
  const dueSupport = supportPlans.filter(
    (item) =>
      item.date >= adherenceStart &&
      item.date < today &&
      ["pending", "accepted", "completed", "skipped"].includes(item.status),
  );
  const completedSupport = dueSupport.filter((item) => item.status === "completed").length;
  const supportAdherence = dueSupport.length ? (completedSupport / dueSupport.length) * 100 : null;
  const lowAdherence = dueSupport.length >= 2 && supportAdherence != null && supportAdherence < 75;
  const completeAdherence =
    dueSupport.length >= 4 && supportAdherence != null && supportAdherence >= 80;
  const reduceSignal = (maxPain ?? 0) >= 4 || recovery.level === "deload";
  const holdSignal = (maxPain ?? 0) > 0 || recovery.level === "lighter" || lowAdherence;
  const enoughPositiveEvidence =
    recovery.level === "normal" &&
    (maxPain == null || maxPain === 0) &&
    recovery.hardDays <= 1 &&
    recovery.effortCoverage >= 40 &&
    completeAdherence;

  const painEvidence =
    maxPain == null
      ? "Pain evidence: no pain score recorded in the last 14 days"
      : `Pain evidence: highest recorded score ${maxPain}/10 in the last 14 days`;
  const adherenceEvidence =
    supportAdherence == null
      ? "Support adherence: no due support sessions in the last 28 days"
      : `Support adherence: ${completedSupport} of ${dueSupport.length} due sessions completed (${percentage(supportAdherence)})`;
  const evidence = [
    painEvidence,
    `Effort evidence: ${recovery.hardDays} hard day${recovery.hardDays === 1 ? "" : "s"} at RPE 9+ · ${recovery.effortCoverage}% RPE coverage`,
    `Load evidence: ${recovery.recentLoad} points in the recent 14 days vs ${recovery.priorLoad} previously`,
    adherenceEvidence,
  ];

  if (reduceSignal) {
    return {
      status: "reduce",
      title: "Reduce support dose",
      detail:
        "Pain or accumulated recovery pressure supports a small reduction to optional support work before the next review.",
      evidence,
      maxPain,
      hardDays: recovery.hardDays,
      effortCoverage: recovery.effortCoverage,
      supportAdherence,
      supportDue: dueSupport.length,
      recoveryLevel: recovery.level,
    };
  }
  if (holdSignal) {
    return {
      status: "hold",
      title: "Hold the current dose",
      detail:
        "The evidence supports keeping support work steady. The coach will not add dose while recovery or adherence is unsettled.",
      evidence,
      maxPain,
      hardDays: recovery.hardDays,
      effortCoverage: recovery.effortCoverage,
      supportAdherence,
      supportDue: dueSupport.length,
      recoveryLevel: recovery.level,
    };
  }
  if (enoughPositiveEvidence) {
    return {
      status: "ready",
      title: "Progression can be reviewed",
      detail:
        "Recent effort, pain, load, and adherence are stable enough to consider the next proven support-dose step.",
      evidence,
      maxPain,
      hardDays: recovery.hardDays,
      effortCoverage: recovery.effortCoverage,
      supportAdherence,
      supportDue: dueSupport.length,
      recoveryLevel: recovery.level,
    };
  }
  return {
    status: "insufficient",
    title: "Keep the current dose while evidence builds",
    detail:
      "The coach does not yet have enough complete effort and adherence evidence to recommend adding support work.",
    evidence,
    maxPain,
    hardDays: recovery.hardDays,
    effortCoverage: recovery.effortCoverage,
    supportAdherence,
    supportDue: dueSupport.length,
    recoveryLevel: recovery.level,
  };
}

function uniformPlanDose(plan: SavedWorkoutPlan) {
  const movement = plan.movements[0];
  if (
    plan.movements.length !== 1 ||
    !movement ||
    !["reps_only", "hold", "grip_hold"].includes(movement.trackingMode) ||
    movement.setRows.length === 0
  ) {
    return null;
  }
  const holds = movement.trackingMode === "hold" || movement.trackingMode === "grip_hold";
  const values = movement.setRows
    .map((set) => numberOrNull(holds ? set.durationSeconds : set.reps))
    .filter((value): value is number => value != null);
  if (values.length !== movement.setRows.length || new Set(values).size !== 1) return null;
  return {
    sets: movement.setRows.length,
    value: values[0],
    unit: holds ? ("seconds" as const) : ("reps" as const),
  };
}

export function buildSupportDoseOpportunities({
  readiness,
  scheduledPlans,
  goals,
  exercises,
  skillHistory,
}: {
  readiness: CoachReadinessSnapshot;
  scheduledPlans: SavedWorkoutPlan[];
  goals: GoalRow[];
  exercises: SkillGoalExercise[];
  skillHistory: Record<string, SkillPracticeHistoryEntry[]>;
}): SupportDoseOpportunity[] {
  if (readiness.status !== "ready" && readiness.status !== "reduce") return [];
  const goalById = new Map(goals.map((goal) => [goal.id, goal]));
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  return scheduledPlans.flatMap((plan): SupportDoseOpportunity[] => {
    if (
      !plan.programAssignmentId ||
      plan.programWorkoutId ||
      !plan.goalId ||
      plan.planKind !== "skill" ||
      !["pending", "accepted"].includes(plan.status) ||
      !plan.suggestedFor
    ) {
      return [];
    }
    const current = uniformPlanDose(plan);
    const goal = goalById.get(plan.goalId);
    const exercise = goal ? exerciseById.get(goal.exerciseId) : undefined;
    if (!current || !goal || !exercise) return [];

    if (readiness.status === "reduce") {
      const decrement = current.unit === "seconds" ? 2 : 1;
      const targetSets = current.sets > 1 ? current.sets - 1 : current.sets;
      const targetValue = current.sets > 1 ? current.value : Math.max(1, current.value - decrement);
      if (targetSets === current.sets && targetValue === current.value) return [];
      return [
        {
          suggestedWorkoutId: plan.suggestedWorkoutId,
          subjectFocusId: `goal:${plan.goalId}`,
          sessionLabel: plan.title,
          date: plan.suggestedFor,
          adjustment: "reduce",
          currentSets: current.sets,
          currentValue: current.value,
          targetSets,
          targetValue,
          doseUnit: current.unit,
          rationale: `${readiness.title}. Reduce only this upcoming support session from ${current.sets} × ${current.value} to ${targetSets} × ${targetValue} ${current.unit}.`,
        },
      ];
    }

    const recommendation = recommendSkillPracticeDose({
      goal,
      exercise,
      history: skillHistory[goal.id] ?? [],
    });
    if (
      recommendation.decision !== "progress" ||
      recommendation.unit !== current.unit ||
      recommendation.sets !== current.sets ||
      recommendation.value <= current.value
    ) {
      return [];
    }
    return [
      {
        suggestedWorkoutId: plan.suggestedWorkoutId,
        subjectFocusId: `goal:${plan.goalId}`,
        sessionLabel: plan.title,
        date: plan.suggestedFor,
        adjustment: "progress",
        currentSets: current.sets,
        currentValue: current.value,
        targetSets: recommendation.sets,
        targetValue: recommendation.value,
        doseUnit: current.unit,
        rationale: `${recommendation.explanation} Readiness evidence supports applying that change to this upcoming support session.`,
      },
    ];
  });
}
