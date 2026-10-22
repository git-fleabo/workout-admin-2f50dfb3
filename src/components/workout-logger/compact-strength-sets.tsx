import { CircleCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { WorkoutSetState } from "./full-workout-form";
import { Field } from "./form-bits";
import {
  applySharedStrengthWeight,
  canShareStrengthWeight,
  strengthMatchesPrescription,
  strengthRowsReady,
  strengthSetSummary,
  type StrengthLogState,
} from "@/lib/compact-strength";

export function CompactStrengthSets({
  rows,
  log,
  usesLoad,
  name,
  onRows,
  onConfirm,
  children,
}: {
  rows: WorkoutSetState[];
  log: StrengthLogState;
  usesLoad: boolean;
  name: string;
  onRows: (rows: WorkoutSetState[]) => void;
  onConfirm: () => void;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [setCount, setSetCount] = useState(String(rows.length));
  useEffect(() => setSetCount(String(rows.length)), [rows.length]);
  const shareWeight = usesLoad && canShareStrengthWeight(rows);
  const commonReps =
    !rows.some((row) => row.method) && rows.every((row) => row.reps === rows[0]?.reps);
  const unchanged = log.prescribed && strengthMatchesPrescription(rows, log.plannedRows);
  const plus = log.plusSetIndex == null ? null : rows[log.plusSetIndex];
  const ready = strengthRowsReady(rows, usesLoad) && (log.plusSetIndex == null || Boolean(plus));
  return (
    <div className="training-values space-y-4 border-t border-border/60 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xl font-semibold tabular-nums tracking-tight">
          {strengthSetSummary(rows, usesLoad)}
        </p>
        {log.confirmed ? (
          <Badge
            variant="secondary"
            role="status"
            className="recorded-feedback gap-1.5 bg-success/10 text-success"
          >
            <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" /> Recorded
          </Badge>
        ) : null}
      </div>
      <div className={`grid gap-3 ${log.prescribed ? "" : "sm:grid-cols-3"}`}>
        {!log.prescribed && commonReps ? (
          <>
            <Field label="Sets">
              <Input
                type="number"
                min={1}
                max={50}
                step={1}
                aria-label={`${name} sets`}
                value={setCount}
                onChange={(event) => {
                  const value = event.target.value;
                  setSetCount(value);
                  const count = Number(value);
                  if (!Number.isInteger(count) || count < 1 || count > 50) return;
                  const template = rows[0];
                  if (template)
                    onRows(
                      Array.from(
                        { length: count },
                        (_, index) => rows[index] ?? { ...template, rpe: "", completed: true },
                      ),
                    );
                }}
              />
            </Field>
            <Field label="Reps per set">
              <Input
                type="number"
                min={1}
                max={1000}
                step={1}
                aria-label={`${name} reps per set`}
                value={rows[0]?.reps ?? ""}
                onChange={(event) =>
                  onRows(rows.map((row) => ({ ...row, reps: event.target.value })))
                }
              />
            </Field>
          </>
        ) : null}
        {shareWeight ? (
          <Field label="Weight for these sets (kg)">
            <Input
              type="number"
              min={0}
              max={1000}
              step="any"
              inputMode="decimal"
              aria-label={`${name} weight for all sets`}
              value={rows[0]?.weight ?? ""}
              onChange={(event) => onRows(applySharedStrengthWeight(rows, event.target.value))}
            />
          </Field>
        ) : null}
      </div>
      {plus && plus.completed !== false ? (
        <Field label="Plus-set reps achieved">
          <Input
            type="number"
            min={1}
            max={1000}
            step={1}
            inputMode="numeric"
            aria-label={`${name} plus-set reps achieved`}
            value={plus.reps}
            onChange={(event) =>
              onRows(
                rows.map((row, index) =>
                  index === log.plusSetIndex ? { ...row, reps: event.target.value } : row,
                ),
              )
            }
          />
          <p className="text-sm text-muted-foreground">
            Enter the actual final-set result before confirming.
          </p>
        </Field>
      ) : null}
      {log.prescribed
        ? log.plannedRows.map((target, index) => {
            const row = rows[index];
            if (
              !row ||
              row.completed === false ||
              (!target.rpe && (target.reps || index === log.plusSetIndex))
            )
              return null;
            return (
              <div key={index} className="grid gap-3 sm:grid-cols-2">
                {index !== log.plusSetIndex && !target.reps ? (
                  <Field label={`Actual reps · Set ${index + 1}`}>
                    <Input
                      type="number"
                      min={1}
                      max={1000}
                      step={1}
                      aria-label={`${name} set ${index + 1} actual reps`}
                      value={row.reps}
                      onChange={(event) =>
                        onRows(
                          rows.map((set, position) =>
                            position === index ? { ...set, reps: event.target.value } : set,
                          ),
                        )
                      }
                    />
                  </Field>
                ) : null}
                {target.rpe ? (
                  <Field label={`Actual effort · Set ${index + 1} (optional)`}>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      step="any"
                      aria-label={`${name} set ${index + 1} actual RPE`}
                      value={row.rpe}
                      onChange={(event) =>
                        onRows(
                          rows.map((set, position) =>
                            position === index ? { ...set, rpe: event.target.value } : set,
                          ),
                        )
                      }
                    />
                    <p className="text-sm text-muted-foreground">Target RPE {target.rpe}</p>
                  </Field>
                ) : null}
              </div>
            );
          })
        : null}
      {!shareWeight && usesLoad ? (
        <p className="text-sm text-muted-foreground">Keep each load separate in Change.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!ready}
          className="min-h-11"
          onClick={() => {
            onConfirm();
            setEditing(false);
          }}
        >
          {unchanged && log.plusSetIndex == null ? "Done as planned" : "Done with these values"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-expanded={editing}
          className="min-h-11"
          onClick={() => setEditing((value) => !value)}
        >
          {editing ? "Close changes" : "Change"}
        </Button>
      </div>
      {editing ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Edit individual sets, record effort or mark a missed set, then confirm the values.
          </p>
          {children}
        </div>
      ) : null}
    </div>
  );
}
