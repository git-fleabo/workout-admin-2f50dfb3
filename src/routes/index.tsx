import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Award,
  CalendarRange,
  Clock,
  Dumbbell,
  Loader2,
  Mountain,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDashboardData } from "@/lib/admin.functions";
import { formatUKDate, formatUKDateShort } from "@/lib/date";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Training Admin" },
      {
        name: "description",
        content:
          "Weekly snapshot, calendar, climbing and strength panels, monthly summary and long-term trend.",
      },
    ],
  }),
  component: DashboardPage,
});

type Data = Awaited<ReturnType<typeof getDashboardData>>;

const DEFAULT_WEEKLY_GOAL = 4;
const DEFAULT_MINUTE_GOAL = 180;

const fmt = (v: number | null | undefined, suffix = "") =>
  v == null || (typeof v === "number" && !Number.isFinite(v)) ? "—" : `${v}${suffix}`;

function DashboardPage() {
  const fetchData = useServerFn(getDashboardData);
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchData(),
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
    return (
      <Card className="p-6 text-sm text-destructive">
        Couldn’t load the dashboard. Check the spreadsheet connection and try again.
      </Card>
    );
  }

  const weekStartLabel = formatUKDate(data.thisWeekStart);
  const bwDelta = data.trend.bodyweightDelta;
  const TrendIcon = bwDelta == null ? Activity : bwDelta < 0 ? TrendingDown : TrendingUp;

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {data.kpis.workoutsThisWeek} workouts ·{" "}
            {Math.round(data.kpis.minutesThisWeek || 0)} min ·{" "}
            {data.kpis.activeDaysThisWeek} active days this week
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          Week starting <span className="text-foreground">{weekStartLabel}</span>
        </div>
      </header>

      {/* Top status row */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatusTile
          icon={<CalendarRange className="h-3.5 w-3.5" />}
          label="Week starting"
          value={formatUKDateShort(data.thisWeekStart)}
          accent="cyan"
        />
        <StatusTile
          icon={<Target className="h-3.5 w-3.5" />}
          label="Weekly goal"
          value={`${data.kpis.workoutsThisWeek}/${data.goals?.weeklyWorkouts ?? DEFAULT_WEEKLY_GOAL}`}
          hint="workouts"
          accent="sky"
        />
        <StatusTile
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Minute goal"
          value={`${Math.round(data.kpis.minutesThisWeek || 0)}/${data.goals?.weeklyMinutes ?? DEFAULT_MINUTE_GOAL}`}
          hint="min"
          accent="amber"
        />
        <StatusTile
          icon={<TrendIcon className="h-3.5 w-3.5" />}
          label="Trend since start"
          value={
            bwDelta == null
              ? "—"
              : `${bwDelta > 0 ? "+" : ""}${bwDelta}kg`
          }
          hint={`${data.trend.weeksTraining || 0}w training`}
          accent="violet"
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

type Accent = "sky" | "emerald" | "amber" | "violet" | "rose" | "cyan" | "lime";

const ACCENTS: Record<
  Accent,
  { card: string; icon: string; title: string; bar: string; tile: string; tileIcon: string }
> = {
  sky: {
    card: "border-sky-500/30 bg-gradient-to-br from-sky-500/[0.07] to-transparent",
    icon: "text-sky-400",
    title: "text-sky-200",
    bar: "bg-sky-400",
    tile: "border-sky-500/30 bg-sky-500/[0.06]",
    tileIcon: "text-sky-400",
  },
  emerald: {
    card: "border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.07] to-transparent",
    icon: "text-emerald-400",
    title: "text-emerald-200",
    bar: "bg-emerald-400",
    tile: "border-emerald-500/30 bg-emerald-500/[0.06]",
    tileIcon: "text-emerald-400",
  },
  amber: {
    card: "border-amber-500/30 bg-gradient-to-br from-amber-500/[0.07] to-transparent",
    icon: "text-amber-400",
    title: "text-amber-200",
    bar: "bg-amber-400",
    tile: "border-amber-500/30 bg-amber-500/[0.06]",
    tileIcon: "text-amber-400",
  },
  violet: {
    card: "border-violet-500/30 bg-gradient-to-br from-violet-500/[0.07] to-transparent",
    icon: "text-violet-400",
    title: "text-violet-200",
    bar: "bg-violet-400",
    tile: "border-violet-500/30 bg-violet-500/[0.06]",
    tileIcon: "text-violet-400",
  },
  rose: {
    card: "border-rose-500/30 bg-gradient-to-br from-rose-500/[0.07] to-transparent",
    icon: "text-rose-400",
    title: "text-rose-200",
    bar: "bg-rose-400",
    tile: "border-rose-500/30 bg-rose-500/[0.06]",
    tileIcon: "text-rose-400",
  },
  cyan: {
    card: "border-cyan-500/30 bg-gradient-to-br from-cyan-500/[0.07] to-transparent",
    icon: "text-cyan-400",
    title: "text-cyan-200",
    bar: "bg-cyan-400",
    tile: "border-cyan-500/30 bg-cyan-500/[0.06]",
    tileIcon: "text-cyan-400",
  },
  lime: {
    card: "border-lime-500/30 bg-gradient-to-br from-lime-500/[0.07] to-transparent",
    icon: "text-lime-400",
    title: "text-lime-200",
    bar: "bg-lime-400",
    tile: "border-lime-500/30 bg-lime-500/[0.06]",
    tileIcon: "text-lime-400",
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
    <Card
      className={`p-4 ${a ? a.card : "border-border bg-card"} ${className}`}
    >
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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: Accent;
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
      <div className="mt-1 flex items-baseline gap-1.5">
        <p className="text-lg font-semibold leading-none">{value}</p>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
    </Card>
  );
}

function WeeklySnapshot({ data }: { data: Data }) {
  const weeklyGoal = data.goals?.weeklyWorkouts ?? DEFAULT_WEEKLY_GOAL;
  const pct = Math.min(
    100,
    Math.round(((data.kpis.workoutsThisWeek || 0) / weeklyGoal) * 100),
  );
  return (
    <Panel title="Weekly Snapshot" icon={<Activity className="h-4 w-4" />} accent="sky">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Stat label="Workouts" value={data.kpis.workoutsThisWeek.toString()} />
        <Stat label="Minutes" value={fmt(Math.round(data.kpis.minutesThisWeek || 0))} />
        <Stat label="Active days" value={`${data.kpis.activeDaysThisWeek}/7`} />
        <Stat label="Goal" value={`${weeklyGoal} workouts`} />
      </dl>
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
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
  return (
    <Panel title="This Week" icon={<CalendarRange className="h-4 w-4" />} accent="cyan">
      <div className="grid grid-cols-7 gap-1.5">
        {data.weekDays.map((d) => {
          const credited = d.workouts > 0;
          const logged = d.exercises.length > 0;
          return (
            <div
              key={d.date}
              className={`flex min-h-[110px] flex-col rounded-md border p-2 text-center transition ${
                d.isToday
                  ? "border-primary/60 bg-primary/5"
                  : "border-border bg-secondary/20"
              }`}
            >
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {d.label}
              </div>
              <div className="mt-0.5 text-sm font-semibold">
                {Number(d.date.slice(8, 10))}
              </div>
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
                    <li className="text-muted-foreground/70">
                      +{d.exercises.length - 4} more
                    </li>
                  )}
                </ul>
              )}
              <div
                className={`mx-auto mt-auto h-1 w-6 rounded-full ${
                  credited ? "bg-primary" : "bg-border"
                }`}
              />
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function ClimbingSummary({ data }: { data: Data }) {
  const c = data.climbing;
  return (
    <Panel title="Climbing Summary" icon={<Mountain className="h-4 w-4" />} accent="emerald">
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
        <Stat
          label="Best 1RM"
          value={s.bestLift ? `${s.bestLift.value}kg` : "—"}
        />
        <Stat
          label="Latest test"
          value={s.latestTest ? `${s.latestTest.value}kg` : "—"}
        />
        <Stat label="Exercises" value={s.exercisesTracked.toString()} />
      </dl>
      <div className="mt-3 space-y-1.5 text-xs">
        {s.bestLift && (
          <div className="flex items-center justify-between rounded-md border border-border/60 bg-secondary/20 px-2.5 py-1.5">
            <span className="truncate">
              <span className="text-muted-foreground">Best:</span>{" "}
              <span className="text-foreground">{s.bestLift.name}</span>
            </span>
            <span className="text-muted-foreground">
              {formatUKDateShort(s.bestLift.date)}
            </span>
          </div>
        )}
        {s.latestTest && (
          <div className="flex items-center justify-between rounded-md border border-border/60 bg-secondary/20 px-2.5 py-1.5">
            <span className="truncate">
              <span className="text-muted-foreground">Latest:</span>{" "}
              <span className="text-foreground">{s.latestTest.name}</span>
            </span>
            <span className="text-muted-foreground">
              {formatUKDateShort(s.latestTest.date)}
            </span>
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
  return (
    <Panel title="Monthly Summary" icon={<CalendarRange className="h-4 w-4" />} accent="violet">
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
              <TableCell className="py-1.5 text-right">{m.workouts || "—"}</TableCell>
              <TableCell className="py-1.5 text-right">
                {m.minutes ? Math.round(m.minutes) : "—"}
              </TableCell>
              <TableCell className="py-1.5 text-right">
                {m.climbSessions || "—"}
              </TableCell>
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
      action={
        <span className="text-xs text-muted-foreground">
          {data.kpis.totalPRs} tracked
        </span>
      }
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
              <span className="shrink-0 text-sm font-semibold text-primary">
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
    <Panel title="Trend Since Start" icon={<TrendingUp className="h-4 w-4" />} accent="lime">
      {data.workoutsByWeek.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No workout data yet.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data.workoutsByWeek}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
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
    <Panel title="Lifetime Totals" icon={<Scale className="h-4 w-4" />}>
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
