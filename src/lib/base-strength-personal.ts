import {
  baseStrengthSessions,
  buildBaseStrengthWeeks,
  roundedPreviewLoad,
  type BaseStrengthMovement,
  type BaseStrengthPhase,
  type BaseStrengthProgrammeId,
  type VolumeIntensityOptions,
} from "./base-strength-preview.ts";
import { personalPlanSchema, type PersonalProgrammeSession } from "./personal-programme.ts";
import { FIXED_PROGRESSION } from "./programme-progression.ts";
import { programmeWorkoutScheduledDate } from "./adaptive-strength.ts";
import type { ProgrammeTemplate } from "./supabase-programmes.browser.ts";

export const baseStrengthMethod = (id: BaseStrengthProgrammeId) => `base_strength_${id}`;
export const isBaseStrengthMethod = (method: string | null) =>
  method === baseStrengthMethod("bullmastiff") ||
  method === baseStrengthMethod("volume_intensity") ||
  method === baseStrengthMethod("dup");
export type BaseStrengthChoice = {
  exerciseId: string;
  exerciseName: string;
  trackingMode: "weight_reps" | "reps_only";
  referenceMax: Partial<Record<"base" | "build" | "peak", number>>;
  sets: number | null;
  reps: number | null;
  load: number | null;
};
export type BaseStrengthSlot = {
  key: string;
  name: string;
  role: BaseStrengthMovement["role"];
  phase: BaseStrengthPhase | null;
};
export function baseStrengthSlotKey(
  m: BaseStrengthMovement,
  phase: string,
  day: number,
  index: number,
) {
  if (m.role === "main") return `main:${m.reference}`;
  if (m.role === "variation") return `variation:${phase}:${day}`;
  // Shared accessory choices retain distinct per-session identities in the saved plan.
  return `accessory:${m.name}:${index}`;
}
export function baseStrengthSlots(id: BaseStrengthProgrammeId): BaseStrengthSlot[] {
  const slots = new Map<string, BaseStrengthSlot>();
  for (const week of buildBaseStrengthWeeks(id)) {
    baseStrengthSessions(id, week).forEach((session, day) =>
      session.movements.forEach((m, index) => {
        const key = baseStrengthSlotKey(m, week.phase, day, index);
        if (!slots.has(key))
          slots.set(key, {
            key,
            name: m.name,
            role: m.role,
            phase: m.role === "variation" ? week.phase : null,
          });
      }),
    );
  }
  return [...slots.values()].sort(
    (a, b) =>
      ["main", "variation", "accessory"].indexOf(a.role) -
      ["main", "variation", "accessory"].indexOf(b.role),
  );
}

export function buildBaseStrengthPersonalSessions(input: {
  programme: BaseStrengthProgrammeId;
  options: VolumeIntensityOptions;
  template: ProgrammeTemplate;
  choices: Record<string, BaseStrengthChoice>;
  startedOn: string;
  increment: number;
  locationKind: "home" | "gym";
}): PersonalProgrammeSession[] {
  const weeks = buildBaseStrengthWeeks(input.programme, input.options);
  if (
    input.template.methodType !== baseStrengthMethod(input.programme) ||
    input.template.durationWeeks !== weeks.length ||
    input.template.workouts.length !== weeks.length * (input.programme === "bullmastiff" ? 4 : 3)
  )
    throw new Error("This starting programme is unavailable. Refresh the programme library.");
  if (!Number.isFinite(input.increment) || input.increment <= 0 || input.increment > 100)
    throw new Error("Choose a positive load increment up to 100 kg.");
  const days = input.programme === "bullmastiff" ? [1, 2, 4, 5] : [1, 3, 5];
  const workouts = [...input.template.workouts].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  return weeks.flatMap((week) =>
    baseStrengthSessions(input.programme, week).map((session, day) => {
      const movements = session.movements.flatMap((m, index) => {
        const key = baseStrengthSlotKey(m, week.phase, day, index);
        const choice = input.choices[key];
        if (input.programme === "dup" && m.role === "accessory" && !choice?.exerciseId) return [];
        if (!choice?.exerciseId) throw new Error(`Choose an exercise for ${m.name}.`);
        if (m.role !== "accessory" && choice.trackingMode !== "weight_reps")
          throw new Error(`${m.name} needs an exercise recorded as load and reps.`);
        const referenceMax = choice.referenceMax[week.phase] ?? null;
        if (week.phase === "base" && m.role !== "accessory" && !referenceMax)
          throw new Error(`Enter a base-phase estimated max for ${m.name}.`);
        const sets = m.sets ?? choice.sets;
        const reps = m.reps ?? (m.plusLastSet ? null : choice.reps);
        if (
          !sets ||
          !Number.isInteger(sets) ||
          sets < 1 ||
          sets > 20 ||
          (!m.plusLastSet && (!reps || !Number.isInteger(reps) || reps < 1 || reps > 100))
        )
          throw new Error(`Choose sets and reps for ${m.name}'s personal targets.`);
        const load =
          choice.trackingMode === "reps_only"
            ? null
            : m.role === "accessory"
              ? choice.load
              : roundedPreviewLoad(referenceMax, m.percent, input.increment);
        const detail = [
          m.guidance,
          m.plusLastSet ? "Final set is a plus set; log the actual reps achieved." : "",
          load == null && choice.trackingMode === "weight_reps"
            ? "Review the load before starting this session."
            : "",
        ]
          .filter(Boolean)
          .join(" ");
        return {
          exerciseId: choice.exerciseId,
          exercise: choice.exerciseName,
          workoutType: "Strength",
          trackingMode: choice.trackingMode,
          programmeKey: `bs:${day}:${index}`,
          targets: {
            durationMinutes: "",
            distance: "",
            distanceUnit: "",
            rounds: "",
            height: "",
            detail,
          },
          sourceDate: "",
          reason: detail,
          restTime: "",
          progression: { ...FIXED_PROGRESSION, type: "source" as const },
          baseStrength: {
            programme: input.programme,
            week: week.number,
            phase: week.phase,
            wave: week.wave,
            waveWeek: week.waveWeek,
            role: m.role,
            referenceMax,
            percent: m.percent,
            plusLastSet: m.plusLastSet,
            incrementKg: input.increment,
            ...(m.exposure ? { exposure: m.exposure } : {}),
            ...(m.backOffSets != null ? { backOffPercent: 90 as const } : {}),
          },
          setRows: Array.from({ length: sets + (m.backOffSets ?? 0) }, (_, setIndex) => ({
            reps: reps == null ? "" : String(reps),
            weight: load == null ? "" : String(load),
            durationSeconds: "",
            rpe:
              m.rpeTarget == null || (m.backOffSets != null && setIndex > 0)
                ? ""
                : String(m.rpeTarget),
            completed: true,
          })),
        };
      });
      return {
        workoutId: workouts[(week.number - 1) * days.length + day].id,
        revision: 0,
        name: `Week ${week.number} · ${week.phaseLabel} · ${session.name.replace(/^[^·]+ · /, `Day ${days[day]} · `)}`,
        scheduledDate:
          programmeWorkoutScheduledDate(input.startedOn, week.number, days[day]) ?? input.startedOn,
        plan: personalPlanSchema.parse({
          version: 1,
          locationKind: input.locationKind,
          baseStrength: input.programme,
          movements,
        }),
      };
    }),
  );
}

export type BaseStrengthProgressionReview = {
  kind: "increase" | "hold" | "review" | "reset";
  load: number | null;
  detail: string;
  fingerprint: string;
  revision: number;
  previousSessionId?: string;
  previousReps?: number;
  previousLoad?: number;
};
