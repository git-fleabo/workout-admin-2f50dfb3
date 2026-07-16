export type LibraryRow = {
  row: number;
  workoutType: string;
  focusArea: string;
  name: string;
  equipment: string;
  metric: string;
  suggestedSets: string;
  suggestedReps: string;
  notes: string;
};

export type GoalRow = {
  id: string;
  row: number;
  goal: string;
  goalType: GoalType;
  status: GoalStatus;
  exerciseId: string;
  trackingMode: string;
  goalMetric: GoalMetric | "";
  targetValue: number | null;
  targetUnit: string;
  startingValue: number | null;
  deadline: string;
  metric: string;
  target: string;
  period: string;
  notes: string;
  checkins: GoalCheckin[];
};

export type GoalType = "legacy" | "consistency" | "performance" | "duration" | "milestone";

export type GoalStatus = "active" | "paused" | "complete" | "archived";

export type GoalMetric =
  | "sessions"
  | "active_days"
  | "minutes"
  | "checkins"
  | "max_weight"
  | "estimated_1rm"
  | "reps"
  | "hold_seconds"
  | "duration_minutes"
  | "distance_km"
  | "distance_m"
  | "rounds"
  | "height_cm"
  | "problems"
  | "completed";

export type GoalCheckin = {
  id: string;
  date: string;
  note: string;
  createdAt: string;
};

export type WeekStat = {
  weekStart: string;
  label: string;
  workouts: number;
  minutes: number;
};

export type MonthStat = {
  monthStart: string;
  label: string;
  hours: number;
};

export type BodyweightPoint = {
  date: string;
  bodyweight: number;
};

export type PRItem = {
  kind: "1rm" | "skill";
  title: string;
  value: string;
  detail: string;
  date: string;
};

export type WeekDayEntry = {
  exercise: string;
  activityLabel: string;
  details: Array<{ label: string; value: string }>;
  completed: boolean;
  counts: boolean;
  notes: string;
};

export type WeekDay = {
  date: string;
  label: string;
  workouts: number;
  minutes: number;
  exercises: string[];
  entries: WeekDayEntry[];
  isToday: boolean;
};

export type MonthRow = {
  monthStart: string;
  label: string;
  workouts: number;
  minutes: number;
  climbSessions: number;
  climbHours: number;
};

export type ExerciseSessionPoint = {
  sessionId: string;
  date: string;
  locationName: string | null;
  locationKind: "home" | "gym" | "other" | null;
  methods: ExerciseMethodUse[];
  sessions: number;
  totalReps: number;
  totalVolume: number;
  maxWeight: number | null;
  totalDuration: number;
  activityDurationMinutes: number;
  totalDistanceKm: number;
  distanceUnit: string | null;
  rounds: number;
  feel: number | null;
  heightCm: number | null;
  problems: number;
  grade: string | null;
  gradient: string | null;
  averageRpe: number | null;
  est1RM: number | null;
  sets: ExerciseSetPoint[];
};

export type ExerciseMethodUse = {
  key: string;
  trainingMethodId: string;
  name: string;
  family: "exercise_group" | "set_method" | "timed_density";
};

export type ExerciseSetPoint = {
  setNumber: number | null;
  reps: number | null;
  weight: number | null;
  durationSeconds: number | null;
  distance: number | null;
  distanceUnit: string | null;
  assistanceType: string | null;
  assistanceDetail: string | null;
  quality: string | null;
  rpe: number | null;
  completed: boolean;
  aggregateSets: number | null;
};

export type ExerciseHistory = {
  name: string;
  totalSessions: number;
  totalRows: number;
  points: ExerciseSessionPoint[];
  available: {
    weight: boolean;
    reps: boolean;
    duration: boolean;
    est1RM: boolean;
    volume: boolean;
  };
  stats: {
    latest1RM: number | null;
    best1RM: number | null;
    maxWeight: number | null;
    fourWeekChange: number | null;
  };
};
