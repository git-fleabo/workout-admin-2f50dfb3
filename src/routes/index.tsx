import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarCheck2,
  CircleCheck,
  Dumbbell,
  History,
  Loader2,
  MapPin,
  Play,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatUKDate, todayISO } from "@/lib/date";
import { getRecentLogsClient } from "@/lib/supabase-log.browser";
import {
  getNextSuggestedWorkoutsClient,
  updateSuggestedWorkoutStatusClient,
} from "@/lib/supabase-plans.browser";
import {
  lastCompletedWorkoutKey,
  readCompletedWorkoutSummary,
  readWorkoutDraftSummary,
  WORKOUT_REPEAT_SESSION_KEY,
  workoutSessionDraftKey,
  type WorkoutLocalSummary,
} from "@/lib/workout-local-state";
import { WORKOUT_PLAN_DRAFT_KEY } from "@/lib/workout-plan";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today · Training Admin" },
      { name: "description", content: "Choose, resume or review today's workout." },
    ],
  }),
  component: TodayPage,
});

type RecentSession = {
  id: string;
  date: string;
  title: string;
  locationKind: "home" | "gym";
  movements: string[];
};

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function groupRecentSessions(
  logs: Awaited<ReturnType<typeof getRecentLogsClient>>["recent"],
): RecentSession[] {
  const sessions = new Map<string, RecentSession>();
  for (const log of logs) {
    const kind = log.trainingLocation?.kind;
    if (!log.completed || !log.id || !log.exercise || (kind !== "home" && kind !== "gym")) {
      continue;
    }
    const current = sessions.get(log.id) ?? {
      id: log.id,
      date: log.date,
      title: log.sessionTitle || "Workout",
      locationKind: kind,
      movements: [],
    };
    if (!current.movements.some((name) => name.toLowerCase() === log.exercise.toLowerCase())) {
      current.movements.push(log.exercise);
    }
    sessions.set(log.id, current);
  }
  const seenLocations = new Set<string>();
  return Array.from(sessions.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((session) => {
      if (seenLocations.has(session.locationKind)) return false;
      seenLocations.add(session.locationKind);
      return true;
    });
}

function TodayPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<WorkoutLocalSummary | null>(null);
  const [completed, setCompleted] = useState<WorkoutLocalSummary | null>(null);
  const [startingPlanId, setStartingPlanId] = useState<string | null>(null);
  const plans = useQuery({
    queryKey: ["next-suggested-workouts"],
    queryFn: getNextSuggestedWorkoutsClient,
  });
  const recent = useQuery({
    queryKey: ["recent-workouts", 100],
    queryFn: () => getRecentLogsClient(100),
  });

  useEffect(() => {
    setDraft(readWorkoutDraftSummary(window.localStorage.getItem(workoutSessionDraftKey())));
    setCompleted(
      readCompletedWorkoutSummary(window.localStorage.getItem(lastCompletedWorkoutKey())),
    );
  }, []);

  const recentSessions = useMemo(
    () => groupRecentSessions(recent.data?.recent ?? []),
    [recent.data?.recent],
  );
  const today = todayISO();

  const startPlan = async (plan: NonNullable<typeof plans.data>[number]) => {
    if (draft) {
      toast.message("Resume or discard your draft first", {
        description: "Your unfinished workout is being kept safe.",
      });
      return;
    }
    setStartingPlanId(plan.suggestedWorkoutId);
    try {
      await updateSuggestedWorkoutStatusClient(plan.suggestedWorkoutId, "accepted");
      window.localStorage.setItem(WORKOUT_PLAN_DRAFT_KEY, JSON.stringify(plan));
      await navigate({ to: "/log" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The workout could not be started.");
      setStartingPlanId(null);
    }
  };

  const repeatSession = async (session: RecentSession) => {
    if (draft) {
      toast.message("Resume or discard your draft first", {
        description: "Your unfinished workout is being kept safe.",
      });
      return;
    }
    window.localStorage.setItem(WORKOUT_REPEAT_SESSION_KEY, session.id);
    await navigate({ to: "/log" });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="border-b border-border pb-4">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-amber-300">
          <CalendarCheck2 className="h-4 w-4" /> {formatUKDate(today)}
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">What are you doing today?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick up where you left off, use a planned workout, or start fresh.
        </p>
      </header>

      {draft ? (
        <Card className="border-violet-400/35 bg-violet-400/[0.07]">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" />
              <div>
                <p className="font-semibold">Resume {draft.title || "workout"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {draft.movements.length
                    ? `${draft.movements.length} movements · ${draft.movements.join(", ")}`
                    : "Workout details in progress"}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Last saved at {formatTime(draft.savedAt)}
                </p>
              </div>
            </div>
            <Button asChild className="shrink-0">
              <Link to="/log">
                Resume workout <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : completed ? (
        <Card className="border-emerald-400/35 bg-emerald-400/[0.07]">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
              <div>
                <p className="font-semibold">Today&apos;s workout is complete</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {completed.movements.length} movements · Finished at{" "}
                  {formatTime(completed.savedAt)}
                </p>
              </div>
            </div>
            <Button asChild variant="outline" className="shrink-0">
              <Link to="/log">Review or edit</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Next workout</h2>
          <p className="text-xs text-muted-foreground">Saved plans appear first.</p>
        </div>
        {plans.isLoading ? (
          <LoadingRow label="Loading saved workouts…" />
        ) : plans.error ? (
          <ErrorCard label="Saved workouts could not be loaded." />
        ) : plans.data?.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {plans.data.map((plan) => (
              <Card key={plan.suggestedWorkoutId} className="border-cyan-400/25">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{plan.title}</p>
                        <Badge variant="outline" className="capitalize">
                          <MapPin className="mr-1 h-3 w-3" /> {plan.locationKind}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {plan.movements.length} movements ·{" "}
                        {plan.movements.map((movement) => movement.exercise).join(", ")}
                      </p>
                    </div>
                    <Dumbbell className="h-5 w-5 shrink-0 text-cyan-300" />
                  </div>
                  <Button
                    className="mt-4 w-full"
                    onClick={() => startPlan(plan)}
                    disabled={Boolean(startingPlanId)}
                  >
                    {startingPlanId === plan.suggestedWorkoutId ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="mr-2 h-4 w-4" />
                    )}
                    {draft ? "Resume draft first" : "Start workout"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">No saved next workout yet.</p>
              <Button asChild variant="outline" size="sm">
                <Link to="/plan">Plan one</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Repeat a recent workout</h2>
          <p className="text-xs text-muted-foreground">The latest Home and Gym sessions.</p>
        </div>
        {recent.isLoading ? (
          <LoadingRow label="Loading recent workouts…" />
        ) : recent.error ? (
          <ErrorCard label="Recent workouts could not be loaded." />
        ) : recentSessions.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {recentSessions.map((session) => (
              <Card key={session.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <History className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{session.title}</p>
                        <Badge variant="outline" className="capitalize">
                          {session.locationKind}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatUKDate(session.date)} · {session.movements.join(", ")}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={() => repeatSession(session)}
                  >
                    {draft ? "Resume draft first" : "Repeat this workout"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Your recent Home and Gym workouts will appear here.
            </CardContent>
          </Card>
        )}
      </section>

      <div className="flex flex-col gap-2 border-t border-border pt-5 sm:flex-row">
        <Button asChild variant="outline" className="sm:flex-1">
          <Link to="/log">
            <Play className="mr-2 h-4 w-4" /> {draft ? "Open workout log" : "Start empty workout"}
          </Link>
        </Button>
        <Button asChild variant="ghost" className="sm:flex-1">
          <Link to="/progress">Review progress</Link>
        </Button>
      </div>
    </div>
  );
}

function LoadingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-border py-8 text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

function ErrorCard({ label }: { label: string }) {
  return (
    <Card className="border-destructive/35">
      <CardContent className="p-4 text-sm text-destructive">{label}</CardContent>
    </Card>
  );
}
