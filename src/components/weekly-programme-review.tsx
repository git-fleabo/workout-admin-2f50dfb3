import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2, RefreshCw } from "lucide-react";
import { ProgrammeRefreshCard } from "@/components/programme-refresh-card";
import { BaseStrengthLevelEditor } from "@/components/base-strength-level-editor";
import { BaseStrengthProgression } from "@/components/base-strength-progression";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useProgrammeStrengthReview } from "@/hooks/use-programme-strength-review";
import { todayISO, formatUKDate } from "@/lib/date";
import { buildWeeklyPlan } from "@/lib/weekly-plan";
import { buildWeeklyRecoveryRecommendation } from "@/lib/weekly-recovery";
import {
  readSavedWeeklyAdjustments,
  weeklyAdjustmentsStorageKey,
} from "@/lib/weekly-plan-storage.browser";
import { getLibraryClient, getRecentLogsClient } from "@/lib/supabase-log.browser";
import { getActiveProgrammeRefreshContextClient } from "@/lib/supabase-programmes.browser";
import { getWeeklyLoadHistoryClient } from "@/lib/supabase-weekly-load.browser";
import { programmeSessionScheduledDate } from "@/lib/programme-reschedule";
import type { ProgrammeReviewContext } from "@/lib/programme-review-approval.browser";

function LoadingReview() {
  return (
    <p role="status" className="flex items-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading the programme and its review
      evidence…
    </p>
  );
}

function SourceProgrammeReview({ context }: { context: ProgrammeReviewContext }) {
  const { assignment, template } = context;
  const locked = assignment.reviewLockedWorkoutIds ?? [];
  const next = template.workouts.find(
    (workout) =>
      workout.sequenceIndex >= assignment.currentWorkoutIndex && !locked.includes(workout.id),
  );
  const session = assignment.personalProgramme?.sessions.find(
    (item) => item.workoutId === next?.id,
  );
  const date = next ? programmeSessionScheduledDate(assignment, next) : null;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {assignment.personalProgramme?.name ?? template.name} follows its saved source rules.
        Preview base-level changes here before approving them.
      </p>
      <BaseStrengthLevelEditor
        key={assignment.id}
        assignment={assignment}
        template={template}
        lockedWorkoutIds={locked}
      />
      {session ? (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <p className="text-sm font-medium">
            Next unstarted session: {session.name}
            {date ? ` · ${formatUKDate(date)}` : ""}
          </p>
          <BaseStrengthProgression assignmentId={assignment.id} session={session} />
          <Button asChild variant="outline" size="sm">
            <Link to="/plan" search={{ programme: assignment.id, session: session.workoutId }}>
              Inspect all saved targets
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function StrengthWeekReview({ context }: { context: ProgrammeReviewContext }) {
  const today = todayISO();
  const history = useQuery({
    queryKey: ["workout-planner-history"],
    queryFn: () => getRecentLogsClient(300),
    staleTime: 60_000,
  });
  const library = useQuery({
    queryKey: ["library"],
    queryFn: getLibraryClient,
    staleTime: 5 * 60_000,
  });
  const load = useQuery({
    queryKey: ["weekly-load-history"],
    queryFn: () => getWeeklyLoadHistoryClient(90),
    staleTime: 60_000,
  });
  const recent = history.data?.recent ?? [];
  const scopes = new Map(
    (library.data?.exercises ?? []).map((exercise) => [
      exercise.name.toLowerCase(),
      exercise.locationScope,
    ]),
  );
  const plan = buildWeeklyPlan(
    {
      home: recent.filter((log) =>
        ["home", "both"].includes(scopes.get(log.exercise.toLowerCase()) ?? ""),
      ),
      gym: recent.filter((log) =>
        ["gym", "both"].includes(scopes.get(log.exercise.toLowerCase()) ?? ""),
      ),
    },
    today,
    load.data ?? [],
  );
  const choices = useQuery({
    queryKey: ["weekly-plan-adjustments", weeklyAdjustmentsStorageKey(plan.startDate)],
    queryFn: () => readSavedWeeklyAdjustments(plan.startDate),
    refetchOnMount: "always",
  });
  const ready = history.isSuccess && library.isSuccess && load.isSuccess && choices.isSuccess;
  const recovery = ready
    ? buildWeeklyRecoveryRecommendation({
        logs: recent,
        loadHistory: load.data,
        plan,
        adjustments: choices.data,
        today,
      })
    : null;
  const { latest, apply } = useProgrammeStrengthReview(context, recovery);
  const sources = [history, library, load, choices, latest];
  if (sources.some((source) => source.isError))
    return (
      <div className="space-y-2">
        <p role="alert" className="text-sm text-destructive">
          Couldn’t load the programme’s current evidence. Load it before reviewing changes.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            for (const source of sources) if (source.isError) void source.refetch();
          }}
        >
          <RefreshCw className="h-4 w-4" /> Retry programme evidence
        </Button>
      </div>
    );
  if (!recovery || latest.isPending) return <LoadingReview />;
  return (
    <ProgrammeRefreshCard
      key={context.assignment.id}
      assignment={context.assignment}
      template={context.template}
      recovery={recovery}
      appliedReview={latest.data ?? null}
      saving={apply.isPending}
      errorMessage={apply.error?.message}
      onPreview={apply.reset}
      onApplyReview={async (review) => {
        await apply.mutateAsync(review);
      }}
    />
  );
}

function CurrentProgrammeReview() {
  const programme = useQuery({
    queryKey: ["programme-refresh"],
    queryFn: getActiveProgrammeRefreshContextClient,
    staleTime: 30_000,
  });
  if (programme.isError)
    return (
      <div className="space-y-2">
        <p role="alert" className="text-sm text-destructive">
          Couldn’t load your current programme.
        </p>
        <Button variant="outline" size="sm" onClick={() => programme.refetch()}>
          Try programme again
        </Button>
      </div>
    );
  if (programme.isPending) return <LoadingReview />;
  if (!programme.data)
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          No active programme to adjust. Your saved training history stays available above.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/programmes">Choose a programme</Link>
        </Button>
      </div>
    );
  const context = programme.data;
  return context.assignment.personalProgramme?.sessions.some(
    (session) => session.plan.baseStrength,
  ) ? (
    <SourceProgrammeReview context={context} />
  ) : (
    <StrengthWeekReview context={context} />
  );
}

export function WeeklyProgrammeReview({
  current,
  onCurrentWeek,
}: {
  current: boolean;
  onCurrentWeek: () => void;
}) {
  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Programme adjustments</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Review the current unfinished programme. Preview first; apply only after checking the
          targets.
        </p>
      </div>
      {current ? (
        <CurrentProgrammeReview />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This is a past training week. Return to the current week to review upcoming programme
            changes.
          </p>
          <Button variant="outline" size="sm" onClick={onCurrentWeek}>
            Review current programme
          </Button>
        </div>
      )}
    </Card>
  );
}
