// Source: Alex Bromley, Base Strength, Kindle ASIN B08R5J58F8, pp. 83–85 and 93–97.
// These review models deliberately do not create assignments or amend logged workouts.
export type BaseStrengthProgrammeId = "volume_intensity" | "bullmastiff";
export type BaseStrengthPhase = "base" | "build" | "peak";
export type BaseStrengthLift = "squat" | "bench" | "deadlift" | "press";
export const BASE_STRENGTH_LIFTS: Record<BaseStrengthLift, string> = {
  squat: "Squat",
  bench: "Bench press",
  deadlift: "Deadlift",
  press: "Overhead press",
};
export const BASE_STRENGTH_SOURCE_URL = "https://read.amazon.com/?asin=B08R5J58F8";
export const BASE_STRENGTH_CATALOGUE = [
  {
    id: "volume_intensity",
    name: "Volume/Intensity",
    days: 3,
    pages: "83–85",
    description:
      "Full-body strength with separate volume and intensity work. A focused plan built around the main lifts.",
    emphasis: "Strength · fewer accessories",
  },
  {
    id: "bullmastiff",
    name: "Bullmastiff",
    days: 4,
    pages: "93–97",
    description:
      "Main lifts, variations and bodybuilding work. Your final plus set guides the next load within each wave.",
    emphasis: "Strength + size · substantial volume",
  },
] as const;

export type VolumeIntensityOptions = {
  initialWaves: number;
  buildWaves: number;
  peakWaves: number;
  waveIncreasePercent: number;
};
// Source permits repeats; the bridge repeat count and 3% choice are preview defaults.
export const DEFAULT_VOLUME_INTENSITY_OPTIONS: VolumeIntensityOptions = {
  initialWaves: 2,
  buildWaves: 1,
  peakWaves: 3,
  waveIncreasePercent: 3,
};
export type PreviewPrescription = {
  sets: number | null;
  reps: number | null;
  percent: number | null;
  plusLastSet: boolean;
  rpeTarget: number | null;
  guidance: string;
};
export type BaseStrengthWeek = {
  number: number;
  phase: BaseStrengthPhase;
  phaseLabel: string;
  wave: number;
  waveWeek: number;
  volume: PreviewPrescription | null;
  main: PreviewPrescription;
  variation: PreviewPrescription | null;
};
export type BaseStrengthMovement = PreviewPrescription & {
  name: string;
  role: "main" | "variation" | "accessory";
  reference: BaseStrengthLift | "variation" | null;
};
export type BaseStrengthSession = { name: string; movements: BaseStrengthMovement[] };

function prescription(
  sets: number | null,
  reps: number | null,
  percent: number | null,
  guidance: string,
  plusLastSet = false,
  rpeTarget: number | null = null,
): PreviewPrescription {
  return { sets, reps, percent, guidance, plusLastSet, rpeTarget };
}

export function buildBaseStrengthWeeks(
  programme: BaseStrengthProgrammeId,
  options: VolumeIntensityOptions = DEFAULT_VOLUME_INTENSITY_OPTIONS,
): BaseStrengthWeek[] {
  if (programme !== "volume_intensity" && programme !== "bullmastiff")
    throw new Error("Choose a supported Base Strength programme.");
  if (
    programme === "volume_intensity" &&
    (![2, 3].includes(options.initialWaves) ||
      !Number.isInteger(options.buildWaves) ||
      options.buildWaves < 1 ||
      options.buildWaves > 3 ||
      !Number.isInteger(options.peakWaves) ||
      options.peakWaves < 3 ||
      options.peakWaves > 4 ||
      !Number.isFinite(options.waveIncreasePercent) ||
      options.waveIncreasePercent < 2 ||
      options.waveIncreasePercent > 4)
  )
    throw new Error("Use 2–3 initial waves, 1–3 build waves, 3–4 peak waves and a 2–4% increase.");

  const weeks: BaseStrengthWeek[] = [];
  const phases: Array<{ phase: BaseStrengthPhase; label: string; waves: number }> =
    programme === "bullmastiff"
      ? [
          { phase: "base", label: "Base", waves: 3 },
          { phase: "peak", label: "Peak", waves: 3 },
        ]
      : [
          { phase: "base", label: "Base · capacity", waves: options.initialWaves },
          { phase: "build", label: "Base · heavier wave", waves: options.buildWaves },
          { phase: "peak", label: "Peak", waves: options.peakWaves },
        ];
  for (const { phase, label, waves } of phases) {
    for (let wave = 1; wave <= waves; wave++) {
      for (let weekIndex = 0; weekIndex < 3; weekIndex++) {
        let volume: PreviewPrescription | null = null;
        let main: PreviewPrescription;
        let variation: PreviewPrescription | null = null;
        if (programme === "volume_intensity") {
          const offset = (wave - 1) * options.waveIncreasePercent;
          volume =
            phase === "peak"
              ? prescription(
                  5,
                  [5, 4, 3][weekIndex],
                  [75, 80, 85][weekIndex] + offset,
                  "Volume drops as intensity rises.",
                )
              : prescription(
                  [3, 4, 5][weekIndex],
                  (phase === "base" ? [12, 10, 8] : [10, 8, 6])[weekIndex],
                  (phase === "base" ? [55, 60, 65] : [60, 65, 70])[weekIndex] + offset,
                  "Build sets as the rep target falls.",
                );
          main =
            phase === "peak"
              ? prescription(
                  1,
                  [5, 3, 1][weekIndex],
                  null,
                  "Choose the load to meet RPE 7. Repeat with a small increase only while preserving the effort target.",
                  false,
                  7,
                )
              : prescription(
                  1,
                  null,
                  (phase === "base" ? [65, 70, 75] : [70, 75, 80])[weekIndex] + offset,
                  "AMRAP with 1–2 reps in reserve; stop before technical breakdown.",
                  true,
                );
        } else {
          const reps = phase === "base" ? [6, 5, 4][wave - 1] : [3, 2, 1][wave - 1];
          main = prescription(
            phase === "base" ? 4 : [5, 3, 1][weekIndex],
            reps,
            weekIndex === 0 ? (phase === "base" ? [70, 75, 80] : [85, 88, 92])[wave - 1] : null,
            weekIndex === 0
              ? "Start the wave at this percentage; the final set is a plus set."
              : "Load depends on the previous completed plus set; it cannot be predicted from the calendar alone.",
            true,
          );
          variation = prescription(
            phase === "base" ? 3 + weekIndex : 4 - weekIndex,
            phase === "base" ? [12, 10, 8][wave - 1] : [6, 5, 4][wave - 1],
            (phase === "base" ? [60, 65, 70] : [75, 80, 85])[wave - 1],
            phase === "base"
              ? "Use this variation’s own estimated max. Keep its load steady within the wave while adding sets."
              : "Use this variation’s own estimated max; reduce sets across the wave.",
          );
        }
        weeks.push({
          number: weeks.length + 1,
          phase,
          phaseLabel: label,
          wave,
          waveWeek: weekIndex + 1,
          volume,
          main,
          variation,
        });
      }
    }
  }
  return weeks;
}

function movement(
  name: string,
  role: BaseStrengthMovement["role"],
  reference: BaseStrengthMovement["reference"],
  spec: PreviewPrescription,
): BaseStrengthMovement {
  return { name, role, reference, ...spec };
}
const freeAccessory = (name: string) =>
  movement(
    name,
    "accessory",
    null,
    prescription(
      null,
      null,
      null,
      "Choose your exercise, sets and reps during personal setup; the source does not prescribe them here.",
    ),
  );

export function baseStrengthSessions(
  programme: BaseStrengthProgrammeId,
  week: BaseStrengthWeek,
): BaseStrengthSession[] {
  if (programme === "volume_intensity") {
    if (!week.volume) throw new Error("A Volume/Intensity week needs its volume prescription.");
    const lift = (key: BaseStrengthLift, spec: PreviewPrescription) =>
      movement(BASE_STRENGTH_LIFTS[key], "main", key, spec);
    return [
      {
        name: "Monday · full body",
        movements: [lift("squat", week.volume), lift("bench", week.main), freeAccessory("Row")],
      },
      {
        name: "Wednesday · full body",
        movements: [
          lift("deadlift", week.main),
          lift("press", week.volume),
          freeAccessory("Chin-ups"),
        ],
      },
      {
        name: "Friday · full body",
        movements: [lift("squat", week.main), lift("bench", week.volume), freeAccessory("Row")],
      },
    ];
  }
  if (!week.variation) throw new Error("A Bullmastiff week needs its variation prescription.");
  const variations =
    week.phase === "base"
      ? ["Front squat", "Close-grip bench press", "Stiff-leg deadlift", "Behind-the-neck press"]
      : ["Pause squat", "Board press", "Low trap-bar deadlift", "Seated pin press"];
  const accessories = [
    ["Leg press", "Leg extension", "Cable row", "Pulldown"],
    ["Dumbbell press", "Dumbbell fly", "Hammer curl", "Barbell curl"],
    ["Back extension", "Hamstring curl", "Hammer row", "Dumbbell row"],
    ["Dumbbell shoulder press", "Lateral raise", "French press", "Rope pressdown"],
  ];
  return (["squat", "bench", "deadlift", "press"] as const).map((key, day) => ({
    name: `${["Monday", "Tuesday", "Thursday", "Friday"][day]} · ${BASE_STRENGTH_LIFTS[key]}`,
    movements: [
      movement(BASE_STRENGTH_LIFTS[key], "main", key, week.main),
      movement(variations[day], "variation", "variation", week.variation!),
      ...accessories[day].map((name, index) => {
        // The source accessory table only prints two waves. Do not invent a third.
        const specified = week.phase === "base" && week.wave <= 2;
        return movement(
          name,
          "accessory",
          null,
          prescription(
            specified ? week.waveWeek + 1 : null,
            specified ? (index % 2 === 0 ? [10, 8] : [15, 12])[week.wave - 1] : null,
            null,
            specified
              ? "Choose a suitable load; these are the source accessory targets. Exercise choices can be changed."
              : week.phase === "peak"
                ? "Review accessory targets and substitutions; the source permits a similar approach to the base phase."
                : "Review accessory targets: the source table shows two waves, so the third needs a personal choice.",
          ),
        );
      }),
    ],
  }));
}

export function roundedPreviewLoad(
  referenceMax: number | null,
  percent: number | null,
  increment: number,
): number | null {
  if (
    referenceMax == null ||
    percent == null ||
    !Number.isFinite(referenceMax) ||
    referenceMax <= 0 ||
    !Number.isFinite(percent) ||
    percent <= 0 ||
    !Number.isFinite(increment) ||
    increment <= 0
  )
    return null;
  const rounded = Math.round((referenceMax * percent) / 100 / increment) * increment;
  return rounded > 0 ? Number(rounded.toFixed(4)) : null;
}

export type BullmastiffDecision = {
  kind: "increase" | "hold" | "review" | "reset" | "finish";
  load: number | null;
  detail: string;
};
export function bullmastiffNextLoad(input: {
  week: BaseStrengthWeek;
  nextWeek: BaseStrengthWeek | null;
  referenceMax: number | null;
  nextPhaseMax: number | null;
  currentLoad: number | null;
  lastSetReps: number | null;
  allSetsCompleted: boolean;
  increment: number;
}): BullmastiffDecision {
  const review = (detail: string): BullmastiffDecision => ({ kind: "review", load: null, detail });
  if (!input.allSetsCompleted)
    return review(
      "Confirm all prescribed working sets were completed before using the plus-set rule.",
    );
  if (!Number.isFinite(input.increment) || input.increment <= 0)
    return review("Choose a positive load increment.");
  if (
    input.lastSetReps != null &&
    (!Number.isInteger(input.lastSetReps) || input.lastSetReps < 0 || input.lastSetReps > 1000)
  )
    return review("Enter valid whole-number final-set reps.");
  if (
    input.lastSetReps != null &&
    input.week.main.reps != null &&
    input.lastSetReps < input.week.main.reps
  )
    return review(
      "The final set missed the prescribed target. Review the load and recovery rather than applying an automatic increase.",
    );
  if (!input.nextWeek)
    return {
      kind: "finish",
      load: null,
      detail: "This is the final week. Review the completed run before starting another cycle.",
    };
  if (input.week.waveWeek === 3) {
    const changedPhase = input.nextWeek.phase !== input.week.phase;
    const load = roundedPreviewLoad(
      changedPhase ? input.nextPhaseMax : input.referenceMax,
      input.nextWeek.main.percent,
      input.increment,
    );
    if (load == null)
      return review(
        changedPhase
          ? "Reassess and enter a peak-phase estimated max before choosing the new starting load."
          : "Enter the estimated max to calculate the next wave’s starting load.",
      );
    return {
      kind: "reset",
      load,
      detail: `Reset at ${input.nextWeek.main.percent}% for ${input.nextWeek.phaseLabel.toLowerCase()} wave ${input.nextWeek.wave}. Plus-set increases do not carry across this reset.`,
    };
  }
  if (
    input.referenceMax == null ||
    !Number.isFinite(input.referenceMax) ||
    input.referenceMax <= 0 ||
    input.currentLoad == null ||
    !Number.isFinite(input.currentLoad) ||
    input.currentLoad <= 0 ||
    input.lastSetReps == null ||
    !Number.isInteger(input.lastSetReps) ||
    input.lastSetReps < 0 ||
    input.lastSetReps > 1000 ||
    input.week.main.reps == null
  )
    return review("Enter an estimated max, the actual working load and valid final-set reps.");
  if (input.lastSetReps < input.week.main.reps)
    return review(
      "The final set missed the prescribed target. Review the load and recovery rather than applying an automatic increase.",
    );
  const extra = input.lastSetReps - input.week.main.reps;
  if (extra === 0)
    return {
      kind: "hold",
      load: input.currentLoad,
      detail: "No reps above the target: repeat the working load within this wave.",
    };
  // Increases are a percentage of reference 1RM, not a percentage of working load.
  const unrounded = input.currentLoad + (extra * input.referenceMax) / 100;
  const load = Math.max(
    input.currentLoad,
    Number((Math.round(unrounded / input.increment) * input.increment).toFixed(4)),
  );
  if (load <= 0)
    return review("The load is below the chosen increment; choose a suitable increment.");
  return {
    kind: load > input.currentLoad ? "increase" : "hold",
    load,
    detail: extra
      ? `${extra} extra ${extra === 1 ? "rep" : "reps"} × 1% of ${input.referenceMax} kg = ${Number(((extra * input.referenceMax) / 100).toFixed(4))} kg added before rounding. The next week keeps this wave’s rep target.`
      : "No reps above the target: repeat the working load within this wave.",
  };
}
