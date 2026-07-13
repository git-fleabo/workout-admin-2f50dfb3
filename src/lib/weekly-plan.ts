import {
  buildWorkoutSuggestion,
  type PlannerLocation,
  type RecentWorkoutLog,
  type WorkoutPlanSuggestion,
} from "./workout-plan";

export type WeeklyPlanConfidence = "none" | "low" | "medium" | "high";

export type WeeklyPlanLocation = {
  location: PlannerLocation;
  frequency: number;
  confidence: WeeklyPlanConfidence;
  sourceDays: number;
  expectedDates: string[];
  suggestion: WorkoutPlanSuggestion | null;
  progressionExercises: string[];
  fatigueExercises: string[];
};

export type WeeklyPlanDay = {
  date: string;
  expected: PlannerLocation[];
  completed: PlannerLocation[];
};

export type WeeklyPlan = {
  startDate: string;
  endDate: string;
  days: WeeklyPlanDay[];
  locations: Record<PlannerLocation, WeeklyPlanLocation>;
};

type WeeklyLogs = Record<PlannerLocation, RecentWorkoutLog[]>;

const DAY_MS = 86_400_000;

function parseISO(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function toISO(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, count: number) {
  const date = parseISO(value);
  if (!date) return value;
  date.setUTCDate(date.getUTCDate() + count);
  return toISO(date);
}

function uniqueExactDays(logs: RecentWorkoutLog[], location: PlannerLocation, today: string) {
  const start = addDays(today, -55);
  return Array.from(
    new Set(
      logs
        .filter(
          (log) =>
            log.completed &&
            log.date >= start &&
            log.date <= today &&
            log.trainingLocation?.kind === location,
        )
        .map((log) => log.date),
    ),
  ).sort();
}

function expectedPattern(days: string[], today: string) {
  if (days.length === 0) return { frequency: 0, weekdays: [] as number[] };
  const oldest = parseISO(days[0]);
  const current = parseISO(today);
  const span =
    oldest && current ? Math.floor((current.getTime() - oldest.getTime()) / DAY_MS) + 1 : 14;
  const observedWeeks = Math.max(2, Math.min(8, Math.ceil(span / 7)));
  const frequency = Math.max(1, Math.min(4, Math.round(days.length / observedWeeks)));
  const counts = new Map<number, number>();
  for (const value of days) {
    const weekday = parseISO(value)?.getUTCDay();
    if (weekday == null) continue;
    counts.set(weekday, (counts.get(weekday) ?? 0) + 1);
  }
  const weekdays = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, frequency)
    .map(([weekday]) => weekday);
  return { frequency, weekdays };
}

function confidenceFor(sourceDays: number): WeeklyPlanConfidence {
  if (sourceDays >= 6) return "high";
  if (sourceDays >= 3) return "medium";
  if (sourceDays > 0) return "low";
  return "none";
}

function maxRpe(log: RecentWorkoutLog) {
  const values = [log.rpe, ...log.setRows.map((set) => set.rpe)]
    .map(Number)
    .filter(Number.isFinite);
  return values.length ? Math.max(...values) : null;
}

function fatigueExercises(logs: RecentWorkoutLog[], location: PlannerLocation) {
  const exact = logs.filter((log) => log.trainingLocation?.kind === location);
  const relevant = exact.length > 0 ? exact : logs.filter((log) => !log.trainingLocation?.kind);
  const byExercise = new Map<string, RecentWorkoutLog[]>();
  for (const log of relevant.filter((item) => item.completed)) {
    const key = log.exercise.trim().toLowerCase();
    const current = byExercise.get(key) ?? [];
    current.push(log);
    byExercise.set(key, current);
  }
  return Array.from(byExercise.values())
    .filter((items) => {
      const recent = [...items].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
      return recent.filter((item) => (maxRpe(item) ?? 0) >= 9).length >= 2;
    })
    .map((items) => items[0]?.exercise)
    .filter((value): value is string => Boolean(value))
    .sort();
}

function buildLocationPlan(
  logs: RecentWorkoutLog[],
  location: PlannerLocation,
  today: string,
): WeeklyPlanLocation {
  const sourceDates = uniqueExactDays(logs, location, today);
  const pattern = expectedPattern(sourceDates, today);
  const expectedDates = Array.from({ length: 7 }, (_, index) => addDays(today, index)).filter(
    (date) => {
      const weekday = parseISO(date)?.getUTCDay();
      return weekday != null && pattern.weekdays.includes(weekday);
    },
  );
  const suggestion = buildWorkoutSuggestion(logs, location, "normal");
  return {
    location,
    frequency: pattern.frequency,
    confidence: confidenceFor(sourceDates.length),
    sourceDays: sourceDates.length,
    expectedDates,
    suggestion,
    progressionExercises:
      suggestion?.movements
        .filter((movement) => movement.reason.includes("load moves up 2.5 kg"))
        .map((movement) => movement.exercise) ?? [],
    fatigueExercises: fatigueExercises(logs, location),
  };
}

export function buildWeeklyPlan(logs: WeeklyLogs, today: string): WeeklyPlan {
  const locations = {
    home: buildLocationPlan(logs.home, "home", today),
    gym: buildLocationPlan(logs.gym, "gym", today),
  };
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index);
    const expected = (["home", "gym"] as const).filter((location) =>
      locations[location].expectedDates.includes(date),
    );
    const completed = (["home", "gym"] as const).filter((location) =>
      logs[location].some(
        (log) => log.completed && log.date === date && log.trainingLocation?.kind === location,
      ),
    );
    return { date, expected, completed };
  });
  return {
    startDate: today,
    endDate: addDays(today, 6),
    days,
    locations,
  };
}
