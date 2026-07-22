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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { WeeklyPlanOverview } from "@/components/weekly-plan-overview";
import { WeeklyRecoveryCard } from "@/components/weekly-recovery-card";
import { WorkoutLifecyclePanel } from "@/components/workout-lifecycle-panel";
import { formatUKDate, todayISO } from "@/lib/date";
import {
  buildCircuit,
  CIRCUIT_EQUIPMENT_OPTIONS,
  CIRCUIT_FOCUS_OPTIONS,
  CIRCUIT_FORMAT_OPTIONS,
  CIRCUIT_INTENSITY_OPTIONS,
  type CircuitBuilderConfig,
  type CircuitBuildResult,
  type CircuitEquipment,
  type CircuitFocus,
  type CircuitFormat,
  type CircuitIntensity,
} from "@/lib/circuit-generator";
import { getLibraryClient, getRecentLogsClient } from "@/lib/supabase-log.browser";
import {
  getRecentWorkoutMethodBlocksClient,
  getWorkoutLifecycleClient,
  saveWorkoutPlanClient,
} from "@/lib/supabase-plans.browser";
import { getSupabaseSession } from "@/lib/supabase-public";
import { getMovementMetricProfile } from "@/lib/movement-metrics";
import { listTrainingMethodsClient } from "@/lib/supabase-training-methods.browser";
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
  type WorkoutPlanTargets,
} from "@/lib/workout-plan";
import { cn } from "@/lib/utils";
import { readWorkoutDraftSummary, workoutSessionDraftKey } from "@/lib/workout-local-state";

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [
      { title: "Plan Next Workout · Training Tracker" },
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

type PlannerMode = "history" | "circuit";

type CircuitBuilderInputs = Omit<
  CircuitBuilderConfig,
  "location" | "readiness" | "excludedExerciseIds"
> & {
  excludedMovements: string;
};

const DEFAULT_CIRCUIT_INPUTS: CircuitBuilderInputs = {
  durationMinutes: 20,
  focus: "balanced",
  intensity: "moderate",
  format: "mixed",
  equipment: null,
  excludeHighImpact: false,
  excludeAdvanced: false,
  excludedMovements: "",
};

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
  const trainingMethods = useQuery({
    queryKey: ["training-methods", "circuit-builder"],
    queryFn: () => listTrainingMethodsClient(),
    staleTime: 5 * 60_000,
  });
  const weeklyLoad = useQuery({
    queryKey: ["weekly-load-history"],
    queryFn: () => getWeeklyLoadHistoryClient(90),
    staleTime: 60_000,
  });
  const lifecycle = useQuery({
    queryKey: ["workout-lifecycle"],
    queryFn: () => getWorkoutLifecycleClient(12),
    staleTime: 30_000,
  });
  const [activeDraftPlanId] = useState(
    () =>
      readWorkoutDraftSummary(window.localStorage.getItem(workoutSessionDraftKey()))
        ?.loadedSuggestionId ?? null,
  );
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
  const [plannerMode, setPlannerMode] = useState<PlannerMode>("history");
  const [circuitInputs, setCircuitInputs] = useState<CircuitBuilderInputs>(DEFAULT_CIRCUIT_INPUTS);
  const [circuitBuild, setCircuitBuild] = useState<CircuitBuildResult | null>(null);

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
  const circuitCandidates = useMemo(
    () =>
      (library.data?.exercises ?? []).map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        workoutType: exercise.workoutType,
        focusArea: exercise.focusArea,
        equipment: exercise.equipment,
        metric: exercise.metric,
        locationScope: exercise.locationScope,
        circuitSuitability: exercise.circuitSuitability,
        circuitPattern: exercise.circuitPattern,
        circuitDifficulty: exercise.circuitDifficulty,
        circuitImpact: exercise.circuitImpact,
        circuitDoseMode: exercise.circuitDoseMode,
        circuitDoseMin: exercise.circuitDoseMin,
        circuitDoseMax: exercise.circuitDoseMax,
        circuitDosePerSide: exercise.circuitDosePerSide,
      })),
    [library.data?.exercises],
  );
  const locationCircuitCandidateCount = useMemo(
    () =>
      circuitCandidates.filter(
        (candidate) => candidate.locationScope === "both" || candidate.locationScope === location,
      ).length,
    [circuitCandidates, location],
  );
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
  const defaultMetricsByExercise = useMemo(
    () =>
      new Map(
        (library.data?.exercises ?? []).map((exercise) => [
          exercise.name.trim().toLowerCase(),
          exercise.metric,
        ]),
      ),
    [library.data?.exercises],
  );
  const suggestion = useMemo(
    () =>
      buildWorkoutSuggestion(
        matchingLogs,
        location,
        readiness,
        basisDate,
        methodHistory.data ?? [],
        defaultMetricsByExercise,
      ),
    [basisDate, defaultMetricsByExercise, location, matchingLogs, methodHistory.data, readiness],
  );
  const circuitMethod = useMemo(
    () =>
      trainingMethods.data?.items.find(
        (method) =>
          method.systemKey === "circuit" &&
          method.family === "exercise_group" &&
          method.isActive &&
          method.isEnabled,
      ) ?? null,
    [trainingMethods.data?.items],
  );
  const generatedCircuitMethodBlocks = useMemo<WorkoutPlanMethodBlock[]>(() => {
    if (!circuitBuild?.ok || !circuitMethod) return [];
    return [
      {
        trainingMethodId: circuitMethod.id,
        methodName: circuitMethod.name,
        family: "exercise_group",
        memberMovementIndexes: circuitBuild.movements.map((_, index) => index),
        rounds: String(circuitBuild.rounds),
        restBetweenMovementsSeconds: String(circuitBuild.restBetweenMovementsSeconds),
        restBetweenRoundsSeconds: String(circuitBuild.restBetweenRoundsSeconds),
        blockDurationMinutes: "",
        workIntervalSeconds: "",
        restIntervalSeconds: "",
        config: {
          ...circuitMethod.defaultConfig,
          generated_by: "circuit_builder",
          requested_duration_minutes: circuitBuild.requestedMinutes,
          estimated_duration_minutes: circuitBuild.estimatedMinutes,
        },
      },
    ];
  }, [circuitBuild, circuitMethod]);
  const activePlan =
    plannerMode === "circuit"
      ? circuitBuild?.ok
        ? {
            title: circuitBuild.title,
            locationKind: location,
            basis: circuitBuild.basis,
            movements: circuitBuild.movements,
            methodBlocks: generatedCircuitMethodBlocks,
            fallbackUsed: false,
            pattern: "circuit" as const,
          }
        : null
      : suggestion;
  const [movements, setMovements] = useState<WorkoutPlanMovement[]>([]);
  const [methodBlocks, setMethodBlocks] = useState<WorkoutPlanMethodBlock[]>([]);

  useEffect(() => {
    setBasisDate(null);
    setCircuitBuild(null);
    if (plannerMode === "circuit") {
      setMovements([]);
      setMethodBlocks([]);
    }
  }, [location, plannerMode]);

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
    if (plannerMode !== "history") return;
    setMovements(suggestion?.movements ?? []);
    setMethodBlocks(suggestion?.methodBlocks ?? []);
  }, [plannerMode, suggestion]);

  useEffect(() => {
    if (plannerMode !== "circuit" || !circuitBuild?.ok) return;
    setMethodBlocks(generatedCircuitMethodBlocks);
  }, [circuitBuild, generatedCircuitMethodBlocks, plannerMode]);

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
    if (plannerMode === "circuit") {
      setCircuitBuild(null);
      setMovements([]);
      setMethodBlocks([]);
    }
  };

  const setWorkoutReadiness = (nextReadiness: PlannerReadiness) => {
    if (weeklyRecoveryMode === "deload" && nextReadiness !== "tired") {
      setWeeklyRecoveryMode("normal");
      window.localStorage.setItem(weeklyRecoveryModeStorageKey(weeklyPlan.startDate), "normal");
    }
    setReadiness(nextReadiness);
    if (plannerMode === "circuit") {
      setCircuitBuild(null);
      setMovements([]);
      setMethodBlocks([]);
    }
  };

  const generateCircuit = () => {
    if (!circuitMethod) {
      toast.error("The Circuit training method is unavailable. Enable it in Manage → Methods.");
      return;
    }
    const exclusions = circuitInputs.excludedMovements
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    const result = buildCircuit(circuitCandidates, {
      durationMinutes: circuitInputs.durationMinutes,
      location,
      readiness,
      focus: circuitInputs.focus,
      intensity: circuitInputs.intensity,
      format: circuitInputs.format,
      equipment: circuitInputs.equipment,
      excludeHighImpact: circuitInputs.excludeHighImpact,
      excludeAdvanced: circuitInputs.excludeAdvanced,
      excludedExerciseIds: circuitCandidates
        .filter((candidate) =>
          exclusions.some((exclusion) => candidate.name.toLowerCase().includes(exclusion)),
        )
        .map((candidate) => candidate.id),
    });
    setCircuitBuild(result);
    setMethodBlocks([]);
    if (result.ok) {
      setMovements(result.movements);
      toast.success("Circuit built", {
        description: `${result.movements.length} movements · ${result.rounds} rounds · about ${result.estimatedMinutes} minutes`,
      });
    } else {
      setMovements([]);
    }
  };

  const updateCircuitInputs: React.Dispatch<React.SetStateAction<CircuitBuilderInputs>> = (
    action,
  ) => {
    setCircuitInputs(action);
    setCircuitBuild(null);
    setMovements([]);
    setMethodBlocks([]);
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

  const updateTarget = <K extends keyof WorkoutPlanTargets>(
    movementIndex: number,
    key: K,
    value: WorkoutPlanTargets[K],
  ) =>
    setMovements((current) =>
      current.map((movement, index) =>
        index === movementIndex
          ? { ...movement, targets: { ...movement.targets, [key]: value } }
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
          durationSeconds: "",
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
    if (!activePlan || movements.length === 0) return;
    return {
      version: 1 as const,
      title: activePlan.title,
      locationKind: activePlan.locationKind,
      basis: activePlan.basis,
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
      queryClient.invalidateQueries({ queryKey: ["workout-lifecycle"] });
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
          See the coming week, then repeat a useful pattern or build a circuit from your Library.
        </p>
      </header>

      <WorkoutLifecyclePanel
        records={lifecycle.data ?? []}
        activeDraftPlanId={activeDraftPlanId}
        loading={lifecycle.isLoading}
        error={Boolean(lifecycle.error)}
      />

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
            setWorkoutReadiness("tired");
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
          Repeat a useful training pattern or generate a balanced circuit from your movement
          library.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-secondary/15 p-1.5">
        <button
          type="button"
          aria-pressed={plannerMode === "history"}
          onClick={() => setPlannerMode("history")}
          className={cn(
            "rounded-lg px-3 py-3 text-left transition",
            plannerMode === "history"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="block text-sm font-medium">From history</span>
          <span className="mt-0.5 block text-[11px]">Repeat or rotate a recent session</span>
        </button>
        <button
          type="button"
          aria-pressed={plannerMode === "circuit"}
          onClick={() => setPlannerMode("circuit")}
          className={cn(
            "rounded-lg px-3 py-3 text-left transition",
            plannerMode === "circuit"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="block text-sm font-medium">Circuit Builder</span>
          <span className="mt-0.5 block text-[11px]">Choose duration, focus and equipment</span>
        </button>
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

      {plannerMode === "circuit" ? (
        <CircuitBuilderCard
          inputs={circuitInputs}
          onChange={updateCircuitInputs}
          candidateCount={locationCircuitCandidateCount}
          result={circuitBuild}
          methodAvailable={Boolean(circuitMethod)}
          loading={library.isLoading || trainingMethods.isLoading}
          onBuild={generateCircuit}
        />
      ) : null}

      {plannerMode === "history" &&
      !history.isLoading &&
      !library.isLoading &&
      basisOptions.length > 0 ? (
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

      {library.isLoading ||
      (plannerMode === "history" ? history.isLoading : trainingMethods.isLoading) ? (
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {plannerMode === "history" ? "Reviewing recent training…" : "Loading circuit library…"}
        </div>
      ) : library.error || (plannerMode === "history" ? history.error : trainingMethods.error) ? (
        <Card className="border-destructive/40">
          <CardContent className="p-6 text-sm text-destructive">
            {plannerMode === "history"
              ? "Training history could not be loaded. Please refresh and try again."
              : "The movement library or Circuit method could not be loaded. Please refresh and try again."}
          </CardContent>
        </Card>
      ) : plannerMode === "circuit" && !activePlan ? null : !activePlan ? (
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
              activePlan.fallbackUsed
                ? "border-amber-400/25 bg-amber-400/[0.06]"
                : "border-cyan-400/25 bg-cyan-400/[0.06]",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{activePlan.title}</p>
              <Badge variant="outline" className="text-[10px] capitalize">
                {activePlan.pattern === "circuit"
                  ? "Generated circuit"
                  : activePlan.pattern === "manual"
                    ? "Chosen session"
                    : activePlan.pattern === "rotation"
                      ? "Pattern rotation"
                      : "Repeat pattern"}
              </Badge>
              {activePlan.fallbackUsed && (
                <Badge variant="outline" className="border-amber-400/30 text-[10px] text-amber-300">
                  Location fallback
                </Badge>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{activePlan.basis}</p>
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
                  setMovements(activePlan.movements);
                  setMethodBlocks(activePlan.methodBlocks ?? []);
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
                  onUpdateTarget={updateTarget}
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
                {plannerMode === "circuit"
                  ? "The generated order, rounds, and recovery are stored as a Circuit training block."
                  : "Methods are only carried forward when they were logged in the chosen source session."}
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
                {plannerMode === "circuit"
                  ? "No Circuit block is attached. Rebuild the circuit or enable the Circuit method in Manage."
                  : "No exercise-group or timed method was found in this source session. You can still add one in the logger."}
              </p>
            )}
          </section>

          <Card className="border-violet-400/20 bg-violet-400/[0.04]">
            <CardContent className="flex gap-3 p-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground">
                  {plannerMode === "circuit" ? "How this was chosen" : "Current progression rules"}
                </p>
                {plannerMode === "circuit" ? (
                  <p className="mt-1">
                    Eligibility comes from your enabled {location} library, equipment, exclusions,
                    format, impact, and difficulty. Scoring then favours preferred movements, the
                    requested focus, and pattern variety. Every card explains its own dose and
                    selection reason.
                  </p>
                ) : (
                  <p className="mt-1">
                    Below 5 reps: keep the load and add one rep. Comfortable 5s: add 2.5 kg and
                    restart at 3. Tired: remove one set and reduce load by roughly 10%. You can
                    still edit every target before saving.
                  </p>
                )}
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

function CircuitBuilderCard({
  inputs,
  onChange,
  candidateCount,
  result,
  methodAvailable,
  loading,
  onBuild,
}: {
  inputs: CircuitBuilderInputs;
  onChange: React.Dispatch<React.SetStateAction<CircuitBuilderInputs>>;
  candidateCount: number;
  result: CircuitBuildResult | null;
  methodAvailable: boolean;
  loading: boolean;
  onBuild: () => void;
}) {
  const update = <K extends keyof CircuitBuilderInputs>(key: K, value: CircuitBuilderInputs[K]) =>
    onChange((current) => ({ ...current, [key]: value }));
  const toggleEquipment = (equipment: CircuitEquipment) => {
    const current = inputs.equipment ?? [];
    update(
      "equipment",
      current.includes(equipment)
        ? current.filter((item) => item !== equipment)
        : [...current, equipment],
    );
  };

  return (
    <Card className="border-cyan-400/20 bg-cyan-400/[0.035]">
      <CardHeader className="p-4 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm">Circuit brief</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              The same brief always produces the same circuit. Bodyweight movements remain eligible
              with every equipment choice.
            </p>
          </div>
          <Badge variant="outline" className="border-cyan-400/30 text-[10px] text-cyan-200">
            {candidateCount} location-eligible movements
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-4 pt-3">
        <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Duration
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={10}
                max={45}
                step={5}
                value={inputs.durationMinutes}
                onChange={(event) =>
                  update("durationMinutes", Math.max(10, Math.min(45, Number(event.target.value))))
                }
              />
              <span className="text-xs text-muted-foreground">minutes</span>
            </div>
          </div>
          <CircuitChoiceGroup
            label="Focus"
            value={inputs.focus}
            options={CIRCUIT_FOCUS_OPTIONS}
            onChange={(value) => update("focus", value as CircuitFocus)}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <CircuitChoiceGroup
            label="Intensity"
            value={inputs.intensity}
            options={CIRCUIT_INTENSITY_OPTIONS}
            onChange={(value) => update("intensity", value as CircuitIntensity)}
          />
          <CircuitChoiceGroup
            label="Format"
            value={inputs.format}
            options={CIRCUIT_FORMAT_OPTIONS}
            onChange={(value) => update("format", value as CircuitFormat)}
          />
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Equipment
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Any uses your whole {candidateCount ? "location library" : "library"}; bodyweight only
              uses movements needing no listed kit.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ChoiceChip
              active={inputs.equipment == null}
              label="Any available"
              onClick={() => update("equipment", null)}
            />
            <ChoiceChip
              active={inputs.equipment?.length === 0}
              label="Bodyweight only"
              onClick={() => update("equipment", [])}
            />
            {CIRCUIT_EQUIPMENT_OPTIONS.map((option) => (
              <ChoiceChip
                key={option.value}
                active={inputs.equipment?.includes(option.value) ?? false}
                label={option.label}
                onClick={() => toggleEquipment(option.value)}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.4fr]">
          <label className="flex items-start gap-2 rounded-lg border border-border bg-background/35 p-3 text-xs">
            <Checkbox
              checked={inputs.excludeHighImpact}
              onCheckedChange={(checked) => update("excludeHighImpact", checked === true)}
            />
            <span>
              <span className="block font-medium text-foreground">Avoid high impact</span>
              <span className="mt-0.5 block text-muted-foreground">
                No jumping or high-impact picks
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-border bg-background/35 p-3 text-xs">
            <Checkbox
              checked={inputs.excludeAdvanced}
              onCheckedChange={(checked) => update("excludeAdvanced", checked === true)}
            />
            <span>
              <span className="block font-medium text-foreground">Avoid advanced</span>
              <span className="mt-0.5 block text-muted-foreground">
                Keep skill demands accessible
              </span>
            </span>
          </label>
          <label className="space-y-1.5 text-xs">
            <span className="font-medium">Exclude movements</span>
            <Input
              value={inputs.excludedMovements}
              onChange={(event) => update("excludedMovements", event.target.value)}
              placeholder="e.g. Burpees, box jumps"
            />
            <span className="block text-[10px] text-muted-foreground">
              Separate names with commas; partial names are matched.
            </span>
          </label>
        </div>

        {result && !result.ok ? (
          <p className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-3 text-xs text-amber-100">
            {result.message} ({result.eligibleCount} eligible)
          </p>
        ) : result?.ok && result.warnings.length ? (
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.04] p-3 text-xs text-muted-foreground">
            {result.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}

        {!loading && !methodAvailable ? (
          <p className="text-xs text-amber-200">
            Enable the system Circuit training method in Manage → Methods before building.
          </p>
        ) : null}

        <Button
          type="button"
          className="w-full sm:w-auto"
          size="lg"
          disabled={loading || !methodAvailable || candidateCount < 3}
          onClick={onBuild}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Build circuit
        </Button>
      </CardContent>
    </Card>
  );
}

function CircuitChoiceGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string; detail: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-lg border p-2.5 text-left transition",
              value === option.value
                ? "border-cyan-400/45 bg-cyan-400/10"
                : "border-border bg-background/30 hover:bg-secondary/40",
            )}
          >
            <span className="block text-xs font-medium">{option.label}</span>
            <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
              {option.detail}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChoiceChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs transition",
        active
          ? "border-cyan-400/45 bg-cyan-400/10 text-cyan-100"
          : "border-border bg-background/30 text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
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
  onUpdateTarget,
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
  onUpdateTarget: <K extends keyof WorkoutPlanTargets>(
    movementIndex: number,
    key: K,
    value: WorkoutPlanTargets[K],
  ) => void;
  onRemoveSet: (movementIndex: number, setIndex: number) => void;
  onAddSet: (movementIndex: number) => void;
  onRemoveMovement: () => void;
}) {
  const profile = getMovementMetricProfile({
    workoutType: movement.workoutType,
    movement: movement.exercise,
    defaultMetric: movement.trackingMode,
  });
  const hasTimedCircuitDose =
    !movement.sourceDate &&
    !["hold", "grip", "mobility_position"].includes(profile) &&
    movement.setRows.some((set) => set.durationSeconds && !set.reps);
  const usesWeight = profile === "weighted" || profile === "grip";
  const usesDuration = profile === "hold" || profile === "grip" || hasTimedCircuitDose;
  const showsSetRows =
    ["weighted", "reps", "hold", "grip", "power"].includes(profile) || hasTimedCircuitDose;
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-sm">{movement.exercise}</CardTitle>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {movement.sourceDate
                ? `Last pattern: ${formatUKDate(movement.sourceDate)}`
                : "Circuit selection"}
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
        {movement.setRows.some((set) => set.method) ? (
          <div className="flex flex-wrap gap-1.5">
            {movement.setRows.map((set, setIndex) =>
              set.method ? (
                <Badge
                  key={`${set.method.trainingMethodId}-${setIndex}`}
                  variant="outline"
                  className="border-violet-400/30 text-[10px] text-violet-200"
                >
                  Set {setIndex + 1} · {set.method.methodName} · {set.method.segments.length + 1}
                  segments
                </Badge>
              ) : null,
            )}
          </div>
        ) : null}
        <MovementTargetFields
          movement={movement}
          index={index}
          profile={profile}
          hideTimedAggregates={hasTimedCircuitDose}
          onUpdateTarget={onUpdateTarget}
          onUpdateSet={onUpdateSet}
        />
        {showsSetRows ? (
          <div className="space-y-1.5">
            <div
              className={cn(
                "grid items-center gap-2 px-1 text-[10px] uppercase tracking-wider text-muted-foreground",
                usesWeight ? "grid-cols-[24px_1fr_1fr_32px]" : "grid-cols-[24px_1fr_32px]",
              )}
            >
              <span>Set</span>
              {usesWeight && <span>kg</span>}
              <span>{usesDuration ? "Seconds" : "Reps"}</span>
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
                  aria-label={`${movement.exercise} set ${setIndex + 1} ${usesDuration ? "seconds" : "reps"}`}
                  value={usesDuration ? set.durationSeconds : set.reps}
                  onChange={(event) =>
                    usesDuration
                      ? onUpdateSet(index, setIndex, "durationSeconds", event.target.value)
                      : onUpdateSet(index, setIndex, "reps", event.target.value)
                  }
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
        ) : null}
        {showsSetRows ? (
          <Button variant="ghost" size="sm" className="w-full" onClick={() => onAddSet(index)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add set
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MovementTargetFields({
  movement,
  index,
  profile,
  hideTimedAggregates,
  onUpdateTarget,
  onUpdateSet,
}: {
  movement: WorkoutPlanMovement;
  index: number;
  profile: ReturnType<typeof getMovementMetricProfile>;
  hideTimedAggregates: boolean;
  onUpdateTarget: <K extends keyof WorkoutPlanTargets>(
    movementIndex: number,
    key: K,
    value: WorkoutPlanTargets[K],
  ) => void;
  onUpdateSet: <K extends keyof WorkoutPlanSet>(
    movementIndex: number,
    setIndex: number,
    key: K,
    value: WorkoutPlanSet[K],
  ) => void;
}) {
  const firstSet = movement.setRows[0];
  const fields: React.ReactNode[] = [];
  const addTarget = (
    key: keyof WorkoutPlanTargets,
    label: string,
    inputMode: "numeric" | "decimal" | "text" = "decimal",
  ) =>
    fields.push(
      <label
        key={key}
        className="space-y-1 text-[10px] uppercase tracking-wider text-muted-foreground"
      >
        <span>{label}</span>
        <Input
          inputMode={inputMode}
          value={movement.targets[key]}
          onChange={(event) => onUpdateTarget(index, key, event.target.value)}
          className="normal-case tracking-normal text-foreground"
        />
      </label>,
    );

  if (
    !hideTimedAggregates &&
    ["time", "duration", "carry", "conditioning", "climbing"].includes(profile)
  ) {
    addTarget("durationMinutes", "Minutes", "numeric");
  }
  if (!hideTimedAggregates && ["time", "carry", "mobility_position"].includes(profile)) {
    addTarget("distance", profile === "mobility_position" ? "Distance (cm)" : "Distance");
  }
  if (!hideTimedAggregates && ["time", "carry"].includes(profile)) {
    addTarget("distanceUnit", "Unit", "text");
  }
  if (!hideTimedAggregates && (profile === "conditioning" || profile === "carry")) {
    addTarget("rounds", "Rounds", "numeric");
  }
  if (profile === "power") addTarget("height", "Height (cm)");
  if (!hideTimedAggregates && ["duration", "conditioning", "climbing"].includes(profile)) {
    addTarget("detail", "Detail", "text");
  }
  if (profile === "mobility_position") {
    fields.push(
      <label
        key="hold"
        className="space-y-1 text-[10px] uppercase tracking-wider text-muted-foreground"
      >
        <span>Hold (sec)</span>
        <Input
          inputMode="decimal"
          value={firstSet?.durationSeconds ?? ""}
          onChange={(event) => onUpdateSet(index, 0, "durationSeconds", event.target.value)}
          className="normal-case tracking-normal text-foreground"
        />
      </label>,
    );
  }
  if (!hideTimedAggregates && (profile === "carry" || profile === "conditioning")) {
    fields.push(
      <label
        key="load"
        className="space-y-1 text-[10px] uppercase tracking-wider text-muted-foreground"
      >
        <span>Load (kg)</span>
        <Input
          inputMode="decimal"
          value={firstSet?.weight ?? ""}
          onChange={(event) => onUpdateSet(index, 0, "weight", event.target.value)}
          className="normal-case tracking-normal text-foreground"
        />
      </label>,
    );
  }

  return fields.length ? <div className="grid gap-2 sm:grid-cols-3">{fields}</div> : null;
}
