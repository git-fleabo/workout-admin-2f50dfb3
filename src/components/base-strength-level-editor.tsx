import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  listBaseLevels,
  previewBaseLevels,
  type BaseLevelContext,
} from "@/lib/base-strength-levels";
import { savePersonalProgrammeSessionsClient } from "@/lib/supabase-personal-programmes.browser";

const phaseNames = { base: "Base phase", build: "Build phase", peak: "Peak phase" };
const loads = (values: string[]) =>
  [...new Set(values)].map((value) => (value === "" ? "not set" : `${value} kg`)).join(" / ");

function BaseLevelDialog({ context, onClose }: { context: BaseLevelContext; onClose: () => void }) {
  // Keep the exact snapshot that the user reviewed. The atomic save checks every
  // session revision and refuses stale or newly locked sessions.
  const [baseline] = useState(() => structuredClone(context));
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<ReturnType<typeof previewBaseLevels> | null>(null);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const queryClient = useQueryClient();
  const levels = listBaseLevels(baseline);
  const save = useMutation({
    mutationFn: () => {
      if (!preview?.updates.length) throw new Error("Preview your changes first.");
      return savePersonalProgrammeSessionsClient(baseline.assignment.id, preview.updates);
    },
    onSuccess: async () => {
      await Promise.all(
        [
          "my-programme-overview",
          "programme-assignments",
          "programme-schedule",
          "programme-workout-offers",
          "programme-exercise-rule",
          "weekly-review",
          "programme-refresh",
          "programme-strength-week-review",
          "base-strength-progression",
        ].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      );
      toast.success("Future programme base levels updated");
      onClose();
    },
    onError: async (failure: Error) => {
      if (/changed elsewhere|already started|cannot be edited|Only future/.test(failure.message)) {
        setStale(true);
        setError(
          `${failure.message} Close and reopen Edit base levels to review the latest targets.`,
        );
        await queryClient.invalidateQueries({ queryKey: ["my-programme-overview"] });
      } else setError(failure.message);
    },
  });
  const showPreview = () => {
    setError("");
    try {
      const result = previewBaseLevels(baseline, edits);
      if (!result.updates.length) {
        setError("Change a base level to preview its future loads.");
        return;
      }
      setPreview(result);
    } catch (failure) {
      setError((failure as Error).message);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
    >
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-3xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{preview ? "Review base level changes" : "Edit base levels"}</DialogTitle>
          <DialogDescription>
            {baseline.assignment.personalProgramme?.name}. Changes apply to unstarted future
            sessions. Each session keeps its percentages, sets, reps, dates and progression rules.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto">
          {preview ? (
            <div className="space-y-3">
              <p className="font-medium">{preview.updates.length} future sessions will change.</p>
              {preview.updates.some(
                (update) =>
                  baseline.assignment.personalProgramme?.sessions.find(
                    (session) => session.workoutId === update.workoutId,
                  )?.strengthReviewId,
              ) ? (
                <p className="text-sm text-muted-foreground">
                  Saving replaces the original targets and cancels temporary strength-week reviews
                  for these unstarted sessions.
                </p>
              ) : null}
              <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                {preview.changes.map((change, index) => (
                  <div
                    key={index}
                    className="space-y-1 border-b border-border pb-3 text-sm last:border-0 last:pb-0"
                  >
                    <p className="font-medium">
                      {change.session} · {change.exercise}
                    </p>
                    {change.beforeMax !== change.afterMax ? (
                      <p className="text-xs text-muted-foreground">
                        Estimated max:{" "}
                        {change.beforeMax == null ? "not set" : `${change.beforeMax} kg`} →{" "}
                        {change.afterMax} kg
                      </p>
                    ) : null}
                    <p>
                      {change.percent != null ? `${change.percent}% · ` : ""}
                      {loads(change.before)} → {loads(change.after)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Main lifts use a separate estimated max for each phase. Supporting loads are the
                planned weight for every set of that exercise in the chosen phase. Leave a field
                unchanged to keep its saved targets.
              </p>
              {(["base", "build", "peak"] as const).map((phase) => {
                const fields = levels.filter((level) => level.phase === phase);
                if (!fields.length) return null;
                return (
                  <section key={phase} className="space-y-3 rounded-lg border border-border p-3">
                    <h3 className="font-semibold">{phaseNames[phase]}</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {fields.map((level) => (
                        <label key={level.key} className="space-y-1 text-sm">
                          <span className="block font-medium">{level.exercise}</span>
                          <span className="block text-xs text-muted-foreground">
                            {level.kind === "load"
                              ? "Supporting load (kg)"
                              : `${level.role === "variation" ? "Variation " : ""}estimated max (kg)`}
                          </span>
                          <Input
                            type="number"
                            min={level.kind === "max" ? "0.1" : "0"}
                            max="1000"
                            step="any"
                            aria-label={`${level.exercise} ${phase} ${level.kind === "max" ? `${level.role} estimated max` : "supporting load"} (kg)`}
                            value={edits[level.key] ?? level.value}
                            placeholder={level.mixed ? "Mixed saved values" : "Not set"}
                            onChange={(event) => {
                              setEdits((current) => ({
                                ...current,
                                [level.key]: event.target.value,
                              }));
                              setError("");
                            }}
                          />
                          {level.mixed ? (
                            <span className="block text-xs text-muted-foreground">
                              Different values are saved across these sessions. Enter a value to use
                              it throughout this phase.
                            </span>
                          ) : null}
                        </label>
                      ))}
                    </div>
                  </section>
                );
              })}
              <p className="text-xs text-muted-foreground">
                RPE top-set loads stay in the session editor. Plus-set loads still need their
                completed-workout review; changing a max clears any approval that depended on the
                old max.
              </p>
            </div>
          )}
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter className="shrink-0 border-t border-border pt-3">
          <Button
            variant="outline"
            disabled={save.isPending}
            onClick={
              preview && !stale
                ? () => {
                    setPreview(null);
                    setError("");
                  }
                : onClose
            }
          >
            {stale ? "Close editor" : preview ? "Back to levels" : "Cancel"}
          </Button>
          <Button
            disabled={save.isPending || stale}
            onClick={preview ? () => save.mutate() : showPreview}
          >
            {save.isPending
              ? "Saving…"
              : preview
                ? `Apply to ${preview.updates.length} future sessions`
                : "Preview changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BaseStrengthLevelEditor(context: BaseLevelContext) {
  const [open, setOpen] = useState(false);
  if (!context.assignment.personalProgramme?.sessions.some((session) => session.plan?.baseStrength))
    return null;
  const editable = listBaseLevels(context).length > 0;
  return (
    <section
      className="space-y-2 rounded-lg border border-border p-4"
      aria-label="Programme base levels"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Base levels</h3>
          <p className="text-sm text-muted-foreground">
            Phase maxes and supporting loads for your future sessions.
          </p>
        </div>
        <Button variant="outline" disabled={!editable} onClick={() => setOpen(true)}>
          Edit base levels
        </Button>
      </div>
      {!editable ? (
        <p className="text-xs text-muted-foreground">
          No unstarted source prescriptions remain to update here.
        </p>
      ) : null}
      {open ? <BaseLevelDialog context={context} onClose={() => setOpen(false)} /> : null}
    </section>
  );
}
