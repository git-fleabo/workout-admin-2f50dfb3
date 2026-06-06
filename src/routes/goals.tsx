import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Target, Trash2, X } from "lucide-react";

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
  addGoal,
  deleteGoal,
  listGoals,
  updateGoal,
  type GoalRow,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/goals")({
  head: () => ({
    meta: [
      { title: "Goals · Training Admin" },
      {
        name: "description",
        content: "Set, edit and remove training goals stored in the spreadsheet's Goals tab.",
      },
    ],
  }),
  component: GoalsPage,
});

const PERIODS = ["week", "month", "quarter", "year", "static"];

type EditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; row: GoalRow };

const BLANK: Omit<GoalRow, "row"> = {
  goal: "",
  metric: "",
  target: "",
  period: "week",
  notes: "",
};

function GoalsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listGoals);
  const addFn = useServerFn(addGoal);
  const updateFn = useServerFn(updateGoal);
  const deleteFn = useServerFn(deleteGoal);

  const list = useQuery({ queryKey: ["goals"], queryFn: () => listFn() });

  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [pendingDelete, setPendingDelete] = useState<GoalRow | null>(null);

  const addMutation = useMutation({
    mutationFn: (fields: typeof BLANK) => addFn({ data: fields }),
    onSuccess: () => {
      toast.success("Goal added");
      setEditor({ mode: "closed" });
      qc.invalidateQueries({ queryKey: ["goals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ row, fields }: { row: number; fields: typeof BLANK }) =>
      updateFn({ data: { row, fields } }),
    onSuccess: () => {
      toast.success("Goal updated");
      setEditor({ mode: "closed" });
      qc.invalidateQueries({ queryKey: ["goals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (row: number) => deleteFn({ data: { row } }),
    onSuccess: () => {
      toast.success("Goal deleted");
      setPendingDelete(null);
      qc.invalidateQueries({ queryKey: ["goals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const items = list.data?.items ?? [];
    const buckets = new Map<string, GoalRow[]>();
    for (const item of items) {
      const key = (item.period || "other").toLowerCase();
      const list = buckets.get(key) ?? [];
      list.push(item);
      buckets.set(key, list);
    }
    return Array.from(buckets.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [list.data]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Goals</h2>
          <p className="text-xs text-muted-foreground">
            Saved to the <span className="font-mono">Goals</span> tab on the spreadsheet
          </p>
        </div>
        <Button
          onClick={() => setEditor({ mode: "create" })}
          className="h-10 font-medium"
          style={{ backgroundImage: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
        >
          <Plus className="mr-1 h-4 w-4" /> Add goal
        </Button>
      </div>

      {list.isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading goals…
        </div>
      ) : grouped.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No goals yet — add your first one.
        </Card>
      ) : (
        <div className="space-y-5">
          {grouped.map(([period, items]) => (
            <section key={period} className="space-y-2">
              <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {period}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((g) => (
                  <Card key={g.row} className="flex items-start gap-3 border-border bg-card p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                      <Target className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium">{g.goal}</p>
                        <span className="shrink-0 text-sm font-semibold text-primary">
                          {g.target}
                          {g.metric && <span className="ml-1 text-xs font-normal text-muted-foreground">{g.metric}</span>}
                        </span>
                      </div>
                      {g.notes && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {g.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditor({ mode: "edit", row: g })}
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPendingDelete(g)}
                        aria-label="Delete"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <GoalEditorDialog
        state={editor}
        onClose={() => setEditor({ mode: "closed" })}
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
            <AlertDialogTitle>Delete this goal?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.goal} will be removed from the Goals tab permanently.
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

function GoalEditorDialog({
  state,
  onClose,
  onSubmit,
  isPending,
}: {
  state: EditorState;
  onClose: () => void;
  onSubmit: (fields: typeof BLANK) => void;
  isPending: boolean;
}) {
  const initial =
    state.mode === "edit"
      ? {
          goal: state.row.goal,
          metric: state.row.metric,
          target: state.row.target,
          period: state.row.period || "week",
          notes: state.row.notes,
        }
      : BLANK;

  const [form, setForm] = useState<typeof BLANK>(initial);
  useMemoReset(state, () => setForm(initial));

  const update = <K extends keyof typeof BLANK>(k: K, v: (typeof BLANK)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const open = state.mode !== "closed";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {state.mode === "edit" ? "Edit goal" : "New goal"}
          </DialogTitle>
          <DialogDescription>
            {state.mode === "edit"
              ? "Update the goal row in the Goals tab."
              : "Add a new row to the Goals tab."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.goal.trim()) {
              toast.error("Goal name is required");
              return;
            }
            onSubmit(form);
          }}
          className="space-y-3"
        >
          <Field label="Goal">
            <Input
              autoFocus
              value={form.goal}
              onChange={(e) => update("goal", e.target.value)}
              placeholder="e.g. Weekly workouts"
              autoCapitalize="sentences"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target">
              <Input
                value={form.target}
                onChange={(e) => update("target", e.target.value)}
                placeholder="e.g. 4"
                inputMode="decimal"
              />
            </Field>
            <Field label="Metric">
              <Input
                value={form.metric}
                onChange={(e) => update("metric", e.target.value)}
                placeholder="sessions, kg, hrs"
              />
            </Field>
          </div>
          <Field label="Period">
            <Select value={form.period} onValueChange={(v) => update("period", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Notes">
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Optional context"
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              <X className="mr-1 h-4 w-4" /> Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !form.goal.trim()}
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

function useMemoReset<T>(dep: T, fn: () => void) {
  useMemo(() => {
    fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
}
