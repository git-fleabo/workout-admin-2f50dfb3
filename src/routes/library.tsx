import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
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
import {
  addExercise,
  deleteExercise,
  getLibraryDropdowns,
  listExercises,
  updateExercise,
  type LibraryRow,
} from "@/lib/admin.functions";
import { ExerciseDetail } from "@/components/exercise-detail";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Exercise Library · Training Admin" },
      {
        name: "description",
        content: "Add, edit and remove exercises in the training spreadsheet's library.",
      },
    ],
  }),
  component: LibraryPage,
});

type EditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; row: LibraryRow };

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

function LibraryPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listExercises);
  const dropdownsFn = useServerFn(getLibraryDropdowns);
  const addFn = useServerFn(addExercise);
  const updateFn = useServerFn(updateExercise);
  const deleteFn = useServerFn(deleteExercise);

  const list = useQuery({ queryKey: ["library"], queryFn: () => listFn() });
  const dropdowns = useQuery({
    queryKey: ["library-dropdowns"],
    queryFn: () => dropdownsFn(),
  });

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [focusFilter, setFocusFilter] = useState<string>("");
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [pendingDelete, setPendingDelete] = useState<LibraryRow | null>(null);
  const [selected, setSelected] = useState<LibraryRow | null>(null);
  const isMobile = useIsMobile();

  const filtered = useMemo(() => {
    const items = list.data?.items ?? [];
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (typeFilter && i.workoutType !== typeFilter) return false;
      if (focusFilter && i.focusArea !== focusFilter) return false;
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        i.equipment.toLowerCase().includes(q) ||
        i.notes.toLowerCase().includes(q)
      );
    });
  }, [list.data, search, typeFilter, focusFilter]);

  const addMutation = useMutation({
    mutationFn: (fields: typeof BLANK) => addFn({ data: fields }),
    onSuccess: () => {
      toast.success("Exercise added");
      setEditor({ mode: "closed" });
      qc.invalidateQueries({ queryKey: ["library"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ row, fields }: { row: number; fields: typeof BLANK }) =>
      updateFn({ data: { row, fields } }),
    onSuccess: () => {
      toast.success("Exercise updated");
      setEditor({ mode: "closed" });
      qc.invalidateQueries({ queryKey: ["library"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (row: number) => deleteFn({ data: { row } }),
    onSuccess: () => {
      toast.success("Exercise deleted");
      setPendingDelete(null);
      qc.invalidateQueries({ queryKey: ["library"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const showDesktopPanel = !!selected && !isMobile;

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
            options={dropdowns.data?.workoutTypes ?? []}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Focus
          </Label>
          <FilterSelect
            value={focusFilter}
            onChange={setFocusFilter}
            options={dropdowns.data?.focusAreas ?? []}
          />
        </div>
        <Button
          onClick={() => setEditor({ mode: "create" })}
          className="ml-auto h-10 font-medium"
          style={{ backgroundImage: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
        >
          <Plus className="mr-1 h-4 w-4" /> Add exercise
        </Button>
      </div>

      {list.isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading library…
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No exercises match the current filters.
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((ex) => (
            <Card key={ex.row} className="flex items-start gap-3 border-border bg-card p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="font-medium">{ex.name}</p>
                  {ex.workoutType && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-secondary-foreground">
                      {ex.workoutType}
                    </span>
                  )}
                  {ex.focusArea && (
                    <span className="text-xs text-muted-foreground">{ex.focusArea}</span>
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
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/90">{ex.notes}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditor({ mode: "edit", row: ex })}
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPendingDelete(ex)}
                  aria-label="Delete"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ExerciseEditorDialog
        state={editor}
        onClose={() => setEditor({ mode: "closed" })}
        workoutTypes={dropdowns.data?.workoutTypes ?? []}
        focusAreas={dropdowns.data?.focusAreas ?? []}
        onSubmit={(fields) => {
          if (editor.mode === "create") {
            addMutation.mutate(fields);
          } else if (editor.mode === "edit") {
            updateMutation.mutate({ row: editor.row.row, fields });
          }
        }}
        isPending={addMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this exercise?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.name} will be removed from the library. This deletes the row from
              the spreadsheet permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.row)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
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
    <Select
      value={value || ALL}
      onValueChange={(v) => onChange(v === ALL ? "" : v)}
    >
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
  focusAreas,
}: {
  state: EditorState;
  onClose: () => void;
  onSubmit: (fields: typeof BLANK) => void;
  isPending: boolean;
  workoutTypes: string[];
  focusAreas: string[];
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
  useMemoReset(state, () => setForm(initial));

  const update = <K extends keyof typeof BLANK>(k: K, v: (typeof BLANK)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const open = state.mode !== "closed";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {state.mode === "edit" ? "Edit exercise" : "New exercise"}
          </DialogTitle>
          <DialogDescription>
            {state.mode === "edit"
              ? `Update the spreadsheet row for ${state.row.name}.`
              : "Add a new entry to the Exercise Library tab."}
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
          <Field label="Name">
            <Input
              autoFocus
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Bench Press"
              autoCapitalize="words"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <DatalistInput
                value={form.workoutType}
                onChange={(v) => update("workoutType", v)}
                options={workoutTypes}
                placeholder="Strength"
                listId="lib-types"
              />
            </Field>
            <Field label="Focus">
              <DatalistInput
                value={form.focusArea}
                onChange={(v) => update("focusArea", v)}
                options={focusAreas}
                placeholder="Push, Pull…"
                listId="lib-focus"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Equipment">
              <Input
                value={form.equipment}
                onChange={(e) => update("equipment", e.target.value)}
                placeholder="Barbell"
              />
            </Field>
            <Field label="Metric">
              <Input
                value={form.metric}
                onChange={(e) => update("metric", e.target.value)}
                placeholder="Weight x reps"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Suggested sets">
              <Input
                value={form.suggestedSets}
                onChange={(e) => update("suggestedSets", e.target.value)}
                placeholder="3"
              />
            </Field>
            <Field label="Suggested reps / time">
              <Input
                value={form.suggestedReps}
                onChange={(e) => update("suggestedReps", e.target.value)}
                placeholder="5-8"
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
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  listId: string;
}) {
  return (
    <>
      <Input
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

// Reset helper — runs a side-effect when the identity of `dep` changes.
function useMemoReset<T>(dep: T, fn: () => void) {
  // useMemo with no deps would be cached forever; we want fn() per dep change.
  useMemo(() => {
    fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
}
