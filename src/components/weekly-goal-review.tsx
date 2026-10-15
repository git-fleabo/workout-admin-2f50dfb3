import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Loader2, RefreshCw, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatUKDate, formatUKDateShort } from "@/lib/date";
import { goalMetricLabel, goalTypeLabel } from "@/lib/goal-model";
import {
  buildGoalReview,
  formatGoalReviewValue,
  GOAL_REVIEW_PERIOD_LABELS,
  goalReviewSummary,
} from "@/lib/goal-review";
import { getGoalActivityClient, listGoalsClient } from "@/lib/supabase-goals.browser";
import { getExerciseHistoryClient } from "@/lib/supabase-history.browser";
import type { GoalReviewEvidence } from "@/lib/goal-review";
import { GoalTrendDisclosure } from "@/components/goal-trend";
import type { buildGoalTrend } from "@/lib/goal-trend";

function EvidenceLink({ item, children }: { item: GoalReviewEvidence; children: React.ReactNode }) {
  return item.sessionId ? (
    <Link
      to="/history"
      search={{ session: item.sessionId }}
      className="text-primary underline underline-offset-4"
    >
      {children}
    </Link>
  ) : (
    <span>{children}</span>
  );
}

function GoalReviewCard({
  review,
  trendInput,
}: {
  review: ReturnType<typeof buildGoalReview>;
  trendInput: Parameters<typeof buildGoalTrend>[0];
}) {
  const { goal, progress, measured, manual, latest, best } = review;
  const unit = goal.targetUnit || (manual ? "check-ins" : "");
  const value = (number: number | null) => formatGoalReviewValue(number, unit);
  const milestone = goal.goalType === "milestone";
  const legacy = goal.goalType === "legacy";
  return (
    <article className="min-w-0 space-y-3 rounded-xl border border-border bg-muted/10 p-4">
      <div>
        <h3 className="break-words text-sm font-semibold">{goal.goal}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {GOAL_REVIEW_PERIOD_LABELS[goal.period.toLowerCase()] ?? "Goal"}
          {goal.deadline ? ` · Due ${formatUKDateShort(goal.deadline)}` : ""}
        </p>
        <Badge variant="secondary" className="mt-2 whitespace-normal">
          {goalMetricLabel(goal.goalMetric) || goalTypeLabel(goal.goalType)}
        </Badge>
      </div>
      {milestone || legacy ? (
        <div className="space-y-2 text-sm">
          {goal.target ? <p className="break-words">Target: {goal.target}</p> : null}
          <p>
            {milestone
              ? "Awaiting your confirmation"
              : `${progress.value ?? 0} manual check-ins in this goal period`}
          </p>
          <p className="text-xs text-muted-foreground">
            {milestone
              ? "Confirm this milestone in Goals when you have achieved it."
              : "Check-ins record practice; they do not measure performance or confirm the target."}
          </p>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-2 text-xs">
            {[
              [
                measured ? "Starting point" : "Period start",
                measured ? value(review.starting) : value(0),
              ],
              [measured ? "Best recorded" : "Recorded so far", value(progress.value)],
              ["Target", value(progress.target)],
            ].map(([label, number]) => (
              <div key={label} className="min-w-0 rounded-lg bg-muted/40 p-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="mt-1 break-words font-semibold">{number}</dd>
              </div>
            ))}
          </dl>
          {progress.percentage != null && !review.missingMinutes ? (
            <div>
              <Progress
                value={progress.percentage}
                className="h-1.5"
                aria-label={`${goal.goal} target progress`}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {progress.percentage}% of target progress · {progress.sourceLabel.toLowerCase()}
              </p>
            </div>
          ) : null}
          {best ? (
            <p className="text-xs">
              <EvidenceLink item={best}>
                View best log · {formatUKDateShort(best.date)}
              </EvidenceLink>
            </p>
          ) : null}
          {measured && latest ? (
            <p className="text-xs text-muted-foreground">
              Latest measurement: {value(latest.value)} ·{" "}
              <EvidenceLink item={latest}>{formatUKDateShort(latest.date)}</EvidenceLink>
            </p>
          ) : null}
          <p className="text-xs leading-relaxed text-muted-foreground">
            {goalReviewSummary(review)}
          </p>
          {review.missingMinutes ? (
            <p className="text-xs text-amber-500">
              Some sessions have no recorded duration. This total includes recorded time only.
            </p>
          ) : null}
          {progress.target == null ? (
            <p className="text-xs text-muted-foreground">
              Set a numeric target in Goals to compare your result with your aim.
            </p>
          ) : null}
          {measured && (!goal.exerciseId || !goal.goalMetric) ? (
            <p className="text-xs text-muted-foreground">
              Choose the exercise and metric in Goals so its logs can be used.
            </p>
          ) : null}
          {progress.reached ? (
            <p className="text-xs font-medium text-primary">
              Recorded target reached. Review it in Goals when you are ready.
            </p>
          ) : null}
        </>
      )}
      <GoalTrendDisclosure input={trendInput} />
      {review.evidence.length ? (
        <details className="border-t border-border pt-2">
          <summary className="cursor-pointer text-xs font-medium">
            View evidence ({review.evidence.length})
          </summary>
          <ul className="mt-2 space-y-2 text-xs">
            {review.evidence.slice(0, 8).map((item) => (
              <li key={item.id} className="break-words">
                <EvidenceLink item={item}>
                  {formatUKDateShort(item.date)}
                  {item.value != null ? ` · ${value(item.value)}` : ""}
                </EvidenceLink>
                <span className="block text-muted-foreground">{item.note}</span>
              </li>
            ))}
          </ul>
          {review.evidence.length > 8 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Showing the latest 8 records. Open History or exercise progress for the full record.
            </p>
          ) : null}
        </details>
      ) : null}
      {measured && goal.exerciseId ? (
        <Link
          to="/progress"
          search={{ exercise: goal.exerciseId }}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary"
        >
          Check exercise progress <ArrowRight className="h-3 w-3" />
        </Link>
      ) : null}
    </article>
  );
}

export function WeeklyGoalReview({
  weekStart,
  reviewEnd,
}: {
  weekStart: string;
  reviewEnd: string;
}) {
  const goals = useQuery({ queryKey: ["goals"], queryFn: listGoalsClient, staleTime: 60_000 });
  const active = goals.data?.items.filter((goal) => goal.status === "active") ?? [];
  const exerciseIds = [
    ...new Set(
      active
        .filter((goal) => goal.goalType === "performance" || goal.goalType === "duration")
        .map((goal) => goal.exerciseId)
        .filter(Boolean),
    ),
  ];
  const histories = useQueries({
    queries: exerciseIds.map((id) => ({
      queryKey: ["goal-exercise-progress", id],
      queryFn: () => getExerciseHistoryClient({ id, name: "Linked exercise" }),
      staleTime: 60_000,
    })),
  });
  const activity = useQuery({
    queryKey: ["goal-activity"],
    queryFn: getGoalActivityClient,
    staleTime: 60_000,
    enabled: active.some(
      (goal) => goal.goalType === "consistency" && goal.goalMetric !== "checkins",
    ),
  });
  const cards = active.map((goal) => {
    const measured = goal.goalType === "performance" || goal.goalType === "duration";
    const source = measured
      ? histories[exerciseIds.indexOf(goal.exerciseId)]
      : goal.goalType === "consistency" && goal.goalMetric !== "checkins"
        ? activity
        : undefined;
    if (source?.isError)
      return (
        <div key={goal.id} className="rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold">{goal.goal}</h3>
          <p className="my-2 text-xs text-destructive">
            Couldn’t load the goal’s evidence. Progress is unavailable.
          </p>
          <Button variant="outline" size="sm" onClick={() => source.refetch()}>
            <RefreshCw className="h-3 w-3" /> Retry evidence
          </Button>
        </div>
      );
    if (source?.isLoading)
      return (
        <p key={goal.id} className="flex items-center p-4 text-xs text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading evidence for {goal.goal}…
        </p>
      );
    const input = {
      goal,
      weekStart,
      reviewEnd,
      activitySessions: activity.data,
      exerciseHistory: histories[exerciseIds.indexOf(goal.exerciseId)]?.data,
    };
    return <GoalReviewCard key={goal.id} review={buildGoalReview(input)} trendInput={input} />;
  });
  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Target className="h-5 w-5 shrink-0 text-primary" /> Are you moving towards your goals?
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Current active goals · records through {formatUKDate(reviewEnd)}. Goal settings reflect
            their current saved values.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/goals">Manage goals</Link>
        </Button>
      </div>
      {goals.isLoading ? (
        <p className="flex items-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading goals…
        </p>
      ) : goals.isError ? (
        <div>
          <p className="mb-2 text-sm text-destructive">Couldn’t load your goals.</p>
          <Button variant="outline" size="sm" onClick={() => goals.refetch()}>
            Try goals again
          </Button>
        </div>
      ) : goals.data?.needsProfileClaim ? (
        <p className="text-sm text-muted-foreground">
          Open Goals to claim your training profile before reviewing goal progress.
        </p>
      ) : !active.length ? (
        <p className="text-sm text-muted-foreground">
          No active goals yet. Set a goal to connect your training logs to a result you want to
          reach.
        </p>
      ) : (
        <>
          <div className="grid items-start gap-3 lg:grid-cols-3">{cards.slice(0, 3)}</div>
          {cards.length > 3 ? (
            <details>
              <summary className="cursor-pointer text-sm font-medium">
                More active goals ({cards.length - 3})
              </summary>
              <div className="mt-3 grid items-start gap-3 lg:grid-cols-3">{cards.slice(3)}</div>
            </details>
          ) : null}
        </>
      )}
    </Card>
  );
}
