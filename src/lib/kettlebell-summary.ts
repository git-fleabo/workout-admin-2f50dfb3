import { z } from "zod";
import { readWorkoutPlanDraft, type WorkoutPlanDraft } from "./workout-plan";
import { previewTarget } from "./workout-preview";
import type { WorkoutSessionInput } from "./supabase-log.browser";

export const kettlebellLogSchema = z.object({
  mode: z.enum(["summary", "sets"]),
  plan: z.custom<WorkoutPlanDraft>((value) => {
    const plan = readWorkoutPlanDraft(JSON.stringify(value));
    return Boolean(plan?.kettlebell);
  }),
  weightUsed: z.string().max(500),
  result: z.string().max(500),
});
export type KettlebellLogState = z.infer<typeof kettlebellLogSchema>;

export function kettlebellResultLabel(plan: WorkoutPlanDraft) {
  const configs = (plan.methodBlocks ?? []).map((block) => block.config);
  if (
    configs.some(
      (config) =>
        /ladder|pyramid/.test(String(config.sequence_kind ?? "")) ||
        Object.keys(config).some((key) => key.startsWith("ladder_")),
    )
  ) {
    return "Ladder / pyramid progress";
  }
  if (configs.some((config) => config.mode === "amrap")) return "Rounds completed";
  return null;
}

export function kettlebellDefaultDuration(plan: WorkoutPlanDraft) {
  if (plan.kettlebell?.durationMinutes) return String(plan.kettlebell.durationMinutes);
  const minutes = (plan.methodBlocks ?? []).reduce(
    (total, block) => total + (Number(block.blockDurationMinutes) || 0),
    0,
  );
  return minutes > 0 ? String(minutes) : "";
}

export function buildKettlebellSummaryPayload(
  session: WorkoutSessionInput,
  log: KettlebellLogState,
): WorkoutSessionInput {
  const { plan } = log;
  if (!plan.kettlebell) throw new Error("The kettlebell prescription is missing.");
  if (
    !Number.isFinite(Number(session.duration)) ||
    Number(session.duration) <= 0 ||
    Number(session.duration) > 1440
  ) {
    throw new Error("Enter the actual workout duration in minutes.");
  }
  const resultLabel = kettlebellResultLabel(plan);
  const result = resultLabel ? log.result.trim() : "";
  const summary = [
    "Kettlebell summary log",
    log.weightUsed.trim() ? `Weight used: ${log.weightUsed.trim()}` : "",
    result ? `${resultLabel}: ${result}` : "",
    session.notes.trim(),
  ]
    .filter(Boolean)
    .join("\n");
  const reference = [
    "Prescribed workout (reference only)",
    plan.basis,
    plan.kettlebell.instructions,
    ...plan.movements.map(
      (movement, index) =>
        `${index + 1}. ${movement.exercise}: ${previewTarget(movement)}${movement.targets.detail ? ` · ${movement.targets.detail}` : ""}`,
    ),
  ].join("\n");
  const template = session.entries[0];
  if (!template) throw new Error("The workout is missing its prescription.");
  return {
    ...session,
    notes: summary,
    kettlebellSummary: {
      weightUsed: log.weightUsed.trim(),
      result,
      resultLabel: resultLabel ?? "",
    },
    entries: [
      {
        ...template,
        exercise: plan.title,
        workoutType: plan.kettlebell.category === "conditioning" ? "Conditioning" : "Strength",
        entryKind: "Workout",
        sets: "",
        reps: "",
        weight: "",
        holdSeconds: "",
        duration: "",
        rounds: "",
        rpe: "",
        distance: "",
        distanceUnit: "",
        height: "",
        progressionLevel: "",
        restTime: "",
        assistanceType: "",
        assistanceDetail: "",
        quality: "",
        technique: "",
        pain: "",
        feel: "",
        positionMeasurementCm: "",
        positionMeasurementSetup: "",
        loadSemantics: "",
        detail: "Session summary; individual sets and reps were not recorded.",
        notes: reference,
        setRows: [],
        completed: true,
      },
    ],
    methodBlocks: [],
  };
}
