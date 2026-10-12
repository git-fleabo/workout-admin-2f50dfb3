import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SessionDurationField({
  value,
  min,
  max,
  onChange,
  label = "Total duration",
  description,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label?: string;
  description?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label
        htmlFor={id}
        className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
      >
        {label} <span className="sr-only">(minutes)</span>
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={5}
          value={value}
          aria-describedby={description ? `${id}-description` : undefined}
          onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value))))}
        />
        <span aria-hidden="true" className="text-xs text-muted-foreground">
          minutes
        </span>
      </div>
      {description ? (
        <p id={`${id}-description`} className="text-[10px] text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
