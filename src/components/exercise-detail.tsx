import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ExerciseHistory, LibraryRow } from "@/lib/training-types";
import { getExerciseHistoryClient } from "@/lib/supabase-history.browser";
import { formatUKDateShort } from "@/lib/date";
import { cn } from "@/lib/utils";

type MetricKey = "est1RM" | "volume" | "maxWeight" | "reps" | "duration";

const METRIC_LABEL: Record<MetricKey, string> = {
  est1RM: "Est. 1RM",
  volume: "Volume",
  maxWeight: "Max weight",
  reps: "Total reps",
  duration: "Duration",
};

const METRIC_UNIT: Record<MetricKey, string> = {
  est1RM: "kg",
  volume: "kg",
  maxWeight: "kg",
  reps: "",
  duration: "m",
};

export function ExerciseDetail({
  exercise,
  onClose,
}: {
  exercise: LibraryRow & { id?: string };
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ["exercise-history", exercise.id ?? exercise.name],
    queryFn: () => getExerciseHistoryClient({ id: exercise.id, name: exercise.name }),
    staleTime: 60_000,
  });

  const available = q.data?.available;
  const defaultMetric: MetricKey = useMemo(() => {
    if (!available) return "maxWeight";
    if (available.weight) return "maxWeight";
    if (available.volume) return "volume";
    if (available.reps) return "reps";
    if (available.duration) return "duration";
    if (available.est1RM) return "est1RM";
    return "maxWeight";
  }, [available]);

  const [metric, setMetric] = useState<MetricKey>(defaultMetric);

  useEffect(() => {
    if (available) setMetric(defaultMetric);
  }, [available, defaultMetric, exercise.id, exercise.name]);

  const chartData = useMemo(() => {
    if (!q.data) return [] as { label: string; value: number }[];
    return q.data.points
      .map((p) => {
        const value =
          metric === "est1RM"
            ? p.est1RM
            : metric === "volume"
              ? p.totalVolume
              : metric === "maxWeight"
                ? p.maxWeight
                : metric === "reps"
                  ? p.totalReps
                  : p.totalDuration;
        return value != null && Number.isFinite(value) && value > 0
          ? { label: formatUKDateShort(p.date), value }
          : null;
      })
      .filter((v): v is { label: string; value: number } => v != null);
  }, [q.data, metric]);

  return (
    <div className="flex h-full flex-col bg-[oklch(0.19_0.024_210)]">
      <header className="flex items-start gap-3 border-b border-sky-400/20 bg-sky-400/5 p-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{exercise.name}</h2>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
            {exercise.workoutType && (
              <span className="rounded-full bg-secondary px-2 py-0.5 uppercase tracking-wider text-secondary-foreground">
                {exercise.workoutType}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {[exercise.equipment, exercise.metric].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex-1 overflow-auto bg-sky-400/[0.025] p-4">
        {q.isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading history…
          </div>
        ) : q.error ? (
          <p className="text-sm text-destructive">Couldn't load history.</p>
        ) : !q.data || q.data.points.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No completed log rows for this exercise yet.
          </p>
        ) : (
          <div className="space-y-4">
            <StatGrid data={q.data} />

            <div className="flex flex-wrap gap-1">
              {(Object.keys(METRIC_LABEL) as MetricKey[]).map((k) => {
                const enabled =
                  (k === "est1RM" && available?.est1RM) ||
                  (k === "volume" && available?.volume) ||
                  (k === "maxWeight" && available?.weight) ||
                  (k === "reps" && available?.reps) ||
                  (k === "duration" && available?.duration);
                return (
                  <button
                    key={k}
                    disabled={!enabled}
                    onClick={() => setMetric(k)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-medium transition",
                      metric === k
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
                      !enabled && "cursor-not-allowed opacity-40",
                    )}
                  >
                    {METRIC_LABEL[k]}
                  </button>
                );
              })}
            </div>

            <div className="rounded-md border border-sky-400/25 bg-sky-400/[0.06] p-2 shadow-inner">
              {chartData.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  No data for {METRIC_LABEL[metric]}.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="exFill" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="var(--color-chart-1)"
                          stopOpacity={0.5}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--color-chart-1)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="var(--color-border)"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
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
                      width={30}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "var(--color-popover-foreground)",
                      }}
                      formatter={(v: number) => [
                        `${v}${METRIC_UNIT[metric]}`,
                        METRIC_LABEL[metric],
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="var(--color-chart-1)"
                      fill="url(#exFill)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <HistoryList data={q.data} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatGrid({
  data,
}: {
  data: ExerciseHistory;
}) {
  const fmt = (n: number | null, unit = "") =>
    n == null ? "—" : `${Math.round(n * 10) / 10}${unit}`;
  const change = data.stats.fourWeekChange;
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat label="Sessions" value={data.totalSessions.toString()} />
      <Stat label="Max weight" value={fmt(data.stats.maxWeight, "kg")} />
      <Stat label="Best est. 1RM" value={fmt(data.stats.best1RM, "kg")} />
      <Stat
        label="4-week change"
        value={
          change == null ? "—" : `${change > 0 ? "+" : ""}${change}%`
        }
      />
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-sky-400/20 bg-sky-400/[0.07] px-2.5 py-2">
      <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
    </div>
  );
}

function HistoryList({
  data,
}: {
  data: ExerciseHistory;
}) {
  const rows = [...data.points].reverse().slice(0, 12);
  return (
    <div className="rounded-md border border-sky-400/20 bg-sky-400/[0.05] p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-sky-200/80">
        Recent sessions
      </h3>
      <ul className="space-y-1">
        {rows.map((p) => (
          <li
            key={p.date}
            className="flex items-center gap-2 rounded-md border border-sky-400/15 bg-background/35 px-2.5 py-1.5 text-xs"
          >
            <span className="w-16 shrink-0 font-medium">
              {formatUKDateShort(p.date)}
            </span>
            <span className="flex-1 truncate text-muted-foreground">
              {[
                p.maxWeight != null ? `${p.maxWeight}kg max` : null,
                p.totalReps > 0 ? `${p.totalReps} total reps` : null,
                p.totalVolume > 0 ? `${p.totalVolume}kg vol` : null,
                p.totalDuration > 0 ? `${p.totalDuration}m` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "—"}
            </span>
            {p.est1RM != null && (
              <span
                className="shrink-0 font-semibold text-primary"
                title="Estimated 1RM (reps per set inferred from Reps / Sets)"
              >
                ~{p.est1RM}kg
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Type helper so StatGrid/HistoryList can infer data shape without re-import.
