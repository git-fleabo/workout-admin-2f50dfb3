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
  Check,
  ChevronsUpDown,
  Dumbbell,
  Gauge,
  Loader2,
  MapPin,
  Scale,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { getExerciseHistoryClient } from "@/lib/supabase-history.browser";
import { getLibraryClient } from "@/lib/supabase-log.browser";
import type { ExerciseSessionPoint, LibraryRow } from "@/lib/training-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "Exercise Progress · Training Admin" },
      {
        name: "description",
        content: "Review exercise load, estimated strength and training volume over time.",
      },
    ],
  }),
  component: ProgressPage,
});

type Period = 4 | 8 | 12 | 26 | "all";
type LocationFilter = "all" | "home" | "gym";
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
  const exercises = useMemo(
    () => (library.data?.exercises ?? []) as ExerciseOption[],
    [library.data?.exercises],
  );
  const [exerciseId, setExerciseId] = useState("");
  const [period, setPeriod] = useState<Period>(8);
  const [location, setLocation] = useState<LocationFilter>("all");
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

  const analysis = useMemo(() => {
    const locationPoints = (history.data?.points ?? []).filter(
      (point) => location === "all" || point.locationKind === location,
    );
    const today = new Date();
    const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const windowMs = period === "all" ? null : period * 7 * DAY_MS;
    const current = locationPoints.filter(
      (point) => windowMs == null || dateTime(point.date) >= now - windowMs,
    );
    const previous =
      windowMs == null
        ? []
        : locationPoints.filter((point) => {
            const time = dateTime(point.date);
            return time >= now - 2 * windowMs && time < now - windowMs;
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
    };
  }, [history.data, location, period]);

  const signal = useMemo(() => {
    if (analysis.current.length < 2 || analysis.performanceChange == null) {
      return {
        label: "Building a baseline",
        detail: "Log a few sessions in consecutive periods to make the comparison useful.",
        className: "border-sky-400/25 bg-sky-400/[0.06] text-sky-200",
      };
    }
    if (analysis.performanceChange <= -2 && (analysis.volumeChange ?? 0) >= 10) {
      return {
        label: "Review recovery",
        detail:
          "Performance is lower while volume is higher. Check effort, sleep and soreness before adding load.",
        className: "border-amber-400/25 bg-amber-400/[0.06] text-amber-200",
      };
    }
    if (analysis.performanceChange >= 2) {
      return {
        label: "Performance is moving up",
        detail: "Your best estimated performance improved versus the previous equivalent period.",
        className: "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-200",
      };
    }
    return {
      label: "Holding steady",
      detail:
        "Performance is broadly stable. Use the exact sets below to judge rep comfort and effort.",
      className: "border-violet-400/25 bg-violet-400/[0.06] text-violet-200",
    };
  }, [analysis]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Exercise Progress</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare load, estimated strength and volume before deciding what to do next.
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

      {library.isLoading || history.isLoading || (!exercise && exercises.length > 0) ? (
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading progress…
        </div>
      ) : library.error || history.error ? (
        <Card className="border-destructive/40">
          <CardContent className="p-6 text-sm text-destructive">
            Progress could not be loaded. Please refresh and try again.
          </CardContent>
        </Card>
      ) : exercises.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Add an exercise to your library before reviewing progress.
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

          <div className={cn("rounded-xl border p-4", signal.className)}>
            <p className="text-sm font-semibold">{signal.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{signal.detail}</p>
          </div>

          <section className="grid gap-4 xl:grid-cols-2">
            <PerformanceChart points={analysis.current} />
            <VolumeChart data={analysis.weeklyVolume} />
          </section>

          <SetHistory points={analysis.current} />
        </>
      )}
    </div>
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

function PerformanceChart({ points }: { points: ExerciseSessionPoint[] }) {
  const data = points.map((point) => ({
    label: formatUKDateShort(point.date),
    weight: point.maxWeight,
    estimated: point.est1RM,
  }));
  return (
    <ChartCard title="Performance" subtitle="Top working weight and Epley estimated 1RM">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
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

function SetHistory({ points }: { points: ExerciseSessionPoint[] }) {
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
            <div
              key={point.sessionId}
              className="rounded-lg border border-border bg-secondary/20 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{formatUKDate(point.date)}</span>
                <span className="text-xs capitalize text-muted-foreground">
                  {point.locationName ?? "Location not logged"}
                </span>
              </div>
              <p className="mt-2 text-sm">{setSummary(point) || "No set detail"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {Math.round(point.totalVolume).toLocaleString()} kg volume ·{" "}
                {formatKg(point.est1RM, 1)} est. 1RM
              </p>
            </div>
          ))}
        </div>
        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Sets</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="text-right">Est. 1RM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((point) => (
                <TableRow key={point.sessionId}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {formatUKDate(point.date)}
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">
                    {point.locationName ?? "—"}
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
