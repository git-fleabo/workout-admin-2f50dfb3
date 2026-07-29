import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Award,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  Gauge,
  Lightbulb,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatUKDate, formatUKDateShort } from "@/lib/date";
import {
  getWeeklyReviewClient,
  moveWeeklyReviewWeek,
  weeklyReviewWeekStart,
  type WeeklyReviewItem,
} from "@/lib/supabase-weekly-review.browser";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/weekly-review")({
  head: () => ({
    meta: [
      { title: "Weekly Review · Training Tracker" },
      {
        name: "description",
        content: "Review training consistency, plan adherence, recovery signals, and next actions.",
      },
    ],
  }),
  component: WeeklyReviewPage,
});

function signed(value: number, suffix = "") {
  if (value === 0) return "No change";
  return `${value > 0 ? "+" : ""}${value.toLocaleString()}${suffix}`;
}

function volume(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k kg`;
  return `${value.toLocaleString()} kg`;
}

const toneClass = {
  positive: "border-primary/25 bg-primary/5",
  caution: "border-amber-500/25 bg-amber-500/5",
  neutral: "border-border bg-muted/20",
};

function SignalList({ items, icon: Icon }: { items: WeeklyReviewItem[]; icon: typeof Award }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={`${item.title}-${item.detail}`}
          className={cn("rounded-xl border p-3", toneClass[item.tone])}
        >
          <div className="flex items-start gap-2.5">
            <Icon
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                item.tone === "caution" ? "text-amber-500" : "text-primary",
              )}
            />
            <div>
              <p className="text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function WeeklyReviewPage() {
  const currentWeekStart = weeklyReviewWeekStart();
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["weekly-review", weekStart],
    queryFn: () => getWeeklyReviewClient(weekStart),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reviewing the week…
      </div>
    );
  }

  if (error || !data) {
    const message = error instanceof Error ? error.message : "Please try again.";
    return (
      <Card className="space-y-3 p-6">
        <p className="text-sm text-destructive">Couldn’t build the weekly review. {message}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
      </Card>
    );
  }

  const canMoveForward = data.weekStart < currentWeekStart;
  const rangeLabel = `${formatUKDateShort(data.weekStart)}–${formatUKDate(data.reviewEnd)}`;

  const stats = [
    {
      label: "Sessions",
      value: data.summary.sessions.toLocaleString(),
      change: signed(data.comparison.sessionDelta),
      icon: Dumbbell,
    },
    {
      label: "Active days",
      value: data.summary.activeDays.toLocaleString(),
      change: signed(data.comparison.activeDayDelta),
      icon: CalendarDays,
    },
    {
      label: "Training time",
      value: `${data.summary.minutes.toLocaleString()} min`,
      change: signed(data.comparison.minuteDelta, " min"),
      icon: Clock3,
    },
    {
      label: "Strength work",
      value: volume(data.summary.strengthVolume),
      change: signed(data.comparison.volumeDelta, " kg"),
      icon: Gauge,
    },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Weekly review
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">What happened, and what next?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.isCurrentWeek ? "This week so far" : "Completed week"} · {rangeLabel}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekStart(moveWeeklyReviewWeek(data.weekStart, -1))}
            aria-label="Previous week"
            title="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekStart(moveWeeklyReviewWeek(data.weekStart, 1))}
            disabled={!canMoveForward}
            aria-label="Next week"
            title="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh weekly review"
            title="Refresh weekly review"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <stat.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">{stat.value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{stat.change} vs comparison</p>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {data.comparisonLabel}. Current weeks use the same number of elapsed days.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Plan adherence
              </p>
              <h2 className="mt-1 text-lg font-semibold">
                {data.adherence.percentage == null
                  ? "No dated plans"
                  : `${data.adherence.percentage}% completed`}
              </h2>
            </div>
            <Target className="h-5 w-5 text-primary" />
          </div>
          <Progress className="mt-4 h-2.5" value={data.adherence.percentage ?? 0} />
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ["Completed", data.adherence.completed],
              ["Skipped", data.adherence.skipped],
              ["Open", data.adherence.open],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-muted/40 px-2 py-2">
                <p className="text-base font-semibold">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Programme adherence
              </p>
              <h2 className="mt-1 text-lg font-semibold">
                {data.programmeAdherence.percentage == null
                  ? "No sessions due"
                  : `${data.programmeAdherence.percentage}% completed`}
              </h2>
            </div>
            <Target className="h-5 w-5 text-fuchsia-300" />
          </div>
          <Progress className="mt-4 h-2.5" value={data.programmeAdherence.percentage ?? 0} />
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ["Due", data.programmeAdherence.due],
              ["On time", data.programmeAdherence.onTime],
              ["Late", data.programmeAdherence.late],
              ["Outstanding", data.programmeAdherence.outstanding],
              ["Missed", data.programmeAdherence.missed],
              ["Skipped", data.programmeAdherence.skipped],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-muted/40 px-2 py-2">
                <p className="text-base font-semibold">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Fixed programme dates count even when a session was never started.
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Training mix
              </p>
              <h2 className="mt-1 text-lg font-semibold">Where the week went</h2>
            </div>
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.activityMix.length ? (
              data.activityMix.map((item) => (
                <Badge key={item.label} variant="secondary">
                  {item.label} · {item.sessions}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No completed activity to classify.</p>
            )}
          </div>
          {data.locations.length > 0 && (
            <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
              {data.locations.map((item) => `${item.label} ${item.sessions}`).join(" · ")}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Wins and momentum</h2>
          </div>
          <SignalList items={data.highlights} icon={CheckCircle2} />
        </Card>
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <TriangleAlert className="h-5 w-5 text-amber-500" />
            <h2 className="font-semibold">Worth watching</h2>
          </div>
          <SignalList items={data.watchlist} icon={TriangleAlert} />
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-border bg-primary/5 p-5">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Three useful next moves</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Each suggestion is tied to evidence from this review, not a hidden score.
          </p>
        </div>
        <div className="grid gap-px bg-border md:grid-cols-3">
          {data.actions.map((action, index) => (
            <div key={action.title} className="bg-card p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold">{action.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {action.detail}
                  </p>
                  <p className="mt-3 text-[11px] font-medium text-primary">
                    Because: {action.evidence}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border p-4">
          <Button asChild size="sm">
            <Link to="/plan">
              Plan next workout <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/progress">Check exercise progress</Link>
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Completed sessions</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The source activity behind this review.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/history">
              History <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="mt-4 divide-y divide-border">
          {data.sessions.length ? (
            data.sessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{session.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatUKDate(session.date)} · {session.location}
                    {session.minutes > 0 ? ` · ${session.minutes} min` : ""}
                    {session.rpe != null ? ` · RPE ${session.rpe}` : ""}
                  </p>
                </div>
                <div className="flex max-w-full flex-wrap justify-end gap-1.5">
                  {session.activities.map((activity) => (
                    <Badge key={activity} variant="outline" className="font-normal">
                      {activity}
                    </Badge>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No completed sessions in this period.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
