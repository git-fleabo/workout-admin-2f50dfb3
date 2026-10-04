import type { ExerciseSessionPoint } from "./training-types.ts";
import type { ProgressDecision } from "./progress-decision.ts";

export type ProgrammeProgression = {
  type: "fixed" | "double" | "source";
  minReps: number;
  maxReps: number;
  incrementKg: number;
  maxRpe: number;
};

export const FIXED_PROGRESSION: ProgrammeProgression = {
  type: "fixed",
  minReps: 8,
  maxReps: 12,
  incrementKg: 1,
  maxRpe: 8,
};

export function progressionSummary(rule: ProgrammeProgression) {
  if (rule.type === "source") return "Follow the source programme's decision rules";
  if (rule.type === "fixed") return "Follow the targets saved for each session";
  return `Build from ${rule.minReps} to ${rule.maxReps} reps; then add ${rule.incrementKg} kg at RPE ${rule.maxRpe} or below`;
}

export function programmeProgressDecision(input: {
  rule: ProgrammeProgression;
  point?: ExerciseSessionPoint;
  plannedSets: number;
}): ProgressDecision {
  const { rule, point, plannedSets } = input;
  const evidence = [progressionSummary(rule)];
  if (rule.type !== "double")
    return {
      kind: "continue",
      label:
        rule.type === "source" ? "Follow your programme's rules" : "Follow your planned targets",
      detail:
        rule.type === "source"
          ? "Use the source programme's decisions for this exercise. Review your saved future session if you want to change it."
          : "Your personal programme has explicit targets for each session. Review the next occurrence in My Programme before changing them.",
      evidence,
    };
  if (!point)
    return {
      kind: "baseline",
      label: "Start with your saved targets",
      detail:
        "Complete a linked programme workout before evaluating this exercise's rep-range progression.",
      evidence,
    };
  const externalLoadModes = new Set([
    "total_external_load",
    "per_implement_load",
    "combined_implement_load",
    "added_bodyweight_load",
  ]);
  if (
    point.sets.some(
      (set) => set.dataShape !== "individual" || !externalLoadModes.has(set.loadSemantics),
    ) ||
    new Set(point.sets.map((set) => set.loadSemantics)).size > 1
  )
    return {
      kind: "hold",
      label: "Check how the load is recorded",
      detail:
        "A kilogram increase needs comparable individual sets with a known external load. Assistance, bodyweight and ambiguous totals need a separate review; keep your saved targets for now.",
      evidence,
    };
  const sets = point.sets.filter(
    (set) => set.completed !== false && !(set.aggregateSets && set.aggregateSets > 1),
  );
  const enoughSets =
    sets.length === plannedSets && point.sets.length === plannedSets && plannedSets > 0;
  const reachedTop =
    enoughSets &&
    point.methods.length === 0 &&
    new Set(sets.map((set) => set.weight)).size === 1 &&
    sets.every((set) => set.reps != null && set.reps >= rule.maxReps && set.weight != null);
  const effortKnown = sets.every((set) => set.rpe != null);
  const comfortable = effortKnown && sets.every((set) => set.rpe! <= rule.maxRpe);
  evidence.push(
    `Last programme workout: ${sets.map((set) => set.reps ?? "—").join(" / ")} reps across ${sets.length} sets`,
  );
  if (reachedTop && comfortable)
    return {
      kind: "progress",
      label: `Consider adding ${rule.incrementKg} kg`,
      detail: `All required sets reached ${rule.maxReps} reps within your effort limit. Review a load increase and reset to ${rule.minReps} reps in My Programme; your saved targets stay in place until you apply it.`,
      evidence,
    };
  return {
    kind: reachedTop ? "hold" : "continue",
    label: reachedTop ? "Repeat this load" : "Build reps within your range",
    detail: reachedTop
      ? effortKnown
        ? "The repetitions reached the top, but effort exceeded your saved limit. Repeat before increasing load."
        : "Record effort for every working set before increasing load."
      : `Keep the load and work towards ${rule.maxReps} reps across all ${plannedSets} prescribed sets.`,
    evidence,
  };
}
