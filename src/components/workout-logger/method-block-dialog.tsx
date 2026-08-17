import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "./form-bits";
import type { TrainingMethod } from "@/lib/supabase-training-methods.browser";
import type {
  FormState,
  MethodBlockEditorState,
  WorkoutMethodBlockState,
} from "./full-workout-form";

const newClientId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function numberConfig(method: TrainingMethod | undefined, key: string, fallback: number) {
  const value = Number(method?.defaultConfig[key]);
  return Number.isFinite(value) ? String(value) : String(fallback);
}

function optionalNumberConfig(method: TrainingMethod | undefined, key: string) {
  const value = Number(method?.defaultConfig[key]);
  return Number.isFinite(value) ? String(value) : "";
}

function blockMinutesConfig(method: TrainingMethod | undefined) {
  const explicit = optionalNumberConfig(method, "block_minutes");
  if (explicit) return explicit;
  const rounds = Number(method?.defaultConfig.rounds);
  const work = Number(method?.defaultConfig.work_seconds);
  const rest = Number(method?.defaultConfig.rest_seconds);
  const minutes = (rounds * (work + rest)) / 60;
  return Number.isFinite(minutes) && minutes > 0 ? String(minutes) : "";
}

function methodMovementCount(method: TrainingMethod | undefined) {
  const fallback = method?.family === "timed_density" ? 1 : 2;
  return Math.max(fallback, Number(method?.defaultConfig.movement_count) || fallback);
}

function methodUsesExactMovementCount(method: TrainingMethod | undefined) {
  return ["superset", "tri_set", "edt", "tabata"].includes(method?.systemKey ?? "");
}

function methodSupportsMovementCount(method: TrainingMethod, movementCount: number) {
  const requiredCount = methodMovementCount(method);
  return methodUsesExactMovementCount(method)
    ? movementCount === requiredCount
    : movementCount >= requiredCount;
}

function defaultBlockMethod(methods: TrainingMethod[], movementCount: number) {
  const preferredSystemKey =
    movementCount === 1 ? "tabata" : movementCount === 2 ? "superset" : null;
  return (
    methods.find(
      (method) =>
        method.systemKey === preferredSystemKey &&
        methodSupportsMovementCount(method, movementCount),
    ) ??
    methods.find((method) => methodSupportsMovementCount(method, movementCount)) ??
    methods[0]
  );
}

export function MethodBlockDialog({
  state,
  methods,
  entries,
  blocks,
  onClose,
  onSave,
}: {
  state: MethodBlockEditorState;
  methods: TrainingMethod[];
  entries: FormState[];
  blocks: WorkoutMethodBlockState[];
  onClose: () => void;
  onSave: (block: WorkoutMethodBlockState) => void;
}) {
  const namedEntries = entries.filter((entry) => entry.exercise.trim());
  const existing =
    state.mode === "edit" ? blocks.find((block) => block.id === state.blockId) : undefined;
  const initialMethod =
    methods.find((method) => method.id === existing?.trainingMethodId) ??
    defaultBlockMethod(methods, namedEntries.length);
  const [methodId, setMethodId] = useState(initialMethod?.id ?? "");
  const [memberClientIds, setMemberClientIds] = useState<string[]>(existing?.memberClientIds ?? []);
  const [rounds, setRounds] = useState(
    existing?.rounds ??
      (initialMethod?.family === "timed_density"
        ? optionalNumberConfig(initialMethod, "rounds")
        : numberConfig(initialMethod, "rounds", 3)),
  );
  const [restBetweenMovementsSeconds, setRestBetweenMovementsSeconds] = useState(
    existing?.restBetweenMovementsSeconds ??
      numberConfig(initialMethod, "rest_between_movements_seconds", 0),
  );
  const [restBetweenRoundsSeconds, setRestBetweenRoundsSeconds] = useState(
    existing?.restBetweenRoundsSeconds ??
      numberConfig(initialMethod, "rest_between_rounds_seconds", 90),
  );
  const [blockDurationMinutes, setBlockDurationMinutes] = useState(
    existing?.blockDurationMinutes ?? blockMinutesConfig(initialMethod),
  );
  const [workIntervalSeconds, setWorkIntervalSeconds] = useState(
    existing?.workIntervalSeconds ?? optionalNumberConfig(initialMethod, "work_seconds"),
  );
  const [restIntervalSeconds, setRestIntervalSeconds] = useState(
    existing?.restIntervalSeconds ?? optionalNumberConfig(initialMethod, "rest_seconds"),
  );
  const [completedRounds, setCompletedRounds] = useState(existing?.completedRounds ?? "");

  useEffect(() => {
    const block =
      state.mode === "edit" ? blocks.find((item) => item.id === state.blockId) : undefined;
    const method =
      methods.find((item) => item.id === block?.trainingMethodId) ??
      defaultBlockMethod(methods, namedEntries.length);
    setMethodId(method?.id ?? "");
    setMemberClientIds(block?.memberClientIds ?? []);
    setRounds(
      block?.rounds ??
        (method?.family === "timed_density"
          ? optionalNumberConfig(method, "rounds")
          : numberConfig(method, "rounds", 3)),
    );
    setRestBetweenMovementsSeconds(
      block?.restBetweenMovementsSeconds ??
        numberConfig(method, "rest_between_movements_seconds", 0),
    );
    setRestBetweenRoundsSeconds(
      block?.restBetweenRoundsSeconds ?? numberConfig(method, "rest_between_rounds_seconds", 90),
    );
    setBlockDurationMinutes(block?.blockDurationMinutes ?? blockMinutesConfig(method));
    setWorkIntervalSeconds(
      block?.workIntervalSeconds ?? optionalNumberConfig(method, "work_seconds"),
    );
    setRestIntervalSeconds(
      block?.restIntervalSeconds ?? optionalNumberConfig(method, "rest_seconds"),
    );
    setCompletedRounds(block?.completedRounds ?? "");
  }, [blocks, methods, namedEntries.length, state]);

  const selectedMethod = methods.find((method) => method.id === methodId);
  const isTimedDensity = selectedMethod?.family === "timed_density";
  const requiredCount = methodMovementCount(selectedMethod);
  const exactCount = methodUsesExactMovementCount(selectedMethod);
  const minimumCount = requiredCount;
  const selectionValid = exactCount
    ? memberClientIds.length === requiredCount
    : memberClientIds.length >= minimumCount;
  const usedElsewhere = new Set(
    blocks.filter((block) => block.id !== existing?.id).flatMap((block) => block.memberClientIds),
  );
  const timedFieldsValid =
    !isTimedDensity ||
    (selectedMethod?.systemKey === "tabata"
      ? Boolean(rounds && workIntervalSeconds && restIntervalSeconds)
      : Boolean(blockDurationMinutes));
  const completedRoundsValid =
    !completedRounds || !rounds || Number(completedRounds) <= Number(rounds);

  const selectMethod = (nextMethodId: string) => {
    const method = methods.find((item) => item.id === nextMethodId);
    setMethodId(nextMethodId);
    setMemberClientIds([]);
    setRounds(
      method?.family === "timed_density"
        ? optionalNumberConfig(method, "rounds")
        : numberConfig(method, "rounds", 3),
    );
    setRestBetweenMovementsSeconds(
      method?.family === "timed_density"
        ? ""
        : numberConfig(method, "rest_between_movements_seconds", 0),
    );
    setRestBetweenRoundsSeconds(
      method?.family === "timed_density"
        ? ""
        : numberConfig(method, "rest_between_rounds_seconds", 90),
    );
    setBlockDurationMinutes(blockMinutesConfig(method));
    setWorkIntervalSeconds(optionalNumberConfig(method, "work_seconds"));
    setRestIntervalSeconds(optionalNumberConfig(method, "rest_seconds"));
    setCompletedRounds("");
  };

  return (
    <Dialog open={state.mode !== "closed"} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {state.mode === "edit" ? "Edit training method" : "Add training method"}
          </DialogTitle>
          <DialogDescription>
            Choose the movements and method defaults. Every movement keeps its own sets, load, reps,
            and RPE.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Method">
            <Select value={methodId} onValueChange={selectMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a method" />
              </SelectTrigger>
              <SelectContent>
                {methods.map((method) => (
                  <SelectItem key={method.id} value={method.id}>
                    {method.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div>
            <Label>Movements in order</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              {exactCount
                ? `Choose exactly ${requiredCount}.`
                : `Choose at least ${minimumCount}. Their workout order becomes A, B, C…`}
            </p>
            <div className="mt-2 space-y-2">
              {namedEntries.map((entry, index) => {
                const checked = memberClientIds.includes(entry.clientId);
                const unavailable = usedElsewhere.has(entry.clientId);
                const atCapacity =
                  exactCount && memberClientIds.length >= requiredCount && !checked;
                return (
                  <label
                    key={entry.clientId}
                    className={`flex items-center gap-3 rounded-lg border p-3 ${
                      checked ? "border-indigo-400/40 bg-indigo-400/[0.06]" : "border-border"
                    } ${unavailable ? "opacity-50" : "cursor-pointer"}`}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={unavailable || atCapacity}
                      onCheckedChange={(nextChecked) =>
                        setMemberClientIds((current) =>
                          nextChecked
                            ? [...current, entry.clientId]
                            : current.filter((id) => id !== entry.clientId),
                        )
                      }
                      aria-label={`Include ${entry.exercise}`}
                    />
                    <span className="min-w-0 flex-1 text-sm">
                      {index + 1}. {entry.exercise}
                    </span>
                    {unavailable ? (
                      <span className="text-[10px] uppercase text-muted-foreground">
                        In another method
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </div>

          {isTimedDensity ? (
            <div className="space-y-3 rounded-lg border border-indigo-400/20 bg-indigo-400/[0.04] p-3">
              <p className="text-xs text-muted-foreground">
                Record the planned timing now and completed rounds when you finish. Sets and reps
                remain the completed workload.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Block duration (min)">
                  <Input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={blockDurationMinutes}
                    placeholder={selectedMethod?.systemKey === "tabata" ? "4" : "15"}
                    onChange={(event) => setBlockDurationMinutes(event.target.value)}
                  />
                </Field>
                <Field label="Planned rounds">
                  <Input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={rounds}
                    placeholder={selectedMethod?.systemKey === "edt" ? "Optional" : "8"}
                    onChange={(event) => setRounds(event.target.value)}
                  />
                </Field>
                <Field label="Work interval (sec)">
                  <Input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={workIntervalSeconds}
                    placeholder={selectedMethod?.systemKey === "edt" ? "Optional" : "20"}
                    onChange={(event) => setWorkIntervalSeconds(event.target.value)}
                  />
                </Field>
                <Field label="Rest interval (sec)">
                  <Input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={restIntervalSeconds}
                    placeholder={selectedMethod?.systemKey === "edt" ? "Optional" : "10"}
                    onChange={(event) => setRestIntervalSeconds(event.target.value)}
                  />
                </Field>
              </div>
              <Field label="Completed rounds (optional)">
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={completedRounds}
                  onChange={(event) => setCompletedRounds(event.target.value)}
                />
                {!completedRoundsValid ? (
                  <p className="mt-1 text-[11px] text-destructive">
                    Completed rounds cannot exceed planned rounds.
                  </p>
                ) : null}
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Rounds">
                <Input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={rounds}
                  onChange={(event) => setRounds(event.target.value)}
                />
              </Field>
              <Field label="Between moves (sec)">
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={restBetweenMovementsSeconds}
                  onChange={(event) => setRestBetweenMovementsSeconds(event.target.value)}
                />
              </Field>
              <Field label="Between rounds (sec)">
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={restBetweenRoundsSeconds}
                  onChange={(event) => setRestBetweenRoundsSeconds(event.target.value)}
                />
              </Field>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={
              !selectedMethod ||
              !selectionValid ||
              !timedFieldsValid ||
              !completedRoundsValid ||
              (!isTimedDensity && !rounds)
            }
            onClick={() => {
              if (!selectedMethod) return;
              const entryOrder = new Map(entries.map((entry, index) => [entry.clientId, index]));
              onSave({
                id: existing?.id ?? newClientId("method"),
                trainingMethodId: selectedMethod.id,
                methodName: selectedMethod.name,
                family: selectedMethod.family as "exercise_group" | "timed_density",
                memberClientIds: [...memberClientIds].sort(
                  (left, right) => (entryOrder.get(left) ?? 0) - (entryOrder.get(right) ?? 0),
                ),
                rounds,
                restBetweenMovementsSeconds,
                restBetweenRoundsSeconds,
                blockDurationMinutes,
                workIntervalSeconds,
                restIntervalSeconds,
                completedRounds,
                config: {
                  ...selectedMethod.defaultConfig,
                  movement_count: memberClientIds.length,
                  rounds: Number(rounds),
                  rest_between_movements_seconds: Number(restBetweenMovementsSeconds),
                  rest_between_rounds_seconds: Number(restBetweenRoundsSeconds),
                  block_minutes: Number(blockDurationMinutes),
                  work_seconds: Number(workIntervalSeconds),
                  rest_seconds: Number(restIntervalSeconds),
                  completed_rounds: Number(completedRounds),
                },
              });
            }}
          >
            Save method
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
