import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Shuffle, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  eligibleKettlebellWorkouts,
  KETTLEBELL_OPTIONS,
  pickKettlebellWorkout,
  readKettlebellPickerState,
  type KettlebellPickerState,
  type KettlebellSelection,
} from "@/lib/kettlebell-workouts";
import {
  getKettlebellCatalogueClient,
  startKettlebellWorkoutClient,
} from "@/lib/supabase-kettlebell.browser";
import { WORKOUT_PLAN_DRAFT_KEY } from "@/lib/workout-plan";
import { readWorkoutDraftSummary, workoutSessionDraftKey } from "@/lib/workout-local-state";

export function KettlebellWorkoutPicker({
  hasUnfinishedWorkout,
}: {
  hasUnfinishedWorkout: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<KettlebellPickerState | null>(null);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const restoredKey = useRef<string | null>(null);
  const [handoffReady, setHandoffReady] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const catalogue = useQuery({
    queryKey: ["kettlebell-catalogue"],
    queryFn: getKettlebellCatalogueClient,
    enabled: open,
    retry: false,
  });
  const data = catalogue.data;
  const storageKey = data ? `kettlebell-picker:${data.personId}` : null;
  useEffect(() => {
    if (!storageKey || !data || restoredKey.current === storageKey) return;
    restoredKey.current = storageKey;
    const saved = readKettlebellPickerState(window.localStorage.getItem(storageKey));
    setState(
      saved ?? {
        category: "random",
        locationId: data.locations[0]?.id ?? "",
        bellCount: 1,
        offeredIds: [],
        previewId: null,
        previewVersion: null,
        requestId: crypto.randomUUID(),
      },
    );
    // Refetches must not overwrite a selection being reviewed.
  }, [data, storageKey]);

  const location = data?.locations.find((item) => item.id === state?.locationId);
  const eligibleFor = (selection: KettlebellPickerState) => {
    if (!data) return [];
    const selectedLocation = data.locations.find((item) => item.id === selection.locationId);
    const equipmentIds =
      selectedLocation?.equipmentIds.filter((id) =>
        data.equipmentItems.some((item) => item.id === id),
      ) ?? [];
    return eligibleKettlebellWorkouts(data.workouts, selection.category, {
      locationId: selection.locationId,
      bellCount: selection.bellCount,
      equipmentIds,
      hasKettlebells: data.equipmentItems.some(
        (item) => item.circuitGroup === "kettlebell" && equipmentIds.includes(item.id),
      ),
      enabledExerciseIds: data.exercises
        .filter((item) => item.availableLocationIds.includes(selection.locationId))
        .map((item) => item.id),
    });
  };
  const eligible = state ? eligibleFor(state) : [];
  const preview = eligible.find(
    (workout) => workout.id === state?.previewId && workout.version === state.previewVersion,
  );
  const exhausted =
    eligible.length > 0 && eligible.every((workout) => state?.offeredIds.includes(workout.id));
  const saveState = (next: KettlebellPickerState) => {
    setState(next);
    if (storageKey) window.localStorage.setItem(storageKey, JSON.stringify(next));
  };
  const change = (updates: Partial<KettlebellPickerState>) => {
    if (!state || startingRef.current) return;
    const next: KettlebellPickerState = {
      ...state,
      ...updates,
      previewId: null,
      previewVersion: null,
      requestId: crypto.randomUUID(),
    };
    if (state.previewId && (updates.category || updates.locationId || updates.bellCount)) {
      const chosen = pickKettlebellWorkout(eligibleFor(next), next.offeredIds, data?.recentIds);
      if (chosen) {
        next.previewId = chosen.id;
        next.previewVersion = chosen.version;
        next.offeredIds = [...next.offeredIds, chosen.id];
      }
    }
    saveState(next);
  };
  const draw = (restart = false) => {
    if (!state || startingRef.current) return;
    const offeredIds = restart ? [] : state.offeredIds;
    const workout = pickKettlebellWorkout(eligible, offeredIds, data?.recentIds);
    if (!workout) return;
    saveState({
      ...state,
      offeredIds: [...offeredIds, workout.id],
      previewId: workout.id,
      previewVersion: workout.version,
      requestId: crypto.randomUUID(),
    });
  };
  const start = async () => {
    if (!preview || !state || !location || startingRef.current) return;
    if (
      hasUnfinishedWorkout ||
      readWorkoutDraftSummary(window.localStorage.getItem(workoutSessionDraftKey())) ||
      window.localStorage.getItem(WORKOUT_PLAN_DRAFT_KEY)
    ) {
      toast.message("Resume or cancel your unfinished workout first.");
      return;
    }
    startingRef.current = true;
    setStarting(true);
    try {
      const plan = await startKettlebellWorkoutClient(
        preview,
        location.id,
        state.bellCount,
        state.requestId,
      );
      window.localStorage.setItem(WORKOUT_PLAN_DRAFT_KEY, JSON.stringify(plan));
      setHandoffReady(true);
      saveState({
        ...state,
        previewId: null,
        previewVersion: null,
        offeredIds: [],
        requestId: crypto.randomUUID(),
      });
      await queryClient.invalidateQueries({ queryKey: ["next-suggested-workouts"] });
      await navigate({ to: "/log" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The kettlebell workout could not be started.",
      );
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  return (
    <Card className="border-primary/25 bg-primary/5">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Kettlebell workout</h2>
            <p className="text-sm text-muted-foreground">
              A standalone session, separate from your programmes.
            </p>
          </div>
          {!open && (
            <Button type="button" variant="outline" onClick={() => setOpen(true)}>
              <Shuffle className="mr-2 h-4 w-4" />
              Pick a kettlebell workout
            </Button>
          )}
        </div>
        {open && (
          <div className="space-y-4">
            <fieldset disabled={starting || handoffReady} className="space-y-2">
              <legend className="mb-2 text-sm font-medium">Workout category</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {KETTLEBELL_OPTIONS.map((option) => (
                  <Button
                    type="button"
                    key={option.value}
                    variant={state?.category === option.value ? "default" : "outline"}
                    aria-pressed={(state?.category ?? "random") === option.value}
                    onClick={() => change({ category: option.value as KettlebellSelection })}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </fieldset>
            {catalogue.isLoading && (
              <p role="status" className="text-sm text-muted-foreground">
                Loading kettlebell workouts…
              </p>
            )}
            {catalogue.isError && (
              <div role="alert" className="space-y-2">
                <p className="text-sm">The kettlebell library could not be loaded.</p>
                <Button variant="outline" onClick={() => void catalogue.refetch()}>
                  Try again
                </Button>
              </div>
            )}
            {data && state && (
              <>
                {data.workouts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {data.totalRecords === 0
                      ? "The Strong ON! workouts haven't been added yet. The first batch will contain workouts 1–5 from Strength, Muscle and Conditioning."
                      : "The stored workouts still need checking before they can be offered."}
                  </p>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1 text-sm">
                        Training location
                        <select
                          className="block w-full rounded-lg border border-border bg-background p-2"
                          aria-label="Kettlebell training location"
                          value={state.locationId}
                          disabled={starting || handoffReady}
                          onChange={(event) =>
                            change({ locationId: event.target.value, bellCount: 1 })
                          }
                        >
                          <option value="" disabled>
                            Choose a location
                          </option>
                          {data.locations.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-sm">
                        Kettlebells available
                        <select
                          className="block w-full rounded-lg border border-border bg-background p-2"
                          aria-label="Kettlebells available"
                          value={state.bellCount}
                          disabled={starting || handoffReady}
                          onChange={(event) =>
                            change({ bellCount: Number(event.target.value) as 1 | 2 })
                          }
                        >
                          <option value={1}>One kettlebell</option>
                          <option value={2}>Two kettlebells</option>
                        </select>
                      </label>
                    </div>
                    {!eligible.length && (
                      <p role="status" className="text-sm text-muted-foreground">
                        No {state.category === "random" ? "kettlebell" : state.category} workouts
                        match this location and equipment. Try another category or check your
                        enabled exercises and location equipment.
                      </p>
                    )}
                    {state.previewId && !preview && (
                      <p role="status" className="text-sm text-muted-foreground">
                        Your previous selection is no longer available. Pick a new workout.
                      </p>
                    )}
                    {preview && (
                      <section
                        aria-label="Selected kettlebell workout"
                        className="space-y-3 rounded-xl border border-border bg-background/70 p-4"
                      >
                        <div>
                          <p className="text-xs font-medium capitalize text-primary">
                            {preview.category} · Workout {preview.sourceNumber} ·{" "}
                            {preview.bellCount === 1 ? "One bell" : "Two bells"}
                            {preview.durationMinutes ? ` · ${preview.durationMinutes} min` : ""}
                          </p>
                          <h3 className="mt-1 text-lg font-semibold">{preview.title}</h3>
                          <p className="text-sm text-muted-foreground">{preview.summary}</p>
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{preview.instructions}</p>
                        <ol className="space-y-3">
                          {preview.prescription.movements.map((movement, index) => (
                            <li key={index} className="text-sm">
                              <p className="font-medium">
                                {index + 1}. {movement.exercise}
                              </p>
                              <p className="whitespace-pre-wrap text-muted-foreground">
                                {movement.reason}
                              </p>
                              <p>
                                {movement.setRows
                                  .map(
                                    (set, setIndex) =>
                                      `Set ${setIndex + 1}: ${set.reps ? `${set.reps} reps` : `${set.durationSeconds} sec`}${set.weight ? ` · ${set.weight} kg` : ""}`,
                                  )
                                  .join("; ")}
                              </p>
                              {movement.restTime && (
                                <p className="text-muted-foreground">Rest: {movement.restTime}</p>
                              )}
                              {movement.targets.detail && (
                                <p className="whitespace-pre-wrap text-muted-foreground">
                                  {movement.targets.detail}
                                </p>
                              )}
                            </li>
                          ))}
                        </ol>
                        {preview.prescription.methodBlocks.map((block, index) => (
                          <p key={index} className="text-sm">
                            {block.methodName}:{" "}
                            {block.memberMovementIndexes
                              .map((member) => preview.prescription.movements[member].exercise)
                              .join(" → ")}
                            {block.rounds ? ` · ${block.rounds} rounds` : ""}
                            {block.blockDurationMinutes
                              ? ` · ${block.blockDurationMinutes} min`
                              : ""}
                            {block.config.mode === "timed_sequence" &&
                            typeof block.config.round_seconds === "number"
                              ? ` · ${block.config.round_seconds / 60} min per round`
                              : ""}
                            {block.restBetweenRoundsSeconds
                              ? ` · ${block.restBetweenRoundsSeconds} sec between rounds`
                              : ""}
                            {block.config.mode === "emom" &&
                            typeof block.config.interval_seconds === "number"
                              ? ` · Start every ${block.config.interval_seconds} sec`
                              : ""}
                            {block.workIntervalSeconds
                              ? ` · ${block.workIntervalSeconds} sec work`
                              : ""}
                            {block.restIntervalSeconds
                              ? ` / ${block.restIntervalSeconds} sec rest`
                              : ""}
                          </p>
                        ))}
                        {preview.sourceReference && (
                          <p className="text-xs text-muted-foreground">
                            Strong ON! · {preview.sourceReference}
                          </p>
                        )}
                      </section>
                    )}
                    {exhausted && (
                      <p className="text-sm text-muted-foreground">
                        You&apos;ve seen all matching workouts. You can restart the shuffle.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {preview && (
                        <Button
                          type="button"
                          disabled={starting || handoffReady || hasUnfinishedWorkout}
                          onClick={() => void start()}
                        >
                          {starting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="mr-2 h-4 w-4" />
                          )}
                          Start this workout
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!eligible.length || starting || handoffReady || exhausted}
                        onClick={() => draw()}
                      >
                        <Shuffle className="mr-2 h-4 w-4" />
                        {preview ? "Choose another" : "Pick workout"}
                      </Button>
                      {exhausted && (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={starting || handoffReady}
                          onClick={() => draw(true)}
                        >
                          Restart shuffle
                        </Button>
                      )}
                    </div>
                    {hasUnfinishedWorkout && (
                      <p className="text-sm text-muted-foreground">
                        Resume or cancel your unfinished workout before starting another.
                      </p>
                    )}
                    {handoffReady && (
                      <Button asChild>
                        <Link to="/log">Open workout log</Link>
                      </Button>
                    )}
                  </>
                )}
              </>
            )}
            <Button
              type="button"
              variant="ghost"
              disabled={starting || handoffReady}
              onClick={() => {
                if (state) change({ previewId: null, previewVersion: null });
                setOpen(false);
              }}
            >
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
