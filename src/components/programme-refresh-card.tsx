import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProgrammeAssignment } from "@/lib/supabase-programmes.browser";

const ADJUSTMENT_OPTIONS = [
  { value: -5, label: "Much lighter", detail: "5 percentage points lower" },
  { value: -2.5, label: "A little lighter", detail: "2.5 percentage points lower" },
  { value: 0, label: "Use automatic plan", detail: "No manual override" },
  { value: 2.5, label: "A little heavier", detail: "2.5 percentage points higher" },
  { value: 5, label: "Much heavier", detail: "5 percentage points higher" },
] as const;

function points(value: number) {
  if (value === 0) return "No change";
  return `${value > 0 ? "+" : ""}${value} pts`;
}

export function ProgrammeRefreshCard({
  assignment,
  saving,
  onSave,
}: {
  assignment: ProgrammeAssignment;
  saving: boolean;
  onSave: (
    adjustments: Array<{ exerciseId: string; manualAdjustmentPercent: number }>,
  ) => Promise<void>;
}) {
  const exercises = useMemo(
    () =>
      assignment.exercises.filter((exercise) => exercise.enabled && exercise.trainingMax != null),
    [assignment.exercises],
  );
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const activeOverrides = exercises.filter((exercise) => exercise.manualAdjustmentPercent !== 0);
  const changed = exercises.flatMap((exercise) => {
    const next = draft[exercise.id] ?? exercise.manualAdjustmentPercent;
    return next === exercise.manualAdjustmentPercent
      ? []
      : [{ exerciseId: exercise.id, manualAdjustmentPercent: next }];
  });

  const openReview = () => {
    setDraft(
      Object.fromEntries(
        exercises.map((exercise) => [exercise.id, exercise.manualAdjustmentPercent]),
      ),
    );
    setOpen(true);
  };

  const save = async () => {
    try {
      await onSave(changed);
      setOpen(false);
    } catch {
      // The parent mutation owns the user-facing error toast; keep the dialog open for correction.
    }
  };

  return (
    <>
      <Card className="border-cyan-400/20 bg-cyan-400/[0.04]">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
              <RefreshCw className="h-4 w-4" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">Refresh upcoming sessions</p>
                <Badge variant="outline" className="text-[10px]">
                  {assignment.currentWorkoutIndex} completed
                </Badge>
              </div>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                Review each main lift after a week that felt too hard or too easy. Your logged RPE,
                pain, and technique still drive the automatic adjustment underneath.
              </p>
              {activeOverrides.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {activeOverrides.map((exercise) => (
                    <Badge key={exercise.id} variant="secondary" className="text-[10px]">
                      {exercise.exerciseName} {points(exercise.manualAdjustmentPercent)}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <Button variant="outline" onClick={openReview} disabled={!exercises.length}>
            <SlidersHorizontal className="mr-2 h-4 w-4" /> Update sessions
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(nextOpen) => !saving && setOpen(nextOpen)}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update upcoming sessions</DialogTitle>
            <DialogDescription>
              Adjust lifts independently. This changes future prescriptions only—not completed
              workouts, training maxes, or scheduled dates.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {exercises.map((exercise) => {
              const automatic = exercise.loadAdjustmentPercent;
              const manual = draft[exercise.id] ?? exercise.manualAdjustmentPercent;
              const combined = automatic + manual;
              return (
                <div
                  key={exercise.id}
                  data-testid={`programme-adjustment-${exercise.slotKey}`}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{exercise.exerciseName}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {exercise.trainingMax} kg training max · automatic {points(automatic)}
                        {exercise.lastDecision ? ` (${exercise.lastDecision})` : ""}
                      </p>
                    </div>
                    <Badge variant={combined < 0 ? "secondary" : "outline"}>
                      Combined {points(combined)}
                    </Badge>
                  </div>
                  <Select
                    value={String(manual)}
                    onValueChange={(value) =>
                      setDraft((current) => ({ ...current, [exercise.id]: Number(value) }))
                    }
                  >
                    <SelectTrigger className="mt-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ADJUSTMENT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)}>
                          {option.label} · {option.detail}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.05] p-3 text-xs leading-relaxed text-muted-foreground">
            Manual changes stay active until you update or reset them. Use the lighter options if
            pain or technique deteriorated; do not use this control to train through pain.
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !changed.length}>
              {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
              Apply to upcoming sessions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
