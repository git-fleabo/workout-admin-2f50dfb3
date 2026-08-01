import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
    updates: Array<{
      exerciseId: string;
      trainingMax: number;
      manualAdjustmentPercent: number;
    }>,
  ) => Promise<void>;
}) {
  const exercises = useMemo(
    () =>
      assignment.exercises.filter((exercise) => exercise.enabled && exercise.trainingMax != null),
    [assignment.exercises],
  );
  const [open, setOpen] = useState(false);
  const [draftAdjustments, setDraftAdjustments] = useState<Record<string, number>>({});
  const [draftTrainingMaxes, setDraftTrainingMaxes] = useState<Record<string, string>>({});
  const activeOverrides = exercises.filter((exercise) => exercise.manualAdjustmentPercent !== 0);
  const changed = exercises.flatMap((exercise) => {
    const nextAdjustment = draftAdjustments[exercise.id] ?? exercise.manualAdjustmentPercent;
    const nextTrainingMax = Number(draftTrainingMaxes[exercise.id] ?? exercise.trainingMax);
    return nextAdjustment === exercise.manualAdjustmentPercent &&
      nextTrainingMax === exercise.trainingMax
      ? []
      : [
          {
            exerciseId: exercise.id,
            trainingMax: nextTrainingMax,
            manualAdjustmentPercent: nextAdjustment,
          },
        ];
  });
  const hasInvalidTrainingMax = exercises.some((exercise) => {
    const value = Number(draftTrainingMaxes[exercise.id] ?? exercise.trainingMax);
    return !Number.isFinite(value) || value < 0.5 || value > 1000;
  });

  const openReview = () => {
    setDraftAdjustments(
      Object.fromEntries(
        exercises.map((exercise) => [exercise.id, exercise.manualAdjustmentPercent]),
      ),
    );
    setDraftTrainingMaxes(
      Object.fromEntries(exercises.map((exercise) => [exercise.id, String(exercise.trainingMax)])),
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
                Amend a training max or review a lift after a week that felt too hard or too easy.
                Every unstarted programme session is recalculated from the saved values.
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
            <SlidersHorizontal className="mr-2 h-4 w-4" /> Update programme
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(nextOpen) => !saving && setOpen(nextOpen)}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update programme</DialogTitle>
            <DialogDescription>
              Amend training maxes and load adjustments independently. Upcoming, unstarted
              prescriptions refresh immediately; completed workouts, started drafts, and scheduled
              dates do not change.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {exercises.map((exercise) => {
              const automatic = exercise.loadAdjustmentPercent;
              const manual = draftAdjustments[exercise.id] ?? exercise.manualAdjustmentPercent;
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
                  <label
                    className="mt-3 block text-xs font-medium"
                    htmlFor={`training-max-${exercise.id}`}
                  >
                    Training max (kg)
                  </label>
                  <Input
                    id={`training-max-${exercise.id}`}
                    data-testid={`programme-training-max-${exercise.slotKey}`}
                    className="mt-1"
                    type="number"
                    min="0.5"
                    max="1000"
                    step="0.5"
                    inputMode="decimal"
                    value={draftTrainingMaxes[exercise.id] ?? String(exercise.trainingMax)}
                    onChange={(event) =>
                      setDraftTrainingMaxes((current) => ({
                        ...current,
                        [exercise.id]: event.target.value,
                      }))
                    }
                  />
                  <p className="mt-3 text-xs font-medium">Upcoming load adjustment</p>
                  <Select
                    value={String(manual)}
                    onValueChange={(value) =>
                      setDraftAdjustments((current) => ({
                        ...current,
                        [exercise.id]: Number(value),
                      }))
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
            A training-max change is the new basis for every later percentage calculation in this
            programme. Manual load changes stay active until reset. Use the lighter options if pain
            or technique deteriorated; do not use either control to train through pain.
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !changed.length || hasInvalidTrainingMax}>
              {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
              Refresh upcoming sessions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
