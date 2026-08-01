import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Building2,
  Dumbbell,
  Home,
  Info,
  Layers3,
  Loader2,
  Lock,
  LockOpen,
  Plus,
  RefreshCw,
  RotateCcw,
  Shuffle,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WeeklyPlanOverview } from "@/components/weekly-plan-overview";
import { ProgrammeRefreshCard } from "@/components/programme-refresh-card";
import { formatUKDate, todayISO } from "@/lib/date";
import {
  buildCircuit,
  CIRCUIT_EQUIPMENT_OPTIONS,
  CIRCUIT_FOCUS_OPTIONS,
  CIRCUIT_FORMAT_OPTIONS,
  CIRCUIT_INTENSITY_OPTIONS,
  getCircuitReplacementCandidates,
  type CircuitBuilderConfig,
  type CircuitBuildResult,
  type CircuitCandidate,
  type CircuitEquipment,
  type CircuitFocus,
  type CircuitFormat,
  type CircuitIntensity,
} from "@/lib/circuit-generator";
import { getLibraryClient, getRecentLogsClient } from "@/lib/supabase-log.browser";
import { saveWorkoutPlanClient } from "@/lib/supabase-plans.browser";
import { getSupabaseSession } from "@/lib/supabase-public";
import { getMovementMetricProfile } from "@/lib/movement-metrics";
import {
  getActiveProgrammeRefreshClient,
  getUpcomingProgrammeScheduleClient,
  updateProgrammeExerciseSettingsClient,
} from "@/lib/supabase-programmes.browser";
import { listTrainingMethodsClient } from "@/lib/supabase-training-methods.browser";
import { getWeeklyLoadHistoryClient } from "@/lib/supabase-weekly-load.browser";
import {
  buildWeeklyPlan,
  readWeeklyPlanAdjustments,
  type WeeklyPlanAdjustments,
  type WeeklyPlanItemKind,
} from "@/lib/weekly-plan";
import {
  buildGuidedStrengthSession,
  SESSION_DIFFICULTY_OPTIONS,
  STRENGTH_FOCUS_OPTIONS,
  WORKOUT_PLAN_DRAFT_KEY,
  WORKOUT_PLAN_LOCATION_KEY,
  type GuidedStrengthBuildResult,
  type GuidedStrengthCandidate,
  type PlannerLocation,
  type SessionDifficulty,
  type StrengthFocus,
  type WorkoutPlanMovement,
  type WorkoutPlanMethodBlock,
  type WorkoutPlanSuggestion,
  type WorkoutPlanSet,
  type WorkoutPlanTargets,
} from "@/lib/workout-plan";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [
      { title: "Plan Next Workout · Training Tracker" },
      {
        name: "description",
        content: "Preview your programme week or plan an additional workout.",
      },
    ],
  }),
  component: PlanPage,
});

type PlannerMode = "strength" | "circuit";

type CircuitBuilderInputs = Omit<CircuitBuilderConfig, "location" | "excludedExerciseIds"> & {
  excludedMovements: string;
};

type StrengthBuilderInputs = {
  durationMinutes: number;
  focus: StrengthFocus;
  difficulty: SessionDifficulty;
  equipment: CircuitEquipment[] | null;
  excludedMovements: string;
};

const DEFAULT_STRENGTH_INPUTS: StrengthBuilderInputs = {
  durationMinutes: 60,
  focus: "full_body",
  difficulty: "hard",
  equipment: null,
  excludedMovements: "",
};

const DEFAULT_CIRCUIT_INPUTS: CircuitBuilderInputs = {
  durationMinutes: 20,
  focus: "balanced",
  intensity: "hard",
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
  const [location, setLocation] = useState<PlannerLocation>("gym");
  const [weeklyAdjustments, setWeeklyAdjustments] = useState<WeeklyPlanAdjustments>({});
  const [plannerMode, setPlannerMode] = useState<PlannerMode>("strength");
  const [strengthInputs, setStrengthInputs] =
    useState<StrengthBuilderInputs>(DEFAULT_STRENGTH_INPUTS);
  const [strengthBuild, setStrengthBuild] = useState<GuidedStrengthBuildResult | null>(null);
  const [strengthPlan, setStrengthPlan] = useState<WorkoutPlanSuggestion | null>(null);
  const [circuitInputs, setCircuitInputs] = useState<CircuitBuilderInputs>(DEFAULT_CIRCUIT_INPUTS);
  const [circuitBuild, setCircuitBuild] = useState<CircuitBuildResult | null>(null);
  const [circuitMovementIds, setCircuitMovementIds] = useState<string[]>([]);
  const [lockedCircuitIds, setLockedCircuitIds] = useState<string[]>([]);
  const [circuitVariation, setCircuitVariation] = useState(0);

  useEffect(() => {
    const storedLocation = window.localStorage.getItem(WORKOUT_PLAN_LOCATION_KEY);
    window.localStorage.removeItem(WORKOUT_PLAN_LOCATION_KEY);
    if (storedLocation === "home" || storedLocation === "gym") setLocation(storedLocation);
  }, []);
  const matchingLogs = useMemo(() => {
    const allowed = new Set(
      (library.data?.exercises ?? [])
        .filter(
          (exercise) =>
            (exercise.locationScope === "both" || exercise.locationScope === location) &&
            exercise.availableLocationKinds.includes(location),
        )
        .map((exercise) => exercise.name.toLowerCase()),
    );
    return (history.data?.recent ?? []).filter((log) => allowed.has(log.exercise.toLowerCase()));
  }, [history.data?.recent, library.data?.exercises, location]);
  const matchingStrengthLogs = useMemo(
    () => matchingLogs.filter((log) => log.workoutType.trim().toLowerCase() === "strength"),
    [matchingLogs],
  );
  const guidedStrengthCandidates = useMemo<GuidedStrengthCandidate[]>(() => {
    const libraryByName = new Map(
      (library.data?.exercises ?? []).map((exercise) => [
        exercise.name.trim().toLowerCase(),
        exercise,
      ]),
    );
    const byExercise = new Map<string, GuidedStrengthCandidate>();
    for (const log of matchingStrengthLogs) {
      const key = log.exercise.trim().toLowerCase();
      const exercise = libraryByName.get(key);
      if (!exercise) continue;
      const current = byExercise.get(key);
      if (!current) {
        byExercise.set(key, {
          id: exercise.id,
          log,
          focusArea: exercise.focusArea,
          equipmentGroups: exercise.equipmentCircuitGroups,
          recentHistoryCount: 1,
        });
      } else {
        current.recentHistoryCount += 1;
        if (log.date > current.log.date) current.log = log;
      }
    }
    return Array.from(byExercise.values());
  }, [library.data?.exercises, matchingStrengthLogs]);
  const circuitCandidates = useMemo(() => {
    const historyByMovement = new Map<
      string,
      { count: number; lastPerformedDate: string | null }
    >();
    for (const log of matchingLogs) {
      const key = log.exercise.trim().toLowerCase();
      const current = historyByMovement.get(key);
      historyByMovement.set(key, {
        count: (current?.count ?? 0) + 1,
        lastPerformedDate:
          current?.lastPerformedDate && current.lastPerformedDate > log.date
            ? current.lastPerformedDate
            : log.date,
      });
    }
    return (library.data?.exercises ?? []).map((exercise) => {
      const previous = historyByMovement.get(exercise.name.trim().toLowerCase());
      return {
        id: exercise.id,
        name: exercise.name,
        workoutType: exercise.workoutType,
        focusArea: exercise.focusArea,
        equipment: exercise.equipment,
        equipmentGroups: exercise.equipmentCircuitGroups as CircuitEquipment[],
        metric: exercise.metric,
        locationScope: exercise.locationScope,
        availableLocationKinds: exercise.availableLocationKinds,
        circuitSuitability: exercise.circuitSuitability,
        circuitPattern: exercise.circuitPattern,
        circuitDifficulty: exercise.circuitDifficulty,
        circuitImpact: exercise.circuitImpact,
        circuitDoseMode: exercise.circuitDoseMode,
        circuitDoseMin: exercise.circuitDoseMin,
        circuitDoseMax: exercise.circuitDoseMax,
        circuitDosePerSide: exercise.circuitDosePerSide,
        recentHistoryCount: previous?.count ?? 0,
        lastPerformedDate: previous?.lastPerformedDate ?? null,
      };
    });
  }, [library.data?.exercises, matchingLogs]);
  const locationCircuitCandidateCount = useMemo(
    () =>
      circuitCandidates.filter(
        (candidate) =>
          (candidate.locationScope === "both" || candidate.locationScope === location) &&
          candidate.availableLocationKinds.includes(location),
      ).length,
    [circuitCandidates, location],
  );
  const circuitConfig = useMemo<CircuitBuilderConfig>(() => {
    const exclusions = circuitInputs.excludedMovements
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    return {
      durationMinutes: circuitInputs.durationMinutes,
      location,
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
    };
  }, [circuitCandidates, circuitInputs, location]);
  const circuitSwapOptions = useMemo(
    () =>
      circuitMovementIds.map((_, index) =>
        getCircuitReplacementCandidates(
          circuitCandidates,
          circuitConfig,
          circuitMovementIds,
          index,
        ).slice(0, 24),
      ),
    [circuitCandidates, circuitConfig, circuitMovementIds],
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
  const programmeSchedule = useQuery({
    queryKey: ["programme-schedule", weeklyPlan.startDate, weeklyPlan.endDate],
    queryFn: () => getUpcomingProgrammeScheduleClient(weeklyPlan.startDate, weeklyPlan.endDate),
    staleTime: 30_000,
  });
  const programmeRefresh = useQuery({
    queryKey: ["programme-refresh"],
    queryFn: getActiveProgrammeRefreshClient,
    staleTime: 30_000,
  });
  const programmeRefreshMutation = useMutation({
    mutationFn: ({
      assignmentId,
      updates,
    }: {
      assignmentId: string;
      updates: Array<{
        exerciseId: string;
        trainingMax: number;
        manualAdjustmentPercent: number;
      }>;
    }) => updateProgrammeExerciseSettingsClient(assignmentId, updates),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["programme-refresh"] }),
        queryClient.invalidateQueries({ queryKey: ["programme-schedule"] }),
        queryClient.invalidateQueries({ queryKey: ["programme-workout-offers"] }),
        queryClient.invalidateQueries({ queryKey: ["programme-assignments"] }),
      ]);
      toast.success("Upcoming programme sessions refreshed");
    },
    onError: (error: Error) => toast.error(error.message),
  });
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
  const circuitMethodBlock = (
    build: Extract<CircuitBuildResult, { ok: true }>,
    offset = 0,
    generatedBy = "circuit_builder",
  ): WorkoutPlanMethodBlock | null =>
    circuitMethod
      ? {
          trainingMethodId: circuitMethod.id,
          methodName: circuitMethod.name,
          family: "exercise_group",
          memberMovementIndexes: build.movements.map((_, index) => offset + index),
          rounds: String(build.rounds),
          restBetweenMovementsSeconds: String(build.restBetweenMovementsSeconds),
          restBetweenRoundsSeconds: String(build.restBetweenRoundsSeconds),
          blockDurationMinutes: "",
          workIntervalSeconds: "",
          restIntervalSeconds: "",
          config: {
            ...circuitMethod.defaultConfig,
            rounds: build.rounds,
            movement_count: build.movements.length,
            rest_between_movements_seconds: build.restBetweenMovementsSeconds,
            rest_between_rounds_seconds: build.restBetweenRoundsSeconds,
            generated_by: generatedBy,
            requested_duration_minutes: build.requestedMinutes,
            estimated_duration_minutes: build.estimatedMinutes,
            generation_variation: circuitVariation,
            locked_movement_count: lockedCircuitIds.length,
          },
        }
      : null;
  const generatedCircuitMethodBlocks: WorkoutPlanMethodBlock[] = (() => {
    if (!circuitBuild?.ok || !circuitMethod) return [];
    const block = circuitMethodBlock(circuitBuild);
    return block ? [block] : [];
  })();
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
      : strengthPlan;
  const [movements, setMovements] = useState<WorkoutPlanMovement[]>([]);
  const [methodBlocks, setMethodBlocks] = useState<WorkoutPlanMethodBlock[]>([]);

  useEffect(() => {
    setStrengthBuild(null);
    setStrengthPlan(null);
    setCircuitBuild(null);
    setCircuitMovementIds([]);
    setLockedCircuitIds([]);
    setCircuitVariation(0);
    setMovements([]);
    setMethodBlocks([]);
  }, [location, plannerMode]);

  useEffect(() => {
    setWeeklyAdjustments(
      readWeeklyPlanAdjustments(
        window.localStorage.getItem(weeklyAdjustmentsStorageKey(weeklyPlan.startDate)),
      ),
    );
  }, [weeklyPlan.startDate]);

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

  const updateStrengthInputs: React.Dispatch<React.SetStateAction<StrengthBuilderInputs>> = (
    action,
  ) => {
    setStrengthInputs(action);
    setStrengthBuild(null);
    setStrengthPlan(null);
    setMovements([]);
    setMethodBlocks([]);
  };

  const generateStrength = () => {
    if (!circuitMethod) {
      toast.error("The Circuit training method is required for the conditioning finisher.");
      return;
    }
    const exclusions = strengthInputs.excludedMovements
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    const excludedStrengthIds = guidedStrengthCandidates
      .filter((candidate) =>
        exclusions.some((exclusion) => candidate.log.exercise.toLowerCase().includes(exclusion)),
      )
      .map((candidate) => candidate.id);
    const result = buildGuidedStrengthSession(
      guidedStrengthCandidates,
      {
        durationMinutes: strengthInputs.durationMinutes,
        location,
        focus: strengthInputs.focus,
        difficulty: strengthInputs.difficulty,
        equipment: strengthInputs.equipment,
        excludedExerciseIds: excludedStrengthIds,
      },
      defaultMetricsByExercise,
    );
    setStrengthBuild(result);
    if (!result.ok) {
      setStrengthPlan(null);
      setMovements([]);
      setMethodBlocks([]);
      return;
    }
    const strengthIds = new Set(result.suggestion.movements.map((movement) => movement.exercise));
    const finisher = buildCircuit(
      circuitCandidates,
      {
        durationMinutes: result.finisherMinutes,
        location,
        focus: "conditioning",
        intensity: strengthInputs.difficulty,
        format: "mixed",
        equipment: strengthInputs.equipment,
        excludeHighImpact: false,
        excludeAdvanced: false,
        excludedExerciseIds: circuitCandidates
          .filter(
            (candidate) =>
              strengthIds.has(candidate.name) ||
              exclusions.some((exclusion) => candidate.name.toLowerCase().includes(exclusion)),
          )
          .map((candidate) => candidate.id),
      },
      { movementCount: 3 },
    );
    if (!finisher.ok) {
      setStrengthBuild({
        ok: false,
        eligibleCount: finisher.eligibleCount,
        message: `The strength block is available, but a conditioning finisher could not be built. ${finisher.message}`,
      });
      setStrengthPlan(null);
      setMovements([]);
      setMethodBlocks([]);
      return;
    }
    const combinedMovements = [...result.suggestion.movements, ...finisher.movements];
    const block = circuitMethodBlock(
      finisher,
      result.suggestion.movements.length,
      "strength_finisher",
    );
    const combinedPlan: WorkoutPlanSuggestion = {
      ...result.suggestion,
      basis: `${result.suggestion.basis} Conditioning finisher: ${finisher.movements.length} movements × ${finisher.rounds} rounds with ${finisher.restBetweenRoundsSeconds}s between rounds.`,
      movements: combinedMovements,
      methodBlocks: block ? [block] : [],
    };
    setStrengthPlan(combinedPlan);
    setMovements(combinedMovements);
    setMethodBlocks(combinedPlan.methodBlocks ?? []);
    toast.success("Strength session built", {
      description: `${result.suggestion.movements.length} strength movements + ${finisher.estimatedMinutes}-minute conditioning finisher`,
    });
  };

  const generateCircuit = () => {
    if (!circuitMethod) {
      toast.error("The Circuit training method is unavailable. Enable it in Manage → Methods.");
      return;
    }
    const result = buildCircuit(circuitCandidates, circuitConfig);
    setCircuitBuild(result);
    setLockedCircuitIds([]);
    setCircuitVariation(0);
    setMethodBlocks([]);
    if (result.ok) {
      setMovements(result.movements);
      setCircuitMovementIds(result.selections.map((selection) => selection.candidate.id));
      toast.success("Circuit built", {
        description: `${result.movements.length} movements · ${result.rounds} rounds · about ${result.estimatedMinutes} minutes`,
      });
    } else {
      setMovements([]);
      setCircuitMovementIds([]);
    }
  };

  const updateCircuitInputs: React.Dispatch<React.SetStateAction<CircuitBuilderInputs>> = (
    action,
  ) => {
    setCircuitInputs(action);
    setCircuitBuild(null);
    setCircuitMovementIds([]);
    setLockedCircuitIds([]);
    setCircuitVariation(0);
    setMovements([]);
    setMethodBlocks([]);
  };

  const regenerateUnlockedCircuit = () => {
    if (!circuitBuild?.ok || circuitMovementIds.length < 3) return;
    const lockedIds = circuitMovementIds.filter((id) => lockedCircuitIds.includes(id));
    const unlockedIds = circuitMovementIds.filter((id) => !lockedIds.includes(id));
    const nextVariation = circuitVariation + 1;
    const buildOptions = {
      requiredExerciseIds: lockedIds,
      movementCount: circuitMovementIds.length,
      variation: nextVariation,
    };
    const refreshedConfig = {
      ...circuitConfig,
      excludedExerciseIds: Array.from(
        new Set([...circuitConfig.excludedExerciseIds, ...unlockedIds]),
      ),
    };
    let result = buildCircuit(circuitCandidates, refreshedConfig, buildOptions);
    if (!result.ok) result = buildCircuit(circuitCandidates, circuitConfig, buildOptions);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    const resultById = new Map(
      result.selections.map((selection, index) => [
        selection.candidate.id,
        { selection, movement: result.movements[index] },
      ]),
    );
    const currentMovementById = new Map(
      circuitMovementIds.map((id, index) => [id, movements[index]]),
    );
    const replacementIds = result.selections
      .map((selection) => selection.candidate.id)
      .filter((id) => !lockedIds.includes(id));
    const orderedIds = circuitMovementIds
      .map((id) => (lockedIds.includes(id) && resultById.has(id) ? id : replacementIds.shift()))
      .filter((id): id is string => Boolean(id));
    orderedIds.push(...replacementIds);
    const orderedSelections = orderedIds
      .map((id) => resultById.get(id)?.selection)
      .filter((selection): selection is (typeof result.selections)[number] => Boolean(selection));
    const orderedMovements = orderedIds
      .map((id) =>
        lockedIds.includes(id) ? currentMovementById.get(id) : resultById.get(id)?.movement,
      )
      .filter((movement): movement is WorkoutPlanMovement => Boolean(movement));
    const nextResult = {
      ...result,
      basis: `${result.basis} ${
        lockedIds.length
          ? `${lockedIds.length} locked movement${lockedIds.length === 1 ? " was" : "s were"} retained.`
          : "All movement slots were regenerated."
      }`,
      selections: orderedSelections,
      movements: orderedMovements,
    };
    setCircuitBuild(nextResult);
    setCircuitMovementIds(orderedIds);
    setLockedCircuitIds(lockedIds);
    setCircuitVariation(nextVariation);
    setMovements(orderedMovements);
    toast.success("Unlocked movements regenerated", {
      description: lockedIds.length
        ? `${lockedIds.length} locked movement${lockedIds.length === 1 ? " stayed" : "s stayed"} in the circuit.`
        : "The full movement mix was refreshed.",
    });
  };

  const swapCircuitMovement = (movementIndex: number, replacementId: string) => {
    if (!circuitBuild?.ok || lockedCircuitIds.includes(circuitMovementIds[movementIndex])) return;
    const nextIds = circuitMovementIds.map((id, index) =>
      index === movementIndex ? replacementId : id,
    );
    const result = buildCircuit(circuitCandidates, circuitConfig, {
      requiredExerciseIds: nextIds,
      movementCount: nextIds.length,
      variation: circuitVariation,
    });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    const generatedById = new Map(
      result.selections.map((selection, index) => [
        selection.candidate.id,
        { selection, movement: result.movements[index] },
      ]),
    );
    const orderedSelections = nextIds
      .map((id) => generatedById.get(id)?.selection)
      .filter((selection): selection is (typeof result.selections)[number] => Boolean(selection));
    const orderedMovements = nextIds.map((id, index) =>
      index === movementIndex
        ? (generatedById.get(id)?.movement ?? movements[index])
        : movements[index],
    );
    const replacedName = movements[movementIndex]?.exercise;
    const replacementName = orderedMovements[movementIndex]?.exercise;
    setCircuitBuild({
      ...result,
      basis: `${result.basis} One movement was swapped in the editable preview.`,
      selections: orderedSelections,
      movements: orderedMovements,
    });
    setCircuitMovementIds(nextIds);
    setMovements(orderedMovements);
    toast.success("Movement swapped", {
      description: `${replacedName} → ${replacementName}`,
    });
  };

  const toggleCircuitLock = (movementIndex: number) => {
    const exerciseId = circuitMovementIds[movementIndex];
    if (!exerciseId) return;
    setLockedCircuitIds((current) =>
      current.includes(exerciseId)
        ? current.filter((id) => id !== exerciseId)
        : [...current, exerciseId],
    );
  };

  const moveCircuitMovement = (movementIndex: number, direction: -1 | 1) => {
    const targetIndex = movementIndex + direction;
    if (targetIndex < 0 || targetIndex >= movements.length || !circuitBuild?.ok) return;
    const nextMovements = [...movements];
    [nextMovements[movementIndex], nextMovements[targetIndex]] = [
      nextMovements[targetIndex],
      nextMovements[movementIndex],
    ];
    const nextIds = [...circuitMovementIds];
    [nextIds[movementIndex], nextIds[targetIndex]] = [nextIds[targetIndex], nextIds[movementIndex]];
    const generatedById = new Map(
      circuitBuild.selections.map((selection, index) => [
        selection.candidate.id,
        { selection, movement: circuitBuild.movements[index] },
      ]),
    );
    setCircuitBuild({
      ...circuitBuild,
      selections: nextIds
        .map((id) => generatedById.get(id)?.selection)
        .filter((selection): selection is (typeof circuitBuild.selections)[number] =>
          Boolean(selection),
        ),
      movements: nextIds
        .map((id) => generatedById.get(id)?.movement)
        .filter((movement): movement is WorkoutPlanMovement => Boolean(movement)),
    });
    setCircuitMovementIds(nextIds);
    setMovements(nextMovements);
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

  const updateMovementRest = (movementIndex: number, value: string) =>
    setMovements((current) =>
      current.map((movement, index) =>
        index === movementIndex ? { ...movement, restTime: value } : movement,
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
    const removedCircuitId = circuitMovementIds[movementIndex];
    setMovements((current) => current.filter((_, index) => index !== movementIndex));
    if (plannerMode === "circuit") {
      setCircuitMovementIds((current) => current.filter((_, index) => index !== movementIndex));
      if (removedCircuitId) {
        setLockedCircuitIds((current) => current.filter((id) => id !== removedCircuitId));
      }
    }
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
      if (
        plannerMode === "strength" &&
        !draft.methodBlocks?.some((block) => block.config.generated_by === "strength_finisher")
      ) {
        throw new Error("Generated strength sessions must keep a conditioning finisher.");
      }
      const difficulty =
        plannerMode === "strength" ? strengthInputs.difficulty : circuitInputs.intensity;
      return saveWorkoutPlanClient({
        draft,
        readiness: difficulty === "standard" ? "normal" : "fresh",
        status,
      });
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
          See exactly what is coming in your programme, alongside the rest of your training week.
        </p>
      </header>

      {!history.isLoading && !library.isLoading && !history.error && !library.error ? (
        <WeeklyPlanOverview
          plan={weeklyPlan}
          programmeSessions={programmeSchedule.data ?? []}
          adjustments={weeklyAdjustments}
          onAdjustDay={adjustWeeklyDay}
        />
      ) : null}

      {programmeRefresh.error ? (
        <Card className="border-destructive/35">
          <CardContent className="p-4 text-sm text-destructive">
            Upcoming programme adjustments could not be loaded.
          </CardContent>
        </Card>
      ) : programmeRefresh.data ? (
        <ProgrammeRefreshCard
          assignment={programmeRefresh.data}
          saving={programmeRefreshMutation.isPending}
          onSave={async (updates) => {
            await programmeRefreshMutation.mutateAsync({
              assignmentId: programmeRefresh.data!.id,
              updates,
            });
          }}
        />
      ) : null}

      <div id="next-workout-builder" className="scroll-mt-24 border-t border-border pt-5">
        <Badge variant="outline" className="mb-2 text-[10px]">
          Additional session
        </Badge>
        <h2 className="text-base font-semibold">Build me a session</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Request strength or conditioning around your programme. Programme recovery is handled by
          its RPE, pain and technique checkpoints; this brief controls the extra session you want
          now.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          What do you want to train?
        </p>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-secondary/15 p-1.5">
          <button
            type="button"
            aria-pressed={plannerMode === "strength"}
            onClick={() => setPlannerMode("strength")}
            className={cn(
              "rounded-lg px-3 py-3 text-left transition",
              plannerMode === "strength"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="block text-sm font-medium">Strength</span>
            <span className="mt-0.5 block text-[11px]">Build from recent strength work</span>
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
            <span className="block text-sm font-medium">Conditioning</span>
            <span className="mt-0.5 block text-[11px]">Build an editable circuit brief</span>
          </button>
        </div>
      </div>

      <section className="grid gap-4">
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
      </section>

      {plannerMode === "strength" ? (
        <StrengthBuilderCard
          inputs={strengthInputs}
          onChange={updateStrengthInputs}
          candidateCount={guidedStrengthCandidates.length}
          result={strengthBuild}
          methodAvailable={Boolean(circuitMethod)}
          loading={library.isLoading || history.isLoading || trainingMethods.isLoading}
          onBuild={generateStrength}
        />
      ) : (
        <CircuitBuilderCard
          inputs={circuitInputs}
          onChange={updateCircuitInputs}
          candidateCount={locationCircuitCandidateCount}
          result={circuitBuild}
          methodAvailable={Boolean(circuitMethod)}
          loading={library.isLoading || trainingMethods.isLoading}
          onBuild={generateCircuit}
        />
      )}

      {library.isLoading ||
      (plannerMode === "strength" ? history.isLoading : trainingMethods.isLoading) ? (
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {plannerMode === "strength" ? "Loading strength history…" : "Loading circuit library…"}
        </div>
      ) : library.error || (plannerMode === "strength" ? history.error : trainingMethods.error) ? (
        <Card className="border-destructive/40">
          <CardContent className="p-6 text-sm text-destructive">
            {plannerMode === "strength"
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
                    ? "Generated strength session"
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
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">Suggested movements</h2>
                <p className="text-xs text-muted-foreground">
                  {plannerMode === "circuit"
                    ? "Lock favourites, swap exercises, change the order, or edit the dose."
                    : "Edit every strength and conditioning target before saving or starting."}
                </p>
              </div>
              <div className="flex w-full flex-wrap gap-1.5 sm:w-auto sm:justify-end">
                {plannerMode === "circuit" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={movements.length < 3}
                    onClick={regenerateUnlockedCircuit}
                  >
                    <RefreshCw className="mr-1 h-3.5 w-3.5" /> Regenerate unlocked
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMovements(activePlan.movements);
                    setMethodBlocks(activePlan.methodBlocks ?? []);
                    if (plannerMode === "circuit" && circuitBuild?.ok) {
                      setCircuitMovementIds(
                        circuitBuild.selections.map((selection) => selection.candidate.id),
                      );
                      setLockedCircuitIds([]);
                    }
                  }}
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
                </Button>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              {movements.map((movement, movementIndex) => (
                <MovementPlanCard
                  key={`${movement.exercise}-${movementIndex}`}
                  movement={movement}
                  index={movementIndex}
                  onUpdateSet={updateSet}
                  onUpdateTarget={updateTarget}
                  onUpdateRest={updateMovementRest}
                  onRemoveSet={removeSet}
                  onAddSet={addSet}
                  onRemoveMovement={() => removeMovement(movementIndex)}
                  circuitControls={
                    plannerMode === "circuit"
                      ? {
                          locked: lockedCircuitIds.includes(
                            circuitMovementIds[movementIndex] ?? "",
                          ),
                          swapOptions: circuitSwapOptions[movementIndex] ?? [],
                          canMoveUp: movementIndex > 0,
                          canMoveDown: movementIndex < movements.length - 1,
                          onToggleLock: () => toggleCircuitLock(movementIndex),
                          onSwap: (replacementId) =>
                            swapCircuitMovement(movementIndex, replacementId),
                          onMoveUp: () => moveCircuitMovement(movementIndex, -1),
                          onMoveDown: () => moveCircuitMovement(movementIndex, 1),
                        }
                      : undefined
                  }
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
                  : "The conditioning finisher is stored as a Circuit block after the strength work."}
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
                    {plannerMode === "strength" &&
                    block.config.generated_by === "strength_finisher" ? (
                      <Badge variant="outline" className="shrink-0 text-[9px]">
                        Required finisher
                      </Badge>
                    ) : (
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
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                {plannerMode === "circuit"
                  ? "No Circuit block is attached. Rebuild the circuit or enable the Circuit method in Manage."
                  : "No conditioning finisher is attached. Rebuild the session or enable the Circuit method in Manage."}
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
                    Standard uses normal evidence-led progression. Hard adds one work set; Very hard
                    adds up to two, with every movement capped at five sets. Reaching 5s allows a
                    2.5 kg progression, and every generated strength session ends with conditioning.
                    You can still edit every target before saving.
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

function StrengthBuilderCard({
  inputs,
  onChange,
  candidateCount,
  result,
  methodAvailable,
  loading,
  onBuild,
}: {
  inputs: StrengthBuilderInputs;
  onChange: React.Dispatch<React.SetStateAction<StrengthBuilderInputs>>;
  candidateCount: number;
  result: GuidedStrengthBuildResult | null;
  methodAvailable: boolean;
  loading: boolean;
  onBuild: () => void;
}) {
  const update = <K extends keyof StrengthBuilderInputs>(key: K, value: StrengthBuilderInputs[K]) =>
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
            <CardTitle className="text-sm">Strength brief</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Answer the questions below. The app builds from relevant recent strength work and
              always adds an editable conditioning finisher.
            </p>
          </div>
          <Badge variant="outline" className="border-cyan-400/30 text-[10px] text-cyan-200">
            {candidateCount} previously trained movements
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-4 pt-3">
        <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Total duration
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={30}
                max={90}
                step={5}
                value={inputs.durationMinutes}
                onChange={(event) =>
                  update("durationMinutes", Math.max(30, Math.min(90, Number(event.target.value))))
                }
              />
              <span className="text-xs text-muted-foreground">minutes</span>
            </div>
          </div>
          <CircuitChoiceGroup
            label="Focus"
            value={inputs.focus}
            options={STRENGTH_FOCUS_OPTIONS}
            onChange={(value) => update("focus", value as StrengthFocus)}
          />
        </div>

        <CircuitChoiceGroup
          label="Difficulty"
          value={inputs.difficulty}
          options={SESSION_DIFFICULTY_OPTIONS}
          onChange={(value) => update("difficulty", value as SessionDifficulty)}
        />

        <div className="space-y-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Equipment
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Any available uses everything configured for this location.
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

        <label className="block space-y-1.5 text-xs">
          <span className="font-medium">Exclude movements</span>
          <Input
            value={inputs.excludedMovements}
            onChange={(event) => update("excludedMovements", event.target.value)}
            placeholder="e.g. Back squat, burpees"
          />
          <span className="block text-[10px] text-muted-foreground">
            Applies to both the strength block and conditioning finisher.
          </span>
        </label>

        {result && !result.ok ? (
          <p className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-3 text-xs text-amber-100">
            {result.message} ({result.eligibleCount} eligible)
          </p>
        ) : result?.ok ? (
          <p className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.04] p-3 text-xs text-muted-foreground">
            Planned split: about {result.strengthMinutes} minutes strength +{" "}
            {result.finisherMinutes}
            minutes conditioning.
          </p>
        ) : null}

        {!loading && !methodAvailable ? (
          <p className="text-xs text-amber-200">
            Enable the system Circuit training method in Manage → Methods. Every generated strength
            session includes a conditioning finisher.
          </p>
        ) : null}

        <Button
          type="button"
          className="w-full sm:w-auto"
          size="lg"
          disabled={loading || !methodAvailable || candidateCount < 2}
          onClick={onBuild}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Build strength session
        </Button>
      </CardContent>
    </Card>
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
            <CardTitle className="text-sm">Conditioning brief</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Answer the questions below. The generator favours movements you have done before,
              respects equipment available at this location, and keeps the result fully editable.
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
          Build conditioning session
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

function MovementPlanCard({
  movement,
  index,
  onUpdateSet,
  onUpdateTarget,
  onUpdateRest,
  onRemoveSet,
  onAddSet,
  onRemoveMovement,
  circuitControls,
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
  onUpdateRest: (movementIndex: number, value: string) => void;
  onRemoveSet: (movementIndex: number, setIndex: number) => void;
  onAddSet: (movementIndex: number) => void;
  onRemoveMovement: () => void;
  circuitControls?: {
    locked: boolean;
    swapOptions: CircuitCandidate[];
    canMoveUp: boolean;
    canMoveDown: boolean;
    onToggleLock: () => void;
    onSwap: (replacementId: string) => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
  };
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
            <div className="flex flex-wrap items-center gap-1.5">
              <CardTitle className="truncate text-sm">{movement.exercise}</CardTitle>
              {circuitControls?.locked ? (
                <Badge variant="outline" className="border-cyan-400/30 text-[9px] text-cyan-200">
                  <Lock className="mr-1 h-2.5 w-2.5" /> Locked
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {movement.sourceDate
                ? `Last pattern: ${formatUKDate(movement.sourceDate)}`
                : "Circuit selection"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {circuitControls ? (
              <>
                <Button
                  variant={circuitControls.locked ? "outline" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={circuitControls.onToggleLock}
                >
                  {circuitControls.locked ? (
                    <LockOpen className="h-3.5 w-3.5" />
                  ) : (
                    <Lock className="h-3.5 w-3.5" />
                  )}
                  <span className="sr-only">
                    {circuitControls.locked ? "Unlock" : "Lock"} {movement.exercise}
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={!circuitControls.canMoveUp}
                  onClick={circuitControls.onMoveUp}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                  <span className="sr-only">Move {movement.exercise} earlier</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={!circuitControls.canMoveDown}
                  onClick={circuitControls.onMoveDown}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                  <span className="sr-only">Move {movement.exercise} later</span>
                </Button>
              </>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={circuitControls?.locked}
              onClick={onRemoveMovement}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Remove {movement.exercise}</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-1">
        {circuitControls ? (
          <div className="flex items-center gap-2">
            <Shuffle className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
            <Select
              disabled={circuitControls.locked || circuitControls.swapOptions.length === 0}
              onValueChange={circuitControls.onSwap}
            >
              <SelectTrigger
                className="h-9 flex-1 text-xs"
                aria-label={`Swap ${movement.exercise}`}
              >
                <SelectValue
                  placeholder={
                    circuitControls.locked
                      ? "Unlock to swap"
                      : circuitControls.swapOptions.length
                        ? "Swap this movement…"
                        : "No compatible swaps"
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {circuitControls.swapOptions.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.name} · {candidate.circuitPattern.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
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
        {movement.sourceDate ? (
          <label className="block space-y-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Rest between sets</span>
            <Input
              value={movement.restTime ?? ""}
              onChange={(event) => onUpdateRest(index, event.target.value)}
              placeholder="e.g. 3 min"
              className="normal-case tracking-normal text-foreground"
            />
          </label>
        ) : null}
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
