import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  BatteryLow,
  Check,
  ChevronsUpDown,
  Dumbbell,
  ExternalLink,
  Gauge,
  Layers3,
  Loader2,
  MapPin,
  Pause,
  Repeat2,
  Scale,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionDetailDialog } from "@/components/session-detail-dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUKDate, formatUKDateShort } from "@/lib/date";
import { buildProgressDecision, type ProgressDecision } from "@/lib/progress-decision";
import {
  getExerciseHistoryClient,
  getLoggedExerciseKeysClient,
  getPlannedActualComparisonsClient,
} from "@/lib/supabase-history.browser";
import type {
  PlannedActualComparison,
  PlannedActualMethodStatus,
  PlannedActualSet,
  PlannedActualStatus,
} from "@/lib/planned-actual";
import { getLibraryClient } from "@/lib/supabase-log.browser";
import { getMovementMetricProfile, type MetricProfile } from "@/lib/movement-metrics";
import type { ExerciseMethodUse, ExerciseSessionPoint, LibraryRow } from "@/lib/training-types";
import { cn } from "@/lib/utils";
import { formatPositionMeasurementDirection } from "@/lib/position-measurements";

type ProgressSearch = {
  exercise?: string;
};

export const Route = createFileRoute("/progress")({
  validateSearch: (search: Record<string, unknown>): ProgressSearch =>
    typeof search.exercise === "string" ? { exercise: search.exercise } : {},
  head: () => ({
    meta: [
      { title: "Exercise Progress · Training Tracker" },
      {
        name: "description",
        content: "Review exercise load, estimated strength, training volume and methods over time.",
      },
    ],
  }),
  component: ProgressPage,
});

type Period = 4 | 8 | 12 | 26 | "all";
type LocationFilter = "all" | "home" | "gym";
type MethodFilter = "all" | "straight" | string;
type ExerciseOption = Omit<LibraryRow, "row"> & {
  id: string;
  locationScope: "home" | "gym" | "both";
};

const PERIODS: { value: Period; label: string }[] = [
  { value: 4, label: "4 weeks" },
  { value: 8, label: "8 weeks" },
  { value: 12, label: "12 weeks" },
  { value: 26, label: "6 months" },
  { value: "all", label: "All" },
];

const DAY_MS = 86_400_000;

function dateTime(iso: string) {
  return new Date(`${iso}T00:00:00Z`).getTime();
}

function mondayISO(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function percentageChange(current: number | null, previous: number | null) {
  if (current == null || previous == null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function bestPerformance(points: ExerciseSessionPoint[]) {
  return points.reduce<number | null>((best, point) => {
    const value = point.est1RM ?? point.maxWeight;
    return value != null && (best == null || value > best) ? value : best;
  }, null);
}

function totalVolume(points: ExerciseSessionPoint[]) {
  return points.reduce((sum, point) => sum + point.totalVolume, 0);
}

function bestHold(points: ExerciseSessionPoint[]) {
  return points.reduce<number | null>((best, point) => {
    const value = point.sets.reduce<number | null>(
      (setBest, set) =>
        set.durationSeconds != null && (setBest == null || set.durationSeconds > setBest)
          ? set.durationSeconds
          : setBest,
      null,
    );
    return value != null && (best == null || value > best) ? value : best;
  }, null);
}

function totalHoldSeconds(points: ExerciseSessionPoint[]) {
  return points.reduce(
    (total, point) =>
      total + point.sets.reduce((setTotal, set) => setTotal + (set.durationSeconds ?? 0), 0),
    0,
  );
}

function bestSetReps(points: ExerciseSessionPoint[]) {
  return points.reduce<number | null>((best, point) => {
    const pointBest = point.sets.reduce<number | null>((setBest, set) => {
      if (set.reps == null || set.dataShape !== "individual") return setBest;
      const value = set.reps;
      return setBest == null || value > setBest ? value : setBest;
    }, null);
    return pointBest != null && (best == null || pointBest > best) ? pointBest : best;
  }, null);
}

function totalActivityMinutes(points: ExerciseSessionPoint[]) {
  return points.reduce((total, point) => total + activityMinutes(point), 0);
}

function activityMinutes(point: ExerciseSessionPoint) {
  return point.activityDurationMinutes > 0 ? point.activityDurationMinutes : point.totalDuration;
}

function totalRounds(points: ExerciseSessionPoint[]) {
  return points.reduce((total, point) => total + point.rounds, 0);
}

function totalProblems(points: ExerciseSessionPoint[]) {
  return points.reduce((total, point) => total + point.problems, 0);
}

function averageRpe(points: ExerciseSessionPoint[]) {
  const values = points.flatMap((point) => (point.averageRpe != null ? [point.averageRpe] : []));
  return values.length
    ? Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10
    : null;
}

function bestHeight(points: ExerciseSessionPoint[]) {
  return points.reduce<number | null>(
    (best, point) =>
      point.heightCm != null && (best == null || point.heightCm > best) ? point.heightCm : best,
    null,
  );
}

function totalDistanceKm(points: ExerciseSessionPoint[]) {
  return points.reduce((total, point) => total + point.totalDistanceKm, 0);
}

function paceMinutesPerKm(point: ExerciseSessionPoint) {
  return point.totalDistanceKm > 0 && activityMinutes(point) > 0
    ? activityMinutes(point) / point.totalDistanceKm
    : null;
}

function densityRoundsPerMinute(point: ExerciseSessionPoint) {
  return point.rounds > 0 && activityMinutes(point) > 0
    ? point.rounds / activityMinutes(point)
    : null;
}

function formatNumber(value: number | null, suffix = "") {
  if (value == null) return "—";
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${formatted}${suffix}`;
}

function formatMinutes(value: number | null) {
  return value != null && value > 0 ? formatNumber(value, " min") : "—";
}

function formatDistance(valueKm: number | null) {
  if (valueKm == null || valueKm <= 0) return "—";
  return valueKm >= 1
    ? `${valueKm.toFixed(valueKm >= 10 ? 1 : 2)} km`
    : `${Math.round(valueKm * 1000)} m`;
}

function formatPace(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  const totalSeconds = Math.round(value * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}/km`;
}

function matchesMethod(point: ExerciseSessionPoint, method: MethodFilter) {
  if (method === "all") return true;
  if (method === "straight") return point.methods.length === 0;
  return point.methods.some((item) => item.key === method);
}

function methodName(method: ExerciseMethodUse) {
  return method.name || "Advanced method";
}

function methodBreakdown(points: ExerciseSessionPoint[]) {
  const buckets = new Map<string, { key: string; label: string; points: ExerciseSessionPoint[] }>();
  for (const point of points) {
    if (!point.methods.length) {
      const straight = buckets.get("straight") ?? {
        key: "straight",
        label: "Straight sets",
        points: [],
      };
      straight.points.push(point);
      buckets.set(straight.key, straight);
      continue;
    }
    for (const method of point.methods) {
      const bucket = buckets.get(method.key) ?? {
        key: method.key,
        label: methodName(method),
        points: [],
      };
      bucket.points.push(point);
      buckets.set(bucket.key, bucket);
    }
  }
  return Array.from(buckets.values())
    .map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      sessions: bucket.points.length,
      averageVolume: Math.round(totalVolume(bucket.points) / bucket.points.length),
      bestPerformance: bestPerformance(bucket.points),
    }))
    .sort((a, b) => {
      if (a.key === "straight") return -1;
      if (b.key === "straight") return 1;
      return a.label.localeCompare(b.label);
    });
}

function formatKg(value: number | null, decimals?: number) {
  if (value == null) return "—";
  const precision = decimals ?? (Number.isInteger(value) ? 0 : 1);
  return `${value.toFixed(precision)} kg`;
}

function formatSeconds(value: number | null) {
  if (value == null) return "—";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}s`;
}

function formatChange(value: number | null) {
  if (value == null) return "No prior comparison";
  return `${value > 0 ? "+" : ""}${value}% vs prior period`;
}

type ProfileStat = {
  icon: "gauge" | "scale" | "trend";
  label: string;
  value: string;
  detail: string;
  change?: number | null;
  changeDirection?: "up" | "down";
};

function maxValue(
  points: ExerciseSessionPoint[],
  read: (point: ExerciseSessionPoint) => number | null,
) {
  return points.reduce<number | null>((best, point) => {
    const value = read(point);
    return value != null && (best == null || value > best) ? value : best;
  }, null);
}

function latestValue<T>(
  points: ExerciseSessionPoint[],
  read: (point: ExerciseSessionPoint) => T | null,
) {
  return (
    [...points]
      .reverse()
      .map(read)
      .find((value) => value != null) ?? null
  );
}

function buildProfileStats(
  profile: MetricProfile,
  current: ExerciseSessionPoint[],
  previous: ExerciseSessionPoint[],
  weeks: number,
): ProfileStat[] {
  const averageWeekly = (total: number) => total / Math.max(1, weeks);
  const change = (currentValue: number | null, previousValue: number | null) =>
    percentageChange(currentValue, previousValue);
  const weeklyChange = (currentTotal: number, previousTotal: number) =>
    change(averageWeekly(currentTotal), previous.length ? averageWeekly(previousTotal) : null);
  const latest = current[current.length - 1];

  if (profile === "weighted") {
    const best = bestPerformance(current);
    return [
      {
        icon: "scale",
        label: "Top weight",
        value: formatKg(maxValue(current, (p) => p.maxWeight)),
        detail: "Heaviest working set",
      },
      {
        icon: "gauge",
        label: "Best est. 1RM",
        value: formatKg(best, 1),
        detail: formatChange(change(best, bestPerformance(previous))),
        change: change(best, bestPerformance(previous)),
      },
      {
        icon: "trend",
        label: "Avg weekly volume",
        value: formatKg(Math.round(averageWeekly(totalVolume(current)))),
        detail: formatChange(weeklyChange(totalVolume(current), totalVolume(previous))),
        change: weeklyChange(totalVolume(current), totalVolume(previous)),
      },
    ];
  }
  if (profile === "reps") {
    const best = bestSetReps(current);
    return [
      {
        icon: "gauge",
        label: "Best set",
        value: formatNumber(best, " reps"),
        detail: formatChange(change(best, bestSetReps(previous))),
        change: change(best, bestSetReps(previous)),
      },
      {
        icon: "trend",
        label: "Avg weekly reps",
        value: formatNumber(
          Math.round(averageWeekly(current.reduce((total, p) => total + p.totalReps, 0))),
        ),
        detail: formatChange(
          weeklyChange(
            current.reduce((total, p) => total + p.totalReps, 0),
            previous.reduce((total, p) => total + p.totalReps, 0),
          ),
        ),
        change: weeklyChange(
          current.reduce((total, p) => total + p.totalReps, 0),
          previous.reduce((total, p) => total + p.totalReps, 0),
        ),
      },
      {
        icon: "scale",
        label: "Average RPE",
        value: formatNumber(averageRpe(current)),
        detail: "Across recorded sets",
      },
    ];
  }
  if (profile === "hold" || profile === "grip") {
    const best = bestHold(current);
    return [
      {
        icon: "gauge",
        label: "Best hold",
        value: formatSeconds(best),
        detail: formatChange(change(best, bestHold(previous))),
        change: change(best, bestHold(previous)),
      },
      {
        icon: "trend",
        label: "Avg weekly hold",
        value: formatSeconds(averageWeekly(totalHoldSeconds(current))),
        detail: formatChange(weeklyChange(totalHoldSeconds(current), totalHoldSeconds(previous))),
        change: weeklyChange(totalHoldSeconds(current), totalHoldSeconds(previous)),
      },
      profile === "grip"
        ? {
            icon: "scale",
            label: "Top load",
            value: formatKg(maxValue(current, (p) => p.maxWeight)),
            detail: "Heaviest loaded hold",
          }
        : {
            icon: "scale",
            label: "Total hold time",
            value: formatSeconds(totalHoldSeconds(current)),
            detail: "Selected period",
          },
    ];
  }
  if (profile === "time") {
    const bestPace = current.reduce<number | null>((best, point) => {
      const pace = paceMinutesPerKm(point);
      return pace != null && (best == null || pace < best) ? pace : best;
    }, null);
    const previousPace = previous.reduce<number | null>((best, point) => {
      const pace = paceMinutesPerKm(point);
      return pace != null && (best == null || pace < best) ? pace : best;
    }, null);
    return [
      {
        icon: "gauge",
        label: "Best pace",
        value: formatPace(bestPace),
        detail: formatChange(change(bestPace, previousPace)),
        change: change(bestPace, previousPace),
        changeDirection: "down",
      },
      {
        icon: "trend",
        label: "Total distance",
        value: formatDistance(totalDistanceKm(current)),
        detail: "Selected period",
      },
      {
        icon: "scale",
        label: "Total time",
        value: formatMinutes(totalActivityMinutes(current)),
        detail: "Selected period",
      },
    ];
  }
  if (profile === "duration") {
    const latestWithDuration = [...current].reverse().find((point) => activityMinutes(point) > 0);
    return [
      {
        icon: "gauge",
        label: "Latest duration",
        value: formatMinutes(latestWithDuration ? activityMinutes(latestWithDuration) : null),
        detail: latestWithDuration ? formatUKDate(latestWithDuration.date) : "No recorded duration",
      },
      {
        icon: "trend",
        label: "Avg weekly time",
        value: formatMinutes(averageWeekly(totalActivityMinutes(current))),
        detail: formatChange(
          weeklyChange(totalActivityMinutes(current), totalActivityMinutes(previous)),
        ),
        change: weeklyChange(totalActivityMinutes(current), totalActivityMinutes(previous)),
      },
      {
        icon: "scale",
        label: "Average RPE",
        value: formatNumber(averageRpe(current)),
        detail: "Across recorded sessions",
      },
    ];
  }
  if (profile === "conditioning") {
    return [
      {
        icon: "gauge",
        label: "Best density",
        value: formatNumber(maxValue(current, densityRoundsPerMinute), " rounds/min"),
        detail: "Rounds divided by minutes",
      },
      {
        icon: "trend",
        label: "Total rounds",
        value: formatNumber(totalRounds(current)),
        detail: "Selected period",
      },
      {
        icon: "scale",
        label: "Total time",
        value: formatMinutes(totalActivityMinutes(current)),
        detail: "Selected period",
      },
    ];
  }
  if (profile === "carry") {
    return [
      {
        icon: "scale",
        label: "Top load",
        value: formatKg(maxValue(current, (p) => p.maxWeight)),
        detail: "Heaviest carry",
      },
      {
        icon: "trend",
        label: "Total distance",
        value: formatDistance(totalDistanceKm(current)),
        detail: "All recorded rounds",
      },
      {
        icon: "gauge",
        label: "Total time",
        value: formatMinutes(totalActivityMinutes(current)),
        detail: "Selected period",
      },
    ];
  }
  if (profile === "mobility_position") {
    const latestDistance = latest?.sets.find((set) => set.distance != null)?.distance ?? null;
    const latestUnit = latest?.sets.find((set) => set.distance != null)?.distanceUnit ?? "cm";
    return [
      {
        icon: "gauge",
        label: "Latest position",
        value: formatNumber(latestDistance, latestDistance == null ? "" : ` ${latestUnit}`),
        detail: latest ? formatUKDate(latest.date) : "No sessions",
      },
      {
        icon: "trend",
        label: "Best hold",
        value: formatSeconds(bestHold(current)),
        detail: "Longest position hold",
      },
      {
        icon: "scale",
        label: "Latest feel",
        value: formatNumber(
          latestValue(current, (p) => p.feel),
          "/5",
        ),
        detail: "1 restricted · 5 free",
      },
    ];
  }
  if (profile === "power") {
    const height = bestHeight(current);
    return [
      {
        icon: "gauge",
        label: "Best height",
        value: formatNumber(height, " cm"),
        detail: formatChange(change(height, bestHeight(previous))),
        change: change(height, bestHeight(previous)),
      },
      {
        icon: "trend",
        label: "Total jumps",
        value: formatNumber(current.reduce((total, p) => total + p.totalReps, 0)),
        detail: "Selected period",
      },
      {
        icon: "scale",
        label: "Average RPE",
        value: formatNumber(averageRpe(current)),
        detail: "Across recorded sessions",
      },
    ];
  }
  if (profile === "climbing") {
    return [
      {
        icon: "gauge",
        label: "Latest grade",
        value: latestValue(current, (p) => p.grade) ?? "—",
        detail: latestValue(current, (p) => p.gradient)
          ? `${latestValue(current, (p) => p.gradient)} board`
          : "Most recently reported session grade",
      },
      {
        icon: "trend",
        label: "Problems / routes",
        value: formatNumber(totalProblems(current)),
        detail: "Selected period",
      },
      {
        icon: "scale",
        label: "Total time",
        value: formatMinutes(totalActivityMinutes(current)),
        detail: "Selected period",
      },
    ];
  }
  return [
    {
      icon: "trend",
      label: "Total distance",
      value: formatDistance(totalDistanceKm(current)),
      detail: "Selected period",
    },
    {
      icon: "scale",
      label: "Top load",
      value: formatKg(maxValue(current, (p) => p.maxWeight)),
      detail: "Heaviest recorded effort",
    },
    {
      icon: "gauge",
      label: "Total time",
      value: formatMinutes(totalActivityMinutes(current)),
      detail: "Selected period",
    },
  ];
}

function ProgressPage() {
  const search = Route.useSearch();
  const library = useQuery({
    queryKey: ["progress-library"],
    queryFn: getLibraryClient,
    staleTime: 5 * 60_000,
  });
  const loggedExercises = useQuery({
    queryKey: ["progress-logged-exercises"],
    queryFn: getLoggedExerciseKeysClient,
    staleTime: 5 * 60_000,
  });
  const exercises = useMemo(() => {
    const loggedIds = new Set(loggedExercises.data?.ids ?? []);
    const loggedNames = new Set(loggedExercises.data?.names ?? []);
    return ((library.data?.exercises ?? []) as ExerciseOption[]).filter(
      (exercise) =>
        exercise.id === search.exercise ||
        loggedIds.has(exercise.id) ||
        loggedNames.has(exercise.name.trim().toLowerCase()),
    );
  }, [library.data?.exercises, loggedExercises.data, search.exercise]);
  const [exerciseId, setExerciseId] = useState("");
  const [period, setPeriod] = useState<Period>(8);
  const [location, setLocation] = useState<LocationFilter>("all");
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const locationExercises = useMemo(
    () =>
      exercises.filter(
        (exercise) =>
          location === "all" ||
          exercise.locationScope === "both" ||
          exercise.locationScope === location,
      ),
    [exercises, location],
  );

  useEffect(() => {
    if (locationExercises.some((exercise) => exercise.id === exerciseId)) return;
    const requested = locationExercises.find((exercise) => exercise.id === search.exercise);
    const bench = locationExercises.find(
      (exercise) => exercise.name.toLowerCase() === "bench press",
    );
    setExerciseId((requested ?? bench ?? locationExercises[0])?.id ?? "");
  }, [exerciseId, locationExercises, search.exercise]);

  const exercise = exercises.find((item) => item.id === exerciseId) ?? null;
  const metricProfile = exercise
    ? getMovementMetricProfile({
        workoutType: exercise.workoutType,
        movement: exercise.name,
        defaultMetric: exercise.metric,
      })
    : "weighted";
  const history = useQuery({
    queryKey: ["exercise-progress", exercise?.id],
    queryFn: () => getExerciseHistoryClient({ id: exercise?.id, name: exercise?.name ?? "" }),
    enabled: Boolean(exercise),
    staleTime: 60_000,
  });
  const plannedActual = useQuery({
    queryKey: ["planned-actual-progress", exercise?.id, exercise?.name],
    queryFn: () =>
      getPlannedActualComparisonsClient({ id: exercise?.id, name: exercise?.name ?? "" }),
    enabled: Boolean(exercise),
    staleTime: 60_000,
  });
  const methodOptions = useMemo(() => {
    const methods = new Map<string, string>();
    for (const point of history.data?.points ?? []) {
      for (const method of point.methods) methods.set(method.key, methodName(method));
    }
    return Array.from(methods, ([key, label]) => ({ key, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [history.data?.points]);

  useEffect(() => {
    if (
      methodFilter !== "all" &&
      methodFilter !== "straight" &&
      !methodOptions.some((method) => method.key === methodFilter)
    ) {
      setMethodFilter("all");
    }
  }, [methodFilter, methodOptions]);

  const activeMethodFilter =
    metricProfile === "weighted" || metricProfile === "reps" ? methodFilter : "all";

  const analysis = useMemo(() => {
    const locationPoints = (history.data?.points ?? []).filter(
      (point) => location === "all" || point.locationKind === location,
    );
    const today = new Date();
    const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const windowMs = period === "all" ? null : period * 7 * DAY_MS;
    const periodPoints = locationPoints.filter(
      (point) => windowMs == null || dateTime(point.date) >= now - windowMs,
    );
    const current = periodPoints.filter((point) => matchesMethod(point, activeMethodFilter));
    const previous =
      windowMs == null
        ? []
        : locationPoints.filter((point) => {
            const time = dateTime(point.date);
            return (
              time >= now - 2 * windowMs &&
              time < now - windowMs &&
              matchesMethod(point, activeMethodFilter)
            );
          });
    const weeks =
      period === "all"
        ? Math.max(
            1,
            Math.ceil(
              ((current.length ? now - dateTime(current[0].date) : 0) + DAY_MS) / (7 * DAY_MS),
            ),
          )
        : period;
    const priorWeeks = period === "all" ? 1 : period;
    const currentBest = bestPerformance(current);
    const previousBest = bestPerformance(previous);
    const performanceChange = percentageChange(currentBest, previousBest);
    const averageWeeklyVolume = totalVolume(current) / weeks;
    const priorAverageVolume = totalVolume(previous) / priorWeeks;
    const volumeChange = percentageChange(
      averageWeeklyVolume,
      previous.length ? priorAverageVolume : null,
    );
    const weeklyMap = new Map<string, number>();
    for (const point of current) {
      const week = mondayISO(point.date);
      weeklyMap.set(week, (weeklyMap.get(week) ?? 0) + point.totalVolume);
    }
    const weeklyVolume = Array.from(weeklyMap, ([week, volume]) => ({
      week,
      label: formatUKDateShort(week),
      volume: Math.round(volume),
    })).sort((a, b) => a.week.localeCompare(b.week));

    const weeklyHoldMap = new Map<string, number>();
    for (const point of current) {
      const week = mondayISO(point.date);
      weeklyHoldMap.set(week, (weeklyHoldMap.get(week) ?? 0) + totalHoldSeconds([point]));
    }
    const weeklyHold = Array.from(weeklyHoldMap, ([week, seconds]) => ({
      week,
      label: formatUKDateShort(week),
      seconds: Math.round(seconds * 10) / 10,
    })).sort((a, b) => a.week.localeCompare(b.week));

    return {
      current,
      previous,
      weeks,
      currentBest,
      performanceChange,
      volumeChange,
      averageWeeklyVolume: Math.round(averageWeeklyVolume),
      maxWeight: current.reduce<number | null>(
        (max, point) =>
          point.maxWeight != null && (max == null || point.maxWeight > max) ? point.maxWeight : max,
        null,
      ),
      weeklyVolume,
      weeklyHold,
      methodBreakdown: methodBreakdown(periodPoints),
    };
  }, [activeMethodFilter, history.data, location, period]);

  const profileStats = useMemo(
    () => buildProfileStats(metricProfile, analysis.current, analysis.previous, analysis.weeks),
    [analysis, metricProfile],
  );

  const decision = useMemo(() => {
    return buildProgressDecision({
      points: analysis.current,
      performanceChange: analysis.performanceChange,
      volumeChange: analysis.volumeChange,
    });
  }, [analysis]);
  const visibleComparisons = useMemo(() => {
    const today = new Date();
    const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const windowMs = period === "all" ? null : period * 7 * DAY_MS;
    return (plannedActual.data ?? []).filter((comparison) => {
      const point = history.data?.points.find((item) => item.sessionId === comparison.sessionId);
      return (
        (location === "all" || comparison.locationKind === location) &&
        (windowMs == null || dateTime(comparison.date) >= now - windowMs) &&
        (activeMethodFilter === "all" || Boolean(point && matchesMethod(point, activeMethodFilter)))
      );
    });
  }, [activeMethodFilter, history.data?.points, location, period, plannedActual.data]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Exercise Progress</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Charts and history adapt to how the selected exercise is tracked.
          </p>
        </div>
        <ExercisePicker exercises={locationExercises} value={exerciseId} onChange={setExerciseId} />
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-secondary/40 p-1">
          {PERIODS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setPeriod(item.value)}
              className={cn(
                "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition",
                period === item.value
                  ? "bg-card text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-xl border border-border bg-secondary/40 p-1">
          {(["all", "home", "gym"] as LocationFilter[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setLocation(item)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition sm:flex-none",
                location === item
                  ? "bg-card text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item !== "all" && <MapPin className="h-3 w-3" />}
              {item}
            </button>
          ))}
        </div>
      </div>

      {metricProfile === "weighted" || metricProfile === "reps" ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Layers3 className="h-3.5 w-3.5" />
            Training method
          </div>
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-secondary/40 p-1">
            {[
              { key: "all", label: "All methods" },
              { key: "straight", label: "Straight sets" },
              ...methodOptions,
            ].map((method) => (
              <button
                key={method.key}
                type="button"
                onClick={() => setMethodFilter(method.key)}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  methodFilter === method.key
                    ? "bg-card text-foreground shadow"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {method.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {library.isLoading ||
      loggedExercises.isLoading ||
      history.isLoading ||
      (!exercise && exercises.length > 0) ? (
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading progress…
        </div>
      ) : library.error || loggedExercises.error || history.error ? (
        <Card className="border-destructive/40">
          <CardContent className="p-6 text-sm text-destructive">
            Progress could not be loaded. Please refresh and try again.
          </CardContent>
        </Card>
      ) : exercises.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No completed exercise logs yet. Finish a workout to start tracking progress.
          </CardContent>
        </Card>
      ) : analysis.current.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Dumbbell className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
            <p className="font-medium">No matching sessions</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a longer period or switch the location filter.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {metricProfile === "weighted" ? (
            <DecisionCard decision={decision} exerciseName={exercise?.name ?? "This exercise"} />
          ) : null}

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={<Dumbbell className="h-4 w-4" />}
              label="Sessions"
              value={String(analysis.current.length)}
              detail={location === "all" ? "All locations" : location}
            />
            {profileStats.map((stat) => (
              <StatCard
                key={stat.label}
                icon={
                  stat.icon === "scale" ? (
                    <Scale className="h-4 w-4" />
                  ) : stat.icon === "trend" ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <Gauge className="h-4 w-4" />
                  )
                }
                label={stat.label}
                value={stat.value}
                detail={stat.detail}
                change={stat.change}
                changeDirection={stat.changeDirection}
              />
            ))}
          </section>

          {metricProfile === "weighted" || metricProfile === "reps" ? (
            <MethodComparison summaries={analysis.methodBreakdown} />
          ) : null}

          {metricProfile === "weighted" || metricProfile === "reps" ? (
            <PlannedActualHistory
              comparisons={visibleComparisons}
              isLoading={plannedActual.isLoading}
              hasError={Boolean(plannedActual.error)}
              onSelectSession={setSelectedSessionId}
            />
          ) : null}

          <ProfileCharts
            profile={metricProfile}
            points={analysis.current}
            weeklyVolume={analysis.weeklyVolume}
            weeklyHold={analysis.weeklyHold}
            positionMeasurementLabel={exercise?.positionMeasurementLabel ?? ""}
            positionMeasurementDirection={exercise?.positionMeasurementDirection ?? ""}
            onSelectSession={setSelectedSessionId}
          />

          <SetHistory
            points={analysis.current}
            onSelectSession={setSelectedSessionId}
            profile={metricProfile}
          />
        </>
      )}
      <SessionDetailDialog
        sessionId={selectedSessionId}
        onOpenChange={(open) => !open && setSelectedSessionId(null)}
      />
    </div>
  );
}

const COMPARISON_STATUS: Record<PlannedActualStatus, { label: string; className: string }> = {
  exceeded: { label: "Exceeded", className: "border-emerald-400/30 text-emerald-300" },
  met: { label: "Met", className: "border-sky-400/30 text-sky-300" },
  partial: { label: "Partial", className: "border-amber-400/30 text-amber-300" },
  missed: { label: "Not completed", className: "border-rose-400/30 text-rose-300" },
};

const METHOD_STATUS: Record<PlannedActualMethodStatus, { label: string; className: string }> = {
  none: { label: "Straight sets", className: "border-border text-muted-foreground" },
  matched: { label: "Method matched", className: "border-emerald-400/30 text-emerald-300" },
  changed: { label: "Method changed", className: "border-amber-400/30 text-amber-300" },
  omitted: { label: "Method omitted", className: "border-rose-400/30 text-rose-300" },
  added: { label: "Method added", className: "border-violet-400/30 text-violet-300" },
};

function MethodBadges({ methods }: { methods: ExerciseMethodUse[] }) {
  if (!methods.length) {
    return (
      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
        Straight sets
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      {methods.map((method) => (
        <span
          key={method.key}
          className="rounded-full border border-violet-400/30 bg-violet-400/[0.08] px-2 py-0.5 text-[10px] font-medium text-violet-200"
        >
          {methodName(method)}
        </span>
      ))}
    </div>
  );
}

function MethodComparison({
  summaries,
}: {
  summaries: Array<{
    key: string;
    label: string;
    sessions: number;
    averageVolume: number;
    bestPerformance: number | null;
  }>;
}) {
  const hasAdvanced = summaries.some((summary) => summary.key !== "straight");
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Layers3 className="h-4 w-4" /> Method comparison
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          The same exercise workload, grouped by how it was trained. A session can appear under more
          than one advanced method.
        </p>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {summaries.length ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {summaries.map((summary) => (
              <div
                key={summary.key}
                className="rounded-lg border border-border bg-secondary/15 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{summary.label}</p>
                  <span className="text-[10px] text-muted-foreground">
                    {summary.sessions} {summary.sessions === 1 ? "session" : "sessions"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Avg volume
                    </p>
                    <p className="mt-1 text-sm font-semibold">{formatKg(summary.averageVolume)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Best performance
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {formatKg(summary.bestPerformance, 1)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {!hasAdvanced ? (
          <p className={cn("text-xs text-muted-foreground", summaries.length && "mt-3")}>
            No advanced-method session is logged for this exercise in the selected period and
            location yet.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function comparisonSetSummary(sets: PlannedActualSet[]) {
  return sets
    .map((set) => {
      const target = [
        set.weight != null ? `${set.weight}kg` : "",
        set.reps != null ? `${set.reps} reps` : "",
        set.rpe != null ? `RPE ${set.rpe}` : "",
      ]
        .filter(Boolean)
        .join(" × ");
      return target || `Set ${set.setNumber}`;
    })
    .join(" · ");
}

function volumeDelta(comparison: PlannedActualComparison) {
  if (comparison.plannedVolume <= 0 || comparison.actualVolume <= 0) return null;
  return Math.round(
    ((comparison.actualVolume - comparison.plannedVolume) / comparison.plannedVolume) * 100,
  );
}

function PlannedActualHistory({
  comparisons,
  isLoading,
  hasError,
  onSelectSession,
}: {
  comparisons: PlannedActualComparison[];
  isLoading: boolean;
  hasError: boolean;
  onSelectSession: (sessionId: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm">Plan versus actual</CardTitle>
        <p className="text-xs text-muted-foreground">
          Exact targets from a saved recommendation compared with its linked completed workout.
        </p>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading plan comparisons…
          </div>
        ) : hasError ? (
          <p className="py-6 text-sm text-destructive">Plan comparisons could not be loaded.</p>
        ) : comparisons.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            No linked planned workout for this exercise yet. Start and finish a recommendation to
            create the first comparison.
          </div>
        ) : (
          <div className="space-y-3">
            {comparisons.slice(0, 5).map((comparison) => {
              const status = COMPARISON_STATUS[comparison.status];
              const methodStatus = METHOD_STATUS[comparison.methodStatus];
              const delta = volumeDelta(comparison);
              return (
                <div
                  key={comparison.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectSession(comparison.sessionId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectSession(comparison.sessionId);
                    }
                  }}
                  className="cursor-pointer rounded-lg border border-border bg-secondary/15 p-3 transition hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{formatUKDate(comparison.date)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {comparison.planTitle}
                        {comparison.locationKind ? ` · ${comparison.locationKind}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          status.className,
                        )}
                      >
                        {status.label}
                      </span>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          methodStatus.className,
                        )}
                      >
                        {methodStatus.label}
                      </span>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Planned
                      </p>
                      <p className="mt-1 text-xs leading-relaxed">
                        {comparisonSetSummary(comparison.planned) || "No set targets"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Actual
                      </p>
                      <p className="mt-1 text-xs leading-relaxed">
                        {comparisonSetSummary(comparison.actual) || "No completed sets"}
                      </p>
                    </div>
                  </div>
                  {comparison.methodStatus !== "none" ? (
                    <div className="mt-2 rounded-lg border border-border/70 bg-background/25 p-2.5 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground/80">Method: </span>
                      {comparison.plannedMethods.length
                        ? comparison.plannedMethods.map((method) => method.name).join(" + ")
                        : "Straight sets"}
                      <span className="mx-1.5">→</span>
                      {comparison.actualMethods.length
                        ? comparison.actualMethods.map((method) => method.name).join(" + ")
                        : "Straight sets"}
                    </div>
                  ) : null}
                  {delta != null ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Volume: {comparison.plannedVolume.toLocaleString()} kg planned ·{" "}
                      {comparison.actualVolume.toLocaleString()} kg actual · {delta > 0 ? "+" : ""}
                      {delta}%
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const DECISION_STYLE: Record<
  ProgressDecision["kind"],
  { icon: React.ReactNode; className: string; eyebrow: string }
> = {
  progress: {
    icon: <ArrowUpRight className="h-5 w-5" />,
    className: "border-emerald-400/30 bg-emerald-400/[0.07] text-emerald-200",
    eyebrow: "Progression supported",
  },
  continue: {
    icon: <Repeat2 className="h-5 w-5" />,
    className: "border-sky-400/30 bg-sky-400/[0.07] text-sky-200",
    eyebrow: "Next decision",
  },
  hold: {
    icon: <Pause className="h-5 w-5" />,
    className: "border-violet-400/30 bg-violet-400/[0.07] text-violet-200",
    eyebrow: "Progression not confirmed",
  },
  lighter: {
    icon: <BatteryLow className="h-5 w-5" />,
    className: "border-amber-400/30 bg-amber-400/[0.07] text-amber-200",
    eyebrow: "Recovery check",
  },
  baseline: {
    icon: <Gauge className="h-5 w-5" />,
    className: "border-slate-400/25 bg-slate-400/[0.06] text-slate-200",
    eyebrow: "Evidence building",
  },
};

function DecisionCard({
  decision,
  exerciseName,
}: {
  decision: ProgressDecision;
  exerciseName: string;
}) {
  const style = DECISION_STYLE[decision.kind];
  return (
    <Card className={style.className}>
      <CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)] lg:items-center">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">{style.icon}</div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">
              {style.eyebrow} · {exerciseName}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
              {decision.label}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{decision.detail}</p>
          </div>
        </div>
        <div className="space-y-2 rounded-lg border border-border/70 bg-background/35 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Why this recommendation
          </p>
          {decision.evidence.map((item) => (
            <p key={item} className="text-xs leading-relaxed text-foreground/80">
              {item}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ExercisePicker({
  exercises,
  value,
  onChange,
}: {
  exercises: ExerciseOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = exercises.find((exercise) => exercise.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between sm:w-[320px]"
        >
          <span className="truncate">{selected?.name ?? "Choose an exercise"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(320px,calc(100vw-2rem))] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search exercises…" />
          <CommandList>
            <CommandEmpty>No exercise found.</CommandEmpty>
            <CommandGroup>
              {exercises.map((exercise) => (
                <CommandItem
                  key={exercise.id}
                  value={`${exercise.name} ${exercise.workoutType}`}
                  onSelect={() => {
                    onChange(exercise.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === exercise.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{exercise.name}</span>
                  <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">
                    {exercise.workoutType}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
  change,
  changeDirection = "up",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  change?: number | null;
  changeDirection?: "up" | "down";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <p className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{value}</p>
        <p
          className={cn(
            "mt-1 truncate text-[11px] text-muted-foreground",
            change != null &&
              ((changeDirection === "up" && change > 0) ||
                (changeDirection === "down" && change < 0)) &&
              "text-emerald-400",
            change != null &&
              ((changeDirection === "up" && change < 0) ||
                (changeDirection === "down" && change > 0)) &&
              "text-amber-400",
          )}
        >
          {detail}
        </p>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="p-2 pt-0 sm:p-4 sm:pt-0">{children}</CardContent>
    </Card>
  );
}

const tooltipStyle = {
  backgroundColor: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--color-popover-foreground)",
};

function PerformanceChart({
  points,
  onSelectSession,
}: {
  points: ExerciseSessionPoint[];
  onSelectSession: (sessionId: string) => void;
}) {
  const data = points.map((point) => ({
    label: formatUKDateShort(point.date),
    weight: point.maxWeight,
    estimated: point.est1RM,
    sessionId: point.sessionId,
  }));
  return (
    <ChartCard title="Performance" subtitle="Top working weight and estimated 1RM · select a point">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={data}
          margin={{ top: 12, right: 12, left: -12, bottom: 0 }}
          onClick={(state) => {
            const payload = state?.activePayload?.[0]?.payload as
              | { sessionId?: string }
              | undefined;
            if (payload?.sessionId) onSelectSession(payload.sessionId);
          }}
          className="cursor-pointer"
        >
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="var(--color-muted-foreground)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            unit="kg"
            stroke="var(--color-muted-foreground)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number) => [`${value.toFixed(1)} kg`]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line
            type="monotone"
            dataKey="weight"
            name="Top weight"
            stroke="var(--color-chart-1)"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="estimated"
            name="Est. 1RM"
            stroke="var(--color-chart-2)"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function HoldPerformanceChart({
  points,
  onSelectSession,
}: {
  points: ExerciseSessionPoint[];
  onSelectSession: (sessionId: string) => void;
}) {
  const data = points.map((point) => ({
    label: formatUKDateShort(point.date),
    best: bestHold([point]),
    sessionId: point.sessionId,
  }));
  return (
    <ChartCard title="Best hold" subtitle="Longest completed set in each session · select a point">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={data}
          margin={{ top: 12, right: 12, left: -12, bottom: 0 }}
          onClick={(state) => {
            const payload = state?.activePayload?.[0]?.payload as
              | { sessionId?: string }
              | undefined;
            if (payload?.sessionId) onSelectSession(payload.sessionId);
          }}
          className="cursor-pointer"
        >
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="var(--color-muted-foreground)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            unit="s"
            stroke="var(--color-muted-foreground)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number) => [`${value}s`, "Best hold"]}
          />
          <Line
            type="monotone"
            dataKey="best"
            name="Best hold"
            stroke="var(--color-chart-2)"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function VolumeChart({ data }: { data: { week: string; label: string; volume: number }[] }) {
  return (
    <ChartCard title="Weekly volume" subtitle="Total recorded load × reps for each training week">
      {data.length === 0 ? (
        <div className="flex h-[260px] items-center justify-center text-xs text-muted-foreground">
          No weighted volume in this period.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 12, right: 12, left: -6, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="var(--color-muted-foreground)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--color-muted-foreground)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number) => [`${Math.round(value).toLocaleString()} kg`, "Volume"]}
            />
            <Bar dataKey="volume" name="Volume" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function HoldVolumeChart({ data }: { data: { week: string; label: string; seconds: number }[] }) {
  return (
    <ChartCard title="Weekly hold time" subtitle="Total seconds accumulated across completed sets">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 12, right: 12, left: -6, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="var(--color-muted-foreground)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            unit="s"
            stroke="var(--color-muted-foreground)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number) => [`${value}s`, "Hold time"]}
          />
          <Bar
            dataKey="seconds"
            name="Hold time"
            fill="var(--color-chart-3)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function MetricTrendChart({
  points,
  title,
  subtitle,
  name,
  unit,
  read,
  format,
  onSelectSession,
}: {
  points: ExerciseSessionPoint[];
  title: string;
  subtitle: string;
  name: string;
  unit?: string;
  read: (point: ExerciseSessionPoint) => number | null;
  format?: (value: number) => string;
  onSelectSession: (sessionId: string) => void;
}) {
  const data = points.map((point) => ({
    label: formatUKDateShort(point.date),
    value: read(point),
    sessionId: point.sessionId,
  }));
  return (
    <ChartCard title={title} subtitle={subtitle}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={data}
          margin={{ top: 12, right: 12, left: -12, bottom: 0 }}
          onClick={(state) => {
            const payload = state?.activePayload?.[0]?.payload as
              | { sessionId?: string }
              | undefined;
            if (payload?.sessionId) onSelectSession(payload.sessionId);
          }}
          className="cursor-pointer"
        >
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="var(--color-muted-foreground)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            unit={unit}
            stroke="var(--color-muted-foreground)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number) => [format ? format(value) : `${value}${unit ?? ""}`, name]}
          />
          <Line
            type="monotone"
            dataKey="value"
            name={name}
            stroke="var(--color-chart-2)"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function WeeklyMetricChart({
  points,
  title,
  subtitle,
  name,
  unit,
  read,
  format,
}: {
  points: ExerciseSessionPoint[];
  title: string;
  subtitle: string;
  name: string;
  unit?: string;
  read: (point: ExerciseSessionPoint) => number;
  format?: (value: number) => string;
}) {
  const weeks = new Map<string, number>();
  for (const point of points) {
    const week = mondayISO(point.date);
    weeks.set(week, (weeks.get(week) ?? 0) + read(point));
  }
  const data = Array.from(weeks, ([week, value]) => ({
    week,
    label: formatUKDateShort(week),
    value: Math.round(value * 100) / 100,
  })).sort((a, b) => a.week.localeCompare(b.week));
  return (
    <ChartCard title={title} subtitle={subtitle}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 12, right: 12, left: -6, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="var(--color-muted-foreground)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            unit={unit}
            stroke="var(--color-muted-foreground)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number) => [format ? format(value) : `${value}${unit ?? ""}`, name]}
          />
          <Bar dataKey="value" name={name} fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function LoadRelationshipChart({
  points,
  mode,
}: {
  points: ExerciseSessionPoint[];
  mode: "hold" | "distance";
}) {
  const data = points.flatMap((point) =>
    point.sets.flatMap((set) => {
      const outcome = mode === "hold" ? set.durationSeconds : set.distance;
      return set.weight != null && outcome != null
        ? [{ load: set.weight, outcome, date: formatUKDateShort(point.date) }]
        : [];
    }),
  );
  const outcomeLabel = mode === "hold" ? "Hold (sec)" : "Distance";
  return (
    <ChartCard
      title={mode === "hold" ? "Load versus hold" : "Load versus distance"}
      subtitle="Each dot is a completed set; use it to see the load/performance trade-off"
    >
      {data.length ? (
        <ResponsiveContainer width="100%" height={260}>
          <ScatterChart margin={{ top: 12, right: 12, left: -6, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="load"
              name="Load"
              unit="kg"
              stroke="var(--color-muted-foreground)"
              fontSize={10}
              tickLine={false}
            />
            <YAxis
              type="number"
              dataKey="outcome"
              name={outcomeLabel}
              unit={mode === "hold" ? "s" : undefined}
              stroke="var(--color-muted-foreground)"
              fontSize={10}
              tickLine={false}
            />
            <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={data} fill="var(--color-chart-4)" />
          </ScatterChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[260px] items-center justify-center text-xs text-muted-foreground">
          Log load and {mode === "hold" ? "hold duration" : "distance"} together to build this view.
        </div>
      )}
    </ChartCard>
  );
}

function ProfileCharts({
  profile,
  points,
  weeklyVolume,
  weeklyHold,
  positionMeasurementLabel,
  positionMeasurementDirection,
  onSelectSession,
}: {
  profile: MetricProfile;
  points: ExerciseSessionPoint[];
  weeklyVolume: { week: string; label: string; volume: number }[];
  weeklyHold: { week: string; label: string; seconds: number }[];
  positionMeasurementLabel: string;
  positionMeasurementDirection: string;
  onSelectSession: (sessionId: string) => void;
}) {
  const trend = (
    props: Omit<React.ComponentProps<typeof MetricTrendChart>, "points" | "onSelectSession">,
  ) => <MetricTrendChart points={points} onSelectSession={onSelectSession} {...props} />;
  const weekly = (props: Omit<React.ComponentProps<typeof WeeklyMetricChart>, "points">) => (
    <WeeklyMetricChart points={points} {...props} />
  );
  let charts: React.ReactNode;
  if (profile === "weighted") {
    charts = (
      <>
        <PerformanceChart points={points} onSelectSession={onSelectSession} />
        <VolumeChart data={weeklyVolume} />
      </>
    );
  } else if (profile === "reps") {
    charts = (
      <>
        {trend({
          title: "Best set",
          subtitle: "Highest completed set reps in each session",
          name: "Best set",
          unit: " reps",
          read: (point) => bestSetReps([point]),
        })}
        {weekly({
          title: "Weekly reps",
          subtitle: "All completed reps accumulated by training week",
          name: "Reps",
          unit: "",
          read: (point) => point.totalReps,
        })}
        {trend({
          title: "Effort",
          subtitle: "Average recorded set RPE for each session",
          name: "RPE",
          read: (point) => point.averageRpe,
        })}
      </>
    );
  } else if (profile === "hold" || profile === "grip") {
    charts = (
      <>
        <HoldPerformanceChart points={points} onSelectSession={onSelectSession} />
        <HoldVolumeChart data={weeklyHold} />
        {profile === "grip" ? <LoadRelationshipChart points={points} mode="hold" /> : null}
      </>
    );
  } else if (profile === "time") {
    charts = (
      <>
        {trend({
          title: "Pace",
          subtitle: "Minutes per kilometre; lower is faster",
          name: "Pace",
          read: paceMinutesPerKm,
          format: formatPace,
        })}
        {trend({
          title: "Session distance",
          subtitle: "Distance completed in each session",
          name: "Distance",
          unit: "km",
          read: (point) => point.totalDistanceKm || null,
          format: formatDistance,
        })}
        {weekly({
          title: "Weekly distance",
          subtitle: "Total normalized distance by training week",
          name: "Distance",
          unit: "km",
          read: (point) => point.totalDistanceKm,
          format: formatDistance,
        })}
      </>
    );
  } else if (profile === "duration") {
    charts = (
      <>
        {trend({
          title: "Session duration",
          subtitle: "Recorded minutes for each session",
          name: "Duration",
          unit: " min",
          read: (point) => activityMinutes(point) || null,
          format: formatMinutes,
        })}
        {weekly({
          title: "Weekly time",
          subtitle: "Total recorded minutes by training week",
          name: "Minutes",
          unit: " min",
          read: activityMinutes,
          format: formatMinutes,
        })}
        {trend({
          title: "Effort",
          subtitle: "Average recorded RPE over time",
          name: "RPE",
          read: (point) => point.averageRpe,
        })}
      </>
    );
  } else if (profile === "conditioning") {
    charts = (
      <>
        {trend({
          title: "Work density",
          subtitle: "Completed rounds per minute",
          name: "Rounds/min",
          read: densityRoundsPerMinute,
          format: (value) => `${value.toFixed(2)} rounds/min`,
        })}
        {weekly({
          title: "Weekly rounds",
          subtitle: "Total completed rounds by training week",
          name: "Rounds",
          read: (point) => point.rounds,
        })}
        {trend({
          title: "Session duration",
          subtitle: "Time spent on each conditioning session",
          name: "Duration",
          unit: " min",
          read: (point) => activityMinutes(point) || null,
          format: formatMinutes,
        })}
      </>
    );
  } else if (profile === "carry") {
    charts = (
      <>
        {trend({
          title: "Top load",
          subtitle: "Heaviest load recorded in each session",
          name: "Load",
          unit: "kg",
          read: (point) => point.maxWeight,
          format: (value) => formatKg(value),
        })}
        {trend({
          title: "Session distance",
          subtitle: "Total normalized carry distance",
          name: "Distance",
          unit: "km",
          read: (point) => point.totalDistanceKm || null,
          format: formatDistance,
        })}
        <LoadRelationshipChart points={points} mode="distance" />
      </>
    );
  } else if (profile === "mobility_position") {
    charts = (
      <>
        {trend({
          title: "Position distance",
          subtitle: "Recorded range or distance; interpret direction for the selected movement",
          name: "Distance",
          unit: "cm",
          read: (point) => point.sets.find((set) => set.distance != null)?.distance ?? null,
          format: (value) => `${value} cm`,
        })}
        {trend({
          title: "Position hold",
          subtitle: "Longest hold recorded in each session",
          name: "Hold",
          unit: "s",
          read: (point) => bestHold([point]),
          format: (value) => formatSeconds(value),
        })}
        {trend({
          title: "Feel",
          subtitle: "1 restricted, 3 normal, 5 free and comfortable",
          name: "Feel",
          read: (point) => point.feel,
          format: (value) => `${value}/5`,
        })}
      </>
    );
  } else if (profile === "power") {
    charts = (
      <>
        {trend({
          title: "Best height",
          subtitle:
            "Highest recorded jump in each session; the trend also shows session-to-session consistency",
          name: "Height",
          unit: "cm",
          read: (point) => point.heightCm,
          format: (value) => `${value} cm`,
        })}
        {weekly({
          title: "Weekly jumps",
          subtitle: "Total recorded jumps by training week",
          name: "Jumps",
          read: (point) => point.totalReps,
        })}
        {trend({
          title: "Effort",
          subtitle: "Average recorded RPE for each session",
          name: "RPE",
          read: (point) => point.averageRpe,
        })}
      </>
    );
  } else if (profile === "climbing") {
    charts = (
      <>
        {trend({
          title: "Session duration",
          subtitle: "Minutes climbed in each session",
          name: "Duration",
          unit: " min",
          read: (point) => activityMinutes(point) || null,
          format: formatMinutes,
        })}
        {trend({
          title: "Problems / routes",
          subtitle: "Completed problems or routes per session",
          name: "Problems / routes",
          read: (point) => point.problems || null,
        })}
        {trend({
          title: "Effort",
          subtitle: "Average recorded RPE over time",
          name: "RPE",
          read: (point) => point.averageRpe,
        })}
      </>
    );
  } else {
    charts = (
      <>
        {trend({
          title: "Session duration",
          subtitle: "Recorded minutes for each session",
          name: "Duration",
          unit: " min",
          read: (point) => activityMinutes(point) || null,
          format: formatMinutes,
        })}
        {weekly({
          title: "Weekly time",
          subtitle: "Total recorded minutes by training week",
          name: "Minutes",
          unit: " min",
          read: activityMinutes,
          format: formatMinutes,
        })}
      </>
    );
  }
  const positionMeasurementChart = points.some((point) => point.positionMeasurementCm != null)
    ? trend({
        title: positionMeasurementLabel || "Position measurement",
        subtitle: `${formatPositionMeasurementDirection(positionMeasurementDirection)} · recorded independently from jump height`,
        name: positionMeasurementLabel || "Position measurement",
        unit: " cm",
        read: (point) => point.positionMeasurementCm,
        format: (value) => `${value} cm`,
      })
    : null;

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      {positionMeasurementChart}
      {charts}
    </section>
  );
}

function setSummary(point: ExerciseSessionPoint) {
  const work = point.sets
    .map((set) => {
      if (set.aggregateSets != null) {
        if (set.durationSeconds != null) {
          return `${set.aggregateSets} attempts · ${formatSeconds(set.durationSeconds)} each · ${formatSeconds(set.durationSeconds * set.aggregateSets)} total${set.weight != null ? ` @ ${set.weight}kg` : ""}${set.rpe != null ? ` · RPE ${set.rpe}` : ""}`;
        }
        return `${set.aggregateSets} sets · ${set.reps ?? "—"} total${set.weight != null ? ` @ ${set.weight}kg` : ""}${set.rpe != null ? ` · RPE ${set.rpe}` : ""}`;
      }
      if (set.weight != null && set.reps != null)
        return `${set.weight}×${set.reps}${set.rpe != null ? ` @${set.rpe}` : ""}`;
      if (set.durationSeconds != null)
        return `${formatSeconds(set.durationSeconds)}${set.weight != null ? ` @ ${set.weight}kg` : ""}${set.rpe != null ? ` · RPE ${set.rpe}` : ""}`;
      if (set.reps != null) return `${set.reps} reps${set.rpe != null ? ` @${set.rpe}` : ""}`;
      return "Recorded set";
    })
    .join(" · ");
  const assistance = Array.from(
    new Set(
      point.sets
        .map((set) => [set.assistanceType, set.assistanceDetail].filter(Boolean).join(" · "))
        .filter(Boolean),
    ),
  ).join(" / ");
  return [work, assistance ? `Assistance: ${assistance}` : ""].filter(Boolean).join(" · ");
}

function profileSessionSummary(point: ExerciseSessionPoint, profile: MetricProfile) {
  if (profile === "weighted" || profile === "reps" || profile === "hold" || profile === "grip") {
    return setSummary(point) || "No set detail";
  }
  if (profile === "time") {
    return `${formatDistance(point.totalDistanceKm)} · ${formatMinutes(activityMinutes(point))} · ${formatPace(paceMinutesPerKm(point))}`;
  }
  if (profile === "duration")
    return `${formatMinutes(activityMinutes(point))} · RPE ${point.averageRpe ?? "—"}`;
  if (profile === "conditioning") {
    return `${formatNumber(point.rounds, " rounds")} · ${formatMinutes(activityMinutes(point))} · ${formatNumber(densityRoundsPerMinute(point), " rounds/min")}`;
  }
  if (profile === "carry") {
    return `${formatDistance(point.totalDistanceKm)} · ${formatKg(point.maxWeight)} · ${formatMinutes(activityMinutes(point))}`;
  }
  if (profile === "mobility_position") {
    const position = point.sets.find((set) => set.distance != null);
    return `${formatNumber(position?.distance ?? null, position?.distanceUnit ? ` ${position.distanceUnit}` : "")} · ${formatSeconds(bestHold([point]))} hold · ${formatNumber(point.feel, "/5")} feel`;
  }
  if (profile === "power") {
    return `${formatNumber(point.heightCm, " cm")} · ${formatNumber(point.totalReps, " jumps")} · RPE ${point.averageRpe ?? "—"}`;
  }
  if (profile === "climbing") {
    return `${formatMinutes(activityMinutes(point))} · ${formatNumber(point.problems, " problems/routes")} · ${point.grade ?? "No grade"}${point.gradient ? ` @ ${point.gradient}` : ""}`;
  }
  return setSummary(point) || "Recorded session";
}

function positionMeasurementSummary(point: ExerciseSessionPoint) {
  if (point.positionMeasurementCm == null) return "";
  return `${point.positionMeasurementCm} cm${
    point.positionMeasurementSetup ? ` · ${point.positionMeasurementSetup}` : ""
  }`;
}

function historyMetricLabels(profile: MetricProfile): [string, string] {
  if (profile === "weighted") return ["Volume", "Est. 1RM"];
  if (profile === "reps") return ["Total reps", "Best set"];
  if (profile === "hold") return ["Total hold", "Best hold"];
  if (profile === "grip") return ["Best hold", "Top load"];
  if (profile === "time") return ["Distance", "Pace"];
  if (profile === "duration") return ["Duration", "RPE"];
  if (profile === "conditioning") return ["Rounds", "Density"];
  if (profile === "carry") return ["Distance", "Top load"];
  if (profile === "mobility_position") return ["Hold", "Feel"];
  if (profile === "power") return ["Height", "Jumps"];
  if (profile === "climbing") return ["Problems/routes", "Duration"];
  return ["Duration", "RPE"];
}

function historyMetricValues(
  point: ExerciseSessionPoint,
  profile: MetricProfile,
): [string, string] {
  if (profile === "weighted") {
    return [`${Math.round(point.totalVolume).toLocaleString()} kg`, formatKg(point.est1RM, 1)];
  }
  if (profile === "reps")
    return [formatNumber(point.totalReps), formatNumber(bestSetReps([point]))];
  if (profile === "hold")
    return [formatSeconds(totalHoldSeconds([point])), formatSeconds(bestHold([point]))];
  if (profile === "grip") return [formatSeconds(bestHold([point])), formatKg(point.maxWeight)];
  if (profile === "time")
    return [formatDistance(point.totalDistanceKm), formatPace(paceMinutesPerKm(point))];
  if (profile === "duration")
    return [formatMinutes(activityMinutes(point)), formatNumber(point.averageRpe)];
  if (profile === "conditioning")
    return [formatNumber(point.rounds), formatNumber(densityRoundsPerMinute(point))];
  if (profile === "carry")
    return [formatDistance(point.totalDistanceKm), formatKg(point.maxWeight)];
  if (profile === "mobility_position")
    return [formatSeconds(bestHold([point])), formatNumber(point.feel, "/5")];
  if (profile === "power")
    return [formatNumber(point.heightCm, " cm"), formatNumber(point.totalReps)];
  if (profile === "climbing")
    return [formatNumber(point.problems), formatMinutes(activityMinutes(point))];
  return [formatMinutes(activityMinutes(point)), formatNumber(point.averageRpe)];
}

function SetHistory({
  points,
  onSelectSession,
  profile,
}: {
  points: ExerciseSessionPoint[];
  onSelectSession: (sessionId: string) => void;
  profile: MetricProfile;
}) {
  const recent = [...points].reverse();
  const [primaryLabel, secondaryLabel] = historyMetricLabels(profile);
  const showMethods = profile === "weighted" || profile === "reps";
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm">Exact session history</CardTitle>
        <p className="text-xs text-muted-foreground">
          {profile === "weighted" || profile === "reps" || profile === "hold" || profile === "grip"
            ? "New logs show each set; older aggregate logs remain labelled as totals."
            : "Session detail and comparison columns follow this exercise's tracking mode."}
        </p>
      </CardHeader>
      <CardContent className="p-0 sm:p-4 sm:pt-0">
        <div className="space-y-2 p-3 sm:hidden">
          {recent.map((point) => (
            <button
              type="button"
              key={point.sessionId}
              onClick={() => onSelectSession(point.sessionId)}
              className="w-full rounded-lg border border-border bg-secondary/20 p-3 text-left transition hover:bg-secondary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{formatUKDate(point.date)}</span>
                <span className="text-xs capitalize text-muted-foreground">
                  {point.locationName ?? "Location not logged"}
                </span>
              </div>
              {showMethods ? (
                <div className="mt-2">
                  <MethodBadges methods={point.methods} />
                </div>
              ) : null}
              <p className="mt-2 text-sm">{profileSessionSummary(point, profile)}</p>
              {positionMeasurementSummary(point) ? (
                <p className="mt-1 text-xs text-amber-200">
                  Position: {positionMeasurementSummary(point)}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                {primaryLabel}: {historyMetricValues(point, profile)[0]} · {secondaryLabel}:{" "}
                {historyMetricValues(point, profile)[1]}
              </p>
            </button>
          ))}
        </div>
        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Location</TableHead>
                {showMethods ? <TableHead>Method</TableHead> : null}
                <TableHead>Session detail</TableHead>
                <TableHead className="text-right">{primaryLabel}</TableHead>
                <TableHead className="text-right">{secondaryLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((point) => (
                <TableRow
                  key={point.sessionId}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectSession(point.sessionId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectSession(point.sessionId);
                    }
                  }}
                  className="cursor-pointer transition hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <TableCell className="whitespace-nowrap font-medium">
                    {formatUKDate(point.date)}
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">
                    {point.locationName ?? "—"}
                  </TableCell>
                  {showMethods ? (
                    <TableCell>
                      <MethodBadges methods={point.methods} />
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <div>{profileSessionSummary(point, profile)}</div>
                    {positionMeasurementSummary(point) ? (
                      <div className="mt-1 text-xs text-amber-200">
                        Position: {positionMeasurementSummary(point)}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {historyMetricValues(point, profile)[0]}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {historyMetricValues(point, profile)[1]}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
