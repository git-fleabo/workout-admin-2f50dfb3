import {
  baseStrengthSlots,
  baseStrengthMethod,
  type BaseStrengthChoice,
} from "../../src/lib/base-strength-personal.ts";
import type { BaseStrengthProgrammeId } from "../../src/lib/base-strength-preview.ts";
import type { ProgrammeTemplate } from "../../src/lib/supabase-programmes.browser.ts";

export const strengthId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function strengthChoices(id: BaseStrengthProgrammeId): Record<string, BaseStrengthChoice> {
  return Object.fromEntries(
    baseStrengthSlots(id).map((slot, index) => [
      slot.key,
      {
        exerciseId: strengthId(10 + index),
        exerciseName: slot.name,
        trackingMode: slot.name === "Chin-ups" ? "reps_only" : "weight_reps",
        referenceMax: { base: slot.role === "variation" ? 50 : 100 },
        sets: 3,
        reps: 8,
        load: 20,
      },
    ]),
  );
}
export function strengthTemplate(id: BaseStrengthProgrammeId, weeks = 18): ProgrammeTemplate {
  const days = id === "bullmastiff" ? 4 : 3;
  return {
    id: strengthId(99),
    name: id,
    methodType: baseStrengthMethod(id),
    description: "",
    durationWeeks: weeks,
    sessionsPerWeek: days,
    defaultSetChoice: null,
    percentBase: null,
    roundingIncrement: 2.5,
    workouts: Array.from({ length: weeks * days }, (_, index) => ({
      id: strengthId(100 + index),
      name: "Session",
      sequenceIndex: index,
      weekNumber: Math.floor(index / days) + 1,
      dayNumber: 1,
      sessionNumber: (index % days) + 1,
      description: "",
      entries: [],
    })),
  };
}
