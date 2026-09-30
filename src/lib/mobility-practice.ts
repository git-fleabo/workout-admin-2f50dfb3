import { getTrackingModeValue } from "./movement-metrics.ts";
import type { WorkoutPlanDraft, WorkoutPlanMovement } from "./workout-plan.ts";

export const MOBILITY_SKILL_ORDER = [
  "pike",
  "pancake",
  "side_split",
  "front_split",
  "shoulder",
  "bridge",
] as const;
export type MobilitySkill = (typeof MOBILITY_SKILL_ORDER)[number];
export type MobilityRunStatus = "active" | "paused" | "archived";
export type BridgeReadiness = "unchecked" | "ready" | "shoulders_first";
export type MobilityPhase = "setup" | "phase_1" | "phase_2" | "phase_3";

export type MobilityRun = {
  id: string;
  personId: string;
  skill: MobilitySkill;
  status: MobilityRunStatus;
  phase: MobilityPhase;
  startedOn: string;
  endedOn: string | null;
  reviewOn: string | null;
  readiness: BridgeReadiness;
  readinessCheckedOn: string | null;
  readinessLeftDeg: number | null;
  readinessRightDeg: number | null;
  planReceived: boolean;
  notes: string;
};

export type MobilityAssessment = {
  id: string;
  runId: string;
  testKey: string;
  side: "none" | "left" | "right";
  measuredOn: string;
  valueNumeric: number | null;
  valueText: string;
  unit: "deg" | "cm" | "text";
  setupNote: string;
};

export type MobilityDrill = {
  id: string;
  runId: string;
  exerciseId: string | null;
  name: string;
  lessonUrl: string;
  sortOrder: number;
  targetSets: number | null;
  targetReps: string;
  targetWeightKg: number | null;
  targetHoldSeconds: number | null;
  targetDetail: string;
  isActive: boolean;
};

export type MobilitySession = {
  id: string;
  runId: string;
  date: string;
  title: string;
};

export const MOBILITY_SKILLS: Record<
  MobilitySkill,
  {
    label: string;
    readinessUrl?: string;
    assessmentUrl: string;
    builderUrl: string;
    warmupUrl?: string;
    cooldownUrl?: string;
    extraLinks?: ReadonlyArray<{ label: string; url: string }>;
    tests: ReadonlyArray<{ key: string; label: string }>;
  }
> = {
  pike: {
    label: "Pike & Head to Toe",
    assessmentUrl:
      "https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/2156535269/posts/2182813313",
    builderUrl:
      "https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/2156535269/posts/2182876546",
    tests: [
      { key: "standing_forward_fold", label: "Standing forward fold" },
      { key: "elbow_head_to_toe", label: "Elbow / head to toe" },
      { key: "standing_leg_lift", label: "Standing leg lift" },
      { key: "sciatic_nerve_level", label: "Sciatic nerve level" },
      { key: "hip_internal_rotation", label: "Hip internal rotation length" },
    ],
  },
  pancake: {
    label: "Pancake",
    assessmentUrl:
      "https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/4549065/posts/9913299",
    builderUrl:
      "https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/4549065/posts/11388901",
    extraLinks: [
      {
        label: "Measure angles",
        url: "https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/4549065/posts/11388900",
      },
      {
        label: "Phase 2 and beyond",
        url: "https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/3410577/posts/14349528",
      },
    ],
    tests: [{ key: "pancake_assessment", label: "Pancake assessment" }],
  },
  side_split: {
    label: "Side Split",
    assessmentUrl:
      "https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/4533243/posts/7877757",
    builderUrl:
      "https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/4533243/posts/10516144",
    extraLinks: [
      {
        label: "Measure angles",
        url: "https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/4533243/posts/10581039",
      },
      {
        label: "Phase 2 and beyond",
        url: "https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/2974982/posts/13851237",
      },
    ],
    tests: [{ key: "side_split_assessment", label: "Side Split assessment" }],
  },
  front_split: {
    label: "Front Split",
    assessmentUrl:
      "https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/2152220817/posts/2165122257",
    builderUrl:
      "https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/2152220817/posts/2178443824",
    tests: [
      { key: "passive_front_split", label: "Passive front split" },
      { key: "isometric_front_split", label: "Isometric front split" },
      { key: "couch_stretch_low", label: "Couch stretch, hips low" },
      { key: "kneeling_lunge", label: "Kneeling lunge" },
      { key: "prone_active_hip_extension", label: "Prone active hip extension" },
      { key: "single_leg_pike", label: "Single leg pike" },
      { key: "single_leg_lift", label: "Single leg lift" },
    ],
  },
  shoulder: {
    label: "Shoulder Mobility & Flexibility",
    assessmentUrl:
      "https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/3706080/posts/9913536",
    builderUrl:
      "https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/4549077/posts/2162187379",
    extraLinks: [
      {
        label: "Measure angles",
        url: "https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/4549077/posts/11389088",
      },
    ],
    tests: [
      { key: "leahy", label: "Leahy test" },
      { key: "active_passive_flexion", label: "Active vs passive shoulder flexion" },
      { key: "lat_length", label: "Lat length" },
      { key: "pec_major_length", label: "Pec major length" },
      { key: "external_rotation_length", label: "External rotation length" },
      { key: "pec_minor_length", label: "Pec minor length" },
      { key: "internal_rotation_length", label: "Internal rotation length" },
    ],
  },
  bridge: {
    label: "Bridge",
    readinessUrl:
      "https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/2154754548/posts/2185116156",
    assessmentUrl:
      "https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/2157012532/posts/2185295227",
    builderUrl:
      "https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/2157012532/posts/2184901013",
    warmupUrl:
      "https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/2159951865/posts/2184253564",
    cooldownUrl:
      "https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/2159951865/posts/2184909418",
    tests: [
      { key: "shoulder_external_rotation", label: "Shoulder external rotation length" },
      { key: "pec_major_length", label: "Pec major length" },
      { key: "couch_stretch_low", label: "Couch stretch, hips low" },
      { key: "kneeling_lunge", label: "Kneeling lunge" },
      { key: "bridge_test", label: "Bridge test" },
    ],
  },
};

export function currentMobilityRun(runs: MobilityRun[], skill: MobilitySkill) {
  return runs.find((run) => run.skill === skill && run.status !== "archived") ?? null;
}

export function mobilityNextAction({
  run,
  activeDrillCount,
  mappedDrillCount,
}: {
  run: MobilityRun | null;
  activeDrillCount: number;
  mappedDrillCount?: number;
}) {
  if (!run) return { label: "Start practice", kind: "start" as const };
  if (run.status === "paused") return { label: "Resume practice", kind: "resume" as const };
  if (activeDrillCount === 0) return { label: "Add your drills", kind: "drills" as const };
  if (mappedDrillCount != null && mappedDrillCount < activeDrillCount)
    return { label: "Match drills to library exercises", kind: "drills" as const };
  return { label: "Log practice", kind: "log" as const };
}

export function isToolkitLessonUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "www.matthewismith.com" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.search &&
      !url.hash &&
      url.pathname.startsWith("/products/mobility-flexibility-toolkit/")
    );
  } catch {
    return false;
  }
}

export function buildMobilityWorkoutDraft({
  run,
  drills,
  library,
  locationKind,
  trainingLocationId,
}: {
  run: MobilityRun;
  drills: MobilityDrill[];
  library: ReadonlyArray<{
    id: string;
    name: string;
    workoutType: string;
    metric: string;
    toolkitSections: ReadonlyArray<MobilitySkill>;
  }>;
  locationKind: "home" | "gym";
  trainingLocationId?: string;
}): WorkoutPlanDraft {
  const exerciseById = new Map(
    library
      .filter((exercise) => exercise.toolkitSections.includes(run.skill))
      .map((exercise) => [exercise.id, exercise]),
  );
  const active = drills.filter((drill) => drill.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  if (!active.length) throw new Error("Add at least one active drill from your plan.");
  const movements: WorkoutPlanMovement[] = active.map((drill) => {
    const exercise = drill.exerciseId ? exerciseById.get(drill.exerciseId) : null;
    if (!exercise)
      throw new Error(`${drill.name} needs a ${run.skill} toolkit exercise in your library.`);
    const sets = Math.max(1, drill.targetSets ?? 1);
    const reps = /^\d+(?:\.\d+)?$/.test(drill.targetReps.trim()) ? drill.targetReps.trim() : "";
    return {
      exercise: exercise.name,
      workoutType: exercise.workoutType,
      trackingMode: getTrackingModeValue({
        workoutType: exercise.workoutType,
        movement: exercise.name,
        defaultMetric: exercise.metric,
      }),
      targets: {
        durationMinutes: "",
        distance: "",
        distanceUnit: "cm",
        rounds: "",
        height: "",
        detail: [drill.targetReps && !reps ? `${drill.targetReps} reps` : "", drill.targetDetail]
          .filter(Boolean)
          .join(" · "),
      },
      sourceDate: "",
      reason: "Your saved mobility plan",
      setRows: Array.from({ length: sets }, () => ({
        reps,
        weight: drill.targetWeightKg == null ? "" : String(drill.targetWeightKg),
        durationSeconds: drill.targetHoldSeconds == null ? "" : String(drill.targetHoldSeconds),
        rpe: "",
        completed: true,
      })),
    };
  });
  return {
    version: 1,
    mobilityRunId: run.id,
    title: `${MOBILITY_SKILLS[run.skill].label} practice`,
    locationKind,
    trainingLocationId,
    basis: "Your saved mobility practice",
    movements,
  };
}
