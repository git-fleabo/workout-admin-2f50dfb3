import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RestTimer() {
  const [seconds, setSeconds] = useState("");
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [finished, setFinished] = useState(false);
  const duration = Number(seconds);
  const valid = Number.isInteger(duration) && duration > 0 && duration <= 7200;

  useEffect(() => {
    if (deadline === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setDeadline(null);
        setFinished(true);
      }
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [deadline]);

  return (
    <details className="rounded-lg border border-border bg-card p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Rest timer{deadline !== null ? " · Running" : finished ? " · Finished" : " · Optional"}
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-muted-foreground">
          Choose your rest time. Your workout&apos;s prescribed rest stays the same.
        </p>
        <div className="flex flex-wrap gap-2">
          {[30, 60, 90, 120].map((value) => (
            <Button
              key={value}
              type="button"
              variant="outline"
              size="sm"
              disabled={deadline !== null}
              onClick={() => setSeconds(String(value))}
            >
              {value}s
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-xs font-medium">
            Rest seconds
            <Input
              type="number"
              min={1}
              max={7200}
              step={1}
              inputMode="numeric"
              className="mt-1"
              value={seconds}
              disabled={deadline !== null}
              onChange={(event) => setSeconds(event.target.value)}
            />
          </label>
          <Button
            type="button"
            disabled={!valid || deadline !== null}
            onClick={() => {
              setFinished(false);
              setRemaining(duration);
              setDeadline(Date.now() + duration * 1000);
            }}
          >
            Start timer
          </Button>
          {deadline !== null ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeadline(null);
                setRemaining(0);
                setFinished(false);
              }}
            >
              Cancel timer
            </Button>
          ) : null}
        </div>
        {deadline !== null ? (
          <p
            role="timer"
            aria-label="Rest remaining"
            className="text-2xl font-semibold tabular-nums"
          >
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
          </p>
        ) : null}
        <p role="status" className="text-sm">
          {finished ? "Rest finished. Continue when ready." : ""}
        </p>
      </div>
    </details>
  );
}
