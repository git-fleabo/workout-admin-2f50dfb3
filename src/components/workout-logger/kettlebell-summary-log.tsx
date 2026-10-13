import { WorkoutPrescriptionPreview } from "@/components/workout-prescription-preview";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { kettlebellResultLabel, type KettlebellLogState } from "@/lib/kettlebell-summary";
import { Field, DateInput } from "./form-bits";

export function KettlebellSummaryLog({
  log,
  duration,
  notes,
  date,
  locationId,
  locations,
  saving,
  onDuration,
  onNotes,
  onDate,
  onLocation,
  onLog,
}: {
  log: KettlebellLogState;
  duration: string;
  notes: string;
  date: string;
  locationId: string;
  locations: { id: string; name: string }[];
  saving: boolean;
  onDuration: (value: string) => void;
  onNotes: (value: string) => void;
  onDate: (value: string) => void;
  onLocation: (value: string) => void;
  onLog: (value: KettlebellLogState) => void;
}) {
  const resultLabel = kettlebellResultLabel(log.plan);
  const bells = log.plan.kettlebell!;
  return (
    <Card className="space-y-4 border-border bg-card p-4 sm:p-5">
      <div>
        <p className="text-xs text-muted-foreground">Kettlebell · Simple session log</p>
        <h2 className="mt-1 text-lg font-semibold">{log.plan.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Record your session, then finish.</p>
      </div>
      <WorkoutPrescriptionPreview
        movements={log.plan.movements}
        methodBlocks={log.plan.methodBlocks ?? []}
        instructions={bells.instructions}
      />
      <fieldset disabled={saving} className="space-y-4">
        <Field label="Duration (minutes)">
          <Input
            type="number"
            min="0.1"
            max="1440"
            step="any"
            inputMode="decimal"
            value={duration}
            onChange={(event) => onDuration(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">Adjust to the time you actually trained.</p>
        </Field>
        <Field label="Weight used (optional)">
          <Input
            value={log.weightUsed}
            onChange={(event) => onLog({ ...log, weightUsed: event.target.value })}
            placeholder={
              bells.requiredBellWeights === 3
                ? "Light 12 kg, medium 16 kg, heavy 20 kg"
                : bells.bellCount === 2
                  ? "2 × 16 kg"
                  : "16 kg"
            }
            maxLength={500}
          />
        </Field>
        {resultLabel ? (
          <Field label={`${resultLabel} (optional)`}>
            <Input
              value={log.result}
              onChange={(event) => onLog({ ...log, result: event.target.value })}
              placeholder={
                resultLabel === "Rounds completed"
                  ? "e.g. 6 rounds + part of the next"
                  : "e.g. reached the 4-rep rung"
              }
              maxLength={500}
            />
          </Field>
        ) : null}
        <Field label="Session notes (optional)">
          <Textarea
            rows={3}
            value={notes}
            onChange={(event) => onNotes(event.target.value)}
            placeholder="How it felt, changes or where you stopped…"
          />
        </Field>
        <details className="rounded-lg border border-border px-3 py-2">
          <summary className="cursor-pointer text-sm">Date and location</summary>
          <div className="mt-3 space-y-3">
            <Field label="Date">
              <DateInput value={date} onChange={onDate} />
            </Field>
            <Field label="Training location">
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                aria-label="Training location"
                value={locationId}
                onChange={(event) => onLocation(event.target.value)}
              >
                <option value="" disabled>
                  Choose location
                </option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </details>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onLog({ ...log, mode: "sets" })}
        >
          Log individual sets
        </Button>
      </fieldset>
    </Card>
  );
}
