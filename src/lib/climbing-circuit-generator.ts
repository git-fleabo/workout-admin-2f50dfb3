import type { SessionDifficulty, WorkoutPlanMovement } from "./workout-plan.ts";

export const CLIMBING_GOAL_OPTIONS = [
  {
    value: "aerobic_endurance",
    label: "Aerobic endurance",
    detail: "Sustained easy climbing with short recoveries",
  },
  {
    value: "repeated_effort",
    label: "Repeated-effort capacity",
    detail: "Regular starts with incomplete recovery",
  },
  {
    value: "power_endurance",
    label: "Power endurance",
    detail: "Link demanding problems while managing a pump",
  },
] as const;

export type ClimbingGoal = (typeof CLIMBING_GOAL_OPTIONS)[number]["value"];

export const CLIMBING_WALL_OPTIONS = [
  { value: "commercial", label: "Commercial wall", detail: "Use set boulder problems" },
  { value: "spray", label: "Spray wall", detail: "Build repeatable linked sequences" },
  { value: "training_board", label: "Training board", detail: "Rotate board problems" },
] as const;

export type ClimbingWallType = (typeof CLIMBING_WALL_OPTIONS)[number]["value"];

export type ClimbingCircuitConfig = {
  durationMinutes: number;
  goal: ClimbingGoal;
  wallType: ClimbingWallType;
  difficulty: SessionDifficulty;
};

export type ClimbingCircuitPhase = {
  label: string;
  durationMinutes: number;
  instruction: string;
};

export type ClimbingCircuitBuild = {
  title: string;
  basis: string;
  format: "continuous" | "emom" | "four_by_four" | "linked_intervals";
  formatLabel: string;
  durationMinutes: number;
  warmupMinutes: number;
  plannedProblems: number | null;
  phases: ClimbingCircuitPhase[];
  instructions: string[];
  movement: WorkoutPlanMovement;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function durationSplit(totalMinutes: number) {
  const warmupMinutes = totalMinutes <= 25 ? 5 : totalMinutes <= 45 ? 10 : 15;
  return { warmupMinutes, workBudgetMinutes: totalMinutes - warmupMinutes };
}

function distributedBlocks(totalMinutes: number, blocks: number) {
  const base = Math.floor(totalMinutes / blocks);
  const remainder = totalMinutes % blocks;
  return Array.from({ length: blocks }, (_, index) => base + (index < remainder ? 1 : 0));
}

function wallInstruction(wallType: ClimbingWallType) {
  if (wallType === "spray")
    return "Create the sequence on the spray wall before starting the timer.";
  if (wallType === "training_board") {
    return "Queue the board problems before starting so transitions stay short.";
  }
  return "Choose the problems before starting and keep transitions practical for the space.";
}

function detailText(formatLabel: string, phases: ClimbingCircuitPhase[], instructions: string[]) {
  return [
    `${formatLabel}.`,
    ...phases.map((phase) => `${phase.label} (${phase.durationMinutes} min): ${phase.instruction}`),
    ...instructions,
  ].join("\n");
}

function climbingMovement(
  durationMinutes: number,
  formatLabel: string,
  phases: ClimbingCircuitPhase[],
  instructions: string[],
): WorkoutPlanMovement {
  return {
    exercise: "Bouldering Session",
    workoutType: "Climbing",
    trackingMode: "climbing",
    targets: {
      durationMinutes: String(durationMinutes),
      distance: "",
      distanceUnit: "",
      rounds: "",
      height: "",
      detail: detailText(formatLabel, phases, instructions),
    },
    sourceDate: "",
    reason: `Automatic ${formatLabel.toLowerCase()} selected from the requested climbing goal, duration, wall and difficulty.`,
    setRows: [],
  };
}

export function buildClimbingCircuit(config: ClimbingCircuitConfig): ClimbingCircuitBuild {
  const durationMinutes = clamp(Math.round(config.durationMinutes), 20, 60);
  const { warmupMinutes, workBudgetMinutes } = durationSplit(durationMinutes);
  const phases: ClimbingCircuitPhase[] = [
    {
      label: "Warm-up",
      durationMinutes: warmupMinutes,
      instruction: "Climb progressively until you are ready to begin the structured work.",
    },
  ];
  const instructions = [
    wallInstruction(config.wallType),
    "Choose the actual problems yourself and use safe, brief transitions.",
    "After a fall, move on when restarting would disrupt the interval; record completed problems afterwards.",
  ];

  let format: ClimbingCircuitBuild["format"];
  let formatLabel: string;
  let plannedProblems: number | null = null;

  if (config.goal === "aerobic_endurance") {
    format = "continuous";
    formatLabel = "Continuous circuit";
    const blocks = config.difficulty === "very_hard" ? 3 : 2;
    const recoveryMinutes =
      config.difficulty === "standard" ? 4 : config.difficulty === "hard" ? 3 : 2;
    const workMinutes = workBudgetMinutes - recoveryMinutes * (blocks - 1);
    const blockMinutes = distributedBlocks(workMinutes, blocks);
    blockMinutes.forEach((minutes, index) => {
      phases.push({
        label: `Continuous block ${index + 1}`,
        durationMinutes: minutes,
        instruction: "Keep climbing continuously or link problems with only short transitions.",
      });
      if (index < blocks - 1) {
        phases.push({
          label: `Recovery ${index + 1}`,
          durationMinutes: recoveryMinutes,
          instruction: "Rest before beginning the next continuous block.",
        });
      }
    });
  } else if (config.goal === "repeated_effort") {
    format = "emom";
    formatLabel = "Every minute on the minute (EMOM)";
    const maximumBlockMinutes =
      config.difficulty === "standard" ? 12 : config.difficulty === "hard" ? 15 : 18;
    const targetWorkFraction =
      config.difficulty === "standard" ? 0.75 : config.difficulty === "hard" ? 0.9 : 1;
    const targetEmomMinutes = Math.max(10, Math.round(workBudgetMinutes * targetWorkFraction));
    const recoveryMinutes =
      config.difficulty === "standard" ? 5 : config.difficulty === "hard" ? 4 : 3;
    const blocks = targetEmomMinutes > maximumBlockMinutes + recoveryMinutes ? 2 : 1;
    const emomMinutes = Math.min(
      targetEmomMinutes,
      workBudgetMinutes - recoveryMinutes * (blocks - 1),
    );
    const blockMinutes = distributedBlocks(emomMinutes, blocks);
    const easyFinishMinutes = workBudgetMinutes - emomMinutes - recoveryMinutes * (blocks - 1);
    plannedProblems = emomMinutes;
    blockMinutes.forEach((minutes, index) => {
      phases.push({
        label: blocks === 1 ? "EMOM" : `EMOM block ${index + 1}`,
        durationMinutes: minutes,
        instruction:
          "Start one boulder at the beginning of every minute and rest for the remainder.",
      });
      if (index < blocks - 1) {
        phases.push({
          label: "Block recovery",
          durationMinutes: recoveryMinutes,
          instruction: "Rest fully before restarting the minute clock.",
        });
      }
    });
    if (easyFinishMinutes > 0) {
      phases.push({
        label: "Easy finish",
        durationMinutes: easyFinishMinutes,
        instruction: "Use the remaining time for easy climbing or recovery.",
      });
    }
  } else {
    const roundRecoveryMinutes =
      config.difficulty === "standard" ? 5 : config.difficulty === "hard" ? 4 : 3;
    const canFitFourByFour = workBudgetMinutes >= 4 * 3 + roundRecoveryMinutes * 3;
    if (config.wallType !== "spray" && canFitFourByFour) {
      format = "four_by_four";
      formatLabel = "Four-problem circuit × four rounds";
      const totalRecovery = roundRecoveryMinutes * 3;
      const roundMinutes = distributedBlocks(workBudgetMinutes - totalRecovery, 4);
      plannedProblems = 16;
      roundMinutes.forEach((minutes, index) => {
        phases.push({
          label: `Circuit round ${index + 1}`,
          durationMinutes: minutes,
          instruction: "Climb four chosen problems consecutively with only brief transitions.",
        });
        if (index < 3) {
          phases.push({
            label: `Round recovery ${index + 1}`,
            durationMinutes: roundRecoveryMinutes,
            instruction: "Rest before repeating the four-problem circuit.",
          });
        }
      });
    } else {
      format = "linked_intervals";
      formatLabel = "Linked work/rest circuit";
      const rounds = config.difficulty === "standard" ? 3 : config.difficulty === "hard" ? 4 : 5;
      const intervalMinutes = Math.max(1, Math.floor(workBudgetMinutes / (rounds * 2 - 1)));
      const usedMinutes = intervalMinutes * (rounds * 2 - 1);
      const finalEasyMinutes = workBudgetMinutes - usedMinutes;
      for (let index = 0; index < rounds; index += 1) {
        phases.push({
          label: `Linked circuit ${index + 1}`,
          durationMinutes: intervalMinutes,
          instruction:
            "Climb a continuous sequence or link several problems without a full recovery.",
        });
        if (index < rounds - 1) {
          phases.push({
            label: `Circuit recovery ${index + 1}`,
            durationMinutes: intervalMinutes,
            instruction: "Rest for the same duration as the work interval.",
          });
        }
      }
      if (finalEasyMinutes > 0) {
        phases.push({
          label: "Easy finish",
          durationMinutes: finalEasyMinutes,
          instruction: "Use the remaining time for easy climbing or recovery.",
        });
      }
    }
  }

  const goalLabel =
    CLIMBING_GOAL_OPTIONS.find((option) => option.value === config.goal)?.label ?? config.goal;
  const difficultyLabel = config.difficulty.replace("_", " ");
  const basis = `${formatLabel} selected automatically for ${goalLabel.toLowerCase()} on a ${CLIMBING_WALL_OPTIONS.find((option) => option.value === config.wallType)?.label.toLowerCase() ?? "climbing wall"}. The ${difficultyLabel} setting controls work density and recovery; you choose the problems.`;
  const movement = climbingMovement(durationMinutes, formatLabel, phases, instructions);

  return {
    title: `${durationMinutes}-minute ${goalLabel.toLowerCase()} climb`,
    basis,
    format,
    formatLabel,
    durationMinutes,
    warmupMinutes,
    plannedProblems,
    phases,
    instructions,
    movement,
  };
}
