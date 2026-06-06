import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Award,
  Clock,
  Loader2,
  Mountain,
  Scale,
  Sparkles,
  Trophy,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "@/components/ui/card";
import { getDashboardData } from "@/lib/admin.functions";
import { formatUKDateShort } from "@/lib/date";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Training Admin" },
      {
        name: "description",
        content: "Progress overview: weekly workouts, climbing hours, bodyweight trend and recent PRs.",
      },
    ],
  }),
  component: DashboardPage,
});

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

  const { kpis, workoutsByWeek, climbingByMonth, bodyweight, recentPRs } = data;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard
          icon={<Activity className="h-4 w-4" />}
          label="Workouts this week"
          value={kpis.workoutsThisWeek.toString()}
          color="oklch(0.72 0.14 220)"
        />
        <KPICard
          icon={<Clock className="h-4 w-4" />}
          label="Active minutes"
          value={kpis.minutesThisWeek ? `${Math.round(kpis.minutesThisWeek)}` : "—"}
          color="oklch(0.78 0.14 80)"
        />
        <KPICard
          icon={<Mountain className="h-4 w-4" />}
          label="Climbing this month"
          value={
            kpis.climbingHoursThisMonth
              ? `${kpis.climbingHoursThisMonth.toFixed(1)}h`
              : `${kpis.climbingSessionsThisMonth} sess.`
          }
          color="oklch(0.75 0.14 150)"
        />
        <KPICard
          icon={<Scale className="h-4 w-4" />}
          label="Latest bodyweight"
          value={kpis.latestBodyweight != null ? `${kpis.latestBodyweight}kg` : "—"}
          color="oklch(0.72 0.14 25)"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Workouts per week" subtitle="Last 12 weeks">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={workoutsByWeek}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip
                cursor={{ fill: "color-mix(in oklab, var(--color-primary) 12%, transparent)" }}
                contentStyle={chartTooltipStyle}
                labelStyle={{ color: "var(--color-foreground)" }}
              />
              <Bar
                dataKey="workouts"
                fill="var(--color-chart-1)"
                radius={[6, 6, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Active minutes per week" subtitle="Workout durations">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={workoutsByWeek}>
              <defs>
                <linearGradient id="minutesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Area
                type="monotone"
                dataKey="minutes"
                stroke="var(--color-chart-2)"
                strokeWidth={2}
                fill="url(#minutesFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Climbing hours" subtitle="Last 6 months">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={climbingByMonth}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar
                dataKey="hours"
                fill="var(--color-chart-3)"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Bodyweight" subtitle="All entries">
          {bodyweight.length === 0 ? (
            <EmptyChart message="No bodyweight entries yet." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={bodyweight}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatUKDateShort}
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={["dataMin - 1", "dataMax + 1"]}
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  labelFormatter={(v: string) => formatUKDateShort(v)}
                />
                <Line
                  type="monotone"
                  dataKey="bodyweight"
                  stroke="var(--color-chart-4)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--color-chart-4)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <RecentPRs items={recentPRs} total={kpis.totalPRs} />
    </div>
  );
}

const chartTooltipStyle = {
  backgroundColor: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--color-popover-foreground)",
};

function KPICard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card className="space-y-1.5 border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span style={{ color }}>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <p className="text-2xl font-semibold leading-none">{value}</p>
    </Card>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children}
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function RecentPRs({
  items,
  total,
}: {
  items: Awaited<ReturnType<typeof getDashboardData>>["recentPRs"];
  total: number;
}) {
  const filtered = useMemo(() => items.filter((i) => i.title), [items]);
  return (
    <Card className="space-y-3 border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Award className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Recent PRs</h2>
        <span className="ml-auto text-xs text-muted-foreground">{total} tracked</span>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No PRs logged yet.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((pr, i) => (
            <li
              key={`${pr.title}-${pr.detail}-${i}`}
              className="flex items-start gap-3 rounded-lg border border-border/60 bg-secondary/20 p-3"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                {pr.kind === "1rm" ? <Trophy className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{pr.title}</p>
                  <span className="shrink-0 text-sm font-semibold text-primary">{pr.value}</span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {[pr.detail, pr.date && formatUKDateShort(pr.date)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
