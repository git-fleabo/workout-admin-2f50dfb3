import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Loader2, Plus, Sparkles, Target, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatUKDate, todayISO } from "@/lib/date";
import { MOBILITY_SKILLS, buildMobilityWorkoutDraft } from "@/lib/mobility-practice";
import {
  buildProgrammeSupportSchedule,
  buildSkillGoalDraft,
  defaultSkillGoalLocation,
  isSupportedSkillGoal,
  programmeSupportHorizon,
  recommendSkillPracticeDose,
  type ProgrammeSupportPlacement,
  type ProgrammeSupportTrack,
  type SkillGoalExercise,
  type SkillPracticeDoseRecommendation,
} from "@/lib/programme-support";
import { getTrackingModeValue } from "@/lib/movement-metrics";
import { addGoalClient, listGoalsClient } from "@/lib/supabase-goals.browser";
import { getLibraryClient } from "@/lib/supabase-log.browser";
import { listMobilityDataClient } from "@/lib/supabase-mobility.browser";
import { getProgrammeSkillSupportHistoryClient } from "@/lib/supabase-programme-support.browser";
import {
  archiveProgrammeSupportPlansClient,
  getScheduledWorkoutPlansClient,
  saveWorkoutPlanClient,
  updateSuggestedWorkoutStatusClient,
} from "@/lib/supabase-plans.browser";
import type { PersonalProgrammeSession } from "@/lib/personal-programme";
import type { PlannerLocation } from "@/lib/workout-plan";

type AvailableTrack = {
  id: string;
  sourceId: string;
  kind: "goal" | "mobility";
  title: string;
  detail: string;
  defaultPlacement: ProgrammeSupportPlacement;
  defaultLocation: PlannerLocation;
  availableLocations: PlannerLocation[];
};

type TrackConfig = ProgrammeSupportTrack & {
  skillSets?: number;
  skillDose?: number;
};

type NewSkillGoalForm = {
  exerciseId: string;
  targetValue: string;
  startingValue: string;
  deadline: string;
};

const BLANK_SKILL_GOAL: NewSkillGoalForm = {
  exerciseId: "",
  targetValue: "",
  startingValue: "",
  deadline: "",
};

function futureWindow(sessions: PersonalProgrammeSession[]) {
  const dates = sessions
    .map((session) => session.scheduledDate)
    .filter(Boolean)
    .sort();
  const firstFuture = dates.find((date) => date >= todayISO()) ?? dates[0] ?? todayISO();
  const startDate = firstFuture < todayISO() ? todayISO() : firstFuture;
  const programmeEnd = dates.at(-1) ?? startDate;
  return {
    startDate,
    endDate: programmeSupportHorizon(
      startDate,
      programmeEnd < startDate ? startDate : programmeEnd,
    ),
    programmeDates: dates,
  };
}

export function ProgrammeSupportPlanner({
  assignmentId,
  programmeName,
  sessions,
}: {
  assignmentId: string;
  programmeName: string;
  sessions: PersonalProgrammeSession[];
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, TrackConfig>>({});
  const [creatingGoal, setCreatingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState<NewSkillGoalForm>(BLANK_SKILL_GOAL);
  const window = useMemo(() => futureWindow(sessions), [sessions]);
  const goals = useQuery({ queryKey: ["programme-support-goals"], queryFn: listGoalsClient });
  const mobility = useQuery({
    queryKey: ["programme-support-mobility"],
    queryFn: listMobilityDataClient,
  });
  const library = useQuery({
    queryKey: ["programme-support-library"],
    queryFn: getLibraryClient,
  });
  const scheduled = useQuery({
    queryKey: ["programme-support-schedule", assignmentId, window.startDate, window.endDate],
    queryFn: () => getScheduledWorkoutPlansClient(window.startDate, window.endDate),
  });
  const skillHistory = useQuery({
    queryKey: ["programme-skill-support-history", assignmentId],
    queryFn: () => getProgrammeSkillSupportHistoryClient(assignmentId),
  });

  const exerciseById = useMemo(
    () => new Map((library.data?.exercises ?? []).map((exercise) => [exercise.id, exercise])),
    [library.data?.exercises],
  );
  const skillExercises = useMemo(
    () =>
      (library.data?.exercises ?? []).filter((exercise) => {
        const trackingMode = getTrackingModeValue({
          workoutType: exercise.workoutType,
          movement: exercise.name,
          defaultMetric: exercise.metric,
        });
        return (
          exercise.workoutType.trim().toLowerCase() === "skills/calisthenics" &&
          ["reps_only", "hold", "grip_hold"].includes(trackingMode) &&
          exercise.availableLocationKinds.some((location) => ["home", "gym"].includes(location))
        );
      }) as SkillGoalExercise[],
    [library.data?.exercises],
  );
  const available = useMemo<AvailableTrack[]>(() => {
    const skillGoals = (goals.data?.items ?? []).flatMap((goal) => {
      const exercise = exerciseById.get(goal.exerciseId) as SkillGoalExercise | undefined;
      if (!isSupportedSkillGoal(goal, exercise)) return [];
      const availableLocations = ["home", "gym"].filter((location) =>
        exercise?.availableLocationKinds.includes(location as PlannerLocation),
      ) as PlannerLocation[];
      if (!exercise || !availableLocations.length) return [];
      return [
        {
          id: `goal:${goal.id}`,
          sourceId: goal.id,
          kind: "goal" as const,
          title: goal.goal,
          detail: `${exercise.name} · ${goal.targetValue ? `${goal.targetValue} ${goal.targetUnit || goal.goalMetric}` : "practice goal"}`,
          defaultPlacement: "with_strength" as const,
          defaultLocation: defaultSkillGoalLocation(exercise),
          availableLocations,
        },
      ];
    });
    const mobilityRuns = (mobility.data?.runs ?? []).flatMap((run) => {
      const activeDrills = (mobility.data?.drills ?? []).filter(
        (drill) => drill.runId === run.id && drill.isActive,
      );
      if (run.status !== "active" || !activeDrills.length) return [];
      return [
        {
          id: `mobility:${run.id}`,
          sourceId: run.id,
          kind: "mobility" as const,
          title: MOBILITY_SKILLS[run.skill].label,
          detail: `${activeDrills.length} saved drill${activeDrills.length === 1 ? "" : "s"}`,
          defaultPlacement: "separate" as const,
          defaultLocation: "home" as const,
          availableLocations: ["home", "gym"] as PlannerLocation[],
        },
      ];
    });
    return [...skillGoals, ...mobilityRuns];
  }, [exerciseById, goals.data?.items, mobility.data?.drills, mobility.data?.runs]);

  const recommendationFor = (track: AvailableTrack): SkillPracticeDoseRecommendation | null => {
    if (track.kind !== "goal") return null;
    const goal = goals.data?.items.find((item) => item.id === track.sourceId);
    const exercise = goal
      ? (exerciseById.get(goal.exerciseId) as SkillGoalExercise | undefined)
      : undefined;
    if (!goal || !exercise) return null;
    return recommendSkillPracticeDose({
      goal,
      exercise,
      history: skillHistory.data?.[goal.id] ?? [],
    });
  };

  const chosenTracks = Object.values(selected);
  const preview = useMemo(
    () =>
      buildProgrammeSupportSchedule({
        ...window,
        tracks: chosenTracks,
      }),
    [chosenTracks, window],
  );
  const existing = (scheduled.data ?? []).filter(
    (plan) => plan.programAssignmentId === assignmentId && !plan.programWorkoutId,
  );
  const loading =
    goals.isLoading ||
    mobility.isLoading ||
    library.isLoading ||
    scheduled.isLoading ||
    skillHistory.isLoading;

  const selectedNewGoalExercise = skillExercises.find(
    (exercise) => exercise.id === newGoal.exerciseId,
  );
  const selectedNewGoalMode = selectedNewGoalExercise
    ? getTrackingModeValue({
        workoutType: selectedNewGoalExercise.workoutType,
        movement: selectedNewGoalExercise.name,
        defaultMetric: selectedNewGoalExercise.metric,
      })
    : null;
  const selectedNewGoalHolds =
    selectedNewGoalMode === "hold" || selectedNewGoalMode === "grip_hold";

  const createGoal = useMutation({
    mutationFn: async () => {
      if (!selectedNewGoalExercise || !selectedNewGoalMode) {
        throw new Error("Choose a calisthenics movement from your Library.");
      }
      const targetValue = Number(newGoal.targetValue);
      const startingValue = newGoal.startingValue.trim() ? Number(newGoal.startingValue) : null;
      if (!Number.isFinite(targetValue) || targetValue <= 0 || !Number.isInteger(targetValue)) {
        throw new Error("Enter a whole-number target greater than zero.");
      }
      if (startingValue != null && (!Number.isFinite(startingValue) || startingValue < 0)) {
        throw new Error("Enter a valid current best, or leave it blank.");
      }
      if (startingValue != null && startingValue >= targetValue) {
        throw new Error("The target should be greater than your current best.");
      }
      const unit = selectedNewGoalHolds ? "seconds" : "reps";
      const title = selectedNewGoalHolds
        ? `Hold ${selectedNewGoalExercise.name} for ${targetValue} seconds`
        : `Complete ${targetValue} ${selectedNewGoalExercise.name} reps`;
      const fields = {
        goal: title,
        goalType: "performance" as const,
        exerciseId: selectedNewGoalExercise.id,
        trackingMode: selectedNewGoalMode,
        goalMetric: selectedNewGoalHolds ? ("hold_seconds" as const) : ("reps" as const),
        targetValue,
        targetUnit: unit,
        startingValue,
        deadline: newGoal.deadline,
        metric: unit,
        target: String(targetValue),
        period: "static",
        notes: "",
      };
      const result = await addGoalClient(fields);
      if (!result.goalId) throw new Error("The goal was not created.");
      return { ...result, fields, exercise: selectedNewGoalExercise };
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["goals"] }),
        queryClient.invalidateQueries({ queryKey: ["programme-support-goals"] }),
      ]);
      const refreshed = await goals.refetch();
      const created = refreshed.data?.items.find((item) => item.id === result.goalId);
      if (created) {
        const recommendation = recommendSkillPracticeDose({
          goal: created,
          exercise: result.exercise,
        });
        setSelected((current) => {
          if (Object.keys(current).length >= 2) return current;
          return {
            ...current,
            [`goal:${created.id}`]: {
              id: `goal:${created.id}`,
              kind: "goal",
              title: created.goal,
              sessionsPerWeek: 2,
              placement: "with_strength",
              locationKind: defaultSkillGoalLocation(result.exercise),
              skillSets: recommendation.sets,
              skillDose: recommendation.value,
            },
          };
        });
      }
      setCreatingGoal(false);
      setNewGoal(BLANK_SKILL_GOAL);
      toast.success("Calisthenics goal created", {
        description: created
          ? "It is selected for this programme."
          : "It is now available in Goals.",
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      const insertedIds: string[] = [];
      try {
        for (const occurrence of preview) {
          const source = available.find((item) => item.id === occurrence.trackId);
          if (!source) throw new Error("A selected supporting goal is no longer available.");
          if (source.kind === "goal") {
            const goal = goals.data?.items.find((item) => item.id === source.sourceId);
            const exercise = goal
              ? (exerciseById.get(goal.exerciseId) as SkillGoalExercise | undefined)
              : undefined;
            if (!goal || !exercise)
              throw new Error(`${source.title} is missing its Library movement.`);
            const config = selected[source.id];
            const recommendation = recommendationFor(source);
            if (!config || !recommendation) {
              throw new Error(`${source.title} needs a reviewed practice dose.`);
            }
            const reviewedDose = {
              sets: config.skillSets ?? recommendation.sets,
              value: config.skillDose ?? recommendation.value,
              explanation:
                config.skillSets === recommendation.sets &&
                config.skillDose === recommendation.value
                  ? recommendation.explanation
                  : `You reviewed and set ${config.skillSets ?? recommendation.sets} × ${config.skillDose ?? recommendation.value} ${recommendation.unit}.`,
            };
            const saved = await saveWorkoutPlanClient({
              draft: buildSkillGoalDraft({
                goal,
                exercise,
                locationKind: occurrence.locationKind,
                dose: reviewedDose,
              }),
              readiness: "normal",
              status: "pending",
              suggestedFor: occurrence.date,
              planKind: "skill",
              programAssignmentId: assignmentId,
              goalId: goal.id,
              replaceExisting: false,
            });
            insertedIds.push(saved.suggestedWorkoutId);
          } else {
            const run = mobility.data?.runs.find((item) => item.id === source.sourceId);
            if (!run || !library.data) throw new Error(`${source.title} is no longer available.`);
            const saved = await saveWorkoutPlanClient({
              draft: buildMobilityWorkoutDraft({
                run,
                drills: (mobility.data?.drills ?? []).filter((drill) => drill.runId === run.id),
                library: library.data.exercises,
                locationKind: occurrence.locationKind,
              }),
              readiness: "normal",
              status: "pending",
              suggestedFor: occurrence.date,
              planKind: "mobility",
              programAssignmentId: assignmentId,
              replaceExisting: false,
            });
            insertedIds.push(saved.suggestedWorkoutId);
          }
        }
        await archiveProgrammeSupportPlansClient(assignmentId, insertedIds);
        return insertedIds.length;
      } catch (error) {
        await Promise.all(
          insertedIds.map((id) =>
            updateSuggestedWorkoutStatusClient(id, "archived").catch(() => undefined),
          ),
        );
        throw error;
      }
    },
    onSuccess: async (count) => {
      setOpen(false);
      await Promise.all(
        ["programme-support-schedule", "scheduled-workout-plans", "next-suggested-workouts"].map(
          (key) => queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
      toast.success(`${count} supporting session${count === 1 ? "" : "s"} scheduled`, {
        description: "They can be moved or removed from Your week at a glance.",
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = (track: AvailableTrack, enabled: boolean) => {
    const recommendation = recommendationFor(track);
    setSelected((current) => {
      if (!enabled) {
        const next = { ...current };
        delete next[track.id];
        return next;
      }
      if (Object.keys(current).length >= 2) return current;
      return {
        ...current,
        [track.id]: {
          id: track.id,
          kind: track.kind,
          title: track.title,
          sessionsPerWeek: 2,
          placement: track.defaultPlacement,
          locationKind: track.defaultLocation,
          skillSets: recommendation?.sets,
          skillDose: recommendation?.value,
        },
      };
    });
  };

  const updateTrack = (id: string, patch: Partial<TrackConfig>) =>
    setSelected((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  return (
    <Card className="space-y-4 border-cyan-400/25 bg-cyan-400/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-cyan-300" />
            <h4 className="font-semibold">Supporting goals</h4>
          </div>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Add up to two mobility or calisthenics practices around the strength programme. The
            strength sessions and their progression stay unchanged.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 h-4 w-4" />
          )}
          {existing.length ? "Rebuild support schedule" : "Build supporting goals"}
        </Button>
      </div>

      {existing.length ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-cyan-200">Next four weeks</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {existing.map((plan) => (
              <div key={plan.suggestedWorkoutId} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{plan.title}</p>
                  <Badge variant="outline">
                    {plan.planKind === "skill" ? "Skill" : "Mobility"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatUKDate(plan.suggestedFor ?? "")} ·{" "}
                  {plan.locationKind === "home" ? "Home" : "Gym"}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No supporting sessions are attached to this programme yet.
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Build supporting goals around {programmeName}</DialogTitle>
            <DialogDescription>
              Choose no more than two priorities. The app proposes the next four weeks before it
              saves anything.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-dashed border-cyan-400/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Need a calisthenics goal?</p>
                <p className="text-xs text-muted-foreground">
                  Create one from an enabled Skills/Calisthenics Library movement.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!skillExercises.length}
                onClick={() => {
                  setCreatingGoal((current) => !current);
                  setNewGoal({
                    ...BLANK_SKILL_GOAL,
                    exerciseId: skillExercises[0]?.id ?? "",
                  });
                }}
              >
                {creatingGoal ? (
                  <X className="mr-1.5 h-4 w-4" />
                ) : (
                  <Plus className="mr-1.5 h-4 w-4" />
                )}
                {creatingGoal ? "Cancel new goal" : "Create calisthenics goal"}
              </Button>
            </div>
            {!skillExercises.length ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Enable a supported Skills/Calisthenics movement in Library first.
              </p>
            ) : null}
            {creatingGoal ? (
              <div className="mt-3 space-y-3 border-t border-border pt-3">
                <div className="space-y-1.5">
                  <Label>Movement</Label>
                  <Select
                    value={newGoal.exerciseId}
                    onValueChange={(exerciseId) =>
                      setNewGoal((current) => ({ ...current, exerciseId }))
                    }
                  >
                    <SelectTrigger aria-label="Calisthenics movement">
                      <SelectValue placeholder="Choose a movement" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {skillExercises.map((exercise) => (
                        <SelectItem key={exercise.id} value={exercise.id}>
                          {exercise.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-skill-target">
                      Target ({selectedNewGoalHolds ? "seconds" : "reps"})
                    </Label>
                    <Input
                      id="new-skill-target"
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={newGoal.targetValue}
                      onChange={(event) =>
                        setNewGoal((current) => ({
                          ...current,
                          targetValue: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-skill-start">Current best (optional)</Label>
                    <Input
                      id="new-skill-start"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={newGoal.startingValue}
                      onChange={(event) =>
                        setNewGoal((current) => ({
                          ...current,
                          startingValue: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-skill-deadline">Deadline (optional)</Label>
                    <Input
                      id="new-skill-deadline"
                      type="date"
                      value={newGoal.deadline}
                      onChange={(event) =>
                        setNewGoal((current) => ({ ...current, deadline: event.target.value }))
                      }
                    />
                  </div>
                </div>
                {selectedNewGoalExercise && newGoal.targetValue ? (
                  <p className="text-xs text-muted-foreground">
                    Goal: {selectedNewGoalHolds ? "Hold" : "Complete"}{" "}
                    {selectedNewGoalExercise.name}{" "}
                    {selectedNewGoalHolds
                      ? `for ${newGoal.targetValue} seconds`
                      : `for ${newGoal.targetValue} reps`}
                    . The first practice dose will come from its Library defaults.
                  </p>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  disabled={!newGoal.exerciseId || !newGoal.targetValue || createGoal.isPending}
                  onClick={() => createGoal.mutate()}
                >
                  {createGoal.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-1.5 h-4 w-4" />
                  )}
                  Create and select goal
                </Button>
              </div>
            ) : null}
          </div>

          {!available.length ? (
            <Card className="border-dashed p-4 text-sm text-muted-foreground">
              Add an exercise-linked calisthenics goal or configure an active mobility practice
              first. Free-text goals are not used to invent exercises or doses.
            </Card>
          ) : (
            <div className="space-y-3">
              {available.map((track) => {
                const config = selected[track.id];
                const atLimit = !config && chosenTracks.length >= 2;
                const recommendation = recommendationFor(track);
                return (
                  <div key={track.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={`support-${track.id}`}
                        checked={Boolean(config)}
                        disabled={atLimit}
                        onCheckedChange={(checked) => toggle(track, checked === true)}
                      />
                      <Label htmlFor={`support-${track.id}`} className="flex-1 cursor-pointer">
                        <span className="block font-medium">{track.title}</span>
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                          {track.kind === "goal" ? "Calisthenics goal" : "Mobility practice"} ·{" "}
                          {track.detail}
                        </span>
                      </Label>
                    </div>
                    {config ? (
                      <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label>Frequency</Label>
                          <Select
                            value={String(config.sessionsPerWeek)}
                            onValueChange={(value) =>
                              updateTrack(track.id, { sessionsPerWeek: Number(value) })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3].map((count) => (
                                <SelectItem key={count} value={String(count)}>
                                  {count}× weekly
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Placement</Label>
                          <Select
                            value={config.placement}
                            onValueChange={(value) =>
                              updateTrack(track.id, {
                                placement: value as ProgrammeSupportPlacement,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="with_strength">With strength</SelectItem>
                              <SelectItem value="separate">Separate days</SelectItem>
                              <SelectItem value="either">Either</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Place</Label>
                          <Select
                            value={config.locationKind}
                            onValueChange={(value) =>
                              updateTrack(track.id, { locationKind: value as PlannerLocation })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {track.availableLocations.map((location) => (
                                <SelectItem key={location} value={location}>
                                  {location === "home" ? "Home" : "Gym"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {track.kind === "goal" && recommendation ? (
                          <div className="space-y-3 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.04] p-3 sm:col-span-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium">Four-week dose review</p>
                              <Badge variant="outline">
                                {recommendation.decision === "progress"
                                  ? "Small increase"
                                  : recommendation.decision === "goal_reached"
                                    ? "Goal dose reached"
                                    : recommendation.decision === "repeat"
                                      ? "Repeat dose"
                                      : "Starting dose"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {recommendation.explanation}
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label>Sets</Label>
                                <Select
                                  value={String(config.skillSets ?? recommendation.sets)}
                                  onValueChange={(value) =>
                                    updateTrack(track.id, { skillSets: Number(value) })
                                  }
                                >
                                  <SelectTrigger aria-label={`${track.title} practice sets`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[1, 2, 3, 4, 5, 6].map((count) => (
                                      <SelectItem key={count} value={String(count)}>
                                        {count}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor={`dose-${track.sourceId}`}>
                                  {recommendation.unit === "seconds"
                                    ? "Seconds per set"
                                    : "Reps per set"}
                                </Label>
                                <Input
                                  id={`dose-${track.sourceId}`}
                                  type="number"
                                  min="1"
                                  max={recommendation.unit === "seconds" ? 300 : 100}
                                  step="1"
                                  inputMode="numeric"
                                  value={config.skillDose ?? recommendation.value}
                                  onChange={(event) => {
                                    const value = Number(event.target.value);
                                    if (Number.isFinite(value) && value > 0) {
                                      updateTrack(track.id, { skillDose: value });
                                    }
                                  }}
                                />
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Progression needs four different successful weeks at the same dose.
                              You can accept or change the recommendation before saving.
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {preview.length ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CalendarPlus className="h-4 w-4 text-cyan-300" />
                <h3 className="text-sm font-semibold">Proposed next four weeks</h3>
              </div>
              <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                {preview.map((item) => (
                  <div
                    key={`${item.trackId}:${item.date}`}
                    className="rounded-lg border border-border p-2.5"
                  >
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatUKDate(item.date)} ·{" "}
                      {item.pairedWithStrength ? "after strength" : "separate session"}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Saving replaces this programme’s unopened supporting sessions. Strength sessions and
                completed history are untouched.
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!preview.length || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Save {preview.length || ""} supporting session{preview.length === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
