import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  BatteryLow,
  BatteryMedium,
  Building2,
  Dumbbell,
  Home,
  Info,
  Layers3,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { WeeklyPlanOverview } from "@/components/weekly-plan-overview";
import { WeeklyRecoveryCard } from "@/components/weekly-recovery-card";
import { formatUKDate, todayISO } from "@/lib/date";
import { getLibraryClient, getRecentLogsClient } from "@/lib/supabase-log.browser";
import {
  getRecentWorkoutMethodBlocksClient,
  saveWorkoutPlanClient,
} from "@/lib/supabase-plans.browser";
import { getSupabaseSession } from "@/lib/supabase-public";
import { getWeeklyLoadHistoryClient } from "@/lib/supabase-weekly-load.browser";
import {
  buildWeeklyPlan,
  readWeeklyPlanAdjustments,
  type WeeklyPlanAdjustments,
  type WeeklyPlanItemKind,
} from "@/lib/weekly-plan";
import {
  buildWeeklyRecoveryRecommendation,
  readWeeklyRecoveryMode,
  type WeeklyRecoveryMode,
} from "@/lib/weekly-recovery";
import {
  buildWorkoutSuggestion,
  getWorkoutBasisOptions,
  WORKOUT_PLAN_DRAFT_KEY,
  WORKOUT_PLAN_LOCATION_KEY,
  type PlannerLocation,
  type PlannerReadiness,
  type WorkoutPlanMovement,
  type WorkoutPlanMethodBlock,
  type WorkoutPlanSet,
} from "@/lib/workout-plan";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [
      { title: "Plan Next Workout · Training Admin" },
      {
        name: "description",
        content: "Build a transparent next-workout suggestion from recent training history.",
      },
    ],
  }),
  component: PlanPage,
});

const READINESS: {
  value: PlannerReadiness;
  label: string;
  detail: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "normal",
    label: "Normal",
    detail: "Follow the progression evidence",
    icon: <BatteryMedium className="h-4 w-4" />,
  },
  {
    value: "fresh",
    label: "Fresh",
    detail: "Allow a small move up after 5s",
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    value: "tired",
    label: "Tired",
    detail: "Reduce sets and load",
    icon: <BatteryLow className="h-4 w-4" />,
  },
];

function weeklyAdjustmentsStorageKey(startDate: string) {
  const userId = getSupabaseSession()?.user.id ?? "signed-out";
  return `weekly-plan-adjustments:${userId}:${startDate}`;
}

function weeklyRecoveryModeStorageKey(startDate: string) {
  const userId = getSupabaseSession()?.user.id ?? "signed-out";
  return `weekly-recovery-mode:${userId}:${startDate}`;
}

function methodBlockSummary(block: WorkoutPlanMethodBlock) {
  if (block.family === "timed_density") {
    return [
      block.blockDurationMinutes ? `${block.blockDurationMinutes} min` : "",
      block.rounds ? `${block.rounds} rounds` : "",
      block.workIntervalSeconds ? `${block.workIntervalSeconds}s work` : "",
      block.restIntervalSeconds ? `${block.restIntervalSeconds}s rest` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return [
    block.rounds ? `${block.rounds} rounds` : "",
    block.restBetweenMovementsSeconds
      ? `${block.restBetweenMovementsSeconds}s between movements`
      : "",
    block.restBetweenRoundsSeconds ? `${block.restBetweenRoundsSeconds}s between rounds` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function PlanPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
  const weeklyLoad = useQuery({
    queryKey: ["weekly-load-history"],
    queryFn: () => getWeeklyLoadHistoryClient(90),
    staleTime: 60_000,
  });
  const recentSessionIds = useMemo(
    () => Array.from(new Set((history.data?.recent ?? []).map((log) => log.id).filter(Boolean))),
    [history.data?.recent],
  );
  const methodHistory = useQuery({
    queryKey: ["workout-planner-method-history", recentSessionIds],
    queryFn: () => getRecentWorkoutMethodBlocksClient(recentSessionIds),
    enabled: recentSessionIds.length > 0,
    staleTime: 60_000,
  });
  const [location, setLocation] = useState<PlannerLocation>("gym");
  const [readiness, setReadiness] = useState<PlannerReadiness>("normal");
  const [basisDate, setBasisDate] = useState<string | null>(null);
  const [weeklyAdjustments, setWeeklyAdjustments] = useState<WeeklyPlanAdjustments>({});
  const [weeklyRecoveryMode, setWeeklyRecoveryMode] = useState<WeeklyRecoveryMode>("normal");

  useEffect(() => {
    const storedLocation = window.localStorage.getItem(WORKOUT_PLAN_LOCATION_KEY);
    window.localStorage.removeItem(WORKOUT_PLAN_LOCATION_KEY);
    if (storedLocation === "home" || storedLocation === "gym") setLocation(storedLocation);
  }, []);
  const matchingLogs = useMemo(() => {
    const allowed = new Set(
      (library.data?.exercises ?? [])
        .filter(
          (exercise) => exercise.locationScope === "both" || exercise.locationScope === location,
        )
        .map((exercise) => exercise.name.toLowerCase()),
    );
    return (history.data?.recent ?? []).filter((log) => allowed.has(log.exercise.toLowerCase()));
  }, [history.data?.recent, library.data?.exercises, location]);
  const weeklyLogs = useMemo(() => {
    const scopes = new Map(
      (library.data?.exercises ?? []).map((exercise) => [
        exercise.name.toLowerCase(),
        exercise.locationScope,
      ]),
    );
    const recent = history.data?.recent ?? [];
    return {
      home: recent.filter((log) => {
        const scope = scopes.get(log.exercise.toLowerCase());
        return scope === "home" || scope === "both";
      }),
      gym: recent.filter((log) => {
        const scope = scopes.get(log.exercise.toLowerCase());
        return scope === "gym" || scope === "both";
      }),
    };
  }, [history.data?.recent, library.data?.exercises]);
  const weeklyPlan = useMemo(
    () => buildWeeklyPlan(weeklyLogs, todayISO(), weeklyLoad.data ?? []),
    [weeklyLoad.data, weeklyLogs],
  );
  const weeklyRecovery = useMemo(
    () =>
      buildWeeklyRecoveryRecommendation({
        logs: history.data?.recent ?? [],
        loadHistory: weeklyLoad.data ?? [],
        plan: weeklyPlan,
        adjustments: weeklyAdjustments,
        today: weeklyPlan.startDate,
      }),
    [history.data?.recent, weeklyAdjustments, weeklyLoad.data, weeklyPlan],
  );
  const basisOptions = useMemo(
    () => getWorkoutBasisOptions(matchingLogs, location),
    [location, matchingLogs],
  );
  const suggestion = useMemo(
    () =>
      buildWorkoutSuggestion(
        matchingLogs,
        location,
        readiness,
        basisDate,
        methodHistory.data ?? [],
      ),
    [basisDate, location, matchingLogs, methodHistory.data, readiness],
  );
  const [movements, setMovements] = useState<WorkoutPlanMovement[]>([]);
  const [methodBlocks, setMethodBlocks] = useState<WorkoutPlanMethodBlock[]>([]);

  useEffect(() => setBasisDate(null), [location]);

  useEffect(() => {
    if (basisDate && !basisOptions.some((option) => option.date === basisDate)) {
      setBasisDate(null);
    }
  }, [basisDate, basisOptions]);

  useEffect(() => {
    setWeeklyAdjustments(
      readWeeklyPlanAdjustments(
        window.localStorage.getItem(weeklyAdjustmentsStorageKey(weeklyPlan.startDate)),
      ),
    );
  }, [weeklyPlan.startDate]);

  useEffect(() => {
    const stored = readWeeklyRecoveryMode(
      window.localStorage.getItem(weeklyRecoveryModeStorageKey(weeklyPlan.startDate)),
    );
    setWeeklyRecoveryMode(stored);
    if (stored === "deload") setReadiness("tired");
  }, [weeklyPlan.startDate]);

  useEffect(() => {
    setMovements(suggestion?.movements ?? []);
    setMethodBlocks(suggestion?.methodBlocks ?? []);
  }, [suggestion]);

  const adjustWeeklyDay = (date: string, items: WeeklyPlanItemKind[] | null) => {
    setWeeklyAdjustments((current) => {
      const next = { ...current };
      if (items == null) delete next[date];
      else next[date] = items;
      window.localStorage.setItem(
        weeklyAdjustmentsStorageKey(weeklyPlan.startDate),
        JSON.stringify(next),
      );
      return next;
    });
  };

  const scrollToWorkoutBuilder = () =>
    window.requestAnimationFrame(() =>
      document.getElementById("next-workout-builder")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      }),
    );

  const setRecoveryMode = (mode: WeeklyRecoveryMode) => {
    setWeeklyRecoveryMode(mode);
    window.localStorage.setItem(weeklyRecoveryModeStorageKey(weeklyPlan.startDate), mode);
    setReadiness(mode === "deload" ? "tired" : "normal");
  };

  const setWorkoutReadiness = (nextReadiness: PlannerReadiness) => {
    if (weeklyRecoveryMode === "deload" && nextReadiness !== "tired") {
      setWeeklyRecoveryMode("normal");
      window.localStorage.setItem(weeklyRecoveryModeStorageKey(weeklyPlan.startDate), "normal");
    }
    setReadiness(nextReadiness);
  };

  const updateSet = <K extends keyof WorkoutPlanSet>(
    movementIndex: number,
    setIndex: number,
    key: K,
    value: WorkoutPlanSet[K],
  ) =>
    setMovements((current) =>
      current.map((movement, index) =>
        index === movementIndex
          ? {
              ...movement,
              setRows: movement.setRows.map((set, rowIndex) =>
                rowIndex === setIndex ? { ...set, [key]: value } : set,
              ),
            }
          : movement,
      ),
    );

  const removeSet = (movementIndex: number, setIndex: number) =>
    setMovements((current) =>
      current.map((movement, index) =>
        index === movementIndex
          ? {
              ...movement,
              setRows:
                movement.setRows.length === 1
                  ? movement.setRows
                  : movement.setRows.filter((_, rowIndex) => rowIndex !== setIndex),
            }
          : movement,
      ),
    );

  const addSet = (movementIndex: number) =>
    setMovements((current) =>
      current.map((movement, index) => {
        if (index !== movementIndex) return movement;
        const previous = movement.setRows[movement.setRows.length - 1] ?? {
          reps: "",
          weight: "",
          rpe: "",
          completed: true,
        };
        return {
          ...movement,
          setRows: [...movement.setRows, { ...previous, rpe: "" }],
        };
      }),
    );

  const removeMovement = (movementIndex: number) => {
    setMovements((current) => current.filter((_, index) => index !== movementIndex));
    setMethodBlocks((current) =>
      current
        .map((block) => ({
          ...block,
          memberMovementIndexes: block.memberMovementIndexes
            .filter((index) => index !== movementIndex)
            .map((index) => (index > movementIndex ? index - 1 : index)),
        }))
        .filter(
          (block) =>
            block.memberMovementIndexes.length >= (block.family === "timed_density" ? 1 : 2),
        ),
    );
  };

  const currentDraft = () => {
    if (!suggestion || movements.length === 0) return;
    return {
      version: 1 as const,
      title: suggestion.title,
      locationKind: suggestion.locationKind,
      basis: suggestion.basis,
      movements,
      methodBlocks,
    };
  };

  const savePlan = useMutation({
    mutationFn: async (status: "pending" | "accepted") => {
      const draft = currentDraft();
      if (!draft) throw new Error("Add at least one movement before saving.");
      return saveWorkoutPlanClient({ draft, readiness, status });
    },
    onSuccess: (draft, status) => {
      queryClient.invalidateQueries({ queryKey: ["next-suggested-workouts"] });
      if (status === "accepted") {
        window.localStorage.setItem(WORKOUT_PLAN_DRAFT_KEY, JSON.stringify(draft));
        navigate({ to: "/log" });
        return;
      }
      toast.success("Next workout saved", {
        description: `${draft.title} will be waiting on the workout logger.`,
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <header className="border-b border-border pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          See the coming week, then turn a recent pattern into your next workout.
        </p>
      </header>

      {!history.isLoading && !library.isLoading && !history.error && !library.error ? (
        <WeeklyPlanOverview
          plan={weeklyPlan}
          adjustments={weeklyAdjustments}
          onChooseLocation={(nextLocation) => {
            setLocation(nextLocation);
            scrollToWorkoutBuilder();
          }}
          onAdjustDay={adjustWeeklyDay}
        />
      ) : null}

      {!history.isLoading && !library.isLoading && !history.error && !library.error ? (
        <WeeklyRecoveryCard
          recommendation={weeklyRecovery}
          mode={weeklyRecoveryMode}
          onUseLighterWorkout={() => {
            setReadiness("tired");
            scrollToWorkoutBuilder();
          }}
          onApplyDeload={() => {
            setRecoveryMode("deload");
            scrollToWorkoutBuilder();
          }}
          onReturnToNormal={() => setRecoveryMode("normal")}
        />
      ) : null}

      <div id="next-workout-builder" className="scroll-mt-24 border-t border-border pt-5">
        <h2 className="text-base font-semibold">Build next workout</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose the location and readiness, then edit the history-based targets.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Where are you training?</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 p-4 pt-2">
            <LocationButton
              active={location === "home"}
              label="Home"
              icon={<Home className="h-4 w-4" />}
              onClick={() => setLocation("home")}
            />
            <LocationButton
              active={location === "gym"}
              label="Gym"
              icon={<Building2 className="h-4 w-4" />}
              onClick={() => setLocation("gym")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">How are you feeling?</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 p-4 pt-2 sm:grid-cols-3">
            {READINESS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={readiness === option.value}
                onClick={() => setWorkoutReadiness(option.value)}
                className={cn(
                  "rounded-lg border p-3 text-left transition",
                  readiness === option.value
                    ? "border-primary/50 bg-primary/10"
                    : "border-border bg-secondary/20 hover:bg-secondary/40",
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {option.icon} {option.label}
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {option.detail}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      </section>

      {!history.isLoading && !library.isLoading && basisOptions.length > 0 ? (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Based on</CardTitle>
            <p className="text-xs text-muted-foreground">
              Let the app choose, or use a specific recent {location} training day.
            </p>
          </CardHeader>
          <CardContent className="flex gap-2 overflow-x-auto p-4 pt-2 pb-3 sm:grid sm:grid-cols-2 sm:overflow-visible xl:grid-cols-3">
            <BasisButton
              active={basisDate == null}
              title="Recommended"
              detail="Use automatic repeat or rotation detection"
              onClick={() => setBasisDate(null)}
            />
            {basisOptions.map((option) => (
              <BasisButton
                key={option.date}
                active={basisDate === option.date}
                title={formatUKDate(option.date)}
                detail={option.exercises.join(" · ")}
                fallback={option.fallbackUsed}
                onClick={() => setBasisDate(option.date)}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}

      {history.isLoading || library.isLoading ? (
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reviewing recent training…
        </div>
      ) : history.error || library.error ? (
        <Card className="border-destructive/40">
          <CardContent className="p-6 text-sm text-destructive">
            Training history could not be loaded. Please refresh and try again.
          </CardContent>
        </Card>
      ) : !suggestion ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Dumbbell className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
            <p className="font-medium">Not enough history yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Log a completed workout, then return here for a suggestion.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div
            className={cn(
              "rounded-xl border p-4",
              suggestion.fallbackUsed
                ? "border-amber-400/25 bg-amber-400/[0.06]"
                : "border-cyan-400/25 bg-cyan-400/[0.06]",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{suggestion.title}</p>
              <Badge variant="outline" className="text-[10px] capitalize">
                {suggestion.pattern === "manual"
                  ? "Chosen session"
                  : suggestion.pattern === "rotation"
                    ? "Pattern rotation"
                    : "Repeat pattern"}
              </Badge>
              {suggestion.fallbackUsed && (
                <Badge variant="outline" className="border-amber-400/30 text-[10px] text-amber-300">
                  Location fallback
                </Badge>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{suggestion.basis}</p>
          </div>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Suggested movements</h2>
                <p className="text-xs text-muted-foreground">
                  Edit sets here, or make further changes after opening the logger.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMovements(suggestion.movements);
                  setMethodBlocks(suggestion.methodBlocks ?? []);
                }}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
              </Button>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              {movements.map((movement, movementIndex) => (
                <MovementPlanCard
                  key={`${movement.exercise}-${movementIndex}`}
                  movement={movement}
                  index={movementIndex}
                  onUpdateSet={updateSet}
                  onRemoveSet={removeSet}
                  onAddSet={addSet}
                  onRemoveMovement={() => removeMovement(movementIndex)}
                />
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div>
              <h2 className="text-base font-semibold">Training methods</h2>
              <p className="text-xs text-muted-foreground">
                Methods are only carried forward when they were logged in the chosen source session.
              </p>
            </div>
            {methodBlocks.length ? (
              <div className="grid gap-2 lg:grid-cols-2">
                {methodBlocks.map((block, blockIndex) => (
                  <div
                    key={`${block.trainingMethodId}-${blockIndex}`}
                    className="flex items-start gap-3 rounded-xl border border-indigo-400/25 bg-indigo-400/[0.05] p-3"
                  >
                    <Layers3 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{block.methodName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {block.memberMovementIndexes
                          .map((index) => movements[index]?.exercise)
                          .filter(Boolean)
                          .join(" → ")}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {methodBlockSummary(block)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setMethodBlocks((current) =>
                          current.filter((_, index) => index !== blockIndex),
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                No exercise-group or timed method was found in this source session. You can still
                add one in the logger.
              </p>
            )}
          </section>

          <Card className="border-violet-400/20 bg-violet-400/[0.04]">
            <CardContent className="flex gap-3 p-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Current progression rules</p>
                <p className="mt-1">
                  Below 5 reps: keep the load and add one rep. Comfortable 5s: add 2.5 kg and
                  restart at 3. Tired: remove one set and reduce load by roughly 10%. You can still
                  edit every target before saving.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="sticky bottom-3 z-10 grid gap-2 rounded-xl border border-border bg-background/90 p-3 shadow-xl backdrop-blur sm:grid-cols-[auto_1fr]">
            <Button
              variant="outline"
              size="lg"
              disabled={movements.length === 0 || savePlan.isPending}
              onClick={() => savePlan.mutate("pending")}
            >
              {savePlan.isPending && savePlan.variables === "pending" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save for later
            </Button>
            <Button
              className="w-full"
              size="lg"
              disabled={movements.length === 0 || savePlan.isPending}
              onClick={() => savePlan.mutate("accepted")}
            >
              {savePlan.isPending && savePlan.variables === "accepted" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Start this workout <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function LocationButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition",
        active
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border bg-secondary/20 text-muted-foreground hover:text-foreground",
      )}
    >
      {icon} {label}
    </button>
  );
}

function BasisButton({
  active,
  title,
  detail,
  fallback = false,
  onClick,
}: {
  active: boolean;
  title: string;
  detail: string;
  fallback?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "w-[78vw] max-w-[300px] shrink-0 rounded-lg border p-3 text-left transition sm:w-auto sm:max-w-none",
        active
          ? "border-primary/50 bg-primary/10"
          : "border-border bg-secondary/20 hover:bg-secondary/40",
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        {title}
        {fallback ? (
          <Badge variant="outline" className="text-[9px] font-normal">
            Locationless
          </Badge>
        ) : null}
      </span>
      <span className="mt-1 line-clamp-2 block text-[11px] text-muted-foreground">{detail}</span>
    </button>
  );
}

function MovementPlanCard({
  movement,
  index,
  onUpdateSet,
  onRemoveSet,
  onAddSet,
  onRemoveMovement,
}: {
  movement: WorkoutPlanMovement;
  index: number;
  onUpdateSet: <K extends keyof WorkoutPlanSet>(
    movementIndex: number,
    setIndex: number,
    key: K,
    value: WorkoutPlanSet[K],
  ) => void;
  onRemoveSet: (movementIndex: number, setIndex: number) => void;
  onAddSet: (movementIndex: number) => void;
  onRemoveMovement: () => void;
}) {
  const usesWeight = movement.setRows.some((set) => set.weight !== "");
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-sm">{movement.exercise}</CardTitle>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Last pattern: {formatUKDate(movement.sourceDate)}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemoveMovement}>
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Remove {movement.exercise}</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-1">
        <div className="rounded-lg border border-sky-400/15 bg-sky-400/[0.04] p-2.5 text-xs text-muted-foreground">
          {movement.reason}
        </div>
        <div className="space-y-1.5">
          <div
            className={cn(
              "grid items-center gap-2 px-1 text-[10px] uppercase tracking-wider text-muted-foreground",
              usesWeight ? "grid-cols-[24px_1fr_1fr_32px]" : "grid-cols-[24px_1fr_32px]",
            )}
          >
            <span>Set</span>
            {usesWeight && <span>kg</span>}
            <span>Reps</span>
            <span />
          </div>
          {movement.setRows.map((set, setIndex) => (
            <div
              key={setIndex}
              className={cn(
                "grid items-center gap-2",
                usesWeight ? "grid-cols-[24px_1fr_1fr_32px]" : "grid-cols-[24px_1fr_32px]",
              )}
            >
              <span className="text-center text-xs text-muted-foreground">{setIndex + 1}</span>
              {usesWeight && (
                <Input
                  inputMode="decimal"
                  aria-label={`${movement.exercise} set ${setIndex + 1} weight`}
                  value={set.weight}
                  onChange={(event) => onUpdateSet(index, setIndex, "weight", event.target.value)}
                />
              )}
              <Input
                inputMode="numeric"
                aria-label={`${movement.exercise} set ${setIndex + 1} reps`}
                value={set.reps}
                onChange={(event) => onUpdateSet(index, setIndex, "reps", event.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={movement.setRows.length === 1}
                onClick={() => onRemoveSet(index, setIndex)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sr-only">Remove set {setIndex + 1}</span>
              </Button>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="w-full" onClick={() => onAddSet(index)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add set
        </Button>
      </CardContent>
    </Card>
  );
}
