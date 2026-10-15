import type { ExerciseHistory, ExerciseSessionPoint, GoalRow } from "../../src/lib/training-types";

export function reviewGoal(overrides: Partial<GoalRow> = {}): GoalRow {
  return {
    id: "goal-strength",
    row: 1,
    goal: "Bench press 100 kg",
    status: "active",
    goalType: "performance",
    exerciseId: "bench",
    trackingMode: "weighted",
    goalMetric: "max_weight",
    targetValue: 100,
    targetUnit: "kg",
    startingValue: 60,
    deadline: "",
    metric: "",
    target: "",
    period: "static",
    notes: "",
    checkins: [],
    ...overrides,
  };
}

export function reviewPoint(
  date: string,
  value: number | null,
  overrides: Partial<ExerciseSessionPoint> = {},
): ExerciseSessionPoint {
  return {
    sessionId: `session-${date}`,
    date,
    locationName: "Gym",
    locationKind: "gym",
    methods: [],
    sessions: 1,
    totalReps: 0,
    totalVolume: 0,
    maxWeight: value,
    totalDuration: 0,
    activityDurationMinutes: 0,
    totalDistanceKm: 0,
    distanceUnit: null,
    rounds: 0,
    feel: null,
    heightCm: null,
    positionMeasurementCm: null,
    positionMeasurementSetup: null,
    problems: 0,
    grade: null,
    gradient: null,
    averageRpe: null,
    est1RM: null,
    sets: [],
    ...overrides,
  };
}

export function reviewHistory(points: ExerciseSessionPoint[]): ExerciseHistory {
  return {
    name: "Bench press",
    totalSessions: points.length,
    totalRows: points.length,
    points,
    available: { weight: true, reps: false, duration: false, est1RM: false, volume: false },
    stats: { latest1RM: null, best1RM: null, maxWeight: null, fourWeekChange: null },
  };
}
