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
  PlannedActualSet,
  PlannedActualStatus,
} from "@/lib/planned-actual";
import { getLibraryClient } from "@/lib/supabase-log.browser";
import type { ExerciseMethodUse, ExerciseSessionPoint, LibraryRow } from "@/lib/training-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "Exercise Progress · Training Admin" },
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

function formatKg(value: number | null, decimals = 0) {
  if (value == null) return "—";
  return `${value.toFixed(decimals)} kg`;
}

function formatChange(value: number | null) {
  if (value == null) return "No prior comparison";
  return `${value > 0 ? "+" : ""}${value}% vs prior period`;
}

function ProgressPage() {
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
        loggedIds.has(exercise.id) || loggedNames.has(exercise.name.trim().toLowerCase()),
    );
  }, [library.data?.exercises, loggedExercises.data]);
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
    const bench = locationExercises.find(
      (exercise) => exercise.name.toLowerCase() === "bench press",
    );
    setExerciseId((bench ?? locationExercises[0])?.id ?? "");
  }, [exerciseId, locationExercises]);

  const exercise = exercises.find((item) => item.id === exerciseId) ?? null;
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
    const current = periodPoints.filter((point) => matchesMethod(point, methodFilter));
    const previous =
      windowMs == null
        ? []
        : locationPoints.filter((point) => {
            const time = dateTime(point.date);
            return (
              time >= now - 2 * windowMs &&
              time < now - windowMs &&
              matchesMethod(point, methodFilter)
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

    return {
      current,
      previous,
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
      methodBreakdown: methodBreakdown(periodPoints),
    };
  }, [history.data, location, methodFilter, period]);

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
        (methodFilter === "all" || Boolean(point && matchesMethod(point, methodFilter)))
      );
    });
  }, [history.data?.points, location, methodFilter, period, plannedActual.data]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Exercise Progress</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare load, strength, volume and training method before deciding what to do next.
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
          <DecisionCard decision={decision} exerciseName={exercise?.name ?? "This exercise"} />

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={<Dumbbell className="h-4 w-4" />}
              label="Sessions"
              value={String(analysis.current.length)}
              detail={location === "all" ? "All locations" : location}
            />
            <StatCard
              icon={<Scale className="h-4 w-4" />}
              label="Top weight"
              value={formatKg(analysis.maxWeight)}
              detail="Heaviest working set"
            />
            <StatCard
              icon={<Gauge className="h-4 w-4" />}
              label="Best est. 1RM"
              value={formatKg(analysis.currentBest, 1)}
              detail={formatChange(analysis.performanceChange)}
              change={analysis.performanceChange}
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Avg weekly volume"
              value={formatKg(analysis.averageWeeklyVolume)}
              detail={formatChange(analysis.volumeChange)}
              change={analysis.volumeChange}
            />
          </section>

          <MethodComparison summaries={analysis.methodBreakdown} />

          <PlannedActualHistory
            comparisons={visibleComparisons}
            isLoading={plannedActual.isLoading}
            hasError={Boolean(plannedActual.error)}
            onSelectSession={setSelectedSessionId}
          />

          <section className="grid gap-4 xl:grid-cols-2">
            <PerformanceChart points={analysis.current} onSelectSession={setSelectedSessionId} />
            <VolumeChart data={analysis.weeklyVolume} />
          </section>

          <SetHistory points={analysis.current} onSelectSession={setSelectedSessionId} />
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
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        status.className,
                      )}
                    >
                      {status.label}
                    </span>
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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  change?: number | null;
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
            change != null && change > 0 && "text-emerald-400",
            change != null && change < 0 && "text-amber-400",
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

function setSummary(point: ExerciseSessionPoint) {
  return point.sets
    .map((set) => {
      if (set.aggregateSets != null) {
        return `${set.aggregateSets} sets · ${set.reps ?? "—"} total${set.weight != null ? ` @ ${set.weight}kg` : ""}${set.rpe != null ? ` · RPE ${set.rpe}` : ""}`;
      }
      if (set.weight != null && set.reps != null)
        return `${set.weight}×${set.reps}${set.rpe != null ? ` @${set.rpe}` : ""}`;
      if (set.reps != null) return `${set.reps} reps${set.rpe != null ? ` @${set.rpe}` : ""}`;
      return "Recorded set";
    })
    .join(" · ");
}

function SetHistory({
  points,
  onSelectSession,
}: {
  points: ExerciseSessionPoint[];
  onSelectSession: (sessionId: string) => void;
}) {
  const recent = [...points].reverse();
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm">Exact session history</CardTitle>
        <p className="text-xs text-muted-foreground">
          New logs show each set; older aggregate logs remain labelled as totals.
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
              <div className="mt-2">
                <MethodBadges methods={point.methods} />
              </div>
              <p className="mt-2 text-sm">{setSummary(point) || "No set detail"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {Math.round(point.totalVolume).toLocaleString()} kg volume ·{" "}
                {formatKg(point.est1RM, 1)} est. 1RM
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
                <TableHead>Method</TableHead>
                <TableHead>Sets</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="text-right">Est. 1RM</TableHead>
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
                  <TableCell>
                    <MethodBadges methods={point.methods} />
                  </TableCell>
                  <TableCell>{setSummary(point) || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Math.round(point.totalVolume).toLocaleString()} kg
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatKg(point.est1RM, 1)}
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
