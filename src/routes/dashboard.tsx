import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Award,
  CalendarRange,
  Clock,
  Dumbbell,
  Loader2,
  Mountain,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUKDate, formatUKDateShort, todayISO } from "@/lib/date";
import { getDashboardDataClient, type DashboardData } from "@/lib/supabase-dashboard.browser";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Training Tracker" },
      {
        name: "description",
        content:
          "Weekly snapshot, calendar, climbing and strength panels, monthly summary and long-term trend.",
      },
    ],
  }),
  component: DashboardPage,
});

type Data = DashboardData;

const DEFAULT_WEEKLY_GOAL = 4;
const DEFAULT_MINUTE_GOAL = 180;

const fmt = (v: number | null | undefined, suffix = "") =>
  v == null || (typeof v === "number" && !Number.isFinite(v)) ? "—" : `${v}${suffix}`;

function DashboardPage() {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboardDataClient(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading dashboard…
      </div>
    );
  }

  if (error || !data) {
    const message =
      error instanceof Error ? error.message : "Check the Supabase connection and try again.";
    return (
      <Card className="p-6 text-sm text-destructive">Couldn’t load the dashboard. {message}</Card>
    );
  }

  const weekStartLabel = formatUKDate(data.thisWeekStart);
  const bwDelta = data.trend.bodyweightDelta;
  const TrendIcon = bwDelta == null ? Activity : bwDelta < 0 ? TrendingDown : TrendingUp;
  const weeklyGoal = data.goals?.weeklyWorkouts ?? DEFAULT_WEEKLY_GOAL;
  const minuteGoal = data.goals?.weeklyMinutes ?? DEFAULT_MINUTE_GOAL;
  const weeklyGoalPct = percentage(data.kpis.workoutsThisWeek, weeklyGoal);
  const minuteGoalPct = percentage(data.kpis.minutesThisWeek, minuteGoal);

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {data.kpis.workoutsThisWeek} workouts · {Math.round(data.kpis.minutesThisWeek || 0)} min
            · {data.kpis.activeDaysThisWeek} active days this week
          </p>
        </div>
        <div className="flex items-center gap-2 text-right text-xs text-muted-foreground">
          <span>
            Week starting <span className="text-foreground">{weekStartLabel}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh dashboard"
            title="Refresh dashboard"
            className="h-8 px-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      {/* Top status row */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatusTile
          icon={<CalendarRange className="h-3.5 w-3.5" />}
          label="Week starting"
          value={formatUKDateShort(data.thisWeekStart)}
          accent="primary"
        />
        <StatusTile
          icon={<Target className="h-3.5 w-3.5" />}
          label="Weekly goal"
          value={`${data.kpis.workoutsThisWeek}/${weeklyGoal}`}
          hint="workouts"
          accent="primary"
          progressPct={weeklyGoalPct}
        />
        <StatusTile
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Minute goal"
          value={`${Math.round(data.kpis.minutesThisWeek || 0)}/${minuteGoal}`}
          hint="min"
          accent="amber"
          progressPct={minuteGoalPct}
        />
        <StatusTile
          icon={<TrendIcon className="h-3.5 w-3.5" />}
          label="Trend since start"
          value={bwDelta == null ? "—" : `${bwDelta > 0 ? "+" : ""}${bwDelta}kg`}
          hint={`${data.trend.weeksTraining || 0}w training`}
          accent="primary"
        />
      </section>

      {/* Weekly snapshot + Calendar */}
      <section className="grid gap-4 lg:grid-cols-3">
        <WeeklySnapshot data={data} />
        <div className="lg:col-span-2">
          <WeekCalendar data={data} />
        </div>
      </section>

      {/* Climbing + Strength */}
      <section className="grid gap-4 lg:grid-cols-2">
        <ClimbingSummary data={data} />
        <StrengthSnapshot data={data} />
      </section>

      {/* Monthly summary + Recent PRs */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MonthlySummary data={data} />
        </div>
        <RecentPRs data={data} />
      </section>

      {/* Trend since start */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrendChart data={data} />
        </div>
        <TrendSummary data={data} />
      </section>
    </div>
  );
}

/* ---------------- Panels ---------------- */

type Accent = "primary" | "amber" | "rose";

const ACCENTS: Record<
  Accent,
  { card: string; icon: string; title: string; tile: string; tileIcon: string }
> = {
  primary: {
    card: "border-primary/30 bg-gradient-to-br from-primary/[0.07] to-transparent",
    icon: "text-primary",
    title: "text-primary",
    tile: "border-primary/30 bg-primary/[0.06]",
    tileIcon: "text-primary",
  },
  amber: {
    card: "border-amber-500/30 bg-gradient-to-br from-amber-500/[0.07] to-transparent",
    icon: "text-amber-400",
    title: "text-amber-200",
    tile: "border-amber-500/30 bg-amber-500/[0.06]",
    tileIcon: "text-amber-400",
  },
  rose: {
    card: "border-rose-500/30 bg-gradient-to-br from-rose-500/[0.07] to-transparent",
    icon: "text-rose-400",
    title: "text-rose-200",
    tile: "border-rose-500/30 bg-rose-500/[0.06]",
    tileIcon: "text-rose-400",
  },
};

function Panel({
  title,
  icon,
  action,
  children,
  className = "",
  accent,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  accent?: Accent;
}) {
  const a = accent ? ACCENTS[accent] : null;
  return (
    <Card className={`p-4 ${a ? a.card : "border-border bg-card"} ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        {icon && <span className={a ? a.icon : "text-muted-foreground"}>{icon}</span>}
        <h2 className={`text-sm font-semibold ${a ? a.title : ""}`}>{title}</h2>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </Card>
  );
}

function StatusTile({
  icon,
  label,
  value,
  hint,
  accent,
  progressPct,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: Accent;
  progressPct?: number;
}) {
  const a = accent ? ACCENTS[accent] : null;
  return (
    <Card className={`px-3 py-2.5 ${a ? a.tile : "border-border bg-card"}`}>
      <div
        className={`flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider ${
          a ? a.tileIcon : "text-muted-foreground"
        }`}
      >
        {icon}
        <span className="truncate">{label}</span>
      </div>
      {progressPct == null ? (
        <div className="mt-1 flex items-baseline gap-1.5">
          <p className="text-lg font-semibold leading-none">{value}</p>
          {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
        </div>
      ) : (
        <div className="mt-1.5 flex items-center gap-2.5">
          <ProgressRing pct={progressPct} />
          <div className="min-w-0">
            <p className="text-base font-semibold leading-none">{value}</p>
            {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
          </div>
        </div>
      )}
    </Card>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div className="relative h-11 w-11 shrink-0">
      <svg className="h-11 w-11 -rotate-90" viewBox="0 0 44 44" aria-hidden="true">
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke="var(--color-secondary)"
          strokeWidth="3.5"
        />
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-primary">
        {pct}%
      </span>
    </div>
  );
}

function WeeklySnapshot({ data }: { data: Data }) {
  const weeklyGoal = data.goals?.weeklyWorkouts ?? DEFAULT_WEEKLY_GOAL;
  const pct = percentage(data.kpis.workoutsThisWeek || 0, weeklyGoal);
  return (
    <Panel title="Weekly Snapshot" icon={<Activity className="h-4 w-4" />} accent="primary">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Stat label="Workouts" value={data.kpis.workoutsThisWeek.toString()} />
        <Stat label="Minutes" value={fmt(Math.round(data.kpis.minutesThisWeek || 0))} />
        <Stat label="Active days" value={`${data.kpis.activeDaysThisWeek}/7`} />
        <Stat label="Goal" value={`${weeklyGoal} workouts`} />
      </dl>
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {data.kpis.workoutsThisWeek} of {weeklyGoal} workouts
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full shadow-[0_0_10px_oklch(0.86_0.19_130/0.4)] transition-all"
            style={{ width: `${pct}%`, backgroundImage: "var(--gradient-primary)" }}
          />
        </div>
      </div>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border/40 py-1.5 last:border-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function WeekCalendar({ data }: { data: Data }) {
  const [openDate, setOpenDate] = React.useState<string | null>(null);
  const openDay = openDate ? (data.weekDays.find((d) => d.date === openDate) ?? null) : null;
  const today = todayISO();

  return (
    <Panel title="This Week" icon={<CalendarRange className="h-4 w-4" />} accent="primary">
      <div className="grid grid-cols-7 gap-1.5">
        {data.weekDays.map((d) => {
          const credited = d.workouts > 0;
          const logged = d.exercises.length > 0;
          const climbingOnly =
            !credited && d.entries.some((entry) => entry.activityLabel === "Climbing");
          const future = d.date > today;
          const interactive = logged || credited;
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => interactive && setOpenDate(d.date)}
              disabled={!interactive}
              className={`flex min-h-[110px] flex-col rounded-md border p-2 text-center transition ${
                d.isToday ? "border-primary/60 bg-primary/5" : "border-border bg-secondary/20"
              } ${interactive ? "cursor-pointer hover:border-primary/50 hover:bg-primary/5" : "cursor-default"} ${
                future ? "opacity-40" : ""
              }`}
            >
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {d.label}
              </div>
              <div className="mt-0.5 text-lg font-bold leading-none">
                {Number(d.date.slice(8, 10))}
              </div>
              <div
                className={`mx-auto mt-1 h-2 w-2 rounded-full ${
                  credited ? "bg-primary" : climbingOnly ? "bg-amber-400" : "bg-border"
                }`}
              />
              <div
                className={`mt-1 text-[11px] font-medium ${
                  credited ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {credited
                  ? `${d.workouts}× · ${Math.round(d.minutes)}m`
                  : logged
                    ? `${Math.round(d.minutes)}m`
                    : "Rest"}
              </div>
              {logged && (
                <ul className="mt-1 space-y-0.5 text-left text-[10px] leading-tight text-muted-foreground">
                  {d.exercises.slice(0, 4).map((ex) => (
                    <li key={ex} className="truncate" title={ex}>
                      · {ex}
                    </li>
                  ))}
                  {d.exercises.length > 4 && (
                    <li className="text-muted-foreground/70">+{d.exercises.length - 4} more</li>
                  )}
                </ul>
              )}
            </button>
          );
        })}
      </div>

      <Dialog open={openDay != null} onOpenChange={(v: boolean) => !v && setOpenDate(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden">
          {openDay && (
            <>
              <DialogHeader>
                <DialogTitle>{formatUKDate(openDay.date)}</DialogTitle>
                <DialogDescription>
                  {openDay.workouts > 0
                    ? `${openDay.workouts} workout${openDay.workouts === 1 ? "" : "s"} · ${Math.round(openDay.minutes)} min`
                    : openDay.entries.length > 0
                      ? `${Math.round(openDay.minutes)} min logged`
                      : "Rest day"}
                </DialogDescription>
              </DialogHeader>
              {openDay.entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing logged for this day.</p>
              ) : (
                <ul className="max-h-[68vh] space-y-3 overflow-y-auto pr-1">
                  {openDay.entries.map((e, i) => (
                    <li
                      key={`${e.exercise}-${i}`}
                      className="rounded-lg border border-border/60 bg-secondary/20 p-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{e.exercise}</p>
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            {e.activityLabel}
                            {!e.counts && e.activityLabel !== "Climbing" ? " · no credit" : ""}
                          </p>
                        </div>
                      </div>
                      {e.details.length ? (
                        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                          {e.details.map((detail) => (
                            <Detail
                              key={`${detail.label}-${detail.value}`}
                              label={detail.label}
                              value={detail.value}
                            />
                          ))}
                        </dl>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          No performance details were recorded.
                        </p>
                      )}
                      {e.notes && (
                        <p className="mt-3 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                          {e.notes}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/40 bg-background/40 px-2 py-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function ClimbingSummary({ data }: { data: Data }) {
  const c = data.climbing;
  return (
    <Panel title="Climbing Summary" icon={<Mountain className="h-4 w-4" />} accent="amber">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <Stat label="Sessions" value={fmt(c.sessionsThisMonth)} />
        <Stat label="Hours" value={fmt(c.hoursThisMonth, "h")} />
        <Stat label="Boulders" value={fmt(c.bouldersThisMonth)} />
        <Stat label="Latest grade" value={c.latestClimb?.grade || "—"} />
      </dl>
      <div className="mt-3 rounded-md border border-border/60 bg-secondary/20 p-2.5 text-xs text-muted-foreground">
        {c.latestClimb ? (
          <>
            Last climb:{" "}
            <span className="text-foreground">
              {c.latestClimb.name || c.latestClimb.grade || "Session"}
            </span>{" "}
            · {formatUKDate(c.latestClimb.date)}
          </>
        ) : (
          "No climbing logged yet."
        )}
      </div>
    </Panel>
  );
}

function StrengthSnapshot({ data }: { data: Data }) {
  const s = data.strength;
  return (
    <Panel title="Strength Snapshot" icon={<Dumbbell className="h-4 w-4" />} accent="rose">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <Stat label="Best 1RM" value={s.bestLift ? `${s.bestLift.value}kg` : "—"} />
        <Stat label="Latest test" value={s.latestTest ? `${s.latestTest.value}kg` : "—"} />
        <Stat label="Exercises" value={s.exercisesTracked.toString()} />
      </dl>
      <div className="mt-3 space-y-1.5 text-xs">
        {s.bestLift && (
          <div className="flex items-center justify-between rounded-md border border-border/60 bg-secondary/20 px-2.5 py-1.5">
            <span className="truncate">
              <span className="text-muted-foreground">Best:</span>{" "}
              <span className="text-foreground">{s.bestLift.name}</span>
            </span>
            <span className="text-muted-foreground">{formatUKDateShort(s.bestLift.date)}</span>
          </div>
        )}
        {s.latestTest && (
          <div className="flex items-center justify-between rounded-md border border-border/60 bg-secondary/20 px-2.5 py-1.5">
            <span className="truncate">
              <span className="text-muted-foreground">Latest:</span>{" "}
              <span className="text-foreground">{s.latestTest.name}</span>
            </span>
            <span className="text-muted-foreground">{formatUKDateShort(s.latestTest.date)}</span>
          </div>
        )}
        {!s.bestLift && !s.latestTest && (
          <p className="text-muted-foreground">No 1RM tests logged yet.</p>
        )}
      </div>
    </Panel>
  );
}

function MonthlySummary({ data }: { data: Data }) {
  const maxWorkouts = Math.max(1, ...data.monthlySummary.map((month) => month.workouts || 0));

  return (
    <Panel title="Monthly Summary" icon={<CalendarRange className="h-4 w-4" />} accent="primary">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-8">Month</TableHead>
            <TableHead className="h-8 text-right">Workouts</TableHead>
            <TableHead className="h-8 text-right">Minutes</TableHead>
            <TableHead className="h-8 text-right">Climb sess.</TableHead>
            <TableHead className="h-8 text-right">Climb hrs</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.monthlySummary.map((m) => (
            <TableRow key={m.monthStart}>
              <TableCell className="py-1.5 font-medium">{m.label}</TableCell>
              <TableCell className="py-1.5">
                <div className="flex min-w-24 items-center gap-2">
                  <div className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.min(100, ((m.workouts || 0) / maxWorkouts) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="w-5 text-right">{m.workouts || "—"}</span>
                </div>
              </TableCell>
              <TableCell className="py-1.5 text-right">
                {m.minutes ? Math.round(m.minutes) : "—"}
              </TableCell>
              <TableCell className="py-1.5 text-right">{m.climbSessions || "—"}</TableCell>
              <TableCell className="py-1.5 text-right">
                {m.climbHours ? m.climbHours.toFixed(1) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

function RecentPRs({ data }: { data: Data }) {
  const items = data.recentPRs.filter((i) => i.title);
  return (
    <Panel
      title="Recent PRs"
      icon={<Award className="h-4 w-4" />}
      accent="amber"
      action={<span className="text-xs text-muted-foreground">{data.kpis.totalPRs} tracked</span>}
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No PRs logged yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.slice(0, 6).map((pr, i) => (
            <li
              key={`${pr.title}-${i}`}
              className="flex items-center gap-2.5 rounded-md border border-border/60 bg-secondary/20 px-2.5 py-1.5"
            >
              <span className="text-muted-foreground">
                {pr.kind === "1rm" ? (
                  <Trophy className="h-3.5 w-3.5" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{pr.title}</span>
              <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                {pr.value}
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {pr.date ? formatUKDateShort(pr.date) : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function TrendChart({ data }: { data: Data }) {
  return (
    <Panel title="Trend Since Start" icon={<TrendingUp className="h-4 w-4" />} accent="primary">
      {data.workoutsByWeek.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No workout data yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data.workoutsByWeek}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="var(--color-muted-foreground)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              stroke="var(--color-muted-foreground)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={24}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--color-popover-foreground)",
              }}
            />
            <Area
              type="monotone"
              dataKey="workouts"
              stroke="var(--color-chart-1)"
              strokeWidth={2}
              fill="url(#trendFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}

function TrendSummary({ data }: { data: Data }) {
  const t = data.trend;
  return (
    <Panel title="Lifetime Totals" icon={<Scale className="h-4 w-4" />} accent="primary">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Stat
          label="Started"
          value={t.firstWorkoutDate ? formatUKDateShort(t.firstWorkoutDate) : "—"}
        />
        <Stat label="Weeks" value={t.weeksTraining ? `${t.weeksTraining}` : "—"} />
        <Stat label="Workouts" value={fmt(t.totalWorkouts)} />
        <Stat label="Minutes" value={fmt(t.totalMinutes)} />
        <Stat label="Climb hrs" value={fmt(t.totalClimbHours, "h")} />
        <Stat label="Avg / week" value={fmt(t.avgWorkoutsPerWeek)} />
        <Stat
          label="BW start"
          value={t.startingBodyweight != null ? `${t.startingBodyweight}kg` : "—"}
        />
        <Stat
          label="BW now"
          value={data.kpis.latestBodyweight != null ? `${data.kpis.latestBodyweight}kg` : "—"}
        />
      </dl>
    </Panel>
  );
}

function percentage(value: number, target: number) {
  if (!Number.isFinite(target) || target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / target) * 100)));
}
