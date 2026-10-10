import type { KettlebellCategory, KettlebellWorkout } from "../../src/lib/kettlebell-workouts.ts";

export const kbId = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
// Original test data, deliberately not taken from Strong ON! Never seeded into the app.
export function kbFixture(
  category: KettlebellCategory = "strength",
  number = 1,
): KettlebellWorkout {
  return {
    id: kbId(number + { strength: 100, muscle: 200, conditioning: 300 }[category]),
    collectionKey: "strong_on",
    category,
    sourceNumber: number,
    title: `Original ${category} test ${number}`,
    summary: "Original test fixture only",
    instructions:
      "Test instructions: finish each set with control, then rest. Record your actual work.",
    sourceReference: "Original test data, not a book workout",
    bellCount: 1,
    requiredEquipmentIds: [],
    durationMinutes: null,
    version: 1,
    verified: true,
    isAvailable: true,
    prescription: {
      movements: [
        {
          exerciseId: kbId(10),
          exercise: "Kettlebell test lift",
          workoutType: category === "conditioning" ? "Conditioning" : "Strength",
          trackingMode: "weight_reps",
          targets: {
            durationMinutes: "",
            distance: "",
            distanceUnit: "",
            rounds: "",
            height: "",
            detail: "Alternate sides after each set.",
          },
          sourceDate: "",
          reason: "Five reps each side.",
          restTime: "60 sec",
          setRows: [5, 4, 3].map((reps) => ({
            reps: String(reps),
            weight: "",
            durationSeconds: "",
            rpe: "",
            completed: false,
          })),
        },
      ],
      methodBlocks: [],
    },
  };
}
