import type { CoachReadinessSnapshot } from "./coach-readiness.ts";
import type { WeeklyCoachCapacity } from "./weekly-coach-capacity.ts";
import type { WeeklyCoachDecisionHistory } from "./weekly-coach-recommendation.ts";
import type { WeeklyCoachRollover } from "./weekly-coach-rollover.ts";

export type WeeklyCoachAdaptationMode = "build" | "maintain" | "protect";

export type WeeklyCoachAdaptation = {
  mode: WeeklyCoachAdaptationMode;
  title: string;
  detail: string;
  additionLimit: 0 | 1 | 2;
  allowDoseProgression: boolean;
  preferOptionalReduction: boolean;
  frequencyAction: string;
  doseAction: string;
  placementAction: string;
  evidence: string[];
};

function recentReviewedOutcomes(history: WeeklyCoachDecisionHistory[], currentWeek: string) {
  const current = new Date(`${currentWeek}T00:00:00Z`).getTime();
  return history
    .filter((item) => {
      if (item.decision !== "accepted" || !item.outcomeRating || item.weekStart >= currentWeek) {
        return false;
      }
      const previous = new Date(`${item.weekStart}T00:00:00Z`).getTime();
      const ageDays = (current - previous) / 86_400_000;
      return ageDays >= 0 && ageDays <= 56;
    })
    .sort((left, right) => right.weekStart.localeCompare(left.weekStart));
}

export function buildWeeklyCoachAdaptation({
  readiness,
  capacity,
  history = [],
  currentWeek,
  rollover = null,
}: {
  readiness?: CoachReadinessSnapshot;
  capacity: WeeklyCoachCapacity;
  history?: WeeklyCoachDecisionHistory[];
  currentWeek: string;
  rollover?: WeeklyCoachRollover | null;
}): WeeklyCoachAdaptation {
  const outcomes = recentReviewedOutcomes(history, currentWeek);
  const latestOutcome = outcomes[0]?.outcomeRating ?? null;
  const strongProtect =
    readiness?.status === "reduce" ||
    capacity.status === "over_limit" ||
    latestOutcome === "too_hard";
  const protect = strongProtect || rollover?.status === "rebuild";
  const maintain =
    !protect &&
    ((readiness != null && readiness.status !== "ready") ||
      capacity.status === "near_limit" ||
      rollover?.status === "lighter");
  const mode: WeeklyCoachAdaptationMode = protect ? "protect" : maintain ? "maintain" : "build";
  const baseAdditionLimit = strongProtect ? 0 : mode === "protect" || mode === "maintain" ? 1 : 2;
  const additionLimit = Math.min(baseAdditionLimit, rollover?.additionLimit ?? 2) as 0 | 1 | 2;
  const outcomeEvidence = latestOutcome
    ? `Latest reviewed change: ${
        latestOutcome === "too_hard"
          ? "too hard"
          : latestOutcome === "too_easy"
            ? "too easy"
            : "felt right"
      }`
    : "Reviewed changes: no recent outcome yet";
  const evidence = [
    readiness ? `Recovery and adherence: ${readiness.title}` : "Recovery: evidence still loading",
    `Capacity: ${capacity.plannedMinutes}/${capacity.weeklyMinutes} min · ${capacity.plannedDays}/${capacity.weeklyTrainingDays} days · ${capacity.demandingDays}/${capacity.maxDemandingDays} demanding`,
    outcomeEvidence,
  ];
  if (rollover) evidence.push(`Last week: ${rollover.title}`);

  if (mode === "protect") {
    return {
      mode,
      title: "Protect recovery this week",
      detail: strongProtect
        ? "The coach will reduce one optional demand before adding work. Your strength programme remains a separate review."
        : "The coach will rebuild consistency from one manageable supporting action. Your strength programme remains a separate review.",
      additionLimit,
      allowDoseProgression: false,
      preferOptionalReduction: strongProtect,
      frequencyAction: strongProtect
        ? "Omit one lowest-priority optional session when that creates useful space."
        : "Rebuild from at most one supporting session before adding frequency.",
      doseAction: "Allow one small reduction; do not progress support dose.",
      placementAction:
        "Separate demanding domains and contain short support work on existing days.",
      evidence,
    };
  }
  if (mode === "maintain") {
    return {
      mode,
      title: "Keep the week steady",
      detail:
        "The coach will preserve current support dose and make only a small placement or frequency change when the saved week needs it.",
      additionLimit,
      allowDoseProgression: false,
      preferOptionalReduction: false,
      frequencyAction: "Keep optional frequency steady and add at most one missing priority.",
      doseAction: "Hold the current support dose while evidence builds.",
      placementAction: "Resolve demanding overlaps without moving programme sessions.",
      evidence,
    };
  }
  return {
    mode,
    title: "Build within capacity",
    detail:
      "Recovery, adherence and recent outcomes allow one proven progression while the full week stays inside your limits.",
    additionLimit,
    allowDoseProgression: true,
    preferOptionalReduction: false,
    frequencyAction: "Fill up to two missing priorities without exceeding weekly capacity.",
    doseAction: "Allow one proven support-dose step after review.",
    placementAction: "Use the lowest-pressure dates and preserve programme spacing.",
    evidence,
  };
}
