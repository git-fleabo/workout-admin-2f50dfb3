import { CircleCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field } from "./form-bits";
import type { WorkoutSetState } from "./full-workout-form";
import { applySharedStrengthWeight, canShareStrengthWeight } from "@/lib/compact-strength";
import {
  applySharedHoldTime,
  canShareHoldTime,
  holdMatchesPrescription,
  holdRowsReady,
  holdSummary,
  type HoldLogState,
} from "@/lib/compact-holds";

export function CompactHoldAttempts({
  rows,
  log,
  name,
  loadIssue,
  onRows,
  onConfirm,
  children,
}: {
  rows: WorkoutSetState[];
  log: HoldLogState;
  name: string;
  loadIssue?: string | null;
  onRows: (rows: WorkoutSetState[]) => void;
  onConfirm: () => void;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [attempts, setAttempts] = useState(String(rows.length));
  useEffect(() => setAttempts(String(rows.length)), [rows.length]);
  const sharedTime = canShareHoldTime(rows);
  const sharedWeight = canShareStrengthWeight(rows);
  const resize = sharedTime && sharedWeight;
  const unchanged = log.prescribed && holdMatchesPrescription(rows, log.plannedRows);
  const ready = holdRowsReady(rows) && !loadIssue;
  return (
    <div className="training-values space-y-4 border-t border-border/60 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xl font-semibold tabular-nums tracking-tight">{holdSummary(rows)}</p>
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
      <div className="grid gap-3 sm:grid-cols-3">
        {resize ? (
          <Field label="Attempts">
            <Input
              type="number"
              min={1}
              max={50}
              step={1}
              aria-label={`${name} attempts`}
              value={attempts}
              onChange={(event) => {
                const value = event.target.value;
                setAttempts(value);
                const count = Number(value);
                if (!Number.isInteger(count) || count < 1 || count > 50) return;
                const template = rows.at(-1);
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
        ) : null}
        {sharedTime ? (
          <Field label="Seconds per attempt">
            <Input
              type="number"
              min={0.1}
              max={86400}
              step="any"
              inputMode="decimal"
              aria-label={`${name} seconds per attempt`}
              value={rows[0]?.durationSeconds ?? ""}
              onChange={(event) => onRows(applySharedHoldTime(rows, event.target.value))}
            />
          </Field>
        ) : null}
        {sharedWeight ? (
          <Field label="Load (kg, optional)">
            <Input
              type="number"
              min={0}
              max={1000}
              step="any"
              inputMode="decimal"
              aria-label={`${name} load for all attempts`}
              value={rows[0]?.weight ?? ""}
              placeholder="Bodyweight: leave blank"
              onChange={(event) => onRows(applySharedStrengthWeight(rows, event.target.value))}
            />
          </Field>
        ) : null}
      </div>
      {!sharedTime || !sharedWeight ? (
        <p className="text-sm text-muted-foreground">
          Different times or loads stay separate. Use Change for individual attempts.
        </p>
      ) : null}
      {log.prescribed
        ? log.plannedRows.map((target, index) => {
            const row = rows[index];
            if (!target.rpe || !row || row.completed === false) return null;
            return (
              <Field key={index} label={`Actual effort · Attempt ${index + 1} (optional)`}>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  step="any"
                  aria-label={`${name} attempt ${index + 1} actual RPE`}
                  value={row.rpe}
                  onChange={(event) =>
                    onRows(
                      rows.map((attempt, position) =>
                        position === index ? { ...attempt, rpe: event.target.value } : attempt,
                      ),
                    )
                  }
                />
                <p className="text-sm text-muted-foreground">Target RPE {target.rpe}</p>
              </Field>
            );
          })
        : null}
      {loadIssue ? <p className="text-sm text-destructive">{loadIssue}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="min-h-11"
          disabled={!ready}
          onClick={() => {
            onConfirm();
            setEditing(false);
          }}
        >
          {unchanged ? "Done as planned" : "Done with these values"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-11"
          aria-expanded={editing}
          onClick={() => setEditing((value) => !value)}
        >
          {editing ? "Close changes" : "Change"}
        </Button>
      </div>
      {editing ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Adjust individual attempts, record effort or mark an attempt missed, then confirm the
            values.
          </p>
          {children}
        </div>
      ) : null}
    </div>
  );
}
