import type { PersonalProgrammePlan } from "../../src/lib/personal-programme.ts";
import type {
  ProgrammeAssignment,
  ProgrammeTemplate,
} from "../../src/lib/supabase-programmes.browser.ts";
import type { WeeklyRecoveryRecommendation } from "../../src/lib/weekly-recovery.ts";
export const personalStrengthId = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const personalStrengthPlan: PersonalProgrammePlan = {
  version: 1,
  locationKind: "gym",
  movements: [
    {
      exerciseId: personalStrengthId(10),
      programmeKey: "press:0",
      exercise: "Custom dumbbell press",
      workoutType: "Strength",
      trackingMode: "weight_reps",
      sourceDate: "",
      reason: "My prescription",
      restTime: "3 min",
      targets: {
        durationMinutes: "",
        distance: "",
        distanceUnit: "",
        rounds: "",
        height: "",
        detail: "",
      },
      progression: { type: "double", minReps: 8, maxReps: 12, incrementKg: 0.5, maxRpe: 8 },
      setRows: [8, 9, 10].map((reps) => ({
        reps: String(reps),
        weight: "20.6",
        durationSeconds: "",
        rpe: "",
        completed: true,
      })),
    },
    {
      exerciseId: personalStrengthId(11),
      programmeKey: "grip:0",
      exercise: "Custom grip hold",
      workoutType: "Strength",
      trackingMode: "grip_hold",
      sourceDate: "",
      reason: "My grip work",
      restTime: "90 sec",
      targets: {
        durationMinutes: "",
        distance: "",
        distanceUnit: "",
        rounds: "",
        height: "",
        detail: "",
      },
      progression: { type: "fixed", minReps: 1, maxReps: 1, incrementKg: 1, maxRpe: 8 },
      setRows: [10, 12].map((seconds) => ({
        reps: "",
        weight: "0",
        durationSeconds: String(seconds),
        rpe: "",
        completed: true,
      })),
    },
  ],
};
export const personalStrengthTemplate: ProgrammeTemplate = {
  id: personalStrengthId(13),
  name: "Source model",
  description: null,
  methodType: "jacked_dumbbell",
  durationWeeks: 2,
  sessionsPerWeek: 3,
  defaultSetChoice: null,
  percentBase: null,
  roundingIncrement: null,
  workouts: [0, 1, 2, 3, 4, 5].map((i) => ({
    id: personalStrengthId(20 + i),
    name: `Source ${i}`,
    sequenceIndex: i,
    weekNumber: i < 3 ? 1 : 2,
    dayNumber: (i % 3) * 2 + 1,
    sessionNumber: (i % 3) + 1,
    description: null,
    entries: [],
  })),
};
export const personalStrengthAssignment: ProgrammeAssignment = {
  id: personalStrengthId(14),
  programId: personalStrengthTemplate.id,
  personId: personalStrengthId(1),
  status: "active",
  currentWorkoutIndex: 0,
  startedOn: "2026-10-12",
  completedOn: null,
  notes: null,
  createdAt: "2026-10-10",
  cycleNumber: 1,
  previousAssignmentId: null,
  exercises: [],
  pools: [],
  personalProgramme: {
    name: "My customised block",
    sessions: personalStrengthTemplate.workouts.map((workout, i) => ({
      workoutId: workout.id,
      revision: 1,
      name: `Custom ${i + 1}`,
      scheduledDate: `2026-10-${12 + i * 2}`,
      plan:
        i < 3
          ? structuredClone(personalStrengthPlan)
          : {
              ...structuredClone(personalStrengthPlan),
              movements: personalStrengthPlan.movements.map((movement) => ({
                ...structuredClone(movement),
                setRows: movement.setRows.map((row) => ({
                  ...row,
                  weight: Number(row.weight) > 0 ? "25.25" : row.weight,
                })),
              })),
            },
    })),
  },
};
export const personalStrengthRecovery: WeeklyRecoveryRecommendation = {
  level: "deload",
  title: "Reduce",
  detail: "Test evidence",
  evidence: ["Recent effort was high"],
  hardDays: 3,
  decliningExercises: [],
  recentLoad: 8,
  priorLoad: 4,
  plannedLoad: 3,
  plannedDays: 3,
  effortCoverage: 100,
};
