import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Loader2, Sparkles, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  type ProgrammeSupportPlacement,
  type ProgrammeSupportTrack,
  type SkillGoalExercise,
} from "@/lib/programme-support";
import { listGoalsClient } from "@/lib/supabase-goals.browser";
import { getLibraryClient } from "@/lib/supabase-log.browser";
import { listMobilityDataClient } from "@/lib/supabase-mobility.browser";
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

type TrackConfig = ProgrammeSupportTrack;

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

  const exerciseById = useMemo(
    () => new Map((library.data?.exercises ?? []).map((exercise) => [exercise.id, exercise])),
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
  const loading = goals.isLoading || mobility.isLoading || library.isLoading || scheduled.isLoading;

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
            const saved = await saveWorkoutPlanClient({
              draft: buildSkillGoalDraft({
                goal,
                exercise,
                locationKind: occurrence.locationKind,
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
                <h3 className="text-sm font-semibold">Proposed first four weeks</h3>
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
