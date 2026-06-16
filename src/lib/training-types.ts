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
  metric: string;
  target: string;
  period: string;
  notes: string;
  checkins: GoalCheckin[];
};

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
  kind: "workout" | "climb";
  exercise: string;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  minutes: number | null;
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
  date: string;
  sessions: number;
  totalReps: number;
  totalVolume: number;
  maxWeight: number | null;
  totalDuration: number;
  est1RM: number | null;
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
