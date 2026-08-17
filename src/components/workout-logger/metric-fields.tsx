import { Input } from "@/components/ui/input";
import { Field, SimpleSelect } from "./form-bits";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BOARD_GRADIENTS, REST_OPTIONS } from "@/lib/supabase-log.browser";
import {
  CLIMBING_TRACKING_MODES,
  MAX_CLIMBING_MINUTES,
  supportsClimbingGradient,
} from "@/lib/climbing-metrics";
import {
  BLOCK_HEIGHT_OPTIONS,
  blockHeightOption,
  formatPositionMeasurementDirection,
} from "@/lib/position-measurements";
import type { MetricProfile } from "@/lib/movement-metrics";
import { GRIP_LOAD_TYPES, GRIP_STYLES } from "./logger-options";
import type { FormState } from "./full-workout-form";

export function MetricFields({
  profile,
  form,
  update,
  intensities,
  qualities,
  assistanceTypes,
  usesLoad,
  usesStandardSets,
  isGrip,
  showIntensity,
  validationIssue = null,
}: {
  profile: MetricProfile;
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  intensities: string[];
  qualities: string[];
  assistanceTypes: string[];
  usesLoad: boolean;
  usesStandardSets: boolean;
  isGrip: boolean;
  showIntensity: boolean;
  validationIssue?: string | null;
}) {
  if (profile === "mobility_position") {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Distance (cm)">
          <Input
            inputMode="decimal"
            value={form.distance}
            onChange={(e) => update("distance", e.target.value)}
          />
        </Field>
        <Field label="Hold (sec)">
          <Input
            inputMode="decimal"
            value={form.holdSeconds}
            onChange={(e) => update("holdSeconds", e.target.value)}
          />
        </Field>
        <Field label="Feel (1-5)">
          <div className="space-y-1.5">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={5}
              step={1}
              value={form.feel}
              onChange={(e) => update("feel", e.target.value)}
            />
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              1 restricted · 3 normal · 5 free and comfortable. Treat pain separately and stop.
            </p>
          </div>
        </Field>
      </div>
    );
  }

  if (profile === "time") {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Minutes">
            <Input
              inputMode="numeric"
              value={form.duration}
              onChange={(e) => update("duration", e.target.value)}
            />
          </Field>
          <Field label="Distance">
            <Input
              inputMode="decimal"
              value={form.distance}
              onChange={(e) => update("distance", e.target.value)}
            />
          </Field>
          <Field label="Unit">
            <SimpleSelect
              value={form.distanceUnit}
              onChange={(value) => update("distanceUnit", value)}
              options={["km", "mi", "m"]}
            />
          </Field>
          <Field label="Feel / RPE">
            <Input
              inputMode="decimal"
              value={form.feel || form.rpe}
              onChange={(e) => update("feel", e.target.value)}
            />
          </Field>
        </div>
        {showIntensity && <IntensityRow form={form} update={update} intensities={intensities} />}
      </div>
    );
  }

  if (profile === "duration") {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Minutes">
            <Input
              inputMode="numeric"
              value={form.duration}
              onChange={(event) => update("duration", event.target.value)}
            />
          </Field>
          <Field label="Intensity">
            <SimpleSelect
              value={form.intensity}
              onChange={(value) => update("intensity", value)}
              options={intensities}
            />
          </Field>
          <Field label="RPE">
            <Input
              inputMode="decimal"
              value={form.rpe}
              onChange={(event) => update("rpe", event.target.value)}
            />
          </Field>
        </div>
        <Field label="Detail">
          <Input
            value={form.detail}
            onChange={(event) => update("detail", event.target.value)}
            placeholder="Zone, class focus, sequence..."
          />
        </Field>
      </div>
    );
  }

  if (profile === "carry") {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
        <div className="grid gap-3 sm:grid-cols-5">
          <Field label="Rounds">
            <Input
              inputMode="numeric"
              value={form.sets}
              onChange={(e) => update("sets", e.target.value)}
            />
          </Field>
          <Field label="Distance">
            <Input
              inputMode="decimal"
              value={form.distance}
              onChange={(e) => update("distance", e.target.value)}
            />
          </Field>
          <Field label="Unit">
            <SimpleSelect
              value={form.distanceUnit}
              onChange={(value) => update("distanceUnit", value)}
              options={["m", "yd", "km"]}
            />
          </Field>
          <Field label="Minutes">
            <Input
              inputMode="numeric"
              value={form.duration}
              onChange={(e) => update("duration", e.target.value)}
            />
          </Field>
          <Field label="Load">
            <Input
              inputMode="decimal"
              value={form.weight}
              onChange={(e) => update("weight", e.target.value)}
            />
          </Field>
        </div>
        <IntensityRow form={form} update={update} intensities={intensities} />
      </div>
    );
  }

  if (profile === "hold" || profile === "grip") {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
        <div className={`grid gap-3 ${usesLoad ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
          <Field label="Attempts">
            <Input
              inputMode="numeric"
              value={form.sets}
              onChange={(e) => update("sets", e.target.value)}
            />
          </Field>
          <Field label="Hold (sec)">
            <Input
              inputMode="decimal"
              value={form.holdSeconds}
              onChange={(e) => update("holdSeconds", e.target.value)}
            />
          </Field>
          <Field label="Feel / RPE">
            <Input
              inputMode="decimal"
              value={form.feel || form.rpe}
              onChange={(e) => update("feel", e.target.value)}
            />
          </Field>
          {usesLoad ? (
            <Field label="Load (kg)">
              <Input
                inputMode="decimal"
                value={form.weight}
                onChange={(event) => update("weight", event.target.value)}
              />
            </Field>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={isGrip ? "Grip style" : "Progression"}>
            {isGrip ? (
              <SimpleSelect
                value={form.gripStyle}
                onChange={(v) => update("gripStyle", v)}
                options={GRIP_STYLES}
              />
            ) : (
              <Input
                value={form.progressionLevel}
                onChange={(e) => update("progressionLevel", e.target.value)}
              />
            )}
          </Field>
          <Field label={isGrip ? "Load type" : "Assistance"}>
            <SimpleSelect
              value={isGrip ? form.gripLoadType : form.assistanceType}
              onChange={(v) => (isGrip ? update("gripLoadType", v) : update("assistanceType", v))}
              options={isGrip ? GRIP_LOAD_TYPES : assistanceTypes}
            />
          </Field>
        </div>
        <Field label="Detail">
          <Input
            value={form.assistanceDetail || form.detail}
            onChange={(e) => {
              update("assistanceDetail", e.target.value);
              update("detail", e.target.value);
            }}
            placeholder={isGrip ? "20mm edge, +10kg..." : "Tuck, band, wall support..."}
          />
        </Field>
      </div>
    );
  }

  if (profile === "conditioning") {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Minutes">
            <Input
              inputMode="numeric"
              value={form.duration}
              onChange={(e) => update("duration", e.target.value)}
            />
          </Field>
          <Field label="Rounds">
            <Input
              inputMode="numeric"
              value={form.rounds || form.sets}
              onChange={(e) => update("rounds", e.target.value)}
            />
          </Field>
          <Field label="Load">
            <Input
              inputMode="decimal"
              value={form.weight}
              onChange={(e) => update("weight", e.target.value)}
            />
          </Field>
        </div>
        <IntensityRow form={form} update={update} intensities={intensities} />
        <Field label="Detail">
          <Input
            value={form.detail}
            onChange={(e) => update("detail", e.target.value)}
            placeholder="e.g. reps per minute"
          />
        </Field>
      </div>
    );
  }

  if (profile === "power") {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Sets">
            <Input
              inputMode="numeric"
              value={form.sets}
              onChange={(e) => update("sets", e.target.value)}
            />
          </Field>
          <Field label="Jumps">
            <Input
              inputMode="numeric"
              value={form.reps}
              onChange={(e) => update("reps", e.target.value)}
            />
          </Field>
          <Field label="Height (cm)">
            <Input
              inputMode="decimal"
              value={form.height}
              onChange={(e) => update("height", e.target.value)}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Quality">
            <SimpleSelect
              value={form.quality}
              onChange={(v) => update("quality", v)}
              options={qualities}
            />
          </Field>
          <Field label="RPE">
            <Input
              inputMode="decimal"
              value={form.rpe}
              onChange={(e) => update("rpe", e.target.value)}
            />
          </Field>
        </div>
      </div>
    );
  }

  if (profile === "climbing") {
    const showGradient = supportsClimbingGradient(form.exercise);
    return (
      <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tracking mode">
            <SimpleSelect
              value={form.climbingTrackingMode}
              onChange={(value) => {
                update("climbingTrackingMode", value);
                if (value === "Time only") update("climbingBoulders", "");
              }}
              options={[...CLIMBING_TRACKING_MODES]}
            />
          </Field>
          <Field label="Duration (minutes)">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_CLIMBING_MINUTES}
              step={1}
              value={form.duration}
              onChange={(event) => update("duration", event.target.value)}
              placeholder="75"
            />
          </Field>
          {form.climbingTrackingMode !== "Time only" ? (
            <Field label="Problems / routes">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.climbingBoulders}
                onChange={(event) => update("climbingBoulders", event.target.value)}
              />
            </Field>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Enter total minutes — for example, 1h 15m is 75.
        </p>
        <div className={`grid gap-3 ${showGradient ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
          <Field label="Max grade">
            <Input
              value={form.climbingMaxGrade}
              onChange={(event) => update("climbingMaxGrade", event.target.value)}
              placeholder="V5, 6b+, 7A..."
            />
          </Field>
          {showGradient ? (
            <Field label="Gradient">
              <SimpleSelect
                value={form.climbingGradient}
                onChange={(value) => update("climbingGradient", value)}
                options={BOARD_GRADIENTS}
              />
            </Field>
          ) : null}
          <Field label="Intensity">
            <SimpleSelect
              value={form.intensity}
              onChange={(value) => update("intensity", value)}
              options={intensities}
            />
          </Field>
          <Field label="RPE">
            <Input
              inputMode="decimal"
              value={form.rpe}
              onChange={(event) => update("rpe", event.target.value)}
            />
          </Field>
        </div>
        {validationIssue ? (
          <p className="text-xs font-medium text-destructive">{validationIssue}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Sets">
          <Input
            inputMode="numeric"
            value={form.sets}
            onChange={(e) => update("sets", e.target.value)}
          />
        </Field>
        <Field label="Reps">
          <Input
            inputMode="numeric"
            pattern="[0-9]*"
            value={form.reps}
            onChange={(e) => update("reps", e.target.value)}
          />
        </Field>
        {usesLoad && (
          <Field label="Weight">
            <Input
              inputMode="decimal"
              value={form.weight}
              onChange={(e) => update("weight", e.target.value)}
            />
          </Field>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Min">
          <Input
            inputMode="numeric"
            value={form.duration}
            onChange={(e) => update("duration", e.target.value)}
          />
        </Field>
        <Field label="Intensity">
          <SimpleSelect
            value={form.intensity}
            onChange={(v) => update("intensity", v)}
            options={intensities}
          />
        </Field>
        <Field label="RPE">
          <Input
            inputMode="decimal"
            value={form.rpe}
            onChange={(e) => update("rpe", e.target.value)}
          />
        </Field>
      </div>
      {usesStandardSets && (
        <Field label="Rest between sets">
          <SimpleSelect
            value={form.restTime}
            onChange={(v) => update("restTime", v)}
            options={REST_OPTIONS}
          />
        </Field>
      )}
    </div>
  );
}

export function PositionMeasurementField({
  label,
  direction,
  value,
  setup,
  onChange,
}: {
  label: string;
  direction: string;
  value: string;
  setup: string;
  onChange: (value: string, setup: string) => void;
}) {
  const matched = blockHeightOption(value, setup);
  const selectedValue = matched ? String(matched.heightCm) : "custom";

  return (
    <div className="space-y-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.04] p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Foam and cork block guide · {formatPositionMeasurementDirection(direction)}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <Field label="Block stack">
          <Select
            value={value ? selectedValue : undefined}
            onValueChange={(nextValue) => {
              if (nextValue === "custom") {
                onChange(matched ? "" : value, "");
                return;
              }
              const option = BLOCK_HEIGHT_OPTIONS.find(
                (candidate) => String(candidate.heightCm) === nextValue,
              );
              if (option) onChange(String(option.heightCm), option.setup);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a block height" />
            </SelectTrigger>
            <SelectContent>
              {BLOCK_HEIGHT_OPTIONS.map((option) => (
                <SelectItem
                  key={`${option.heightCm}-${option.setup}`}
                  value={String(option.heightCm)}
                >
                  {option.heightCm} cm — {option.setup}
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom measurement…</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Custom (cm)">
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.1"
            value={matched ? "" : value}
            onChange={(event) => onChange(event.target.value, "")}
            placeholder={matched ? `${matched.heightCm}` : "e.g. 8.5"}
          />
        </Field>
      </div>
      {matched ? (
        <p className="text-xs text-amber-100/80">
          {matched.heightCm} cm · bottom to top: {matched.setup}
        </p>
      ) : value ? (
        <p className="text-xs text-muted-foreground">Custom measurement: {value} cm</p>
      ) : null}
    </div>
  );
}

function IntensityRow({
  form,
  update,
  intensities,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  intensities: string[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Intensity">
        <SimpleSelect
          value={form.intensity}
          onChange={(v) => update("intensity", v)}
          options={intensities}
        />
      </Field>
      <Field label="RPE">
        <Input
          inputMode="decimal"
          value={form.rpe}
          onChange={(e) => update("rpe", e.target.value)}
        />
      </Field>
    </div>
  );
}
