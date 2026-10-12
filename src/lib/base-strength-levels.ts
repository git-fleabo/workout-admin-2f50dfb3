import { roundedPreviewLoad } from "./base-strength-preview.ts";
import type { PersonalProgrammeMovement, PersonalProgrammeSession } from "./personal-programme.ts";
import type { ProgrammeAssignment, ProgrammeTemplate } from "./supabase-programmes.browser.ts";

export type BaseLevel = {
  key: string;
  exercise: string;
  phase: "base" | "build" | "peak";
  role: "main" | "variation" | "accessory";
  kind: "max" | "load";
  value: string;
  mixed: boolean;
};
export type BaseLevelChange = {
  session: string;
  exercise: string;
  phase: BaseLevel["phase"];
  percent: number | null;
  before: string[];
  after: string[];
  beforeMax: number | null;
  afterMax: number | null;
};
export type BaseLevelContext = {
  assignment: ProgrammeAssignment;
  template: ProgrammeTemplate;
  lockedWorkoutIds: string[];
};

function keyFor(movement: PersonalProgrammeMovement): string | null {
  const rule = movement.baseStrength;
  if (!rule || movement.progression.type !== "source" || movement.trackingMode !== "weight_reps")
    return null;
  return `${rule.role}:${rule.phase}:${movement.exerciseId}`;
}

function futureSessions({ assignment, template, lockedWorkoutIds }: BaseLevelContext) {
  if (assignment.status !== "active" && assignment.status !== "paused") return [];
  const positions = new Map(
    template.workouts.map((workout) => [workout.id, workout.sequenceIndex]),
  );
  const locked = new Set(lockedWorkoutIds);
  return (assignment.personalProgramme?.sessions ?? []).filter((session) => {
    const position = positions.get(session.workoutId);
    return (
      position != null &&
      position >= assignment.currentWorkoutIndex &&
      !locked.has(session.workoutId) &&
      Boolean(session.plan.baseStrength)
    );
  });
}

export function listBaseLevels(context: BaseLevelContext): BaseLevel[] {
  const groups = new Map<string, { level: BaseLevel; values: Set<string>; percentage: boolean }>();
  for (const session of futureSessions(context)) {
    for (const movement of session.plan.movements) {
      const key = keyFor(movement);
      if (!key) continue;
      const rule = movement.baseStrength!;
      const kind = rule.role === "accessory" ? "load" : "max";
      let group = groups.get(key);
      if (!group) {
        group = {
          level: {
            key,
            exercise: movement.exercise,
            phase: rule.phase,
            role: rule.role,
            kind,
            value: "",
            mixed: false,
          },
          values: new Set(),
          percentage: false,
        };
        groups.set(key, group);
      }
      group.percentage ||= rule.percent != null;
      const values =
        kind === "load"
          ? movement.setRows.map((set) => set.weight)
          : [rule.referenceMax == null ? "" : String(rule.referenceMax)];
      values.forEach((value) => group!.values.add(value));
    }
  }
  return (
    [...groups.values()]
      // An estimated max cannot choose an RPE top set. Show only phases that
      // actually have percentage prescriptions, plus explicit accessory loads.
      .filter((group) => group.level.kind === "load" || group.percentage)
      .map(({ level, values }) => ({
        ...level,
        mixed: values.size > 1,
        value: values.size === 1 ? [...values][0] : "",
      }))
  );
}

export function previewBaseLevels(
  context: BaseLevelContext,
  edits: Record<string, string>,
): {
  updates: PersonalProgrammeSession[];
  changes: BaseLevelChange[];
} {
  const levels = new Map(listBaseLevels(context).map((level) => [level.key, level]));
  const selected = new Map<string, number>();
  for (const [key, value] of Object.entries(edits)) {
    const level = levels.get(key);
    if (!level) throw new Error("A base level is no longer editable. Reopen the editor.");
    if (!level.mixed && value === level.value) continue;
    if (
      !/^\d+(\.\d+)?$/.test(value) ||
      !Number.isFinite(Number(value)) ||
      Number(value) > 1000 ||
      Number(value) < 0 ||
      (level.kind === "max" && Number(value) === 0)
    )
      throw new Error(
        `${level.exercise}: enter ${level.kind === "max" ? "a positive estimated max" : "a load of zero or more"} up to 1000 kg.`,
      );
    selected.set(key, Number(value));
  }
  const updates: PersonalProgrammeSession[] = [];
  const changes: BaseLevelChange[] = [];
  for (const session of futureSessions(context)) {
    const movements = session.plan.movements.map((movement) => {
      const key = keyFor(movement);
      const value = key ? selected.get(key) : undefined;
      if (value == null) return movement;
      const rule = movement.baseStrength!;
      if (rule.role !== "accessory" && value === rule.referenceMax) return movement;
      const next = structuredClone(movement);
      if (rule.role === "accessory") {
        next.setRows.forEach((set) => {
          set.weight = String(value);
        });
      } else {
        next.baseStrength!.referenceMax = value;
        // Approved plus-set decisions depend on the old max. Keep unresolved
        // loads unresolved; never turn them into generic percentage work.
        if (rule.percent != null) {
          const load = roundedPreviewLoad(value, rule.percent, rule.incrementKg);
          if (load == null || load > 1000)
            throw new Error(
              `${movement.exercise}: this max cannot produce a working load at the saved increment.`,
            );
          next.setRows.forEach((set) => {
            set.weight = String(load);
          });
        } else if (rule.approvedFingerprint && value !== rule.referenceMax) {
          next.setRows.forEach((set) => {
            set.weight = "";
          });
        }
        if (value !== rule.referenceMax) delete next.baseStrength!.approvedFingerprint;
      }
      if (JSON.stringify(next) === JSON.stringify(movement)) return movement;
      changes.push({
        session: session.name,
        exercise: movement.exercise,
        phase: rule.phase,
        percent: rule.percent,
        before: movement.setRows.map((set) => set.weight),
        after: next.setRows.map((set) => set.weight),
        beforeMax: rule.referenceMax,
        afterMax: next.baseStrength!.referenceMax,
      });
      return next;
    });
    if (movements.some((movement, index) => movement !== session.plan.movements[index])) {
      const updated = structuredClone(session);
      updated.plan.movements = movements;
      delete updated.reviewedPlan;
      delete updated.strengthReviewId;
      updates.push(updated);
    }
  }
  if (updates.length > 100)
    throw new Error("Update one phase at a time; at most 100 sessions can be saved together.");
  return { updates, changes };
}
