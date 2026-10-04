import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Circle, RotateCcw, Square, ArrowRight, SkipForward } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PersonalProgrammeEditor } from "@/components/personal-programme-editor";
import { ProgrammeSupportPlanner } from "@/components/programme-support-planner";
import { formatUKDate } from "@/lib/date";
import { buildProgrammeWeekOverview } from "@/lib/programme-overview";
import {
  changeProgrammeRunClient,
  chooseNextProgrammeSessionClient,
  getMyProgrammeOverviewClient,
  setProgrammeAssignmentStatusClient,
} from "@/lib/supabase-programmes.browser";

export function MyProgrammeOverview({
  initialAssignmentId,
}: { initialAssignmentId?: string } = {}) {
  const queryClient = useQueryClient();
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(initialAssignmentId);
  const [skipOpen, setSkipOpen] = useState(false);
  const [targetWorkoutId, setTargetWorkoutId] = useState("");
  const overview = useQuery({
    queryKey: ["my-programme-overview", selectedAssignmentId],
    queryFn: () => getMyProgrammeOverviewClient(selectedAssignmentId),
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
          "weekly-review",
        ].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      );
      toast.success(variables.action === "restart" ? "Programme started again" : "Programme ended");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const skipAhead = useMutation({
    mutationFn: ({ assignmentId, workoutId }: { assignmentId: string; workoutId: string }) =>
      chooseNextProgrammeSessionClient(assignmentId, workoutId),
    onSuccess: async (count) => {
      setSkipOpen(false);
      setTargetWorkoutId("");
      await Promise.all(
        [
          "my-programme-overview",
          "programme-assignments",
          "programme-schedule",
          "programme-workout-offers",
          "next-suggested-workouts",
          "weekly-review",
        ].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      );
      toast.success(`${count} programme session${count === 1 ? "" : "s"} skipped`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const activate = useMutation({
    mutationFn: (id: string) => setProgrammeAssignmentStatusClient(id, "active"),
    onSuccess: async () => {
      await Promise.all(
        [
          "my-programme-overview",
          "programme-assignments",
          "programme-schedule",
          "programme-workout-offers",
          "programme-exercise-rule",
          "weekly-review",
        ].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      );
      toast.success("Programme ready on Today");
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
  const active =
    assignments.find(
      (assignment) =>
        assignment.id === selectedAssignmentId &&
        assignment.status === "paused" &&
        assignment.personalProgramme,
    ) ??
    assignments.find((assignment) => assignment.status === "active") ??
    assignments.find(
      (assignment) => assignment.status === "paused" && assignment.personalProgramme,
    );
  const startingTemplate = templates.find((item) => item.id === active?.programId);
  const personal = active?.personalProgramme;
  const template =
    startingTemplate && personal
      ? {
          ...startingTemplate,
          name: personal.name,
          workouts: startingTemplate.workouts.map((workout) => ({
            ...workout,
            name:
              personal.sessions.find((session) => session.workoutId === workout.id)?.name ??
              workout.name,
          })),
        }
      : startingTemplate;
  const otherActive = assignments.some(
    (assignment) => assignment.status === "active" && assignment.id !== active?.id,
  );
  const previous = assignments.filter((assignment) => assignment.id !== active?.id);
  const templateById = new Map(templates.map((item) => [item.id, item]));
  const total = template?.workouts.length ?? 0;
  const currentIndex = Math.min(active?.currentWorkoutIndex ?? 0, total);
  const skippedWorkoutIds = new Set(overview.data.skippedWorkoutIds);
  const skipped =
    template?.workouts.filter(
      (workout) => workout.sequenceIndex < currentIndex && skippedWorkoutIds.has(workout.id),
    ).length ?? 0;
  const completed = currentIndex - skipped;
  const next = template?.workouts[currentIndex];
  const laterWorkouts =
    template?.workouts.filter((workout) => workout.sequenceIndex > currentIndex) ?? [];
  const target = laterWorkouts.find((workout) => workout.id === targetWorkoutId);
  const sessionsToSkip = target
    ? (template?.workouts.filter(
        (workout) =>
          workout.sequenceIndex >= currentIndex && workout.sequenceIndex < target.sequenceIndex,
      ) ?? [])
    : [];
  const weeks = template
    ? buildProgrammeWeekOverview(
        template.workouts,
        currentIndex,
        template.sessionsPerWeek,
        skippedWorkoutIds,
      )
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
                  <Badge>{active.status === "paused" ? "Paused · ready to edit" : "Current"}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Run {active.cycleNumber}
                  {active.startedOn ? ` · Started ${formatUKDate(active.startedOn)}` : ""}
                </p>
              </div>
              <p className="text-sm font-medium">
                {completed} completed{skipped ? ` · ${skipped} skipped` : ""} · {total} total
              </p>
            </div>
            <Progress
              value={total ? (currentIndex / total) * 100 : 0}
              aria-label="Programme position"
            />
            <p className="text-xs text-muted-foreground">
              Position {currentIndex} of {total} sessions · completed and skipped sessions both move
              you forward.
            </p>
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
                  Session {currentIndex + 1} of {total}.{" "}
                  {active.status === "paused"
                    ? "Review your future sessions, then start the programme."
                    : "Start it from Today when you are ready."}
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
                        {week.status === "done" && week.completed === 0 ? (
                          <SkipForward className="h-4 w-4 text-muted-foreground" />
                        ) : week.status === "done" ? (
                          <Check className="h-4 w-4 text-emerald-400" />
                        ) : week.status === "current" ? (
                          <Circle className="h-4 w-4 text-primary" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground/50" />
                        )}
                        <span>Week {week.week}</span>
                        <span className="text-xs text-muted-foreground">
                          {week.completed}/{week.total} completed
                          {week.skipped ? ` · ${week.skipped} skipped` : ""}
                        </span>
                        {week.status === "current" ? (
                          <Badge variant="secondary">Current</Badge>
                        ) : null}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ol className="space-y-2 pl-1">
                        {week.workouts.map((workout) => {
                          const done =
                            workout.sequenceIndex < currentIndex &&
                            !skippedWorkoutIds.has(workout.id);
                          const wasSkipped = skippedWorkoutIds.has(workout.id);
                          const isNext = workout.sequenceIndex === currentIndex;
                          return (
                            <li key={workout.id} className="flex items-center gap-2 text-sm">
                              {done ? (
                                <Check className="h-4 w-4 text-emerald-400" />
                              ) : wasSkipped ? (
                                <SkipForward className="h-4 w-4 text-muted-foreground" />
                              ) : isNext ? (
                                <Circle className="h-4 w-4 text-primary" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground/50" />
                              )}
                              <span className={done || wasSkipped ? "text-muted-foreground" : ""}>
                                {workout.name}
                              </span>
                              {wasSkipped ? (
                                <span className="text-xs text-muted-foreground">Skipped</span>
                              ) : null}
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

            {active.personalProgramme ? (
              <div className="space-y-4">
                {active.status === "paused" ? (
                  <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/[0.07] p-4">
                    <p className="font-medium">Review everything before you start</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Open each session below to see its saved targets. Use Edit to change
                      exercises, sets, loads, reps or rest, and use the arrows to change the order.
                    </p>
                    <Button asChild size="sm" variant="outline" className="mt-3">
                      <a href="#programme-editor">Review and edit sessions</a>
                    </Button>
                  </div>
                ) : null}
                <ProgrammeSupportPlanner
                  assignmentId={active.id}
                  programmeName={template.name}
                  sessions={personal.sessions}
                />
                <PersonalProgrammeEditor
                  assignment={active}
                  template={template}
                  lockedWorkoutIds={overview.data.lockedWorkoutIds ?? []}
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                To personalise the whole block, choose “Make my version” in the programme library.
                This existing run keeps its original rules.
              </p>
            )}
            {otherActive && active.status === "paused" ? (
              <p className="text-sm text-muted-foreground">
                Review this version in advance. Pause or end your current programme before starting
                it.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {selectedAssignmentId && otherActive ? (
                <Button variant="outline" onClick={() => setSelectedAssignmentId(undefined)}>
                  Back to current programme
                </Button>
              ) : null}
              {active.status === "paused" ? (
                <div>
                  <Button
                    disabled={activate.isPending || otherActive}
                    onClick={() => activate.mutate(active.id)}
                  >
                    Start programme
                  </Button>
                  {!otherActive ? (
                    <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                      Starting makes session 1 available on Today. Your later sessions remain
                      editable until you begin them.
                    </p>
                  ) : null}
                </div>
              ) : (
                <Button asChild>
                  <Link to="/">Go to next workout</Link>
                </Button>
              )}
              {active.status === "active" ? (
                <Button
                  variant="outline"
                  disabled={activate.isPending}
                  onClick={() => {
                    void setProgrammeAssignmentStatusClient(active.id, "paused")
                      .then(() => queryClient.invalidateQueries())
                      .catch((error: Error) => toast.error(error.message));
                  }}
                >
                  Pause programme
                </Button>
              ) : null}
              {active.status === "active" && laterWorkouts.length ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTargetWorkoutId(laterWorkouts[0].id);
                    setSkipOpen(true);
                  }}
                >
                  <SkipForward className="mr-1.5 h-4 w-4" /> Skip ahead
                </Button>
              ) : null}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={changeRun.isPending || otherActive}>
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

      <Dialog open={skipOpen} onOpenChange={(open) => !skipAhead.isPending && setSkipOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose your next programme session</DialogTitle>
            <DialogDescription>
              Choose the session you want to do next. Earlier unfinished sessions will be recorded
              as skipped; completed workouts stay in your history.
            </DialogDescription>
          </DialogHeader>
          <Select value={targetWorkoutId} onValueChange={setTargetWorkoutId}>
            <SelectTrigger aria-label="Next programme session">
              <SelectValue placeholder="Choose a session" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {laterWorkouts.map((workout) => (
                <SelectItem key={workout.id} value={workout.id}>
                  {workout.weekNumber ? `Week ${workout.weekNumber} · ` : ""}
                  {workout.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {target ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium">
                {sessionsToSkip.length} session{sessionsToSkip.length === 1 ? "" : "s"} will be
                skipped
              </p>
              <p className="mt-1 text-muted-foreground">
                {sessionsToSkip.map((workout) => workout.name).join(" · ")}
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSkipOpen(false)}
              disabled={skipAhead.isPending}
            >
              Keep current session
            </Button>
            <Button
              disabled={!active || !target || skipAhead.isPending}
              onClick={() => {
                if (active && target) {
                  skipAhead.mutate({ assignmentId: active.id, workoutId: target.id });
                }
              }}
            >
              Skip and continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    <p className="font-medium">
                      {assignment.personalProgramme?.name ?? pastTemplate?.name ?? "Programme"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Position {assignment.currentWorkoutIndex} of{" "}
                      {pastTemplate?.workouts.length ?? "?"} sessions ·{" "}
                      {assignment.status === "archived" ? "past run" : assignment.status}
                    </p>
                  </div>
                  {assignment.status === "paused" && assignment.personalProgramme ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedAssignmentId(assignment.id)}
                    >
                      Edit programme
                    </Button>
                  ) : assignment.status === "paused" ? (
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
