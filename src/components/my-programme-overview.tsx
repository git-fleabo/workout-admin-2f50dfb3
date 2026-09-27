import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Circle, RotateCcw, Square, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatUKDate } from "@/lib/date";
import { buildProgrammeWeekOverview } from "@/lib/programme-overview";
import {
  changeProgrammeRunClient,
  getMyProgrammeOverviewClient,
} from "@/lib/supabase-programmes.browser";

export function MyProgrammeOverview() {
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: ["my-programme-overview"],
    queryFn: getMyProgrammeOverviewClient,
    staleTime: 30_000,
  });
  const changeRun = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "restart" | "end" }) =>
      changeProgrammeRunClient(id, action),
    onSuccess: async (_, variables) => {
      await Promise.all(
        [
          "my-programme-overview",
          "programme-assignments",
          "programme-schedule",
          "programme-refresh",
          "programme-workout-offers",
          "next-suggested-workouts",
          "dashboard",
        ].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      );
      toast.success(variables.action === "restart" ? "Programme started again" : "Programme ended");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (overview.isLoading) {
    return <Card className="p-5 text-sm text-muted-foreground">Loading your programme…</Card>;
  }
  if (overview.error || !overview.data) {
    return (
      <Card className="border-destructive/35 p-5 text-sm text-destructive">
        Your programme could not be loaded. Please try again.
      </Card>
    );
  }

  const { assignments, templates } = overview.data;
  const active = assignments.find((assignment) => assignment.status === "active");
  const template = templates.find((item) => item.id === active?.programId);
  const previous = assignments.filter((assignment) => assignment.id !== active?.id);
  const templateById = new Map(templates.map((item) => [item.id, item]));
  const total = template?.workouts.length ?? 0;
  const completed = Math.min(active?.currentWorkoutIndex ?? 0, total);
  const next = template?.workouts[completed];
  const weeks = template
    ? buildProgrammeWeekOverview(template.workouts, completed, template.sessionsPerWeek)
    : [];
  const currentWeek = weeks.find((week) => week.status === "current");

  return (
    <section className="space-y-3" aria-labelledby="my-programme-heading">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="my-programme-heading" className="text-xl font-semibold">
            My programme
          </h2>
          <p className="text-sm text-muted-foreground">
            Your current plan and how far you have come.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/programmes">
            {active ? "Browse programmes" : "Choose a programme"}{" "}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {!active ? (
        <Card className="border-dashed p-5">
          <p className="font-medium">No current programme</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose one when you are ready. Your completed workouts and past plans are still saved.
          </p>
        </Card>
      ) : !template ? (
        <Card className="p-5 text-sm text-muted-foreground">
          Your current programme was found, but its template could not be loaded.
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold">{template.name}</h3>
                  <Badge>Current</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Run {active.cycleNumber}
                  {active.startedOn ? ` · Started ${formatUKDate(active.startedOn)}` : ""}
                </p>
              </div>
              <p className="text-sm font-medium">
                {completed} of {total} sessions done
              </p>
            </div>
            <Progress
              value={total ? (completed / total) * 100 : 0}
              aria-label="Programme progress"
            />
            {next ? (
              <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Next to complete
                </p>
                <p className="mt-1 font-medium">
                  {next.weekNumber ? `Week ${next.weekNumber} · ` : ""}
                  {next.name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Session {completed + 1} of {total}. Start it from Today when you are ready.
                </p>
              </div>
            ) : null}

            <details className="rounded-lg border border-border px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">
                View all {weeks.length} weeks
              </summary>
              <Accordion
                key={active.id}
                type="single"
                collapsible
                defaultValue={currentWeek ? `week-${currentWeek.week}` : undefined}
              >
                {weeks.map((week) => (
                  <AccordionItem key={week.week} value={`week-${week.week}`}>
                    <AccordionTrigger className="hover:no-underline">
                      <span className="flex flex-1 flex-wrap items-center gap-2 pr-2">
                        {week.status === "done" ? (
                          <Check className="h-4 w-4 text-emerald-400" />
                        ) : week.status === "current" ? (
                          <Circle className="h-4 w-4 text-primary" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground/50" />
                        )}
                        <span>Week {week.week}</span>
                        <span className="text-xs text-muted-foreground">
                          {week.completed}/{week.total} done
                        </span>
                        {week.status === "current" ? (
                          <Badge variant="secondary">Current</Badge>
                        ) : null}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ol className="space-y-2 pl-1">
                        {week.workouts.map((workout) => {
                          const done = workout.sequenceIndex < completed;
                          const isNext = workout.sequenceIndex === completed;
                          return (
                            <li key={workout.id} className="flex items-center gap-2 text-sm">
                              {done ? (
                                <Check className="h-4 w-4 text-emerald-400" />
                              ) : isNext ? (
                                <Circle className="h-4 w-4 text-primary" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground/50" />
                              )}
                              <span className={done ? "text-muted-foreground" : ""}>
                                {workout.name}
                              </span>
                              {isNext ? <span className="text-xs text-primary">Next</span> : null}
                            </li>
                          );
                        })}
                      </ol>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </details>

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={changeRun.isPending}>
                    <RotateCcw className="mr-1.5 h-4 w-4" /> Start again
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Start this programme again?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A new run starts today at session 1. This run and all completed workouts stay
                      in your history. Unfinished programme workout plans are closed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep current run</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => changeRun.mutate({ id: active.id, action: "restart" })}
                    >
                      Start again
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" disabled={changeRun.isPending}>
                    <Square className="mr-1.5 h-4 w-4" /> End programme
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>End this programme?</AlertDialogTitle>
                    <AlertDialogDescription>
                      It will leave Today and Plan. This run and your completed workouts stay in
                      your history. You can choose another programme afterwards.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep programme</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => changeRun.mutate({ id: active.id, action: "end" })}
                    >
                      End programme
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      {previous.length ? (
        <details className="rounded-lg border border-border px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium">
            Past and paused programmes ({previous.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {previous.map((assignment) => {
              const pastTemplate = templateById.get(assignment.programId);
              return (
                <li
                  key={assignment.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{pastTemplate?.name ?? "Programme"}</p>
                    <p className="text-xs text-muted-foreground">
                      {assignment.currentWorkoutIndex} of {pastTemplate?.workouts.length ?? "?"}{" "}
                      sessions done ·{" "}
                      {assignment.status === "archived" ? "past run" : assignment.status}
                    </p>
                  </div>
                  {assignment.status === "paused" ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/programmes">Manage</Link>
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
