import { formatUKDate } from "./date";
import type { ExerciseSessionPoint, ExerciseSetPoint } from "./training-types";
import { progressRepValues } from "./data-quality";

export type ProgressDecisionKind = "progress" | "continue" | "hold" | "lighter" | "baseline";

export type ProgressDecision = {
  kind: ProgressDecisionKind;
  label: string;
  detail: string;
  evidence: string[];
};

type DecisionInput = {
  points: ExerciseSessionPoint[];
  performanceChange: number | null;
  volumeChange: number | null;
};

function completedSets(point: ExerciseSessionPoint) {
  return point.sets.filter((set) => set.completed !== false);
}

function workingSets(point: ExerciseSessionPoint) {
  const sets = completedSets(point).filter((set) => set.weight != null && set.weight > 0);
  const topWeight = sets.reduce<number | null>(
    (max, set) => (set.weight != null && (max == null || set.weight > max) ? set.weight : max),
    null,
  );
  return topWeight == null ? [] : sets.filter((set) => set.weight === topWeight);
}

function effectiveRepValues(sets: ExerciseSetPoint[]) {
  return progressRepValues(sets);
}

function effortValues(sets: ExerciseSetPoint[]) {
  return sets.flatMap((set) => (set.rpe != null ? [set.rpe] : []));
}

function setEvidence(point: ExerciseSessionPoint, sets: ExerciseSetPoint[]) {
  const weight = sets[0]?.weight;
  const aggregate = sets.find((set) => set.aggregateSets && set.aggregateSets > 1);
  if (aggregate && weight != null) {
    return `Latest: ${aggregate.aggregateSets} sets, ${aggregate.reps ?? "—"} total reps at ${weight} kg`;
  }
  const reps = sets.flatMap((set) => (set.reps != null ? [set.reps] : []));
  if (weight != null && reps.length) {
    return `Latest: ${reps.join(" / ")} reps at ${weight} kg`;
  }
  if (point.totalDuration > 0) {
    return `Latest: ${point.totalDuration} minutes on ${formatUKDate(point.date)}`;
  }
  if (point.totalReps > 0) {
    return `Latest: ${point.totalReps} total reps on ${formatUKDate(point.date)}`;
  }
  return `Latest session: ${formatUKDate(point.date)}`;
}

function trendEvidence(performanceChange: number | null, volumeChange: number | null) {
  const parts = [
    performanceChange == null
      ? ""
      : `performance ${performanceChange > 0 ? "+" : ""}${performanceChange}%`,
    volumeChange == null ? "" : `weekly volume ${volumeChange > 0 ? "+" : ""}${volumeChange}%`,
  ].filter(Boolean);
  return parts.length
    ? `Period comparison: ${parts.join(" · ")}`
    : "No prior-period comparison yet";
}

export function buildProgressDecision({
  points,
  performanceChange,
  volumeChange,
}: DecisionInput): ProgressDecision {
  const latest = points[points.length - 1];
  if (!latest) {
    return {
      kind: "baseline",
      label: "Build a baseline",
      detail: "Log this exercise a few times before changing the progression.",
      evidence: ["No matching completed sessions in this view"],
    };
  }

  const latestWorkingSets = workingSets(latest);
  const reps = effectiveRepValues(latestWorkingSets);
  const effort = effortValues(latestWorkingSets);
  const recent = points.slice(-3);
  const hardSessions = recent.filter((point) => {
    const values = effortValues(workingSets(point));
    return values.length > 0 && Math.max(...values) >= 9;
  }).length;
  const recentPerformance = recent.flatMap((point) =>
    point.est1RM != null ? [point.est1RM] : point.maxWeight != null ? [point.maxWeight] : [],
  );
  const recentDecline =
    recentPerformance.length >= 3 &&
    recentPerformance[recentPerformance.length - 1] < recentPerformance[0] * 0.98;
  const evidence = [
    setEvidence(latest, latestWorkingSets),
    effort.length
      ? `Latest working-set effort: RPE ${Math.max(...effort)}`
      : "Latest working-set RPE was not logged",
    trendEvidence(performanceChange, volumeChange),
  ];

  if (
    (performanceChange != null &&
      performanceChange <= -2 &&
      volumeChange != null &&
      volumeChange >= 10) ||
    (hardSessions >= 2 && recentDecline)
  ) {
    return {
      kind: "lighter",
      label: "Consider a lighter exposure",
      detail:
        "Recent performance and workload suggest checking recovery before adding load. Reduce either load or sets, then reassess next time.",
      evidence,
    };
  }

  if (latestWorkingSets.length > 0 && reps.length > 0) {
    const allAtFive = reps.every((value) => value >= 5);
    const completeComfortEvidence = effort.length === latestWorkingSets.length;
    const comfortable = completeComfortEvidence && effort.every((value) => value <= 8);

    if (allAtFive && comfortable) {
      return {
        kind: "progress",
        label: "Consider moving up",
        detail:
          "Every latest working set reached at least 5 reps at RPE 8 or below. A small load increase with reps reset is supported.",
        evidence,
      };
    }
    if (allAtFive) {
      return {
        kind: "hold",
        label: "Hold this load",
        detail: effort.length
          ? "The reps are there, but effort was above the comfortable threshold. Repeat the load before progressing."
          : "The reps are there, but RPE is missing. Repeat the load and record effort before progressing.",
        evidence,
      };
    }
    return {
      kind: "continue",
      label: "Keep the load and build reps",
      detail:
        "At least one latest working set is below 5 reps. Keep the load and add a rep where comfortable before moving up.",
      evidence,
    };
  }

  return {
    kind: "baseline",
    label: points.length >= 2 ? "Continue the current progression" : "Build a baseline",
    detail:
      points.length >= 2
        ? "There is history here, but not enough comparable load-and-rep evidence for a stronger recommendation."
        : "Log another comparable session before changing the progression.",
    evidence,
  };
}
