import { Copy, Layers3, Plus, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "./form-bits";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatUKDate } from "@/lib/date";
import type { TrainingMethod } from "@/lib/supabase-training-methods.browser";
import type {
  WorkoutSetMethodState,
  WorkoutSetSegmentState,
  WorkoutSetState,
} from "./full-workout-form";

function setSummary(set: WorkoutSetState, usesLoad: boolean) {
  const load = usesLoad && set.weight ? `${set.weight} kg` : "";
  const reps = set.reps ? `${set.reps} reps` : "";
  const duration = set.durationSeconds ? `${set.durationSeconds}s` : "";
  const rpe = set.rpe ? `RPE ${set.rpe}` : "";
  const drops = set.method?.segments
    .map((segment) =>
      [segment.weight ? `${segment.weight} kg` : "", segment.reps ? `${segment.reps} reps` : ""]
        .filter(Boolean)
        .join(" × "),
    )
    .filter(Boolean);
  return (
    [
      load,
      reps,
      duration,
      rpe,
      drops?.length ? `${set.method?.methodName}: ${drops.join(" → ")}` : "",
    ]
      .filter(Boolean)
      .join(" · ") || "No values recorded"
  );
}
function setMethodKind(method: WorkoutSetMethodState) {
  const key = method.systemKey ?? String(method.config.system_key ?? "");
  const name = method.methodName.toLowerCase();
  if (key === "cluster_set" || name.includes("cluster")) return "cluster";
  if (key === "rest_pause" || name.includes("rest-pause") || name.includes("rest pause")) {
    return "rest-pause";
  }
  if (key === "rep_targeting" || name.includes("rep target")) return "rep-target";
  if (key === "partial_reps" || name.includes("partial")) return "partial";
  if (key === "drop_set" || name.includes("drop") || name.includes("strip")) return "drop";
  if (key === "eccentrics" || name.includes("eccentric")) return "eccentric";
  if (key === "pyramid" || name.includes("pyramid")) return "pyramid";
  if (key === "negatives" || name.includes("negative")) return "negative";
  return "segment";
}

function setMethodCopy(method: WorkoutSetMethodState) {
  const kind = setMethodKind(method);
  if (kind === "cluster") {
    return { noun: "Cluster", add: "Add another cluster", intro: "Cluster 1 uses the main set." };
  }
  if (kind === "rest-pause") {
    return {
      noun: "Effort",
      add: "Add another effort",
      intro: "Effort 1 uses the main set before the first short pause.",
    };
  }
  if (kind === "drop") {
    return { noun: "Drop", add: "Add another drop", intro: "Segment 1 uses the main set." };
  }
  if (kind === "rep-target") {
    return {
      noun: "Effort",
      add: "Add another effort",
      intro: "Effort 1 uses the main set. Stop when the target is reached.",
    };
  }
  if (kind === "partial") {
    return {
      noun: "Partial",
      add: "Add another partial effort",
      intro: "The main set range is selectable; added efforts default to partial.",
    };
  }
  if (kind === "eccentric") {
    return {
      noun: "Eccentric effort",
      add: "Add another eccentric effort",
      intro: "Effort 1 uses the main set with a controlled lowering phase.",
    };
  }
  if (kind === "pyramid") {
    return {
      noun: "Step",
      add: "Add another pyramid step",
      intro: "Step 1 uses the main set; adjust load and reps at each step.",
    };
  }
  if (kind === "negative") {
    return {
      noun: "Negative",
      add: "Add another negative",
      intro: "Rep 1 uses the main set; record each controlled lowering effort.",
    };
  }
  return { noun: "Segment", add: "Add another segment", intro: "Segment 1 uses the main set." };
}

export function SetRowsEditor({
  rows,
  usesLoad,
  valueKind = "reps",
  durationLabel = "Hold (sec)",
  setMethods,
  previousWorkout,
  onChange,
  onCopyPrevious,
  onRepeat,
  onAddBlank,
  onRemove,
  onAddMethod,
  onAddSegment,
  onUpdateSegment,
  onRemoveSegment,
  onRemoveMethod,
}: {
  rows: WorkoutSetState[];
  usesLoad: boolean;
  valueKind?: "reps" | "duration";
  durationLabel?: string;
  setMethods: TrainingMethod[];
  previousWorkout?: { date: string; location?: string; rows: WorkoutSetState[] };
  onChange: <K extends keyof WorkoutSetState>(
    setIndex: number,
    key: K,
    value: WorkoutSetState[K],
  ) => void;
  onCopyPrevious: () => void;
  onRepeat: () => void;
  onAddBlank: () => void;
  onRemove: (setIndex: number) => void;
  onAddMethod: (setIndex: number, method: TrainingMethod) => void;
  onAddSegment: (setIndex: number) => void;
  onUpdateSegment: <K extends keyof WorkoutSetSegmentState>(
    setIndex: number,
    segmentIndex: number,
    key: K,
    value: WorkoutSetSegmentState[K],
  ) => void;
  onRemoveSegment: (setIndex: number, segmentIndex: number) => void;
  onRemoveMethod: (setIndex: number) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-secondary/20 p-3">
      {previousWorkout ? (
        <div className="space-y-2 rounded-md border border-border bg-background/70 p-2.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Previous workout · {formatUKDate(previousWorkout.date)}
              </p>
              <p className="text-xs text-muted-foreground">
                {previousWorkout.rows.length} {previousWorkout.rows.length === 1 ? "set" : "sets"}
                {previousWorkout.location ? ` · ${previousWorkout.location}` : ""}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-full sm:w-auto"
              onClick={onCopyPrevious}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy previous workout
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {previousWorkout.rows.map((set, index) => (
              <span
                key={index}
                className="rounded-md bg-secondary px-2 py-1 text-[11px] text-foreground"
              >
                {index + 1}. {setSummary(set, usesLoad)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <div
        className={`hidden items-end gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:grid ${
          usesLoad ? "grid-cols-[32px_1fr_1fr_1fr_32px]" : "grid-cols-[32px_1fr_1fr_32px]"
        }`}
      >
        <span>Set</span>
        {usesLoad && <span>kg</span>}
        <span>{valueKind === "duration" ? durationLabel : "Reps"}</span>
        <span>RPE</span>
        <span />
      </div>
      {rows.map((set, setIndex) => (
        <div key={setIndex} className="space-y-2">
          <div
            className={`rounded-md border border-border/70 bg-background p-2 sm:grid sm:items-center sm:gap-2 sm:border-0 sm:bg-transparent sm:p-0 ${
              usesLoad ? "sm:grid-cols-[32px_1fr_1fr_1fr_32px]" : "sm:grid-cols-[32px_1fr_1fr_32px]"
            }`}
          >
            <div className="mb-2 flex items-center justify-between sm:hidden">
              <span className="text-xs font-semibold text-muted-foreground">
                Set {setIndex + 1}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground"
                disabled={rows.length === 1}
                onClick={() => onRemove(setIndex)}
                aria-label={`Remove set ${setIndex + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <span className="hidden text-center text-sm font-semibold text-muted-foreground sm:block">
              {setIndex + 1}
            </span>
            <div
              className={`grid items-end gap-2 sm:contents ${
                usesLoad ? "grid-cols-[1fr_1fr_0.75fr]" : "grid-cols-[1fr_0.75fr]"
              }`}
            >
              {usesLoad && (
                <label className="space-y-1 sm:space-y-0">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:hidden">
                    Weight (kg)
                  </span>
                  <Input
                    inputMode="decimal"
                    className="h-12 text-lg font-semibold sm:h-10 sm:text-sm sm:font-normal"
                    aria-label={`Set ${setIndex + 1} weight`}
                    value={set.weight}
                    onChange={(event) => onChange(setIndex, "weight", event.target.value)}
                  />
                </label>
              )}
              <label className="space-y-1 sm:space-y-0">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:hidden">
                  {valueKind === "duration" ? durationLabel : "Reps"}
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={valueKind === "duration" ? 0.1 : 1}
                  className="h-12 text-lg font-semibold sm:h-10 sm:text-sm sm:font-normal"
                  aria-label={`Set ${setIndex + 1} ${
                    valueKind === "duration" && durationLabel === "Hold (sec)"
                      ? "hold seconds"
                      : valueKind === "duration"
                        ? "seconds"
                        : "reps"
                  }`}
                  value={valueKind === "duration" ? set.durationSeconds : set.reps}
                  onChange={(event) =>
                    valueKind === "duration"
                      ? onChange(setIndex, "durationSeconds", event.target.value)
                      : onChange(setIndex, "reps", event.target.value)
                  }
                />
              </label>
              <label className="space-y-1 sm:space-y-0">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:hidden">
                  RPE
                </span>
                <Input
                  inputMode="decimal"
                  className="h-12 text-base sm:h-10 sm:text-sm"
                  aria-label={`Set ${setIndex + 1} RPE`}
                  value={set.rpe}
                  onChange={(event) => onChange(setIndex, "rpe", event.target.value)}
                />
              </label>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="hidden h-8 w-8 text-muted-foreground sm:inline-flex"
              disabled={rows.length === 1}
              onClick={() => onRemove(setIndex)}
              aria-label={`Remove set ${setIndex + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {usesLoad && set.method ? (
            <div className="ml-0 rounded-lg border border-fuchsia-400/25 bg-fuchsia-400/[0.05] p-3 sm:ml-10">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-fuchsia-200">{set.method.methodName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {setMethodCopy(set.method).intro}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveMethod(setIndex)}
                >
                  Remove method
                </Button>
              </div>
              {setMethodKind(set.method) === "rep-target" ? (
                <div className="mt-3 rounded-md border border-fuchsia-400/20 bg-background/60 px-3 py-2">
                  {(() => {
                    const target = Number(set.method?.config.target_reps) || 0;
                    const completed =
                      (Number(set.reps) || 0) +
                      (set.method?.segments.reduce(
                        (total, segment) => total + (Number(segment.reps) || 0),
                        0,
                      ) ?? 0);
                    const remaining = Math.max(0, target - completed);
                    return (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium">
                          {completed} / {target} target reps
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {remaining > 0 ? `${remaining} remaining` : "Target reached"}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              ) : null}
              {setMethodKind(set.method) === "partial" ? (
                <div className="mt-3 max-w-44">
                  <Field label="Main set range">
                    <Select
                      value={String(set.method.config.base_range_of_motion ?? "full")}
                      onValueChange={(value) =>
                        onChange(setIndex, "method", {
                          ...set.method!,
                          config: { ...set.method!.config, base_range_of_motion: value },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Full</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              ) : null}
              <div className="mt-3 space-y-2">
                {set.method.segments.map((segment, segmentIndex) => (
                  <div
                    key={segmentIndex}
                    className="rounded-md border border-border/70 bg-background/60 p-2"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium">
                        {setMethodCopy(set.method!).noun} {segmentIndex + 2}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => onRemoveSegment(setIndex, segmentIndex)}
                        aria-label={`Remove ${setMethodCopy(set.method!).noun.toLowerCase()} ${segmentIndex + 2} from set ${setIndex + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="kg">
                        <Input
                          inputMode="decimal"
                          value={segment.weight}
                          onChange={(event) =>
                            onUpdateSegment(setIndex, segmentIndex, "weight", event.target.value)
                          }
                        />
                      </Field>
                      <Field label="Reps">
                        <Input
                          inputMode="numeric"
                          value={segment.reps}
                          onChange={(event) =>
                            onUpdateSegment(setIndex, segmentIndex, "reps", event.target.value)
                          }
                        />
                      </Field>
                      <Field label="RPE">
                        <Input
                          inputMode="decimal"
                          value={segment.rpe}
                          onChange={(event) =>
                            onUpdateSegment(setIndex, segmentIndex, "rpe", event.target.value)
                          }
                        />
                      </Field>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Field label="Rest after (sec)">
                        <Input
                          inputMode="numeric"
                          value={segment.restAfterSeconds}
                          onChange={(event) =>
                            onUpdateSegment(
                              setIndex,
                              segmentIndex,
                              "restAfterSeconds",
                              event.target.value,
                            )
                          }
                        />
                      </Field>
                      <Field label="Range">
                        <Select
                          value={segment.rangeOfMotion}
                          onValueChange={(value) =>
                            onUpdateSegment(setIndex, segmentIndex, "rangeOfMotion", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">Full</SelectItem>
                            <SelectItem value="partial">Partial</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={() => onAddSegment(setIndex)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> {setMethodCopy(set.method).add}
              </Button>
            </div>
          ) : usesLoad && setMethods.length ? (
            <div className="ml-0 sm:ml-10 sm:max-w-xs">
              <Select
                onValueChange={(methodId) => {
                  const method = setMethods.find((item) => item.id === methodId);
                  if (method) onAddMethod(setIndex, method);
                }}
              >
                <SelectTrigger className="border-dashed border-fuchsia-400/25 text-fuchsia-200">
                  <Layers3 className="mr-2 h-3.5 w-3.5" />
                  <SelectValue placeholder="Set method (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {setMethods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onRepeat}>
          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Repeat last set
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onAddBlank}>
          <Plus className="mr-1 h-4 w-4" /> Add blank set
        </Button>
      </div>
    </div>
  );
}
