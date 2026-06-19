import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity, Loader2, Pencil, Plus, Search, Trash2, UserCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
import { getMovementMetricProfile, type MetricProfile } from "@/lib/movement-metrics";
import {
  addExerciseClient,
  claimNoamProfile,
  hideExerciseClient,
  listLibraryClient,
  setExerciseEnabledClient,
  updateExerciseClient,
  type LibraryClientRow,
} from "@/lib/supabase-library.browser";
import { ExerciseDetail } from "@/components/exercise-detail";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Exercise Library · Training Admin" },
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

const BLANK: Omit<LibraryRow, "row"> = {
  workoutType: "",
  focusArea: "",
  name: "",
  equipment: "",
  metric: "",
  suggestedSets: "",
  suggestedReps: "",
  notes: "",
};

type LibraryFieldConfig = {
  focusLabel: string;
  focusPlaceholder: string;
  equipmentLabel: string;
  equipmentPlaceholder: string;
  metricLabel: string;
  metricPlaceholder: string;
  setsLabel: string;
  setsPlaceholder: string;
  repsLabel: string;
  repsPlaceholder: string;
  defaults: Partial<typeof BLANK>;
};

function libraryConfigFor(type: string, profile: MetricProfile): LibraryFieldConfig {
  const normalizedType = type.trim().toLowerCase();
  const base: LibraryFieldConfig = {
    focusLabel: "Focus",
    focusPlaceholder: "Push, pull, legs...",
    equipmentLabel: "Equipment",
    equipmentPlaceholder: "Barbell",
    metricLabel: "Metric",
    metricPlaceholder: "Weight x reps",
    setsLabel: "Suggested sets",
    setsPlaceholder: "3",
    repsLabel: "Suggested reps / time",
    repsPlaceholder: "5-8",
    defaults: {
      metric: "Weight x reps",
      suggestedSets: "3",
      suggestedReps: "5-8",
    },
  };

  if (["cardio", "run", "class", "other"].includes(normalizedType) || profile === "time") {
    return {
      ...base,
      focusLabel: "Style",
      focusPlaceholder: "Easy, intervals, recovery...",
      equipmentLabel: "Equipment",
      equipmentPlaceholder: "Road, treadmill, bike, rower...",
      metricLabel: "Tracking",
      metricPlaceholder: "Distance / time",
      setsLabel: "Suggested minutes",
      setsPlaceholder: "30",
      repsLabel: "Distance / detail",
      repsPlaceholder: "5 km, zone 2...",
      defaults: { metric: "Distance / time", suggestedSets: "", suggestedReps: "" },
    };
  }

  if (normalizedType === "skills/calisthenics" || profile === "reps") {
    return {
      ...base,
      focusLabel: "Skill area",
      focusPlaceholder: "Push, pull, legs, skill...",
      equipmentLabel: "Assistance / load",
      equipmentPlaceholder: "Bodyweight / rings / bar / assistance",
      metricLabel: "Tracking",
      metricPlaceholder: "Reps",
      repsLabel: "Suggested total reps",
      repsPlaceholder: "6-10",
      defaults: {
        equipment: "Bodyweight / Assistance / Added weight",
        metric: "Reps",
        suggestedSets: "3",
        suggestedReps: "6-10",
      },
    };
  }

  if (normalizedType === "grip" || profile === "hold" || profile === "grip") {
    return {
      ...base,
      focusLabel: profile === "grip" ? "Grip style" : "Progression",
      focusPlaceholder: profile === "grip" ? "Open hand, pinch..." : "Tuck, straddle...",
      equipmentLabel: profile === "grip" ? "Load / implement" : "Assistance",
      equipmentPlaceholder:
        profile === "grip" ? "Hangboard, pinch block..." : "Wall, band, rings...",
      metricLabel: "Tracking",
      metricPlaceholder: "Attempts / hold / feel",
      setsLabel: "Suggested attempts",
      setsPlaceholder: "3",
      repsLabel: "Suggested hold",
      repsPlaceholder: "10-20 sec",
      defaults: { metric: "Attempts / hold / feel", suggestedSets: "3", suggestedReps: "" },
    };
  }

  if (normalizedType === "mobility/flexibility" || profile === "mobility_position") {
    return {
      ...base,
      focusLabel: "Position group",
      focusPlaceholder: "Flexibility",
      equipmentLabel: "Equipment",
      equipmentPlaceholder: "Mat, wall, floor...",
      metricLabel: "Tracking",
      metricPlaceholder: "Distance / hold / feel",
      setsLabel: "Suggested hold",
      setsPlaceholder: "60 sec",
      repsLabel: "Target / detail",
      repsPlaceholder: "Distance, depth, feel...",
      defaults: {
        equipment: "Mat",
        metric: "Distance / hold / feel",
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
      metricLabel: "Tracking",
      metricPlaceholder: "Hours / boulders / grade",
      setsLabel: "Suggested hours",
      setsPlaceholder: "2",
      repsLabel: "Problems / routes",
      repsPlaceholder: "10-20",
      defaults: {
        equipment: "Climbing gym",
        metric: "Hours / boulders / grade",
        suggestedSets: "",
        suggestedReps: "",
      },
    };
  }

  if (normalizedType === "conditioning" || profile === "carry" || profile === "conditioning") {
    return {
      ...base,
      focusLabel: "Style",
      focusPlaceholder: "Carry, circuit, conditioning...",
      equipmentLabel: "Load / equipment",
      equipmentPlaceholder: "Kettlebell, dumbbell, sled...",
      metricLabel: "Tracking",
      metricPlaceholder:
        profile === "carry" ? "Rounds / distance / load" : "Minutes / rounds / load",
      setsLabel: profile === "carry" ? "Suggested rounds" : "Suggested minutes",
      setsPlaceholder: profile === "carry" ? "4" : "10",
      repsLabel: "Detail",
      repsPlaceholder: profile === "carry" ? "20 m" : "Rounds, reps per minute...",
      defaults: {
        metric: profile === "carry" ? "Rounds / distance / load" : "Minutes / rounds / load",
      },
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
    metric: form.metric || config.defaults.metric || "",
    suggestedSets: form.suggestedSets || config.defaults.suggestedSets || "",
    suggestedReps: form.suggestedReps || config.defaults.suggestedReps || "",
    notes: form.notes || config.defaults.notes || "",
  };
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
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [pendingDelete, setPendingDelete] = useState<LibraryClientRow | null>(null);
  const [selected, setSelected] = useState<LibraryClientRow | null>(null);

  const effectivePersonId = list.data?.selectedPersonId ?? selectedPersonId;

  const filtered = useMemo(() => {
    const items = list.data?.items ?? [];
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (typeFilter && i.workoutType !== typeFilter) return false;
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        i.equipment.toLowerCase().includes(q) ||
        i.notes.toLowerCase().includes(q)
      );
    });
  }, [list.data, search, typeFilter]);

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
      updateExerciseClient(id, fields),
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
                    className={`flex cursor-pointer items-start gap-3 border-border bg-card p-3 transition hover:border-primary/50 ${
                      isSelected ? "border-primary/70 ring-1 ring-primary/40" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="font-medium">{ex.name}</p>
                        {ex.workoutType && (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-secondary-foreground">
                            {ex.workoutType}
                          </span>
                        )}
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
                          ex.metric,
                          ex.suggestedSets && `${ex.suggestedSets} sets`,
                          ex.suggestedReps && `${ex.suggestedReps}`,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                      {ex.notes && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/90">
                          {ex.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                      {ex.active && (
                        <div className="mr-1 flex items-center gap-2 rounded-md border border-border px-2 py-1">
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

function ExerciseEditorDialog({
  state,
  onClose,
  onSubmit,
  isPending,
  workoutTypes,
}: {
  state: EditorState;
  onClose: () => void;
  onSubmit: (fields: typeof BLANK) => void;
  isPending: boolean;
  workoutTypes: string[];
}) {
  const initial =
    state.mode === "edit"
      ? {
          workoutType: state.row.workoutType,
          focusArea: state.row.focusArea,
          name: state.row.name,
          equipment: state.row.equipment,
          metric: state.row.metric,
          suggestedSets: state.row.suggestedSets,
          suggestedReps: state.row.suggestedReps,
          notes: state.row.notes,
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
  const fieldConfig = libraryConfigFor(form.workoutType, profile);
  const updateType = (workoutType: string) => {
    const nextProfile = getMovementMetricProfile({
      workoutType,
      movement: form.name,
      defaultMetric: form.metric,
    });
    const nextConfig = libraryConfigFor(workoutType, nextProfile);
    setForm((f) => withTypeDefaults(f, workoutType, nextConfig));
  };

  const open = state.mode !== "closed";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
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
          <div className="grid grid-cols-2 gap-3">
            <Field label={fieldConfig.focusLabel}>
              <Input
                value={form.focusArea}
                onChange={(e) => update("focusArea", e.target.value)}
                placeholder={fieldConfig.focusPlaceholder}
              />
            </Field>
            <Field label={fieldConfig.equipmentLabel}>
              <Input
                value={form.equipment}
                onChange={(e) => update("equipment", e.target.value)}
                placeholder={fieldConfig.equipmentPlaceholder}
              />
            </Field>
          </div>
          <Field label={fieldConfig.metricLabel}>
            <Input
              value={form.metric}
              onChange={(e) => update("metric", e.target.value)}
              placeholder={fieldConfig.metricPlaceholder}
            />
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
              disabled={isPending || !form.name.trim()}
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
