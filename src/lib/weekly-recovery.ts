import type { WeeklyLoadHistoryItem, WeeklyLoadKind } from "./supabase-weekly-load.browser";
import type { WeeklyPlan, WeeklyPlanAdjustments, WeeklyPlanItemKind } from "./weekly-plan";
import type { RecentWorkoutLog } from "./workout-plan";

export type WeeklyRecoveryLevel = "normal" | "lighter" | "deload";
export type WeeklyRecoveryMode = "normal" | "deload";

export type WeeklyRecoveryRecommendation = {
  level: WeeklyRecoveryLevel;
  title: string;
  detail: string;
  evidence: string[];
  hardDays: number;
  decliningExercises: string[];
  recentLoad: number;
  priorLoad: number;
  plannedLoad: number;
  plannedDays: number;
  effortCoverage: number;
};

const LOAD_WEIGHT: Record<WeeklyPlanItemKind | "strength", number> = {
  home: 1,
  gym: 1,
  climb: 1,
  run: 1,
  class: 1,
  sport: 1,
  recovery: 0.25,
  strength: 1,
};

function parseISO(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function addDays(value: string, count: number) {
  const date = parseISO(value);
  if (!date) return value;
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function numberOrNull(value: unknown) {
  if (value == null || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function logRpe(log: RecentWorkoutLog) {
  const values = [log.rpe, ...log.setRows.map((set) => set.rpe)]
    .map(numberOrNull)
    .filter((value): value is number => value != null);
  return values.length ? Math.max(...values) : null;
}

function isStrengthLike(log: RecentWorkoutLog) {
  if (
    numberOrNull(log.weight) != null ||
    log.setRows.some((set) => numberOrNull(set.weight) != null)
  ) {
    return true;
  }
  const labels = `${log.workoutType} ${log.entryKind}`.toLowerCase();
  return labels.includes("strength") || labels.includes("calisthenics") || labels.includes("grip");
}

function dateCategoryMap(logs: RecentWorkoutLog[], loads: WeeklyLoadHistoryItem[]) {
  const map = new Map<string, Set<WeeklyLoadKind | "strength">>();
  for (const log of logs) {
    if (!log.completed || !log.date || !isStrengthLike(log)) continue;
    const categories = map.get(log.date) ?? new Set();
    categories.add("strength");
    map.set(log.date, categories);
  }
  for (const load of loads) {
    const categories = map.get(load.date) ?? new Set();
    categories.add(load.kind);
    map.set(load.date, categories);
  }
  return map;
}

function loadBetween(
  categories: Map<string, Set<WeeklyLoadKind | "strength">>,
  start: string,
  end: string,
) {
  let total = 0;
  for (const [date, items] of categories) {
    if (date < start || date > end) continue;
    for (const item of items) total += LOAD_WEIGHT[item];
  }
  return Math.round(total * 10) / 10;
}

function effortByDate(logs: RecentWorkoutLog[], loads: WeeklyLoadHistoryItem[]) {
  const map = new Map<string, number | null>();
  for (const log of logs.filter((item) => item.completed && item.date)) {
    const rpe = logRpe(log);
    const current = map.get(log.date);
    if (rpe != null && (current == null || rpe > current)) map.set(log.date, rpe);
    else if (!map.has(log.date)) map.set(log.date, null);
  }
  for (const load of loads) {
    const current = map.get(load.date);
    if (load.rpe != null && (current == null || load.rpe > current)) map.set(load.date, load.rpe);
    else if (!map.has(load.date)) map.set(load.date, null);
  }
  return map;
}

function hardDaysBetween(effort: Map<string, number | null>, start: string, end: string) {
  return Array.from(effort.entries()).filter(
    ([date, rpe]) => date >= start && date <= end && rpe != null && rpe >= 9,
  ).length;
}

function performanceFor(log: RecentWorkoutLog) {
  const sets = log.setRows.length
    ? log.setRows
    : [{ reps: log.reps, weight: log.weight, rpe: log.rpe, completed: true }];
  const aggregateSets = Math.max(1, numberOrNull(log.sets) ?? 1);
  return sets.reduce<number | null>((best, set) => {
    const weight = numberOrNull(set.weight ?? log.weight);
    let reps = numberOrNull(set.reps);
    if (sets.length === 1 && aggregateSets > 1 && reps != null) reps /= aggregateSets;
    if (weight == null || weight <= 0 || reps == null || reps <= 0) return best;
    const estimate = weight * (1 + reps / 30);
    return best == null || estimate > best ? estimate : best;
  }, null);
}

function decliningExercises(logs: RecentWorkoutLog[]) {
  const byExercise = new Map<string, RecentWorkoutLog[]>();
  for (const log of logs.filter((item) => item.completed && performanceFor(item) != null)) {
    const key = log.exercise.trim().toLowerCase();
    const current = byExercise.get(key) ?? [];
    current.push(log);
    byExercise.set(key, current);
  }
  return Array.from(byExercise.values()).flatMap((items) => {
    const recent = [...items]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter(
        (item, index, all) => all.findIndex((candidate) => candidate.date === item.date) === index,
      )
      .slice(0, 3);
    if (recent.length < 3 || (logRpe(recent[0]) ?? 0) < 9) return [];
    const latest = performanceFor(recent[0]);
    const earlier = recent
      .slice(1)
      .map(performanceFor)
      .filter((value): value is number => value != null);
    if (latest == null || earlier.length < 2) return [];
    const baseline = earlier.reduce((total, value) => total + value, 0) / earlier.length;
    return latest <= baseline * 0.95 ? [recent[0].exercise] : [];
  });
}

function plannedWeek(plan: WeeklyPlan, adjustments: WeeklyPlanAdjustments) {
  let score = 0;
  let days = 0;
  for (const day of plan.days) {
    const items = Array.from(
      new Set([...day.completedItems, ...(adjustments[day.date] ?? day.inferredItems)]),
    );
    if (items.length > 0) days += 1;
    for (const item of items) score += LOAD_WEIGHT[item];
  }
  return { score: Math.round(score * 10) / 10, days };
}

function formatLoad(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function readWeeklyRecoveryMode(value: string | null): WeeklyRecoveryMode {
  return value === "deload" ? "deload" : "normal";
}

export function buildWeeklyRecoveryRecommendation({
  logs,
  loadHistory,
  plan,
  adjustments,
  today,
}: {
  logs: RecentWorkoutLog[];
  loadHistory: WeeklyLoadHistoryItem[];
  plan: WeeklyPlan;
  adjustments: WeeklyPlanAdjustments;
  today: string;
}): WeeklyRecoveryRecommendation {
  const categories = dateCategoryMap(logs, loadHistory);
  const effort = effortByDate(logs, loadHistory);
  const recentStart = addDays(today, -13);
  const priorStart = addDays(today, -27);
  const priorEnd = addDays(today, -14);
  const recentLoad = loadBetween(categories, recentStart, today);
  const priorLoad = loadBetween(categories, priorStart, priorEnd);
  const hardDays = hardDaysBetween(effort, recentStart, today);
  const hardThisWeek = hardDaysBetween(effort, addDays(today, -6), today);
  const hardPreviousWeek = hardDaysBetween(effort, addDays(today, -13), addDays(today, -7));
  const consecutiveHardWeeks = hardThisWeek >= 2 && hardPreviousWeek >= 2;
  const declining = decliningExercises(logs);
  const planned = plannedWeek(plan, adjustments);
  const baselineWeekly = (recentLoad + priorLoad) / 4;
  const comparisonWeekly = Math.max(1, baselineWeekly);
  const plannedSpike =
    planned.days >= 3 &&
    planned.score >= comparisonWeekly * 1.3 &&
    planned.score - comparisonWeekly >= 1;
  const recentSpike =
    priorLoad >= 2 && recentLoad >= priorLoad * 1.25 && recentLoad - priorLoad >= 1;
  const deloadSignal =
    (consecutiveHardWeeks && (declining.length > 0 || plannedSpike)) ||
    (hardDays >= 4 && declining.length > 0);
  const lighterSignal = hardDays >= 2 || declining.length > 0 || plannedSpike || recentSpike;
  const recentEffort = Array.from(effort.entries()).filter(
    ([date]) => date >= recentStart && date <= today,
  );
  const effortCoverage = recentEffort.length
    ? Math.round((recentEffort.filter(([, rpe]) => rpe != null).length / recentEffort.length) * 100)
    : 0;
  const evidence = [
    `Recent load: ${formatLoad(recentLoad)} points in 14 days vs ${formatLoad(priorLoad)} previously`,
    `Hard effort: ${hardDays} day${hardDays === 1 ? "" : "s"} at RPE 9+ · RPE coverage ${effortCoverage}%`,
    declining.length
      ? `Performance decline with high effort: ${declining.join(", ")}`
      : "No exercise-level high-effort decline detected",
    `Planned week: ${formatLoad(planned.score)} load points across ${planned.days} day${planned.days === 1 ? "" : "s"}`,
  ];

  if (deloadSignal) {
    return {
      level: "deload",
      title: "Consider a deload week",
      detail:
        "Repeated hard weeks plus performance or planned-load pressure support reducing every strength workout before reassessing.",
      evidence,
      hardDays,
      decliningExercises: declining,
      recentLoad,
      priorLoad,
      plannedLoad: planned.score,
      plannedDays: planned.days,
      effortCoverage,
    };
  }
  if (lighterSignal) {
    return {
      level: "lighter",
      title: "Consider one lighter workout",
      detail:
        "There is some recovery pressure, but not enough combined evidence to call for a full deload week.",
      evidence,
      hardDays,
      decliningExercises: declining,
      recentLoad,
      priorLoad,
      plannedLoad: planned.score,
      plannedDays: planned.days,
      effortCoverage,
    };
  }
  return {
    level: "normal",
    title: "No deload signal yet",
    detail:
      effortCoverage < 40
        ? "Current history does not show enough evidence for a deload, but RPE coverage is limited. Keep the plan and record effort where possible."
        : "Recent load, effort, and performance do not currently support reducing the whole week.",
    evidence,
    hardDays,
    decliningExercises: declining,
    recentLoad,
    priorLoad,
    plannedLoad: planned.score,
    plannedDays: planned.days,
    effortCoverage,
  };
}
