import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  Check,
  ChevronsUpDown,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LibraryRow } from "@/lib/training-types";
import {
  getMovementMetricProfile,
  getTrackingModeLabel,
  getTrackingModeValue,
  TRACKING_MODE_OPTIONS,
  type MetricProfile,
  type TrackingMode,
} from "@/lib/movement-metrics";
import {
  addExerciseClient,
  claimNoamProfile,
  hideExerciseClient,
  listLibraryClient,
  setExerciseEnabledClient,
  setExerciseLocationScopeClient,
  setExerciseQuickLogClient,
  updateExerciseClient,
  type ExerciseLocationScope,
  type LibraryClientRow,
  type LibraryEquipmentItem,
} from "@/lib/supabase-library.browser";
import { ExerciseDetail } from "@/components/exercise-detail";
import { SettingsBackLink } from "@/components/settings-back-link";
import {
  CIRCUIT_DIFFICULTY_OPTIONS,
  CIRCUIT_DOSE_MODE_OPTIONS,
  CIRCUIT_IMPACT_OPTIONS,
  CIRCUIT_MOVEMENT_PATTERN_OPTIONS,
  CIRCUIT_SUITABILITY_OPTIONS,
  DEFAULT_CIRCUIT_METADATA,
  circuitDoseDefaultsForTrackingMode,
  circuitDoseLabel,
  circuitOptionLabel,
  type CircuitDifficulty,
  type CircuitDoseMode,
  type CircuitImpact,
  type CircuitMovementPattern,
  type CircuitSuitability,
} from "@/lib/circuit-metadata";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Exercise Library · Training Tracker" },
      {
        name: "description",
        content: "Add, edit and remove movements in the Supabase exercise library.",
      },
    ],
  }),
  component: LibraryPage,
});

type EditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; row: LibraryClientRow };

const BLANK: Omit<LibraryRow, "row"> & { equipmentItemIds: string[] } = {
  workoutType: "",
  focusArea: "",
  name: "",
  equipment: "",
  metric: "",
  suggestedSets: "",
  suggestedReps: "",
  notes: "",
  equipmentItemIds: [],
  ...DEFAULT_CIRCUIT_METADATA,
};

type LibraryFieldConfig = {
  focusLabel: string;
  focusPlaceholder: string;
  equipmentLabel: string;
  equipmentPlaceholder: string;
  setsLabel: string;
  setsPlaceholder: string;
  repsLabel: string;
  repsPlaceholder: string;
  defaults: Partial<typeof BLANK>;
};

function libraryConfigFor(profile: MetricProfile): LibraryFieldConfig {
  const base: LibraryFieldConfig = {
    focusLabel: "Focus",
    focusPlaceholder: "Push, pull, legs...",
    equipmentLabel: "Equipment",
    equipmentPlaceholder: "Barbell",
    setsLabel: "Suggested sets",
    setsPlaceholder: "3",
    repsLabel: "Suggested reps / time",
    repsPlaceholder: "5-8",
    defaults: {
      metric: "weight_reps",
      suggestedSets: "3",
      suggestedReps: "5-8",
    },
  };

  if (profile === "time") {
    return {
      ...base,
      focusLabel: "Style",
      focusPlaceholder: "Easy, intervals, recovery...",
      equipmentLabel: "Equipment",
      equipmentPlaceholder: "Road, treadmill, bike, rower...",
      setsLabel: "Suggested minutes",
      setsPlaceholder: "30",
      repsLabel: "Distance / detail",
      repsPlaceholder: "5 km, zone 2...",
      defaults: { metric: "distance_time", suggestedSets: "", suggestedReps: "" },
    };
  }

  if (profile === "duration") {
    return {
      ...base,
      focusLabel: "Session style",
      focusPlaceholder: "Class, recovery, practice...",
      equipmentLabel: "Equipment",
      equipmentPlaceholder: "Mat, studio, bike...",
      setsLabel: "Suggested minutes",
      setsPlaceholder: "30",
      repsLabel: "Default detail",
      repsPlaceholder: "Zone 2, easy flow...",
      defaults: { metric: "duration", suggestedSets: "", suggestedReps: "" },
    };
  }

  if (profile === "reps") {
    return {
      ...base,
      focusLabel: "Skill area",
      focusPlaceholder: "Push, pull, legs, skill...",
      equipmentLabel: "Assistance / load",
      equipmentPlaceholder: "Bodyweight / rings / bar / assistance",
      repsLabel: "Suggested total reps",
      repsPlaceholder: "6-10",
      defaults: {
        equipment: "Bodyweight / Assistance / Added weight",
        metric: "reps_only",
        suggestedSets: "3",
        suggestedReps: "6-10",
      },
    };
  }

  if (profile === "hold" || profile === "grip") {
    return {
      ...base,
      focusLabel: profile === "grip" ? "Grip style" : "Progression",
      focusPlaceholder: profile === "grip" ? "Open hand, pinch..." : "Tuck, straddle...",
      equipmentLabel: profile === "grip" ? "Load / implement" : "Assistance",
      equipmentPlaceholder:
        profile === "grip" ? "Hangboard, pinch block..." : "Wall, band, rings...",
      setsLabel: "Suggested attempts",
      setsPlaceholder: "3",
      repsLabel: "Suggested hold",
      repsPlaceholder: "10-20 sec",
      defaults: {
        metric: profile === "grip" ? "grip_hold" : "hold",
        suggestedSets: "3",
        suggestedReps: "",
      },
    };
  }

  if (profile === "mobility_position") {
    return {
      ...base,
      focusLabel: "Position group",
      focusPlaceholder: "Flexibility",
      equipmentLabel: "Equipment",
      equipmentPlaceholder: "Mat, wall, floor...",
      setsLabel: "Suggested hold",
      setsPlaceholder: "60 sec",
      repsLabel: "Target / detail",
      repsPlaceholder: "Distance, depth, feel...",
      defaults: {
        equipment: "Mat",
        metric: "mobility_position",
        suggestedSets: "",
        suggestedReps: "",
      },
    };
  }

  if (profile === "climbing") {
    return {
      ...base,
      focusLabel: "Climbing style",
      focusPlaceholder: "Bouldering, ropes, board...",
      equipmentLabel: "Venue / board",
      equipmentPlaceholder: "Climbing gym, Kilter board...",
      setsLabel: "Suggested minutes",
      setsPlaceholder: "90",
      repsLabel: "Problems / routes",
      repsPlaceholder: "10-20",
      defaults: {
        equipment: "Climbing gym",
        metric: "climbing",
        suggestedSets: "",
        suggestedReps: "",
      },
    };
  }

  if (profile === "carry" || profile === "conditioning") {
    return {
      ...base,
      focusLabel: "Style",
      focusPlaceholder: "Carry, circuit, conditioning...",
      equipmentLabel: "Load / equipment",
      equipmentPlaceholder: "Kettlebell, dumbbell, sled...",
      setsLabel: profile === "carry" ? "Suggested rounds" : "Suggested minutes",
      setsPlaceholder: profile === "carry" ? "4" : "10",
      repsLabel: "Detail",
      repsPlaceholder: profile === "carry" ? "20 m" : "Rounds, reps per minute...",
      defaults: {
        metric: profile,
      },
    };
  }

  if (profile === "power") {
    return {
      ...base,
      focusLabel: "Power focus",
      focusPlaceholder: "Jump, throw, explosive...",
      equipmentLabel: "Equipment",
      equipmentPlaceholder: "Box, med ball, markers...",
      setsLabel: "Suggested sets",
      setsPlaceholder: "3",
      repsLabel: "Suggested jumps / reps",
      repsPlaceholder: "3-5",
      defaults: { metric: "power", suggestedSets: "3", suggestedReps: "3-5" },
    };
  }

  return base;
}

function withTypeDefaults(form: typeof BLANK, workoutType: string, config: LibraryFieldConfig) {
  return {
    ...form,
    workoutType,
    focusArea: form.focusArea || config.defaults.focusArea || "",
    equipment: form.equipment || config.defaults.equipment || "",
    metric: form.metric || config.defaults.metric || "weight_reps",
    suggestedSets: form.suggestedSets || config.defaults.suggestedSets || "",
    suggestedReps: form.suggestedReps || config.defaults.suggestedReps || "",
    notes: form.notes || config.defaults.notes || "",
  };
}

function workoutTypeChipClass(workoutType: string) {
  const normalized = workoutType.toLowerCase();
  if (normalized.includes("strength")) {
    return "border-rose-400/25 bg-rose-400/10 text-rose-200";
  }
  if (normalized.includes("climb")) {
    return "border-amber-400/25 bg-amber-400/10 text-amber-200";
  }
  if (
    normalized.includes("cardio") ||
    normalized.includes("run") ||
    normalized.includes("conditioning")
  ) {
    return "border-sky-400/25 bg-sky-400/10 text-sky-200";
  }
  if (normalized.includes("skill") || normalized.includes("calisthenics")) {
    return "border-primary/25 bg-primary/10 text-primary";
  }
  if (normalized.includes("mobility") || normalized.includes("yoga")) {
    return "border-violet-400/25 bg-violet-400/10 text-violet-200";
  }
  return "border-border bg-secondary text-secondary-foreground";
}

function focusChipClass(focusArea: string) {
  const normalized = focusArea.toLowerCase();
  if (normalized.includes("push")) return "border-rose-400/20 bg-rose-400/[0.06] text-rose-200";
  if (normalized.includes("pull")) return "border-sky-400/20 bg-sky-400/[0.06] text-sky-200";
  if (normalized.includes("leg") || normalized.includes("lower")) {
    return "border-amber-400/20 bg-amber-400/[0.06] text-amber-200";
  }
  if (normalized.includes("mobility") || normalized.includes("flex")) {
    return "border-violet-400/20 bg-violet-400/[0.06] text-violet-200";
  }
  return "border-border bg-secondary/50 text-muted-foreground";
}

function circuitChipClass(suitability: CircuitSuitability) {
  if (suitability === "preferred") {
    return "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200";
  }
  if (suitability === "excluded") {
    return "border-border bg-secondary/40 text-muted-foreground";
  }
  return "border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-200";
}

function LibraryPage() {
  const qc = useQueryClient();

  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [showInactive, setShowInactive] = useState(false);
  const list = useQuery({
    queryKey: ["library", selectedPersonId, showInactive],
    queryFn: () => listLibraryClient(selectedPersonId || undefined, showInactive),
  });

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [locationFilter, setLocationFilter] = useState<"" | "home" | "gym">("");
  const [circuitFilter, setCircuitFilter] = useState<"" | CircuitSuitability>("");
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [pendingDelete, setPendingDelete] = useState<LibraryClientRow | null>(null);
  const [selected, setSelected] = useState<LibraryClientRow | null>(null);

  const effectivePersonId = list.data?.selectedPersonId ?? selectedPersonId;

  const filtered = useMemo(() => {
    const items = list.data?.items ?? [];
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (typeFilter && i.workoutType !== typeFilter) return false;
      if (locationFilter && !i.availableLocationKinds.includes(locationFilter)) return false;
      if (circuitFilter && i.circuitSuitability !== circuitFilter) return false;
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        i.equipment.toLowerCase().includes(q) ||
        i.notes.toLowerCase().includes(q)
      );
    });
  }, [circuitFilter, list.data, locationFilter, search, typeFilter]);
  const filtersActive = Boolean(search.trim() || typeFilter || locationFilter || circuitFilter);

  const addMutation = useMutation({
    mutationFn: (fields: typeof BLANK) => addExerciseClient(fields, effectivePersonId || undefined),
    onSuccess: () => {
      toast.success("Movement added");
      setEditor({ mode: "closed" });
      qc.invalidateQueries({ queryKey: ["library"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: typeof BLANK }) =>
      updateExerciseClient(id, fields, effectivePersonId || undefined),
    onSuccess: () => {
      toast.success("Movement updated");
      setEditor({ mode: "closed" });
      qc.invalidateQueries({ queryKey: ["library"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => hideExerciseClient(id),
    onSuccess: () => {
      toast.success("Movement deleted");
      setPendingDelete(null);
      qc.invalidateQueries({ queryKey: ["library"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enableMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      setExerciseEnabledClient(id, enabled, effectivePersonId || undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const locationMutation = useMutation({
    mutationFn: ({ id, scope }: { id: string; scope: ExerciseLocationScope }) =>
      setExerciseLocationScopeClient(id, scope, effectivePersonId || undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const quickLogMutation = useMutation({
    mutationFn: ({ id, quickLog }: { id: string; quickLog: boolean }) =>
      setExerciseQuickLogClient(id, quickLog, effectivePersonId || undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const claimMutation = useMutation({
    mutationFn: () => claimNoamProfile(),
    onSuccess: () => {
      toast.success("Profile connected");
      qc.invalidateQueries({ queryKey: ["library"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <SettingsBackLink />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-1 min-w-[200px] flex-col gap-1">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Search
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, equipment, or notes"
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Type
          </Label>
          <FilterSelect
            value={typeFilter}
            onChange={setTypeFilter}
            options={list.data?.workoutTypes ?? []}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Circuit
          </Label>
          <Select
            value={circuitFilter || "all"}
            onValueChange={(value) =>
              setCircuitFilter(value === "all" ? "" : (value as CircuitSuitability))
            }
          >
            <SelectTrigger className="h-10 w-[135px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {CIRCUIT_SUITABILITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Location
          </Label>
          <Select
            value={locationFilter || "all"}
            onValueChange={(value) =>
              setLocationFilter(value === "all" ? "" : (value as "home" | "gym"))
            }
          >
            <SelectTrigger className="h-10 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="home">Home</SelectItem>
              <SelectItem value="gym">Gym</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(list.data?.people.length ?? 0) > 1 && (
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Person
            </Label>
            <Select
              value={effectivePersonId || ""}
              onValueChange={(v) => {
                setSelected(null);
                setSelectedPersonId(v);
              }}
            >
              <SelectTrigger className="h-10 w-[150px]">
                <SelectValue placeholder="Person" />
              </SelectTrigger>
              <SelectContent>
                {list.data?.people.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex h-10 items-center gap-2 rounded-md border border-border px-3">
          <Switch
            checked={showInactive}
            onCheckedChange={(checked) => {
              setSelected(null);
              setShowInactive(checked);
            }}
            aria-label="Show inactive movements"
          />
          <span className="text-xs text-muted-foreground">Show inactive</span>
        </div>
        <Button
          onClick={() => setEditor({ mode: "create" })}
          className="ml-auto h-10 font-medium"
          style={{ backgroundImage: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
        >
          <Plus className="mr-1 h-4 w-4" /> Add movement
        </Button>
      </div>

      <p className="-mt-2 text-xs text-muted-foreground">
        Quick log pins a movement to the top of the movement picker when logging a workout.
      </p>

      {filtersActive && (
        <p className="-mt-2 text-xs text-muted-foreground">
          {filtered.length} movement{filtered.length !== 1 ? "s" : ""}
        </p>
      )}

      <div>
        {list.isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading library…
          </div>
        ) : list.data?.needsProfileClaim ? (
          <Card className="space-y-4 border-border bg-card p-5">
            <div>
              <h3 className="text-sm font-semibold">Connect your profile</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Link this Supabase login to Noam's imported training data.
              </p>
            </div>
            <Button
              onClick={() => claimMutation.mutate()}
              disabled={claimMutation.isPending}
              className="h-10 font-medium"
              style={{
                backgroundImage: "var(--gradient-primary)",
                color: "var(--primary-foreground)",
              }}
            >
              {claimMutation.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <UserCheck className="mr-1 h-4 w-4" />
              )}
              Connect profile
            </Button>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            No movements match the current filters.
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((ex) => {
              const isSelected = selected?.row === ex.row;
              return (
                <Fragment key={ex.row}>
                  <Card
                    onClick={() => setSelected(isSelected ? null : ex)}
                    className={`group flex cursor-pointer flex-col items-start gap-3 border-border bg-card p-3 transition hover:border-primary/50 sm:flex-row ${
                      isSelected ? "border-primary/70 ring-1 ring-primary/40" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="font-medium">{ex.name}</p>
                        {ex.workoutType && (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${workoutTypeChipClass(ex.workoutType)}`}
                          >
                            {ex.workoutType}
                          </span>
                        )}
                        {ex.focusArea && (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${focusChipClass(ex.focusArea)}`}
                          >
                            {ex.focusArea}
                          </span>
                        )}
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${circuitChipClass(ex.circuitSuitability)}`}
                        >
                          {ex.circuitSuitability === "excluded"
                            ? "No circuits"
                            : `${circuitOptionLabel(CIRCUIT_SUITABILITY_OPTIONS, ex.circuitSuitability)} circuit`}
                        </span>
                        <span className="rounded-full border border-sky-400/20 bg-sky-400/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-wider text-sky-300">
                          {ex.locationScope === "both"
                            ? "Home + Gym"
                            : ex.locationScope === "home"
                              ? "Home"
                              : "Gym"}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                            ex.availableLocationNames.length
                              ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300"
                              : "border-amber-400/25 bg-amber-400/[0.08] text-amber-300"
                          }`}
                        >
                          {ex.availableLocationNames.length
                            ? `At ${ex.availableLocationNames.join(", ")}`
                            : "No equipped location"}
                        </span>
                        {!ex.enabled && (
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                            Disabled
                          </span>
                        )}
                        {!ex.active && (
                          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-300">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[
                          ex.equipment,
                          getTrackingModeLabel({
                            workoutType: ex.workoutType,
                            movement: ex.name,
                            defaultMetric: ex.metric,
                          }),
                          ex.suggestedSets && `${ex.suggestedSets} sets`,
                          ex.suggestedReps && `${ex.suggestedReps}`,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground/80">
                        {circuitOptionLabel(CIRCUIT_MOVEMENT_PATTERN_OPTIONS, ex.circuitPattern)} ·{" "}
                        {circuitOptionLabel(CIRCUIT_DIFFICULTY_OPTIONS, ex.circuitDifficulty)} ·{" "}
                        {circuitOptionLabel(CIRCUIT_IMPACT_OPTIONS, ex.circuitImpact)} impact ·{" "}
                        {circuitDoseLabel(ex)}
                      </p>
                      {ex.notes && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/90">
                          {ex.notes}
                        </p>
                      )}
                    </div>
                    <div
                      className="flex w-full shrink-0 flex-wrap justify-end gap-1 sm:w-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {ex.active && (
                        <Select
                          value={ex.locationScope}
                          onValueChange={(scope) =>
                            locationMutation.mutate({
                              id: ex.id,
                              scope: scope as ExerciseLocationScope,
                            })
                          }
                          disabled={locationMutation.isPending}
                        >
                          <SelectTrigger
                            className="h-8 w-[112px] text-xs"
                            aria-label={`Training location for ${ex.name}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="both">Both</SelectItem>
                            <SelectItem value="home">Home</SelectItem>
                            <SelectItem value="gym">Gym</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {ex.active && (
                        <div className="flex items-center gap-2 rounded-md border border-border px-2 py-1">
                          <span className="text-xs text-muted-foreground">Quick log</span>
                          <Switch
                            checked={ex.quickLog}
                            onCheckedChange={(quickLog) =>
                              quickLogMutation.mutate({ id: ex.id, quickLog })
                            }
                            disabled={quickLogMutation.isPending}
                            aria-label={`${ex.quickLog ? "Remove" : "Add"} ${ex.name} ${ex.quickLog ? "from" : "to"} quick logging`}
                          />
                        </div>
                      )}
                      {ex.active && (
                        <div className="flex items-center gap-2 rounded-md border border-border px-2 py-1">
                          <span className="text-xs text-muted-foreground">Use</span>
                          <Switch
                            checked={ex.enabled}
                            onCheckedChange={(enabled) =>
                              enableMutation.mutate({ id: ex.id, enabled })
                            }
                            disabled={enableMutation.isPending}
                            aria-label={`${ex.enabled ? "Disable" : "Enable"} ${ex.name}`}
                          />
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelected(isSelected ? null : ex)}
                        aria-label={`View history for ${ex.name}`}
                        className="gap-1 px-2 text-xs"
                      >
                        <Activity className="h-4 w-4" />
                        {isSelected ? "Hide" : "History"}
                      </Button>
                      <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditor({ mode: "edit", row: ex })}
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {ex.active && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPendingDelete(ex)}
                            aria-label="Delete"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                  {isSelected && (
                    <div className="overflow-hidden rounded-lg border border-primary/30 bg-card">
                      <ExerciseDetail exercise={ex} onClose={() => setSelected(null)} />
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        )}
      </div>

      <ExerciseEditorDialog
        state={editor}
        onClose={() => setEditor({ mode: "closed" })}
        workoutTypes={list.data?.workoutTypes ?? []}
        equipmentItems={list.data?.equipmentItems ?? []}
        onSubmit={(fields) => {
          if (editor.mode === "create") {
            addMutation.mutate(fields);
          } else if (editor.mode === "edit") {
            updateMutation.mutate({ id: editor.row.id, fields });
          }
        }}
        isPending={addMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this movement?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.name} will be removed from the active library. Training history stays
              preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const ALL = "__all";
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
      <SelectTrigger className="h-10 w-[150px]">
        <SelectValue placeholder="All" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EquipmentMultiSelect({
  items,
  selectedIds,
  onChange,
}: {
  items: LibraryEquipmentItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const selected = items.filter((item) => selectedIds.includes(item.id));
  const toggle = (item: LibraryEquipmentItem) => {
    if (!item.isActive && !selectedIds.includes(item.id)) return;
    onChange(
      selectedIds.includes(item.id)
        ? selectedIds.filter((id) => id !== item.id)
        : [...selectedIds, item.id],
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="h-auto min-h-10 w-full justify-between px-3 py-2 text-left font-normal"
        >
          <span className="min-w-0">
            {selected.length ? selected.map((item) => item.name).join(", ") : "No equipment"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search equipment…" />
          <CommandList>
            <CommandEmpty>
              No equipment found. Add it under Manage → Training Locations.
            </CommandEmpty>
            <CommandGroup>
              {items.map((item) => {
                const checked = selectedIds.includes(item.id);
                return (
                  <CommandItem
                    key={item.id}
                    value={`${item.name} ${item.category}`}
                    disabled={!item.isActive && !checked}
                    onSelect={() => toggle(item)}
                  >
                    <Check className={`mr-2 h-4 w-4 ${checked ? "opacity-100" : "opacity-0"}`} />
                    <span className="flex-1">{item.name}</span>
                    {!item.isActive ? (
                      <span className="text-[10px] uppercase text-muted-foreground">Archived</span>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ExerciseEditorDialog({
  state,
  onClose,
  onSubmit,
  isPending,
  workoutTypes,
  equipmentItems,
}: {
  state: EditorState;
  onClose: () => void;
  onSubmit: (fields: typeof BLANK) => void;
  isPending: boolean;
  workoutTypes: string[];
  equipmentItems: LibraryEquipmentItem[];
}) {
  const initial =
    state.mode === "edit"
      ? {
          workoutType: state.row.workoutType,
          focusArea: state.row.focusArea,
          name: state.row.name,
          equipment: state.row.equipment,
          metric: getTrackingModeValue({
            workoutType: state.row.workoutType,
            movement: state.row.name,
            defaultMetric: state.row.metric,
          }),
          suggestedSets: state.row.suggestedSets,
          suggestedReps: state.row.suggestedReps,
          notes: state.row.notes,
          equipmentItemIds: state.row.equipmentItemIds,
          circuitSuitability: state.row.circuitSuitability,
          circuitPattern: state.row.circuitPattern,
          circuitDifficulty: state.row.circuitDifficulty,
          circuitImpact: state.row.circuitImpact,
          circuitDoseMode: state.row.circuitDoseMode,
          circuitDoseMin: state.row.circuitDoseMin,
          circuitDoseMax: state.row.circuitDoseMax,
          circuitDosePerSide: state.row.circuitDosePerSide,
        }
      : BLANK;

  const [form, setForm] = useState<typeof BLANK>(initial);

  // reset when state changes
  useResetOnChange(state, () => setForm(initial));

  const update = <K extends keyof typeof BLANK>(k: K, v: (typeof BLANK)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const profile = getMovementMetricProfile({
    workoutType: form.workoutType,
    movement: form.name,
    defaultMetric: form.metric,
  });
  const fieldConfig = libraryConfigFor(profile);
  const updateType = (workoutType: string) => {
    const nextProfile = getMovementMetricProfile({
      workoutType,
      movement: form.name,
      defaultMetric: form.metric,
    });
    const nextConfig = libraryConfigFor(nextProfile);
    const nextMode = getTrackingModeValue({
      workoutType,
      movement: form.name,
      defaultMetric: form.metric,
    });
    setForm((f) => withTypeDefaults({ ...f, metric: nextMode }, workoutType, nextConfig));
  };
  const updateTracking = (trackingMode: TrackingMode) => {
    const nextProfile = TRACKING_MODE_OPTIONS.find(
      (option) => option.value === trackingMode,
    )?.profile;
    if (!nextProfile) return;
    const nextConfig = libraryConfigFor(nextProfile);
    const circuitDose = circuitDoseDefaultsForTrackingMode(trackingMode);
    setForm((current) => ({
      ...current,
      metric: trackingMode,
      suggestedSets: String(nextConfig.defaults.suggestedSets ?? ""),
      suggestedReps: String(nextConfig.defaults.suggestedReps ?? ""),
      ...circuitDose,
    }));
  };

  const open = state.mode !== "closed";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{state.mode === "edit" ? "Edit movement" : "New movement"}</DialogTitle>
          <DialogDescription>
            {state.mode === "edit"
              ? `Update ${state.row.name} in Supabase.`
              : "Add a new exercise or skill to Supabase."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim()) {
              toast.error("Name is required");
              return;
            }
            if (!form.metric) {
              toast.error("Choose a tracking mode");
              return;
            }
            const doseMin = Number(form.circuitDoseMin);
            const doseMax = Number(form.circuitDoseMax);
            if (!Number.isFinite(doseMin) || doseMin <= 0) {
              toast.error("Circuit dose minimum must be greater than zero");
              return;
            }
            if (!Number.isFinite(doseMax) || doseMax < doseMin) {
              toast.error("Circuit dose maximum must be at least the minimum");
              return;
            }
            onSubmit(form);
          }}
          className="space-y-3"
        >
          <Field label="Type">
            <DatalistInput
              value={form.workoutType}
              onChange={updateType}
              options={workoutTypes}
              placeholder="Choose type first"
              listId="lib-types"
              autoFocus
            />
          </Field>
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Bench Press"
              autoCapitalize="words"
            />
          </Field>
          <Field label="Tracking">
            <Select
              value={form.metric}
              onValueChange={(value) => updateTracking(value as TrackingMode)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose what you want to track" />
              </SelectTrigger>
              <SelectContent>
                {TRACKING_MODE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={fieldConfig.focusLabel}>
            <Input
              value={form.focusArea}
              onChange={(e) => update("focusArea", e.target.value)}
              placeholder={fieldConfig.focusPlaceholder}
            />
          </Field>
          <Field label="Required equipment">
            <EquipmentMultiSelect
              items={equipmentItems}
              selectedIds={form.equipmentItemIds}
              onChange={(equipmentItemIds) => update("equipmentItemIds", equipmentItemIds)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Every selected item must be available at a training location. Leave empty for
              bodyweight or no-equipment movements.
            </p>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={fieldConfig.setsLabel}>
              <Input
                value={form.suggestedSets}
                onChange={(e) => update("suggestedSets", e.target.value)}
                placeholder={fieldConfig.setsPlaceholder}
              />
            </Field>
            <Field label={fieldConfig.repsLabel}>
              <Input
                value={form.suggestedReps}
                onChange={(e) => update("suggestedReps", e.target.value)}
                placeholder={fieldConfig.repsPlaceholder}
              />
            </Field>
          </div>
          <div className="space-y-3 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.04] p-3">
            <div>
              <p className="text-sm font-medium">Circuit builder profile</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Structured fields used to filter, balance and dose generated circuits.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Availability">
                <Select
                  value={form.circuitSuitability}
                  onValueChange={(value) =>
                    update("circuitSuitability", value as CircuitSuitability)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CIRCUIT_SUITABILITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Pattern">
                <Select
                  value={form.circuitPattern}
                  onValueChange={(value) =>
                    update("circuitPattern", value as CircuitMovementPattern)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CIRCUIT_MOVEMENT_PATTERN_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Difficulty">
                <Select
                  value={form.circuitDifficulty}
                  onValueChange={(value) => update("circuitDifficulty", value as CircuitDifficulty)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CIRCUIT_DIFFICULTY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Impact">
                <Select
                  value={form.circuitImpact}
                  onValueChange={(value) => update("circuitImpact", value as CircuitImpact)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CIRCUIT_IMPACT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-[1fr_0.75fr_0.75fr] gap-3">
              <Field label="Dose unit">
                <Select
                  value={form.circuitDoseMode}
                  onValueChange={(value) => update("circuitDoseMode", value as CircuitDoseMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CIRCUIT_DOSE_MODE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Minimum">
                <Input
                  type="number"
                  min="0.1"
                  step="any"
                  inputMode="decimal"
                  value={form.circuitDoseMin}
                  onChange={(event) => update("circuitDoseMin", event.target.value)}
                />
              </Field>
              <Field label="Maximum">
                <Input
                  type="number"
                  min="0.1"
                  step="any"
                  inputMode="decimal"
                  value={form.circuitDoseMax}
                  onChange={(event) => update("circuitDoseMax", event.target.value)}
                />
              </Field>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-2">
              <span>
                <span className="block text-sm font-medium">Dose each side</span>
                <span className="block text-xs text-muted-foreground">
                  Use for unilateral reps, carries or holds.
                </span>
              </span>
              <Switch
                checked={form.circuitDosePerSide}
                onCheckedChange={(checked) => update("circuitDosePerSide", checked)}
                aria-label="Dose each side"
              />
            </label>
          </div>
          <Field label="Notes">
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Form cues, programming notes…"
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              <X className="mr-1 h-4 w-4" /> Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !form.name.trim() || !form.metric}
              style={{
                backgroundImage: "var(--gradient-primary)",
                color: "var(--primary-foreground)",
              }}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : state.mode === "edit" ? (
                "Save"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function DatalistInput({
  value,
  onChange,
  options,
  placeholder,
  listId,
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  listId: string;
  autoFocus?: boolean;
}) {
  return (
    <>
      <Input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={listId}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}

function useResetOnChange<T>(dep: T, fn: () => void) {
  useEffect(() => {
    fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
}
