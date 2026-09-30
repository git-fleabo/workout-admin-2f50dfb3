import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MobilityPracticeOverview } from "@/components/mobility-practice-overview";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  CircleCheck,
  Dumbbell,
  History,
  Home,
  Layers3,
  Loader2,
  MapPin,
  Play,
  RotateCcw,
  Settings2,
  Shuffle,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkoutLifecycleBadge } from "@/components/workout-lifecycle-badge";
import { programmeWorkoutScheduledDate } from "@/lib/adaptive-strength";
import { formatUKDate, todayISO } from "@/lib/date";
import { getLibraryClient, getRecentLogsClient } from "@/lib/supabase-log.browser";
import {
  getTodayDailyRotationClient,
  setDailyRotationCompletedClient,
} from "@/lib/supabase-daily-rotation.browser";
import {
  getNextSuggestedWorkoutsClient,
  saveWorkoutPlanClient,
  updateSuggestedWorkoutStatusClient,
} from "@/lib/supabase-plans.browser";
import {
  getCurrentProgrammeWorkoutOffersClient,
  getMyProgrammeOverviewClient,
  startProgrammeWorkoutClient,
  type ProgrammeWorkoutOffer,
} from "@/lib/supabase-programmes.browser";
import { daysSinceSuggestedSession, easierProgrammeMovements } from "@/lib/programme-return";
import { JACKED_DUMBBELL_METHOD } from "@/lib/programme-methods";
import {
  lastCompletedWorkoutKey,
  readCompletedWorkoutSummary,
  readWorkoutDraftSummary,
  WORKOUT_REPEAT_SESSION_KEY,
  workoutSessionDraftKey,
  type WorkoutLocalSummary,
} from "@/lib/workout-local-state";
import {
  buildWorkoutSuggestion,
  WORKOUT_PLAN_DRAFT_KEY,
  WORKOUT_PLAN_LOCATION_KEY,
  WORKOUT_TRAINING_LOCATION_KEY,
  type PlannerLocation,
  type WorkoutPlanMovement,
} from "@/lib/workout-plan";
import { workoutPlanLifecycleState } from "@/lib/workout-lifecycle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today · Train & Track" },
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

function targetSummary(movement: WorkoutPlanMovement) {
  const rows = movement.setRows;
  const first = rows[0];
  const sameTarget = rows.every((row) => row.reps === first?.reps && row.weight === first?.weight);
  if (sameTarget) {
    return [
      `${rows.length} ${rows.length === 1 ? "set" : "sets"}`,
      first?.weight ? `${first.weight} kg` : "",
      first?.reps ? `${first.reps} reps` : "",
      movement.restTime ? `Rest ${movement.restTime}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }
  const targets = `${rows.length} sets · ${rows
    .map((row) =>
      [row.weight ? `${row.weight} kg` : "", row.reps ? `${row.reps} reps` : ""]
        .filter(Boolean)
        .join(" × "),
    )
    .join(", ")}`;
  return movement.restTime ? `${targets} · Rest ${movement.restTime}` : targets;
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
      current.movements[log.orderIndex] = log.exercise;
    }
    sessions.set(log.id, current);
  }
  const seenLocations = new Set<string>();
  return Array.from(sessions.values())
    .map((session) => ({
      ...session,
      movements: session.movements.filter(Boolean),
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((session) => {
      if (seenLocations.has(session.locationKind)) return false;
      seenLocations.add(session.locationKind);
      return true;
    });
}

function availableProgrammeLocations(
  offer: ProgrammeWorkoutOffer,
  exercises: Awaited<ReturnType<typeof getLibraryClient>>["exercises"],
  locations: Awaited<ReturnType<typeof getLibraryClient>>["locations"],
) {
  if (offer.methodType === JACKED_DUMBBELL_METHOD) {
    return locations.filter((location) => location.kind === "home" || location.kind === "gym");
  }
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  return locations.filter(
    (location) =>
      (location.kind === "home" || location.kind === "gym") &&
      offer.exerciseIds.every((exerciseId) =>
        byId.get(exerciseId)?.availableLocationIds.includes(location.id),
      ),
  );
}

export function TodayPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<WorkoutLocalSummary | null>(null);
  const [completed, setCompleted] = useState<WorkoutLocalSummary | null>(null);
  const [startingPlanId, setStartingPlanId] = useState<string | null>(null);
  const [startingProgrammeId, setStartingProgrammeId] = useState<string | null>(null);
  const [rememberedTrainingLocationId, setRememberedTrainingLocationId] = useState<string | null>(
    null,
  );
  const [programmeLocations, setProgrammeLocations] = useState<Record<string, string>>({});
  const [programmeSelections, setProgrammeSelections] = useState<
    Record<string, Record<string, string>>
  >({});
  const [recommendationLocation, setRecommendationLocation] = useState<PlannerLocation>("gym");
  const [startingRecommendation, setStartingRecommendation] = useState(false);
  const [discardDraftOpen, setDiscardDraftOpen] = useState(false);
  const [otherWaysOpen, setOtherWaysOpen] = useState(false);
  const plans = useQuery({
    queryKey: ["next-suggested-workouts"],
    queryFn: getNextSuggestedWorkoutsClient,
  });
  const programmeOffers = useQuery({
    queryKey: ["programme-workout-offers"],
    queryFn: getCurrentProgrammeWorkoutOffersClient,
  });
  const programmeOverview = useQuery({
    queryKey: ["my-programme-overview"],
    queryFn: getMyProgrammeOverviewClient,
    staleTime: 30_000,
  });
  const linkedProgrammePlans = plans.data?.filter((plan) => plan.programAssignmentId) ?? [];
  const extraPlans = plans.data?.filter((plan) => !plan.programAssignmentId) ?? [];
  const recent = useQuery({
    queryKey: ["recent-workouts", 300],
    queryFn: () => getRecentLogsClient(300),
  });
  const library = useQuery({
    queryKey: ["library"],
    queryFn: getLibraryClient,
    staleTime: 5 * 60_000,
  });
  const today = todayISO();
  const activeProgramme = programmeOverview.data?.assignments.find(
    (assignment) => assignment.status === "active",
  );
  const activeTemplate = programmeOverview.data?.templates.find(
    (template) => template.id === activeProgramme?.programId,
  );
  const skippedProgrammeSessions =
    activeTemplate?.workouts.filter(
      (workout) =>
        workout.sequenceIndex < (activeProgramme?.currentWorkoutIndex ?? 0) &&
        programmeOverview.data?.skippedWorkoutIds.includes(workout.id),
    ).length ?? 0;
  const dailyRotation = useQuery({
    queryKey: ["daily-rotation-today", today],
    queryFn: () => getTodayDailyRotationClient(today),
  });
  const dailyRotationMutation = useMutation({
    mutationFn: ({ assignmentId, completed }: { assignmentId: string; completed: boolean }) =>
      setDailyRotationCompletedClient(assignmentId, completed),
    onSuccess: (_, variables) => {
      toast.success(variables.completed ? "Daily practice complete" : "Practice reopened");
      queryClient.invalidateQueries({ queryKey: ["daily-rotation-today", today] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    setDraft(readWorkoutDraftSummary(window.localStorage.getItem(workoutSessionDraftKey())));
    setRememberedTrainingLocationId(window.localStorage.getItem(WORKOUT_TRAINING_LOCATION_KEY));
    setCompleted(
      readCompletedWorkoutSummary(window.localStorage.getItem(lastCompletedWorkoutKey())),
    );
  }, []);

  useEffect(() => {
    if (!recent.isSuccess || !completed?.sessionId) return;
    const sessionStillExists = recent.data.recent.some((log) => log.id === completed.sessionId);
    if (sessionStillExists) return;
    window.localStorage.removeItem(lastCompletedWorkoutKey());
    setCompleted(null);
  }, [completed?.sessionId, recent.data, recent.isSuccess]);

  const recentSessions = useMemo(
    () => groupRecentSessions(recent.data?.recent ?? []),
    [recent.data?.recent],
  );
  const recommendations = useMemo(() => {
    const buildFor = (location: PlannerLocation) => {
      const allowed = new Set(
        (library.data?.exercises ?? [])
          .filter(
            (exercise) => exercise.locationScope === "both" || exercise.locationScope === location,
          )
          .map((exercise) => exercise.name.toLowerCase()),
      );
      const logs = (recent.data?.recent ?? []).filter((log) =>
        allowed.has(log.exercise.toLowerCase()),
      );
      return buildWorkoutSuggestion(logs, location, "normal");
    };
    return { home: buildFor("home"), gym: buildFor("gym") };
  }, [library.data?.exercises, recent.data?.recent]);
  const recommendation = recommendations[recommendationLocation];
  useEffect(() => {
    if (!recommendations.gym && recommendations.home) setRecommendationLocation("home");
  }, [recommendations.gym, recommendations.home]);

  const discardDraft = () => {
    window.localStorage.removeItem(workoutSessionDraftKey());
    setDraft(null);
    setDiscardDraftOpen(false);
    toast.message("Workout cancelled", {
      description: "The unfinished draft has been cleared.",
    });
  };

  const startPlan = async (plan: NonNullable<typeof plans.data>[number], easier = false) => {
    if (draft) {
      toast.message("Resume or discard your draft first", {
        description: "Your unfinished workout is being kept safe.",
      });
      return;
    }
    setStartingPlanId(plan.suggestedWorkoutId);
    try {
      await updateSuggestedWorkoutStatusClient(plan.suggestedWorkoutId, "accepted");
      const draftToLoad = easier
        ? {
            ...plan,
            basis: `${plan.basis} Easier return option: start lighter and edit any target before saving. Your programme settings stay the same.`,
            movements: easierProgrammeMovements(plan.movements),
          }
        : plan;
      window.localStorage.setItem(WORKOUT_PLAN_DRAFT_KEY, JSON.stringify(draftToLoad));
      await navigate({ to: "/log" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The workout could not be started.");
      setStartingPlanId(null);
    }
  };

  const startProgramme = async (
    offer: ProgrammeWorkoutOffer,
    trainingLocationId: string,
    easier = false,
  ) => {
    if (draft) {
      toast.message("Resume or discard your draft first", {
        description: "Your unfinished workout is being kept safe.",
      });
      return;
    }
    setStartingProgrammeId(offer.assignmentId);
    try {
      const saved = await startProgrammeWorkoutClient(
        offer.assignmentId,
        trainingLocationId,
        programmeSelections[offer.assignmentId] ?? {},
        easier,
      );
      window.localStorage.setItem(WORKOUT_PLAN_DRAFT_KEY, JSON.stringify(saved));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["programme-workout-offers"] }),
        queryClient.invalidateQueries({ queryKey: ["next-suggested-workouts"] }),
      ]);
      await navigate({ to: "/log" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The programme session could not be started.",
      );
      setStartingProgrammeId(null);
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

  const adjustRecommendation = async () => {
    window.localStorage.setItem(WORKOUT_PLAN_LOCATION_KEY, recommendationLocation);
    await navigate({ to: "/plan" });
  };

  const startRecommendedWorkout = async () => {
    if (!recommendation) return;
    if (draft) {
      toast.message("Resume or discard your draft first", {
        description: "Your unfinished workout is being kept safe.",
      });
      return;
    }
    setStartingRecommendation(true);
    try {
      const saved = await saveWorkoutPlanClient({
        draft: recommendation,
        readiness: "normal",
        status: "accepted",
      });
      window.localStorage.setItem(WORKOUT_PLAN_DRAFT_KEY, JSON.stringify(saved));
      await queryClient.invalidateQueries({ queryKey: ["next-suggested-workouts"] });
      await navigate({ to: "/log" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The workout could not be started.");
      setStartingRecommendation(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="border-b border-border pb-4">
        <h1 className="text-3xl font-semibold tracking-tight">What are you doing today?</h1>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarCheck2 className="h-4 w-4" /> {formatUKDate(today)}
        </div>
      </header>

      {draft ? (
        <Card className="border-violet-400/35 bg-violet-400/[0.07]">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">Resume {draft.title || "workout"}</p>
                  <WorkoutLifecycleBadge state="in_progress" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {draft.movements.length
                    ? `${draft.movements.length} movements · ${draft.movements.join(", ")}`
                    : "Workout details in progress"}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Last saved at {formatTime(draft.savedAt)} · on this device
                </p>
              </div>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
              <Button asChild>
                <Link to="/log">
                  Resume workout <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDiscardDraftOpen(true)}
              >
                <X className="mr-1.5 h-4 w-4" /> Cancel draft
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : completed ? (
        <Card className="border-emerald-400/35 bg-emerald-400/[0.07]">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">Today&apos;s workout is complete</p>
                  <WorkoutLifecycleBadge state="completed" />
                </div>
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

      {programmeOffers.error ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Your programme</h2>
            <p className="text-xs text-muted-foreground">
              Your next programme session could not be loaded.
            </p>
          </div>
          <ErrorCard label="The active programme session could not be loaded." />
        </section>
      ) : programmeOffers.data?.length ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Your programme</h2>
            <p className="text-xs text-muted-foreground">
              Your next session stays available. Suggested dates are guidance, so train when ready.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {programmeOffers.data.map((offer) => {
              const daysOverdue = daysSinceSuggestedSession(offer.scheduledDate, today);
              const availableLocations = availableProgrammeLocations(
                offer,
                library.data?.exercises ?? [],
                library.data?.locations ?? [],
              );
              const requestedLocationId = programmeLocations[offer.assignmentId];
              const selectedLocation =
                availableLocations.find((location) => location.id === requestedLocationId) ??
                availableLocations.find(
                  (location) => location.id === rememberedTrainingLocationId,
                ) ??
                availableLocations.find((location) => location.kind === "gym") ??
                availableLocations[0];
              const libraryById = new Map(
                (library.data?.exercises ?? []).map((exercise) => [exercise.id, exercise]),
              );
              return (
                <Card
                  key={offer.assignmentId}
                  className="border-fuchsia-400/30 bg-fuchsia-400/[0.05]"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{offer.programmeName}</p>
                          <Badge variant="outline">Next</Badge>
                          <Badge variant="secondary">
                            {offer.workoutNumber}/{offer.totalWorkouts}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {offer.weekNumber ? `Week ${offer.weekNumber} · ` : ""}
                          {offer.sessionNumber
                            ? `Session ${offer.sessionNumber}`
                            : offer.workoutName}
                        </p>
                      </div>
                      <Layers3 className="h-5 w-5 shrink-0 text-fuchsia-300" />
                    </div>

                    {activeProgramme?.id === offer.assignmentId ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {activeProgramme.currentWorkoutIndex - skippedProgrammeSessions} completed
                        {skippedProgrammeSessions ? ` · ${skippedProgrammeSessions} skipped` : ""}
                        {` · Session ${offer.workoutNumber} of ${offer.totalWorkouts}`}
                      </p>
                    ) : null}
                    {daysOverdue >= 7 ? (
                      <div className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-3 text-xs">
                        <p className="font-medium">Picking up after a break?</p>
                        <p className="mt-1 text-muted-foreground">
                          Continue here, start an easier version, or choose a later session. Your
                          completed workouts stay saved.
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-background/30">
                      {offer.movements.map((movement) => (
                        <div
                          key={movement.exercise}
                          className="flex items-baseline justify-between gap-3 p-3"
                        >
                          <p className="text-sm font-medium">{movement.exercise}</p>
                          <p className="text-right text-[11px] text-foreground/75">
                            {targetSummary(movement)}
                          </p>
                        </div>
                      ))}
                    </div>

                    {availableLocations.length ? (
                      <div className="mt-4 space-y-1.5">
                        <p className="text-xs font-medium">Training location</p>
                        <Select
                          value={selectedLocation?.id}
                          onValueChange={(value) => {
                            window.localStorage.setItem(WORKOUT_TRAINING_LOCATION_KEY, value);
                            setRememberedTrainingLocationId(value);
                            setProgrammeLocations((current) => ({
                              ...current,
                              [offer.assignmentId]: value,
                            }));
                            setProgrammeSelections((current) => ({
                              ...current,
                              [offer.assignmentId]: {},
                            }));
                          }}
                        >
                          <SelectTrigger>
                            <MapPin className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Choose a location" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableLocations.map((location) => (
                              <SelectItem key={location.id} value={location.id}>
                                {location.name} · {location.kind}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">
                          Main lifts and optional choices use this location’s recorded equipment.
                        </p>
                      </div>
                    ) : (
                      <p className="mt-4 text-xs text-destructive">
                        These mapped movements do not share an enabled Home or Gym location. Update
                        their Library locations or equipment before starting.
                      </p>
                    )}

                    {offer.selections.length ? (
                      <div className="mt-4 space-y-3">
                        {offer.selections.map((selection) => {
                          const availableOptions = selectedLocation
                            ? selection.options.filter((option) =>
                                libraryById
                                  .get(option.exerciseId)
                                  ?.availableLocationIds.includes(selectedLocation.id),
                              )
                            : [];
                          const selectedExerciseId =
                            programmeSelections[offer.assignmentId]?.[selection.role] ?? "";
                          const selectionValue = availableOptions.some(
                            (option) => option.exerciseId === selectedExerciseId,
                          )
                            ? selectedExerciseId
                            : "none";
                          return (
                            <div key={selection.role} className="space-y-1.5">
                              <p className="text-xs font-medium">
                                {selection.label} {selection.required ? "" : "(optional)"}
                              </p>
                              <Select
                                value={selectionValue}
                                onValueChange={(value) =>
                                  setProgrammeSelections((current) => ({
                                    ...current,
                                    [offer.assignmentId]: {
                                      ...(current[offer.assignmentId] ?? {}),
                                      [selection.role]: value === "none" ? "" : value,
                                    },
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Choose from Library pool" />
                                </SelectTrigger>
                                <SelectContent>
                                  {!selection.required ? (
                                    <SelectItem value="none">Skip today</SelectItem>
                                  ) : null}
                                  {availableOptions.map((option) => (
                                    <SelectItem key={option.id} value={option.exerciseId}>
                                      {option.exerciseName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {!availableOptions.length ? (
                                <p className="text-[11px] text-muted-foreground">
                                  No pool choices are available at{" "}
                                  {selectedLocation?.name ?? "this location"}.
                                </p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {draft ? (
                      <Button asChild className="mt-3 w-full">
                        <Link to="/log">
                          <RotateCcw className="mr-2 h-4 w-4" /> Resume current workout
                        </Link>
                      </Button>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <Button
                          className="w-full"
                          onClick={() =>
                            selectedLocation && startProgramme(offer, selectedLocation.id)
                          }
                          disabled={!selectedLocation || Boolean(startingProgrammeId)}
                        >
                          {startingProgrammeId === offer.assignmentId ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="mr-2 h-4 w-4" />
                          )}
                          Continue with this session
                        </Button>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            onClick={() =>
                              selectedLocation && startProgramme(offer, selectedLocation.id, true)
                            }
                            disabled={!selectedLocation || Boolean(startingProgrammeId)}
                          >
                            Ease back in
                          </Button>
                          <Button asChild variant="ghost">
                            <Link to="/plan">Skip ahead</Link>
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Ease back in suggests one fewer set where possible and lighter loads. Edit
                          every target in the log.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      {linkedProgrammePlans.length && !programmeOffers.data?.length ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Your programme</h2>
            <p className="text-xs text-muted-foreground">
              Your next session stays available. Suggested dates are guidance.
            </p>
          </div>
          {linkedProgrammePlans.map((plan) => {
            const isCurrentRun = activeProgramme?.id === plan.programAssignmentId;
            const nextWorkout =
              isCurrentRun && activeProgramme
                ? activeTemplate?.workouts[activeProgramme.currentWorkoutIndex]
                : null;
            const suggestedDate =
              nextWorkout && activeProgramme
                ? programmeWorkoutScheduledDate(
                    activeProgramme.startedOn,
                    nextWorkout.weekNumber,
                    nextWorkout.dayNumber,
                  )
                : null;
            const completedCount = Math.max(
              0,
              (activeProgramme?.currentWorkoutIndex ?? 0) - skippedProgrammeSessions,
            );
            return (
              <Card key={plan.suggestedWorkoutId} className="border-fuchsia-400/30 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{plan.title}</p>
                  <Badge variant="secondary">
                    {plan.status === "accepted" ? "Started" : "Ready"}
                  </Badge>
                </div>
                {isCurrentRun && activeProgramme && activeTemplate ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {completedCount} completed
                    {skippedProgrammeSessions ? ` · ${skippedProgrammeSessions} skipped` : ""}
                    {` · Session ${activeProgramme.currentWorkoutIndex + 1} of ${activeTemplate.workouts.length}`}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  {plan.movements.length} movements ·{" "}
                  {plan.movements.map((movement) => movement.exercise).join(", ")}
                </p>
                {daysSinceSuggestedSession(suggestedDate, today) >= 7 ? (
                  <div className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-3 text-xs">
                    <p className="font-medium">Picking up after a break?</p>
                    <p className="mt-1 text-muted-foreground">
                      Continue here, use an easier version, or choose a later session.
                    </p>
                  </div>
                ) : null}
                {draft ? (
                  <Button asChild className="mt-4 w-full">
                    <Link to="/log">Resume current workout</Link>
                  </Button>
                ) : (
                  <Button
                    className="mt-4 w-full"
                    onClick={() => startPlan(plan)}
                    disabled={Boolean(startingPlanId)}
                  >
                    Continue with this session
                  </Button>
                )}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => startPlan(plan, true)}
                    disabled={Boolean(draft || startingPlanId)}
                  >
                    Ease back in
                  </Button>
                  <Button asChild variant="ghost">
                    <Link to="/plan">Skip ahead</Link>
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {draft
                    ? "Finish or cancel your current draft before loading another version."
                    : "Ease back in copies this workout with lighter numeric targets. For open-ended targets, choose a lighter load in Log."}
                </p>
              </Card>
            );
          })}
        </section>
      ) : null}

      <MobilityPracticeOverview compact />

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Daily practice reminder</h2>
          <p className="text-xs text-muted-foreground">
            One small movement selected from your rotation for today.
          </p>
        </div>
        {dailyRotation.isLoading ? (
          <LoadingRow label="Choosing today's practice…" />
        ) : dailyRotation.error ? (
          <ErrorCard label="Today's daily practice could not be loaded." />
        ) : dailyRotation.data?.rotation ? (
          <Card
            className={
              dailyRotation.data.rotation.completedAt
                ? "border-emerald-400/35 bg-emerald-400/[0.06]"
                : "border-violet-400/35 bg-violet-400/[0.06]"
            }
          >
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  {dailyRotation.data.rotation.completedAt ? (
                    <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                  ) : (
                    <Shuffle className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{dailyRotation.data.rotation.item.name}</p>
                      {dailyRotation.data.rotation.item.target ? (
                        <Badge variant="outline" className="border-violet-400/30 text-violet-100">
                          {dailyRotation.data.rotation.item.target}
                        </Badge>
                      ) : null}
                    </div>
                    {dailyRotation.data.rotation.item.cue ? (
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {dailyRotation.data.rotation.item.cue}
                      </p>
                    ) : null}
                    {dailyRotation.data.rotation.completedAt ? (
                      <p className="mt-2 text-[11px] font-medium text-emerald-300">Done today</p>
                    ) : null}
                  </div>
                </div>
                <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
                  <Button
                    variant={dailyRotation.data.rotation.completedAt ? "outline" : "default"}
                    onClick={() =>
                      dailyRotationMutation.mutate({
                        assignmentId: dailyRotation.data.rotation!.assignmentId,
                        completed: !dailyRotation.data.rotation!.completedAt,
                      })
                    }
                    disabled={dailyRotationMutation.isPending}
                  >
                    {dailyRotationMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CircleCheck className="mr-2 h-4 w-4" />
                    )}
                    {dailyRotation.data.rotation.completedAt ? "Undo" : "Done today"}
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/rotation">
                      <Settings2 className="mr-2 h-4 w-4" /> Manage
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">
                  {dailyRotation.data?.hasConfiguredItems
                    ? "No daily practice scheduled today"
                    : "Set up your daily rotation"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dailyRotation.data?.hasConfiguredItems
                    ? "Your active items are paused or set for other days."
                    : "Add movements such as one-arm hangs, handstands or mobility drills."}
                </p>
              </div>
              <Button asChild variant="outline" className="shrink-0">
                <Link to="/rotation">
                  <Settings2 className="mr-2 h-4 w-4" /> Configure
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      <details
        key={activeProgramme ? "programme" : "no-programme"}
        open={!activeProgramme || otherWaysOpen}
        onToggle={(event) => {
          if (activeProgramme) setOtherWaysOpen(event.currentTarget.open);
        }}
        className="rounded-xl border border-border bg-card/30 p-4"
      >
        <summary className="cursor-pointer text-sm font-semibold">
          {activeProgramme ? "Other ways to train" : "Choose a workout"}
        </summary>
        <div className="mt-4 space-y-5">
          <section className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">Next workout</h2>
                <p className="text-xs text-muted-foreground">
                  Saved plans appear first; otherwise recent history provides a starting point.
                </p>
              </div>
              {!extraPlans.length ? (
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-secondary/30 p-1">
                  {(["home", "gym"] as PlannerLocation[]).map((location) => (
                    <button
                      key={location}
                      type="button"
                      onClick={() => setRecommendationLocation(location)}
                      className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                        recommendationLocation === location
                          ? "bg-card text-foreground shadow"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {location === "home" ? (
                        <Home className="h-3.5 w-3.5" />
                      ) : (
                        <Building2 className="h-3.5 w-3.5" />
                      )}
                      {location}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {plans.isLoading || recent.isLoading || library.isLoading ? (
              <LoadingRow label="Loading saved workouts…" />
            ) : plans.error || recent.error || library.error ? (
              <ErrorCard label="The next workout could not be loaded." />
            ) : extraPlans.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {extraPlans.map((plan) => (
                  <Card key={plan.suggestedWorkoutId} className="border-cyan-400/25">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{plan.title}</p>
                            {plan.programAssignmentId ? (
                              <Badge variant="secondary">Programme</Badge>
                            ) : null}
                            <Badge variant="outline" className="capitalize">
                              <MapPin className="mr-1 h-3 w-3" /> {plan.locationKind}
                            </Badge>
                            <WorkoutLifecycleBadge
                              state={workoutPlanLifecycleState(
                                plan.status,
                                plan.suggestedWorkoutId,
                                draft?.loadedSuggestionId,
                              )}
                            />
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
            ) : recommendation ? (
              <Card className="border-violet-400/30 bg-violet-400/[0.05]">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">Suggested {recommendation.title}</p>
                        <Badge variant="outline">Normal readiness</Badge>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {recommendation.basis}
                      </p>
                    </div>
                    <Sparkles className="h-5 w-5 shrink-0 text-violet-300" />
                  </div>

                  <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-background/30">
                    {recommendation.movements.slice(0, 2).map((movement) => (
                      <div key={movement.exercise} className="p-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-1">
                          <p className="text-sm font-medium">{movement.exercise}</p>
                          <p className="text-[11px] text-foreground/75">
                            {targetSummary(movement)}
                          </p>
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                          {movement.reason}
                        </p>
                      </div>
                    ))}
                    {recommendation.movements.length > 2 ? (
                      <p className="p-3 text-xs text-muted-foreground">
                        +{recommendation.movements.length - 2} more movements in Plan
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <Button onClick={startRecommendedWorkout} disabled={startingRecommendation}>
                      {startingRecommendation ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="mr-2 h-4 w-4" />
                      )}
                      {draft ? "Resume draft first" : "Start recommendation"}
                    </Button>
                    <Button variant="outline" onClick={adjustRecommendation}>
                      Adjust in Plan
                    </Button>
                  </div>
                </CardContent>
              </Card>
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
                <Play className="mr-2 h-4 w-4" />{" "}
                {draft ? "Open workout log" : "Start empty workout"}
              </Link>
            </Button>
            <Button asChild variant="ghost" className="sm:flex-1">
              <Link to="/progress">Review progress</Link>
            </Button>
          </div>
        </div>
      </details>

      <AlertDialog open={discardDraftOpen} onOpenChange={setDiscardDraftOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this workout?</AlertDialogTitle>
            <AlertDialogDescription>
              The unfinished draft, including its movements, sets and methods, will be permanently
              cleared. Completed workouts will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep workout</AlertDialogCancel>
            <AlertDialogAction onClick={discardDraft}>Cancel workout</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
